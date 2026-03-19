"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus } from "lucide-react";

export function AddCompetitorForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = username.trim().replace(/^@/, "").replace(/\//g, "");
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/intel/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });
      if (res.ok) {
        setUsername("");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to add competitor");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        placeholder="Pinterest username (e.g. pinchofyum)"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="max-w-xs"
        disabled={loading}
      />
      <Button type="submit" size="sm" disabled={loading || !username.trim()}>
        <UserPlus className="size-3.5" data-icon="inline-start" />
        {loading ? "Adding & fetching pins..." : "Add"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </form>
  );
}
