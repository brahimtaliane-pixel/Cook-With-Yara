// Helpers for pulling display-ready bits out of schema.org Recipe JSON-LD.

export interface RecipeMeta {
  servings: string;
  cookTime: string;
  topIngredients: string[];
  recipeCategory: string;
  recipeCuisine: string;
  /** Small letter-spaced label above the title (e.g. "MEDITERRANEAN RECIPE"). */
  eyebrow: string;
  /** Short descriptor line under the title (e.g. "Serves 4 · 45 min"). */
  subtitle: string;
}

export function extractRecipeMeta(
  recipeJsonLd: Record<string, unknown> | null | undefined,
): RecipeMeta {
  const servings = extractServings(recipeJsonLd?.recipeYield);
  const cookTime = formatISODuration(
    (recipeJsonLd?.totalTime ?? recipeJsonLd?.cookTime) as string | undefined,
  );
  const recipeCategory = (recipeJsonLd?.recipeCategory as string) ?? "";
  const recipeCuisine = (recipeJsonLd?.recipeCuisine as string) ?? "";

  return {
    servings,
    cookTime,
    topIngredients: Array.isArray(recipeJsonLd?.recipeIngredient)
      ? (recipeJsonLd.recipeIngredient as string[]).slice(0, 6)
      : [],
    recipeCategory,
    recipeCuisine,
    eyebrow: buildEyebrow(recipeCuisine, recipeCategory),
    subtitle: buildSubtitle(servings, cookTime, recipeCategory),
  };
}

/** Top label: cuisine ("Mediterranean Recipe") → category → generic fallback. */
export function buildEyebrow(cuisine: string, category: string): string {
  const c = cuisine.trim();
  if (c && !/^(world|international|various|fusion)$/i.test(c)) {
    return `${c} Recipe`;
  }
  const cat = category.trim();
  if (cat) return cat;
  return "Easy Recipe";
}

/** Descriptor: "Serves 4 · 45 min" from whatever metadata is present. */
export function buildSubtitle(
  servings: string,
  cookTime: string,
  category: string,
): string {
  const parts: string[] = [];
  if (servings) parts.push(`Serves ${servings}`);
  if (cookTime) parts.push(cookTime);
  if (parts.length) return parts.join("  ·  ");
  return category.trim();
}

export function extractServings(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "number") return String(raw);
  const s = String(raw);
  const m = s.match(/\d+/);
  return m ? m[0] : "";
}

export function formatISODuration(iso: string | undefined): string {
  if (!iso) return "";
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/);
  if (!match) return "";
  const h = match[1] ? parseInt(match[1], 10) : 0;
  const m = match[2] ? parseInt(match[2], 10) : 0;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  if (m) return `${m} min`;
  return "";
}
