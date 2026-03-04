import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn, execFile } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import { promisify } from "node:util";

import { createClient } from "@supabase/supabase-js";

const workspace = process.cwd();
const envPath = path.join(workspace, ".env.local");
const port = 3900 + Math.floor(Math.random() * 300);
const baseUrl = `http://127.0.0.1:${port}`;
const testRunId = Date.now();
const testPrefix = `phase4-smoke-${testRunId}`;
const results = [];
const createdUsers = [];
const execFileAsync = promisify(execFile);

function parseEnv(content) {
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    env[key] = value;
  }
  return env;
}

function requiredEnv(env, key) {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

function logResult(name, ok, details = "") {
  results.push({ name, ok, details });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${name}${details ? ` :: ${details}` : ""}`);
}

async function requestJson(url, options = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        response: {
          ok: false,
          status: 408,
        },
        data: {
          message: `Request timeout after ${timeoutMs}ms`,
        },
      };
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForServer(url, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${url}/api/credits`, {
        method: "GET",
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok || response.status === 401) {
        return true;
      }
    } catch {
      // ignore until server is ready
    }
    await sleep(1500);
  }
  return false;
}

async function createAndLoginUser({ adminClient, publicClient, email, password, userMetadata }) {
  const createResponse = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (createResponse.error || !createResponse.data.user) {
    throw new Error(createResponse.error?.message || "Failed to create user");
  }

  createdUsers.push({ id: createResponse.data.user.id, email });

  const signInResponse = await publicClient.auth.signInWithPassword({
    email,
    password,
  });

  if (signInResponse.error || !signInResponse.data.session) {
    throw new Error(signInResponse.error?.message || "Failed to login user");
  }

  return {
    userId: createResponse.data.user.id,
    token: signInResponse.data.session.access_token,
  };
}

async function bootstrapUserProfile({ token, baseUrl }) {
  const { response, data } = await requestJson(`${baseUrl}/api/credits`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(data.message || "Failed to bootstrap user profile");
  }
}

async function cleanupUsers({ adminClient }) {
  for (const user of createdUsers.reverse()) {
    try {
      await adminClient.auth.admin.deleteUser(user.id);
      console.log(`[CLEANUP] deleted ${user.email}`);
    } catch {
      console.log(`[CLEANUP] failed to delete ${user.email}`);
    }
  }
}

