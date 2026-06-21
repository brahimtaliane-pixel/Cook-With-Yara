import satori from "satori";
import sharp from "sharp";

// === Types ===

export interface PinImageParams {
  title: string;
  heroImageUrl: string;
  /** Optional 2nd recipe photo (different angle) for the stacked pin's bottom slot. */
  heroImageUrl2?: string;
  articleNumber?: number;
  topIngredients?: string[];
  servings?: string;
  cookTime?: string;
  // D6 editorial-only fields
  eyebrow?: string;
  subtitle?: string;
}

// === Palette (warm food-blog tones, matching the reference) ===

const W = 1000;
const H = 1500;

const COLORS = {
  white: "#FFFFFF",
  cream: "#F5EFE3",
  titleText: "#5C2A19", // deep cocoa
  urlBg: "#2D1810",     // dark espresso
  urlText: "#F5EFE3",
  gold: "#E8B547",       // brand pop accent (kept for variants)
  forest: "#1F5F4A",     // brand green (kept for variant)
};

// D6 — editorial luxury palette
const EDITORIAL = {
  cream: "#F7F3EE",
  warmBrown: "#4F3422",
  goldenHoney: "#D9A441",
  softCoral: "#D97A7A",
};

const URL_WORDMARK = "COOKWITHYARA.COM";

// === Font loading ===

let bowlby: ArrayBuffer | null = null;
let anton: ArrayBuffer | null = null;
let inter700: ArrayBuffer | null = null;
let playfair700: ArrayBuffer | null = null;
let playfairItalic: ArrayBuffer | null = null;

async function loadFont(url: string): Promise<ArrayBuffer> {
  const cssRes = await fetch(url);
  const css = await cssRes.text();
  const match = css.match(/src:\s*url\(([^)]+)\)/);
  if (!match?.[1]) throw new Error(`Could not extract font URL from ${url}`);
  const fontRes = await fetch(match[1]);
  return fontRes.arrayBuffer();
}

async function getBowlby(): Promise<ArrayBuffer> {
  if (bowlby) return bowlby;
  bowlby = await loadFont(
    "https://fonts.googleapis.com/css2?family=Bowlby+One&display=swap",
  );
  return bowlby;
}

async function getAnton(): Promise<ArrayBuffer> {
  if (anton) return anton;
  anton = await loadFont(
    "https://fonts.googleapis.com/css2?family=Anton&display=swap",
  );
  return anton;
}

async function getInter700(): Promise<ArrayBuffer> {
  if (inter700) return inter700;
  inter700 = await loadFont(
    "https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap",
  );
  return inter700;
}

async function getPlayfair700(): Promise<ArrayBuffer> {
  if (playfair700) return playfair700;
  playfair700 = await loadFont(
    "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap",
  );
  return playfair700;
}

async function getPlayfairItalic(): Promise<ArrayBuffer> {
  if (playfairItalic) return playfairItalic;
  playfairItalic = await loadFont(
    "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,500&display=swap",
  );
  return playfairItalic;
}

