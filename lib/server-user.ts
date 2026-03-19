import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function hasSupabaseAuthCookie(cookieNames: string[]) {
  return cookieNames.some((name) => {
    if (!name) return false;
    if (name === "supabase-auth-token") return true;
    return name.startsWith("sb-") && name.includes("-auth-token");
  });
}

export async function getViewerUserId() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const cookieStore = cookies();
  const cookieNames = cookieStore.getAll().map((cookie) => cookie.name);
  if (!hasSupabaseAuthCookie(cookieNames)) return null;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set() {
        // No-op in server component.
      },
      remove() {
        // No-op in server component.
      },
    },
  });

  const userResult = await supabase.auth.getUser().catch(() => null);
  return userResult?.data.user?.id ?? null;
}
