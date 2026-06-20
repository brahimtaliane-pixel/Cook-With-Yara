import { GoogleGenAI } from "@google/genai";
import type { GenerateVideosOperation } from "@google/genai";
import { getGeminiApiKeys } from "@/lib/services/gemini-keys";
import { VIDEO_DEFAULTS } from "@/lib/constants";

// Veo (Google) recipe-reel generation. Mirrors nano-banana.ts: rotates across
// the configured Gemini API keys. Unlike image gen, Veo is a long-running
// operation — startRecipeVideo kicks it off (returns immediately with the
// operation name) and pollRecipeVideo checks it on a later cron run.

export interface StartVideoParams {
  /** Public URL of the recipe hero image, used as the seed frame. */
  heroImageUrl: string;
  /** Recipe title / short descriptor, woven into the motion prompt. */
  title: string;
  model?: string;
  aspectRatio?: string;
  resolution?: string;
  durationSeconds?: number;
}

export interface StartVideoResult {
  operationName: string;
  /** Index into getGeminiApiKeys() — the op MUST be polled with the same key. */
  keyIndex: number;
}

export interface PollVideoResult {
  status: "processing" | "succeeded" | "failed";
  /** MP4 bytes, present only when status === "succeeded". */
  data?: Buffer;
  mimeType?: string;
  error?: string;
}

// Food-focused, halal-safe motion prompt. We seed from the already-vetted hero
// image so the dish stays consistent; the prompt only describes camera/motion.
function buildMotionPrompt(title: string): string {
  return [
    `Appetizing food video of ${title}.`,
    "Slow cinematic push-in, gentle rising steam, soft natural light,",
    "shallow depth of field, subtle glistening texture on the food.",
    "No people, no hands, no text overlays. Photoreal, mouth-watering.",
  ].join(" ");
}

const NEGATIVE_PROMPT =
  "people, hands, faces, text, watermark, logo, captions, blurry, distorted, low quality";

async function fetchImageBytes(
  url: string,
): Promise<{ imageBytes: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch hero image (${res.status}) from ${url}`);
  }
  const mimeType = res.headers.get("content-type") || "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
  return { imageBytes: buf.toString("base64"), mimeType };
}

/**
 * Kick off a Veo image-to-video generation. Returns the long-running operation
 * name plus the key index used (needed to poll with the same key). Rotates keys
 * on failure so one exhausted key doesn't stall the pipeline.
 */
export async function startRecipeVideo(
  params: StartVideoParams,
): Promise<StartVideoResult> {
  const keys = getGeminiApiKeys();
  const model = params.model ?? VIDEO_DEFAULTS.MODEL;
  const prompt = buildMotionPrompt(params.title);
  const image = await fetchImageBytes(params.heroImageUrl);

  let lastErr: unknown;
  for (const [keyIndex, apiKey] of keys.entries()) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const operation = await ai.models.generateVideos({
        model,
        prompt,
        image: { imageBytes: image.imageBytes, mimeType: image.mimeType },
        config: {
          numberOfVideos: 1,
          aspectRatio: params.aspectRatio ?? VIDEO_DEFAULTS.ASPECT_RATIO,
          resolution: params.resolution ?? VIDEO_DEFAULTS.RESOLUTION,
          durationSeconds:
            params.durationSeconds ?? VIDEO_DEFAULTS.DURATION_SECONDS,
          negativePrompt: NEGATIVE_PROMPT,
          personGeneration: "dont_allow",
        },
      });

      if (!operation.name) {
        throw new Error("Veo generateVideos returned no operation name");
      }
      return { operationName: operation.name, keyIndex };
    } catch (err) {
      lastErr = err;
      console.warn(
        `[veo] Gemini key #${keyIndex + 1} generateVideos failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  throw lastErr;
}

/**
 * Check a previously started Veo operation. When done, downloads the MP4 bytes.
 * Polled across cron runs by reconstructing the operation from its name — must
 * use the same API key that started it.
 */
export async function pollRecipeVideo(
  operationName: string,
  keyIndex: number,
): Promise<PollVideoResult> {
  const keys = getGeminiApiKeys();
  const apiKey = keys[keyIndex] ?? keys[0];
  if (!apiKey) throw new Error("No Gemini API key available to poll Veo op");

  const ai = new GoogleGenAI({ apiKey });

  // Reconstruct the operation from its name (only `name` is needed to refresh).
  const operation = await ai.operations.getVideosOperation({
    operation: { name: operationName } as GenerateVideosOperation,
  });

  if (!operation.done) {
    return { status: "processing" };
  }

  if (operation.error) {
    const message =
      (operation.error.message as string) || JSON.stringify(operation.error);
    return { status: "failed", error: message };
  }

  const video = operation.response?.generatedVideos?.[0]?.video;
  if (!video) {
    return { status: "failed", error: "Operation done but no video returned" };
  }

  const mimeType = video.mimeType || "video/mp4";

  // Prefer inline bytes; fall back to fetching the file URI with the API key.
  if (video.videoBytes) {
    return {
      status: "succeeded",
      data: Buffer.from(video.videoBytes, "base64"),
      mimeType,
    };
  }

  if (video.uri) {
    const res = await fetch(video.uri, {
      headers: { "x-goog-api-key": apiKey },
    });
    if (!res.ok) {
      return {
        status: "failed",
        error: `Failed to download video (${res.status}) from ${video.uri}`,
      };
    }
    return {
      status: "succeeded",
      data: Buffer.from(await res.arrayBuffer()),
      mimeType,
    };
  }

  return { status: "failed", error: "Video had neither bytes nor uri" };
}
