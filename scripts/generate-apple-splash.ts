import fs from "fs";
import path from "path";
import sharp from "sharp";

const source = path.resolve("public/splash.jpg");
const outputDir = path.resolve("public/apple-splash");

if (!fs.existsSync(source)) {
  console.error(`Source image not found at ${source}`);
  process.exit(1);
}

const splashSpecs = [
  { width: 640, height: 1136 },
  { width: 750, height: 1334 },
  { width: 828, height: 1792 },
  { width: 1080, height: 2340 },
  { width: 1125, height: 2436 },
  { width: 1170, height: 2532 },
  { width: 1242, height: 2688 },
  { width: 1284, height: 2778 },
  { width: 1290, height: 2796 },
  { width: 1536, height: 2048 },
  { width: 1620, height: 2160 },
  { width: 1668, height: 2224 },
  { width: 1668, height: 2388 },
  { width: 2048, height: 2732 },
];

async function generate() {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const { width, height } of splashSpecs) {
    const fileName = `apple-splash-${width}x${height}.png`;
    const outPath = path.join(outputDir, fileName);
    await sharp(source)
      .resize(width, height, { fit: "cover" })
      .png()
      .toFile(outPath);
    console.log(`Generated ${fileName}`);
  }
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
