import Link from "next/link";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { ArticleStatus } from "@/lib/constants";
import { RecipeCard } from "@/components/recipe-card";
import type { Article } from "@/lib/db/schema";
import { generateItemListJsonLd } from "@/lib/utils/seo";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "All Recipes",
  description:
    "Browse Yara's Mediterranean and Levantine recipes — herb-forward, fresh, and built for real home cooks.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://cookwithyara.com"}/recipes`,
  },
};

const categoryFilters = [
  { slug: "all", label: "All Recipes" },
  { slug: "main-course", label: "Main Courses" },
  { slug: "dessert", label: "Desserts" },
  { slug: "salad", label: "Salads" },
  { slug: "appetizer", label: "Appetizers" },
  { slug: "soup", label: "Soups" },
  { slug: "breakfast", label: "Breakfast" },
];

function getCategory(article: Article): string | null {
  if (!article.recipeJsonLd) return null;
  try {
    const jsonLd =
      typeof article.recipeJsonLd === "string"
        ? JSON.parse(article.recipeJsonLd)
        : article.recipeJsonLd;
    return (jsonLd.recipeCategory as string) || null;
  } catch {
    return null;
  }
}

type Props = {
  searchParams: Promise<{ category?: string }>;
};

export default async function RecipesPage({ searchParams }: Props) {
  const { category } = await searchParams;

  const allRecipes = await db
    .select()
    .from(articles)
    .where(eq(articles.status, ArticleStatus.PUBLISHED))
    .orderBy(desc(articles.publishedAt));

  const activeCategory = category || "all";

  const filteredRecipes =
    activeCategory === "all"
      ? allRecipes
      : allRecipes.filter((a) => {
          const cat = getCategory(a);
          if (!cat) return false;
          return (
            cat.toLowerCase().replace(/\s+/g, "-") ===
            activeCategory.toLowerCase()
          );
        });

  const itemListJsonLd = generateItemListJsonLd(
    allRecipes.map((r) => ({ title: r.title, slug: r.slug, heroImageUrl: r.heroImageUrl }))
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      {/* Page header */}
      <div className="border-b bg-warm grain relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-14 sm:py-20">
          <p className="animate-fade-in text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Browse
          </p>
          <h1 className="animate-fade-in-up mt-2 font-display text-4xl font-bold text-foreground sm:text-5xl">
            All Recipes
          </h1>
          <p className="animate-fade-in-up stagger-1 mt-3 max-w-xl text-base text-muted-foreground">
            {allRecipes.length} tried-and-tested recipes for every occasion.
            Filter by category to find exactly what you&apos;re craving.
          </p>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Category pills */}
      <div className="sticky top-16 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl overflow-x-auto px-6 py-3">
          <div className="flex gap-2">
            {categoryFilters.map((cat) => (
              <Link
                key={cat.slug}
                href={
                  cat.slug === "all"
                    ? "/recipes"
                    : `/recipes?category=${cat.slug}`
                }
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  activeCategory === cat.slug
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                }`}
              >
                {cat.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recipe grid */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        {filteredRecipes.length > 0 ? (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-semibold text-foreground">
                {filteredRecipes.length}
              </span>{" "}
              {filteredRecipes.length === 1 ? "recipe" : "recipes"}
              {activeCategory !== "all" && (
                <>
                  {" "}
                  in{" "}
                  <span className="font-semibold text-foreground">
                    {categoryFilters.find((c) => c.slug === activeCategory)
                      ?.label || activeCategory}
                  </span>
                </>
              )}
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRecipes.map((recipe) => (
                <RecipeCard key={recipe.id} article={recipe} />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-border bg-secondary/30 py-20 text-center">
            <p className="text-sm font-medium text-foreground">
              No recipes found
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeCategory !== "all"
                ? "Try a different category or check back soon!"
                : "Recipes are coming soon. Stay tuned!"}
            </p>
            {activeCategory !== "all" && (
              <Link
                href="/recipes"
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary"
              >
                View all recipes &rarr;
              </Link>
            )}
          </div>
        )}
      </section>
    </>
  );
}
