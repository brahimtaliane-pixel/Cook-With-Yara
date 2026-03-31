import Anthropic from "@anthropic-ai/sdk";
import { buildPinterestCopyPrompt } from "@/lib/utils/prompts";

const anthropic = new Anthropic();

export interface PinterestCopy {
  pinterestTitle: string;
  pinterestDescription: string;
  altText: string;
}

export interface PinterestCopyInput {
  title: string;
  metaDescription: string;
  keyword: string;
  recipeCategory: string;
  topIngredients: string[];
  isRecycled?: boolean;
}

export async function generatePinterestCopy(
  input: PinterestCopyInput
): Promise<PinterestCopy> {
  const prompt = buildPinterestCopyPrompt(input);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Strip markdown fences if present
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned) as PinterestCopy;

  // Enforce character limits
  return {
    pinterestTitle: (parsed.pinterestTitle || "").slice(0, 100),
    pinterestDescription: (parsed.pinterestDescription || "").slice(0, 500),
    altText: (parsed.altText || "").slice(0, 200),
  };
}
