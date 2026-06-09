import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { pipelineRuns, articles, keywords, pinQueue, intelPins } from "../src/lib/db/schema";
import { sql, gte, desc } from "drizzle-orm";

async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t = Date.now();
  const r = await fn();
  console.log(`  ${label.padEnd(45)} ${((Date.now() - t)).toString().padStart(5)}ms`);
  return r;
}

async function main() {
  console.log("=== Row counts ===");
  await time("pipeline_runs total", async () =>
    db.select({ n: sql<number>`count(*)::int` }).from(pipelineRuns)
      .then(([r]) => console.log(`    pipeline_runs: ${r.n.toLocaleString()}`)));
  await time("articles total", async () =>
    db.select({ n: sql<number>`count(*)::int` }).from(articles)
      .then(([r]) => console.log(`    articles: ${r.n}`)));
  await time("pin_queue total", async () =>
    db.select({ n: sql<number>`count(*)::int` }).from(pinQueue)
      .then(([r]) => console.log(`    pin_queue: ${r.n}`)));
  await time("intel_pins total", async () =>
    db.select({ n: sql<number>`count(*)::int` }).from(intelPins)
      .then(([r]) => console.log(`    intel_pins: ${r.n.toLocaleString()}`)));

  console.log("\n=== Reproduce /api/admin/stats queries ===");
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  await time("articleStats (counts+filters)", async () => {
    await db.select({
      total: sql<number>`count(*)::int`,
      published: sql<number>`count(*) filter (where status = 'published')::int`,
      drafts: sql<number>`count(*) filter (where status = 'draft')::int`,
      failed: sql<number>`count(*) filter (where status = 'failed')::int`,
    }).from(articles);
  });

  await time("pinStats (7 filtered counts)", async () => {
    await db.select({
      posted: sql<number>`count(*) filter (where status = 'posted')::int`,
      pending: sql<number>`count(*) filter (where status = 'pending')::int`,
      failed: sql<number>`count(*) filter (where status = 'failed')::int`,
    }).from(pinQueue);
  });

  await time("kwCount", async () => {
    await db.select({ n: sql<number>`count(*)::int` }).from(keywords);
  });

  await time("recentRuns (limit 10)", async () => {
    await db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.startedAt)).limit(10);
  });

  await time("todayRunsSummary (group by job)", async () => {
    await db.select({
      jobName: pipelineRuns.jobName,
      runs: sql<number>`count(*)::int`,
    }).from(pipelineRuns)
      .where(gte(pipelineRuns.startedAt, todayStart))
      .groupBy(pipelineRuns.jobName);
  });

  console.log("\n=== Index check on pipelineRuns ===");
  const idx = await db.execute(sql`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'pipeline_runs'`);
  for (const row of idx) console.log(`  ${row.indexname}: ${row.indexdef}`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
