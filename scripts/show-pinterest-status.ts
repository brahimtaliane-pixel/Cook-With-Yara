import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { pipelineConfig, pinQueue, articles } from "../src/lib/db/schema";
import { ConfigKeys } from "../src/lib/constants";
import { eq, sql, desc, isNotNull } from "drizzle-orm";

async function main() {
  const cfgRows = await db
    .select()
    .from(pipelineConfig)
    .where(
      sql`${pipelineConfig.key} in (
        ${ConfigKeys.PINTEREST_USER_NAME},
        ${ConfigKeys.PINTEREST_ACCESS_TOKEN},
        ${ConfigKeys.PINTEREST_TOKEN_EXPIRES_AT},
        ${ConfigKeys.PINTEREST_BOARD_MAP}
      )`
    );
  const cfg: Record<string, string> = {};
  for (const r of cfgRows) cfg[r.key] = r.value;

  const userName = cfg[ConfigKeys.PINTEREST_USER_NAME] ?? null;
  const hasToken = !!cfg[ConfigKeys.PINTEREST_ACCESS_TOKEN];
  const expiresAt = cfg[ConfigKeys.PINTEREST_TOKEN_EXPIRES_AT];
  const boardMap = cfg[ConfigKeys.PINTEREST_BOARD_MAP]
    ? (JSON.parse(cfg[ConfigKeys.PINTEREST_BOARD_MAP]) as Record<string, string>)
    : {};

  console.log("=== Pinterest connection ===");
  console.log(`  username:    ${userName ? "@" + userName : "(not connected)"}`);
  console.log(`  token set:   ${hasToken ? "yes" : "no"}`);
  console.log(`  expires at:  ${expiresAt ?? "(unknown)"}`);
  if (userName) {
    console.log(`  profile URL: https://www.pinterest.com/${userName}/`);
  }

  console.log("\n=== Boards (auto-created) ===");
  if (Object.keys(boardMap).length === 0) {
    console.log("  (none — boards get created on first publish)");
  } else {
    for (const [name, id] of Object.entries(boardMap)) {
      console.log(`  ${name.padEnd(36)} ${id}`);
    }
  }

  console.log("\n=== Pin queue status (lifetime) ===");
  const [counts] = await db
    .select({
      posted: sql<number>`count(*) filter (where status = 'posted')::int`,
      pending: sql<number>`count(*) filter (where status = 'pending')::int`,
      posting: sql<number>`count(*) filter (where status = 'posting')::int`,
      failed: sql<number>`count(*) filter (where status = 'failed')::int`,
    })
    .from(pinQueue);
  console.log(`  posted:  ${counts.posted}`);
  console.log(`  pending: ${counts.pending}`);
  console.log(`  posting: ${counts.posting}`);
  console.log(`  failed:  ${counts.failed}`);

  console.log("\n=== Last 10 posted pins ===");
  const recent = await db
    .select({
      pinterestPinId: pinQueue.pinterestPinId,
      title: pinQueue.title,
      boardId: pinQueue.boardId,
      postedAt: pinQueue.postedAt,
      pinType: pinQueue.pinType,
      articleId: pinQueue.articleId,
    })
    .from(pinQueue)
    .where(
      sql`${pinQueue.status} = 'posted' and ${pinQueue.pinterestPinId} is not null`
    )
    .orderBy(desc(pinQueue.postedAt))
    .limit(10);

  if (recent.length === 0) {
    console.log("  (no pins posted yet)");
  } else {
    // Reverse-lookup board names
    const idToName = new Map<string, string>();
    for (const [name, id] of Object.entries(boardMap)) idToName.set(id, name);

    for (const p of recent) {
      const when = p.postedAt?.toISOString().replace("T", " ").slice(0, 16) ?? "?";
      const boardName = idToName.get(p.boardId ?? "") ?? p.boardId ?? "?";
      console.log(`  [${when}] ${p.pinType.padEnd(10)} ${boardName.padEnd(28)} https://www.pinterest.com/pin/${p.pinterestPinId}/`);
      console.log(`           ${p.title.slice(0, 90)}`);
    }
  }

  console.log("\n=== Last 5 failed pins ===");
  const failed = await db
    .select({
      id: pinQueue.id,
      title: pinQueue.title,
      failureReason: pinQueue.failureReason,
      retryCount: pinQueue.retryCount,
      scheduledAt: pinQueue.scheduledAt,
    })
    .from(pinQueue)
    .where(eq(pinQueue.status, "failed"))
    .orderBy(desc(pinQueue.scheduledAt))
    .limit(5);

  if (failed.length === 0) {
    console.log("  (no failures)");
  } else {
    for (const f of failed) {
      console.log(`  ×${f.retryCount}  ${f.title.slice(0, 60)}`);
      console.log(`         ${(f.failureReason ?? "?").slice(0, 200)}`);
    }
  }

  console.log("\n=== Published articles linked to pins ===");
  const [{ count: publishedArticles }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(articles)
    .where(eq(articles.status, "published"));
  const [{ count: articlesWithPostedPins }] = await db
    .select({ count: sql<number>`count(distinct ${pinQueue.articleId})::int` })
    .from(pinQueue)
    .where(
      sql`${pinQueue.status} = 'posted' and ${pinQueue.articleId} is not null`
    );
  console.log(`  published articles:        ${publishedArticles}`);
  console.log(`  articles with posted pins: ${articlesWithPostedPins}`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
