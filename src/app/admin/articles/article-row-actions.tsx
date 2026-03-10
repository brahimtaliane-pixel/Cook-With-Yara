"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw, ExternalLink, Trash2 } from "lucide-react";

interface ArticleRowActionsProps {
  article: {
    id: string;
    status: string;
    publishedUrl: string | null;
  };
}

export function ArticleRowActions({ article }: ArticleRowActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRetry() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "article", id: article.id }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this article?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/articles/${article.id}`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {article.status === "failed" && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleRetry}
          disabled={loading}
          title="Retry"
        >
          <RefreshCw className="size-3.5" />
        </Button>
      )}
      {article.status === "published" && article.publishedUrl && (
        <a
          href={article.publishedUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="View Live"
        >
          <Button variant="ghost" size="icon-xs">
            <ExternalLink className="size-3.5" />
          </Button>
        </a>
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={handleDelete}
        disabled={loading}
        title="Delete"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
