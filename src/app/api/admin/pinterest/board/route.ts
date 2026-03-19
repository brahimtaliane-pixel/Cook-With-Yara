import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pipelineConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ConfigKeys } from "@/lib/constants";

export async function POST(request: Request) {
  const body = (await request.json()) as { boardId: string };

  if (!body.boardId) {
    return NextResponse.json({ error: "boardId is required" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(pipelineConfig)
    .where(eq(pipelineConfig.key, ConfigKeys.PINTEREST_BOARD_ID))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(pipelineConfig)
      .set({ value: body.boardId, updatedAt: new Date() })
      .where(eq(pipelineConfig.key, ConfigKeys.PINTEREST_BOARD_ID));
  } else {
    await db
      .insert(pipelineConfig)
      .values({ key: ConfigKeys.PINTEREST_BOARD_ID, value: body.boardId });
  }

  return NextResponse.json({ success: true });
}
