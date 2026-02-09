import fs from "fs";
import path from "path";
import sharp from "sharp";

const source = path.resolve("public/splash.jpg");
const outputDir = path.resolve("public/apple-splash");

if (!fs.existsSync(source)) {
  console.error(`Source image not found at ${source}`);
  process.exit(1);
}

// Complete list of iOS device splash screen sizes (2024)
const splashSpecs = [
  // iPhone SE, 8, 7, 6s, 6 (4.7")
  { width: 750, height: 1334 },
  // iPhone 8 Plus, 7 Plus, 6s Plus, 6 Plus (5.5")
  { width: 1242, height: 2208 },
  // iPhone X, XS, 11 Pro (5.8")
  { width: 1125, height: 2436 },
  // iPhone XR, 11 (6.1" LCD)
  { width: 828, height: 1792 },
  // iPhone XS Max, 11 Pro Max (6.5")
  { width: 1242, height: 2688 },
  // iPhone 12 mini, 13 mini (5.4")
  { width: 1080, height: 2340 },
  // iPhone 12, 12 Pro, 13, 13 Pro, 14 (6.1" OLED)
  { width: 1170, height: 2532 },
  // iPhone 12 Pro Max, 13 Pro Max (6.7")
  { width: 1284, height: 2778 },
  // iPhone 14 Pro, 15, 15 Pro (6.1" Dynamic Island)
  { width: 1179, height: 2556 },
  // iPhone 14 Pro Max, 15 Plus, 15 Pro Max (6.7" Dynamic Island)
  { width: 1290, height: 2796 },
  // iPad Mini, iPad 9.7"
  { width: 1536, height: 2048 },
  // iPad 10.2"
  { width: 1620, height: 2160 },
  // iPad Air 10.5"
  { width: 1668, height: 2224 },
  // iPad Pro 11"
  { width: 1668, height: 2388 },
  // iPad Pro 12.9"
  { width: 2048, height: 2732 },
];

async function generate() {
  fs.mkdirSync(outputDir, { recursive: true });
  
  for (const { width, height } of splashSpecs) {
    const fileName = `apple-splash-${width}x${height}.png`;
    const outPath = path.join(outputDir, fileName);
    
    await sharp(source)
      .resize(width, height, { fit: "cover" })
      .png({ 
        quality: 80,
        compressionLevel: 9, // Maximum compression
        palette: true // Use palette-based PNG for smaller size
      })
      .toFile(outPath);
    
    const stats = fs.statSync(outPath);
    const sizeKB = Math.round(stats.size / 1024);
    console.log(`Generated ${fileName} (${sizeKB} KB)`);
  }
  
  console.log("\n✅ All splash screens generated!");
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
