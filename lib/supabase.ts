import type { NextRequest, NextResponse } from "next/server";
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function isSupabaseServiceConfigured() {
  return Boolean(supabaseUrl && supabaseServiceRoleKey);
}

export function createBrowserSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
}

export function createRouteSupabaseClient(request: NextRequest, response: NextResponse) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: { [key: string]: unknown }) {
        response.cookies.set({ name, value, ...(options as object) });
      },
      remove(name: string, options: { [key: string]: unknown }) {
        response.cookies.set({ name, value: "", ...(options as object), maxAge: 0 });
      },
    },
  });
}

export function createPublicServerClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  return createClient(supabaseUrl!, supabaseAnonKey!);
}

export function createServiceRoleClient() {
  if (!isSupabaseServiceConfigured()) {
    return null;
  }

  return createClient(supabaseUrl!, supabaseServiceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function getUserFromAccessToken(token?: string | null) {
  if (!token) return null;
  const supabase = createPublicServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return data.user ?? null;
}
