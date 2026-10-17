import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

// Read-only gate. This script never migrates, seeds, updates configuration or sends messages.
const [backupDir, expectedHost, expectedDatabase] = process.argv.slice(2);
if (!backupDir || !expectedHost || !expectedDatabase) throw new Error("Usage: node scripts/check-whatsapp-release.mjs <backup-dir> <expected-host> <expected-database>");
const sha = (data) => crypto.createHash("sha256").update(data).digest("hex");
const env = parseEnv(fs.readFileSync(".env", "utf8"));
const url = new URL(env.DATABASE_URL_UNPOOLED || env.DATABASE_URL);
if (url.hostname !== expectedHost || decodeURIComponent(url.pathname.slice(1)) !== expectedDatabase || url.searchParams.get("sslmode") !== "require") throw new Error("Unexpected database identity / TLS configuration");
const backup = JSON.parse(fs.readFileSync(path.join(backupDir, "database-manifest.json"), "utf8"));
if (!backup.verified || !backup.isolatedContainerRemoved || backup.host !== expectedHost || backup.database !== expectedDatabase) throw new Error("A matching, restored and verified backup is required");
const age = Date.now() - Date.parse(backup.createdAt);
if (!Number.isFinite(age) || age < 0 || age > 24 * 60 * 60 * 1000) throw new Error("Backup must be less than 24 hours old; refresh immediately before deployment");
for (const file of ["database.pgdump.aes", "local-config.aes", "key.dpapi"]) {
  const artifact = backup.artifacts.find((a) => a.file === file);
  if (!artifact || sha(fs.readFileSync(path.join(backupDir, file))) !== artifact.sha256) throw new Error(`Backup integrity check failed: ${file}`);
}
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
try {
  const evidence = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const rows = await tx.$queryRawUnsafe('SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name');
    const local = fs.readdirSync("prisma/migrations").filter((name) => fs.existsSync(`prisma/migrations/${name}/migration.sql`)).sort();
    const applied = rows.map((r) => r.migration_name).sort();
    if (JSON.stringify(local) !== JSON.stringify(applied)) throw new Error("Migration history differs; do not deploy or run schema synchronization");
    for (const migration of rows) {
      const sql = fs.readFileSync(`prisma/migrations/${migration.migration_name}/migration.sql`, "utf8");
      if (!migration.finished_at || migration.rolled_back_at || ![sha(sql), sha(sql.replace(/\r\n/g, "\n"))].includes(migration.checksum)) throw new Error(`Migration validation failed: ${migration.migration_name}`);
    }
    const flags = await tx.globalConfig.findMany({ where: { key: { in: ["whatsapp.paused", "whatsapp.clientsEnabled"] } }, select: { key: true, value: true } });
    const values = Object.fromEntries(flags.map((f) => [f.key, f.value]));
    if (values["whatsapp.paused"] !== "true" || values["whatsapp.clientsEnabled"] !== "false") throw new Error("Production must remain paused with client messaging disabled during preparation");
    const authRows = await tx.whatsAppAuth.count();
    if (authRows === 0) throw new Error("Existing WhatsApp session is missing; do not copy staging authentication over production");
    return { migrations: rows.length, paused: true, clientsEnabled: false, authenticationPresent: true };
  }, { timeout: 30000 });
  const diff = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-schema-datasource", "prisma/schema.prisma", "--to-schema-datamodel", "prisma/schema.prisma", "--script", "--exit-code"], {
    encoding: "utf8", windowsHide: true,
    env: { ...process.env, DATABASE_URL: url.toString(), DATABASE_URL_UNPOOLED: url.toString() },
  });
  if (diff.error || diff.status !== 0) throw new Error("Schema drift detected (or comparison unavailable); no database changes are allowed");
  console.log(JSON.stringify({ databaseGate: "PASS", observedAt: new Date().toISOString(), ...evidence, schemaDiff: "empty", backupVerified: true, productionModified: false }));
} catch (error) {
  // Prisma connection errors may embed DSNs. Only our explicit guard messages are printed.
  const safe = /^(Migration history differs|Migration validation failed|Production must remain|Existing WhatsApp session|Schema drift detected)/.test(error.message);
  console.error(safe ? error.message : "Read-only release check failed; sensitive details suppressed");
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
