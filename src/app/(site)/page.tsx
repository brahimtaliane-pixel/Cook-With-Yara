import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { ArticleStatus } from "@/lib/constants";
import { generateWebsiteJsonLd } from "@/lib/utils/seo";
import { RecipeCard } from "@/components/recipe-card";
import { HeroSection } from "@/components/hero-section";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const categories = [
  { slug: "main-course", label: "Main Courses", desc: "Hearty dinners & weeknight favorites", icon: "/categories/main-course.png" },
  { slug: "dessert", label: "Desserts", desc: "Cakes, cookies & sweet treats", icon: "/categories/dessert.png" },
  { slug: "salad", label: "Salads", desc: "Fresh, vibrant & healthy", icon: "/categories/salad.png" },
  { slug: "appetizer", label: "Appetizers", desc: "Small bites & starters", icon: "/categories/appetizer.png" },
  { slug: "soup", label: "Soups", desc: "Warm bowls of comfort", icon: "/categories/soup.png" },
  { slug: "breakfast", label: "Breakfast", desc: "Start the day right", icon: "/categories/breakfast.png" },
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Hero Section ── */}
      <HeroSection />

      {/* ── Featured Recipe ── */}
      {featured && (
        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Featured
              </p>
              <h2 className="mt-1 font-display text-3xl font-bold text-foreground">
                Editor&apos;s Pick
              </h2>
            </div>
          </div>
          <RecipeCard article={featured} featured />
        </section>
      )}

      {/* ── Categories ── */}
      <section className="bg-secondary/30 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Browse by
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold text-foreground">
              Categories
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/categories/${cat.slug}`}
                className="group flex flex-col items-center rounded-2xl bg-card p-6 ring-1 ring-border/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:ring-primary/30"
              >
                <Image
                  src={cat.icon}
                  alt={cat.label}
                  width={80}
                  height={80}
                  className="mb-3 h-16 w-16 object-contain transition-transform duration-300 group-hover:scale-110 sm:h-20 sm:w-20"
                />
                <p className="font-display text-base font-bold text-foreground transition-colors group-hover:text-primary">
                  {cat.label}
                </p>
                <p className="mt-1 text-center text-xs leading-relaxed text-muted-foreground">
                  {cat.desc}
                </p>
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
              Recently added
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold text-foreground">
              Latest Recipes
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
              New recipes are coming soon. Stay tuned!
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

      {/* ── Newsletter ── */}
      <section
        id="newsletter"
        className="relative overflow-hidden bg-primary py-20"
      >
        <div className="relative z-10 mx-auto max-w-2xl px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary-foreground/70">
            Stay in the loop
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold text-primary-foreground sm:text-4xl">
            Get recipes in your inbox
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/70">
            Join thousands of home cooks. Every week I send my best new recipes,
            cooking tips, and seasonal meal ideas — completely free.
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

      {/* ── About Lucia ── */}
      <section id="about" className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="relative">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-secondary">
              <Image
                src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=750&fit=crop"
                alt="Lucia cooking in her kitchen"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div className="absolute -bottom-4 -right-4 rounded-xl bg-accent p-4 shadow-lg sm:-bottom-6 sm:-right-6 sm:p-6">
              <p className="font-display text-2xl font-bold text-accent-foreground sm:text-3xl">
                500+
              </p>
              <p className="text-xs font-medium text-accent-foreground/70">
                Recipes shared
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              About
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold text-foreground sm:text-4xl">
              Meet Lucia
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                I&apos;ve always believed that the best meals don&apos;t require
                a culinary degree — just fresh ingredients, a little love, and a
                good recipe to follow.
              </p>
              <p>
                What started as a personal recipe journal has grown into a
                community of home cooks who share a passion for simple, delicious
                food. Every recipe here has been tested, tasted, and perfected in
                my own kitchen.
              </p>
              <p>
                Whether you&apos;re a complete beginner or a seasoned cook
                looking for fresh inspiration, I hope you&apos;ll find something
                here that makes you excited to get into the kitchen.
              </p>
            </div>
            <Link
              href="/recipes"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-secondary px-6 py-3 text-sm font-semibold text-foreground transition-all hover:bg-secondary/80"
            >
              Explore my recipes &rarr;
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
