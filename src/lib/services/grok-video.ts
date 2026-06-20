import { VIDEO_DEFAULTS } from "@/lib/constants";
import {
  buildGuidePrompt,
  type StartVideoParams,
  type PollVideoResult,
} from "@/lib/services/video-prompt";

// Grok Imagine (xAI) recipe-reel backend. Text-to-video over the xAI REST API.
// Async like Veo: POST returns a request_id, GET polls until status "done",
// then we download the (temporary) video URL. Routed via video-generator.ts.

const XAI_BASE = "https://api.x.ai/v1";

function getXaiKey(): string {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY is not set");
  return key;
}

/**
 * Kick off a Grok Imagine text-to-video generation. Returns the request_id to
 * poll later. xAI uses a single API key (no rotation).
 */
export async function startGrokVideo(params: StartVideoParams): Promise<string> {
  const prompt = buildGuidePrompt(
    params.title,
    params.steps ?? [],
    params.ingredients ?? [],
  );

  const res = await fetch(`${XAI_BASE}/videos/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getXaiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model ?? VIDEO_DEFAULTS.GROK_MODEL,
      prompt,
      duration: params.durationSeconds ?? VIDEO_DEFAULTS.DURATION_SECONDS,
      aspect_ratio: params.aspectRatio ?? VIDEO_DEFAULTS.ASPECT_RATIO,
      resolution: params.resolution ?? VIDEO_DEFAULTS.RESOLUTION,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Grok video generation failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { request_id?: string };
  if (!data.request_id) {
    throw new Error("Grok video generation returned no request_id");
  }
  return data.request_id;
}

/**
 * Poll a Grok video request. When done, downloads the temporary video URL into
 * a Buffer (xAI notes these URLs are short-lived, so we fetch promptly).
 */
export async function pollGrokVideo(
  requestId: string,
): Promise<PollVideoResult> {
  const res = await fetch(`${XAI_BASE}/videos/${requestId}`, {
    headers: { Authorization: `Bearer ${getXaiKey()}` },
  });

  if (!res.ok) {
    const body = await res.text();
    return {
      status: "failed",
      error: `Grok poll failed (${res.status}): ${body}`,
    };
  }

  const data = (await res.json()) as {
    status: string;
    video?: { url?: string };
  };

  if (data.status === "pending") return { status: "processing" };
  if (data.status === "failed" || data.status === "expired") {
    return { status: "failed", error: `Grok status: ${data.status}` };
  }
  if (data.status !== "done") return { status: "processing" };

  const url = data.video?.url;
  if (!url) {
    return { status: "failed", error: "Grok done but no video url" };
  }

  const v = await fetch(url);
  if (!v.ok) {
    return {
      status: "failed",
      error: `Failed to download Grok video (${v.status})`,
    };
  }
  return {
    status: "succeeded",
    data: Buffer.from(await v.arrayBuffer()),
    mimeType: "video/mp4",
  };
}
