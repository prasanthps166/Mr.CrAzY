"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createBrowserSupabaseClient } from "@/lib/supabase";

type AuthFormProps = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("+91");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [providerAvailability, setProviderAvailability] = useState({
    email: true,
    phone: false,
    google: false,
  });
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const router = useRouter();

  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ref")?.trim() || null;
    setReferralCode(code);
  }, []);

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) return;

    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
          method: "GET",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          signal: controller.signal,
        });
        if (!response.ok) return;

        const settings = (await response.json()) as {
          external?: {
            email?: boolean;
            phone?: boolean;
            google?: boolean;
          };
        };
        if (cancelled) return;

        const emailEnabled = settings.external?.email !== false;
        const phoneEnabled = settings.external?.phone === true;
        const googleEnabled = settings.external?.google === true;

        setProviderAvailability({
          email: emailEnabled,
          phone: phoneEnabled,
          google: googleEnabled,
        });

        if (!phoneEnabled) {
          setAuthMethod("email");
          setOtpSent(false);
          setOtpCode("");
        }
      } catch {
        // Keep safe defaults (email only) if settings lookup fails.
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  async function linkReferralAfterAuth() {
    if (!referralCode || !supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    await fetch("/api/referrals/link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code: referralCode }),
    }).catch(() => null);
  }

  async function onEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      toast.error("Supabase auth is not configured");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const callbackUrl = new URL("/auth/callback", window.location.origin);
        callbackUrl.searchParams.set("next", "/dashboard");
        if (referralCode) callbackUrl.searchParams.set("ref", referralCode);

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              ...(referralCode ? { referral_code_used: referralCode } : {}),
            },
            emailRedirectTo: callbackUrl.toString(),
          },
        });
        if (error) throw error;
        toast.success("Check your inbox to confirm your account");
        router.push("/login");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      toast.success("Welcome back");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function sendPhoneOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      toast.error("Supabase auth is not configured");
      return;
    }
    if (!providerAvailability.phone) {
      toast.error("Phone OTP login is not enabled for this project");
      return;
    }
    if (!phone.startsWith("+")) {
      toast.error("Phone must be in E.164 format, for example +919876543210");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: {
          shouldCreateUser: mode === "signup",
          data: {
            ...(fullName ? { full_name: fullName } : {}),
            ...(referralCode ? { referral_code_used: referralCode } : {}),
          },
        },
      });
      if (error) throw error;

      setOtpSent(true);
      toast.success("OTP sent to your phone");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyPhoneOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      toast.error("Supabase auth is not configured");
      return;
    }
    if (!providerAvailability.phone) {
      toast.error("Phone OTP login is not enabled for this project");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: otpCode,
        type: "sms",
      });
      if (error) throw error;

      if (mode === "signup") {
        await linkReferralAfterAuth();
      }

      toast.success(mode === "signup" ? "Account created" : "Login successful");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleLogin() {
    if (!supabase) {
      toast.error("Supabase auth is not configured");
      return;
    }
    if (!providerAvailability.google) {
      toast.error("Google login is not enabled for this project");
      return;
    }
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", "/dashboard");
    if (referralCode) callbackUrl.searchParams.set("ref", referralCode);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });
    if (error) toast.error(error.message);
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <Card className="border-border/60 bg-card/70">
        <CardHeader>
          <CardTitle className="font-display text-3xl">
            {mode === "login" ? "Login" : "Create Account"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {providerAvailability.google ? (
            <Button variant="secondary" className="w-full" onClick={onGoogleLogin}>
              Continue with Google
            </Button>
          ) : null}

          {providerAvailability.phone ? (
            <div className="grid grid-cols-2 gap-2 rounded-md border border-border/60 p-1">
              <Button
                type="button"
                variant={authMethod === "email" ? "default" : "ghost"}
                onClick={() => {
                  setAuthMethod("email");
                  setOtpSent(false);
                  setOtpCode("");
                }}
              >
                Email
              </Button>
              <Button
                type="button"
                variant={authMethod === "phone" ? "default" : "ghost"}
                onClick={() => setAuthMethod("phone")}
              >
                Phone OTP
              </Button>
            </div>
          ) : null}

          {authMethod === "email" ? (
            <form className="space-y-3" onSubmit={onEmailAuth}>
              {mode === "signup" ? (
                <Input
                  placeholder="Full name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />
              ) : null}
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {mode === "login" ? "Login" : "Sign Up"}
              </Button>
            </form>
          ) : otpSent ? (
            <form className="space-y-3" onSubmit={verifyPhoneOtp}>
              <Input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+919876543210"
                required
              />
              <Input
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
                placeholder="Enter 6-digit OTP"
                required
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verify OTP
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setOtpSent(false);
                  setOtpCode("");
                }}
              >
                Use different number
              </Button>
            </form>
          ) : (
            <form className="space-y-3" onSubmit={sendPhoneOtp}>
              {mode === "signup" ? (
                <Input
                  placeholder="Full name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />
              ) : null}
              <Input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+919876543210"
                required
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send OTP
              </Button>
            </form>
          )}

          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
            <Link href={mode === "login" ? "/signup" : "/login"} className="text-primary hover:underline">
              {mode === "login" ? "Sign up" : "Login"}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
