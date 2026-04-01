import { XMLParser } from "fast-xml-parser";

// === Types ===

export interface RssPin {
  pinId: string;
  title: string;
  description: string;
  imageUrl: string;
  linkUrl: string;
  publishedAt: string | null;
}

export interface WidgetPinData {
  saves: number;
  repins: number;
  creatorName: string;
  creatorFollowers: number;
  boardName: string;
  imageUrl: string;
  description: string;
  title: string;
  domain: string;
  createdAt: string | null;
}

// === Enriched pin (Apify already has all widget data) ===

export interface EnrichedPin {
  pinId: string;
  title: string;
  description: string;
  imageUrl: string;
  linkUrl: string;
  saves: number;
  repins: number;
  velocity: number;
  creatorName: string;
  creatorFollowers: number;
  boardName: string;
  domain: string;
  pinCreatedAt: Date | null;
}

// === RSS Feed ===

export async function fetchCompetitorRss(
  username: string
): Promise<RssPin[]> {
  const url = `https://www.pinterest.com/${username}/feed.rss`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; CookWithLucia/1.0; +https://cookwithlucia.com)",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`RSS fetch failed for ${username}: ${res.status}`);
  }

  const xml = await res.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const parsed = parser.parse(xml);

  const items = parsed?.rss?.channel?.item;
  if (!items) return [];

  const itemArray = Array.isArray(items) ? items : [items];

  return itemArray.map((item: Record<string, string>) => {
    const link = item.link || item.guid || "";
    const pinId = extractPinIdFromUrl(link);
    const description = item.description || "";

    // Extract image from description HTML (RSS embeds it as <img>)
    const imgMatch = description.match(/src="([^"]+)"/);
    const imageUrl = imgMatch?.[1] || "";

    // Strip HTML tags for clean description
    const cleanDesc = description.replace(/<[^>]*>/g, "").trim();

    return {
      pinId: pinId || "",
      title: item.title || cleanDesc.slice(0, 100) || "Untitled",
      description: cleanDesc,
      imageUrl,
      linkUrl: link,
      publishedAt: item.pubDate || null,
    };
  }).filter((p: RssPin) => p.pinId);
}

// === Widget API (free, no auth) ===

export async function enrichPinsViaWidget(
  pinIds: string[]
): Promise<Map<string, WidgetPinData>> {
  const result = new Map<string, WidgetPinData>();
  const batchSize = 50;

  for (let i = 0; i < pinIds.length; i += batchSize) {
    const batch = pinIds.slice(i, i + batchSize);
    const ids = batch.join(",");
    const url = `https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=${ids}`;

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; CookWithLucia/1.0; +https://cookwithlucia.com)",
        },
        next: { revalidate: 0 },
      });

      if (!res.ok) {
        console.error(`Widget API batch failed: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const pins = data?.data ?? [];

      for (const pin of pins) {
        const id = String(pin.id);
        const aggregatedSaves = pin.aggregated_pin_data?.aggregated_stats?.saves;
        result.set(id, {
          saves: aggregatedSaves ?? pin.repin_count ?? 0,
          repins: pin.repin_count ?? 0,
          creatorName: pin.pinner?.full_name ?? "",
          creatorFollowers: pin.pinner?.follower_count ?? 0,
          boardName: pin.board?.name ?? "",
          imageUrl:
            pin.images?.["564x"]?.url ??
            pin.images?.orig?.url ??
            "",
          description: pin.description ?? "",
          title: pin.rich_metadata?.title ?? pin.grid_title ?? "",
          domain: pin.domain ?? pin.rich_metadata?.site_name ?? "",
          createdAt: pin.created_at ?? null,
        });
      }
    } catch (err) {
      console.error("Widget API error:", err);
    }
  }

  return result;
}

// === Apify Pinterest Search ===

export async function searchPinterestViaApify(
  query: string,
  limit = 25
): Promise<RssPin[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("APIFY_TOKEN not configured");
  }

  const actorUrl =
    "https://api.apify.com/v2/acts/epctex~pinterest-scraper/run-sync-get-dataset-items";

  const res = await fetch(`${actorUrl}?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      search: query,
      maxItems: limit,
      proxy: { useApifyProxy: true },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify search failed: ${res.status} ${text}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = await res.json();

  return items.map((item) => {
    const url = item.url || "";
    const pinId = item.id ? String(item.id) : extractPinIdFromUrl(url) || "";
    const imageUrl =
      item.images?.["564x"]?.url ??
      item.images?.orig?.url ??
      item.image_medium_url ??
      "";

    return {
      pinId,
      title: item.title || item.grid_title || item.seo_title || "",
      description: item.description || item.seo_description || "",
      imageUrl,
      linkUrl: url,
      publishedAt: item.created_at || null,
    };
  }).filter((p: RssPin) => p.pinId);
}

// === Deep Competitor Scrape (Pinterest Resource API) ===
// Uses Pinterest's internal UserPinsResource API with pagination.
// Free, fast, and returns ALL of a user's pins in reverse chronological order.
// Pins are then enriched via Widget API for saves/repins data.

const RESOURCE_API_PAGE_SIZE = 25;
const RESOURCE_API_MAX_PAGES = 20;

interface ResourceApiPin {
  pinId: string;
  title: string;
  description: string;
  imageUrl: string;
  createdAt: string | null;
  domain: string;
  saves: number;
  repins: number;
  creatorName: string;
  creatorFollowers: number;
  boardName: string;
}

async function getPinterestSession(username: string): Promise<{
  cookies: string;
  csrfToken: string;
} | null> {
  const res = await fetch(`https://www.pinterest.com/${username}/`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
  });

  if (!res.ok) {
    console.error(`[pinterest] Failed to load profile for ${username}: ${res.status}`);
    return null;
  }

  // Consume body to release connection
  await res.text();

  const setCookies = res.headers.getSetCookie?.() || [];
  const cookies = setCookies.map((c) => c.split(";")[0]).join("; ");
  const csrfMatch = cookies.match(/csrftoken=([a-f0-9]+)/);
  const csrfToken = csrfMatch?.[1] || "";

  if (!csrfToken) {
    console.error(`[pinterest] No CSRF token found for ${username}`);
    return null;
  }

  return { cookies, csrfToken };
}