// === Element helpers ===

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type El = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function div(style: Record<string, any>, children?: El | El[]): El {
  return {
    type: "div",
    props: { style, ...(children !== undefined ? { children } : {}) },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function img(src: string, style: Record<string, any>): El {
  return { type: "img", props: { src, style } };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function text(content: string, style: Record<string, any>): El {
  return { type: "div", props: { style, children: content } };
}

// === Title sizing — Bowlby One is wide; we shrink to fit the longest word ===

function titleSize(title: string, max = 90, min = 46): number {
  const longestWord = title
    .split(/\s+/)
    .reduce((a, b) => (a.length > b.length ? a : b), "");
  const wordLen = Math.max(longestWord.length, 1);

  // Bowlby One roughly 0.65 × fontSize per char for uppercase.
  // Title text area is ~900px (1000 - 50px each side).
  const TEXT_AREA = 900;
  const CHAR_RATIO = 0.65;
  const maxByWord = Math.floor(TEXT_AREA / wordLen / CHAR_RATIO);

  // Also scale down for very long titles
  const len = title.length;
  let byLength: number;
  if (len > 70) byLength = min;
  else if (len > 50) byLength = Math.round(min + (max - min) * 0.5);
  else if (len > 30) byLength = Math.round(min + (max - min) * 0.8);
  else byLength = max;

  return Math.min(byLength, maxByWord);
}

// Photo strip — full-width photo with a vertical position hint so the two
// strips in a pin can show different portions of the same source image.
function photoStrip(
  src: string,
  height: number,
  position: "top" | "center" | "bottom" = "center",
): El {
  return div(
    {
      width: `${W}px`,
      height: `${height}px`,
      display: "flex",
      overflow: "hidden",
    },
    img(src, {
      width: `${W}px`,
      height: `${height}px`,
      objectFit: "cover",
      objectPosition: `center ${position}`,
    }),
  );
}

// Title band. Default: chunky uppercase (Bowlby One). serif: elegant Playfair
// Display in mixed case (editorial look).
function titleBand(
  title: string,
  height: number,
  opts: { bg?: string; color?: string; serif?: boolean; maxTitle?: number } = {},
): El {
  const serif = opts.serif === true;
  const content = serif ? cleanHeadline(title) : title.toUpperCase();
  return div(
    {
      width: `${W}px`,
      height: `${height}px`,
      backgroundColor: opts.bg ?? COLORS.white,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "20px 60px",
    },
    text(content, {
      fontFamily: serif ? "Playfair Display" : "Bowlby One",
      fontSize: `${serif ? serifTitleSize(content, opts.maxTitle ?? 82) : titleSize(title)}px`,
      ...(serif ? { fontWeight: 700 } : {}),
      color: opts.color ?? COLORS.titleText,
      lineHeight: serif ? 1.08 : 1.0,
      textAlign: "center",
      letterSpacing: serif ? "0px" : "-1px",
    }),
  );
}

// Anton is a tall condensed display face — fits far more per line than Bowlby.
function antonTitleSize(title: string, max = 76, min = 42): number {
  const longestWord = title
    .split(/\s+/)
    .reduce((a, b) => (a.length > b.length ? a : b), "");
  const wordLen = Math.max(longestWord.length, 1);
  const TEXT_AREA = 880; // 1000 − 60px padding each side
  const CHAR_RATIO = 0.42; // condensed glyphs
  const maxByWord = Math.floor(TEXT_AREA / wordLen / CHAR_RATIO);

  const len = title.length;
  let byLength: number;
  if (len > 55) byLength = min;
  else if (len > 38) byLength = Math.round(min + (max - min) * 0.55);
  else if (len > 24) byLength = Math.round(min + (max - min) * 0.82);
  else byLength = max;

  return Math.min(byLength, maxByWord);
}

// Dark URL bar.
function urlBar(height = 80, bg = COLORS.urlBg, color = COLORS.urlText): El {
  return div(
    {
      width: `${W}px`,
      height: `${height}px`,
      backgroundColor: bg,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    },
    text(URL_WORDMARK, {
      fontFamily: "Inter",
      fontSize: "22px",
      fontWeight: 700,
      color,
      letterSpacing: "6px",
    }),
  );
}

// === D1 — Stacked: photo / serif title-band / photo / url-bar ===
// Top and bottom show two DIFFERENT recipe photos when heroImageUrl2 is set
// (falls back to two crops of the one photo otherwise).

function StackedPin({
  title,
  heroImageUrl,
  heroImageUrl2,
  eyebrow,
  subtitle,
}: PinImageParams): El {
  const URL_H = 78;
  // Two equal photos fill the canvas; the title card floats over their seam.
  const PHOTO_H = Math.round((H - URL_H) / 2);

  const hasSecond = Boolean(heroImageUrl2);
  const bottomSrc = heroImageUrl2 || heroImageUrl;

  const headline = cleanHeadline(title).toUpperCase();
  const eb = (eyebrow ?? "RECIPE").toUpperCase();
  const sub = subtitle ?? "";

  // Floating card geometry — centered on the seam between the two photos.
  const CARD_W = 884;
  const CARD_H = 340;
  const CARD_LEFT = Math.round((W - CARD_W) / 2);
  const CARD_TOP = PHOTO_H - Math.round(CARD_H / 2);

  const cardChildren: El[] = [
    text(eb, {
      fontFamily: "Inter",
      fontSize: "20px",
      fontWeight: 700,
      color: COLORS.gold,
      letterSpacing: "8px",
      marginBottom: "16px",
    }),
    text(headline, {
      fontFamily: "Anton",
      fontSize: `${antonTitleSize(headline, 70)}px`,
      color: COLORS.titleText,
      lineHeight: 1.02,
      textAlign: "center",
      letterSpacing: "0.5px",
    }),
  ];
  if (sub) {
    cardChildren.push(
      div({
        width: "64px",
        height: "2px",
        backgroundColor: COLORS.gold,
        display: "flex",
        marginTop: "18px",
        marginBottom: "14px",
      }),
      text(sub, {
        fontFamily: "Inter",
        fontSize: "22px",
        fontWeight: 700,
        color: "#9A7B61",
        letterSpacing: "2px",
        textAlign: "center",
      }),
    );
  }

  return div(
    {
      width: `${W}px`,
      height: `${H}px`,
      display: "flex",
      position: "relative",
      backgroundColor: COLORS.white,
    },
    [
      // Photo stack + URL bar
      div(
        {
          width: `${W}px`,
          height: `${H}px`,
          display: "flex",
          flexDirection: "column",
        },
        [
          photoStrip(heroImageUrl, PHOTO_H, "center"),
          photoStrip(bottomSrc, PHOTO_H, hasSecond ? "center" : "bottom"),
          urlBar(URL_H),
        ],
      ),
      // Floating title card overlapping both photos
      div(
        {
          position: "absolute",
          top: `${CARD_TOP}px`,
          left: `${CARD_LEFT}px`,
          width: `${CARD_W}px`,
          height: `${CARD_H}px`,
          backgroundColor: COLORS.white,
          borderRadius: "30px",
          boxShadow: "0 24px 60px rgba(40,24,16,0.32)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "30px 60px",
        },
        cardChildren,
      ),
    ],
  );
}

// === D2 — Inverted: bottom photo is the big one ===

function InvertedStackedPin({ title, heroImageUrl }: PinImageParams): El {
  const URL_H = 80;
  const TITLE_H = 360;
  const PHOTO_AREA = H - URL_H - TITLE_H;
  const TOP_H = Math.round(PHOTO_AREA * 0.35);
  const BOT_H = PHOTO_AREA - TOP_H;

  return div(
    {
      width: `${W}px`,
      height: `${H}px`,
      display: "flex",
      flexDirection: "column",
      backgroundColor: COLORS.white,
    },
    [
      photoStrip(heroImageUrl, TOP_H, "top"),
      titleBand(title, TITLE_H),
      photoStrip(heroImageUrl, BOT_H, "bottom"),
      urlBar(URL_H),
    ],
  );
}

// === D3 — Title on top, then two photos stacked ===

function TitleTopPin({ title, heroImageUrl }: PinImageParams): El {
  const URL_H = 80;
  const TITLE_H = 400;
  const PHOTO_AREA = H - URL_H - TITLE_H;
  const TOP_H = Math.round(PHOTO_AREA * 0.55);
  const BOT_H = PHOTO_AREA - TOP_H;

  return div(
    {
      width: `${W}px`,
      height: `${H}px`,
      display: "flex",
      flexDirection: "column",
      backgroundColor: COLORS.white,
    },
    [
      titleBand(title, TITLE_H),
      photoStrip(heroImageUrl, TOP_H, "top"),
      photoStrip(heroImageUrl, BOT_H, "bottom"),
      urlBar(URL_H),
    ],
  );
}

// === D4 — Same structure but with cream band + brand sage stripe accents ===

function CreamBandPin({ title, heroImageUrl }: PinImageParams): El {
  const URL_H = 80;
  const TITLE_H = 380;
  const PHOTO_AREA = H - URL_H - TITLE_H;
  const TOP_H = Math.round(PHOTO_AREA * 0.6);
  const BOT_H = PHOTO_AREA - TOP_H;

  return div(
    {
      width: `${W}px`,
      height: `${H}px`,
      display: "flex",
      flexDirection: "column",
      backgroundColor: COLORS.cream,
    },
    [
      photoStrip(heroImageUrl, TOP_H, "top"),
      titleBand(title, TITLE_H, { bg: COLORS.cream }),
      photoStrip(heroImageUrl, BOT_H, "bottom"),
      urlBar(URL_H),
    ],
  );
}

// === D5 — Same structure but the URL bar + title band use brand forest green ===

function ForestPin({ title, heroImageUrl }: PinImageParams): El {
  const URL_H = 80;
  const TITLE_H = 380;
  const PHOTO_AREA = H - URL_H - TITLE_H;
  const TOP_H = Math.round(PHOTO_AREA * 0.6);
  const BOT_H = PHOTO_AREA - TOP_H;

  return div(
    {
      width: `${W}px`,
      height: `${H}px`,
      display: "flex",
      flexDirection: "column",
      backgroundColor: COLORS.white,
    },
    [
      photoStrip(heroImageUrl, TOP_H, "top"),
      titleBand(title, TITLE_H, { bg: COLORS.white, color: COLORS.forest }),
      photoStrip(heroImageUrl, BOT_H, "bottom"),
      urlBar(URL_H, COLORS.forest, COLORS.white),
    ],
  );
}

// === D6 — Editorial luxury (premium food-blog layout) ===

// Playfair Display is narrower than Bowlby; allow larger sizes for short titles.
function serifTitleSize(title: string, max = 82, min = 46): number {
  const longestWord = title
    .split(/\s+/)
    .reduce((a, b) => (a.length > b.length ? a : b), "");
  const wordLen = Math.max(longestWord.length, 1);

  const TEXT_AREA = 840; // 1000 − 80px padding each side
  const CHAR_RATIO = 0.52;
  const maxByWord = Math.floor(TEXT_AREA / wordLen / CHAR_RATIO);

  const len = title.length;
  let byLength: number;
  if (len > 60) byLength = min;
  else if (len > 40) byLength = Math.round(min + (max - min) * 0.6);
  else if (len > 25) byLength = Math.round(min + (max - min) * 0.85);
  else byLength = max;

  return Math.min(byLength, maxByWord);
}

function EditorialPin({
  title,
  heroImageUrl,
  eyebrow,
  subtitle,
}: PinImageParams): El {
  const PHOTO_TOP_H = 675; // 45%
  const MIDDLE_H = 450;    // 30%
  const PHOTO_BOT_H = 375; // 25%

  const eyebrowText = (eyebrow ?? "RECIPE").toUpperCase();
  const sub = subtitle ?? "";
  const titleFs = serifTitleSize(title);

  // Middle band children
  const middleChildren: El[] = [
    // top decorative line
    div({
      width: "56px",
      height: "1px",
      backgroundColor: EDITORIAL.goldenHoney,
      display: "flex",
      marginBottom: "18px",
    }),
    text(eyebrowText, {
      fontFamily: "Inter",
      fontSize: "20px",
      fontWeight: 700,
      color: EDITORIAL.goldenHoney,
      letterSpacing: "8px",
      marginBottom: "14px",
    }),
    text("★★★★★", {
      fontFamily: "Inter",
      fontSize: "22px",
      color: EDITORIAL.goldenHoney,
      letterSpacing: "4px",
      marginBottom: "22px",
    }),
    text(title, {
      fontFamily: "Playfair Display",
      fontSize: `${titleFs}px`,
      color: EDITORIAL.warmBrown,
      lineHeight: 1.05,
      textAlign: "center",
      fontWeight: 700,
      marginBottom: sub ? "18px" : "0",
    }),
  ];

  if (sub) {
    middleChildren.push(
      text(sub, {
        fontFamily: "Playfair Display Italic",
        fontStyle: "italic",
        fontSize: "30px",
        color: EDITORIAL.softCoral,
        textAlign: "center",
        marginBottom: "16px",
      }),
      div({
        width: "100px",
        height: "1px",
        backgroundColor: EDITORIAL.goldenHoney,
        display: "flex",
      }),
    );
  }

  return div(
    {
      width: `${W}px`,
      height: `${H}px`,
      display: "flex",
      flexDirection: "column",
      backgroundColor: EDITORIAL.cream,
      position: "relative",
    },
    [
      photoStrip(heroImageUrl, PHOTO_TOP_H, "center"),
      div(
        {
          width: `${W}px`,
          height: `${MIDDLE_H}px`,
          backgroundColor: EDITORIAL.cream,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "30px 80px",
        },
        middleChildren,
      ),
      photoStrip(heroImageUrl, PHOTO_BOT_H, "bottom"),
      // Branding badge — absolute, bottom-centered
      div(
        {
          position: "absolute",
          bottom: "28px",
          left: "330px",
          width: "340px",
          height: "52px",
          backgroundColor: "#FFFFFF",
          borderRadius: "26px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
        },
        text(URL_WORDMARK, {
          fontFamily: "Inter",
          fontSize: "17px",
          fontWeight: 700,
          color: EDITORIAL.warmBrown,
          letterSpacing: "5px",
        }),
      ),
    ],
  );
}

// === D7 — Full-bleed hero with gradient + minimal lower-third text ===

// Headline sizing for full-bleed pin (large uppercase serif).
// Picks the largest size that lets the WHOLE headline sit on one line —
// the constraint is total width, not just the longest word.
function fullBleedTitleSize(title: string, max = 110, min = 44): number {
  const TEXT_AREA = 900; // 1000 − 50px padding each side
  const CHAR_RATIO = 0.66; // Playfair Display bold uppercase: wide glyphs

  const longestWord = title
    .split(/\s+/)
    .reduce((a, b) => (a.length > b.length ? a : b), "");
  const wordLen = Math.max(longestWord.length, 1);
  const maxByWord = Math.floor(TEXT_AREA / wordLen / CHAR_RATIO);

  const len = Math.max(title.length, 1);
  const maxByTotal = Math.floor(TEXT_AREA / len / CHAR_RATIO);

  return Math.max(min, Math.min(max, maxByWord, maxByTotal));
}

// Strip noise from the article title so the headline reads cleanly.
function cleanHeadline(title: string): string {
  // Drop anything after the first colon — typical pattern: "Lemon Rhubarb Loaf: Zesty & Tart..."
  return title.split(":")[0].trim();
}

function FullBleedHeroPin({
  title,
  heroImageUrl,
  eyebrow,
  subtitle,
}: PinImageParams): El {
  const eyebrowText = (eyebrow ?? "EASY RECIPE").toUpperCase();
  const sub = subtitle ?? "";
  const headline = cleanHeadline(title).toUpperCase();
  const titleFs = fullBleedTitleSize(headline);

  return div(
    {
      width: `${W}px`,
      height: `${H}px`,
      display: "flex",
      position: "relative",
      backgroundColor: "#1a1208",
    },
    [
      // Full-bleed hero image
      img(heroImageUrl, {
        position: "absolute",
        top: "0px",
        left: "0px",
        width: `${W}px`,
        height: `${H}px`,
        objectFit: "cover",
        objectPosition: "center center",
      }),

      // Dark gradient overlay — fades from transparent at the top to dark at the bottom
      div({
        position: "absolute",
        left: "0px",
        bottom: "0px",
        width: `${W}px`,
        height: "780px",
        display: "flex",
        backgroundImage:
          "linear-gradient(180deg, rgba(20,12,5,0) 0%, rgba(20,12,5,0.45) 40%, rgba(20,12,5,0.92) 100%)",
      }),

      // Text content stack — bottom of canvas
      div(
        {
          position: "absolute",
          left: "0px",
          bottom: "0px",
          width: `${W}px`,
          padding: "0 50px 110px 50px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
        },
        [
          div({
            width: "52px",
            height: "1px",
            backgroundColor: EDITORIAL.goldenHoney,
            display: "flex",
            marginBottom: "18px",
          }),
          text(eyebrowText, {
            fontFamily: "Inter",
            fontSize: "20px",
            fontWeight: 700,
            color: EDITORIAL.goldenHoney,
            letterSpacing: "8px",
            marginBottom: "26px",
          }),
          text(headline, {
            fontFamily: "Playfair Display",
            fontSize: `${titleFs}px`,
            fontWeight: 700,
            color: "#FFFFFF",
            lineHeight: 1.02,
            textAlign: "center",
            letterSpacing: "0px",
            marginBottom: sub ? "22px" : "0px",
          }),
          ...(sub
            ? [
                text(sub, {
                  fontFamily: "Inter",
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "#F7F3EE",
                  letterSpacing: "5px",
                  textAlign: "center",
                }),
              ]
            : []),
        ],
      ),

      // URL at very bottom, centered
      div(
        {
          position: "absolute",
          bottom: "40px",
          left: "0px",
          width: `${W}px`,
          display: "flex",
          justifyContent: "center",
        },
        text(URL_WORDMARK, {
          fontFamily: "Inter",
          fontSize: "14px",
          fontWeight: 700,
          color: "rgba(247, 243, 238, 0.78)",
          letterSpacing: "6px",
        }),
      ),
    ],
  );
}

// === Render ===

async function renderPin(element: unknown): Promise<Buffer> {
  const [bowlbyFont, antonFont, interBold, playfairBold, playfairIt] =
    await Promise.all([
      getBowlby(),
      getAnton(),
      getInter700(),
      getPlayfair700(),
      getPlayfairItalic(),
    ]);

  const svg = await satori(element as React.ReactNode, {
    width: W,
    height: H,
    fonts: [
      { name: "Bowlby One", data: bowlbyFont, weight: 700, style: "normal" },
      { name: "Anton", data: antonFont, weight: 700, style: "normal" },
      { name: "Inter", data: interBold, weight: 700, style: "normal" },
      { name: "Playfair Display", data: playfairBold, weight: 700, style: "normal" },
      { name: "Playfair Display Italic", data: playfairIt, weight: 500, style: "italic" },
    ],
  });

  return Buffer.from(await sharp(Buffer.from(svg)).png().toBuffer());
}

// === Public API ===

/** Design 1: Stacked — photo / title / photo / url (the reference layout) */
export async function generatePinImage(params: PinImageParams): Promise<Buffer> {
  return renderPin(StackedPin(params));
}

/** Design 2: Inverted — smaller top photo, bigger bottom photo */
export async function generatePinImageSimple(
  params: PinImageParams,
): Promise<Buffer> {
  return renderPin(InvertedStackedPin(params));
}

/** Design 3: Title-top — title band first, then two photos */
export async function generatePinImageBoldOverlay(
  params: PinImageParams,
): Promise<Buffer> {
  return renderPin(TitleTopPin(params));
}

/** Design 4: Cream band — cream-toned title band, otherwise identical */
export async function generatePinImageCard(
  params: PinImageParams,
): Promise<Buffer> {
  return renderPin(CreamBandPin(params));
}

/** Design 5: Forest — brand green title text + URL bar */
export async function generatePinImageMinimal(
  params: PinImageParams,
): Promise<Buffer> {
  return renderPin(ForestPin(params));
}

/** Design 6: Editorial — luxury food-blog layout (45/30/25 with cream band + serif title) */
export async function generatePinImageEditorial(
  params: PinImageParams,
): Promise<Buffer> {
  return renderPin(EditorialPin(params));
}

/** Design 7: Full-bleed hero — photo fills canvas, gradient + minimal text in lower third */
export async function generatePinImageFullBleed(
  params: PinImageParams,
): Promise<Buffer> {
  return renderPin(FullBleedHeroPin(params));
}

/** Dispatcher */
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
    case 6:
      return generatePinImageEditorial(params);
    case 7:
      return generatePinImageFullBleed(params);
    default:
      return generatePinImage(params);
  }
}
