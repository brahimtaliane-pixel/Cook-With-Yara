CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"keyword_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text,
	"meta_description" text,
	"content_mdx" text,
	"recipe_json_ld" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"failure_reason" text,
	"hero_image_url" text,
	"midjourney_task_id" text,
	"midjourney_prompt" text,
	"pin_image_url" text,
	"pin_image_url_2" text,
	"canva_design_id" text,
	"pinterest_pin_id" text,
	"published_url" text,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "intel_competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"profile_image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "intel_competitors_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "intel_pins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pin_id" text NOT NULL,
	"competitor_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image_url" text NOT NULL,
	"link_url" text DEFAULT '' NOT NULL,
	"domain" text DEFAULT '' NOT NULL,
	"saves" integer DEFAULT 0 NOT NULL,
	"repins" integer DEFAULT 0 NOT NULL,
	"velocity" integer DEFAULT 0 NOT NULL,
	"creator_name" text DEFAULT '' NOT NULL,
	"creator_followers" integer DEFAULT 0 NOT NULL,
	"board_name" text DEFAULT '' NOT NULL,
	"pin_created_at" timestamp,
	"source" text DEFAULT 'rss' NOT NULL,
	"sent_to_pipeline" boolean DEFAULT false NOT NULL,
	"pipeline_keyword_id" uuid,
	"last_enriched_at" timestamp,
	"discovered_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "intel_pins_pin_id_unique" UNIQUE("pin_id")
);
--> statement-breakpoint
CREATE TABLE "keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"keyword" text NOT NULL,
	"region" text DEFAULT 'US' NOT NULL,
	"trend_type" text NOT NULL,
	"pinterest_trend_score" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"failure_reason" text,
	"discovered_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "keywords_keyword_unique" UNIQUE("keyword")
);
--> statement-breakpoint
CREATE TABLE "pipeline_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_name" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"status" text DEFAULT 'running' NOT NULL,
	"items_processed" integer DEFAULT 0 NOT NULL,
	"error_log" text
);
--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intel_pins" ADD CONSTRAINT "intel_pins_competitor_id_intel_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."intel_competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intel_pins" ADD CONSTRAINT "intel_pins_pipeline_keyword_id_keywords_id_fk" FOREIGN KEY ("pipeline_keyword_id") REFERENCES "public"."keywords"("id") ON DELETE no action ON UPDATE no action;