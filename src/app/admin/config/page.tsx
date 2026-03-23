"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ConfigKeys } from "@/lib/constants";

type ConfigMap = Record<string, string>;

interface PinterestStatus {
  appConfigured: boolean;
  savedAppId: string;
  savedAppSecret: string;
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

  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);

  const searchParams = useSearchParams();

  const fetchPinterestStatus = useCallback(() => {
    setPinterestLoading(true);
    fetch("/api/admin/pinterest/status")
      .then((r) => r.json())
      .then((data: PinterestStatus) => {
        setPinterest(data);
        setAppId(data.savedAppId);
        setAppSecret(data.savedAppSecret);
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

  useEffect(() => {
    const pinterestParam = searchParams.get("pinterest");
    if (pinterestParam === "connected") {
      setPinterestMessage("Pinterest connected successfully!");
      fetchPinterestStatus();
      window.history.replaceState({}, "", "/admin/config");
    } else if (pinterestParam === "error") {
      const reason = searchParams.get("reason") ?? "unknown";
      const messages: Record<string, string> = {
        missing_app_credentials: "Enter your Pinterest App ID and App Secret first, then try connecting again.",
        token_exchange_failed: "Token exchange failed. Check your App ID and App Secret.",
        invalid_state: "Invalid state — try connecting again.",
      };
      setPinterestMessage(messages[reason] ?? `Connection failed: ${reason}`);
      window.history.replaceState({}, "", "/admin/config");
    }
  }, [searchParams, fetchPinterestStatus]);

  function updateConfig(key: string, value: string) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

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

  async function handleSaveCredentials() {
    setSavingCreds(true);
    setPinterestMessage("");
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            [ConfigKeys.PINTEREST_APP_ID]: appId,
            [ConfigKeys.PINTEREST_APP_SECRET]: appSecret,
          },
        }),
      });
      if (res.ok) {
        setPinterestMessage("Credentials saved.");
        fetchPinterestStatus();
      } else {
        setPinterestMessage("Failed to save credentials.");
      }
    } catch {
      setPinterestMessage("Failed to save credentials.");
    }
    setSavingCreds(false);
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
  const autopilotEnabled = config[ConfigKeys.AUTOPILOT_ENABLED] === "true";
  const pinterestMode = config[ConfigKeys.PINTEREST_MODE] ?? "api";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Configuration</h1>

      {/* Pipeline Master Switch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pipeline
            <Badge variant={pipelineEnabled ? "default" : "secondary"}>
              {pipelineEnabled ? "Active" : "Off"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Master switch for the entire content pipeline. When off, all crons stop processing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              id="pipeline-toggle"
              checked={pipelineEnabled}
              onCheckedChange={(checked: boolean) =>
                updateConfig(ConfigKeys.PIPELINE_ENABLED, String(checked))
              }
            />
            <Label htmlFor="pipeline-toggle">Enable Pipeline</Label>
          </div>
        </CardContent>
      </Card>

      {/* Article Production */}
      <Card>
        <CardHeader>
          <CardTitle>Article Production</CardTitle>
          <CardDescription>
            Controls how many articles get written and published per day
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="max-articles">Max Articles Per Day</Label>
            <Input
              id="max-articles"
              type="number"
              min={1}
              max={50}
              value={config[ConfigKeys.MAX_ARTICLES_PER_DAY] ?? "5"}
              onChange={(e) => updateConfig(ConfigKeys.MAX_ARTICLES_PER_DAY, e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Limits how many new articles can be created per day (applies to both auto-pilot and keyword approval). Each article uses ~$0.15 in AI costs.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-region">Target Region</Label>
            <Input
              id="target-region"
              value={config[ConfigKeys.TARGET_REGION] ?? "US"}
              onChange={(e) => updateConfig(ConfigKeys.TARGET_REGION, e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Region for keyword discovery (e.g. US, UK, CA)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Pilot */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Auto-Pilot
            <Badge variant={autopilotEnabled ? "default" : "secondary"}>
              {autopilotEnabled ? "Active" : "Off"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Automatically selects trending Pinterest pins and creates articles. Runs 3x/day.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3">
            <Switch
              id="autopilot-toggle"
              checked={autopilotEnabled}
              onCheckedChange={(checked: boolean) =>
                updateConfig(ConfigKeys.AUTOPILOT_ENABLED, String(checked))
              }
            />
            <Label htmlFor="autopilot-toggle">Enable Auto-Pilot</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="autopilot-score">Minimum Trend Score (0-100)</Label>
            <Input
              id="autopilot-score"
              type="number"
              min={0}
              max={100}
              value={config[ConfigKeys.AUTOPILOT_MIN_SCORE] ?? "65"}
              onChange={(e) => updateConfig(ConfigKeys.AUTOPILOT_MIN_SCORE, e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              85+ = Must Write, 65-84 = Strong, 45-64 = Promising. Higher = fewer but stronger picks.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="autopilot-max">Max Pins Per Run</Label>
            <Input
              id="autopilot-max"
              type="number"
              min={1}
              max={10}
              value={config[ConfigKeys.AUTOPILOT_MAX_PER_RUN] ?? "2"}
              onChange={(e) => updateConfig(ConfigKeys.AUTOPILOT_MAX_PER_RUN, e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              How many pins to select per auto-pilot run (3 runs/day). E.g. 2 per run = up to 6 articles/day.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pinterest Posting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pinterest Posting
            <Badge variant={pinterestMode === "direct" ? "secondary" : "default"}>
              {pinterestMode === "direct" ? "Direct HTTP" : "API"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Controls how pins get posted — via official API or direct session cookie
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="pins-per-day">Max Pins Per Day</Label>
            <Input
              id="pins-per-day"
              type="number"
              min={1}
              max={100}
              value={config[ConfigKeys.MAX_PINS_PER_DAY] ?? "40"}
              onChange={(e) => updateConfig(ConfigKeys.MAX_PINS_PER_DAY, e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Total pins posted per day. 2 pin designs per article, so 20 articles = 40 pins.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pins-per-run">Pins Per Cron Run</Label>
            <Input
              id="pins-per-run"
              type="number"
              min={1}
              max={10}
              value={config[ConfigKeys.PINS_PER_CRON_RUN] ?? "1"}
              onChange={(e) => updateConfig(ConfigKeys.PINS_PER_CRON_RUN, e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              How many pins to post each cron run (every 15 min). 1 = safe &amp; natural, 3 = faster throughput.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pinterest-mode">Posting Mode</Label>
            <select
              id="pinterest-mode"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={pinterestMode}
              onChange={(e) => updateConfig(ConfigKeys.PINTEREST_MODE, e.target.value)}
            >
              <option value="api">API (Official — requires approved app)</option>
              <option value="direct">Direct HTTP (Session cookie — no app needed)</option>
            </select>
          </div>

          {pinterestMode === "direct" && (
            <div className="space-y-2">
              <Label htmlFor="pinterest-cookie">Session Cookie</Label>
              <textarea
                id="pinterest-cookie"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                placeholder="_pinterest_sess=YOUR_VALUE; csrftoken=YOUR_VALUE"
                value={config[ConfigKeys.PINTEREST_SESSION_COOKIE] ?? ""}
                onChange={(e) => updateConfig(ConfigKeys.PINTEREST_SESSION_COOKIE, e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Get from browser DevTools → Application → Cookies → pinterest.com. Paste the full cookie string.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save All Settings"}
        </Button>
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </div>

      {/* Pinterest OAuth Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pinterest Account
            {pinterest?.connected && (
              <Badge variant="default">Connected</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Connect your Pinterest account for API mode posting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {pinterestLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading Pinterest status...
            </p>
          ) : pinterest?.connected ? (
            <>
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
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter your Pinterest API credentials from the{" "}
                  <a
                    href="https://developers.pinterest.com/apps/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    Pinterest Developer Console
                  </a>
                  , then connect your account.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="pinterest-app-id">App ID</Label>
                  <Input
                    id="pinterest-app-id"
                    placeholder="e.g. 1234567890"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pinterest-app-secret">App Secret</Label>
                  <Input
                    id="pinterest-app-secret"
                    type="password"
                    placeholder="e.g. abc123def456..."
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={handleSaveCredentials}
                    disabled={savingCreds || !appId || !appSecret}
                  >
                    {savingCreds ? "Saving..." : "Save Credentials"}
                  </Button>

                  {pinterest?.appConfigured && (
                    <a
                      href="/api/auth/pinterest"
                      className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
                    >
                      Connect Pinterest
                    </a>
                  )}
                </div>

                {!pinterest?.appConfigured && appId && appSecret && (
                  <p className="text-xs text-muted-foreground">
                    Save your credentials first, then the Connect button will appear.
                  </p>
                )}
              </div>
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
