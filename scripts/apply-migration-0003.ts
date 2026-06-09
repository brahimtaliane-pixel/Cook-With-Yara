import { config } from "dotenv";
config({ path: ".env.local" });

import { readFile } from "fs/promises";
import { join } from "path";
import postgres from "postgres";

async function main() {
  const path = join(process.cwd(), "drizzle", "0003_add_article_numbers.sql");
  const sqlText = await readFile(path, "utf-8");

  console.log(`Applying ${path}`);
  console.log("─".repeat(60));

  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: "require",
    max: 1,
    prepare: false,
  });

  try {
    // Pre-flight: confirm we're hitting a populated articles table
    const [{ count }] = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM articles
    `;
    console.log(`Found ${count} existing articles to backfill`);

    // Check if column already exists (idempotency guard)
    const cols = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'articles' AND column_name = 'article_number'
    `;
    if (cols.length > 0) {
      console.log("article_number column already exists — skipping migration.");
      await sql.end();
      process.exit(0);
    }

    // Apply the migration as a single transaction
    await sql.begin(async (tx) => {
      await tx.unsafe(sqlText);
    });

    // Verify
    const sample = await sql<
      { article_number: number; created_at: Date; title: string | null }[]
    >`
      SELECT article_number, created_at, title FROM articles
      ORDER BY article_number ASC LIMIT 3
    `;
    const last = await sql<
      { article_number: number; created_at: Date; title: string | null }[]
    >`
      SELECT article_number, created_at, title FROM articles
      ORDER BY article_number DESC LIMIT 3
    `;
    const nextval = await sql<{ nextval: string }[]>`
      SELECT nextval('articles_article_number_seq')::text AS nextval
    `;
    // setval back so we don't consume one
    await sql`SELECT setval('articles_article_number_seq', ${parseInt(nextval[0].nextval, 10) - 1}, true)`;

    console.log("\nFirst 3 articles by number:");
    for (const r of sample) {
      console.log(`  N°${String(r.article_number).padStart(3, "0")}  ${r.created_at.toISOString().slice(0, 10)}  ${(r.title ?? "(no title)").slice(0, 60)}`);
    }
    console.log("\nLast 3 articles by number:");
    for (const r of last) {
      console.log(`  N°${String(r.article_number).padStart(3, "0")}  ${r.created_at.toISOString().slice(0, 10)}  ${(r.title ?? "(no title)").slice(0, 60)}`);
    }
    console.log(`\nSequence will next assign: ${nextval[0].nextval}`);
    console.log("\n✓ Migration applied successfully.");
  } finally {
    await sql.end();
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
