import { db } from "@/lib/db";
import {
  intelPins,
  keywords,
  articles,
  autopilotDecisions,
} from "@/lib/db/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import {
  PIPELINE_DEFAULTS,
  ConfigKeys,
  FOOD_BLOCKLIST,
} from "@/lib/constants";
import { getConfigValue } from "@/lib/pipeline/base";
import { computePinScore } from "@/lib/services/intel-scoring";
import { evaluatePinForAutopilot } from "@/lib/services/ai-writer";
import { generateSlug } from "@/lib/utils/slug";

// Pin titles from competitors are often marketing-style — multi-part with
// separators (e.g. "Bang Bang Salmon Bites Bowls – A Flavor Explosion in
// Every Bite!"). Trim to the first segment and cap length before slugging
// so we don't end up with 70-char URLs that Google truncates in SERPs.
function normalizePinTitle(title: string): string {
  let cleaned = title
    .replace(/^["“”'`]+|["“”'`]+$/g, "") // strip surrounding quote-like chars
    .split(/\s+[|:–—-]\s+/)[0]   // first segment before " | ", " – ", " — ", " - ", " : "
    .trim();

  if (cleaned.length <= 50) return cleaned;

  // Truncate at the last word boundary within 50 chars
  const truncated = cleaned.slice(0, 50);
  const lastSpace = truncated.lastIndexOf(" ");
  cleaned = lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated;
  return cleaned.trim();
}

export async function runAutopilot(
  runId: string
): Promise<{ processed: number }> {
  // 1. Check if autopilot is enabled
  const enabled = await getConfigValue(ConfigKeys.AUTOPILOT_ENABLED, "false");
  if (enabled !== "true") {
    console.log("[autopilot] Disabled, skipping");
    return { processed: 0 };
  }

  // 2. Check daily article limit
  const maxPerDay = parseInt(
    await getConfigValue(
      ConfigKeys.MAX_ARTICLES_PER_DAY,
      String(PIPELINE_DEFAULTS.MAX_ARTICLES_PER_DAY)
    ),
    10
  );

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ count: todayCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(articles)
    .where(gte(articles.createdAt, todayStart));

  if (todayCount >= maxPerDay) {
    console.log(
      `[autopilot] Daily limit reached (${todayCount}/${maxPerDay}), skipping`
    );
    return { processed: 0 };
  }

  // 3. Get config values
  const minScore = parseInt(
    await getConfigValue(
      ConfigKeys.AUTOPILOT_MIN_SCORE,
      String(PIPELINE_DEFAULTS.AUTOPILOT_MIN_SCORE)
    ),
    10
  );
  const maxPerRun = parseInt(
    await getConfigValue(
      ConfigKeys.AUTOPILOT_MAX_PER_RUN,
      String(PIPELINE_DEFAULTS.AUTOPILOT_MAX_PER_RUN)
    ),
    10
  );

  const remainingSlots = maxPerDay - todayCount;
  const effectiveMax = Math.min(maxPerRun, remainingSlots);

  if (effectiveMax <= 0) {
    return { processed: 0 };
  }

  // 4. Fetch unsent intel pins from last 14 days
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const pins = await db
    .select()
    .from(intelPins)
    .where(
      and(
        eq(intelPins.sentToPipeline, false),
        gte(intelPins.discoveredAt, fourteenDaysAgo)
      )
    )
    .orderBy(desc(intelPins.instantVelocity))
    .limit(200);

  if (pins.length === 0) {
    console.log("[autopilot] No unsent pins found");
    return { processed: 0 };
  }

  // 5. Score and filter
  const scoredPins = pins
    .map((pin) => {
      const scoreResult = computePinScore({
        saves: pin.saves,
        velocity: pin.velocity,
        instantVelocity: pin.instantVelocity,
        acceleration: pin.acceleration,
        baselineMultiple: pin.baselineMultiple,
        pinCreatedAt: pin.pinCreatedAt,
        creatorFollowers: pin.creatorFollowers,
        title: pin.title,
        description: pin.description,
      });
      return { pin, score: scoreResult.score };
    })
    .filter(({ score }) => score >= minScore)
    .filter(({ pin }) => {
      const lower = pin.title.toLowerCase();
      return !FOOD_BLOCKLIST.some((blocked) => lower.includes(blocked));
    });

  if (scoredPins.length === 0) {
    console.log("[autopilot] No pins passed score/filter threshold");
    return { processed: 0 };
  }

  // 6. Check for duplicate slugs/keywords
  const candidates: typeof scoredPins = [];
  for (const item of scoredPins) {
    const slug = generateSlug(normalizePinTitle(item.pin.title));

    const [existingArticle] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.slug, slug))
      .limit(1);

    const [existingKeyword] = await db
      .select({ id: keywords.id })
      .from(keywords)
      .where(eq(keywords.keyword, item.pin.title))
      .limit(1);

    if (existingArticle || existingKeyword) {
      await db.insert(autopilotDecisions).values({
        runId,
        intelPinId: item.pin.id,
        pinTitle: item.pin.title,
        pinScore: item.score,
        decision: "skipped_duplicate",
        reason: existingArticle
          ? "Article with this slug already exists"
          : "Keyword already exists",
      });
      continue;
    }

    candidates.push(item);
    if (candidates.length >= effectiveMax * 3) break; // buffer
  }

  if (candidates.length === 0) {
    console.log("[autopilot] All candidates were duplicates");
    return { processed: 0 };
  }

  // 7. Get recent article titles for diversity check
  const recentArticles = await db
    .select({ title: articles.title })
    .from(articles)
    .where(gte(articles.createdAt, fourteenDaysAgo))
    .orderBy(desc(articles.createdAt))
    .limit(50);

  const recentTitles = recentArticles
    .map((a) => a.title)
    .filter((t): t is string => t !== null);

  // 8. Evaluate with Claude and select
  let selected = 0;

  for (const { pin, score } of candidates) {
    if (selected >= effectiveMax) {
      await db.insert(autopilotDecisions).values({
        runId,
        intelPinId: pin.id,
        pinTitle: pin.title,
        pinScore: score,
        decision: "skipped_limit",
        reason: `Run limit reached (${effectiveMax} per run)`,
      });
      continue;
    }

    const evaluation = await evaluatePinForAutopilot({
      pinTitle: pin.title,
      pinDescription: pin.description,
      pinScore: score,
      recentArticleTitles: recentTitles,
    });

    if (!evaluation.approved) {
      await db.insert(autopilotDecisions).values({
        runId,
        intelPinId: pin.id,
        pinTitle: pin.title,
        pinScore: score,
        decision: "rejected",
        reason: evaluation.reason,
      });
      continue;
    }

    // 9. Create keyword + article
    const slug = generateSlug(normalizePinTitle(pin.title));

    const [newKeyword] = await db
      .insert(keywords)
      .values({
        keyword: pin.title,
        status: "approved",
        trendType: "intel",
        pinterestTrendScore: pin.velocity,
      })
      .returning({ id: keywords.id });

    await db.insert(articles).values({
      keywordId: newKeyword.id,
      slug,
      status: "draft",
    });

    // Mark pin as sent
    await db
      .update(intelPins)
      .set({
        sentToPipeline: true,
        pipelineKeywordId: newKeyword.id,
        updatedAt: new Date(),
      })
      .where(eq(intelPins.id, pin.id));

    await db.insert(autopilotDecisions).values({
      runId,
      intelPinId: pin.id,
      pinTitle: pin.title,
      pinScore: score,
      decision: "selected",
      reason: evaluation.reason,
      keywordId: newKeyword.id,
    });

    recentTitles.unshift(pin.title);
    selected++;

    console.log(
      `[autopilot] Selected: "${pin.title}" (score: ${score}) — ${evaluation.reason}`
    );
  }

  console.log(`[autopilot] Done: ${selected} pins selected`);
  return { processed: selected };
}
