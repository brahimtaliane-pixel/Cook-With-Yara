import sharp from "sharp";
import { readFile, writeFile } from "fs/promises";

async function main() {
  const src = await readFile("public/yara-kitchen.webp");
  const out = await sharp(src)
    .extract({ left: 370, top: 540, width: 320, height: 320 })
    .resize(360, 360)
    .png()
    .toBuffer();
  await writeFile("test-yara-portrait.png", out);
  console.log("wrote test-yara-portrait.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
