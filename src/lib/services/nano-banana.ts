import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKeys } from "@/lib/services/gemini-keys";

const MODEL = "gemini-2.5-flash-image";

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
  const keys = getGeminiApiKeys();
  let lastErr: unknown;

  // Rotate across configured keys so per-key image quota exhaustion doesn't
  // stall the pipeline.
  for (const [keyIndex, apiKey] of keys.entries()) {
    try {
      const ai = new GoogleGenAI({ apiKey });
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
    } catch (err) {
      lastErr = err;
      console.warn(
        `[nano-banana] Gemini key #${keyIndex + 1} image gen failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  throw lastErr;
}
