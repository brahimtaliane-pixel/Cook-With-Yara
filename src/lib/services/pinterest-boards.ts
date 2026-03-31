import { fetchBoards, getAccessToken } from "@/lib/services/pinterest";
import { db } from "@/lib/db";
import { pipelineConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ConfigKeys } from "@/lib/constants";

const PINTEREST_API_BASE = "https://api.pinterest.com/v5";

// === Board Definitions ===

interface BoardDefinition {
  name: string;
  description: string;
  match: (title: string, recipeCategory: string) => boolean;
}

const BOARD_DEFINITIONS: BoardDefinition[] = [
  // Priority 1: Cooking method boards
  {
    name: "Air Fryer Recipes",
    description: "Crispy air fryer meals with less oil",
    match: (title) => /air fryer/i.test(title),
  },
  {
    name: "Instant Pot & Pressure Cooker",
    description: "Quick dump-and-go Instant Pot recipes",
    match: (title) => /instant pot/i.test(title),
  },
  {
    name: "Slow Cooker & Crockpot Meals",
    description: "Set-it-and-forget-it crockpot dinners",
    match: (title) => /slow cooker|crockpot/i.test(title),
  },
  // Priority 2: Diet
  {
    name: "Healthy & Light Meals",
    description: "Nutritious recipes for a balanced lifestyle",
    match: (title) => /healthy|low carb|high protein|keto|light/i.test(title),
  },
  // Priority 3: Category-based boards
  {
    name: "Soups & Stews",
    description: "Cozy, comforting soup and stew recipes",
    match: (title, cat) =>
      cat.toLowerCase() === "soup" ||
      /soup|stew|broth|chili/i.test(title),
  },
  {
    name: "Breakfast & Brunch Ideas",
    description: "Quick and healthy breakfast recipes",
    match: (_title, cat) => cat.toLowerCase() === "breakfast",
  },
  {
    name: "Desserts & Sweet Treats",
    description: "Cookies, cakes, muffins and irresistible desserts",
    match: (_title, cat) => {
      const c = cat.toLowerCase();
      return c === "dessert" || c === "bread";
    },
  },
  {
    name: "Appetizers & Snacks",
    description: "Easy dips, bites, and party appetizers",
    match: (_title, cat) => {
      const c = cat.toLowerCase();
      return c === "appetizer" || c === "snack";
    },
  },
  {
    name: "Salads & Sides",
    description: "Fresh salads and delicious side dishes",
    match: (_title, cat) => {
      const c = cat.toLowerCase();
      return c === "salad" || c === "side dish";
    },
  },
  // Priority 4: Default fallback
  {
    name: "Easy Dinner Recipes",
    description: "Delicious dinner ideas for busy weeknights",
    match: () => true, // catches everything else
  },
];

const DEFAULT_BOARD_NAME = "Easy Dinner Recipes";

// === Board Map Helpers ===

type BoardMap = Record<string, string>;

async function setConfigValue(key: string, value: string): Promise<void> {
  const existing = await db
    .select()
    .from(pipelineConfig)
    .where(eq(pipelineConfig.key, key))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(pipelineConfig)
      .set({ value, updatedAt: new Date() })
      .where(eq(pipelineConfig.key, key));
  } else {
    await db.insert(pipelineConfig).values({ key, value });
  }
}

export async function getBoardMap(): Promise<BoardMap> {
  const rows = await db
    .select()
    .from(pipelineConfig)
    .where(eq(pipelineConfig.key, ConfigKeys.PINTEREST_BOARD_MAP))
    .limit(1);

  if (rows[0]?.value) {
    try {
      return JSON.parse(rows[0].value) as BoardMap;
    } catch {
      // corrupted — rebuild
    }
  }

  // No map yet — create boards
  return ensureBoards();
}

// === Create Boards on Pinterest ===

export async function ensureBoards(): Promise<BoardMap> {
  // Fetch existing boards
  const existingBoards = await fetchBoards();
  const existingByName = new Map(
    existingBoards.map((b) => [b.name, b.id])
  );

  const boardMap: BoardMap = {};
  const created: string[] = [];

  const token = await getAccessToken();

  for (const def of BOARD_DEFINITIONS) {
    const existingId = existingByName.get(def.name);
    if (existingId) {
      boardMap[def.name] = existingId;
      continue;
    }

    // Create board via Pinterest API
    const res = await fetch(`${PINTEREST_API_BASE}/boards`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: def.name,
        description: def.description,
        privacy: "PUBLIC",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Failed to create board "${def.name}" (${res.status}): ${body}`
      );
    }

    const board = (await res.json()) as { id: string };
    boardMap[def.name] = board.id;
    created.push(def.name);
  }

  // Persist board map in config
  await setConfigValue(
    ConfigKeys.PINTEREST_BOARD_MAP,
    JSON.stringify(boardMap)
  );

  return boardMap;
}

// === Route Article → Board ===

export async function getBoardForArticle(
  title: string | null,
  recipeCategory: string | null | undefined
): Promise<string> {
  const boardMap = await getBoardMap();
  const t = title ?? "";
  const cat = recipeCategory ?? "";

  for (const def of BOARD_DEFINITIONS) {
    if (def.match(t, cat)) {
      const boardId = boardMap[def.name];
      if (boardId) return boardId;
    }
  }

  // Fallback to default board
  return boardMap[DEFAULT_BOARD_NAME] ?? Object.values(boardMap)[0] ?? "";
}

/**
 * Returns ALL matching board IDs for an article, ranked by specificity.
 * Excludes the fallback board from secondary results.
 */
export async function getBoardsForArticle(
  title: string | null,
  recipeCategory: string | null | undefined,
  maxBoards = 3
): Promise<string[]> {
  const boardMap = await getBoardMap();
  const t = title ?? "";
  const cat = recipeCategory ?? "";

  const matchedBoardIds: string[] = [];

  for (const def of BOARD_DEFINITIONS) {
    if (def.match(t, cat)) {
      const boardId = boardMap[def.name];
      if (boardId && !matchedBoardIds.includes(boardId)) {
        // Include fallback only as primary (first match)
        if (def.name === DEFAULT_BOARD_NAME && matchedBoardIds.length > 0) {
          continue;
        }
        matchedBoardIds.push(boardId);
        if (matchedBoardIds.length >= maxBoards) break;
      }
    }
  }

  // Always return at least the fallback
  if (matchedBoardIds.length === 0) {
    const fallback = boardMap[DEFAULT_BOARD_NAME] ?? Object.values(boardMap)[0] ?? "";
    if (fallback) matchedBoardIds.push(fallback);
  }

  return matchedBoardIds;
}
