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

// Video reel lifecycle (articles.video_status). Decoupled from the article
// status machine — a reel is an optional artifact layered onto a PUBLISHED article.
export const VideoStatus = {
  NONE: "none",
  GENERATING: "generating",
  READY: "ready",
  FAILED: "failed",
} as const;

export type VideoStatus = (typeof VideoStatus)[keyof typeof VideoStatus];

// pin_queue.media_type — drives the posting flow in processNextPin.
export const MediaType = {
  IMAGE: "image",
  VIDEO: "video",
} as const;

export type MediaType = (typeof MediaType)[keyof typeof MediaType];

// pin_queue.status value used while a video is registered+uploaded to Pinterest
// and its transcode is being polled, before the pin itself is created.
export const PinQueueStatus = {
  PENDING: "pending",
  POSTING: "posting",
  MEDIA_PROCESSING: "media_processing",
  POSTED: "posted",
  FAILED: "failed",
} as const;

export type PinQueueStatus =
  (typeof PinQueueStatus)[keyof typeof PinQueueStatus];

// pin_queue.pin_type bucket for the daily-cap rotation (alongside
// original / multiboard / recycled).
export const PinType = {
  ORIGINAL: "original",
  MULTIBOARD: "multiboard",
  RECYCLED: "recycled",
  VIDEO: "video",
} as const;

export type PinType = (typeof PinType)[keyof typeof PinType];

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
  AUTOPILOT_MIN_SCORE: 65,
  AUTOPILOT_MAX_PER_RUN: 2,
} as const;

// === Video (Veo) Defaults ===

export const VIDEO_DEFAULTS = {
  // Which backend generates reels: "veo" (Google) or "grok" (xAI Grok Imagine).
  // Default grok — ~3x cheaper per clip and verified to match the guide style.
  PROVIDER: "grok",
  // Veo 3.1 Fast: good motion + audio, ~2.5x cheaper than full. See AskUser decision.
  MODEL: "veo-3.1-fast-generate-preview",
  // Grok Imagine video: ~$0.05/sec (≈3x cheaper than Veo Fast).
  GROK_MODEL: "grok-imagine-video",
  ASPECT_RATIO: "9:16", // vertical/portrait — fills a phone screen
  RESOLUTION: "720p",
  DURATION_SECONDS: 8,
  // Cost ceilings (overridable via pipeline_config).
  MAX_GENERATIONS_PER_DAY: 1,
  MAX_PINS_PER_DAY: 1,
} as const;

// === Pipeline Config Keys ===

export const ConfigKeys = {
  PIPELINE_ENABLED: "pipeline_enabled",
  MAX_ARTICLES_PER_DAY: "max_articles_per_day",
  TARGET_REGION: "target_region",
  PINTEREST_APP_ID: "pinterest_app_id",
  PINTEREST_APP_SECRET: "pinterest_app_secret",
  PINTEREST_ACCESS_TOKEN: "pinterest_access_token",
  PINTEREST_REFRESH_TOKEN: "pinterest_refresh_token",
  PINTEREST_TOKEN_EXPIRES_AT: "pinterest_token_expires_at",
  PINTEREST_USER_NAME: "pinterest_user_name",
  PINTEREST_BOARDS: "pinterest_boards",
  PINTEREST_BOARD_ID: "pinterest_board_id",
  AUTOPILOT_ENABLED: "autopilot_enabled",
  AUTOPILOT_MIN_SCORE: "autopilot_min_score",
  AUTOPILOT_MAX_PER_RUN: "autopilot_max_per_run",
  PINS_PER_CRON_RUN: "pins_per_cron_run",
  MAX_PINS_PER_DAY: "max_pins_per_day",
  PINTEREST_BOARD_MAP: "pinterest_board_map",
  PIN_POSTING_SCHEDULE: "pin_posting_schedule",
  MULTI_BOARD_ENABLED: "multi_board_enabled",
  MAX_MULTIBOARD_PINS_PER_DAY: "max_multiboard_pins_per_day",
  RECYCLE_ENABLED: "recycle_enabled",
  MAX_RECYCLES_PER_ARTICLE: "max_recycles_per_article",
  RECYCLE_COOLDOWN_DAYS: "recycle_cooldown_days",
  MAX_RECYCLED_PINS_PER_DAY: "max_recycled_pins_per_day",
  // Video reels
  VIDEO_ENABLED: "video_enabled",
  VIDEO_PROVIDER: "video_provider", // "veo" | "grok"
  VEO_MODEL: "veo_model",
  GROK_MODEL: "grok_model",
  MAX_VIDEO_GENERATIONS_PER_DAY: "max_video_generations_per_day",
  MAX_VIDEO_PINS_PER_DAY: "max_video_pins_per_day",
} as const;

// === Intel ===

export const IntelSource = {
  RSS: "rss",
  SEARCH: "search",
  LOOKUP: "lookup",
  TRENDING: "trending",
} as const;

export type IntelSource = (typeof IntelSource)[keyof typeof IntelSource];

export const INTEL_DEFAULTS = {
  WIDGET_API_BATCH_SIZE: 50,
  DEFAULT_PIN_LIMIT: 100,
  REFRESH_INTERVAL_HOURS: 4,
  MIN_VELOCITY_THRESHOLD: 10,
  TRENDING_PINS_PER_QUERY: 200,
  QUERIES_PER_REFRESH: 5,
} as const;


// === Food Detection ===

