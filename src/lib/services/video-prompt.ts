// Shared types + prompt for recipe-reel generation, used by every video
// backend (Veo, Grok). Keeps the "how it's made" guide identical across
// providers so switching VIDEO_PROVIDER only changes the engine, not the style.

export interface StartVideoParams {
  /** Force a backend, overriding the VIDEO_PROVIDER config (used for testing). */
  provider?: "veo" | "grok";
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
  /** Provider-prefixed task handle, e.g. "veo:models/.../operations/x" or "grok:<uuid>". */
  operationName: string;
  /** Index into getGeminiApiKeys() for Veo (must poll with same key); 0 otherwise. */
  keyIndex: number;
}

export interface PollVideoResult {
  status: "processing" | "succeeded" | "failed";
  /** MP4 bytes, present only when status === "succeeded". */
  data?: Buffer;
  mimeType?: string;
  error?: string;
}

// A short "how it's made" guide prompt built from the recipe's actual steps.
// Text-to-video: we want the cooking process, not a static finished plate.
// Hands preparing food are wanted; faces/people are not.
export function buildGuidePrompt(
  title: string,
  steps: string[],
  ingredients: string[],
): string {
  // Keep it to a handful of beats — a short reel can only show so much.
  const beats = (steps.length ? steps : ingredients).slice(0, 5);
  const sequence = beats.length
    ? ` Show these steps in quick succession: ${beats.join("; ")}.`
    : "";
  return [
    `Fast-paced overhead cooking tutorial showing how to make ${title}.`,
    sequence,
    "Close-up top-down shots of hands preparing fresh ingredients on a clean",
    "kitchen counter, bright natural daylight, appetizing and photoreal, quick",
    "cuts between steps, ending on the finished dish.",
    // Audio: a female voiceover narrates the steps.
    "A warm, friendly woman's voice narrates the steps in a clear, upbeat tone.",
    "No faces on camera, no on-screen text.",
  ].join(" ");
}

export const NEGATIVE_PROMPT =
  "faces, people staring at camera, text overlay, captions, watermark, logo, " +
  "extra fingers, deformed hands, blurry, distorted, low quality";
