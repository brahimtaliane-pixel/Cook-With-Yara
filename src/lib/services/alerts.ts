import { Resend } from "resend";

// === Types ===

export interface DailySummaryStats {
  keywordsDiscovered: number;
  keywordsApproved: number;
  articlesPublished: number;
  articlesFailed: number;
  pinsCreated: number;
}

// === Helpers ===

function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

function getEmailConfig() {
  const to = process.env.ALERT_EMAIL_TO;
  const from = process.env.ALERT_EMAIL_FROM;
  if (!to) throw new Error("ALERT_EMAIL_TO is not set");
  if (!from) throw new Error("ALERT_EMAIL_FROM is not set");
  return { to, from };
}

// === Public API ===

export async function sendAlert(subject: string, body: string): Promise<void> {
  const resend = getResendClient();
  const { to, from } = getEmailConfig();

  const { error } = await resend.emails.send({
    from,
    to,
    subject: `[CookWithYara] ${subject}`,
    html: `<pre style="font-family: system-ui, sans-serif; white-space: pre-wrap;">${body}</pre>`,
  });

  if (error) {
    console.error("Failed to send alert email:", error);
    throw new Error(`Resend error: ${error.message}`);
  }
}

export async function sendSlackAlert(message: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    // Slack is optional - silently skip if not configured
    return;
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `[CookWithYara] ${message}` }),
  });

  if (!res.ok) {
    console.error(`Slack webhook failed with status ${res.status}`);
  }
}

export async function sendDailySummary(stats: DailySummaryStats): Promise<void> {
  const subject = "Daily Pipeline Summary";
  const body = [
    "Daily Pipeline Summary",
    "======================",
    "",
    `Keywords Discovered: ${stats.keywordsDiscovered}`,
    `Keywords Approved:   ${stats.keywordsApproved}`,
    `Articles Published:  ${stats.articlesPublished}`,
    `Articles Failed:     ${stats.articlesFailed}`,
    `Pins Created:        ${stats.pinsCreated}`,
    "",
    `Generated at ${new Date().toISOString()}`,
  ].join("\n");

  await Promise.allSettled([
    sendAlert(subject, body),
    sendSlackAlert(body),
  ]);
}
