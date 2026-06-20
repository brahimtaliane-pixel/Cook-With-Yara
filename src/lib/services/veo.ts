import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";
import { getGeminiApiKeys } from "@/lib/services/gemini-keys";
import { VIDEO_DEFAULTS } from "@/lib/constants";
import {
  buildGuidePrompt,
  NEGATIVE_PROMPT,
  type StartVideoParams,
  type StartVideoResult,
  type PollVideoResult,
} from "@/lib/services/video-prompt";

// Veo (Google) recipe-reel backend. Mirrors nano-banana.ts: rotates across the
// configured Gemini API keys. Veo is a long-running operation — startVeoVideo
// kicks it off (returns immediately with the operation name) and pollVeoVideo
// checks it on a later cron run. Routed via video-generator.ts.

/**
 * Kick off a Veo text-to-video generation of a short recipe how-to guide.
 * Returns the long-running operation name plus the key index used (needed to
 * poll with the same key). Rotates keys on failure so one exhausted key doesn't
 * stall the pipeline.
 */
export async function startVeoVideo(
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
export async function pollVeoVideo(
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
