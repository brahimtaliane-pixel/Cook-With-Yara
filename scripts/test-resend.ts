/**
 * Test Script: Resend Email (Step 6)
 * Run: npx tsx scripts/test-resend.ts
 *
 * Sends a test alert email to verify the API key and email config.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { Resend } from "resend";

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_EMAIL_FROM;
  const to = process.env.ALERT_EMAIL_TO;

  if (!apiKey) {
    console.error("RESEND_API_KEY is not set in .env.local");
    process.exit(1);
  }
  if (!from) {
    console.error("ALERT_EMAIL_FROM is not set in .env.local");
    process.exit(1);
  }
  if (!to) {
    console.error("ALERT_EMAIL_TO is not set in .env.local");
    process.exit(1);
  }

  console.log("Testing Resend email...");
  console.log(`Key prefix: ${apiKey.slice(0, 6)}...`);
  console.log(`From: ${from}`);
  console.log(`To: ${to}`);

  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: "[CookWithLucia] Test Alert - Setup Verification",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Cook With Lucia - Alert System Test</h2>
        <p>If you're reading this, your Resend email integration is working correctly!</p>
        <hr />
        <p style="color: #666; font-size: 14px;">
          Sent at: ${new Date().toISOString()}<br/>
          From: ${from}
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Send failed:", error);
    process.exit(1);
  }

  console.log(`\nEmail sent successfully!`);
  console.log(`Email ID: ${data?.id}`);
  console.log(`Check your inbox at: ${to}`);
}

main().catch((err) => {
  console.error("Resend test failed:", err.message);
  process.exit(1);
});
