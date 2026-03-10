/**
 * Test Script: Anthropic API (Step 1)
 * Run: npx tsx scripts/test-anthropic.ts
 *
 * Generates a short test recipe to verify the API key works.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import Anthropic from "@anthropic-ai/sdk";

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set in .env.local");
    process.exit(1);
  }

  console.log("Testing Anthropic API...");
  console.log(`Key prefix: ${apiKey.slice(0, 12)}...`);

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content:
          'Generate a JSON object with a "title" and "description" for a recipe about "honey garlic shrimp". Return only valid JSON, no markdown fences.',
      },
    ],
    system: "You are a recipe content generator. Return only valid JSON.",
  });

  const block = response.content[0];
  if (block.type !== "text") {
    console.error("Unexpected response type:", block.type);
    process.exit(1);
  }

  const parsed = JSON.parse(block.text);
  console.log("\nAnthropic API working! Response:");
  console.log(JSON.stringify(parsed, null, 2));
  console.log(
    `\nTokens used: ${response.usage.input_tokens} input, ${response.usage.output_tokens} output`,
  );
}

main().catch((err) => {
  console.error("Anthropic test failed:", err.message);
  process.exit(1);
});
