import type { Article } from "@/lib/db/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://cookwithlucia.com";
const SITE_NAME = "Cook with Lucia";

export function getCanonicalUrl(slug: string): string {
  return `${SITE_URL}/recipes/${slug}`;
}

export function generateArticleMetadata(article: Article) {
  return {
    title: `${article.title} | ${SITE_NAME}`,
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
