import Link from "next/link";

const categories = [
  { slug: "main-course", label: "Main Courses" },
  { slug: "dessert", label: "Desserts" },
  { slug: "salad", label: "Salads" },
  { slug: "appetizer", label: "Appetizers" },
  { slug: "soup", label: "Soups" },
  { slug: "breakfast", label: "Breakfast" },
];

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-20 text-center">
      <p className="font-display text-8xl font-bold text-primary/20">404</p>
      <h1 className="mt-4 font-display text-3xl font-bold text-foreground sm:text-4xl">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-base text-muted-foreground">
        Sorry, we couldn&apos;t find the page you&apos;re looking for. It may
        have been moved or no longer exists.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          &larr; Back to Home
        </Link>
        <Link
          href="/recipes"
          className="inline-flex items-center gap-2 rounded-full bg-secondary px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80"
        >
          Browse Recipes
        </Link>
      </div>

      <div className="mt-12">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Popular categories
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/categories/${cat.slug}`}
              className="rounded-full border px-4 py-1.5 text-sm text-foreground/70 transition-colors hover:border-primary/30 hover:text-primary"
            >
              {cat.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
