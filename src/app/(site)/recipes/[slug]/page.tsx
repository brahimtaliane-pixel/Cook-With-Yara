import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { ArticleStatus } from "@/lib/constants";
import {
  generateArticleMetadata,
  generateRecipeJsonLd,
} from "@/lib/utils/seo";
import { RecipeContent } from "@/components/recipe-content";
import { RecipeCard } from "@/components/recipe-card";
import { RecipeBox } from "@/components/recipe-box";
import { RecipeActions } from "@/components/recipe-actions";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { TableOfContents, type TocHeading } from "@/components/table-of-contents";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  if (!process.env.DATABASE_URL) return [];
  const published = await db
    .select({ slug: articles.slug })
    .from(articles)
    .where(eq(articles.status, ArticleStatus.PUBLISHED));
  return published.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.slug, slug))
    .limit(1);
  if (!article) return {};
  return generateArticleMetadata(article);
}

function parseDuration(iso?: string): string | null {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;
  const hours = parseInt(match[1] || "0");
  const mins = parseInt(match[2] || "0");
  if (hours > 0) return `${hours}h ${mins > 0 ? `${mins}m` : ""}`.trim();
  return `${mins} min`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJsonLd(raw: any) {
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

function estimateReadTime(mdx?: string | null): string {
  if (!mdx) return "3 min read";
  const words = mdx.replace(/[#*\-_>\[\](){}|`~]/g, " ").split(/\s+/).length;
  const minutes = Math.max(2, Math.ceil(words / 225));
  return `${minutes} min read`;
}

function extractHeadings(mdx?: string | null): TocHeading[] {
  if (!mdx) return [];
  const headingRegex = /^##\s+(.+)$/gm;
  const headings: TocHeading[] = [];
  let match;
  while ((match = headingRegex.exec(mdx)) !== null) {
    const text = match[1].replace(/[*_`]/g, "").trim();
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    headings.push({ id, text });
  }
  return headings;
}

export default async function RecipePage({ params }: Props) {
  const { slug } = await params;
  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.slug, slug))
    .limit(1);

  if (!article || article.status !== ArticleStatus.PUBLISHED) {
    notFound();
  }

  const schemaJsonLd = generateRecipeJsonLd(article);
  const jsonLd = parseJsonLd(article.recipeJsonLd);

  const totalTime = parseDuration(jsonLd?.totalTime);
  const category = jsonLd?.recipeCategory as string | undefined;
  const ingredients = (jsonLd?.recipeIngredient || []) as string[];
  const instructions = (jsonLd?.recipeInstructions || []) as Array<{
    name?: string;
    text: string;
  }>;
  const nutrition = jsonLd?.nutrition as Record<string, string> | undefined;
  const readTime = estimateReadTime(article.contentMdx);
  const canonicalUrl = `https://cookwithlucia.com/recipes/${article.slug}`;
  const headings = extractHeadings(article.contentMdx);

  const categorySlug = category
    ? category.toLowerCase().replace(/\s+/g, "-")
    : null;

  const breadcrumbItems = [
    { label: "Recipes", href: "/recipes" },
    ...(category && categorySlug
      ? [{ label: category, href: `/categories/${categorySlug}` }]
      : []),
    { label: article.title || "Recipe" },
  ];

  const moreRecipes = await db
    .select()
    .from(articles)
    .where(eq(articles.status, ArticleStatus.PUBLISHED))
    .orderBy(desc(articles.publishedAt))
    .limit(4);

  const related = moreRecipes.filter((r) => r.id !== article.id).slice(0, 3);

  return (
    <>
      {schemaJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaJsonLd) }}
        />
      )}

      {/* ── Hero image ── */}
      {article.heroImageUrl && (
        <div className="relative h-[50vh] min-h-[400px] w-full sm:h-[60vh] print:hidden">
          <Image
            src={article.heroImageUrl}
            alt={article.title || "Recipe hero image"}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/5" />

          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
            <div className="mx-auto max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                {category && (
                  <Badge className="bg-white/20 text-white backdrop-blur-sm hover:bg-white/30">
                    {category}
                  </Badge>
                )}
                {article.publishedAt && (
                  <span className="text-xs text-white/70">
                    {new Date(article.publishedAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                )}
                <span className="text-xs text-white/60">&middot;</span>
                <span className="text-xs text-white/70">{readTime}</span>
              </div>
              <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
                {article.title}
              </h1>
              {article.metaDescription && (
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">
                  {article.metaDescription}
                </p>
              )}

              {/* Jump to Recipe */}
              <a
                href="#recipe-card"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/20 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/30"
              >
                Jump to Recipe
                <ChevronDown className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Text header fallback (no hero image) ── */}
      {!article.heroImageUrl && (
        <div className="border-b bg-warm grain relative overflow-hidden print:border-0">
          <div className="relative z-10 mx-auto max-w-4xl px-6 py-14 sm:py-20">
            <div className="flex flex-wrap items-center gap-3">
              {category && (
                <Badge
                  variant="secondary"
                  className="bg-warm text-warm-foreground"
                >
                  {category}
                </Badge>
              )}
              {article.publishedAt && (
                <span className="text-xs text-muted-foreground">
                  {new Date(article.publishedAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              )}
              <span className="text-xs text-muted-foreground">&middot;</span>
              <span className="text-xs text-muted-foreground">{readTime}</span>
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
              {article.title}
            </h1>
            {article.metaDescription && (
              <p className="mt-3 max-w-2xl text-base text-muted-foreground">
                {article.metaDescription}
              </p>
            )}
            <a
              href="#recipe-card"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Jump to Recipe
              <ChevronDown className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}

      {/* ── Breadcrumbs ── */}
      <div className="border-b bg-background print:hidden">
        <div className="mx-auto max-w-4xl px-6 py-3">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
      </div>

      {/* ── Author byline + actions bar ── */}
      <div className="border-b bg-card print:hidden">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              L
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Lucia</p>
              <p className="text-xs text-muted-foreground">
                {readTime}
                {totalTime && <> &middot; {totalTime} total</>}
              </p>
            </div>
          </div>
          <RecipeActions
            title={article.title || "Recipe"}
            url={canonicalUrl}
            imageUrl={article.heroImageUrl}
            description={article.metaDescription}
          />
        </div>
      </div>

      {/* ── Blog content + TOC + Recipe card ── */}
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="lg:grid lg:grid-cols-[1fr_220px] lg:gap-10">
          <article className="max-w-4xl">
            {/* Print-only header */}
            <div className="hidden print:block print:mb-6">
              <h1 className="font-display text-3xl font-bold text-foreground">
                {article.title}
              </h1>
              {article.metaDescription && (
                <p className="mt-2 text-base text-muted-foreground">
                  {article.metaDescription}
                </p>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                cookwithlucia.com/recipes/{article.slug}
              </p>
            </div>

            {/* Mobile TOC */}
            {headings.length >= 2 && <TableOfContents headings={headings} />}

            {/* Blog prose (the story, tips, etc.) */}
            {article.contentMdx && (
              <RecipeContent
                source={article.contentMdx}
                heroImageUrl={article.heroImageUrl}
                heroAlt={article.title || "Recipe photo"}
              />
            )}

            {/* ── Structured Recipe Card ── */}
            {(ingredients.length > 0 || instructions.length > 0) && (
              <div className="mt-12">
                <RecipeBox
                  name={jsonLd?.name || article.title || "Recipe"}
                  description={jsonLd?.description}
                  prepTime={jsonLd?.prepTime}
                  cookTime={jsonLd?.cookTime}
                  totalTime={jsonLd?.totalTime}
                  recipeYield={jsonLd?.recipeYield}
                  recipeCategory={jsonLd?.recipeCategory}
                  recipeCuisine={jsonLd?.recipeCuisine}
                  recipeIngredient={ingredients}
                  recipeInstructions={instructions}
                  nutrition={nutrition}
                  imageUrl={article.heroImageUrl}
                />
              </div>
            )}
          </article>

          {/* Desktop TOC sidebar */}
          {headings.length >= 2 && <TableOfContents headings={headings} />}
        </div>
      </div>

      {/* ── Related recipes ── */}
      {related.length > 0 && (
        <section className="border-t bg-secondary/30 py-16 print:hidden">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-8 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Keep cooking
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold text-foreground sm:text-3xl">
                You might also like
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((recipe) => (
                <RecipeCard key={recipe.id} article={recipe} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
