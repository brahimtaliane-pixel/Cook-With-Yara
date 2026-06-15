import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKeys } from "@/lib/services/gemini-keys";
import { buildContentPrompt, buildApprovalPrompt, buildAutopilotPrompt } from "@/lib/utils/prompts";

// === Types ===

export interface GeneratedArticle {
  title: string;
  metaDescription: string;
  contentMdx: string;
  recipeJsonLd: Record<string, unknown>;
  midjourneyPrompt: string;
}

export interface KeywordEvaluation {
  approved: boolean;
  reason: string;
}

export interface AutopilotEvaluation {
  approved: boolean;
  reason: string;
}

// === Client ===

function getClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

const MODEL_FAST = "gemini-2.5-flash";   // approval / evaluation
const MODEL_QUALITY = "gemini-2.5-pro";  // long-form content

function stripFences(text: string): string {
  let out = text.trim();
  if (out.startsWith("```")) {
    out = out.replace(/^```(?:\w+)?\s*/, "").replace(/\s*```\s*$/, "");
  }
  return out.trim();
}

async function callGemini(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userMessage: string,
  opts: { thinking?: boolean; maxOutputTokens?: number } = {},
): Promise<string> {
  const ai = getClient(apiKey);
  const response = await ai.models.generateContent({
    model,
    contents: userMessage,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      maxOutputTokens: opts.maxOutputTokens ?? 8192,
      ...(opts.thinking === false
        ? { thinkingConfig: { thinkingBudget: 0 } }
        : {}),
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini");

  return stripFences(text);
}

/**
 * Try the requested Gemini model on each configured API key in turn; on any
 * failure (rate limit, quota, outage) retry once after a short backoff, then
 * try the other Gemini tier on that same key, before rotating to the next key.
 * With multiple keys configured this rides out per-key quota exhaustion.
 * The last error propagates if every key/model combination fails.
 */
async function callAI(
  model: string,
  systemInstruction: string,
  userMessage: string,
  opts: { thinking?: boolean; maxOutputTokens?: number } = {},
): Promise<string> {
  const altModel = model === MODEL_QUALITY ? MODEL_FAST : MODEL_QUALITY;
  const keys = getGeminiApiKeys();
  let lastErr: unknown;

  for (const [keyIndex, apiKey] of keys.entries()) {
    for (const [attempt, geminiModel] of [model, model, altModel].entries()) {
      try {
        if (attempt === 1) await new Promise((r) => setTimeout(r, 2000));
        return await callGemini(apiKey, geminiModel, systemInstruction, userMessage, opts);
      } catch (err) {
        lastErr = err;
        console.warn(
          `[ai-writer] Gemini key #${keyIndex + 1} (${geminiModel}) attempt ${attempt + 1} failed:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  throw lastErr;
}

// === Public API ===

export async function generateArticleContent(
  keyword: string,
): Promise<GeneratedArticle> {
  const prompt = buildContentPrompt(keyword);
  const raw = await callAI(
    MODEL_QUALITY,
    "You are a recipe content generator. Return only valid JSON.",
    prompt,
    { maxOutputTokens: 32768 },
  );

  try {
    const parsed = JSON.parse(raw) as GeneratedArticle;
    if (!parsed.title || !parsed.contentMdx || !parsed.midjourneyPrompt) {
      throw new Error("Missing required fields in generated article");
    }
    return parsed;
  } catch (err) {
    throw new Error(
      `Failed to parse article content: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function evaluatePinForAutopilot(context: {
  pinTitle: string;
  pinDescription: string;
  pinScore: number;
  recentArticleTitles: string[];
}): Promise<AutopilotEvaluation> {
  const prompt = buildAutopilotPrompt(context);
  const raw = await callAI(
    MODEL_FAST,
    "You are a recipe content strategist. Return only valid JSON.",
    prompt,
    { thinking: false },
  );

  try {
    const parsed = JSON.parse(raw) as AutopilotEvaluation;
    if (typeof parsed.approved !== "boolean" || !parsed.reason) {
      return { approved: false, reason: "Failed to parse AI evaluation — defaulting to reject" };
    }
    return parsed;
  } catch {
    return { approved: false, reason: "Failed to parse AI evaluation — defaulting to reject" };
  }
}

export async function evaluateKeyword(
  keyword: string,
): Promise<KeywordEvaluation> {
  const prompt = buildApprovalPrompt(keyword);
  const raw = await callAI(
    MODEL_FAST,
    "You are a keyword evaluator. Return only valid JSON.",
    prompt,
    { thinking: false },
  );

  try {
    const parsed = JSON.parse(raw) as KeywordEvaluation;
    if (typeof parsed.approved !== "boolean" || !parsed.reason) {
      throw new Error("Missing required fields in keyword evaluation");
    }
    return parsed;
  } catch (err) {
    throw new Error(
      `Failed to parse keyword evaluation: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
