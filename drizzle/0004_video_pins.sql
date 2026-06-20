-- Video pins: Veo-generated recipe reels layered onto published articles,
-- plus video media support in the pin queue.

-- articles: video reel lifecycle (decoupled from the main article status machine)
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "video_status" text DEFAULT 'none' NOT NULL;
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "video_url" text;
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "video_task_id" text;
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "video_key_index" integer;
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "video_started_at" timestamp;
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "video_retry_count" integer DEFAULT 0 NOT NULL;

-- pin_queue: media type + video media references
ALTER TABLE "pin_queue" ADD COLUMN IF NOT EXISTS "media_type" text DEFAULT 'image' NOT NULL;
ALTER TABLE "pin_queue" ADD COLUMN IF NOT EXISTS "video_url" text;
ALTER TABLE "pin_queue" ADD COLUMN IF NOT EXISTS "cover_image_url" text;
ALTER TABLE "pin_queue" ADD COLUMN IF NOT EXISTS "pinterest_media_id" text;

-- Speeds up the "resume generating Veo ops" and "resume media_processing rows" scans
CREATE INDEX IF NOT EXISTS "articles_video_status_idx" ON "articles" ("video_status");
CREATE INDEX IF NOT EXISTS "pin_queue_media_type_status_idx" ON "pin_queue" ("media_type", "status");
