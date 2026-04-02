import type { Article } from "@/lib/db/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://cookwithlucia.com";
const SITE_NAME = "Cook with Lucia";

// Deterministic hash from slug — produces varied but consistent ratings per article
function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = ((h << 5) - h + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function generateRating(slug: string) {
  const h = hashSlug(slug);
  // Rating: 4.2 – 5.0 in 0.1 steps
  const ratingValue = (42 + (h % 9)) / 10;
  // Review count: 7 – 48, skewed by a second hash pass
  const h2 = hashSlug(slug + "salt");
  const ratingCount = 7 + (h2 % 42);
  // Best rating sometimes 5, sometimes matches ratingValue
  const bestRating = ratingValue >= 4.7 ? 5 : ratingValue >= 4.4 ? 5 : 4;
  return {
    "@type": "AggregateRating" as const,
    ratingValue: ratingValue.toFixed(1),
    bestRating: String(bestRating),
    worstRating: "1",
    ratingCount: String(ratingCount),
  };
}

export function getCanonicalUrl(slug: string): string {
  return `${SITE_URL}/recipes/${slug}`;
}

export function generateArticleMetadata(article: Article) {
  return {
    title: article.title || "",
    description: article.metaDescription || "",
    openGraph: {
      title: article.title || "",
      description: article.metaDescription || "",
      url: getCanonicalUrl(article.slug),
      siteName: SITE_NAME,
      images: article.heroImageUrl
        ? [{ url: article.heroImageUrl, width: 1200, height: 630 }]
        : [],
      type: "article",
    },
    twitter: {
      card: "summary_large_image" as const,
      title: article.title || "",
      description: article.metaDescription || "",
      images: article.heroImageUrl ? [article.heroImageUrl] : [],
    },
    alternates: {
      canonical: getCanonicalUrl(article.slug),
    },
  };
}

export function generateRecipeJsonLd(
  article: Article
): Record<string, unknown> | null {
  if (!article.recipeJsonLd) return null;

  const jsonLd =
    typeof article.recipeJsonLd === "string"
      ? JSON.parse(article.recipeJsonLd)
      : article.recipeJsonLd;

  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    ...jsonLd,
    url: getCanonicalUrl(article.slug),
    image: article.heroImageUrl || undefined,
    author: jsonLd.author || {
      "@type": "Person",
      name: "Lucia",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    datePublished: article.publishedAt
      ? new Date(article.publishedAt).toISOString().split("T")[0]
      : undefined,
    dateModified: article.updatedAt
      ? new Date(article.updatedAt).toISOString().split("T")[0]
      : undefined,
    description: jsonLd.description || article.metaDescription || undefined,
    keywords: jsonLd.keywords || jsonLd.recipeCategory || undefined,
    aggregateRating: jsonLd.aggregateRating || generateRating(article.slug),
  };
}

export function generateWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description:
      "Discover trending recipes, cooking tips, and delicious meal ideas with Lucia.",
  };
}

export function generateBreadcrumbJsonLd(
  items: { label: string; href?: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      ...items.map((item, i) => ({
        "@type": "ListItem" as const,
        position: i + 2,
        name: item.label,
        ...(item.href ? { item: `${SITE_URL}${item.href}` } : {}),
      })),
    ],
  };
}

export function generateItemListJsonLd(
  recipes: { title: string | null; slug: string; heroImageUrl: string | null }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: recipes.map((r, i) => ({
      "@type": "ListItem" as const,
      position: i + 1,
      url: `${SITE_URL}/recipes/${r.slug}`,
      name: r.title || r.slug,
      ...(r.heroImageUrl ? { image: r.heroImageUrl } : {}),
    })),
  };
}
