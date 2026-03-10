"use client";

import { useState } from "react";
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
import { Copy, Check, Download, ExternalLink } from "lucide-react";

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

export function ArticleTabs({ article, recipe, contentMdx }: ArticleTabsProps) {
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
        {/* Manual posting card — shown when no Pinterest pin ID yet */}
        {!article.pinterestPinId && (article.pinImageUrl || article.pinImageUrl2) && (
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
