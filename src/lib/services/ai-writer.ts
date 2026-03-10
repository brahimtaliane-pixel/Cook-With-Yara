import Anthropic from "@anthropic-ai/sdk";
import { buildContentPrompt, buildApprovalPrompt } from "@/lib/utils/prompts";

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

// === Client ===

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

const MODEL = "claude-sonnet-4-5-20250929";

async function callClaude(systemMessage: string, userMessage: string): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [
      { role: "user", content: userMessage },
    ],
    system: systemMessage,
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  // Strip markdown code fences — Claude sometimes wraps JSON in ```json ... ```
  let text = block.text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return text;
}

// === Public API ===

export async function generateArticleContent(
  keyword: string,
): Promise<GeneratedArticle> {
  const prompt = buildContentPrompt(keyword);
  const raw = await callClaude(
    "You are a recipe content generator. Return only valid JSON.",
    prompt,
  );

  try {
    const parsed = JSON.parse(raw) as GeneratedArticle;
    if (!parsed.title || !parsed.contentMdx || !parsed.midjourneyPrompt) {
      throw new Error("Missing required fields in generated article");
    }
    return parsed;
  } catch (err) {
    throw new Error(
      `Failed to parse article content from Claude: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function evaluateKeyword(
  keyword: string,
): Promise<KeywordEvaluation> {
  const prompt = buildApprovalPrompt(keyword);
  const raw = await callClaude(
    "You are a keyword evaluator. Return only valid JSON.",
    prompt,
  );

  try {
    const parsed = JSON.parse(raw) as KeywordEvaluation;
    if (typeof parsed.approved !== "boolean" || !parsed.reason) {
      throw new Error("Missing required fields in keyword evaluation");
    }
    return parsed;
  } catch (err) {
    throw new Error(
      `Failed to parse keyword evaluation from Claude: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
