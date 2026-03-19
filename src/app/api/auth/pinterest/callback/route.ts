import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { pipelineConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ConfigKeys } from "@/lib/constants";

const PINTEREST_API_BASE = "https://api.pinterest.com/v5";

async function setConfigValue(key: string, value: string) {
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

export async function GET(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const appId = process.env.PINTEREST_APP_ID;
  const appSecret = process.env.PINTEREST_APP_SECRET;

  if (!siteUrl || !appId || !appSecret) {
    return NextResponse.redirect(
      `${siteUrl ?? ""}/admin/config?pinterest=error&reason=missing_env`,
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${siteUrl}/admin/config?pinterest=error&reason=${encodeURIComponent(error)}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${siteUrl}/admin/config?pinterest=error&reason=missing_params`,
    );
  }

  // Validate state against cookie
  const cookieStore = await cookies();
  const savedState = cookieStore.get("pinterest_oauth_state")?.value;
  cookieStore.delete("pinterest_oauth_state");

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(
      `${siteUrl}/admin/config?pinterest=error&reason=invalid_state`,
    );
  }

  // Exchange code for tokens
  const redirectUri = `${siteUrl}/api/auth/pinterest/callback`;

  const tokenRes = await fetch(`${PINTEREST_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error("Pinterest token exchange failed:", body);
    return NextResponse.redirect(
      `${siteUrl}/admin/config?pinterest=error&reason=token_exchange_failed`,
    );
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };

  const expiresAt = new Date(
    Date.now() + tokenData.expires_in * 1000,
  ).toISOString();

  // Store tokens in pipelineConfig
  await setConfigValue(ConfigKeys.PINTEREST_ACCESS_TOKEN, tokenData.access_token);
  await setConfigValue(ConfigKeys.PINTEREST_REFRESH_TOKEN, tokenData.refresh_token);
  await setConfigValue(ConfigKeys.PINTEREST_TOKEN_EXPIRES_AT, expiresAt);

  // Fetch user info
  try {
    const userRes = await fetch(`${PINTEREST_API_BASE}/user_account`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (userRes.ok) {
      const user = (await userRes.json()) as { username: string };
      await setConfigValue(ConfigKeys.PINTEREST_USER_NAME, user.username);
    }
  } catch (e) {
    console.error("Failed to fetch Pinterest user info:", e);
  }

  // Fetch boards
  try {
    const boardsRes = await fetch(`${PINTEREST_API_BASE}/boards`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (boardsRes.ok) {
      const boardsData = (await boardsRes.json()) as {
        items: { id: string; name: string; description: string; privacy: string }[];
      };
      await setConfigValue(
        ConfigKeys.PINTEREST_BOARDS,
        JSON.stringify(boardsData.items),
      );
    }
  } catch (e) {
    console.error("Failed to fetch Pinterest boards:", e);
  }

  return NextResponse.redirect(`${siteUrl}/admin/config?pinterest=connected`);
}
