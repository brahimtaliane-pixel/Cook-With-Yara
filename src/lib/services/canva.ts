import satori from "satori";
import sharp from "sharp";
import { readFile } from "fs/promises";
import { join } from "path";

// === Types ===

export interface PinImageParams {
  title: string;
  heroImageUrl: string;
}

// === Brand colors ===

const BRAND = {
  primary: "#9A3412",
  warm: "#FEF7ED",
  accent: "#C2410C",
  gold: "#D97706",
  foreground: "#1C1917",
  cream: "#FFFBF5",
};

// === Font loading ===

let dmSansCache: ArrayBuffer | null = null;
let playfairCache: ArrayBuffer | null = null;

async function loadFont(url: string): Promise<ArrayBuffer> {
  const cssRes = await fetch(url);
  const css = await cssRes.text();
  const match = css.match(/src:\s*url\(([^)]+)\)/);
  if (!match?.[1]) throw new Error("Could not extract font URL");
  const fontRes = await fetch(match[1]);
  return fontRes.arrayBuffer();
}

async function getDmSans(): Promise<ArrayBuffer> {
  if (dmSansCache) return dmSansCache;
  dmSansCache = await loadFont(
    "https://fonts.googleapis.com/css2?family=DM+Sans:wght@600&display=swap",
  );
  return dmSansCache;
}