async function fetchUserPinsPage(
  username: string,
  session: { cookies: string; csrfToken: string },
  bookmark: string | null
): Promise<{ pins: ResourceApiPin[]; nextBookmark: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: Record<string, any> = {
    field_set_key: "detailed",
    username,
    page_size: RESOURCE_API_PAGE_SIZE,
  };
  if (bookmark) options.bookmarks = [bookmark];

  const formData = new URLSearchParams();
  formData.set("source_url", `/${username}/_created/`);
  formData.set("data", JSON.stringify({ options, context: {} }));

  const res = await fetch(
    "https://www.pinterest.com/resource/UserPinsResource/get/",
    {
      method: "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "X-CSRFToken": session.csrfToken,
        "X-Pinterest-AppState": "active",
        Cookie: session.cookies,
        Referer: `https://www.pinterest.com/${username}/`,
      },
      body: formData.toString(),
    }
  );

  if (!res.ok) {
    return { pins: [], nextBookmark: null };
  }

  const json = await res.json();
  const data = json?.resource_response?.data;
  const nextBookmark = json?.resource_response?.bookmark ?? null;

  if (!Array.isArray(data) || data.length === 0) {
    return { pins: [], nextBookmark: null };
  }

  const pins: ResourceApiPin[] = [];
  for (const item of data) {
    const pinIdMatch = item.seo_url?.match(/\/pin\/(\d+)/);
    const pinId = pinIdMatch?.[1] || (item.id ? String(item.id) : "");
    if (pinId) {
      const aggregatedSaves = item.aggregated_pin_data?.aggregated_stats?.saves;
      pins.push({
        pinId,
        title: item.seo_title || item.grid_title || item.title || "",
        description: item.description || item.closeup_description || "",
        imageUrl:
          item.images?.["564x"]?.url ??
          item.images?.["236x"]?.url ??
          item.images?.orig?.url ??
          item.image_medium_url ??
          "",
        createdAt: item.created_at || null,
        domain: item.link_domain?.id || item.domain || "",
        saves: aggregatedSaves ?? item.repin_count ?? 0,
        repins: item.repin_count ?? 0,
        creatorName: item.pinner?.full_name ?? "",
        creatorFollowers: item.pinner?.follower_count ?? 0,
        boardName: item.board?.name ?? "",
      });
    }
  }

  return {
    pins,
    nextBookmark: nextBookmark === "-end-" ? null : nextBookmark,
  };
}

