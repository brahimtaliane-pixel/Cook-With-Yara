import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
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
  articleNumber: integer("article_number")
    .notNull()
    .generatedByDefaultAsIdentity({ name: "articles_article_number_seq" }),
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
  pinImageUrl2: text("pin_image_url_2"),
  canvaDesignId: text("canva_design_id"),
  pinterestPinId: text("pinterest_pin_id"),
  publishedUrl: text("published_url"),
  publishedAt: timestamp("published_at"),
  recycleCount: integer("recycle_count").default(0).notNull(),
  lastRecycledAt: timestamp("last_recycled_at"),
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

// === Intel Tables ===

export const intelCompetitors = pgTable("intel_competitors", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").unique().notNull(),
  displayName: text("display_name").notNull(),
  profileImageUrl: text("profile_image_url"),
  isActive: boolean("is_active").default(true).notNull(),
  lastFetchedAt: timestamp("last_fetched_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const intelPins = pgTable("intel_pins", {
  id: uuid("id").defaultRandom().primaryKey(),
  pinId: text("pin_id").unique().notNull(),
  competitorId: uuid("competitor_id").references(() => intelCompetitors.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull(),
  description: text("description").default("").notNull(),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url").default("").notNull(),
  domain: text("domain").default("").notNull(),
  saves: integer("saves").default(0).notNull(),
  repins: integer("repins").default(0).notNull(),
  velocity: integer("velocity").default(0).notNull(),
  creatorName: text("creator_name").default("").notNull(),
  creatorFollowers: integer("creator_followers").default(0).notNull(),
  boardName: text("board_name").default("").notNull(),
  pinCreatedAt: timestamp("pin_created_at"),
  source: text("source").default("rss").notNull(),
  sentToPipeline: boolean("sent_to_pipeline").default(false).notNull(),
  pipelineKeywordId: uuid("pipeline_keyword_id").references(() => keywords.id),
  instantVelocity: integer("instant_velocity").default(0).notNull(),
  acceleration: integer("acceleration").default(0).notNull(),
  baselineMultiple: integer("baseline_multiple").default(0).notNull(),
  trendDirection: text("trend_direction").default("new").notNull(),
  previousSaves: integer("previous_saves").default(0).notNull(),
  previousSnapshotAt: timestamp("previous_snapshot_at"),
  lastEnrichedAt: timestamp("last_enriched_at"),
  discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const intelPinSnapshots = pgTable("intel_pin_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  pinId: text("pin_id")
    .references(() => intelPins.pinId, { onDelete: "cascade" })
    .notNull(),
  saves: integer("saves").notNull(),
  repins: integer("repins").default(0).notNull(),
  velocity: integer("velocity").default(0).notNull(),
  snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
});

// === Autopilot Tables ===

export const autopilotDecisions = pgTable("autopilot_decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .references(() => pipelineRuns.id)
    .notNull(),
  intelPinId: uuid("intel_pin_id")
    .references(() => intelPins.id)
    .notNull(),
  pinTitle: text("pin_title").notNull(),
  pinScore: integer("pin_score").notNull(),
  decision: text("decision").notNull(),
  reason: text("reason").notNull(),
  keywordId: uuid("keyword_id").references(() => keywords.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === Pin Queue ===

export const pinQueue = pgTable("pin_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  articleId: uuid("article_id")
    .references(() => articles.id)
    .notNull(),
  imageUrl: text("image_url").notNull(),
  pinDesign: integer("pin_design").notNull(),
  title: text("title").notNull(),
  description: text("description").default("").notNull(),
  link: text("link").notNull(),
  status: text("status").default("pending").notNull(),
  scheduledAt: timestamp("scheduled_at").defaultNow().notNull(),
  postedAt: timestamp("posted_at"),
  pinterestPinId: text("pinterest_pin_id"),
  failureReason: text("failure_reason"),
  boardId: text("board_id"),
  retryCount: integer("retry_count").default(0).notNull(),
  altText: text("alt_text"),
  pinType: text("pin_type").default("original").notNull(),
  performanceScore: integer("performance_score"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === Pin Analytics ===

export const pinAnalytics = pgTable("pin_analytics", {
  id: uuid("id").defaultRandom().primaryKey(),
  pinQueueId: uuid("pin_queue_id")
    .references(() => pinQueue.id)
    .notNull(),
  pinterestPinId: text("pinterest_pin_id").notNull(),
  impressions: integer("impressions").default(0).notNull(),
  saves: integer("saves").default(0).notNull(),
  clicks: integer("clicks").default(0).notNull(),
  closeups: integer("closeups").default(0).notNull(),
  snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
});

// Type exports
export type Keyword = typeof keywords.$inferSelect;
export type NewKeyword = typeof keywords.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type PipelineRun = typeof pipelineRuns.$inferSelect;
export type PipelineConfig = typeof pipelineConfig.$inferSelect;
export type IntelCompetitor = typeof intelCompetitors.$inferSelect;
export type NewIntelCompetitor = typeof intelCompetitors.$inferInsert;
export type IntelPin = typeof intelPins.$inferSelect;
export type NewIntelPin = typeof intelPins.$inferInsert;
export type IntelPinSnapshot = typeof intelPinSnapshots.$inferSelect;
export type NewIntelPinSnapshot = typeof intelPinSnapshots.$inferInsert;
export type AutopilotDecision = typeof autopilotDecisions.$inferSelect;
export type NewAutopilotDecision = typeof autopilotDecisions.$inferInsert;
export type PinQueueItem = typeof pinQueue.$inferSelect;
export type NewPinQueueItem = typeof pinQueue.$inferInsert;
export type PinAnalyticsRow = typeof pinAnalytics.$inferSelect;
export type NewPinAnalyticsRow = typeof pinAnalytics.$inferInsert;
