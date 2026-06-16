import { db } from "@/lib/db";
import { pipelineConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ConfigKeys } from "@/lib/constants";

const PINTEREST_API_BASE = "https://api.pinterest.com/v5";

// === Types ===

export interface PinterestTrendKeyword {
  keyword: string;
  pct_growth_wow: number;
  pct_growth_mom: number;
  pct_growth_yoy: number;
}

export interface PinterestTrendsResponse {
  trends: PinterestTrendKeyword[];
}

export interface CreatePinParams {
  boardId: string;
  title: string;
  description: string;
  imageUrl: string;
  link: string;
  altText?: string;
}

export interface PinterestPin {
  id: string;
  title: string;
  description: string;
  link: string;
  board_id: string;
  media_source: Record<string, unknown>;
}

export interface PinterestBoard {
  id: string;
  name: string;
  description: string;
  privacy: string;
}

export interface PinterestUserAccount {
  username: string;
  profile_image: string;
  website_url: string;
}

// === Token Management ===

async function getConfigValue(key: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(pipelineConfig)
    .where(eq(pipelineConfig.key, key))
    .limit(1);
  return rows[0]?.value ?? null;
}

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

export async function getAppCredentials(): Promise<{ appId: string; appSecret: string }> {
  const appId = await getConfigValue(ConfigKeys.PINTEREST_APP_ID) ?? process.env.PINTEREST_APP_ID;
  const appSecret = await getConfigValue(ConfigKeys.PINTEREST_APP_SECRET) ?? process.env.PINTEREST_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("Pinterest App ID and App Secret are not configured. Set them in Admin > Config.");
  }
  return { appId, appSecret };
}

export async function refreshAccessToken(): Promise<string> {
  const refreshToken = await getConfigValue(ConfigKeys.PINTEREST_REFRESH_TOKEN);
  if (!refreshToken) {
    throw new Error("No Pinterest refresh token available");
  }

  const { appId, appSecret } = await getAppCredentials();

  const res = await fetch(`${PINTEREST_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Pinterest token refresh failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  await setConfigValue(ConfigKeys.PINTEREST_ACCESS_TOKEN, data.access_token);
  await setConfigValue(ConfigKeys.PINTEREST_TOKEN_EXPIRES_AT, expiresAt);
  if (data.refresh_token) {
    await setConfigValue(ConfigKeys.PINTEREST_REFRESH_TOKEN, data.refresh_token);
  }

  return data.access_token;
}

export async function getAccessToken(): Promise<string> {
  // 1. Check pipelineConfig for OAuth token
  const oauthToken = await getConfigValue(ConfigKeys.PINTEREST_ACCESS_TOKEN);
  if (oauthToken) {
    // Check expiry
    const expiresAt = await getConfigValue(ConfigKeys.PINTEREST_TOKEN_EXPIRES_AT);
    if (expiresAt) {
      const expiresDate = new Date(expiresAt);
      // Refresh if expires within 5 minutes
      if (expiresDate.getTime() - Date.now() < 5 * 60 * 1000) {
        try {
          return await refreshAccessToken();
        } catch {
          // If refresh fails but token isn't actually expired yet, use it
          if (expiresDate.getTime() > Date.now()) {
            return oauthToken;
          }
          // Otherwise fall through to env var
        }
      } else {
        return oauthToken;
      }
    } else {
      // No expiry info, use the token as-is
      return oauthToken;
    }
  }

  // 2. Fall back to env var
  const envToken = process.env.PINTEREST_ACCESS_TOKEN;
  if (!envToken) throw new Error("No Pinterest access token available");
  return envToken;
}

export async function getPinterestBoardId(): Promise<string> {
  // Check pipelineConfig first
  const configBoardId = await getConfigValue(ConfigKeys.PINTEREST_BOARD_ID);
  if (configBoardId) return configBoardId;

  // Fall back to env var
  const envBoardId = process.env.PINTEREST_BOARD_ID;
  if (!envBoardId) throw new Error("No Pinterest board ID configured");
  return envBoardId;
}

// === API Helpers ===

async function pinterestFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${PINTEREST_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Pinterest API error ${res.status} on ${path}: ${body}`,
    );
  }

  return res.json() as Promise<T>;
}

// === Public API ===

export async function fetchTrendingKeywords(
  region: string,
  trendType: "growing" | "monthly" | "yearly",
  // Optional Pinterest interest scope. Pass "food_and_drinks" to get the same
  // feed as trends.pinterest.com?topicInterestIds=918530398158. When omitted,
  // returns the general (unfiltered) trends — the original behavior.
  interests?: string,
): Promise<PinterestTrendKeyword[]> {
  const params = new URLSearchParams({ limit: "50" });
  if (interests) params.set("interests", interests);
  const data = await pinterestFetch<PinterestTrendsResponse>(
    `/trends/keywords/${encodeURIComponent(region)}/top/${encodeURIComponent(trendType)}?${params.toString()}`,
  );
  return data.trends;
}

export async function createPin(params: CreatePinParams): Promise<PinterestPin> {
  return pinterestFetch<PinterestPin>("/pins", {
    method: "POST",
    body: JSON.stringify({
      board_id: params.boardId,
      title: params.title,
      description: params.description,
      link: params.link,
      ...(params.altText ? { alt_text: params.altText } : {}),
      media_source: {
        source_type: "image_url",
        url: params.imageUrl,
      },
    }),
  });
}

// === Pin Analytics ===

export interface PinAnalyticsData {
  impressions: number;
  saves: number;
  clicks: number;
  closeups: number;
}

export async function fetchPinAnalytics(
  pinId: string
): Promise<PinAnalyticsData> {
  try {
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const data = await pinterestFetch<{
      all: {
        daily_metrics: Array<{
          data_status: string;
          metrics: Record<string, number>;
        }>;
      };
    }>(
      `/pins/${pinId}/analytics?start_date=${startDate}&end_date=${endDate}&metric_types=IMPRESSION,SAVE,PIN_CLICK,CLOSEUP&app_types=all`
    );

    let impressions = 0;
    let saves = 0;
    let clicks = 0;
    let closeups = 0;

    for (const day of data.all?.daily_metrics ?? []) {
      impressions += day.metrics?.IMPRESSION ?? 0;
      saves += day.metrics?.SAVE ?? 0;
      clicks += day.metrics?.PIN_CLICK ?? 0;
      closeups += day.metrics?.CLOSEUP ?? 0;
    }

    return { impressions, saves, clicks, closeups };
  } catch {
    // Fallback: try basic pin data for save_count
    try {
      const pin = await pinterestFetch<{ save_count?: number }>(`/pins/${pinId}`);
      return {
        impressions: 0,
        saves: pin.save_count ?? 0,
        clicks: 0,
        closeups: 0,
      };
    } catch {
      return { impressions: 0, saves: 0, clicks: 0, closeups: 0 };
    }
  }
}

export async function fetchUserAccount(): Promise<PinterestUserAccount> {
  return pinterestFetch<PinterestUserAccount>("/user_account");
}

export async function fetchBoards(): Promise<PinterestBoard[]> {
  const data = await pinterestFetch<{ items: PinterestBoard[] }>("/boards");
  return data.items;
}
