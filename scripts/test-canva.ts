/**
 * Test Script: Pin Image Generator (Step 4 — Satori)
 * Run: npx tsx scripts/test-canva.ts
 *
 * Generates a test Pinterest pin image and saves it locally.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import satori from "satori";
import sharp from "sharp";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

async function main() {
  console.log("Testing pin image generation (Satori)...");

  // Load font
  console.log("Loading font...");
  const fontCssRes = await fetch(
    "https://fonts.googleapis.com/css2?family=DM+Sans:wght@800&display=swap",
  );
  const css = await fontCssRes.text();
  const fontUrlMatch = css.match(/src:\s*url\(([^)]+)\)/);
  if (!fontUrlMatch?.[1]) throw new Error("Could not extract font URL");
  const fontRes = await fetch(fontUrlMatch[1]);
  const fontData = await fontRes.arrayBuffer();

  // Load logo
  console.log("Loading logo...");
  let logoDataUri = "";
  try {
    const logoPath = join(process.cwd(), "public", "mylogo.png");
    const logoBuffer = await readFile(logoPath);
    logoDataUri = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch {
    console.log("  Logo not found, skipping.");
  }

  // Use a sample food image
  const heroImageUrl =
    "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=1000&q=80";
  const title = "Creamy Garlic Chicken";

  console.log(`Generating pin: "${title}"`);

  const element = {
    type: "div",
    props: {
      style: {
        width: "1000px",
        height: "1500px",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#1a1a1a",
      },
      children: [
        {
          type: "img",
          props: {
            src: heroImageUrl,
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              width: "1000px",
              height: "1500px",
              objectFit: "cover",
            },
          },
        },
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              width: "1000px",
              height: "1500px",
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.1) 100%)",
            },
          },
        },
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              top: "600px",
              left: 0,
              width: "1000px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "0 40px",
            },
            children: {
              type: "div",
              props: {
                style: {
                  backgroundColor: "rgba(245, 235, 220, 0.92)",
                  padding: "36px 50px",
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  textAlign: "center",
                  borderTop: "4px solid rgba(180, 140, 80, 0.6)",
                  borderBottom: "4px solid rgba(180, 140, 80, 0.6)",
                },
                children: {
                  type: "div",
                  props: {
                    style: {
                      color: "#2a2a2a",
                      fontSize: "60px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "2px",
                      lineHeight: 1.2,
                      textAlign: "center",
                    },
                    children: title,
                  },
                },
              },
            },
          },
        },
        ...(logoDataUri
          ? [
              {
                type: "div",
                props: {
                  style: {
                    position: "absolute",
                    bottom: "30px",
                    right: "30px",
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    borderRadius: "12px",
                    padding: "10px 18px",
                  },
                  children: {
                    type: "img",
                    props: {
                      src: logoDataUri,
                      style: { height: "50px" },
                    },
                  },
                },
              },
            ]
          : []),
      ],
    },
  };

  const svg = await satori(element as React.ReactNode, {
    width: 1000,
    height: 1500,
    fonts: [
      {
        name: "DM Sans",
        data: fontData,
        weight: 800,
        style: "normal",
      },
    ],
  });

  console.log("Converting SVG to PNG...");
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  const outputPath = join(process.cwd(), "test-pin.png");
  await writeFile(outputPath, pngBuffer);

  console.log(`\nPin image generated successfully!`);
  console.log(`Saved to: ${outputPath}`);
  console.log(`Size: ${(pngBuffer.length / 1024).toFixed(0)} KB`);
  console.log(`Open it: open test-pin.png`);
}

main().catch((err) => {
  console.error("Pin image test failed:", err.message);
  process.exit(1);
});
