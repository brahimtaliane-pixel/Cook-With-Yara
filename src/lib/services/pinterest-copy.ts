import { GoogleGenAI } from "@google/genai";
import { buildPinterestCopyPrompt } from "@/lib/utils/prompts";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

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

  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: "You write Pinterest pin copy. Return only valid JSON.",
      responseMimeType: "application/json",
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const text = response.text ?? "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned) as PinterestCopy;

  return {
    pinterestTitle: (parsed.pinterestTitle || "").slice(0, 100),
    pinterestDescription: (parsed.pinterestDescription || "").slice(0, 500),
    altText: (parsed.altText || "").slice(0, 200),
  };
}
