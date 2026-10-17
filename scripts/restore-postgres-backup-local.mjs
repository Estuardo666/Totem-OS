import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

// Offline recovery drill. No remote database URL, app, port or host mount is accepted.
const [backupDir] = process.argv.slice(2);
if (process.platform !== "win32" || !backupDir) throw new Error("Usage (same Windows user): node scripts/restore-postgres-backup-local.mjs <backup-dir>");
const sha = (data) => crypto.createHash("sha256").update(data).digest("hex");
function run(args, input) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error("Isolated Docker operation failed; no remote database was accessed");
  return result.stdout;
}
const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, "database-manifest.json"), "utf8"));
for (const file of ["database.pgdump.aes", "local-config.aes", "key.dpapi"]) {
  const record = manifest.artifacts.find((a) => a.file === file);
  if (!record || sha(fs.readFileSync(path.join(backupDir, file))) !== record.sha256) throw new Error(`Backup integrity failed: ${file}`);
}
const recovered = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Add-Type -AssemblyName System.Security; $wrappedBytes = [Convert]::FromBase64String([Console]::In.ReadToEnd()); [Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Unprotect($wrappedBytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser))"], {
  input: fs.readFileSync(path.join(backupDir, "key.dpapi")), encoding: "utf8", windowsHide: true,
});
if (recovered.error || recovered.status !== 0) throw new Error("Key recovery failed; use the Windows user/profile that created this backup");
const key = Buffer.from(recovered.stdout.trim(), "base64");
function decrypt(file) {
  const bytes = fs.readFileSync(path.join(backupDir, file));
  if (bytes.subarray(0, 8).toString() !== "TOTEMPG1") throw new Error("Unrecognized encrypted archive");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, bytes.subarray(8, 20));
  decipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([decipher.update(bytes.subarray(20, -16)), decipher.final()]);
}
let container;
try {
  // Prove both artifacts can be decrypted; configuration values never leave memory.
  const configuration = decrypt("local-config.aes");
  JSON.parse(configuration.toString("utf8"));
  configuration.fill(0);
  const dump = decrypt("database.pgdump.aes");
  container = run(["run", "-d", "--name", `totem-recovery-drill-${crypto.randomUUID().slice(0, 8)}`, "--label", "totem.release-backup=recovery-drill", "--network", "none", "--tmpfs", "/var/lib/postgresql/data", "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17"]).trim();
  if (!/^[a-f0-9]{64}$/.test(container)) throw new Error("Unexpected recovery container identity");
  let ready = false;
  for (let i = 0; i < 30; i++) {
    if (spawnSync("docker", ["exec", container, "pg_isready", "-U", "postgres"], { windowsHide: true }).status === 0) { ready = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Isolated PostgreSQL did not start");
  run(["exec", container, "createdb", "-U", "postgres", "totem_recovery_test"]);
  run(["exec", "-i", container, "pg_restore", "-U", "postgres", "-d", "totem_recovery_test", "--no-owner", "--no-privileges", "--exit-on-error"], dump);
  dump.fill(0);
  const tables = JSON.parse(run(["exec", container, "psql", "-XAt", "-U", "postgres", "-d", "totem_recovery_test", "-c", "SELECT json_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public'"]));
  if (JSON.stringify(tables) !== JSON.stringify(manifest.sourceInventory.map((t) => t.table))) throw new Error("Restored table set mismatch");
  for (const table of manifest.sourceInventory) {
    const quoted = `"${table.table.replaceAll('"', '""')}"`;
    const text = run(["exec", container, "psql", "-XAt", "-U", "postgres", "-d", "totem_recovery_test", "-c", `SELECT row_to_json(t)::text FROM public.${quoted} t`]);
    const rows = text.trimEnd() ? text.trimEnd().split("\n").map((r) => r.replace(/\r$/, "")) : [];
    if (rows.length !== table.count || sha(rows.sort().join("\n")) !== table.sha256) throw new Error(`Recovery mismatch: ${table.table}`);
  }
  console.log(JSON.stringify({ offlineRecovery: "PASS", tables: tables.length, rows: manifest.sourceInventory.reduce((sum, t) => sum + t.count, 0), configurationDecrypted: true, remoteDatabaseAccessed: false }));
} finally {
  key.fill(0);
  if (container && /^[a-f0-9]{64}$/.test(container)) {
    const label = run(["inspect", "--format", '{{ index .Config.Labels "totem.release-backup" }}', container]).trim();
    if (label !== "recovery-drill") throw new Error("Refusing to remove an unrecognized container");
    run(["rm", "-f", container]);
  }
}
