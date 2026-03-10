// === Status Enums ===

export const KeywordStatus = {
  NEW: "new",
  APPROVED: "approved",
  COMPLETED: "completed",
  REJECTED: "rejected",
  FAILED: "failed",
} as const;

export type KeywordStatus = (typeof KeywordStatus)[keyof typeof KeywordStatus];

export const ArticleStatus = {
  DRAFT: "draft",
  CONTENT_GENERATING: "content_generating",
  CONTENT_READY: "content_ready",
  IMAGE_GENERATING: "image_generating",
  IMAGE_READY: "image_ready",
  PIN_GENERATING: "pin_generating",
  PIN_READY: "pin_ready",
  PUBLISHING: "publishing",
  PUBLISHED: "published",
  FAILED: "failed",
} as const;

export type ArticleStatus = (typeof ArticleStatus)[keyof typeof ArticleStatus];

export const PipelineRunStatus = {
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type PipelineRunStatus =
  (typeof PipelineRunStatus)[keyof typeof PipelineRunStatus];

// === Pipeline Defaults ===

export const PIPELINE_DEFAULTS = {
  MAX_RETRIES: 3,
  MAX_ARTICLES_PER_DAY: 5,
  TARGET_REGION: "US",
  PINTEREST_PIN_WIDTH: 1000,
  PINTEREST_PIN_HEIGHT: 1500,
} as const;

// === Pipeline Config Keys ===

export const ConfigKeys = {
  PIPELINE_ENABLED: "pipeline_enabled",
  MAX_ARTICLES_PER_DAY: "max_articles_per_day",
  TARGET_REGION: "target_region",
} as const;
