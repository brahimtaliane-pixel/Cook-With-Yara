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
}

export interface PinterestPin {
  id: string;
  title: string;
  description: string;
  link: string;
  board_id: string;
  media_source: Record<string, unknown>;
}

// === Helpers ===

function getAccessToken(): string {
  const token = process.env.PINTEREST_ACCESS_TOKEN;
  if (!token) throw new Error("PINTEREST_ACCESS_TOKEN is not set");
  return token;
}

async function pinterestFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${PINTEREST_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
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
): Promise<PinterestTrendKeyword[]> {
  const data = await pinterestFetch<PinterestTrendsResponse>(
    `/trends/keywords/${encodeURIComponent(region)}/top/${encodeURIComponent(trendType)}`,
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
      media_source: {
        source_type: "image_url",
        url: params.imageUrl,
      },
    }),
  });
}
