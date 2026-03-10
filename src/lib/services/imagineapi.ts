const IMAGINEPRO_API_BASE = "https://api.imaginepro.ai/api/v1/midjourney";

// === Types ===

interface ImagineProSubmitResponse {
  success: boolean;
  messageId: string;
  createdAt: string;
}

interface ImagineProStatusResponse {
  prompt: string;
  status: "PENDING" | "PROCESSING" | "DONE" | "FAIL";
  messageId: string;
  uri?: string;
  images?: string[];
  progress?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ImagineJobResponse {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  prompt: string;
  result?: string;
  upscaled_urls?: string[];
  created_at: string;
  updated_at: string;
}

// === Helpers ===

function getToken(): string {
  const token = process.env.IMAGINEAPI_TOKEN;
  if (!token) throw new Error("IMAGINEAPI_TOKEN is not set");
  return token;
}

function mapStatus(
  status: ImagineProStatusResponse["status"],
): ImagineJobResponse["status"] {
  switch (status) {
    case "PENDING":
      return "pending";
    case "PROCESSING":
      return "processing";
    case "DONE":
      return "completed";
    case "FAIL":
      return "failed";
    default:
      return "processing";
  }
}

// === Public API ===

export async function submitImagineJob(prompt: string): Promise<string> {
  const res = await fetch(`${IMAGINEPRO_API_BASE}/imagine`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ImaginePro submit error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as ImagineProSubmitResponse;
  if (!data.success || !data.messageId) {
    throw new Error("ImaginePro submit did not return a messageId");
  }

  return data.messageId;
}

export async function checkImagineJob(
  taskId: string,
): Promise<ImagineJobResponse> {
  const res = await fetch(
    `${IMAGINEPRO_API_BASE}/message/${encodeURIComponent(taskId)}`,
    {
      headers: { Authorization: `Bearer ${getToken()}` },
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ImaginePro status error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as ImagineProStatusResponse;

  // Pick the first individual image, or fall back to the grid URI
  const resultUrl = data.images?.[0] || data.uri;

  return {
    id: data.messageId,
    status: mapStatus(data.status),
    prompt: data.prompt,
    result: resultUrl,
    upscaled_urls: data.images,
    created_at: data.createdAt,
    updated_at: data.updatedAt,
  };
}
