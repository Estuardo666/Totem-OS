import { build } from "esbuild";
import { copyFileSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";

const workerRoot = dirname(fileURLToPath(import.meta.url));
const schemaSource = resolve(workerRoot, "..", "prisma", "schema.prisma");
const existingGeneratedSchema = resolve(workerRoot, "node_modules", ".prisma", "client", "schema.prisma");
const buildSchema = resolve(workerRoot, ".whatsapp-build-schema.prisma");
const needsPrismaGenerate = !existsSync(existingGeneratedSchema)
  || !readFileSync(existingGeneratedSchema).equals(readFileSync(schemaSource));

if (needsPrismaGenerate) {
  copyFileSync(schemaSource, buildSchema);
  try {
    execFileSync(process.execPath, [resolve(workerRoot, "node_modules", "prisma", "build", "index.js"), "generate", "--schema", buildSchema], {
      cwd: workerRoot,
      stdio: "inherit",
    });
  } finally {
    unlinkSync(buildSchema);
  }
} else {
  console.log("Prisma Client ya corresponde al schema actual; se reutiliza sin modificar archivos activos.");
}

const packageJson = JSON.parse(await (await import("node:fs/promises")).readFile(resolve(workerRoot, "package.json"), "utf8"));
const installedPackages = new Set([...Object.keys(packageJson.dependencies ?? {}), ...Object.keys(packageJson.devDependencies ?? {})]);
const result = await build({
  entryPoints: [resolve(workerRoot, "sri-http.ts")],
  outfile: resolve(workerRoot, "dist/sri/server.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  packages: "external",
  alias: { "@": resolve(workerRoot, "..", "src") },
  define: { "process.env.SRI_HTTP_MODE": '"1"' },
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

copyFileSync(resolve(workerRoot, 'sri-trigger.mjs'), resolve(workerRoot, 'dist/sri/trigger.mjs'));
