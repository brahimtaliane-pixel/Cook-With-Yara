import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { ArticleStatus } from "@/lib/constants";
import { RecipeCard } from "@/components/recipe-card";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { generateBreadcrumbJsonLd, generateItemListJsonLd } from "@/lib/utils/seo";
import { CUISINES, getCuisine, articleMatchesCuisine } from "@/lib/utils/cuisines";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

type Props = { params: Promise<{ cuisine: string }> };

export async function generateStaticParams() {
  return CUISINES.map((c) => ({ cuisine: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cuisine: slug } = await params;
  const cuisine = getCuisine(slug);
  if (!cuisine) return { title: "Cuisine Not Found" };

  return {
    title: `${cuisine.name} Recipes`,
    description: cuisine.blurb,
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://cookwithyara.com"}/cuisines/${cuisine.slug}`,
    },
    openGraph: {
      title: `${cuisine.name} Recipes — Cook with Yara`,
      description: cuisine.blurb,
      type: "website",
    },
  };
}

export default async function CuisinePage({ params }: Props) {
  const { cuisine: slug } = await params;
  const cuisine = getCuisine(slug);
  if (!cuisine) notFound();

  const allPublished = await db
    .select()
    .from(articles)
    .where(eq(articles.status, ArticleStatus.PUBLISHED))
    .orderBy(desc(articles.publishedAt));

  const filtered = allPublished.filter((a) => articleMatchesCuisine(a, cuisine));

  const breadcrumbItems = [
    { label: "Cuisines", href: "/recipes" },
    { label: `${cuisine.name} Recipes` },
  ];
  const breadcrumbJsonLd = generateBreadcrumbJsonLd(breadcrumbItems);
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
          <Breadcrumbs items={breadcrumbItems} />
        </div>
      </div>

      {/* Hero */}
      <div className="border-b bg-warm grain relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 sm:py-24">
          <Link
            href="/recipes"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            &larr; All Recipes
          </Link>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Around the Mediterranean
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
            {cuisine.name} <span className="italic text-primary">Recipes</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {cuisine.blurb}
          </p>
          <p className="mt-4 text-sm text-muted-foreground/80">
            <span className="font-medium text-foreground">Signature dishes:</span>{" "}
            {cuisine.signatureDishes}
          </p>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* Recipe grid */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        {filtered.length > 0 ? (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {filtered.length}
              </span>{" "}
              {filtered.length === 1 ? "recipe" : "recipes"} from {cuisine.name} kitchens
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((recipe) => (
                <RecipeCard key={recipe.id} article={recipe} />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-border bg-secondary/30 py-20 text-center">
            <p className="text-sm font-medium text-foreground">
              No {cuisine.name} recipes yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Yara&apos;s working on it. New recipes are added daily.
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

      {/* Other cuisines */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <h2 className="mb-6 font-display text-2xl font-medium text-foreground">
          Explore other kitchens
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CUISINES.filter((c) => c.slug !== cuisine.slug).map((c) => (
            <Link
              key={c.slug}
              href={`/cuisines/${c.slug}`}
              className="group rounded-lg border border-border/60 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm"
            >
              <p className="font-display text-lg font-medium text-foreground transition-colors group-hover:text-primary">
                {c.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{c.tagline}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
