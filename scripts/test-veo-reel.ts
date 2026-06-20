/**
 * Verify the Veo recipe-reel output WITHOUT posting anything.
 *
 *   npx tsx scripts/test-veo-reel.ts            # newest published recipe
 *   npx tsx scripts/test-veo-reel.ts --slug=foo # a specific recipe
 *   npx tsx scripts/test-veo-reel.ts --dry      # pick + print prompt, no Veo call
 *
 * Saves the MP4 to ./veo-test-<slug>.mp4 for you to open and review. Does not
 * touch pin_queue or Pinterest.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFile } from "fs/promises";
import { db } from "../src/lib/db";
import { articles } from "../src/lib/db/schema";
import { ArticleStatus } from "../src/lib/constants";
import { extractRecipeMeta } from "../src/lib/utils/recipe-meta";
import { startRecipeVideo, pollRecipeVideo } from "../src/lib/services/video-generator";
import { and, desc, eq, isNotNull } from "drizzle-orm";

function extractSteps(recipeJsonLd: unknown): string[] {
  const ld = recipeJsonLd as Record<string, unknown> | null | undefined;
  const raw = ld?.recipeInstructions;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) =>
      typeof s === "string"
        ? s
        : ((s as Record<string, unknown>).name as string) ||
          ((s as Record<string, unknown>).text as string) ||
          "",
    )
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const slug = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1];
  const dry = process.argv.includes("--dry");

  // Poll-only: salvage an already-running operation without paying for a new one.
  //   npx tsx scripts/test-veo-reel.ts --op=models/.../operations/xxx [--key=1]
  const opArg = process.argv.find((a) => a.startsWith("--op="))?.split("=")[1];
  if (opArg) {
    const keyNum = process.argv.find((a) => a.startsWith("--key="))?.split("=")[1];
    const keyIndex = keyNum ? parseInt(keyNum, 10) - 1 : 0;
    await pollUntilDone(opArg, keyIndex, "salvaged-reel");
    return;
  }

  const [article] = slug
    ? await db.select().from(articles).where(eq(articles.slug, slug)).limit(1)
    : await db
        .select()
        .from(articles)
        .where(
          and(
            eq(articles.status, ArticleStatus.PUBLISHED),
            isNotNull(articles.heroImageUrl),
            isNotNull(articles.pinImageUrl),
          ),
        )
        .orderBy(desc(articles.publishedAt))
        .limit(1);

  if (!article) {
    console.error("No eligible article found (need PUBLISHED + hero + pin image).");
    process.exit(1);
  }

  const meta = extractRecipeMeta(
    article.recipeJsonLd as Record<string, unknown> | null,
  );
  const steps = extractSteps(article.recipeJsonLd);

  console.log("─".repeat(60));
  console.log(`Recipe : ${article.title}`);
  console.log(`Slug   : ${article.slug}`);
  console.log(`Steps  : ${steps.slice(0, 5).join(" · ") || "(none — using ingredients)"}`);
  console.log("─".repeat(60));

  if (dry) {
    console.log("[dry] Imports + article selection OK. Stopping before Veo call.");
    process.exit(0);
  }

  const providerArg = process.argv
    .find((a) => a.startsWith("--provider="))
    ?.split("=")[1] as "veo" | "grok" | undefined;

  console.log(
    `Starting video generation (${providerArg ?? "config provider"} — usually 1–3 min)…`,
  );
  const { operationName, keyIndex } = await startRecipeVideo({
    provider: providerArg,
    title: article.title || "this recipe",
    steps,
    ingredients: meta.topIngredients,
  });
  console.log(`Operation: ${operationName} (Gemini key #${keyIndex + 1})`);

  await pollUntilDone(operationName, keyIndex, `veo-test-${article.slug}`);
}

async function pollUntilDone(
  operationName: string,
  keyIndex: number,
  basename: string,
): Promise<void> {
  console.log(`Polling ${operationName} (Gemini key #${keyIndex + 1})…`);
  const deadlineMs = Date.now() + 9 * 60 * 1000;
  while (Date.now() < deadlineMs) {
    await new Promise((r) => setTimeout(r, 10_000));
    const res = await pollRecipeVideo(operationName, keyIndex);
    console.log(`  …${res.status}`);

    if (res.status === "succeeded") {
      const path = `${basename}.mp4`;
      await writeFile(path, res.data!);
      const mb = (res.data!.length / 1024 / 1024).toFixed(2);
      console.log(`\n✓ Reel saved: ${path} (${mb} MB)`);
      console.log(`  Open it with:  open ${path}`);
      process.exit(0);
    }
    if (res.status === "failed") {
      console.error(`\n✗ Veo generation failed: ${res.error}`);
      process.exit(1);
    }
  }

  console.error(`\n✗ Still processing after 9 min. Operation: ${operationName}`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
