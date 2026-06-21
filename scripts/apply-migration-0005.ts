import { config } from "dotenv";
config({ path: ".env.local" });

import { readFile } from "fs/promises";
import { join } from "path";
import postgres from "postgres";

async function main() {
  const path = join(process.cwd(), "drizzle", "0005_second_recipe_image.sql");
  const sqlText = await readFile(path, "utf-8");

  console.log(`Applying ${path}`);
  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: "require",
    max: 1,
    prepare: false,
  });

  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(sqlText);
    });
    const cols = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'articles' AND column_name = 'hero_image_url_2'
    `;
    console.log(
      cols.length === 1
        ? "✓ hero_image_url_2 column present."
        : "⚠ column missing — inspect output.",
    );
  } finally {
    await sql.end();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
