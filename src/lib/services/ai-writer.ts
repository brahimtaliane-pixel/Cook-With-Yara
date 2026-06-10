import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
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

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

const MODEL_FAST = "gemini-2.5-flash";   // approval / evaluation
const MODEL_QUALITY = "gemini-2.5-pro";  // long-form content

// Anthropic fallbacks, used only when the Gemini call throws.
const CLAUDE_QUALITY = "claude-sonnet-4-5-20250929"; // long-form content
const CLAUDE_FAST = "claude-haiku-4-5-20251001";     // approval / evaluation

function stripFences(text: string): string {
  let out = text.trim();
  if (out.startsWith("```")) {
    out = out.replace(/^```(?:\w+)?\s*/, "").replace(/\s*```\s*$/, "");
  }
  return out.trim();
}

async function callGemini(
  model: string,
  systemInstruction: string,
  userMessage: string,
  opts: { thinking?: boolean; maxOutputTokens?: number } = {},
): Promise<string> {
  const ai = getClient();
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

async function callAnthropic(
  model: string,
  systemInstruction: string,
  userMessage: string,
  maxTokens: number,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: `${systemInstruction} Return only valid JSON, no markdown fences.`,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = response.content.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text : "";
  if (!text) throw new Error("Empty response from Anthropic");

  return stripFences(text);
}

/**
 * Try Gemini first; on any failure (rate limit, quota, outage) retry once
 * after a short backoff, then try the other Gemini tier, and only as a last
 * resort fall back to the equivalent Claude model. If no ANTHROPIC_API_KEY is
 * set, the last Gemini error propagates unchanged.
 */
async function callAI(
  model: string,
  systemInstruction: string,
  userMessage: string,
  opts: { thinking?: boolean; maxOutputTokens?: number } = {},
): Promise<string> {
  const altModel = model === MODEL_QUALITY ? MODEL_FAST : MODEL_QUALITY;
  let lastErr: unknown;

  for (const [attempt, geminiModel] of [model, model, altModel].entries()) {
    try {
      if (attempt === 1) await new Promise((r) => setTimeout(r, 2000));
      return await callGemini(geminiModel, systemInstruction, userMessage, opts);
    } catch (err) {
      lastErr = err;
      console.warn(
        `[ai-writer] Gemini (${geminiModel}) attempt ${attempt + 1} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) throw lastErr;
  console.warn(`[ai-writer] All Gemini attempts failed — falling back to Anthropic`);
  const claudeModel = model === MODEL_QUALITY ? CLAUDE_QUALITY : CLAUDE_FAST;
  const maxTokens = Math.min(opts.maxOutputTokens ?? 8192, 16384);
  return callAnthropic(claudeModel, systemInstruction, userMessage, maxTokens);
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
