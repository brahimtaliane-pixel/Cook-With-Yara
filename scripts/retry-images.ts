import { config } from "dotenv";
config({ path: ".env.local" });

const TOKEN = process.env.IMAGINEAPI_TOKEN!;
const BASE = "https://api.imaginepro.ai/api/v1/midjourney";

const jobs = [
  {
    keyword: "creamy chicken pasta",
    prompt: "Professional food photography of creamy chicken pasta in a rustic ceramic bowl, golden parmesan shavings, fresh basil garnish, soft natural lighting, shallow depth of field, dark moody background, overhead angle --ar 2:3 --v 6",
  },
  {
    keyword: "ground beef stir fry",
    prompt: "Photorealistic ground beef stir fry in a traditional black wok, vibrant red and green bell peppers, steaming hot, wooden spatula, dark kitchen background, dramatic side lighting, food magazine quality --ar 2:3 --v 6",
  },
];

async function submit(prompt: string): Promise<string> {
  const res = await fetch(`${BASE}/imagine`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  console.log("Submit response:", JSON.stringify(data));
  if (!data.messageId) throw new Error("No messageId: " + JSON.stringify(data));
  return data.messageId;
}

async function poll(messageId: string, keyword: string): Promise<string> {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    const res = await fetch(`${BASE}/message/${messageId}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const data = await res.json();
    if (data.status === "DONE") {
      const url = data.images?.[0] || data.uri;
      console.log(`[${keyword}] Done: ${url}`);
      return url;
    }
    if (data.status === "FAIL") throw new Error(`[${keyword}] FAILED`);
    console.log(`[${keyword}] ${data.status} (${data.progress || 0}%)`);
  }
  throw new Error("Timed out");
}

async function main() {
  console.log("Retrying 2 failed images...\n");

  const submitted: { keyword: string; messageId: string }[] = [];
  for (const job of jobs) {
    const messageId = await submit(job.prompt);
    console.log(`[${job.keyword}] Submitted: ${messageId}\n`);
    submitted.push({ keyword: job.keyword, messageId });
    await new Promise((r) => setTimeout(r, 6000));
  }

  console.log("Polling...\n");
  const results = await Promise.all(submitted.map((s) => poll(s.messageId, s.keyword)));

  console.log("\n=== RESULTS ===");
  results.forEach((url, i) => console.log(`${jobs[i].keyword}: ${url}`));
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