async function stopProcessTree(childProcess) {
  if (!childProcess?.pid) return;

  if (process.platform === "win32") {
    try {
      await execFileAsync("taskkill", ["/pid", String(childProcess.pid), "/T", "/F"]);
      return;
    } catch {
      // fallback below
    }
  }

  try {
    childProcess.kill("SIGTERM");
  } catch {
    // no-op
  }

  await sleep(1200);

  if (!childProcess.killed) {
    try {
      childProcess.kill("SIGKILL");
    } catch {
      // no-op
    }
  }
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function main() {
  if (!existsSync(envPath)) {
    throw new Error(".env.local not found");
  }

  const envContent = await readFile(envPath, "utf8");
  const fileEnv = parseEnv(envContent);

  const supabaseUrl = requiredEnv(fileEnv, "NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = requiredEnv(fileEnv, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = requiredEnv(fileEnv, "SUPABASE_SERVICE_ROLE_KEY");

  const serverEnv = {
    ...process.env,
    ...fileEnv,
    NEXT_PUBLIC_APP_URL: baseUrl,
    PORT: String(port),
  };

  const devCommand = `npm run dev -- --port ${port}`;
  const devProcess = spawn(devCommand, {
    cwd: workspace,
    env: serverEnv,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  devProcess.stdout.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) console.log(`[dev] ${text}`);
  });
  devProcess.stderr.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) console.log(`[dev:err] ${text}`);
  });

  const ready = await waitForServer(baseUrl, 150000);
  if (!ready) {
    devProcess.kill();
    throw new Error("Dev server did not become ready in time");
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const publicClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let promptId = null;
  let createdPromptId = null;
  let generationId = null;
  let postId = null;
  let commentId = null;
  let collectionId = null;

  try {
    // Ensure expected tables exist.
    for (const table of ["prompt_collections", "prompt_collection_items", "community_comments", "user_follows"]) {
      const { error } = await adminClient.from(table).select("*", { count: "exact", head: true });
      logResult(`DB table exists: ${table}`, !error, error?.message || "ok");
      if (error) throw new Error(`Missing required table: ${table}`);
    }

    const actor = await createAndLoginUser({
      adminClient,
      publicClient,
      email: `actor+${testPrefix}@example.com`,
      password: "Passw0rd!123",
      userMetadata: { full_name: `Actor ${testRunId}` },
    });
    await bootstrapUserProfile({ token: actor.token, baseUrl });
    logResult("Create/login actor", true, actor.userId);

    const creator = await createAndLoginUser({
      adminClient,
      publicClient,
      email: `creator+${testPrefix}@example.com`,
      password: "Passw0rd!123",
      userMetadata: { full_name: `Creator ${testRunId}` },
    });
    await bootstrapUserProfile({ token: creator.token, baseUrl });
    logResult("Create/login creator", true, creator.userId);

    // Resolve prompt for saved/generation checks.
    {
      const { data: firstPrompt } = await adminClient.from("prompts").select("id").limit(1).maybeSingle();
      if (firstPrompt?.id) {
        promptId = firstPrompt.id;
      } else {
        const inserted = await adminClient
          .from("prompts")
          .insert({
            title: `Phase4 Smoke Prompt ${testRunId}`,
            description: "Temporary prompt for smoke checks",
            prompt_text: "phase4 smoke prompt text",
            category: "Art",
            example_image_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
            tags: ["phase4", "smoke"],
            is_featured: false,
            use_count: 1,
          })
          .select("id")
          .single();

        if (inserted.error || !inserted.data?.id) {
          throw new Error(inserted.error?.message || "Could not create smoke prompt");
        }

        promptId = inserted.data.id;
        createdPromptId = promptId;
      }
      logResult("Resolve prompt for social/saved checks", Boolean(promptId), String(promptId));
    }

    // Create one generation + community post as creator.
    {
      const generationResult = await adminClient
        .from("generations")
        .insert({
          user_id: creator.userId,
          prompt_id: promptId,
          original_image_url: "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=1200&q=80",
          generated_image_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
          generated_image_url_clean: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
          generated_image_url_watermarked: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
          is_public: true,
        })
        .select("id")
        .single();

      if (generationResult.error || !generationResult.data?.id) {
        throw new Error(generationResult.error?.message || "Could not create smoke generation");
      }
      generationId = generationResult.data.id;

      const postResult = await adminClient
        .from("community_posts")
        .insert({
          generation_id: generationId,
          user_id: creator.userId,
          likes: 0,
        })
        .select("id")
        .single();

      if (postResult.error || !postResult.data?.id) {
        throw new Error(postResult.error?.message || "Could not create smoke community post");
      }

      postId = postResult.data.id;
      logResult("Create smoke community post", true, postId);
    }

    // Follow checks.
    {
      const follow = await requestJson(`${baseUrl}/api/community/follow`, {
        method: "POST",
        headers: authHeaders(actor.token),
        body: JSON.stringify({ targetUserId: creator.userId }),
      });
      logResult("POST /api/community/follow", follow.response.ok, follow.data.message || "ok");
      if (!follow.response.ok) throw new Error("follow failed");

      const list = await requestJson(`${baseUrl}/api/community/follow`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${actor.token}`,
        },
      });
      const includesCreator = Array.isArray(list.data.followingUserIds) && list.data.followingUserIds.includes(creator.userId);
      logResult("GET /api/community/follow", list.response.ok && includesCreator, list.data.message || "ok");
      if (!list.response.ok || !includesCreator) throw new Error("follow list failed");

      const followingFeed = await requestJson(
        `${baseUrl}/api/community/feed?scope=following&limit=10`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${actor.token}`,
          },
        },
      );
      const hasPost = Array.isArray(followingFeed.data.posts) && followingFeed.data.posts.some((post) => post.id === postId);
      logResult("GET /api/community/feed?scope=following", followingFeed.response.ok && hasPost, followingFeed.data.message || "ok");
      if (!followingFeed.response.ok || !hasPost) throw new Error("following feed check failed");
    }

    // Comments checks.
    {
      const create = await requestJson(`${baseUrl}/api/community/comments`, {
        method: "POST",
        headers: authHeaders(actor.token),
        body: JSON.stringify({ postId, commentText: "phase4 smoke comment" }),
      });
      commentId = create.data.comment?.id ?? null;
      logResult("POST /api/community/comments", create.response.ok && Boolean(commentId), create.data.message || "ok");
      if (!create.response.ok || !commentId) throw new Error("comment create failed");

      const list = await requestJson(`${baseUrl}/api/community/comments?postId=${postId}&limit=20`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${actor.token}`,
        },
      });
      const hasComment = Array.isArray(list.data.comments) && list.data.comments.some((comment) => comment.id === commentId);
      logResult("GET /api/community/comments", list.response.ok && hasComment, list.data.message || "ok");
      if (!list.response.ok || !hasComment) throw new Error("comment list failed");

      const remove = await requestJson(`${baseUrl}/api/community/comments/${commentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${actor.token}`,
        },
      });
      logResult("DELETE /api/community/comments/[id]", remove.response.ok, remove.data.message || "ok");
      if (!remove.response.ok) throw new Error("comment delete failed");
      commentId = null;
    }

    // Saved collections + saved prompts checks.
    {
      const collectionsBefore = await requestJson(`${baseUrl}/api/saved/collections`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${actor.token}`,
        },
      });
      logResult("GET /api/saved/collections", collectionsBefore.response.ok, collectionsBefore.data.message || "ok");
      if (!collectionsBefore.response.ok) throw new Error("collections get failed");

      const createCollection = await requestJson(`${baseUrl}/api/saved/collections`, {
        method: "POST",
        headers: authHeaders(actor.token),
        body: JSON.stringify({ name: `Phase4-${testRunId}` }),
      });
      collectionId = createCollection.data.collection?.id ?? null;
      logResult("POST /api/saved/collections", createCollection.response.ok && Boolean(collectionId), createCollection.data.message || "ok");
      if (!createCollection.response.ok || !collectionId) throw new Error("collection create failed");

      const rename = await requestJson(`${baseUrl}/api/saved/collections`, {
        method: "PATCH",
        headers: authHeaders(actor.token),
        body: JSON.stringify({ collectionId, name: `Phase4-${testRunId}-Renamed` }),
      });
      const renamed = rename.data.collection?.name === `Phase4-${testRunId}-Renamed`;
      logResult("PATCH /api/saved/collections", rename.response.ok && renamed, rename.data.message || "ok");
      if (!rename.response.ok || !renamed) throw new Error("collection rename failed");

      const save = await requestJson(`${baseUrl}/api/saved/prompts`, {
        method: "POST",
        headers: authHeaders(actor.token),
        body: JSON.stringify({ promptId, collectionId }),
      });
      logResult("POST /api/saved/prompts", save.response.ok, save.data.message || "ok");
      if (!save.response.ok) throw new Error("save prompt failed");

      const saveStatus = await requestJson(`${baseUrl}/api/saved/prompts?promptId=${promptId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${actor.token}`,
        },
      });
      const isSaved = Boolean(saveStatus.data.isSaved);
      logResult("GET /api/saved/prompts?promptId=", saveStatus.response.ok && isSaved, saveStatus.data.message || "ok");
      if (!saveStatus.response.ok || !isSaved) throw new Error("saved status failed");

      const listSaved = await requestJson(`${baseUrl}/api/saved/prompts?collectionId=${collectionId}&limit=50`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${actor.token}`,
        },
      });
      const listed = Array.isArray(listSaved.data.items) && listSaved.data.items.some((item) => item.prompt_id === promptId);
      logResult("GET /api/saved/prompts?collectionId=", listSaved.response.ok && listed, listSaved.data.message || "ok");
      if (!listSaved.response.ok || !listed) throw new Error("saved list failed");

      const unsave = await requestJson(`${baseUrl}/api/saved/prompts`, {
        method: "DELETE",
        headers: authHeaders(actor.token),
        body: JSON.stringify({ promptId, collectionId }),
      });
      logResult("DELETE /api/saved/prompts", unsave.response.ok, unsave.data.message || "ok");
      if (!unsave.response.ok) throw new Error("unsave failed");

      const removeCollection = await requestJson(`${baseUrl}/api/saved/collections`, {
        method: "DELETE",
        headers: authHeaders(actor.token),
        body: JSON.stringify({ collectionId }),
      });
      logResult("DELETE /api/saved/collections", removeCollection.response.ok, removeCollection.data.message || "ok");
      if (!removeCollection.response.ok) throw new Error("collection delete failed");
      collectionId = null;
    }

    // Unfollow cleanup check.
    {
      const unfollow = await requestJson(`${baseUrl}/api/community/follow`, {
        method: "DELETE",
        headers: authHeaders(actor.token),
        body: JSON.stringify({ targetUserId: creator.userId }),
      });
      logResult("DELETE /api/community/follow", unfollow.response.ok, unfollow.data.message || "ok");
      if (!unfollow.response.ok) throw new Error("unfollow failed");
    }

    const failed = results.filter((item) => !item.ok);
    console.log("\n==== Phase 4 Smoke Summary ====");
    console.log(`Total checks: ${results.length}`);
    console.log(`Passed: ${results.length - failed.length}`);
    console.log(`Failed: ${failed.length}`);

    if (failed.length) {
      for (const fail of failed) {
        console.log(` - ${fail.name}: ${fail.details}`);
      }
      process.exitCode = 1;
    }
  } finally {
    if (commentId) {
      await adminClient.from("community_comments").delete().eq("id", commentId);
    }
    if (collectionId) {
      await adminClient.from("prompt_collections").delete().eq("id", collectionId);
    }
    if (postId) {
      await adminClient.from("community_posts").delete().eq("id", postId);
    }
    if (generationId) {
      await adminClient.from("generations").delete().eq("id", generationId);
    }
    if (createdPromptId) {
      await adminClient.from("prompts").delete().eq("id", createdPromptId);
    }

    await cleanupUsers({ adminClient });
    await stopProcessTree(devProcess);
    devProcess.stdout?.destroy();
    devProcess.stderr?.destroy();
    await sleep(500);
  }
}

main().catch((error) => {
  console.error("Phase 4 smoke runner failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