export const FOOD_INDICATORS = [
  // Core terms
  "recipe", "recipes", "cook", "cooking", "bake", "baking",
  "food", "meal", "dinner", "lunch", "breakfast", "snack", "brunch",
  // Dish types
  "dessert", "soup", "salad", "cake", "bread", "pasta", "casserole",
  "stew", "curry", "pizza", "sandwich", "smoothie", "appetizer",
  "side dish", "sauce", "dip", "marinade", "pie", "cookie", "brownies",
  "pancake", "waffle", "oatmeal", "rice", "noodle", "taco", "burrito",
  "stir fry", "wrap", "bowl", "dumpling", "muffin", "scone", "pudding",
  "frosting", "glaze", "chili", "biryani", "risotto", "lasagna",
  "quiche", "frittata", "hummus", "falafel", "kebab", "shawarma",
  // Proteins (halal only — no pork/bacon/ham)
  "chicken", "beef", "fish", "seafood", "lamb", "turkey", "shrimp",
  "salmon", "tuna", "cod", "tilapia", "tofu", "lentil", "chickpea",
  // Cooking methods
  "slow cooker", "instant pot", "air fryer", "grilled", "roasted",
  "fried", "smoked", "sauteed", "braised", "steamed", "poached",
  // Diet styles
  "vegan", "vegetarian", "healthy", "keto", "gluten free", "low carb",
  "high protein", "dairy free", "whole30", "mediterranean",
  // Speed/ease
  "easy", "quick", "one pot", "sheet pan", "no bake", "5 ingredient",
  "30 minute", "weeknight", "meal prep",
  // Produce & common ingredients
  "potato", "sweet potato", "zucchini", "cauliflower", "broccoli",
  "mushroom", "spinach", "eggplant", "avocado", "pumpkin", "butternut",
  "corn", "tomato", "cucumber", "carrot", "banana", "apple", "lemon",
  "lime", "orange", "strawberry", "blueberry", "raspberry", "peach",
  "mango", "cherry", "rhubarb", "date", "fig", "pistachio", "almond",
  "walnut", "pecan", "coconut", "tahini", "feta", "halloumi", "yogurt",
  "cheese", "egg", "honey", "maple", "cinnamon", "vanilla", "chocolate",
  "caramel", "peanut butter", "matcha", "pesto", "garlic",
  // More dish types & treats
  "cobbler", "crumble", "galette", "tart", "flatbread", "pita",
  "focaccia", "bagel", "cinnamon roll", "donut", "fudge", "ice cream",
  "sorbet", "popsicle", "milkshake", "lemonade", "granola",
  "overnight oats", "energy balls", "couscous", "quinoa", "orzo",
  "meatball", "skewer", "fritter", "patties", "nuggets", "tenders",
  "mac and cheese", "pot pie", "shepherds pie", "enchilada",
  "quesadilla", "fajita", "gyro", "wings", "sliders", "bruschetta",
  "crostini", "banana bread", "zucchini bread", "pound cake",
  "cheesecake", "cupcake", "macaron", "truffle", "bark", "brittle",
] as const;

// Keywords that should never pass through (non-halal)
export const FOOD_BLOCKLIST = [
  "pork", "bacon", "ham", "prosciutto", "chorizo",
  "wine", "beer", "cocktail", "margarita", "sangria",
  "liquor", "vodka", "rum", "whiskey", "bourbon",
] as const;

export const TREND_THRESHOLDS = {
  ACCELERATION_HIGH: 20,
  ACCELERATION_MODERATE: 5,
  BASELINE_MULTIPLE_HIGH: 3,
  BASELINE_MULTIPLE_MODERATE: 1.5,
  FRESHNESS_HALF_LIFE_DAYS: 7,
  MAX_SNAPSHOT_AGE_DAYS: 30,
} as const;

export const TrendDirection = {
  RISING: "rising",
  FALLING: "falling",
  STABLE: "stable",
  NEW: "new",
} as const;
export type TrendDirection = (typeof TrendDirection)[keyof typeof TrendDirection];

export const TRENDING_RECIPE_QUERIES = [
  // --- By Cuisine ---
  "italian recipes",
  "mexican recipes",
  "asian recipes",
  "indian recipes",
  "thai recipes",
  "mediterranean recipes",
  "korean recipes",
  "japanese recipes",
  "middle eastern recipes",
  "greek recipes",
  "chinese recipes",
  "turkish recipes",

  // --- By Protein (halal only) ---
  "chicken breast recipes",
  "ground beef recipes",
  "salmon recipes",
  "shrimp recipes",
  "lamb recipes",
  "turkey recipes",
  "beef stew recipes",
  "fish recipes",

  // --- By Cooking Method ---
  "air fryer recipes",
  "instant pot recipes",
  "slow cooker recipes",
  "sheet pan dinner",
  "one pot meals",
  "grilled recipes",
  "no bake desserts",
  "skillet recipes",
  "cast iron recipes",

  // --- By Diet ---
  "keto recipes",
  "low carb dinner",
  "high protein meals",
  "vegan dinner recipes",
  "gluten free recipes",
  "whole30 recipes",
  "dairy free recipes",
  "mediterranean diet recipes",
  "plant based recipes",

  // --- By Meal Type ---
  "easy dinner recipes",
  "quick lunch ideas",
  "healthy breakfast recipes",
  "meal prep ideas",
  "appetizer recipes",
  "side dish recipes",
  "snack recipes",
  "brunch recipes",
  "potluck recipes",

  // --- Trending / Seasonal ---
  "comfort food recipes",
  "summer recipes",
  "holiday baking",
  "soup recipes winter",
  "salad recipes",
  "smoothie bowl",
  "overnight oats",
  "budget friendly meals",
  "5 ingredient recipes",
  "30 minute meals",
  "weeknight dinner ideas",

  // --- Desserts ---
  "chocolate dessert recipes",
  "cake recipes",
  "cookie recipes",
  "brownie recipes",
  "cheesecake recipes",
  "ice cream recipes",
] as const;
