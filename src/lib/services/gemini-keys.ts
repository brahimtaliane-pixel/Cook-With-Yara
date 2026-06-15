/**
 * Collect every configured Gemini API key. Supports a comma-separated list in
 * GEMINI_API_KEY and/or numbered GEMINI_API_KEY_2, GEMINI_API_KEY_3, … vars so
 * callers can rotate to another key when one is rate-limited or out of quota.
 */
export function getGeminiApiKeys(): string[] {
  const keys: string[] = [];
  const primary = process.env.GEMINI_API_KEY ?? "";
  for (const k of primary.split(",")) {
    const trimmed = k.trim();
    if (trimmed) keys.push(trimmed);
  }
  for (let i = 2; i <= 10; i++) {
    const k = (process.env[`GEMINI_API_KEY_${i}`] ?? "").trim();
    if (k) keys.push(k);
  }
  // De-duplicate while preserving order.
  const seen = new Set<string>();
  const unique = keys.filter((k) => (seen.has(k) ? false : (seen.add(k), true)));
  if (unique.length === 0) throw new Error("GEMINI_API_KEY is not set");
  return unique;
}
