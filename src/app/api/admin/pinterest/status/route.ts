import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pipelineConfig } from "@/lib/db/schema";
import { ConfigKeys } from "@/lib/constants";
import { inArray } from "drizzle-orm";

export async function GET() {
  const keys = [
    ConfigKeys.PINTEREST_APP_ID,
    ConfigKeys.PINTEREST_APP_SECRET,
    ConfigKeys.PINTEREST_ACCESS_TOKEN,
    ConfigKeys.PINTEREST_TOKEN_EXPIRES_AT,
    ConfigKeys.PINTEREST_USER_NAME,
    ConfigKeys.PINTEREST_BOARDS,
    ConfigKeys.PINTEREST_BOARD_ID,
  ];

  const rows = await db
    .select()
    .from(pipelineConfig)
    .where(inArray(pipelineConfig.key, keys));

  const configMap: Record<string, string> = {};
  for (const row of rows) {
    configMap[row.key] = row.value;
  }

  const hasAppId = !!(configMap[ConfigKeys.PINTEREST_APP_ID] || process.env.PINTEREST_APP_ID);
  const hasAppSecret = !!(configMap[ConfigKeys.PINTEREST_APP_SECRET] || process.env.PINTEREST_APP_SECRET);
  const appConfigured = hasAppId && hasAppSecret;

  const connected = !!configMap[ConfigKeys.PINTEREST_ACCESS_TOKEN];
  const userName = configMap[ConfigKeys.PINTEREST_USER_NAME] ?? null;
  const selectedBoardId = configMap[ConfigKeys.PINTEREST_BOARD_ID] ?? null;
  const tokenExpiresAt = configMap[ConfigKeys.PINTEREST_TOKEN_EXPIRES_AT] ?? null;

  // Mask the stored values — just show whether they're set
  const savedAppId = configMap[ConfigKeys.PINTEREST_APP_ID] ?? "";
  const savedAppSecret = configMap[ConfigKeys.PINTEREST_APP_SECRET] ?? "";

  let boards: { id: string; name: string }[] = [];
  const boardsJson = configMap[ConfigKeys.PINTEREST_BOARDS];
  if (boardsJson) {
    try {
      boards = JSON.parse(boardsJson);
    } catch {
      boards = [];
    }
  }

  return NextResponse.json({
    appConfigured,
    savedAppId,
    savedAppSecret,
    connected,
    userName,
    selectedBoardId,
    boards,
    tokenExpiresAt,
  }, {
    headers: {
      "Cache-Control": "private, max-age=0, s-maxage=30, stale-while-revalidate=120",
    },
  });
}
