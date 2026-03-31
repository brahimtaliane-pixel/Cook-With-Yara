-- Pinterest Growth Engine migration
-- Adds Phase 1-4 schema changes

ALTER TABLE "pin_queue" ADD COLUMN "alt_text" text;
ALTER TABLE "pin_queue" ADD COLUMN "pin_type" text DEFAULT 'original' NOT NULL;
ALTER TABLE "pin_queue" ADD COLUMN "performance_score" integer;

ALTER TABLE "articles" ADD COLUMN "recycle_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "articles" ADD COLUMN "last_recycled_at" timestamp;

CREATE TABLE IF NOT EXISTS "pin_analytics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pin_queue_id" uuid NOT NULL REFERENCES "pin_queue"("id"),
  "pinterest_pin_id" text NOT NULL,
  "impressions" integer DEFAULT 0 NOT NULL,
  "saves" integer DEFAULT 0 NOT NULL,
  "clicks" integer DEFAULT 0 NOT NULL,
  "closeups" integer DEFAULT 0 NOT NULL,
  "snapshot_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pin_queue_pin_type ON pin_queue(pin_type);
CREATE INDEX IF NOT EXISTS idx_articles_recycle ON articles(status, recycle_count, last_recycled_at);
