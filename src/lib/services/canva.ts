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

// === Design 3: Bold Overlay — full-bleed image with dark gradient + large white title ===

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PinLayoutBoldOverlay({
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
  const titleSize = title.length > 40 ? 52 : title.length > 25 ? 60 : 68;

  return {
    type: "div",
    props: {
      style: {
        width: `${W}px`,
        height: `${H}px`,
        display: "flex",
        position: "relative",
        overflow: "hidden",
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
              position: "absolute",
              top: 0,
              left: 0,
            },
          },
        },
        // Dark gradient overlay on bottom third
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              bottom: 0,
              left: 0,
              width: `${W}px`,
              height: `${Math.round(H * 0.45)}px`,
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 50%, rgba(0,0,0,0.9) 100%)",
            },
          },
        },
        // Title + branding at bottom
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              bottom: "60px",
              left: "50px",
              right: "50px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "Playfair Display",
                    color: "#FFFFFF",
                    fontSize: `${titleSize}px`,
                    fontWeight: 700,
                    lineHeight: 1.15,
                    textShadow: "0 2px 8px rgba(0,0,0,0.3)",
                  },
                  children: title,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  },
                  children: [
                    ...(logoDataUri
                      ? [
                          {
                            type: "img",
                            props: {
                              src: logoDataUri,
                              style: { height: "24px" },
                            },
                          },
                        ]
                      : []),
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "DM Sans",
                          color: "rgba(255,255,255,0.85)",
                          fontSize: "16px",
                          fontWeight: 600,
                        },
                        children: "cookwithlucia.com",
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

