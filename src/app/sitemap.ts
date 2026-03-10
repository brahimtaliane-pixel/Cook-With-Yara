import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ArticleStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://cookwithlucia.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const published = await db
    .select({
      slug: articles.slug,
      updatedAt: articles.updatedAt,
      recipeJsonLd: articles.recipeJsonLd,
    })
    .from(articles)
    .where(eq(articles.status, ArticleStatus.PUBLISHED));

  const recipeEntries: MetadataRoute.Sitemap = published.map((a) => ({
    url: `${SITE_URL}/recipes/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const categories = new Set<string>();
  for (const a of published) {
    if (!a.recipeJsonLd) continue;
    const jsonLd =
      typeof a.recipeJsonLd === "string"
        ? JSON.parse(a.recipeJsonLd)
        : a.recipeJsonLd;
    if (jsonLd.recipeCategory) {
      categories.add(
        (jsonLd.recipeCategory as string).toLowerCase().replace(/\s+/g, "-")
      );
    }
  }

  const categoryEntries: MetadataRoute.Sitemap = Array.from(categories).map(
    (cat) => ({
      url: `${SITE_URL}/categories/${cat}`,
      changeFrequency: "weekly",
      priority: 0.6,
    })
  );

  return [
    {
      url: SITE_URL,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/recipes`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...recipeEntries,
    ...categoryEntries,
  ];
}
