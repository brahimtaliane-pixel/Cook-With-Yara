import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";
import { getGeminiApiKeys } from "@/lib/services/gemini-keys";
import { VIDEO_DEFAULTS } from "@/lib/constants";

// Veo (Google) recipe-reel generation. Mirrors nano-banana.ts: rotates across
// the configured Gemini API keys. Unlike image gen, Veo is a long-running
// operation — startRecipeVideo kicks it off (returns immediately with the
// operation name) and pollRecipeVideo checks it on a later cron run.

export interface StartVideoParams {
  /** Recipe title — anchors the guide. */
  title: string;
  /** Ordered cooking steps (short labels) — the spine of the how-to montage. */
  steps?: string[];
  /** Key ingredients, used when steps are sparse. */
  ingredients?: string[];
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

// Build a short "how it's made" guide prompt from the recipe's actual steps.
// This is text-to-video (no seed image): seeding from the finished-dish hero
// would just animate the final plate, the opposite of showing the process.
// Hands preparing food are wanted; faces/people are not.
function buildGuidePrompt(
  title: string,
  steps: string[],
  ingredients: string[],
): string {
  // Keep it to a handful of beats — an 8s reel can only show so much.
  const beats = (steps.length ? steps : ingredients).slice(0, 5);
  const sequence = beats.length
    ? ` Show these steps in quick succession: ${beats.join("; ")}.`
    : "";
  return [
    `Fast-paced overhead cooking tutorial showing how to make ${title}.`,
    sequence,
    "Close-up top-down shots of hands preparing fresh ingredients on a clean",
    "kitchen counter, bright natural daylight, appetizing and photoreal, quick",
    "cuts between steps, ending on the finished dish. No faces, no text overlays.",
  ].join(" ");
}

const NEGATIVE_PROMPT =
  "faces, people staring at camera, text overlay, captions, watermark, logo, " +
  "extra fingers, deformed hands, blurry, distorted, low quality";

/**
 * Kick off a Veo text-to-video generation of a short recipe how-to guide.
 * Returns the long-running operation name plus the key index used (needed to
 * poll with the same key). Rotates keys on failure so one exhausted key doesn't
 * stall the pipeline.
 */
export async function startRecipeVideo(
  params: StartVideoParams,
): Promise<StartVideoResult> {
  const keys = getGeminiApiKeys();
  const model = params.model ?? VIDEO_DEFAULTS.MODEL;
  const prompt = buildGuidePrompt(
    params.title,
    params.steps ?? [],
    params.ingredients ?? [],
  );

  let lastErr: unknown;
  for (const [keyIndex, apiKey] of keys.entries()) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const operation = await ai.models.generateVideos({
        model,
        prompt,
        config: {
          numberOfVideos: 1,
          aspectRatio: params.aspectRatio ?? VIDEO_DEFAULTS.ASPECT_RATIO,
          resolution: params.resolution ?? VIDEO_DEFAULTS.RESOLUTION,
          durationSeconds:
            params.durationSeconds ?? VIDEO_DEFAULTS.DURATION_SECONDS,
          negativePrompt: NEGATIVE_PROMPT,
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

  // Reconstruct the operation from its name. getVideosOperation only reads
  // `operation.name`, but it also calls `operation._fromAPIResponse(...)`, so we
  // need a real GenerateVideosOperation instance (not a plain object).
  const op = new GenerateVideosOperation();
  op.name = operationName;
  const operation = await ai.operations.getVideosOperation({ operation: op });

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
