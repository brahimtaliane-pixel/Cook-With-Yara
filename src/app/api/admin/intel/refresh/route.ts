import { NextResponse } from "next/server";
import { refreshAll } from "@/lib/pipeline/intel-refresh";

export const maxDuration = 300; // 5 minutes — deep scrapes need time

export async function POST() {
  try {
    const result = await refreshAll();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[intel-refresh] Manual refresh failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
