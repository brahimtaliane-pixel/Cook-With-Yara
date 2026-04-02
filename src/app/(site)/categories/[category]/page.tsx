import Link from "next/link";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { ArticleStatus } from "@/lib/constants";
import { RecipeCard } from "@/components/recipe-card";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { generateBreadcrumbJsonLd, generateItemListJsonLd } from "@/lib/utils/seo";
import type { Article } from "@/lib/db/schema";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

type Props = { params: Promise<{ category: string }> };

const categoryMeta: Record<string, { description: string }> = {
  "main-course": {
    description:
      "Hearty main dishes from around the world — perfect for dinner with family and friends.",
  },
  dessert: {
    description:
      "Sweet endings to any meal. From simple cakes to indulgent chocolate treats.",
  },
  salad: {
    description:
      "Fresh, vibrant salads that are anything but boring. Healthy and delicious.",
  },
  appetizer: {
    description:
      "Start your meal right with these crowd-pleasing appetizers and snacks.",
  },
  soup: {
    description:
      "Warm, comforting soups for every season. Perfect for cozy evenings.",
  },
  breakfast: {
    description:
      "Start your day deliciously with these breakfast and brunch favorites.",
  },
};

function formatCategory(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const label = formatCategory(category);
  const meta = categoryMeta[category];
  return {
    title: `${label} Recipes`,
    description:
      meta?.description ||
      `Browse delicious ${label.toLowerCase()} recipes from Cook with Lucia.`,
    alternates: {
      canonical: `https://cookwithlucia.com/categories/${category}`,
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const label = formatCategory(category);
  const meta = categoryMeta[category];

  const allPublished = await db
    .select()
    .from(articles)
    .where(eq(articles.status, ArticleStatus.PUBLISHED))
    .orderBy(desc(articles.publishedAt));

  const filtered = allPublished.filter((a) => {
    const cat = getCategory(a);
    if (!cat) return false;
    return cat.toLowerCase().replace(/\s+/g, "-") === category.toLowerCase();
  });

  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { label: "Recipes", href: "/recipes" },
    { label: `${label} Recipes` },
  ]);
  const itemListJsonLd = generateItemListJsonLd(
    filtered.map((r) => ({ title: r.title, slug: r.slug, heroImageUrl: r.heroImageUrl }))
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      {/* Breadcrumbs */}
      <div className="border-b bg-background print:hidden">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <Breadcrumbs
            items={[
              { label: "Recipes", href: "/recipes" },
              { label: `${label} Recipes` },
            ]}
          />
        </div>
      </div>

      {/* Header */}
      <div className="border-b bg-warm grain relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-14 sm:py-20">
          <Link
            href="/recipes"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            &larr; All Recipes
          </Link>
          <div className="mt-4">
            <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
              {label} Recipes
            </h1>
            {meta?.description && (
              <p className="mt-2 max-w-xl text-base text-muted-foreground">
                {meta.description}
              </p>
            )}
          </div>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Grid */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        {filtered.length > 0 ? (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {filtered.length}
              </span>{" "}
              {filtered.length === 1 ? "recipe" : "recipes"} in {label}
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((recipe) => (
                <RecipeCard key={recipe.id} article={recipe} />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-border bg-secondary/30 py-20 text-center">
            <p className="text-sm font-medium text-foreground">
              No {label.toLowerCase()} recipes yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              New recipes are added daily. Check back soon!
            </p>
            <Link
              href="/recipes"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary"
            >
              Browse all recipes &rarr;
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
