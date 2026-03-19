"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function RefreshButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleRefresh() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/intel/refresh", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setResult(
          `Refreshed ${data.processed ?? 0} competitor${(data.processed ?? 0) !== 1 ? "s" : ""}`
        );
        router.refresh();
      } else {
        setResult(data.error || "Refresh failed");
      }
    } catch {
      setResult("Network error");
    } finally {
      setLoading(false);
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
        onClick={handleRefresh}
        disabled={loading}
      >
        <RefreshCw
          className={`size-3.5 ${loading ? "animate-spin" : ""}`}
          data-icon="inline-start"
        />
        {loading ? "Refreshing..." : "Refresh All"}
      </Button>
    </div>
  );
}
