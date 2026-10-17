import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fs.realpathSync(fileURLToPath(new URL("../../", import.meta.url)));

test("production backup refuses repository destinations, including children named with two dots", { skip: process.platform !== "win32" }, () => {
  for (const prefix of ["release-backup-guard-", "..release-backup-guard-"]) {
    const directory = fs.mkdtempSync(path.join(root, prefix));
    try {
      const result = spawnSync(process.execPath, ["scripts/backup-postgres-encrypted.mjs", directory, "example.invalid", "unused"], { cwd: root, encoding: "utf8", windowsHide: true });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Backup must be outside the repository/);
      assert.deepEqual(fs.readdirSync(directory), [], "no keys, env files or dump may be created before rejection");
    } finally {
      // Only the exact empty directory created by this test is removed.
      fs.rmdirSync(directory);
    }
  }
});
