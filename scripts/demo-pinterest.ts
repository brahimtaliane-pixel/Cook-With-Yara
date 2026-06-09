import { config } from "dotenv";
config({ path: ".env.local" });

import { fetchUserAccount, fetchBoards, createPin } from "../src/lib/services/pinterest";

function banner(label: string) {
  console.log("\n" + "=".repeat(70));
  console.log("  " + label);
  console.log("=".repeat(70));
}

async function main() {
  banner("ACTION 1 — GET /v5/user_account  (read authenticated user)");
  try {
    const user = await fetchUserAccount();
    console.log("Response:");
    console.log(JSON.stringify(user, null, 2));
  } catch (err) {
    console.log("ERROR:", err instanceof Error ? err.message : err);
  }

  banner("ACTION 2 — GET /v5/boards  (list this account's boards)");
  try {
    const boards = await fetchBoards();
    console.log(`Response: ${boards.length} board(s)`);
    console.log(JSON.stringify(boards.slice(0, 3), null, 2));
  } catch (err) {
    console.log("ERROR:", err instanceof Error ? err.message : err);
  }

  banner("ACTION 3 — POST /v5/pins  (attempt to create a Pin)");
  try {
    const boards = await fetchBoards();
    if (boards.length === 0) throw new Error("No board to post to");

    const params = {
      boardId: boards[0].id,
      title: "Olive Oil Banana Bread Recipe",
      description:
        "Incredibly moist banana bread made with olive oil, yogurt, and cardamom. From cookwithyara.com",
      link: "https://cookwithyara.com/recipes/banana-bread-recipe",
      imageUrl:
        "https://nk1j8oi1spstbbf1.public.blob.vercel-storage.com/recipes/banana-bread-recipe/pin.png",
      altText: "A slice of moist olive oil banana bread on a wooden board.",
    };

    console.log("Request body:");
    console.log(
      JSON.stringify(
        {
          board_id: params.boardId,
          title: params.title,
          description: params.description,
          link: params.link,
          alt_text: params.altText,
          media_source: { source_type: "image_url", url: params.imageUrl },
        },
        null,
        2,
      ),
    );

    const pin = await createPin(params);
    console.log("\nSuccess response:");
    console.log(JSON.stringify(pin, null, 2));
  } catch (err) {
    console.log("\nResponse (Pinterest error):");
    console.log(err instanceof Error ? err.message : err);
    console.log(
      "\n^^^ This is the exact error we're applying for production access to resolve.",
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