export async function scrapeCompetitorProfileViaApify(
  username: string,
  _maxItems = 200
): Promise<EnrichedPin[]> {
  // Despite the function name (kept for backward compatibility), this now uses
  // Pinterest's Resource API instead of Apify. Free and reliable.

  const session = await getPinterestSession(username);
  if (!session) return [];

  // Paginate through pins, stopping when we pass the 30-day window
  const allResourcePins: ResourceApiPin[] = [];
  let bookmark: string | null = null;
  let page = 0;
  let stoppedEarly = false;

  while (page < RESOURCE_API_MAX_PAGES) {
    page++;
    const { pins, nextBookmark } = await fetchUserPinsPage(
      username,
      session,
      bookmark
    );

    if (pins.length === 0) break;
    allResourcePins.push(...pins);

    // Pins are in reverse chronological order — if the oldest pin in this page
    // is older than 30 days, we have all recent pins and can stop
    const oldestPin = pins[pins.length - 1];
    if (oldestPin.createdAt && !isRecentPin(oldestPin.createdAt, 30)) {
      stoppedEarly = true;
      break;
    }

    if (!nextBookmark) break;
    bookmark = nextBookmark;
  }

  console.log(
    `[pinterest-resource] @${username}: ${allResourcePins.length} pins from ${page} pages${stoppedEarly ? " (stopped: past 30d)" : ""}`
  );

  // Filter to last 30 days
  const recentPins = allResourcePins.filter((p) =>
    isRecentPin(p.createdAt, 30)
  );

  if (recentPins.length === 0) return [];

  // Try Widget API enrichment for additional data (saves, high-res images)
  // but don't depend on it — Resource API already has most data
  const pinIds = recentPins.map((p) => p.pinId);
  let widgetData = new Map<string, WidgetPinData>();
  try {
    widgetData = await enrichPinsViaWidget(pinIds);
  } catch (err) {
    console.warn(`[pinterest-resource] Widget API enrichment failed, using Resource API data only:`, err);
  }

  // Build enriched pins — prefer Resource API data, overlay Widget data when available
  const enriched: EnrichedPin[] = [];
  for (const pin of recentPins) {
    const wd = widgetData.get(pin.pinId);
    // Use whichever source has better data
    const saves = Math.max(pin.saves, wd?.saves ?? 0);
    const pinCreatedAt = pin.createdAt
      ? new Date(pin.createdAt)
      : wd?.createdAt
        ? new Date(wd.createdAt)
        : null;
    const velocity = computeVelocity(saves, pinCreatedAt);

    enriched.push({
      pinId: pin.pinId,
      title: pin.title || wd?.title || "",
      description: pin.description || wd?.description || "",
      imageUrl: pin.imageUrl || wd?.imageUrl || "",
      linkUrl: `https://www.pinterest.com/pin/${pin.pinId}/`,
      saves,
      repins: Math.max(pin.repins, wd?.repins ?? 0),
      velocity,
      creatorName: pin.creatorName || wd?.creatorName || username,
      creatorFollowers: Math.max(pin.creatorFollowers, wd?.creatorFollowers ?? 0),
      boardName: pin.boardName || wd?.boardName || "",
      domain: pin.domain || wd?.domain || "",
      pinCreatedAt,
    });
  }

  console.log(
    `[pinterest-resource] @${username}: ${recentPins.length} recent pins, ${enriched.filter((p) => p.imageUrl).length} with images, ${enriched.filter((p) => p.saves > 0).length} with saves > 0`
  );

  return enriched;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseApifyItems(items: any[]): EnrichedPin[] {
  return items
    .map((item) => {
      if (item.type && item.type !== "pin") return null;

      const url = item.url || "";
      const pinId = item.id ? String(item.id) : extractPinIdFromUrl(url) || "";
      if (!pinId) return null;

      const imageUrl =
        item.images?.["564x"]?.url ??
        item.images?.orig?.url ??
        item.image_medium_url ??
        "";

      const aggregatedSaves = item.aggregated_pin_data?.aggregated_stats?.saves;
      const saves = aggregatedSaves ?? item.repin_count ?? 0;
      const pinCreatedAt = item.created_at ? new Date(item.created_at) : null;
      const velocity = computeVelocity(saves, pinCreatedAt);

      return {
        pinId,
        title: item.rich_metadata?.title || item.title || item.grid_title || item.seo_title || "",
        description: item.description || item.seo_description || "",
        imageUrl,
        linkUrl: url,
        saves,
        repins: item.repin_count ?? 0,
        velocity,
        creatorName: item.pinner?.full_name ?? "",
        creatorFollowers: item.pinner?.follower_count ?? 0,
        boardName: item.board?.name ?? "",
        domain: item.domain ?? item.rich_metadata?.site_name ?? "",
        pinCreatedAt,
      };
    })
    .filter((p): p is EnrichedPin => p !== null);
}

// === Repin Detection (Pinterest Resource API) ===

async function getPublicCsrf(): Promise<{
  cookies: string;
  csrfToken: string;
} | null> {
  const res = await fetch("https://www.pinterest.com/", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
  });

  if (!res.ok) return null;
  await res.text();

  const setCookies = res.headers.getSetCookie?.() || [];
  const cookies = setCookies.map((c) => c.split(";")[0]).join("; ");
  const csrfMatch = cookies.match(/csrftoken=([a-f0-9]+)/);
  const csrfToken = csrfMatch?.[1] || "";

  if (!csrfToken) return null;
  return { cookies, csrfToken };
}

