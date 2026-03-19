"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ConfigKeys } from "@/lib/constants";

type ConfigMap = Record<string, string>;

interface PinterestStatus {
  connected: boolean;
  userName: string | null;
  selectedBoardId: string | null;
  boards: { id: string; name: string }[];
  tokenExpiresAt: string | null;
}

export default function ConfigPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading config...</p>
        </div>
      }
    >
      <ConfigPageInner />
    </Suspense>
  );
}

function ConfigPageInner() {
  const [config, setConfig] = useState<ConfigMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [pinterest, setPinterest] = useState<PinterestStatus | null>(null);
  const [pinterestLoading, setPinterestLoading] = useState(true);
  const [pinterestMessage, setPinterestMessage] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);
  const [savingBoard, setSavingBoard] = useState(false);

  const searchParams = useSearchParams();

  const fetchPinterestStatus = useCallback(() => {
    setPinterestLoading(true);
    fetch("/api/admin/pinterest/status")
      .then((r) => r.json())
      .then((data: PinterestStatus) => {
        setPinterest(data);
        setPinterestLoading(false);
      })
      .catch(() => setPinterestLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => r.json())
      .then((data: { config: ConfigMap }) => {
        setConfig(data.config);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetchPinterestStatus();
  }, [fetchPinterestStatus]);

  // Show message based on URL params from OAuth redirect
  useEffect(() => {
    const pinterestParam = searchParams.get("pinterest");
    if (pinterestParam === "connected") {
      setPinterestMessage("Pinterest connected successfully!");
      // Clear the URL params
      window.history.replaceState({}, "", "/admin/config");
    } else if (pinterestParam === "error") {
      const reason = searchParams.get("reason") ?? "unknown";
      setPinterestMessage(`Pinterest connection failed: ${reason}`);
      window.history.replaceState({}, "", "/admin/config");
    }
  }, [searchParams]);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (res.ok) {
        setMessage("Saved successfully.");
      } else {
        setMessage("Failed to save.");
      }
    } catch {
      setMessage("Failed to save.");
    }
    setSaving(false);
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setPinterestMessage("");
    try {
      const res = await fetch("/api/auth/pinterest/disconnect", {
        method: "POST",
      });
      if (res.ok) {
        setPinterestMessage("Pinterest disconnected.");
        fetchPinterestStatus();
      } else {
        setPinterestMessage("Failed to disconnect.");
      }
    } catch {
      setPinterestMessage("Failed to disconnect.");
    }
    setDisconnecting(false);
  }

  async function handleBoardSelect(boardId: string) {
    setSavingBoard(true);
    setPinterestMessage("");
    try {
      const res = await fetch("/api/admin/pinterest/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId }),
      });
      if (res.ok) {
        setPinterestMessage("Board saved.");
        fetchPinterestStatus();
      } else {
        setPinterestMessage("Failed to save board.");
      }
    } catch {
      setPinterestMessage("Failed to save board.");
    }
    setSavingBoard(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading config...</p>
      </div>
    );
  }

  const pipelineEnabled = config[ConfigKeys.PIPELINE_ENABLED] === "true";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Configuration</h1>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="pipeline-toggle">Pipeline Enabled</Label>
            <Switch
              id="pipeline-toggle"
              checked={pipelineEnabled}
              onCheckedChange={(checked: boolean) =>
                setConfig((prev) => ({
                  ...prev,
                  [ConfigKeys.PIPELINE_ENABLED]: String(checked),
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-articles">Max Articles Per Day</Label>
            <Input
              id="max-articles"
              type="number"
              min={1}
              max={50}
              value={config[ConfigKeys.MAX_ARTICLES_PER_DAY] ?? "5"}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  [ConfigKeys.MAX_ARTICLES_PER_DAY]: e.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-region">Target Region</Label>
            <Input
              id="target-region"
              value={config[ConfigKeys.TARGET_REGION] ?? "US"}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  [ConfigKeys.TARGET_REGION]: e.target.value,
                }))
              }
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            {message && (
              <p className="text-sm text-muted-foreground">{message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pinterest OAuth Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pinterest
            {pinterest?.connected && (
              <Badge variant="default">Connected</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pinterestLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading Pinterest status...
            </p>
          ) : pinterest?.connected ? (
            <>
              {/* Connected state */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Account:</span>
                  <span className="font-medium">{pinterest.userName ?? "Unknown"}</span>
                </div>

                {pinterest.tokenExpiresAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Token expires:</span>
                    <span>
                      {new Date(pinterest.tokenExpiresAt).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {/* Board selection */}
                {pinterest.boards.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="board-select">Board</Label>
                    <select
                      id="board-select"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={pinterest.selectedBoardId ?? ""}
                      disabled={savingBoard}
                      onChange={(e) => handleBoardSelect(e.target.value)}
                    >
                      <option value="">Select a board...</option>
                      {pinterest.boards.map((board) => (
                        <option key={board.id} value={board.id}>
                          {board.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect Pinterest"}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Disconnected state */}
              <p className="text-sm text-muted-foreground">
                Connect your Pinterest Business account to post pins directly
                from the admin panel.
              </p>
              <a
                href="/api/auth/pinterest"
                className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
              >
                Connect Pinterest
              </a>
            </>
          )}

          {pinterestMessage && (
            <p className="text-sm text-muted-foreground">{pinterestMessage}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
