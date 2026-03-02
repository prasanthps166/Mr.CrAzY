"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createBrowserSupabaseClient } from "@/lib/supabase";

type ApiKeyRow = {
  id: string;
  name: string;
  is_active: boolean;
  total_calls: number;
  monthly_limit: number;
  created_at: string;
  last_used_at: string | null;
  key_preview: string;
};

export default function DashboardApiPage() {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [name, setName] = useState("Production Key");
  const [monthlyLimit, setMonthlyLimit] = useState("500");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [rows, setRows] = useState<ApiKeyRow[]>([]);

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

  const loadKeys = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    const response = await fetch("/api/dashboard/api-keys", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(payload.message || "Failed to load API keys");
      setLoading(false);
      return;
    }

    setRows((payload.keys as ApiKeyRow[]) ?? []);
    setLoading(false);
  }, [getToken]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function createKey() {
    const token = await getToken();
    if (!token) {
      toast.error("Please login first");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/dashboard/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          monthly_limit: Number(monthlyLimit) || 500,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Failed to create key");
      }

      setApiKey(payload.key ?? null);
      setRows((current) => [payload.record as ApiKeyRow, ...current]);
      toast.success("API key created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    const token = await getToken();
    if (!token) {
      toast.error("Please login first");
      return;
    }

    setRevoking(id);
    try {
      const response = await fetch("/api/dashboard/api-keys", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key_id: id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Failed to revoke key");
      }

      setRows((current) =>
        current.map((row) => (row.id === id ? { ...row, is_active: false } : row)),
      );
      toast.success("API key revoked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke key");
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <h1 className="font-display text-4xl font-bold tracking-tight">API Keys</h1>
        <p className="text-muted-foreground">Create and manage your PromptGallery API keys.</p>
      </div>

      <Card className="mb-6 border-border/60 bg-card/70">
        <CardHeader>
          <CardTitle className="font-display text-xl">Create New Key</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <Input placeholder="Key name" value={name} onChange={(event) => setName(event.target.value)} />
          <Input
            placeholder="Monthly limit"
            value={monthlyLimit}
            onChange={(event) => setMonthlyLimit(event.target.value)}
          />
          <Button onClick={createKey} disabled={creating}>
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Create Key
          </Button>
        </CardContent>
      </Card>

      {apiKey ? (
        <Card className="mb-6 border-primary/50 bg-primary/10">
          <CardHeader>
            <CardTitle className="font-display text-lg">New API Key</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="rounded-md bg-background/90 p-3 font-mono text-xs">{apiKey}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/60 bg-card/70">
        <CardHeader>
          <CardTitle className="font-display text-xl">Existing Keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading keys...
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No keys yet.</p>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 p-3"
              >
                <div className="space-y-1">
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.is_active ? "Active" : "Revoked"} • Calls: {row.total_calls}/{row.monthly_limit}
                  </p>
                </div>
                {row.is_active ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => revokeKey(row.id)}
                    disabled={revoking === row.id}
                  >
                    {revoking === row.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Revoke
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
