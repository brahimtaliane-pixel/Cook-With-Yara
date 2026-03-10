/**
 * Test Script: Full Pipeline (Step 7)
 * Run: npx tsx scripts/test-pipeline.ts
 *
 * Hits each cron endpoint locally to test the full pipeline.
 * Start the dev server first: npm run dev
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const BASE_URL = "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET || "test-secret";

interface StepResult {
  name: string;
  status: "pass" | "fail" | "skip";
  response?: string;
  error?: string;
}

async function hitCron(path: string): Promise<{ ok: boolean; body: string }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  const body = await res.text();
  return { ok: res.ok, body };
}

async function testStep(name: string, path: string): Promise<StepResult> {
  try {
    console.log(`\nTesting: ${name}`);
    console.log(`  GET ${path}`);
    const { ok, body } = await hitCron(path);

    if (ok) {
      console.log(`  PASS`);
      return { name, status: "pass", response: body.slice(0, 200) };
    } else {
      console.log(`  FAIL: ${body.slice(0, 200)}`);
      return { name, status: "fail", error: body.slice(0, 200) };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  FAIL: ${msg}`);
    return { name, status: "fail", error: msg };
  }
}

async function main() {
  console.log("=== Cook With Lucia - Pipeline Test ===");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Cron Secret: ${CRON_SECRET.slice(0, 4)}...`);
  console.log("\nMake sure the dev server is running (npm run dev)\n");

  const steps = [
    { name: "Discover Keywords", path: "/api/cron/discover-keywords" },
    { name: "Approve Keywords", path: "/api/cron/approve-keywords" },
    { name: "Generate Content", path: "/api/cron/generate-content" },
    { name: "Submit Image", path: "/api/cron/submit-image" },
    { name: "Poll Images", path: "/api/cron/poll-images" },
    { name: "Create Pin Image", path: "/api/cron/create-pin-image" },
    { name: "Publish & Pin", path: "/api/cron/publish-and-pin" },
  ];

  const results: StepResult[] = [];

  for (const step of steps) {
    const result = await testStep(step.name, step.path);
    results.push(result);
  }

  // Summary
  console.log("\n=== Summary ===");
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;

  for (const r of results) {
    const icon = r.status === "pass" ? "[PASS]" : "[FAIL]";
    console.log(`  ${icon} ${r.name}`);
  }

  console.log(`\n${passed} passed, ${failed} failed out of ${results.length}`);

  if (failed > 0) {
    console.log(
      "\nSome steps failed. This is expected if APIs are not yet configured.",
    );
    console.log("Fix each step in order, then re-run this test.");
  }
}

main().catch((err) => {
  console.error("Pipeline test failed:", err.message);
  process.exit(1);
});
