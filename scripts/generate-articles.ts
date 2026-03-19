import { config } from "dotenv";
config({ path: ".env.local" });

import Anthropic from "@anthropic-ai/sdk";

const KEYWORDS = [
  "crockpot chicken tacos",
  "lemon butter salmon",  
  "banana oat muffins",
  "creamy chicken pasta",
  "ground beef stir fry"
];

const MODEL = "claude-sonnet-4-5-20250929";

async function generateArticle(keyword: string) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  
  console.log(`\n[${keyword}] Generating article...`);
  const start = Date.now();
  
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: "You are a recipe content generator. Return only valid JSON.",
    messages: [{
      role: "user",
      content: `Generate a JSON object for a recipe blog post about "${keyword}". Return ONLY valid JSON with these fields:
{
  "title": "SEO title (60 chars max)",
  "metaDescription": "Meta description (155 chars max)",
  "contentMdx": "Full blog article in MDX (minimum 800 words, use ## headings)",
  "recipeJsonLd": {
    "name": "Recipe name",
    "description": "Brief description",
    "prepTime": "PT15M",
    "cookTime": "PT30M",
    "totalTime": "PT45M",
    "recipeYield": "4 servings",
    "recipeCategory": "Main Course",
    "recipeCuisine": "American",
    "recipeIngredient": ["ingredient 1", "ingredient 2"],
    "recipeInstructions": [{"@type": "HowToStep", "name": "Step title", "text": "Step detail"}],
    "nutrition": {"@type": "NutritionInformation", "calories": "350 calories"}
  },
  "midjourneyPrompt": "A photorealistic food photography prompt for Midjourney (include --ar 2:3 --v 6)"
}

IMPORTANT: All content must be halal-compliant (no pork, alcohol). No markdown fences in response.`
    }]
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Bad response");

  // Strip markdown code fences if Claude wraps JSON in ```json ... ```
  let rawText = block.text.trim();
  if (rawText.startsWith("```")) {
    rawText = rawText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  const parsed = JSON.parse(rawText);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[${keyword}] Article done (${elapsed}s) - "${parsed.title}"`);
  console.log(`[${keyword}] Midjourney prompt: ${parsed.midjourneyPrompt?.slice(0, 80)}...`);
  console.log(`[${keyword}] Tokens: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`);
  
  return { keyword, ...parsed };
}

async function submitImage(prompt: string, keyword: string): Promise<string> {
  const res = await fetch("https://api.imaginepro.ai/api/v1/midjourney/imagine", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.IMAGINEAPI_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  if (!data.messageId) {
    console.error(`[${keyword}] Image submit failed:`, JSON.stringify(data));
    throw new Error(`No messageId returned for ${keyword}`);
  }
  return data.messageId;
}

async function pollImage(messageId: string, keyword: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 10000));
    const res = await fetch(`https://api.imaginepro.ai/api/v1/midjourney/message/${messageId}`, {
      headers: { Authorization: `Bearer ${process.env.IMAGINEAPI_TOKEN}` },
    });
    const data = await res.json();
    if (data.status === "DONE") {
      console.log(`[${keyword}] Image ready: ${data.images?.[0]}`);
      return data.images?.[0] || data.uri;
    }
    if (data.status === "FAIL") throw new Error("Image generation failed");
    console.log(`[${keyword}] Image: ${data.status} (${data.progress || 0}%)`);
  }
  throw new Error("Image generation timed out");
}

async function main() {
  console.log("=== Generating 5 articles from trending keywords ===\n");
  
  // Generate all articles in parallel
  console.log("--- Phase 1: Generating articles with Claude ---");
  const articles = await Promise.all(KEYWORDS.map(kw => generateArticle(kw)));
  
  // Submit all image jobs
  console.log("\n--- Phase 2: Submitting Midjourney image jobs ---");
  const imageJobs: { keyword: string; messageId: string; prompt: string }[] = [];
  for (const article of articles) {
    // Rate limit: 1 request per 5 seconds to avoid being throttled
    await new Promise(r => setTimeout(r, 5000));
    try {
      const messageId = await submitImage(article.midjourneyPrompt, article.keyword);
      console.log(`[${article.keyword}] Image job submitted: ${messageId}`);
      imageJobs.push({ keyword: article.keyword, messageId, prompt: article.midjourneyPrompt });
    } catch (err: any) {
      console.error(`[${article.keyword}] Skipping image: ${err.message}`);
    }
  }
  
  // Poll all images
  console.log("\n--- Phase 3: Waiting for Midjourney images ---");
  const imageResults = await Promise.all(
    imageJobs.map(job => pollImage(job.messageId, job.keyword))
  );
  
  // Summary
  console.log("\n=== RESULTS ===\n");
  for (let i = 0; i < articles.length; i++) {
    console.log(`${i + 1}. ${articles[i].title}`);
    console.log(`   Keyword: ${articles[i].keyword}`);
    console.log(`   Meta: ${articles[i].metaDescription}`);
    console.log(`   Image: ${imageResults[i]}`);
    console.log();
  }
  
  // Save results
  const results = articles.map((a, i) => ({ ...a, heroImageUrl: imageResults[i] }));
  const fs = await import("fs/promises");
  await fs.writeFile("/tmp/generated-articles.json", JSON.stringify(results, null, 2));
  console.log("Full results saved to /tmp/generated-articles.json");
}

main().catch(err => { console.error("FATAL:", err.message); process.exit(1); });
