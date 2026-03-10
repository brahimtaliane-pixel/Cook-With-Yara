"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ConfigKeys } from "@/lib/constants";

type ConfigMap = Record<string, string>;

export default function ConfigPage() {
  const [config, setConfig] = useState<ConfigMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => r.json())
      .then((data: { config: ConfigMap }) => {
        setConfig(data.config);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
    </div>
  );
}
