import { build } from "esbuild";
import { copyFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";

const workerRoot = dirname(fileURLToPath(import.meta.url));
const buildSchema = resolve(workerRoot, ".whatsapp-build-schema.prisma");

copyFileSync(resolve(workerRoot, "..", "prisma", "schema.prisma"), buildSchema);
try {
  execFileSync(process.execPath, [resolve(workerRoot, "node_modules", "prisma", "build", "index.js"), "generate", "--schema", buildSchema], {
    cwd: workerRoot,
    stdio: "inherit",
  });
} finally {
  unlinkSync(buildSchema);
}

const packageJson = JSON.parse(await (await import("node:fs/promises")).readFile(resolve(workerRoot, "package.json"), "utf8"));
const installedPackages = new Set([...Object.keys(packageJson.dependencies ?? {}), ...Object.keys(packageJson.devDependencies ?? {})]);
const result = await build({
  entryPoints: [resolve(workerRoot, "whatsapp/index.ts")],
  outfile: resolve(workerRoot, "dist/whatsapp/index.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  packages: "external",
  alias: { "@": resolve(workerRoot, "..", "src") },
  define: { "process.env.TOTEM_WHATSAPP_WORKER": '"1"' },
  minifySyntax: true,
  sourcemap: true,
  metafile: true,
  logLevel: "info",
});

const builtins = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);
const externalPaths = Object.values(result.metafile.outputs).flatMap((output) => output.imports)
  .filter((item) => item.external && !item.path.startsWith(".") && !builtins.has(item.path));
const externalPackages = new Set(externalPaths.map(({ path }) => {
  const [first, second] = path.split("/");
  return first.startsWith("@") ? `${first}/${second}` : first;
}));
const missingPackages = [...externalPackages].filter((name) => !installedPackages.has(name));
if (missingPackages.length) throw new Error(`Paquetes externos no declarados en worker/package.json: ${missingPackages.join(", ")}`);
const appOnlyPackages = ["next", "next-auth", "pusher", "pusher-js", "react", "react-dom"];
const retainedAppPackages = [...externalPackages].filter((name) => appOnlyPackages.includes(name));
if (retainedAppPackages.length) throw new Error(`El runtime WhatsApp aún depende de paquetes web: ${retainedAppPackages.join(", ")}`);
console.log(`Dependencias runtime externas verificadas: ${[...externalPackages].sort().join(", ")}`);
