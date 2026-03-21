import { type CreatePinParams, createPin } from "@/lib/services/pinterest";
import { createPinDirect } from "@/lib/services/pinterest-direct";
import { getConfigValue } from "@/lib/pipeline/base";
import { ConfigKeys } from "@/lib/constants";
import { db } from "@/lib/db";
import { pipelineConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface PostPinResult {
  pinId: string;
  mode: "api" | "direct";
}

export async function postPin(params: CreatePinParams): Promise<PostPinResult> {
  const mode = await getConfigValue(ConfigKeys.PINTEREST_MODE, "api");

  if (mode === "direct") {
    const rows = await db
      .select()
      .from(pipelineConfig)
      .where(eq(pipelineConfig.key, ConfigKeys.PINTEREST_SESSION_COOKIE))
      .limit(1);
    const sessionCookie = rows[0]?.value;
    if (!sessionCookie) {
      throw new Error(
        "Pinterest session cookie not configured. Go to Admin > Config to set it.",
      );
    }

    const result = await createPinDirect(
      {
        boardId: params.boardId,
        title: params.title,
        description: params.description,
        imageUrl: params.imageUrl,
        link: params.link,
      },
      sessionCookie,
    );
    return { pinId: result.pinId, mode: "direct" };
  } else {
    const pin = await createPin(params);
    return { pinId: pin.id, mode: "api" };
  }
}
