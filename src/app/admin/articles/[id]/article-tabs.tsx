"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Download, ExternalLink, Loader2, RefreshCw } from "lucide-react";

interface ArticleTabsProps {
  article: {
    id: string;
    slug: string;
    title: string | null;
    metaDescription: string | null;
    status: string;
    retryCount: number;
    failureReason: string | null;
    heroImageUrl: string | null;
    midjourneyTaskId: string | null;
    midjourneyPrompt: string | null;
    pinImageUrl: string | null;
    pinImageUrl2: string | null;
    pinterestPinId: string | null;
    publishedUrl: string | null;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    keyword: string | null;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recipe: any;
  contentMdx: string | null;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
    </Button>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-0">
      <span className="w-40 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm min-w-0 break-all">{value || "—"}</span>
    </div>
  );
}

function ImageCard({
  label,
  url,
  extra,
}: {
  label: string;
  url: string | null;
  extra?: { label: string; value: string | null }[];
}) {
  if (!url) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{label}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            Not generated yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{label}</CardTitle>
          <CopyButton text={url} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative aspect-[2/3] w-full max-w-[300px] overflow-hidden rounded-md border">
          <Image
            src={url}
            alt={label}
            fill
            className="object-cover"
            sizes="300px"
          />
        </div>
        <p className="truncate text-xs text-muted-foreground">{url}</p>
        {extra?.map(
          (e) =>
            e.value && (
              <div key={e.label}>
                <p className="text-xs font-medium text-muted-foreground">
                  {e.label}
                </p>
                <p className="text-xs break-all">{e.value}</p>
              </div>
            )
        )}
      </CardContent>
    </Card>
  );
}

