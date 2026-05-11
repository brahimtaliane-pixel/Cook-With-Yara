import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-2.5-flash-image";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

export interface GeneratedImage {
  data: Buffer;
  mimeType: string;
}

// Strip Midjourney-specific tail flags (--ar, --style, --v, --niji, --chaos, --stylize, --quality, --s, --q, --no, --seed)
// since they're prompt-noise to Gemini.
function stripMidjourneyFlags(prompt: string): string {
  return prompt
    .replace(/\s--\w+(?:\s+[^\s-]+)?/g, "")
    .trim();
}

export async function generateHeroImage(prompt: string): Promise<GeneratedImage> {
  const cleanPrompt = stripMidjourneyFlags(prompt);
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: cleanPrompt,
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData;
    if (inline?.data && inline.mimeType?.startsWith("image/")) {
      return {
        data: Buffer.from(inline.data, "base64"),
        mimeType: inline.mimeType,
      };
    }
  }

  throw new Error("Gemini image response contained no image data");
}
