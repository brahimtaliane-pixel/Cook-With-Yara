import satori from "satori";
import sharp from "sharp";
import { readFile } from "fs/promises";
import { join } from "path";
import type { ReactNode } from "react";

// === Types ===

export interface PinImageParams {
  title: string;
  heroImageUrl: string;
}

// === Font loading ===

let fontDataCache: ArrayBuffer | null = null;

async function getFontData(): Promise<ArrayBuffer> {
  if (fontDataCache) return fontDataCache;

  // Fetch a bold, clean sans-serif from Google Fonts
  const res = await fetch(
    "https://fonts.googleapis.com/css2?family=DM+Sans:wght@800&display=swap",
  );
  const css = await res.text();

  const fontUrlMatch = css.match(/src:\s*url\(([^)]+)\)/);
  if (!fontUrlMatch?.[1]) {
    throw new Error("Could not extract font URL from Google Fonts CSS");
  }

  const fontRes = await fetch(fontUrlMatch[1]);
  fontDataCache = await fontRes.arrayBuffer();
  return fontDataCache;
}

// === Logo loading ===

let logoDataUriCache: string | null = null;

async function getLogoDataUri(): Promise<string> {
  if (logoDataUriCache) return logoDataUriCache;

  try {
    const logoPath = join(process.cwd(), "public", "mylogo.png");
    const logoBuffer = await readFile(logoPath);
    logoDataUriCache = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch {
    logoDataUriCache = "";
  }
  return logoDataUriCache;
}

// === Pin image generator ===

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PinLayout({
  title,
  heroImageUrl,
  logoDataUri,
}: {
  title: string;
  heroImageUrl: string;
  logoDataUri: string;
}): any {
  return {
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
        // Background hero image (full bleed)
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
        // Dark gradient overlay for readability
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
        // Title banner in the middle
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
                      fontSize: title.length > 30 ? "52px" : "60px",
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
        // Logo at the bottom
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
                      style: {
                        height: "50px",
                      },
                    },
                  },
                },
              },
            ]
          : []),
      ],
    },
  };
}

export async function generatePinImage(
  params: PinImageParams,
): Promise<Buffer> {
  const [fontData, logoDataUri] = await Promise.all([
    getFontData(),
    getLogoDataUri(),
  ]);

  const element = PinLayout({
    title: params.title,
    heroImageUrl: params.heroImageUrl,
    logoDataUri,
  });

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

  return Buffer.from(
    await sharp(Buffer.from(svg)).png().toBuffer(),
  );
}
