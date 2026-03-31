// Pinterest Direct HTTP posting — replicates browser requests using session cookie auth.
// No API app approval needed; uses the same endpoints the Pinterest web UI does.

const PINTEREST_BASE = "https://www.pinterest.com";

// === Types ===

export interface DirectPinParams {
  boardId: string;
  title: string;
  description: string;
  imageUrl: string; // URL of image in Vercel Blob storage
  link: string;
  altText?: string;
}

export interface DirectPinResult {
  pinId: string;
}

// === Helpers ===

function extractCsrfToken(cookieString: string): string {
  const match = cookieString.match(/csrftoken=([^;]+)/);
  if (!match) {
    throw new Error(
      "Could not extract csrftoken from cookie string. Make sure your cookie header includes csrftoken.",
    );
  }
  return match[1];
}

function getBrowserHeaders(
  csrfToken: string,
  sessionCookie: string,
): Record<string, string> {
  return {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept: "application/json, text/javascript, */*, q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Referer: `${PINTEREST_BASE}/`,
    Origin: PINTEREST_BASE,
    "X-CSRFToken": csrfToken,
    "X-Requested-With": "XMLHttpRequest",
    Cookie: sessionCookie,
  };
}

async function uploadImage(
  imageBuffer: Buffer,
  fileName: string,
  sessionCookie: string,
): Promise<string> {
  const csrfToken = extractCsrfToken(sessionCookie);
  const headers = getBrowserHeaders(csrfToken, sessionCookie);

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: "image/jpeg" });
  formData.append("img", blob, fileName);

  // Remove Content-Type so fetch sets it with the multipart boundary
  const { "Accept-Encoding": _, ...uploadHeaders } = headers;

  const res = await fetch(`${PINTEREST_BASE}/upload-image/`, {
    method: "POST",
    headers: uploadHeaders,
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Pinterest upload failed (${res.status}): Session cookie may be expired. Re-login and paste a fresh cookie. Body: ${body}`,
      );
    }
    throw new Error(`Pinterest upload failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    image_url?: string;
    upload_id?: string;
    success?: boolean;
  };

  const imageUrl = data.image_url;
  if (!imageUrl) {
    throw new Error(
      `Pinterest upload response did not include image_url: ${JSON.stringify(data)}`,
    );
  }

  return imageUrl;
}

// === Public API ===

export async function createPinDirect(
  params: DirectPinParams,
  sessionCookie: string,
): Promise<DirectPinResult> {
  // 1. Download the image from Vercel Blob storage
  const imageRes = await fetch(params.imageUrl);
  if (!imageRes.ok) {
    throw new Error(
      `Failed to download image from ${params.imageUrl} (${imageRes.status})`,
    );
  }
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

  // Derive a filename from the URL
  const urlPath = new URL(params.imageUrl).pathname;
  const fileName = urlPath.split("/").pop() || "pin-image.jpg";

  // 2. Upload image to Pinterest
  const uploadedImageUrl = await uploadImage(
    imageBuffer,
    fileName,
    sessionCookie,
  );

  // 3. Create the pin
  const csrfToken = extractCsrfToken(sessionCookie);
  const headers = getBrowserHeaders(csrfToken, sessionCookie);

  const pinData = {
    options: {
      board_id: params.boardId,
      title: params.title,
      description: params.description,
      link: params.link,
      image_url: uploadedImageUrl,
      method: "uploaded",
      ...(params.altText ? { alt_text: params.altText } : {}),
    },
    context: {},
  };

  const body = new URLSearchParams({
    source_url: `/pin/create/button/`,
    data: JSON.stringify(pinData),
  });

  const res = await fetch(
    `${PINTEREST_BASE}/resource/PinResource/create/`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    },
  );

  if (!res.ok) {
    const responseBody = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Pinterest pin creation failed (${res.status}): Session cookie may be expired. Re-login and paste a fresh cookie. Body: ${responseBody}`,
      );
    }
    throw new Error(
      `Pinterest pin creation failed (${res.status}): ${responseBody}`,
    );
  }

  const result = (await res.json()) as {
    resource_response?: {
      data?: { id?: string };
    };
  };

  const pinId = result.resource_response?.data?.id;
  if (!pinId) {
    throw new Error(
      `Pinterest pin creation response did not include pin ID: ${JSON.stringify(result)}`,
    );
  }

  return { pinId };
}

export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}
