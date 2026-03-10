"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ImageIcon } from "lucide-react";

export function GenerateAllPinsButton() {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleGenerateAll() {
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/generate-all-pins", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`Generated ${data.processed} pins${data.failed ? `, ${data.failed} failed` : ""}`);
        router.refresh();
      } else {
        setResult(data.error || "Failed");
      }
    } catch {
      setResult("Network error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && (
        <span className="text-xs text-muted-foreground">{result}</span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleGenerateAll}
        disabled={generating}
      >
        <ImageIcon className="size-3.5" data-icon="inline-start" />
        {generating ? "Generating pins..." : "Generate All Pins"}
      </Button>
    </div>
  );
}
