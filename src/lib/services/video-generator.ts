import { getConfigValue } from "@/lib/pipeline/base";
import { ConfigKeys, VIDEO_DEFAULTS } from "@/lib/constants";
import { startVeoVideo, pollVeoVideo } from "@/lib/services/veo";
import { startGrokVideo, pollGrokVideo } from "@/lib/services/grok-video";
import type {
  StartVideoParams,
  StartVideoResult,
  PollVideoResult,
} from "@/lib/services/video-prompt";

export type {
  StartVideoParams,
  StartVideoResult,
  PollVideoResult,
} from "@/lib/services/video-prompt";

// Provider-agnostic entry point for reel generation. Routes to Veo (Google) or
// Grok (xAI) based on the VIDEO_PROVIDER config. The stored task id is prefixed
// with the provider ("veo:" / "grok:") so cross-run polling routes back to the
// same backend even if the config is changed mid-flight.

/**
 * Start a reel with the currently-configured provider. Returns a provider-
 * prefixed operationName to persist, plus the key index (Veo only).
 */
export async function startRecipeVideo(
  params: StartVideoParams,
): Promise<StartVideoResult> {
  const provider =
    params.provider ??
    (await getConfigValue(ConfigKeys.VIDEO_PROVIDER, VIDEO_DEFAULTS.PROVIDER));

  if (provider === "grok") {
    const model = await getConfigValue(
      ConfigKeys.GROK_MODEL,
      VIDEO_DEFAULTS.GROK_MODEL,
    );
    const requestId = await startGrokVideo({ ...params, model });
    return { operationName: `grok:${requestId}`, keyIndex: 0 };
  }

  // Default: Veo
  const model = await getConfigValue(ConfigKeys.VEO_MODEL, VIDEO_DEFAULTS.MODEL);
  const { operationName, keyIndex } = await startVeoVideo({ ...params, model });
  return { operationName: `veo:${operationName}`, keyIndex };
}

/**
 * Poll a previously-started reel. Provider is read from the task-id prefix, so
 * this works regardless of the current VIDEO_PROVIDER setting. Task ids without
 * a known prefix are treated as legacy Veo operation names.
 */
export async function pollRecipeVideo(
  taskId: string,
  keyIndex: number,
): Promise<PollVideoResult> {
  const sep = taskId.indexOf(":");
  const provider = sep > 0 ? taskId.slice(0, sep) : "";
  const id = sep > 0 ? taskId.slice(sep + 1) : taskId;

  if (provider === "grok") return pollGrokVideo(id);
  if (provider === "veo") return pollVeoVideo(id, keyIndex);
  // Legacy / unprefixed → Veo operation name.
  return pollVeoVideo(taskId, keyIndex);
}
