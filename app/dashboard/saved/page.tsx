"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { PromptCollection, SavedPromptItem } from "@/types";

export default function SavedPromptsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<PromptCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [items, setItems] = useState<SavedPromptItem[]>([]);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [collectionNameDraft, setCollectionNameDraft] = useState("");
  const [renamingCollection, setRenamingCollection] = useState(false);
  const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(null);
  const [removingPromptId, setRemovingPromptId] = useState<string | null>(null);

  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  const loadCollections = useCallback(
    async (accessToken: string, preferDefault = false) => {
      const response = await fetch("/api/saved/collections", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Failed to load collections");
      }

      const nextCollections = (payload.collections as PromptCollection[]) ?? [];
      setCollections(nextCollections);

      if (!nextCollections.length) {
        setSelectedCollectionId(null);
        return null;
      }

      let nextSelected = selectedCollectionId;
      if (preferDefault || !nextSelected || !nextCollections.some((collection) => collection.id === nextSelected)) {
        nextSelected = nextCollections.find((collection) => collection.is_default)?.id ?? nextCollections[0].id;
      }
      setSelectedCollectionId(nextSelected);
      return nextSelected;
    },
    [selectedCollectionId],
  );

  const loadItems = useCallback(async (accessToken: string, collectionId: string | null) => {
    if (!collectionId) {
      setItems([]);
      return;
    }

    const response = await fetch(`/api/saved/prompts?collectionId=${encodeURIComponent(collectionId)}&limit=200`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || "Failed to load saved prompts");
    }

    setItems((payload.items as SavedPromptItem[]) ?? []);
  }, []);

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedCollectionId) ?? null,
    [collections, selectedCollectionId],
  );

  useEffect(() => {
    async function bootstrap() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user ?? null;
      const accessToken = data.session?.access_token ?? null;

      setUser(sessionUser);
      setToken(accessToken);

      if (!sessionUser || !accessToken) {
        setLoading(false);
        return;
      }

      try {
        const selectedId = await loadCollections(accessToken, true);
        await loadItems(accessToken, selectedId);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load saved prompts");
      } finally {
        setLoading(false);
      }
    }

    void bootstrap();
  }, [loadCollections, loadItems, supabase]);

  useEffect(() => {
    setCollectionNameDraft(selectedCollection?.name ?? "");
  }, [selectedCollection?.id, selectedCollection?.name]);

  async function createCollection() {
    const name = newCollectionName.trim();
    if (!name) return;
    if (!token) {
      toast.error("Login required");
      return;
    }

    setCreatingCollection(true);
    const response = await fetch("/api/saved/collections", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });
    const payload = await response.json().catch(() => ({}));
    setCreatingCollection(false);

    if (!response.ok) {
      toast.error(payload.message || "Could not create collection");
      return;
    }

    setNewCollectionName("");
    const selectedId = await loadCollections(token);
    if (selectedId) {
      await loadItems(token, selectedId);
    }
    toast.success("Collection created");
  }

  async function deleteCollection(collectionId: string) {
    if (!token) return;
    if (!confirm("Delete this collection? Saved prompts in it will also be removed.")) return;

    setDeletingCollectionId(collectionId);
    const response = await fetch("/api/saved/collections", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ collectionId }),
    });
    const payload = await response.json().catch(() => ({}));
    setDeletingCollectionId(null);

    if (!response.ok) {
      toast.error(payload.message || "Could not delete collection");
      return;
    }

    const selectedId = await loadCollections(token, true);
    await loadItems(token, selectedId);
    toast.success("Collection deleted");
  }

  async function renameSelectedCollection() {
    if (!token || !selectedCollection) return;

    const name = collectionNameDraft.trim();
    if (!name || name === selectedCollection.name) return;

    setRenamingCollection(true);
    const response = await fetch("/api/saved/collections", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        collectionId: selectedCollection.id,
        name,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setRenamingCollection(false);

    if (!response.ok) {
      toast.error(payload.message || "Could not rename collection");
      return;
    }

    const selectedId = await loadCollections(token);
    await loadItems(token, selectedId);
    toast.success("Collection renamed");
  }

  async function removeFromCollection(promptId: string) {
    if (!token || !selectedCollectionId) return;

    setRemovingPromptId(promptId);
    const response = await fetch("/api/saved/prompts", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        promptId,
        collectionId: selectedCollectionId,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setRemovingPromptId(null);

    if (!response.ok) {
      toast.error(payload.message || "Could not remove saved prompt");
      return;
    }

    await Promise.all([loadCollections(token), loadItems(token, selectedCollectionId)]);
  }

  async function selectCollection(collectionId: string) {
    setSelectedCollectionId(collectionId);
    if (!token) return;

    try {
      await loadItems(token, collectionId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load saved prompts");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-7xl items-center justify-center px-4 py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !token) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Login Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Sign in to manage your saved prompt collections.</p>
            <Button asChild>
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <h1 className="font-display text-4xl font-bold tracking-tight">Saved Prompts</h1>
        <p className="text-muted-foreground">Create collections and keep your favorite styles organized.</p>
      </div>

      <Card className="mb-6 border-border/60 bg-card/70">
        <CardHeader>
          <CardTitle className="font-display text-lg">Create Collection</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Input
            placeholder="Collection name"
            value={newCollectionName}
            onChange={(event) => setNewCollectionName(event.target.value)}
            maxLength={60}
          />
          <Button onClick={() => void createCollection()} disabled={creatingCollection || !newCollectionName.trim()}>
            {creatingCollection ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Create
          </Button>
        </CardContent>
      </Card>

      <div className="mb-6 flex flex-wrap gap-2">
        {collections.map((collection) => {
          const selected = selectedCollectionId === collection.id;
          return (
            <div
              key={collection.id}
              className={`flex items-center gap-1 rounded-full border px-2 py-1 ${
                selected ? "border-primary/60 bg-primary/10" : "border-border/60"
              }`}
            >
              <button
                type="button"
                onClick={() => void selectCollection(collection.id)}
                className="rounded-full px-2 py-1 text-sm"
              >
                {collection.name} ({collection.prompt_count})
                {collection.is_default ? " *" : ""}
              </button>
              {!collection.is_default ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => void deleteCollection(collection.id)}
                  disabled={deletingCollectionId === collection.id}
                >
                  {deletingCollectionId === collection.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>

      {selectedCollection ? (
        <Card className="mb-6 border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="font-display text-lg">Rename Collection</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Input
              value={collectionNameDraft}
              onChange={(event) => setCollectionNameDraft(event.target.value)}
              maxLength={60}
              placeholder="Collection name"
            />
            <Button
              onClick={() => void renameSelectedCollection()}
              disabled={
                renamingCollection ||
                !collectionNameDraft.trim() ||
                collectionNameDraft.trim() === selectedCollection.name
              }
            >
              {renamingCollection ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Name
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!selectedCollectionId ? (
        <Card className="border-border/60 bg-card/70">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No collection selected yet.
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card className="border-border/60 bg-card/70">
          <CardContent className="p-6 text-sm text-muted-foreground">
            This collection is empty. Save prompts from gallery pages to see them here.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={`${item.collection_id}:${item.prompt_id}`} className="overflow-hidden border-border/60 bg-card/70">
              <div className="relative aspect-[4/5]">
                <Image
                  src={item.prompt.example_image_url}
                  alt={item.prompt.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
              <CardContent className="space-y-3 p-4">
                <div>
                  <p className="line-clamp-1 text-sm font-semibold">{item.prompt.title}</p>
                  <p className="text-xs text-muted-foreground">{item.prompt.category}</p>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{item.prompt.description}</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" asChild>
                    <Link href={`/gallery/${item.prompt.id}`}>Open Prompt</Link>
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void removeFromCollection(item.prompt_id)}
                    disabled={removingPromptId === item.prompt_id}
                  >
                    {removingPromptId === item.prompt_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
