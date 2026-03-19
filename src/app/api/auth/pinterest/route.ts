import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const appId = process.env.PINTEREST_APP_ID;
  if (!appId) {
    return NextResponse.json(
      { error: "PINTEREST_APP_ID is not configured" },
      { status: 500 },
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SITE_URL is not configured" },
      { status: 500 },
    );
  }

  // Generate random state for CSRF protection
  const state = crypto.randomUUID();

  // Store state in a cookie (httpOnly, 10 min expiry)
  const cookieStore = await cookies();
  cookieStore.set("pinterest_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  const redirectUri = `${siteUrl}/api/auth/pinterest/callback`;
  const scopes = "boards:read,boards:write,pins:read,pins:write,user_accounts:read";

  const authUrl = new URL("https://www.pinterest.com/oauth/");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
