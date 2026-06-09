-- Add article_number column to articles, backfilled in createdAt order,
-- then attach a Postgres IDENTITY sequence so future inserts auto-number.

ALTER TABLE "articles" ADD COLUMN "article_number" integer;

-- Backfill existing rows in chronological order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM articles
)
UPDATE articles
SET article_number = ordered.rn
FROM ordered
WHERE articles.id = ordered.id;

-- Create the identity sequence starting after the highest backfilled value
DO $$
DECLARE
  next_val integer;
BEGIN
  SELECT COALESCE(MAX(article_number), 0) + 1 INTO next_val FROM articles;
  EXECUTE format(
    'CREATE SEQUENCE IF NOT EXISTS articles_article_number_seq START WITH %s',
    next_val
  );
END $$;

-- Attach sequence as default + enforce NOT NULL
ALTER TABLE "articles"
  ALTER COLUMN "article_number" SET DEFAULT nextval('articles_article_number_seq'),
  ALTER COLUMN "article_number" SET NOT NULL;

ALTER SEQUENCE articles_article_number_seq OWNED BY articles.article_number;

-- Optional: index for the rare case we look up by number directly
CREATE INDEX IF NOT EXISTS "articles_article_number_idx" ON "articles" ("article_number");
