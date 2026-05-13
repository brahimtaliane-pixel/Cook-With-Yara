import Link from "next/link";
import Image from "next/image";
import { type LucideIcon } from "lucide-react";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { ArticleStatus } from "@/lib/constants";
import {
  generateWebsiteJsonLd,
  generateOrganizationJsonLd,
  generatePersonJsonLd,
  generateItemListJsonLd,
} from "@/lib/utils/seo";
import { CUISINES, articleMatchesCuisine } from "@/lib/utils/cuisines";
import { RecipeCard } from "@/components/recipe-card";
import { HeroSection } from "@/components/hero-section";

function parseJsonLd(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return typeof raw === "string"
      ? JSON.parse(raw)
      : (raw as Record<string, unknown>);
  } catch {
    return null;
  }
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

function totalMinutes(recipeJsonLd: unknown): number | null {
  const jsonLd = parseJsonLd(recipeJsonLd);
  const iso = (jsonLd?.totalTime as string | undefined) ?? null;
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;
  return parseInt(match[1] || "0") * 60 + parseInt(match[2] || "0");
}

export const dynamic = "force-dynamic";
export const revalidate = 3600;

type Category = {
  slug: string;
  label: string;
  desc: string;
  image?: string;
  Icon?: LucideIcon;
};

const categories: Category[] = [
  { slug: "main-course", label: "Main Courses", desc: "Hearty dinners & weeknight favorites", image: "/categories/main-course-v2.png" },
  { slug: "dessert", label: "Desserts", desc: "Cakes, cookies & sweet treats", image: "/categories/dessert-v2.png" },
  { slug: "salad", label: "Salads", desc: "Fresh, vibrant & herb-forward", image: "/categories/salad-v2.png" },
  { slug: "appetizer", label: "Appetizers", desc: "Mezze, dips & small bites", image: "/categories/appetizer.png" },
  { slug: "soup", label: "Soups", desc: "Warm bowls of comfort", image: "/categories/soup.png" },
  { slug: "breakfast", label: "Breakfast", desc: "A bright start to the day", image: "/categories/breakfast.png" },
];

