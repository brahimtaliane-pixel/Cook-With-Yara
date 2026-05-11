import { GoogleGenAI } from "@google/genai";
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

  // Defensive: strip code fences if the model wraps JSON anyway
  let out = text.trim();
  if (out.startsWith("```")) {
    out = out.replace(/^```(?:\w+)?\s*/, "").replace(/\s*```\s*$/, "");
  }
  return out.trim();
}

// === Public API ===

export async function generateArticleContent(
  keyword: string,
): Promise<GeneratedArticle> {
  const prompt = buildContentPrompt(keyword);
  const raw = await callGemini(
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
      `Failed to parse article content from Gemini: ${err instanceof Error ? err.message : String(err)}`,
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
  const raw = await callGemini(
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
  const raw = await callGemini(
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
      `Failed to parse keyword evaluation from Gemini: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
