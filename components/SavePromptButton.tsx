"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { PromptCollection } from "@/types";

type SavePromptButtonProps = {
  promptId: string;
  className?: string;
};

type SaveStatusResponse = {
  promptId: string;
  isSaved: boolean;
  savedCollectionIds: string[];
};

export function SavePromptButton({ promptId, className }: SavePromptButtonProps) {
  const [open, setOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [collections, setCollections] = useState<PromptCollection[]>([]);
  const [savedCollectionIds, setSavedCollectionIds] = useState<string[]>([]);
  const [quickLoading, setQuickLoading] = useState(false);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [savingCollectionId, setSavingCollectionId] = useState<string | null>(null);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);

  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  const getToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, [supabase]);

  const loadSaveStatus = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setIsAuthenticated(false);
      setSavedCollectionIds([]);
      return;
    }

    setIsAuthenticated(true);
    const response = await fetch(`/api/saved/prompts?promptId=${encodeURIComponent(promptId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (!response.ok) return;

    const payload = (await response.json().catch(() => null)) as SaveStatusResponse | null;
    if (!payload) return;
    setSavedCollectionIds(payload.savedCollectionIds ?? []);
  }, [getToken, promptId]);

  const loadCollections = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setIsAuthenticated(false);
      setCollections([]);
      return;
    }

    setIsAuthenticated(true);
    setLoadingCollections(true);

    try {
      const response = await fetch("/api/saved/collections", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        toast.error(payload.message || "Could not load collections");
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as {
        collections?: PromptCollection[];
      };
      setCollections(payload.collections ?? []);
    } finally {
      setLoadingCollections(false);
    }
  }, [getToken]);

  useEffect(() => {
    void loadSaveStatus();
  }, [loadSaveStatus]);

  useEffect(() => {
    if (!open) return;
    void Promise.all([loadCollections(), loadSaveStatus()]);
  }, [open, loadCollections, loadSaveStatus]);

  async function quickToggleSaved() {
    const token = await getToken();
    if (!token) {
      toast.error("Login to save prompts");
      return;
    }

    setQuickLoading(true);
    const alreadySaved = savedCollectionIds.length > 0;

    const response = await fetch("/api/saved/prompts", {
      method: alreadySaved ? "DELETE" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ promptId }),
    });

    const payload = await response.json().catch(() => ({}));
    setQuickLoading(false);

    if (!response.ok) {
      toast.error(payload.message || "Could not update saved prompt");
      return;
    }

    toast.success(alreadySaved ? "Removed from saved prompts" : "Saved to Favorites");
    await loadSaveStatus();
    if (open) await loadCollections();
  }

  async function toggleCollection(collectionId: string, checked: boolean) {
    const token = await getToken();
    if (!token) {
      toast.error("Login to save prompts");
      return;
    }

    setSavingCollectionId(collectionId);
    const response = await fetch("/api/saved/prompts", {
      method: checked ? "DELETE" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ promptId, collectionId }),
    });

    const payload = await response.json().catch(() => ({}));
    setSavingCollectionId(null);

    if (!response.ok) {
      toast.error(payload.message || "Could not update collection");
      return;
    }

    await Promise.all([loadCollections(), loadSaveStatus()]);
  }

  async function createCollection() {
    const name = newCollectionName.trim();
    if (!name) return;

    const token = await getToken();
    if (!token) {
      toast.error("Login to create collections");
      return;
    }

    setCreatingCollection(true);
    const createResponse = await fetch("/api/saved/collections", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });
    const createPayload = await createResponse.json().catch(() => ({}));

    if (!createResponse.ok) {
      setCreatingCollection(false);
      toast.error(createPayload.message || "Could not create collection");
      return;
    }

    const createdCollectionId = createPayload.collection?.id as string | undefined;
    setNewCollectionName("");

    if (createdCollectionId) {
      await fetch("/api/saved/prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          promptId,
          collectionId: createdCollectionId,
        }),
      });
    }

    setCreatingCollection(false);
    toast.success("Collection created");
    await Promise.all([loadCollections(), loadSaveStatus()]);
  }

  const isSaved = savedCollectionIds.length > 0;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button
        type="button"
        variant={isSaved ? "secondary" : "outline"}
        onClick={() => void quickToggleSaved()}
        disabled={quickLoading}
        className="gap-2"
      >
        {quickLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSaved ? (
          <BookmarkCheck className="h-4 w-4" />
        ) : (
          <Bookmark className="h-4 w-4" />
        )}
        {isSaved ? "Saved" : "Save Prompt"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost">
            Collections
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Save to Collections</DialogTitle>
            <DialogDescription>
              Organize prompts by theme and find them faster from your dashboard.
            </DialogDescription>
          </DialogHeader>

          {!isAuthenticated ? (
            <p className="rounded-md border border-border/60 bg-card/60 p-3 text-sm text-muted-foreground">
              Login to save prompts and create collections.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {loadingCollections ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading collections...
                  </div>
                ) : collections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No collections yet.</p>
                ) : (
                  collections.map((collection) => {
                    const checked = savedCollectionIds.includes(collection.id);
                    return (
                      <label
                        key={collection.id}
                        className="flex items-center justify-between rounded-md border border-border/60 bg-card/60 px-3 py-2 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => void toggleCollection(collection.id, checked)}
                            disabled={savingCollectionId === collection.id}
                            className="h-4 w-4 rounded border-border"
                          />
                          <span>
                            {collection.name}
                            {collection.is_default ? (
                              <span className="ml-1 text-xs text-muted-foreground">(Default)</span>
                            ) : null}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground">{collection.prompt_count}</span>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="rounded-md border border-border/60 bg-card/60 p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Create collection</p>
                <div className="flex gap-2">
                  <Input
                    value={newCollectionName}
                    placeholder="e.g. Wedding Looks"
                    onChange={(event) => setNewCollectionName(event.target.value)}
                    maxLength={60}
                  />
                  <Button type="button" onClick={() => void createCollection()} disabled={creatingCollection}>
                    {creatingCollection ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
