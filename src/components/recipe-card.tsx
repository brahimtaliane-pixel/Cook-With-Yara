import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Article } from "@/lib/db/schema";

function parseJsonLd(article: Article) {
  if (!article.recipeJsonLd) return null;
  try {
    return typeof article.recipeJsonLd === "string"
      ? JSON.parse(article.recipeJsonLd)
      : article.recipeJsonLd;
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

export function RecipeCard({
  article,
  featured = false,
}: {
  article: Article;
  featured?: boolean;
}) {
  const jsonLd = parseJsonLd(article);
  const category = jsonLd?.recipeCategory as string | undefined;
  const totalTime =
    parseDuration(jsonLd?.totalTime) ||
    parseDuration(jsonLd?.cookTime) ||
    null;

  if (featured) {
    return (
      <Link
        href={`/recipes/${article.slug}`}
        className="group relative block overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/50 transition-all duration-500 hover:shadow-xl hover:ring-border"
      >
        <div className="grid lg:grid-cols-2">
          <div className="relative aspect-[4/3] overflow-hidden lg:aspect-auto lg:min-h-[400px]">
            {article.heroImageUrl ? (
              <Image
                src={article.heroImageUrl}
                alt={article.title || "Featured recipe"}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-secondary">
                <span className="text-4xl text-muted-foreground/20">No image</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 lg:bg-gradient-to-r" />
          </div>

          <div className="flex flex-col justify-center p-8 lg:p-12">
            <div className="mb-4 flex items-center gap-3">
              {category && (
                <Badge
                  variant="secondary"
                  className="bg-warm text-warm-foreground hover:bg-warm"
                >
                  {category}
                </Badge>
              )}
              {totalTime && (
                <span className="text-xs font-medium text-muted-foreground">
                  {totalTime}
                </span>
              )}
            </div>

            <h2 className="font-display text-2xl font-bold leading-tight text-foreground transition-colors group-hover:text-primary lg:text-3xl">
              {article.title}
            </h2>

            {article.metaDescription && (
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground lg:text-base">
                {article.metaDescription}
              </p>
            )}

            <p className="mt-6 text-sm font-semibold text-primary">
              View Recipe &rarr;
            </p>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/recipes/${article.slug}`}
      className="group block overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/50 transition-all duration-500 hover:shadow-lg hover:ring-border hover:-translate-y-1"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {article.heroImageUrl ? (
          <Image
            src={article.heroImageUrl}
            alt={article.title || "Recipe image"}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-secondary">
            <span className="text-sm text-muted-foreground/40">No image</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        {category && (
          <div className="absolute left-3 top-3">
            <Badge className="bg-white/90 text-foreground shadow-sm backdrop-blur-sm hover:bg-white/90">
              {category}
            </Badge>
          </div>
        )}

        {totalTime && (
          <div className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm">
            {totalTime}
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="font-display text-lg font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
          {article.title}
        </h3>

        {article.metaDescription && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {article.metaDescription}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {article.publishedAt
              ? new Date(article.publishedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : ""}
          </p>
          <span className="text-xs font-semibold text-primary opacity-0 transition-all duration-300 group-hover:opacity-100">
            Read more &rarr;
          </span>
        </div>
      </div>
    </Link>
  );
}
