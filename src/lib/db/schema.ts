import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const keywords = pgTable("keywords", {
  id: uuid("id").defaultRandom().primaryKey(),
  keyword: text("keyword").unique().notNull(),
  region: text("region").default("US").notNull(),
  trendType: text("trend_type").notNull(), // growing | monthly | yearly
  pinterestTrendScore: integer("pinterest_trend_score").default(0).notNull(),
  status: text("status").default("new").notNull(),
  retryCount: integer("retry_count").default(0).notNull(),
  failureReason: text("failure_reason"),
  discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const articles = pgTable("articles", {
  id: uuid("id").defaultRandom().primaryKey(),
  keywordId: uuid("keyword_id")
    .references(() => keywords.id)
    .notNull(),
  slug: text("slug").unique().notNull(),
  title: text("title"),
  metaDescription: text("meta_description"),
  contentMdx: text("content_mdx"),
  recipeJsonLd: jsonb("recipe_json_ld"),
  status: text("status").default("draft").notNull(),
  retryCount: integer("retry_count").default(0).notNull(),
  failureReason: text("failure_reason"),
  heroImageUrl: text("hero_image_url"),
  midjourneyTaskId: text("midjourney_task_id"),
  midjourneyPrompt: text("midjourney_prompt"),
  pinImageUrl: text("pin_image_url"),
  canvaDesignId: text("canva_design_id"),
  pinterestPinId: text("pinterest_pin_id"),
  publishedUrl: text("published_url"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pipelineRuns = pgTable("pipeline_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobName: text("job_name").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
  status: text("status").default("running").notNull(),
  itemsProcessed: integer("items_processed").default(0).notNull(),
  errorLog: text("error_log"),
});

export const pipelineConfig = pgTable("pipeline_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Type exports
export type Keyword = typeof keywords.$inferSelect;
export type NewKeyword = typeof keywords.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type PipelineRun = typeof pipelineRuns.$inferSelect;
export type PipelineConfig = typeof pipelineConfig.$inferSelect;
