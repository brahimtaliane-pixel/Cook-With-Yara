/**
 * Test Script: ImaginePro / Midjourney (Step 3)
 * Run: npx tsx scripts/test-imagineapi.ts
 *
 * Submits a test image prompt and polls until complete.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const API_BASE = "https://api.imaginepro.ai/api/v1/midjourney";

async function main() {
  const token = process.env.IMAGINEAPI_TOKEN;

  if (!token) {
    console.error("IMAGINEAPI_TOKEN is not set in .env.local");
    process.exit(1);
  }

  console.log("Testing ImaginePro API...");
  console.log(`Token prefix: ${token.slice(0, 20)}...`);

  // Submit a test job
  const prompt =
    "professional food photography of chocolate chip cookies on a cooling rack, warm lighting, shallow depth of field, overhead shot --ar 16:9";

  console.log(`\nSubmitting prompt: "${prompt.slice(0, 60)}..."`);

  const submitRes = await fetch(`${API_BASE}/imagine`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!submitRes.ok) {
    const body = await submitRes.text();
    console.error(`Submit failed (${submitRes.status}):`, body);
    process.exit(1);
  }

  const job = await submitRes.json();
  console.log(`Job submitted! ID: ${job.messageId}`);

  // Poll for completion (max 5 minutes)
  const maxAttempts = 30;
  const pollInterval = 10_000;

  for (let i = 1; i <= maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const pollRes = await fetch(`${API_BASE}/message/${job.messageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!pollRes.ok) {
      console.error(`Poll failed (${pollRes.status})`);
      continue;
    }

    const status = await pollRes.json();
    console.log(
      `  Poll ${i}/${maxAttempts}: ${status.status} (${status.progress || 0}%)`,
    );

    if (status.status === "DONE") {
      console.log(`\nImage generated!`);
      console.log(`  Grid URL: ${status.uri}`);
      if (status.images?.length) {
        console.log(`  Individual images:`);
        status.images.forEach((url: string, idx: number) => {
          console.log(`    ${idx + 1}: ${url}`);
        });
      }
      return;
    }

    if (status.status === "FAIL") {
      console.error("\nImage generation failed.");
      process.exit(1);
    }
  }

  console.log("\nTimed out waiting for image generation (5 min max).");
  console.log(`Check manually: GET ${API_BASE}/message/${job.messageId}`);
}

main().catch((err) => {
  console.error("ImaginePro test failed:", err.message);
  process.exit(1);
});
