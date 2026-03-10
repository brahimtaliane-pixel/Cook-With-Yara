/**
 * Test Script: Pinterest API (Step 2)
 * Run: npx tsx scripts/test-pinterest.ts
 *
 * Fetches trending keywords to verify the access token works.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const PINTEREST_API_BASE = "https://api.pinterest.com/v5";

async function main() {
  const token = process.env.PINTEREST_ACCESS_TOKEN;
  const boardId = process.env.PINTEREST_BOARD_ID;

  if (!token) {
    console.error("PINTEREST_ACCESS_TOKEN is not set in .env.local");
    process.exit(1);
  }

  console.log("Testing Pinterest API...");
  console.log(`Token prefix: ${token.slice(0, 8)}...`);
  console.log(`Board ID: ${boardId || "(not set)"}`);

  // Test 1: Verify token by fetching user account
  console.log("\n--- Test 1: Fetch user account ---");
  const userRes = await fetch(`${PINTEREST_API_BASE}/user_account`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!userRes.ok) {
    const body = await userRes.text();
    console.error(`User account fetch failed (${userRes.status}):`, body);
    process.exit(1);
  }

  const user = await userRes.json();
  console.log(`Authenticated as: ${user.username}`);

  // Test 2: Fetch trending keywords
  console.log("\n--- Test 2: Fetch trending keywords ---");
  const trendsRes = await fetch(
    `${PINTEREST_API_BASE}/trends/keywords/US/top/growing`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!trendsRes.ok) {
    const body = await trendsRes.text();
    console.error(`Trends fetch failed (${trendsRes.status}):`, body);
    console.log(
      "Note: Trends API may require additional permissions or a business account.",
    );
  } else {
    const trends = await trendsRes.json();
    console.log(
      `Found ${trends.trends?.length || 0} trending keywords. Sample:`,
    );
    trends.trends?.slice(0, 5).forEach((t: { keyword: string }) => {
      console.log(`  - ${t.keyword}`);
    });
  }

  // Test 3: Verify board exists (if board ID is set)
  if (boardId) {
    console.log("\n--- Test 3: Verify board ---");
    const boardRes = await fetch(`${PINTEREST_API_BASE}/boards/${boardId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!boardRes.ok) {
      const body = await boardRes.text();
      console.error(`Board fetch failed (${boardRes.status}):`, body);
    } else {
      const board = await boardRes.json();
      console.log(`Board found: "${board.name}" (${board.id})`);
    }
  }

  console.log("\nPinterest API test complete!");
}

main().catch((err) => {
  console.error("Pinterest test failed:", err.message);
  process.exit(1);
});
