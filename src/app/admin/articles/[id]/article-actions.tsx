"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { RefreshCw, ExternalLink, Trash2, ImageIcon } from "lucide-react";

interface ArticleActionsProps {
  article: {
    id: string;
    status: string;
    publishedUrl: string | null;
    slug: string;
    heroImageUrl: string | null;
    pinImageUrl: string | null;
  };
}

export function ArticleActions({ article }: ArticleActionsProps) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generatingPins, setGeneratingPins] = useState(false);

  async function handleGeneratePins() {
    setGeneratingPins(true);
    try {
      const res = await fetch(`/api/admin/articles/${article.id}/generate-pins`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to generate pins");
      }
    } finally {
      setGeneratingPins(false);
    }
  }

  async function handleRetry() {
    setRetrying(true);
    try {
      const res = await fetch("/api/admin/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "article", id: article.id }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setRetrying(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/articles/${article.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/admin/articles");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {article.heroImageUrl && !article.pinImageUrl && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleGeneratePins}
          disabled={generatingPins}
        >
          <ImageIcon className="size-3.5" data-icon="inline-start" />
          {generatingPins ? "Generating..." : "Generate Pins"}
        </Button>
      )}

      {["failed", "content_generating", "image_generating", "pin_generating", "publishing"].includes(article.status) && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          disabled={retrying}
        >
          <RefreshCw className="size-3.5" data-icon="inline-start" />
          {retrying ? "Retrying..." : "Retry"}
        </Button>
      )}

      {article.status === "published" && article.publishedUrl && (
        <a
          href={article.publishedUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm">
            <ExternalLink className="size-3.5" data-icon="inline-start" />
            View Live
          </Button>
        </a>
      )}

      <Dialog>
        <DialogTrigger
          render={
            <Button variant="destructive" size="sm">
              <Trash2 className="size-3.5" data-icon="inline-start" />
              Delete
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Article</DialogTitle>
            <DialogDescription>
              This will permanently delete this article and reset its keyword
              for reprocessing. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" />}
            >
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
