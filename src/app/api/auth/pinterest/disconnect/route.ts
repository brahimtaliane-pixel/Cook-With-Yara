import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pipelineConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ConfigKeys } from "@/lib/constants";

const PINTEREST_KEYS = [
  ConfigKeys.PINTEREST_ACCESS_TOKEN,
  ConfigKeys.PINTEREST_REFRESH_TOKEN,
  ConfigKeys.PINTEREST_TOKEN_EXPIRES_AT,
  ConfigKeys.PINTEREST_USER_NAME,
  ConfigKeys.PINTEREST_BOARDS,
  ConfigKeys.PINTEREST_BOARD_ID,
];

export async function POST() {
  for (const key of PINTEREST_KEYS) {
    await db.delete(pipelineConfig).where(eq(pipelineConfig.key, key));
  }
  return NextResponse.json({ success: true });
}