// === Design 4: Card Style — white card with image top 60%, title bottom 40% ===

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PinLayoutCard({
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
  const PAD = 40;
  const CARD_W = W - PAD * 2;
  const CARD_H = H - PAD * 2;
  const IMG_H = Math.round(CARD_H * 0.58);
  const TEXT_H = CARD_H - IMG_H;
  const titleSize = title.length > 40 ? 46 : title.length > 25 ? 52 : 58;

  return {
    type: "div",
    props: {
      style: {
        width: `${W}px`,
        height: `${H}px`,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F5F0EB",
        padding: `${PAD}px`,
      },
      children: {
        type: "div",
        props: {
          style: {
            width: `${CARD_W}px`,
            height: `${CARD_H}px`,
            display: "flex",
            flexDirection: "column",
            borderRadius: "20px",
            overflow: "hidden",
            backgroundColor: "#FFFFFF",
            boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
          },
          children: [
            // Image area
            {
              type: "div",
              props: {
                style: {
                  width: `${CARD_W}px`,
                  height: `${IMG_H}px`,
                  overflow: "hidden",
                  display: "flex",
                },
                children: {
                  type: "img",
                  props: {
                    src: heroImageUrl,
                    style: {
                      width: `${CARD_W}px`,
                      height: `${IMG_H + 20}px`,
                      objectFit: "cover",
                    },
                  },
                },
              },
            },
            // Text area
            {
              type: "div",
              props: {
                style: {
                  width: `${CARD_W}px`,
                  height: `${TEXT_H}px`,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: "0 50px",
                  gap: "20px",
                },
                children: [
                  {
                    type: "div",
                    props: {
                      style: {
                        fontFamily: "DM Sans",
                        color: BRAND.accent,
                        fontSize: "15px",
                        fontWeight: 600,
                        letterSpacing: "4px",
                        textTransform: "uppercase",
                      },
                      children: "RECIPE",
                    },
                  },
                  {
                    type: "div",
                    props: {
                      style: {
                        fontFamily: "Playfair Display",
                        color: BRAND.foreground,
                        fontSize: `${titleSize}px`,
                        fontWeight: 700,
                        lineHeight: 1.15,
                        textAlign: "center",
                      },
                      children: title,
                    },
                  },
                  {
                    type: "div",
                    props: {
                      style: {
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
                                  style: { height: "20px" },
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
                              fontSize: "14px",
                              fontWeight: 600,
                            },
                            children: "cookwithlucia.com",
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
      },
    },
  };
}

// === Design 5: Minimal — colored accent bar, small image, prominent title ===

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PinLayoutMinimal({
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
  const ACCENT_W = 12;
  const IMG_SIZE = 400;
  const titleSize = title.length > 40 ? 48 : title.length > 25 ? 56 : 64;

  return {
    type: "div",
    props: {
      style: {
        width: `${W}px`,
        height: `${H}px`,
        display: "flex",
        backgroundColor: BRAND.cream,
        position: "relative",
      },
      children: [
        // Left accent bar
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              top: "60px",
              left: "40px",
              width: `${ACCENT_W}px`,
              height: `${H - 120}px`,
              backgroundColor: BRAND.primary,
              borderRadius: "6px",
            },
          },
        },
        // Content area
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              width: `${W}px`,
              height: `${H}px`,
              padding: "0 80px",
              gap: "40px",
            },
            children: [
              // Rounded image
              {
                type: "div",
                props: {
                  style: {
                    width: `${IMG_SIZE}px`,
                    height: `${IMG_SIZE}px`,
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: `4px solid ${BRAND.primary}22`,
                    display: "flex",
                  },
                  children: {
                    type: "img",
                    props: {
                      src: heroImageUrl,
                      style: {
                        width: `${IMG_SIZE}px`,
                        height: `${IMG_SIZE}px`,
                        objectFit: "cover",
                      },
                    },
                  },
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
                    lineHeight: 1.15,
                    textAlign: "center",
                    maxWidth: "780px",
                  },
                  children: title,
                },
              },
              // Decorative divider
              {
                type: "div",
                props: {
                  style: {
                    width: "80px",
                    height: "3px",
                    backgroundColor: BRAND.primary,
                    borderRadius: "2px",
                  },
                },
              },
              // Branding
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  },
                  children: [
                    ...(logoDataUri
                      ? [
                          {
                            type: "img",
                            props: {
                              src: logoDataUri,
                              style: { height: "24px" },
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
                          letterSpacing: "1px",
                        },
                        children: "cookwithlucia.com",
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

/** Design 3: Bold Overlay — full-bleed image with dark gradient and large white title */
export async function generatePinImageBoldOverlay(
  params: PinImageParams,
): Promise<Buffer> {
  const logoDataUri = await getLogoDataUri();
  const element = PinLayoutBoldOverlay({
    title: params.title,
    heroImageUrl: params.heroImageUrl,
    logoDataUri,
  });
  return renderPin(element);
}

/** Design 4: Card Style — white card with shadow, image top, title bottom */
export async function generatePinImageCard(
  params: PinImageParams,
): Promise<Buffer> {
  const logoDataUri = await getLogoDataUri();
  const element = PinLayoutCard({
    title: params.title,
    heroImageUrl: params.heroImageUrl,
    logoDataUri,
  });
  return renderPin(element);
}

/** Design 5: Minimal — accent bar, circular image, prominent title */
export async function generatePinImageMinimal(
  params: PinImageParams,
): Promise<Buffer> {
  const logoDataUri = await getLogoDataUri();
  const element = PinLayoutMinimal({
    title: params.title,
    heroImageUrl: params.heroImageUrl,
    logoDataUri,
  });
  return renderPin(element);
}

/** Dispatcher — routes to the correct design template by number */
export async function generatePinDesign(
  designNum: number,
  params: PinImageParams,
): Promise<Buffer> {
  switch (designNum) {
    case 1:
      return generatePinImage(params);
    case 2:
      return generatePinImageSimple(params);
    case 3:
      return generatePinImageBoldOverlay(params);
    case 4:
      return generatePinImageCard(params);
    case 5:
      return generatePinImageMinimal(params);
    default:
      return generatePinImage(params);
  }
}