export default async function HomePage() {
  const publishedRecipes = await db
    .select()
    .from(articles)
    .where(eq(articles.status, ArticleStatus.PUBLISHED))
    .orderBy(desc(articles.publishedAt))
    .limit(7);

  const [featured, ...latestRecipes] = publishedRecipes;
  const jsonLd = generateWebsiteJsonLd();
  const orgJsonLd = generateOrganizationJsonLd();
  const personJsonLd = generatePersonJsonLd();
  const itemListJsonLd = publishedRecipes.length > 0
    ? generateItemListJsonLd(publishedRecipes)
    : null;

  // Quick recipes (≤30 minutes total) — pull a wider pool so we don't run out
  // when the recent feed is dominated by longer recipes.
  const quickPool = await db
    .select()
    .from(articles)
    .where(eq(articles.status, ArticleStatus.PUBLISHED))
    .orderBy(desc(articles.publishedAt))
    .limit(30);

  const quickRecipes = quickPool
    .filter((a) => {
      const m = totalMinutes(a.recipeJsonLd);
      return m !== null && m <= 30;
    })
    .slice(0, 6);

  // Per-cuisine recipe counts for the "Around the Mediterranean" strip.
  // Reads from the same publishedRecipes query is not enough (we limit to 7),
  // so do a lightweight count query.
  const allForCuisineCounts = await db
    .select({
      id: articles.id,
      recipeJsonLd: articles.recipeJsonLd,
    })
    .from(articles)
    .where(eq(articles.status, ArticleStatus.PUBLISHED));

  const cuisineCounts = CUISINES.map((c) => ({
    cuisine: c,
    count: allForCuisineCounts.filter((a) => articleMatchesCuisine(a, c)).length,
  }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}

      {/* ── Hero Section ── */}
      <HeroSection />

      {/* ── Recipe of the Week (editorial spread) ── */}
      {featured &&
        (() => {
          const jsonLd = parseJsonLd(featured.recipeJsonLd);
          const category = jsonLd?.recipeCategory as string | undefined;
          const cuisine = jsonLd?.recipeCuisine as string | undefined;
          const totalTime =
            parseDuration(jsonLd?.totalTime as string | undefined) ||
            parseDuration(jsonLd?.cookTime as string | undefined);
          const recipeYield = jsonLd?.recipeYield as string | undefined;

          return (
            <section className="border-b border-border/60 bg-secondary/30">
              <div className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
                {/* Section header */}
                <div className="mb-8 flex flex-col gap-3 sm:mb-10 md:flex-row md:items-end md:justify-between">
                  <div className="max-w-xl">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
                      This week, on the table
                    </p>
                    <h2 className="mt-2 font-display text-2xl font-medium leading-tight tracking-tight text-foreground sm:text-3xl md:text-4xl">
                      What I&apos;m cooking right now
                    </h2>
                  </div>
                  <Link
                    href="/recipes"
                    className="inline-flex shrink-0 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    All recipes &rarr;
                  </Link>
                </div>

                {/* Editorial spread: image left, text right */}
                <Link
                  href={`/recipes/${featured.slug}`}
                  className="group grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-10"
                >
                  {/* Image */}
                  <div className="md:col-span-7">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-secondary">
                      {featured.heroImageUrl ? (
                        <Image
                          src={featured.heroImageUrl}
                          alt={featured.title || "Featured recipe"}
                          fill
                          className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                          sizes="(max-width: 768px) 100vw, 60vw"
                          priority
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <span className="text-sm text-muted-foreground/40">
                            No image
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Text */}
                  <div className="flex flex-col justify-center md:col-span-5">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {category && (
                        <span className="font-medium uppercase tracking-[0.15em] text-foreground">
                          {category}
                        </span>
                      )}
                      {category && cuisine && <span>·</span>}
                      {cuisine && <span>{cuisine}</span>}
                    </div>

                    <h3 className="mt-3 font-display text-2xl font-medium leading-[1.15] tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-3xl md:text-4xl">
                      {featured.title}
                    </h3>

                    {featured.metaDescription && (
                      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                        {featured.metaDescription}
                      </p>
                    )}

                    <dl className="mt-5 grid grid-cols-3 divide-x divide-border border-y border-border">
                      <div className="px-2 py-3 text-center">
                        <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          Time
                        </dt>
                        <dd className="mt-1 font-display text-base font-medium text-foreground sm:text-lg">
                          {totalTime || "—"}
                        </dd>
                      </div>
                      <div className="px-2 py-3 text-center">
                        <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          Serves
                        </dt>
                        <dd className="mt-1 font-display text-base font-medium text-foreground sm:text-lg">
                          {recipeYield || "—"}
                        </dd>
                      </div>
                      <div className="px-2 py-3 text-center">
                        <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          Difficulty
                        </dt>
                        <dd className="mt-1 font-display text-base font-medium text-foreground sm:text-lg">
                          Easy
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-5">
                      <span className="inline-flex items-center text-sm font-medium text-foreground underline-offset-4 group-hover:underline">
                        View full recipe &rarr;
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            </section>
          );
        })()}

      {/* ── Categories ── */}
      <section className="bg-secondary/30 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              Browse by
            </p>
            <h2 className="mt-2 font-display text-4xl font-medium text-foreground sm:text-5xl">
              Categories
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map(({ slug, label, desc, image, Icon }) => (
              <Link
                key={slug}
                href={`/categories/${slug}`}
                className="group flex flex-col items-center rounded-xl bg-card p-6 ring-1 ring-border/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:ring-primary/40"
              >
                <div className="relative mb-3 flex h-20 w-20 items-center justify-center sm:h-24 sm:w-24">
                  {image ? (
                    <Image
                      src={image}
                      alt={label}
                      width={200}
                      height={200}
                      className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-110"
                    />
                  ) : Icon ? (
                    <Icon
                      className="h-12 w-12 text-primary transition-transform duration-300 group-hover:scale-110 sm:h-14 sm:w-14"
                      strokeWidth={1.4}
                    />
                  ) : null}
                </div>
                <p className="font-display text-lg font-medium text-foreground transition-colors group-hover:text-primary">
                  {label}
                </p>
                <p className="mt-1 text-center text-xs leading-relaxed text-muted-foreground">
                  {desc}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Around the Mediterranean (cuisines) ── */}
      <section className="relative overflow-hidden bg-primary py-20 text-primary-foreground">
        <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
              A little tour of the Mediterranean
            </p>
            <h2 className="mt-2 font-display text-4xl font-medium leading-[1.1] sm:text-5xl">
              Six kitchens, <span className="italic text-accent">one table</span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-primary-foreground/75">
              From Beirut to Marrakech, Athens to Tehran — these are the kitchens
              I love most. They all share my favorite things: olive oil, fresh herbs,
              and food meant for sharing. Pick one and let&apos;s cook.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {cuisineCounts.map(({ cuisine, count }) => (
              <Link
                key={cuisine.slug}
                href={`/cuisines/${cuisine.slug}`}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-primary-foreground/10 bg-primary-foreground/5 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:bg-primary-foreground/10 sm:p-6"
              >
                <div>
                  <p className="font-display text-2xl font-medium leading-tight text-primary-foreground transition-colors group-hover:text-accent sm:text-3xl">
                    {cuisine.name}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-primary-foreground/65">
                    {cuisine.tagline}
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between text-xs">
                  <span className="text-primary-foreground/55">
                    {count > 0
                      ? `${count} ${count === 1 ? "recipe" : "recipes"}`
                      : "Coming soon"}
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-accent transition-transform duration-300 group-hover:translate-x-0.5"
                  >
                    &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Latest Recipes Grid ── */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Fresh out of the kitchen
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold text-foreground">
              The latest recipes
            </h2>
          </div>
          <Link
            href="/recipes"
            className="hidden items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary/80 sm:flex"
          >
            View all &rarr;
          </Link>
        </div>

        {latestRecipes.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latestRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} article={recipe} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-border bg-secondary/30 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              More recipes are on the way! Check back soon.
            </p>
          </div>
        )}

        <div className="mt-8 text-center sm:hidden">
          <Link
            href="/recipes"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
          >
            View all recipes &rarr;
          </Link>
        </div>
      </section>

      {/* ── Quick recipes (≤30 min) ── */}
      {quickRecipes.length > 0 && (
        <section className="bg-secondary/30 py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-10 flex items-end justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  Ready in a flash
                </p>
                <h2 className="mt-1 font-display text-3xl font-bold text-foreground">
                  Quick recipes — under 30 minutes
                </h2>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  For the nights when dinner needs to happen now. Every one of
                  these lands on the table in half an hour or less.
                </p>
              </div>
              <Link
                href="/recipes"
                className="hidden items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary/80 sm:flex"
              >
                Browse all &rarr;
              </Link>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {quickRecipes.map((recipe) => (
                <RecipeCard key={recipe.id} article={recipe} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Newsletter ── */}
      <section
        id="newsletter"
        className="relative overflow-hidden bg-primary py-20"
      >
        <div className="relative z-10 mx-auto max-w-2xl px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary-foreground/70">
            Let&apos;s stay in touch
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold text-primary-foreground sm:text-4xl">
            New recipes, every Sunday
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/70">
            Once a week, I send a little postcard from my kitchen — my newest
            recipes, what&apos;s in season, and the small tips I wish someone
            had told me. No spam, just food.
          </p>
          <form
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"
            onSubmit={undefined}
          >
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              placeholder="your@email.com"
              className="h-12 rounded-full border-0 bg-white/15 px-6 text-sm text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-white/30 sm:w-72"
              required
            />
            <button
              type="submit"
              className="h-12 rounded-full bg-white px-8 text-sm font-semibold text-primary shadow-sm transition-all hover:bg-white/90 hover:shadow-md"
            >
              Subscribe
            </button>
          </form>
          <p className="mt-3 text-xs text-primary-foreground/50">
            No spam, ever. Unsubscribe anytime.
          </p>
        </div>

        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
      </section>

      {/* ── About Yara ── */}
      <section id="about" className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="relative">
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-secondary">
              <Image
                src="/yara-kitchen.webp"
                alt="Yara plating a saffron and shrimp dish in her kitchen"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div className="absolute -bottom-4 -right-4 rounded-lg bg-accent p-4 shadow-lg sm:-bottom-6 sm:-right-6 sm:p-6">
              <p className="font-display text-2xl font-semibold text-accent-foreground sm:text-3xl">
                Tested at home
              </p>
              <p className="text-xs font-medium text-accent-foreground/70">
                Every recipe, every time
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              A little about me
            </p>
            <h2 className="mt-1 font-display text-4xl font-medium text-foreground sm:text-5xl">
              Hi, I&apos;m <span className="italic text-primary">Yara</span>
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                I grew up in a kitchen where the best meals came from a handful
                of ingredients, fresh herbs on the windowsill, and warm spices
                toasting in olive oil. That&apos;s still how I cook today.
              </p>
              <p>
                This little corner of the internet is my love letter to that
                food — Mediterranean and Levantine cooking, made for the way you
                actually cook. Every recipe is tested in my own kitchen, written
                like I&apos;d explain it to a friend.
              </p>
              <p>
                Whether you&apos;re cooking for one or feeding a full table, I
                hope you find something here that makes your kitchen smell
                amazing tonight. So glad you&apos;re here.
              </p>
            </div>
            <Link
              href="/recipes"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
            >
              Come see what I&apos;m cooking &rarr;
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