/**
 * Check which pins are repins (someone saving an existing pin to their board).
 * Uses Pinterest's PinResource/get endpoint with a public CSRF token.
 * Returns a Set of pin IDs that are repins.
 */
export async function checkRepinStatus(
  pinIds: string[]
): Promise<Set<string>> {
  const repinIds = new Set<string>();
  if (pinIds.length === 0) return repinIds;

  const session = await getPublicCsrf();
  if (!session) {
    console.warn("[repin-check] Could not get CSRF token, skipping repin check");
    return repinIds;
  }

  const BATCH_SIZE = 10;
  for (let i = 0; i < pinIds.length; i += BATCH_SIZE) {
    const batch = pinIds.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (pinId) => {
        try {
          const data = JSON.stringify({
            options: { id: pinId, field_set_key: "detailed" },
            context: {},
          });
          const url = `https://www.pinterest.com/resource/PinResource/get/?data=${encodeURIComponent(data)}&source_url=/pin/${pinId}/`;

          const res = await fetch(url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Accept: "application/json",
              "X-Requested-With": "XMLHttpRequest",
              "X-CSRFToken": session.csrfToken,
              Cookie: session.cookies,
              Referer: "https://www.pinterest.com/",
            },
          });

          if (!res.ok) return;

          const json = await res.json();
          const pin = json?.resource_response?.data;
          if (!pin) return;

          // A pin is a repin if origin_pinner differs from pinner
          const isRepin =
            pin.is_repin === true ||
            (pin.origin_pinner &&
              pin.pinner &&
              pin.origin_pinner.id !== pin.pinner.id);

          if (isRepin) {
            repinIds.add(pinId);
          }
        } catch {
          // Skip individual pin failures
        }
      })
    );
  }

  if (repinIds.size > 0) {
    console.log(`[repin-check] Found ${repinIds.size} repins out of ${pinIds.length} pins`);
  }

  return repinIds;
}


// === URL Parsing ===

export function extractPinIdFromUrl(url: string): string | null {
  // Match pinterest.com/pin/123456/ or pinterest.com/pin/123456
  const match = url.match(/pinterest\.com\/pin\/(\d+)/);
  return match?.[1] ?? null;
}

// === Velocity Calculation ===

export function computeVelocity(
  saves: number,
  pinCreatedAt: Date | string | null
): number {
  if (!pinCreatedAt || saves <= 0) return 0;

  const created =
    typeof pinCreatedAt === "string" ? new Date(pinCreatedAt) : pinCreatedAt;
  const now = new Date();
  const daysOld = Math.max(
    1,
    (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
  );

  return Math.round(saves / daysOld);
}

export function isRecentPin(
  createdAt: Date | string | null,
  maxDaysOld = 60
): boolean {
  if (!createdAt) return false;
  const created =
    typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const daysOld =
    (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
  return daysOld <= maxDaysOld;
}
