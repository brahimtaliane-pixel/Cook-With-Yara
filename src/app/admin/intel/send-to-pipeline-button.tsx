"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, SendHorizonal, Loader2, AlertCircle } from "lucide-react";

interface SendToPipelineButtonProps {
  pinId: string;
  initialSent: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  creating: "Creating...",
  content: "Writing article...",
  image: "Generating image...",
  image_done: "Image ready!",
  pins: "Creating pins...",
  publishing: "Publishing...",
  done: "Published!",
};

export function SendToPipelineButton({
  pinId,
  initialSent,
}: SendToPipelineButtonProps) {
  const [sent, setSent] = useState(initialSent);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [stageMessage, setStageMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  async function handleSend() {
    setLoading(true);
    setError(null);
    setStage(null);

    try {
      const res = await fetch("/api/admin/intel/send-to-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed");
        setLoading(false);
        return;
      }

      // Read SSE stream
      const reader = res.body?.getReader();
      if (!reader) {
        setError("No response stream");
        setLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const chunk of lines) {
          const dataLine = chunk
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!dataLine) continue;

          try {
            const data = JSON.parse(dataLine.slice(6));
            setStage(data.stage);
            setStageMessage(data.message);

            if (data.stage === "done") {
              setSent(true);
              setPublishedUrl(data.url || null);
            } else if (data.stage === "error") {
              setError(data.message);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (error) {
    return (
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="xs"
          onClick={handleSend}
          className="text-destructive"
        >
          <AlertCircle className="size-3" data-icon="inline-start" />
          Retry
        </Button>
        <span className="text-[10px] text-destructive max-w-[120px] truncate">
          {error}
        </span>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="xs" disabled className="text-green-600">
          <Check className="size-3" data-icon="inline-start" />
          Published
        </Button>
        {publishedUrl && (
          <a
            href={publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-muted-foreground hover:text-foreground underline"
          >
            View
          </a>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <Button variant="outline" size="xs" disabled className="min-w-[140px]">
        <Loader2 className="size-3 animate-spin" data-icon="inline-start" />
        {stageMessage || STAGE_LABELS[stage || ""] || "Processing..."}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="xs"
      onClick={handleSend}
      disabled={loading}
    >
      <SendHorizonal className="size-3" data-icon="inline-start" />
      To Pipeline
    </Button>
  );
}
