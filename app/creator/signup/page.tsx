"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserSupabaseClient } from "@/lib/supabase";

export default function CreatorSignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [payoutEmail, setPayoutEmail] = useState("");
  const [razorpayAccountId, setRazorpayAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    async function load() {
      if (!supabase) {
        setChecking(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token ?? null;
      setToken(accessToken);

      if (!accessToken) {
        setChecking(false);
        return;
      }

      const response = await fetch("/api/creator/dashboard", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        window.location.href = "/creator";
        return;
      }

      setChecking(false);
    }

    void load();
  }, [supabase]);

  async function submitCreatorProfile() {
    if (!token) {
      toast.error("Login required");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/creator/profile/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          display_name: displayName,
          bio,
          payout_email: payoutEmail,
          razorpay_account_id: razorpayAccountId,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Failed to create creator profile");
      }

      toast.success("Creator profile created");

      if (payload.onboardingUrl) {
        window.location.href = payload.onboardingUrl;
        return;
      }

      window.location.href = "/creator";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create profile");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="mx-auto flex w-full max-w-4xl items-center justify-center px-4 py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Login Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">Login before creating a creator account.</p>
            <Button asChild>
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <h1 className="font-display text-4xl font-bold tracking-tight">Become a Creator</h1>
        <p className="text-muted-foreground">Earn 70% per sale, publish globally, and grow your audience.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle>Creator Benefits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>1. Earn 70% revenue share on every marketplace prompt sale.</p>
            <p>2. Reach a global audience actively searching for high-performing prompts.</p>
            <p>3. Build your creator brand with profile, ratings, and repeat buyers.</p>
            <p>4. Razorpay payouts to your creator account (or mock payouts in development).</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle>Creator Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Display name"
            />
            <Textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Short creator bio"
              rows={4}
            />
            <Input
              type="email"
              value={payoutEmail}
              onChange={(event) => setPayoutEmail(event.target.value)}
              placeholder="Payout email"
            />
            <Input
              value={razorpayAccountId}
              onChange={(event) => setRazorpayAccountId(event.target.value)}
              placeholder="Razorpay account ID (optional)"
            />

            <Button onClick={submitCreatorProfile} disabled={loading || !displayName.trim()} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
              Create Creator Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
