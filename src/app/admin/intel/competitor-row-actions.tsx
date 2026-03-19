"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

interface CompetitorRowActionsProps {
  competitor: {
    id: string;
    username: string;
    isActive: boolean;
  };
}

export function CompetitorRowActions({
  competitor,
}: CompetitorRowActionsProps) {
  const router = useRouter();
  const [isActive, setIsActive] = useState(competitor.isActive);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleToggle(checked: boolean) {
    setToggling(true);
    setIsActive(checked);
    try {
      const res = await fetch(
        `/api/admin/intel/competitors/${competitor.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: checked }),
        }
      );
      if (!res.ok) {
        setIsActive(!checked);
      }
    } catch {
      setIsActive(!checked);
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/intel/competitors/${competitor.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setDeleteOpen(false);
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
      <Switch
        checked={isActive}
        onCheckedChange={handleToggle}
        disabled={toggling}
        size="sm"
      />
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger
          render={
            <Button variant="ghost" size="icon-xs" title="Delete competitor" />
          }
        >
          <Trash2 className="size-3.5" />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Competitor</DialogTitle>
            <DialogDescription>
              Remove @{competitor.username} and all their tracked pins? This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
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
