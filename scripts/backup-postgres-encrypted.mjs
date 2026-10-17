import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { parseEnv } from "node:util";
import { PrismaClient } from "@prisma/client";

// Read-only remote backup; the only restore destination is a new, isolated local container.
// The destination must already have a private Windows ACL. Never run inside the repository.
const [backupDirArg, expectedHost, expectedDatabase] = process.argv.slice(2);
if (process.platform !== "win32" || !backupDirArg || !expectedHost || !expectedDatabase) {
  throw new Error("Usage (Windows): node scripts/backup-postgres-encrypted.mjs <private-backup-dir> <expected-host> <expected-database>");
}
const root = fs.realpathSync(process.cwd());
const backupDir = fs.realpathSync(backupDirArg);
const relative = path.relative(root, backupDir);
const outsideRepository = relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
if (!outsideRepository) throw new Error("Backup must be outside the repository");
if (fs.existsSync(path.join(backupDir, "database.pgdump.aes"))) throw new Error("Existing backup will never be overwritten");
const env = parseEnv(fs.readFileSync(".env", "utf8"));
const url = new URL(env.DATABASE_URL_UNPOOLED || env.DATABASE_URL);
if (url.hostname !== expectedHost || decodeURIComponent(url.pathname.slice(1)) !== expectedDatabase || url.searchParams.get("sslmode") !== "require") {
  throw new Error("Database identity / TLS preflight failed");
}
const localEnv = fs.existsSync(".env.local") ? parseEnv(fs.readFileSync(".env.local", "utf8")) : {};
if (localEnv.DATABASE_URL) {
  const localUrl = new URL(localEnv.DATABASE_URL);
  if (localUrl.pathname !== url.pathname || localUrl.hostname.replace("-pooler.", ".") !== url.hostname) throw new Error("Conflicting local database configuration");
}

