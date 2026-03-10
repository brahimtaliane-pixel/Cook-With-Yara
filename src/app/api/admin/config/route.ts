import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pipelineConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(pipelineConfig);
  const config: Record<string, string> = {};
  for (const row of rows) {
    config[row.key] = row.value;
  }
  return NextResponse.json({ config });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { config: Record<string, string> };

  if (!body.config || typeof body.config !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const entries = Object.entries(body.config);
  for (const [key, value] of entries) {
    const existing = await db
      .select()
      .from(pipelineConfig)
      .where(eq(pipelineConfig.key, key))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(pipelineConfig)
        .set({ value, updatedAt: new Date() })
        .where(eq(pipelineConfig.key, key));
    } else {
      await db.insert(pipelineConfig).values({ key, value });
    }
  }

  return NextResponse.json({ success: true });
}
