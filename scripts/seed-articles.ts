import { config } from "dotenv";
config({ path: ".env.local" });

import Anthropic from "@anthropic-ai/sdk";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { keywords, articles } from "../src/lib/db/schema";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(sql);

const RECIPES = [
  "crockpot chicken tacos",
  "lemon butter salmon",
  "banana oat muffins",
  "creamy chicken pasta",
  "ground beef stir fry",
];

// The 3 images we already generated from Midjourney
const IMAGES: Record<string, string> = {
  "crockpot chicken tacos":
    "https://images.imaginepro.ai/cdn-new/mj/1094fa94-b6e8-4c81-9fce-fbf7bac3a697.png?index=1",
  "lemon butter salmon":
    "https://images.imaginepro.ai/cdn-new/mj/5e5c10d6-f07a-43ea-ad6b-95b5982cdc6b.png?index=1",
  "banana oat muffins":
    "https://images.imaginepro.ai/cdn-new/mj/a4ca0b20-e05d-4539-85ad-e92424a4a855.png?index=1",
};

// Fallback food images for the 2 that ran out of credits
const FALLBACK_IMAGES: Record<string, string> = {
  "creamy chicken pasta":
    "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=1200&q=80",
  "ground beef stir fry":
    "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=1200&q=80",
};

function toSlug(kw: string): string {
  return kw.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

async function generateArticle(keyword: string) {
  console.log(`[${keyword}] Generating article...`);
  const start = Date.now();

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 8192,
    system: "You are a recipe content generator. Return only valid JSON, no markdown fences.",
    messages: [
      {
        role: "user",
        content: `Generate a JSON object for a recipe blog post about "${keyword}". Return ONLY valid JSON with these fields:
{
  "title": "SEO title (60 chars max)",
  "metaDescription": "Meta description (155 chars max)",
  "contentMdx": "Full blog article in MDX format. Minimum 800 words. Use ## headings for sections. Write as Lucia, a passionate home cook. Include personal tips, variations, storage instructions. Make it warm and engaging.",
  "recipeJsonLd": {
    "name": "Recipe name",
    "description": "Brief description",
    "prepTime": "PT15M",
    "cookTime": "PT30M",
    "totalTime": "PT45M",
    "recipeYield": "4 servings",
    "recipeCategory": "Main Course or Breakfast or Dessert etc",
    "recipeCuisine": "American",
    "recipeIngredient": ["1 cup ingredient", "2 tbsp ingredient"],
    "recipeInstructions": [{"@type": "HowToStep", "name": "Step title", "text": "Detailed step"}],
    "nutrition": {"@type": "NutritionInformation", "calories": "350 calories"}
  },
  "midjourneyPrompt": "A photorealistic food photography prompt for this dish --ar 2:3 --v 6"
}

IMPORTANT: All content must be halal-compliant (no pork, no alcohol). Do NOT wrap the JSON in markdown fences.`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Bad response");

  let text = block.text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  const parsed = JSON.parse(text);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[${keyword}] Done (${elapsed}s) — "${parsed.title}"`);
  return parsed;
}

async function main() {
  console.log("=== Generating & inserting 5 articles ===\n");

  for (const keyword of RECIPES) {
    try {
      const data = await generateArticle(keyword);
      const slug = toSlug(keyword);
      const heroImageUrl = IMAGES[keyword] || FALLBACK_IMAGES[keyword] || null;

      // Insert keyword first
      const [kw] = await db
        .insert(keywords)
        .values({
          keyword,
          trendType: "monthly",
          pinterestTrendScore: 80,
          status: "used",
        })
        .onConflictDoNothing()
        .returning();

      // Get keyword ID (may already exist)
      let keywordId = kw?.id;
      if (!keywordId) {
        const existing = await sql`SELECT id FROM keywords WHERE keyword = ${keyword}`;
        keywordId = existing[0]?.id;
      }

      if (!keywordId) {
        console.error(`[${keyword}] Could not get keyword ID, skipping`);
        continue;
      }

      // Upsert article
      await db
        .insert(articles)
        .values({
          keywordId,
          slug,
          title: data.title,
          metaDescription: data.metaDescription,
          contentMdx: data.contentMdx,
          recipeJsonLd: data.recipeJsonLd,
          heroImageUrl,
          midjourneyPrompt: data.midjourneyPrompt,
          status: "published",
          publishedAt: new Date(),
        })
        .onConflictDoNothing();

      console.log(`[${keyword}] Inserted as published — /recipes/${slug}`);
      if (heroImageUrl?.includes("imaginepro")) {
        console.log(`  Hero: Midjourney image`);
      } else {
        console.log(`  Hero: Unsplash fallback (Midjourney credits ran out)`);
      }
      console.log();
    } catch (err: any) {
      console.error(`[${keyword}] FAILED: ${err.message}`);
    }
  }

  console.log("Done! Check the site.");
  await sql.end();
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
