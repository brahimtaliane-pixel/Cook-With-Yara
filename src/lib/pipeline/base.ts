import { db } from "@/lib/db";
import { pipelineRuns, pipelineConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PIPELINE_DEFAULTS, ConfigKeys } from "@/lib/constants";

// === Cron Auth Guard ===

export function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

// === Pipeline Enabled Check ===

export async function isPipelineEnabled(): Promise<boolean> {
  const result = await db
    .select()
    .from(pipelineConfig)
    .where(eq(pipelineConfig.key, ConfigKeys.PIPELINE_ENABLED))
    .limit(1);
  if (result.length === 0) return true; // enabled by default
  return result[0].value === "true";
}

// === Get Config Value ===

export async function getConfigValue(
  key: string,
  defaultValue: string
): Promise<string> {
  const result = await db
    .select()
    .from(pipelineConfig)
    .where(eq(pipelineConfig.key, key))
    .limit(1);
  return result.length > 0 ? result[0].value : defaultValue;
}

// === Pipeline Run Logger ===

export async function startPipelineRun(jobName: string): Promise<string> {
  const [run] = await db
    .insert(pipelineRuns)
    .values({ jobName })
    .returning({ id: pipelineRuns.id });
  return run.id;
}

export async function completePipelineRun(
  runId: string,
  itemsProcessed: number
): Promise<void> {
  await db
    .update(pipelineRuns)
    .set({
      status: "completed",
      finishedAt: new Date(),
      itemsProcessed,
    })
    .where(eq(pipelineRuns.id, runId));
}

export async function failPipelineRun(
  runId: string,
  error: string
): Promise<void> {
  await db
    .update(pipelineRuns)
    .set({
      status: "failed",
      finishedAt: new Date(),
      errorLog: error,
    })
    .where(eq(pipelineRuns.id, runId));
}

// === Retry Helper ===

export function shouldRetry(retryCount: number): boolean {
  return retryCount < PIPELINE_DEFAULTS.MAX_RETRIES;
}

// === Standard Cron Response ===

export function cronResponse(
  data: Record<string, unknown>,
  status = 200
): Response {
  return Response.json(data, { status });
}

// === Cron Handler Wrapper ===

export function createCronHandler(
  jobName: string,
  handler: (runId: string) => Promise<{ processed: number }>
) {
  return async function (request: Request): Promise<Response> {
    // Verify cron secret (skip in dev/test)
    if (
      process.env.NODE_ENV === "production" &&
      !verifyCronSecret(request)
    ) {
      return cronResponse({ error: "Unauthorized" }, 401);
    }

    // Check circuit breaker
    const enabled = await isPipelineEnabled();
    if (!enabled) {
      return cronResponse({ message: "Pipeline disabled" }, 200);
    }

    const runId = await startPipelineRun(jobName);

    try {
      const result = await handler(runId);
      await completePipelineRun(runId, result.processed);
      return cronResponse({
        success: true,
        jobName,
        processed: result.processed,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      await failPipelineRun(runId, message);
      console.error(`[${jobName}] Failed:`, error);
      return cronResponse({ error: message }, 500);
    }
  };
}