const sha = (data) => crypto.createHash("sha256").update(data).digest("hex");
const quote = (name) => `"${name.replaceAll('"', '""')}"`;
const key = crypto.randomBytes(32);
function run(command, args, input) {
  const result = spawnSync(command, args, { input, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  // Child stderr may contain connection information; do not copy it into logs.
  if (result.error || result.status !== 0) throw new Error(`${command} failed (exit ${result.status ?? "spawn"})`);
  return result.stdout;
}
function waitForChild(child) {
  return new Promise((resolve, reject) => {
    child.on("error", () => reject(new Error("Subprocess failed to start")));
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`Subprocess exited ${code}`)));
  });
}
function cipher() {
  const iv = crypto.randomBytes(12);
  return { iv, stream: crypto.createCipheriv("aes-256-gcm", key, iv) };
}
const wrappedKey = run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Add-Type -AssemblyName System.Security; $keyBytes = [Convert]::FromBase64String([Console]::In.ReadToEnd()); [Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Protect($keyBytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser))"], key.toString("base64")).trim();
fs.writeFileSync(path.join(backupDir, "key.dpapi"), wrappedKey, { flag: "wx" });
const pgEnvPath = path.join(backupDir, `.pg-${crypto.randomUUID()}.env`);
const pgEnv = {
  PGHOST: url.hostname, PGPORT: url.port || "5432", PGDATABASE: expectedDatabase,
  PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
  PGSSLMODE: "require", PGCONNECT_TIMEOUT: "30", PGOPTIONS: "-c default_transaction_read_only=on",
};
for (const value of Object.values(pgEnv)) if (/[\r\n\0]/.test(value)) throw new Error("Invalid libpq environment value");
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const manifest = { createdAt: new Date().toISOString(), database: expectedDatabase, host: expectedHost, encryption: "AES-256-GCM; key.dpapi uses Windows CurrentUser", verified: false };
let containerId;
try {
  const inventory = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
    const [meta] = await tx.$queryRawUnsafe("SELECT current_database() AS database, current_setting('server_version_num') AS version");
    if (meta.database !== expectedDatabase || Number(meta.version) < 170000 || Number(meta.version) >= 180000) throw new Error("This backup is pinned to PostgreSQL 17");
    const [{ snapshot }] = await tx.$queryRawUnsafe("SELECT pg_export_snapshot() AS snapshot");
    const tables = await tx.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    const source = [];
    for (const { tablename } of tables) {
      const rows = await tx.$queryRawUnsafe(`SELECT row_to_json(t)::text AS row FROM public.${quote(tablename)} t`);
      source.push({ table: tablename, count: rows.length, sha256: sha(rows.map((r) => r.row).sort().join("\n")) });
    }
    fs.writeFileSync(pgEnvPath, Object.entries(pgEnv).map(([k, v]) => `${k}=${v}`).join("\n"), { flag: "wx" });
    const enc = cipher();
    const partialPath = path.join(backupDir, "database.pgdump.aes.partial");
    fs.writeFileSync(partialPath, Buffer.concat([Buffer.from("TOTEMPG1"), enc.iv]), { flag: "wx" });
    const child = spawn("docker", ["run", "--rm", "--env-file", pgEnvPath, "postgres:17", "pg_dump", "--format=custom", "--no-owner", "--no-acl", "--lock-wait-timeout=15000", `--snapshot=${snapshot}`], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    child.stderr.resume();
    await Promise.all([waitForChild(child), pipeline(child.stdout, enc.stream, fs.createWriteStream(partialPath, { flags: "a" }))]);
    fs.appendFileSync(partialPath, enc.stream.getAuthTag());
    fs.renameSync(partialPath, path.join(backupDir, "database.pgdump.aes"));
    return source;
  }, { timeout: 300000, maxWait: 30000 });
  fs.rmSync(pgEnvPath, { force: true });
  manifest.sourceInventory = inventory;
  const config = {};
  for (const file of [".env", ".env.local", ".env.whatsapp.local", "worker/.env", ".vercel/project.json"]) {
    if (fs.existsSync(file)) config[file] = fs.readFileSync(file).toString("base64");
  }
  const enc = cipher();
  const encryptedConfig = Buffer.concat([enc.stream.update(JSON.stringify(config)), enc.stream.final()]);
  fs.writeFileSync(path.join(backupDir, "local-config.aes"), Buffer.concat([Buffer.from("TOTEMPG1"), enc.iv, encryptedConfig, enc.stream.getAuthTag()]), { flag: "wx" });
  console.log("Encrypted database and configuration backup created; testing isolated restore.");

  const name = `totem-restore-check-${crypto.randomUUID().slice(0, 8)}`;
  containerId = run("docker", ["run", "-d", "--name", name, "--label", "totem.release-backup=restore-check", "--network", "none", "--tmpfs", "/var/lib/postgresql/data", "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17"]).trim();
  if (!/^[a-f0-9]{64}$/.test(containerId)) throw new Error("Unexpected isolated container identity");
  let ready = false;
  for (let i = 0; i < 30; i++) {
    const check = spawnSync("docker", ["exec", containerId, "pg_isready", "-U", "postgres"], { windowsHide: true });
    if (check.status === 0) { ready = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Isolated database did not start");
  run("docker", ["exec", containerId, "createdb", "-U", "postgres", "totem_restore_verify"]);
  const archive = fs.readFileSync(path.join(backupDir, "database.pgdump.aes"));
  const dec = crypto.createDecipheriv("aes-256-gcm", key, archive.subarray(8, 20));
  dec.setAuthTag(archive.subarray(-16));
  // Verify authentication before feeding any archive bytes into the isolated database.
  const dump = Buffer.concat([dec.update(archive.subarray(20, -16)), dec.final()]);
  run("docker", ["exec", "-i", containerId, "pg_restore", "-U", "postgres", "--dbname=totem_restore_verify", "--no-owner", "--no-privileges", "--exit-on-error"], dump);
  dump.fill(0);
  const restoredTables = JSON.parse(run("docker", ["exec", containerId, "psql", "-XAt", "-U", "postgres", "-d", "totem_restore_verify", "-c", "SELECT json_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public'"]));
  if (JSON.stringify(restoredTables) !== JSON.stringify(inventory.map((t) => t.table))) throw new Error("Restored table set mismatch");
  for (const table of inventory) {
    const result = run("docker", ["exec", containerId, "psql", "-XAt", "-U", "postgres", "-d", "totem_restore_verify", "-c", `SELECT row_to_json(t)::text FROM public.${quote(table.table)} t`]);
    const rows = result.trimEnd() ? result.trimEnd().split("\n").map((r) => r.replace(/\r$/, "")) : [];
    if (rows.length !== table.count || sha(rows.sort().join("\n")) !== table.sha256) throw new Error(`Restored content mismatch: ${table.table}`);
  }
  // Also prove the saved DPAPI envelope can recover the encryption key.
  const recovered = run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Add-Type -AssemblyName System.Security; $wrappedBytes = [Convert]::FromBase64String([Console]::In.ReadToEnd()); [Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Unprotect($wrappedBytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser))"], wrappedKey).trim();
  if (!crypto.timingSafeEqual(Buffer.from(recovered, "base64"), key)) throw new Error("DPAPI key recovery failed");
  manifest.verified = true;
  manifest.verifiedAt = new Date().toISOString();
  manifest.restoreIsolation = "New PostgreSQL 17 container; network none; no published ports; tmpfs; no app processes";
  console.log(JSON.stringify({ verified: true, tables: inventory.length, rows: inventory.reduce((sum, t) => sum + t.count, 0), authPreserved: inventory.some((t) => t.table === "WhatsAppAuth" && t.count > 0) }));
} catch (error) {
  manifest.failure = /^(Restored content mismatch: [A-Za-z_]+|Restored table set mismatch|DPAPI key recovery failed|Isolated database did not start|This backup is pinned to PostgreSQL 17|Subprocess exited \d+|[a-z.]+ failed \(exit [\w]+\))$/.test(error.message) ? error.message : "Backup / verification failed; secret details suppressed";
  console.error(manifest.failure);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  fs.rmSync(pgEnvPath, { force: true });
  if (containerId && /^[a-f0-9]{64}$/.test(containerId)) {
    const label = run("docker", ["inspect", "--format", '{{ index .Config.Labels "totem.release-backup" }}', containerId]).trim();
    if (label !== "restore-check") throw new Error("Refusing to remove an unrecognized container");
    run("docker", ["rm", "-f", containerId]);
    manifest.isolatedContainerRemoved = true;
  }
  for (const file of ["database.pgdump.aes", "local-config.aes", "key.dpapi"]) {
    if (fs.existsSync(path.join(backupDir, file))) (manifest.artifacts ??= []).push({ file, bytes: fs.statSync(path.join(backupDir, file)).size, sha256: sha(fs.readFileSync(path.join(backupDir, file))) });
  }
  fs.writeFileSync(path.join(backupDir, "database-manifest.json"), JSON.stringify(manifest, null, 2));
  key.fill(0);
}