function PostToPinterestButton({ articleId }: { articleId: string }) {
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string; pinId?: string } | null>(null);

  async function handlePost() {
    setPosting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/articles/${articleId}/post-pin`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, pinId: data.pinId });
        // Reload after short delay to show updated pin ID
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setResult({ error: data.error || "Failed to post pin" });
      }
    } catch {
      setResult({ error: "Network error" });
    }
    setPosting(false);
  }

  return (
    <div className="space-y-2">
      <Button onClick={handlePost} disabled={posting}>
        {posting && <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />}
        {posting ? "Posting..." : "Post to Pinterest"}
      </Button>
      {result?.success && (
        <p className="text-sm text-green-600">
          Pin posted! ID: {result.pinId}
        </p>
      )}
      {result?.error && (
        <p className="text-sm text-destructive">{result.error}</p>
      )}
    </div>
  );
}

// === Pin Activity ===

interface PinEntry {
  id: string;
  pinDesign: number;
  title: string;
  description: string;
  imageUrl: string;
  altText: string | null;
  pinType: string;
  status: string;
  boardId: string | null;
  scheduledAt: string;
  postedAt: string | null;
  pinterestPinId: string | null;
  performanceScore: number | null;
  failureReason: string | null;
  analytics: {
    impressions: number;
    saves: number;
    clicks: number;
    closeups: number;
    snapshotAt: string;
  } | null;
}

const PIN_TYPE_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  original: { label: "Original", variant: "default" },
  multiboard: { label: "Multi-Board", variant: "secondary" },
  recycled: { label: "Recycled", variant: "outline" },
};

const PIN_STATUS_COLORS: Record<string, string> = {
  pending: "text-amber-600",
  posting: "text-blue-600",
  posted: "text-green-600",
  failed: "text-red-600",
};

const DESIGN_NAMES: Record<number, string> = {
  1: "Title Band",
  2: "Full-Bleed",
  3: "Bold Overlay",
  4: "Card Style",
  5: "Minimal",
};

function PinActivity({ articleId, onPostedCount }: { articleId: string; onPostedCount?: (count: number) => void }) {
  const [pins, setPins] = useState<PinEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/articles/${articleId}/pins`)
      .then((r) => r.json())
      .then((data: { pins: PinEntry[] }) => {
        setPins(data.pins);
        setLoading(false);
        const posted = data.pins.filter((p: PinEntry) => p.status === "posted").length;
        onPostedCount?.(posted);
      })
      .catch(() => setLoading(false));
  }, [articleId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Loading pin activity...</p>;
  }

  if (pins.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No pins queued for this article yet.</p>
        </CardContent>
      </Card>
    );
  }

  const posted = pins.filter((p) => p.status === "posted");
  const pending = pins.filter((p) => p.status === "pending");
  const failed = pins.filter((p) => p.status === "failed");

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="font-medium">{pins.length} total pins</span>
        {posted.length > 0 && <Badge variant="default">{posted.length} posted</Badge>}
        {pending.length > 0 && <Badge variant="secondary">{pending.length} queued</Badge>}
        {failed.length > 0 && <Badge variant="destructive">{failed.length} failed</Badge>}
      </div>

      {/* Pin list */}
      <div className="rounded-lg border divide-y">
        {pins.map((pin) => {
          const typeInfo = PIN_TYPE_LABELS[pin.pinType] ?? PIN_TYPE_LABELS.original;
          const isExpanded = expanded === pin.id;

          return (
            <div key={pin.id} className="text-sm">
              {/* Row summary */}
              <button
                type="button"
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                onClick={() => setExpanded(isExpanded ? null : pin.id)}
              >
                {/* Pin image thumbnail */}
                <div className="w-8 h-12 rounded overflow-hidden border shrink-0 bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pin.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Badge variant={typeInfo.variant} className="text-[10px] px-1.5 py-0">
                      {typeInfo.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Design {pin.pinDesign} ({DESIGN_NAMES[pin.pinDesign] ?? "Custom"})
                    </span>
                  </div>
                  <p className="truncate font-medium">{pin.title}</p>
                </div>

                {/* Status + score */}
                <div className="text-right shrink-0 space-y-0.5">
                  <p className={`text-xs font-medium capitalize ${PIN_STATUS_COLORS[pin.status] ?? ""}`}>
                    {pin.status}
                  </p>
                  {pin.status === "posted" && pin.analytics && (
                    <p className="text-[10px] text-muted-foreground">
                      {pin.analytics.saves} saves
                    </p>
                  )}
                  {pin.status === "pending" && (
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(pin.scheduledAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  )}
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 space-y-3 bg-muted/30">
                  {/* Pinterest-optimized copy */}
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Pinterest Title</p>
                      <p className="text-sm">{pin.title}</p>
                      <p className="text-[10px] text-muted-foreground">{pin.title.length} chars</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Pinterest Description</p>
                      <p className="text-sm whitespace-pre-wrap">{pin.description}</p>
                      <p className="text-[10px] text-muted-foreground">{pin.description.length} chars</p>
                    </div>
                    {pin.altText && (
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Alt Text</p>
                        <p className="text-sm">{pin.altText}</p>
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div><span className="text-muted-foreground">Board ID:</span> <span className="font-mono">{pin.boardId ?? "default"}</span></div>
                    <div><span className="text-muted-foreground">Pin Type:</span> {pin.pinType}</div>
                    <div><span className="text-muted-foreground">Scheduled:</span> {new Date(pin.scheduledAt).toLocaleString()}</div>
                    {pin.postedAt && <div><span className="text-muted-foreground">Posted:</span> {new Date(pin.postedAt).toLocaleString()}</div>}
                    {pin.pinterestPinId && <div><span className="text-muted-foreground">Pinterest ID:</span> <span className="font-mono">{pin.pinterestPinId}</span></div>}
                    {pin.failureReason && <div className="col-span-2 text-red-600"><span className="text-muted-foreground">Error:</span> {pin.failureReason}</div>}
                  </div>

                  {/* Analytics */}
                  {pin.analytics && (
                    <div className="rounded-md border bg-background p-3 space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Performance</p>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <p className="text-lg font-semibold">{pin.analytics.impressions.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">Impressions</p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-green-600">{pin.analytics.saves}</p>
                          <p className="text-[10px] text-muted-foreground">Saves</p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-blue-600">{pin.analytics.clicks}</p>
                          <p className="text-[10px] text-muted-foreground">Clicks</p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold">{pin.analytics.closeups}</p>
                          <p className="text-[10px] text-muted-foreground">Closeups</p>
                        </div>
                      </div>
                      {pin.performanceScore !== null && (
                        <p className="text-[10px] text-muted-foreground text-right">
                          Score: {pin.performanceScore}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ArticleTabs({ article, recipe, contentMdx }: ArticleTabsProps) {
  const [postedPinCount, setPostedPinCount] = useState(0);
  const hasPostedPins = postedPinCount > 0 || !!article.pinterestPinId;

  return (
    <Tabs defaultValue="content">
      <TabsList>
        <TabsTrigger value="content">Content</TabsTrigger>
        <TabsTrigger value="images">Images</TabsTrigger>
        <TabsTrigger value="pinterest">Pinterest</TabsTrigger>
        <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
      </TabsList>

      {/* Content Tab */}
      <TabsContent value="content" className="space-y-6 pt-4">
        {article.metaDescription && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Meta Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {article.metaDescription}
              </p>
            </CardContent>
          </Card>
        )}

        {contentMdx && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Article Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <div
                  className="whitespace-pre-wrap text-sm"
                  dangerouslySetInnerHTML={{ __html: formatMdxPreview(contentMdx) }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {recipe && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recipe JSON-LD</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recipe.recipeIngredient && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Ingredients
                    </p>
                    <ul className="list-inside list-disc text-sm space-y-0.5">
                      {recipe.recipeIngredient.map(
                        (ing: string, i: number) => (
                          <li key={i}>{ing}</li>
                        )
                      )}
                    </ul>
                  </div>
                )}
                {recipe.recipeInstructions && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Instructions
                    </p>
                    <ol className="list-inside list-decimal text-sm space-y-1">
                      {recipe.recipeInstructions.map(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (step: any, i: number) => (
                          <li key={i}>{step.text || step}</li>
                        )
                      )}
                    </ol>
                  </div>
                )}
                {recipe.nutrition && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Nutrition
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                      {Object.entries(recipe.nutrition)
                        .filter(([k]) => k !== "@type")
                        .map(([key, val]) => (
                          <div key={key}>
                            <span className="text-muted-foreground">
                              {key}:
                            </span>{" "}
                            {String(val)}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Images Tab */}
      <TabsContent value="images" className="pt-4">
        <div className="grid gap-4 md:grid-cols-3">
          <ImageCard
            label="Hero Image (Midjourney)"
            url={article.heroImageUrl}
            extra={[
              { label: "Prompt", value: article.midjourneyPrompt },
              { label: "Task ID", value: article.midjourneyTaskId },
            ]}
          />
          <ImageCard label="Pin Design 1 (Title Band)" url={article.pinImageUrl} />
          <ImageCard label="Pin Design 2 (Full-Bleed)" url={article.pinImageUrl2} />
        </div>
      </TabsContent>

      {/* Pinterest Tab */}
      <TabsContent value="pinterest" className="space-y-4 pt-4">
        {/* Pin Activity — all pins queued/posted for this article */}
        <PinActivity articleId={article.id} onPostedCount={setPostedPinCount} />

        {/* Post to Pinterest via API */}
        {!hasPostedPins && (article.pinImageUrl || article.pinImageUrl2) && (
          <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
            <CardHeader>
              <CardTitle className="text-sm">Post to Pinterest</CardTitle>
              <p className="text-xs text-muted-foreground">
                Publish this pin directly via the Pinterest API using your connected account.
              </p>
            </CardHeader>
            <CardContent>
              <PostToPinterestButton articleId={article.id} />
            </CardContent>
          </Card>
        )}

        {/* Manual posting card — shown when no pins posted yet */}
        {!hasPostedPins && (article.pinImageUrl || article.pinImageUrl2) && (
          <Card className="border-primary/20 bg-primary/[0.02]">
            <CardHeader>
              <CardTitle className="text-sm">Manual Pin Posting</CardTitle>
              <p className="text-xs text-muted-foreground">
                Pinterest app not approved yet? Download the images and post manually.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Step 1: Copy pin text */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  1. Copy pin details
                </p>
                <div className="rounded-md border bg-background p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Title</p>
                      <p className="text-sm font-medium">{article.title}</p>
                    </div>
                    {article.title && <CopyButton text={article.title} />}
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Description</p>
                      <p className="text-sm">{article.metaDescription}</p>
                    </div>
                    {article.metaDescription && (
                      <CopyButton text={article.metaDescription} />
                    )}
                  </div>
                  {article.publishedUrl && (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          Destination link
                        </p>
                        <p className="text-sm truncate">{article.publishedUrl}</p>
                      </div>
                      <CopyButton text={article.publishedUrl} />
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Download images */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  2. Download pin image
                </p>
                <div className="flex gap-3">
                  {article.pinImageUrl && (
                    <a
                      href={article.pinImageUrl}
                      download={`${article.slug}-pin1.png`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        <Download className="size-3.5" data-icon="inline-start" />
                        Design 1
                      </Button>
                    </a>
                  )}
                  {article.pinImageUrl2 && (
                    <a
                      href={article.pinImageUrl2}
                      download={`${article.slug}-pin2.png`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        <Download className="size-3.5" data-icon="inline-start" />
                        Design 2
                      </Button>
                    </a>
                  )}
                </div>
              </div>

              {/* Step 3: Go to Pinterest */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  3. Create pin on Pinterest
                </p>
                <a
                  href="https://www.pinterest.com/pin-creation-tool/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="default" size="sm">
                    <ExternalLink className="size-3.5" data-icon="inline-start" />
                    Open Pinterest Pin Creator
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pinterest Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              <InfoRow label="Pin Title" value={article.title} />
              <InfoRow label="Description" value={article.metaDescription} />
              <InfoRow
                label="Canonical URL"
                value={
                  article.publishedUrl ? (
                    <span className="flex items-center gap-1">
                      <a
                        href={article.publishedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        {article.publishedUrl}
                      </a>
                      <CopyButton text={article.publishedUrl} />
                    </span>
                  ) : null
                }
              />
              <InfoRow
                label="Pinterest Pin ID"
                value={
                  article.pinterestPinId || (
                    <span className="text-muted-foreground italic">
                      Not posted yet
                    </span>
                  )
                }
              />
            </div>
          </CardContent>
        </Card>

        {(article.pinImageUrl || article.pinImageUrl2) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Pin Image Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {article.pinImageUrl && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Design 1</p>
                    <div className="relative aspect-[2/3] w-48 overflow-hidden rounded-md border">
                      <Image
                        src={article.pinImageUrl}
                        alt="Pin Design 1"
                        fill
                        className="object-cover"
                        sizes="192px"
                      />
                    </div>
                  </div>
                )}
                {article.pinImageUrl2 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Design 2</p>
                    <div className="relative aspect-[2/3] w-48 overflow-hidden rounded-md border">
                      <Image
                        src={article.pinImageUrl2}
                        alt="Pin Design 2"
                        fill
                        className="object-cover"
                        sizes="192px"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Pipeline Tab */}
      <TabsContent value="pipeline" className="pt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pipeline Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              <InfoRow
                label="Current Status"
                value={
                  <Badge
                    variant={
                      article.status === "published"
                        ? "default"
                        : article.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {article.status}
                  </Badge>
                }
              />
              <InfoRow
                label="Retry Count"
                value={String(article.retryCount)}
              />
              {article.failureReason && (
                <InfoRow
                  label="Failure Reason"
                  value={
                    <span className="text-destructive">
                      {article.failureReason}
                    </span>
                  }
                />
              )}
              <InfoRow
                label="Created"
                value={new Date(article.createdAt).toLocaleString()}
              />
              <InfoRow
                label="Updated"
                value={new Date(article.updatedAt).toLocaleString()}
              />
              {article.publishedAt && (
                <InfoRow
                  label="Published"
                  value={new Date(article.publishedAt).toLocaleString()}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

/** Simple markdown → HTML for admin preview (headings, bold, italic, lists) */
function formatMdxPreview(mdx: string): string {
  return mdx
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-6 mb-2">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}
