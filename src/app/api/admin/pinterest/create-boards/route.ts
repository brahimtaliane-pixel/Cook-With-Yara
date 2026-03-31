import { NextResponse } from "next/server";
import { ensureBoards } from "@/lib/services/pinterest-boards";

export async function POST() {
  try {
    const boardMap = await ensureBoards();
    return NextResponse.json({ success: true, boards: boardMap });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
