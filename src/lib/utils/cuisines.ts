import type { Article } from "@/lib/db/schema";

export interface Cuisine {
  slug: string;
  name: string;
  tagline: string;
  blurb: string;
  signatureDishes: string;
  // Lowercase substrings; if any appears in the article's recipeCuisine field,
  // the article belongs to this cuisine bucket.
  matchers: string[];
}

export const CUISINES: Cuisine[] = [
  {
    slug: "lebanese",
    name: "Lebanese",
    tagline: "Mezze, herbs, and slow Sundays",
    blurb:
      "Lebanese and Levantine cooking — fresh herbs, lemon, sumac, and tables built for sharing. From smoky baba ghanoush to crispy kibbeh, this is food made to be passed around.",
    signatureDishes: "Tabbouleh · Kibbeh · Fattoush · Hummus",
    matchers: ["lebanese", "levantine", "syrian", "palestinian", "jordanian"],
  },
  {
    slug: "moroccan",
    name: "Moroccan",
    tagline: "Tagines, spice, and warm bread",
    blurb:
      "Moroccan cooking is built on layers — preserved lemon, ras el hanout, slow-cooked stews in earthenware. North African flavor with bright color and depth.",
    signatureDishes: "Tagine · Couscous · Harira · Bastilla",
    matchers: ["moroccan", "north african", "tunisian", "algerian"],
  },
  {
    slug: "greek",
    name: "Greek",
    tagline: "Olive oil, lemon, and the sea",
    blurb:
      "Greek cooking lets ingredients speak — good olive oil, ripe tomatoes, fresh oregano, a squeeze of lemon. Simple, generous food rooted in the Mediterranean.",
    signatureDishes: "Souvlaki · Spanakopita · Dolmas · Greek Salad",
    matchers: ["greek", "mediterranean"],
  },
  {
    slug: "turkish",
    name: "Turkish",
    tagline: "Smoke, bread, and bold spice",
    blurb:
      "Turkish cooking sits at the crossroads of cuisines — smoky kebabs, flaky börek, fragrant pilavs. Bold and welcoming, with bread on every table.",
    signatureDishes: "Kebab · Börek · Pide · Lahmacun",
    matchers: ["turkish", "ottoman"],
  },
  {
    slug: "persian",
    name: "Persian",
    tagline: "Saffron, rice, and quiet sophistication",
    blurb:
      "Persian cooking is layered and patient — saffron-stained rice with tahdig crust, slow-stewed khoresh, herbs by the handful. Subtle and deeply aromatic.",
    signatureDishes: "Tahdig · Khoresh · Kabab Koobideh · Ash Reshteh",
    matchers: ["persian", "iranian"],
  },
  {
    slug: "egyptian",
    name: "Egyptian",
    tagline: "Comfort food, generously spiced",
    blurb:
      "Egyptian cooking is hearty and unfussy — koshari layered with crispy onions, ful medames at sunrise, ta'meya bright with herbs. Food meant to satisfy.",
    signatureDishes: "Koshari · Ful Medames · Ta'meya · Mahshi",
    matchers: ["egyptian"],
  },
];

export function getCuisine(slug: string): Cuisine | undefined {
  return CUISINES.find((c) => c.slug === slug);
}

export function getArticleCuisine(article: Pick<Article, "recipeJsonLd">): string | null {
  if (!article.recipeJsonLd) return null;
  try {
    const jsonLd =
      typeof article.recipeJsonLd === "string"
        ? JSON.parse(article.recipeJsonLd)
        : article.recipeJsonLd;
    return (jsonLd.recipeCuisine as string) || null;
  } catch {
    return null;
  }
}

export function articleMatchesCuisine(
  article: Pick<Article, "recipeJsonLd">,
  cuisine: Cuisine
): boolean {
  const value = getArticleCuisine(article);
  if (!value) return false;
  const lower = value.toLowerCase();
  return cuisine.matchers.some((m) => lower.includes(m));
}
