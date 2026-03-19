"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink } from "lucide-react";
import type { PinData } from "./intel-tabs";

interface PinLookupFormProps {
  onResult: (pin: PinData | null) => void;
}

export function PinLookupForm({ onResult }: PinLookupFormProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    onResult(null);
    try {
      const res = await fetch("/api/admin/intel/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        onResult(data.pin ?? data);
      } else {
        setError(data.error || "Lookup failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          placeholder="Pinterest pin URL (e.g. https://pinterest.com/pin/123456)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="max-w-md"
          disabled={loading}
        />
        <Button type="submit" size="sm" disabled={loading || !url.trim()}>
          <ExternalLink className="size-3.5" data-icon="inline-start" />
          {loading ? "Looking up..." : "Lookup"}
        </Button>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
