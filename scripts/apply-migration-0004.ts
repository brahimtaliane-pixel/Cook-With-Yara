import { config } from "dotenv";
config({ path: ".env.local" });

import { readFile } from "fs/promises";
import { join } from "path";
import postgres from "postgres";

async function main() {
  const path = join(process.cwd(), "drizzle", "0004_video_pins.sql");
  const sqlText = await readFile(path, "utf-8");

  console.log(`Applying ${path}`);
  console.log("─".repeat(60));

  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: "require",
    max: 1,
    prepare: false,
  });

  try {
    // The migration is written with IF NOT EXISTS guards, so it's idempotent —
    // safe to re-run. Apply as a single transaction.
    await sql.begin(async (tx) => {
      await tx.unsafe(sqlText);
    });

    // Verify the new columns landed
    const articleCols = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'articles'
        AND column_name IN ('video_status', 'video_url', 'video_task_id',
                            'video_key_index', 'video_started_at', 'video_retry_count')
      ORDER BY column_name
    `;
    const pinCols = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'pin_queue'
        AND column_name IN ('media_type', 'video_url', 'cover_image_url', 'pinterest_media_id')
      ORDER BY column_name
    `;

    console.log(
      `\narticles video columns (${articleCols.length}/6): ${articleCols
        .map((c) => c.column_name)
        .join(", ")}`
    );
    console.log(
      `pin_queue video columns (${pinCols.length}/4): ${pinCols
        .map((c) => c.column_name)
        .join(", ")}`
    );

    if (articleCols.length === 6 && pinCols.length === 4) {
      console.log("\n✓ Migration applied successfully.");
    } else {
      console.warn("\n⚠ Some columns are missing — inspect the output above.");
    }
  } finally {
    await sql.end();
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
