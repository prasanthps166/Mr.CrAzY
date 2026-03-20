import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

type TestUser = {
  id: string;
  email: string;
  password: string;
  token: string;
};

export type AuthenticatedFixture = {
  actor: TestUser;
  creator: TestUser;
  promptId: string;
  promptTitle: string;
  generationId: string;
  postId: string;
};

let cachedEnv: Record<string, string> | null = null;

function parseEnv(content: string) {
  const env: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }

  return env;
}

function loadEnv() {
  if (cachedEnv) return cachedEnv;

  const envPath = path.join(process.cwd(), ".env.local");
  const fileEnv = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : {};

  cachedEnv = {
    ...fileEnv,
    ...Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    ),
  };

  return cachedEnv;
}

function requireEnv(name: string) {
  const value = loadEnv()[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function bootstrapUserProfile(baseUrl: string, token: string) {
  const response = await fetch(`${baseUrl}/api/credits`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to bootstrap test user profile");
  }
}

async function createAndBootstrapUser(options: {
  adminClient: any;
  publicClient: any;
  baseUrl: string;
  email: string;
  password: string;
  fullName: string;
}) {
  const createResult = await options.adminClient.auth.admin.createUser({
    email: options.email,
    password: options.password,
    email_confirm: true,
    user_metadata: {
      full_name: options.fullName,
    },
  });

  if (createResult.error || !createResult.data.user) {
    throw new Error(createResult.error?.message || "Failed to create test user");
  }

  const signInResult = await options.publicClient.auth.signInWithPassword({
    email: options.email,
    password: options.password,
  });

  if (signInResult.error || !signInResult.data.session) {
    throw new Error(signInResult.error?.message || "Failed to sign in test user");
  }

  await bootstrapUserProfile(options.baseUrl, signInResult.data.session.access_token);

  return {
    id: createResult.data.user.id,
    email: options.email,
    password: options.password,
    token: signInResult.data.session.access_token,
  } satisfies TestUser;
}

export async function createAuthenticatedFixture(baseUrl: string) {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const runId = Date.now();
  const password = "Passw0rd!123";

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const publicClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const actor = await createAndBootstrapUser({
    adminClient,
    publicClient,
    baseUrl,
    email: `actor+browser-${runId}@example.com`,
    password,
    fullName: `Browser Actor ${runId}`,
  });
  const creator = await createAndBootstrapUser({
    adminClient,
    publicClient,
    baseUrl,
    email: `creator+browser-${runId}@example.com`,
    password,
    fullName: `Browser Creator ${runId}`,
  });

  const promptResult = await adminClient
    .from("prompts")
    .insert({
      title: `Browser Coverage Prompt ${runId}`,
      description: "Temporary prompt for authenticated browser coverage",
      prompt_text: "browser coverage prompt text",
      category: "Portrait",
      example_image_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
      tags: ["browser", "coverage"],
      is_featured: false,
      use_count: 1,
    })
    .select("id, title")
    .single();

  if (promptResult.error || !promptResult.data?.id) {
    throw new Error(promptResult.error?.message || "Failed to create browser coverage prompt");
  }

  const generationResult = await adminClient
    .from("generations")
    .insert({
      user_id: creator.id,
      prompt_id: promptResult.data.id,
      original_image_url: "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=1200&q=80",
      generated_image_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
      generated_image_url_clean: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
      generated_image_url_watermarked:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
      is_public: true,
    })
    .select("id")
    .single();

  if (generationResult.error || !generationResult.data?.id) {
    throw new Error(generationResult.error?.message || "Failed to create browser coverage generation");
  }

  const postResult = await adminClient
    .from("community_posts")
    .insert({
      generation_id: generationResult.data.id,
      user_id: creator.id,
      likes: 0,
    })
    .select("id")
    .single();

  if (postResult.error || !postResult.data?.id) {
    throw new Error(postResult.error?.message || "Failed to create browser coverage community post");
  }

  return {
    actor,
    creator,
    promptId: promptResult.data.id,
    promptTitle: promptResult.data.title,
    generationId: generationResult.data.id,
    postId: postResult.data.id,
  } satisfies AuthenticatedFixture;
}

export async function cleanupAuthenticatedFixture(fixture: AuthenticatedFixture | null) {
  if (!fixture) return;

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  await adminClient.from("community_posts").delete().eq("id", fixture.postId);
  await adminClient.from("generations").delete().eq("id", fixture.generationId);
  await adminClient.from("prompts").delete().eq("id", fixture.promptId);
  await adminClient.auth.admin.deleteUser(fixture.creator.id);
  await adminClient.auth.admin.deleteUser(fixture.actor.id);
}
