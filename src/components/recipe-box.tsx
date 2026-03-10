"use client";

import { Clock, Users, Flame, ChefHat, Printer } from "lucide-react";

function parseDuration(iso?: string): string | null {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;
  const hours = parseInt(match[1] || "0");
  const mins = parseInt(match[2] || "0");
  if (hours > 0) return `${hours}h ${mins > 0 ? `${mins}m` : ""}`.trim();
  return `${mins} min`;
}

interface NutritionInfo {
  calories?: string;
  carbohydrateContent?: string;
  proteinContent?: string;
  fatContent?: string;
  fiberContent?: string;
  sodiumContent?: string;
  sugarContent?: string;
}

interface HowToStep {
  name?: string;
  text: string;
}

interface RecipeBoxProps {
  name: string;
  description?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string;
  recipeCategory?: string;
  recipeCuisine?: string;
  recipeIngredient: string[];
  recipeInstructions: HowToStep[];
  nutrition?: NutritionInfo;
  imageUrl?: string | null;
}

function PinterestIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
    </svg>
  );
}

export function RecipeBox({
  name,
  description,
  prepTime,
  cookTime,
  totalTime,
  recipeYield,
  recipeCategory,
  recipeCuisine,
  recipeIngredient,
  recipeInstructions,
  nutrition,
  imageUrl,
}: RecipeBoxProps) {
  const prep = parseDuration(prepTime);
  const cook = parseDuration(cookTime);
  const total = parseDuration(totalTime);

  const timeItems = [
    { label: "Prep Time", value: prep, icon: ChefHat },
    { label: "Cook Time", value: cook, icon: Flame },
    { label: "Total Time", value: total, icon: Clock },
    { label: "Servings", value: recipeYield, icon: Users },
  ].filter((item) => item.value);

  const nutritionItems = nutrition
    ? [
        { label: "Calories", value: nutrition.calories },
        { label: "Carbs", value: nutrition.carbohydrateContent },
        { label: "Protein", value: nutrition.proteinContent },
        { label: "Fat", value: nutrition.fatContent },
        { label: "Fiber", value: nutrition.fiberContent },
        { label: "Sodium", value: nutrition.sodiumContent },
        { label: "Sugar", value: nutrition.sugarContent },
      ].filter((item) => item.value)
    : [];

  return (
    <div
      id="recipe-card"
      className="recipe-card-box scroll-mt-24 rounded-2xl bg-card ring-1 ring-border/60 overflow-hidden"
    >
      {/* Header */}
      <div className="bg-primary/5 px-6 py-6 sm:px-8 sm:py-8">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            {name}
          </h2>
          {description && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {description}
            </p>
          )}
          {(recipeCategory || recipeCuisine) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {recipeCategory && (
                <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
                  {recipeCategory}
                </span>
              )}
              {recipeCuisine && (
                <span className="rounded-full bg-secondary px-3 py-1 font-medium">
                  {recipeCuisine}
                </span>
              )}
            </div>
          )}
          <div className="mt-4 flex gap-2 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              <Printer className="h-4 w-4" />
              Print Recipe
            </button>
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams({
                  url: window.location.href,
                  description: name,
                  ...(imageUrl ? { media: imageUrl } : {}),
                });
                window.open(
                  `https://pinterest.com/pin/create/button/?${params}`,
                  "_blank",
                  "noopener,noreferrer,width=750,height=550"
                );
              }}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-[#E60023] hover:text-white hover:border-[#E60023]"
            >
              <PinterestIcon className="h-4 w-4" />
              Pin Recipe
            </button>
          </div>
        </div>

        {/* Time grid */}
        {timeItems.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {timeItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5 rounded-xl bg-card px-4 py-3 ring-1 ring-border/40"
                >
                  <Icon className="h-5 w-5 shrink-0 text-primary/70" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="text-sm font-bold text-foreground">
                      {item.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ingredients */}
      {recipeIngredient.length > 0 && (
        <div className="border-t border-border/60 px-6 py-6 sm:px-8">
          <h3 className="font-display text-xl font-bold text-foreground">
            Ingredients
          </h3>
          {recipeYield && (
            <p className="mt-1 text-xs text-muted-foreground">
              For {recipeYield}
            </p>
          )}
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {recipeIngredient.map((ingredient, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/50" />
                <span className="text-foreground/80">{ingredient}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Instructions */}
      {recipeInstructions.length > 0 && (
        <div className="border-t border-border/60 px-6 py-6 sm:px-8">
          <h3 className="font-display text-xl font-bold text-foreground">
            Instructions
          </h3>
          <ol className="mt-4 space-y-5">
            {recipeInstructions.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-primary/60 bg-primary/5 text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <div className="pt-0.5">
                  {step.name && (
                    <p className="font-semibold text-foreground">{step.name}</p>
                  )}
                  <p className="mt-0.5 text-sm leading-relaxed text-foreground/80">
                    {step.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Nutrition */}
      {nutritionItems.length > 0 && (
        <div className="border-t border-border/60 px-6 py-6 sm:px-8">
          <h3 className="font-display text-xl font-bold text-foreground">
            Nutrition Facts
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">Per serving (estimated)</p>
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {nutritionItems.map((item) => (
              <div
                key={item.label}
                className="rounded-xl bg-secondary/60 px-3 py-2.5 text-center"
              >
                <p className="text-sm font-bold text-foreground">
                  {item.value}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