async function getPlayfair(): Promise<ArrayBuffer> {
  if (playfairCache) return playfairCache;
  playfairCache = await loadFont(
    "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap",
  );
  return playfairCache;
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

// === Helpers ===

function star() {
  return {
    type: "svg",
    props: {
      width: "22",
      height: "22",
      viewBox: "0 0 24 24",
      children: {
        type: "path",
        props: {
          d: "M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z",
          fill: BRAND.gold,
        },
      },
    },
  };
}

function decorativeDot(color: string, size = 8) {
  return {
    type: "div",
    props: {
      style: {
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        backgroundColor: color,
      },
    },
  };
}

function decorativeLine(width: number, color: string) {
  return {
    type: "div",
    props: {
      style: {
        width: `${width}px`,
        height: "2px",
        backgroundColor: color,
        borderRadius: "1px",
      },
    },
  };
}

// === Pin image layout ===

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
  const W = 1000;
  const H = 1500;
  const PAD = 28;
  const INNER_W = W - PAD * 2;
  const TOP_IMG_H = 530;
  const BAND_H = 310;
  const BOT_IMG_H = H - PAD * 2 - TOP_IMG_H - BAND_H;
  const titleSize = title.length > 30 ? 50 : title.length > 20 ? 56 : 62;

  return {
    type: "div",
    props: {
      style: {
        width: `${W}px`,
        height: `${H}px`,
        display: "flex",
        position: "relative",
        overflow: "hidden",
        backgroundColor: BRAND.cream,
        padding: `${PAD}px`,
      },
      children: [
        // ── Inner frame with rounded corners ──
        {
          type: "div",
          props: {
            style: {
              width: `${INNER_W}px`,
              height: `${H - PAD * 2}px`,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              borderRadius: "24px",
              border: `3px solid ${BRAND.primary}22`,
              position: "relative",
            },
            children: [
              // ── Top image (zoomed in) ──
              {
                type: "div",
                props: {
                  style: {
                    width: `${INNER_W}px`,
                    height: `${TOP_IMG_H}px`,
                    overflow: "hidden",
                    display: "flex",
                    position: "relative",
                  },
                  children: [
                    {
                      type: "img",
                      props: {
                        src: heroImageUrl,
                        style: {
                          width: `${INNER_W * 1.35}px`,
                          height: `${TOP_IMG_H * 1.35}px`,
                          objectFit: "cover",
                          marginLeft: `${-(INNER_W * 0.17)}px`,
                          marginTop: `${-(TOP_IMG_H * 0.12)}px`,
                        },
                      },
                    },
                    // Soft bottom fade
                    {
                      type: "div",
                      props: {
                        style: {
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          width: `${INNER_W}px`,
                          height: "100px",
                          background: `linear-gradient(to bottom, rgba(255,251,245,0) 0%, ${BRAND.cream} 100%)`,
                        },
                      },
                    },
                  ],
                },
              },

              // ── Title band ──
              {
                type: "div",
                props: {
                  style: {
                    width: `${INNER_W}px`,
                    height: `${BAND_H}px`,
                    backgroundColor: BRAND.cream,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: "0 60px",
                    position: "relative",
                  },
                  children: [
                    // Top decorative row: line — dot — line
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          marginBottom: "14px",
                        },
                        children: [
                          decorativeLine(60, `${BRAND.primary}44`),
                          decorativeDot(BRAND.primary, 7),
                          decorativeLine(60, `${BRAND.primary}44`),
                        ],
                      },
                    },

                    // "Try This Recipe"
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "DM Sans",
                          color: BRAND.accent,
                          fontSize: "18px",
                          fontWeight: 600,
                          letterSpacing: "5px",
                          textTransform: "uppercase",
                          marginBottom: "8px",
                        },
                        children: "Try This Recipe",
                      },
                    },

                    // Stars
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          gap: "5px",
                          marginBottom: "14px",
                        },
                        children: Array.from({ length: 5 }).map(() => star()),
                      },
                    },

                    // Title
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "Playfair Display",
                          color: BRAND.foreground,
                          fontSize: `${titleSize}px`,
                          fontWeight: 700,
                          lineHeight: 1.12,
                          textAlign: "center",
                          maxWidth: "820px",
                        },
                        children: title,
                      },
                    },

                    // Bottom decorative row
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          marginTop: "18px",
                        },
                        children: [
                          decorativeLine(60, `${BRAND.primary}44`),
                          decorativeDot(BRAND.primary, 7),
                          decorativeLine(60, `${BRAND.primary}44`),
                        ],
                      },
                    },
                  ],
                },
              },

              // ── Bottom image (zoomed out) ──
              {
                type: "div",
                props: {
                  style: {
                    width: `${INNER_W}px`,
                    height: `${BOT_IMG_H}px`,
                    overflow: "hidden",
                    display: "flex",
                    position: "relative",
                  },
                  children: [
                    // Soft top fade
                    {
                      type: "div",
                      props: {
                        style: {
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: `${INNER_W}px`,
                          height: "80px",
                          background: `linear-gradient(to bottom, ${BRAND.cream} 0%, rgba(255,251,245,0) 100%)`,
                        },
                      },
                    },
                    {
                      type: "img",
                      props: {
                        src: heroImageUrl,
                        style: {
                          width: `${INNER_W}px`,
                          height: `${BOT_IMG_H + 40}px`,
                          objectFit: "cover",
                        },
                      },
                    },
                    // Dark bottom overlay for URL
                    {
                      type: "div",
                      props: {
                        style: {
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          width: `${INNER_W}px`,
                          height: "80px",
                          background:
                            "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 100%)",
                        },
                      },
                    },
                    // Website URL pill
                    {
                      type: "div",
                      props: {
                        style: {
                          position: "absolute",
                          bottom: "16px",
                          left: 0,
                          width: `${INNER_W}px`,
                          display: "flex",
                          justifyContent: "center",
                        },
                        children: {
                          type: "div",
                          props: {
                            style: {
                              backgroundColor: "rgba(255, 251, 245, 0.92)",
                              borderRadius: "20px",
                              padding: "7px 24px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            },
                            children: [
                              ...(logoDataUri
                                ? [
                                    {
                                      type: "img",
                                      props: {
                                        src: logoDataUri,
                                        style: { height: "22px" },
                                      },
                                    },
                                  ]
                                : []),
                              {
                                type: "div",
                                props: {
                                  style: {
                                    fontFamily: "DM Sans",
                                    color: BRAND.primary,
                                    fontSize: "16px",
                                    fontWeight: 600,
                                    letterSpacing: "0.5px",
                                  },
                                  children: "cookwithlucia.com",
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

// === Design 2: Full image + logo ===

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PinLayoutSimple({
  heroImageUrl,
  logoDataUri,
}: {
  heroImageUrl: string;
  logoDataUri: string;
}): any {
  const W = 1000;
  const H = 1500;

  return {
    type: "div",
    props: {
      style: {
        width: `${W}px`,
        height: `${H}px`,
        display: "flex",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#000",
      },
      children: [
        // Full-bleed image
        {
          type: "img",
          props: {
            src: heroImageUrl,
            style: {
              width: `${W}px`,
              height: `${H}px`,
              objectFit: "cover",
            },
          },
        },
        // Subtle dark gradient at bottom for logo visibility
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              bottom: 0,
              left: 0,
              width: `${W}px`,
              height: "120px",
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 100%)",
            },
          },
        },
        // Logo pill at bottom center
        ...(logoDataUri
          ? [
              {
                type: "div",
                props: {
                  style: {
                    position: "absolute",
                    bottom: "24px",
                    left: 0,
                    width: `${W}px`,
                    display: "flex",
                    justifyContent: "center",
                  },
                  children: {
                    type: "div",
                    props: {
                      style: {
                        backgroundColor: "rgba(255, 251, 245, 0.92)",
                        borderRadius: "20px",
                        padding: "8px 24px",
                        display: "flex",
                        alignItems: "center",
                      },
                      children: {
                        type: "img",
                        props: {
                          src: logoDataUri,
                          style: { height: "30px" },
                        },
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

// === Public API ===

async function renderPin(element: unknown): Promise<Buffer> {
  const [dmSansData, playfairData] = await Promise.all([
    getDmSans(),
    getPlayfair(),
  ]);

  const svg = await satori(element as React.ReactNode, {
    width: 1000,
    height: 1500,
    fonts: [
      {
        name: "DM Sans",
        data: dmSansData,
        weight: 600,
        style: "normal",
      },
      {
        name: "Playfair Display",
        data: playfairData,
        weight: 700,
        style: "normal",
      },
    ],
  });

  return Buffer.from(await sharp(Buffer.from(svg)).png().toBuffer());
}

/** Design 1: Dual image with title band */
export async function generatePinImage(
  params: PinImageParams,
): Promise<Buffer> {
  const logoDataUri = await getLogoDataUri();
  const element = PinLayout({
    title: params.title,
    heroImageUrl: params.heroImageUrl,
    logoDataUri,
  });
  return renderPin(element);
}

/** Design 2: Full-bleed image with logo only */
export async function generatePinImageSimple(
  params: PinImageParams,
): Promise<Buffer> {
  const logoDataUri = await getLogoDataUri();
  const element = PinLayoutSimple({
    heroImageUrl: params.heroImageUrl,
    logoDataUri,
  });
  return renderPin(element);
}
