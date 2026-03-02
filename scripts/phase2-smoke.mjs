import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn, execFile } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import { promisify } from "node:util";

import { createClient } from "@supabase/supabase-js";

const workspace = process.cwd();
const envPath = path.join(workspace, ".env.local");
const smokeImagePath = path.join(workspace, "smoke.jpg");
const port = 3200 + Math.floor(Math.random() * 400);
const baseUrl = `http://127.0.0.1:${port}`;
const testRunId = Date.now();
const testPrefix = `phase2-smoke-${testRunId}`;
const results = [];

/** @type {Array<{ id: string; email: string }>} */
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

async function createAndLoginUser({
  adminClient,
  publicClient,
  email,
  password,
  userMetadata,
}) {
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

async function cleanup({ adminClient }) {
  for (const user of createdUsers.reverse()) {
    try {
      await adminClient.auth.admin.deleteUser(user.id);
      console.log(`[CLEANUP] deleted ${user.email}`);
    } catch {
      console.log(`[CLEANUP] failed to delete ${user.email}`);
    }
  }
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
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

async function main() {
  if (!existsSync(envPath)) {
    throw new Error(".env.local not found");
  }
  if (!existsSync(smokeImagePath)) {
    throw new Error("smoke.jpg not found");
  }

  const envContent = await readFile(envPath, "utf8");
  const fileEnv = parseEnv(envContent);

  const supabaseUrl = requiredEnv(fileEnv, "NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = requiredEnv(fileEnv, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = requiredEnv(fileEnv, "SUPABASE_SERVICE_ROLE_KEY");

  const adminEmail = `admin+${testPrefix}@example.com`;

  const serverEnv = {
    ...process.env,
    ...fileEnv,
    ADMIN_EMAIL: adminEmail,
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

  let createdPromptId = null;

  try {
    // Migration readiness checks
    const migrationChecks = [
      "creator_profiles",
      "marketplace_prompts",
      "prompt_purchases",
      "prompt_ratings",
      "analytics_events",
      "referrals",
    ];

    for (const table of migrationChecks) {
      const { error } = await adminClient.from(table).select("id", { count: "exact", head: true });
      logResult(`DB table exists: ${table}`, !error, error?.message || "ok");
      if (error) {
        throw new Error(`Missing required table: ${table}`);
      }
    }

    {
      const { error } = await adminClient
        .from("users")
        .select("id, referral_code, referred_by_user_id, is_suspended, welcome_email_sent_at")
        .limit(1);
      logResult("DB columns exist: users (phase2)", !error, error?.message || "ok");
      if (error) {
        throw new Error("Missing required users columns for phase2 migrations");
      }
    }

    // Create users
    const creator = await createAndLoginUser({
      adminClient,
      publicClient,
      email: `creator+${testPrefix}@example.com`,
      password: "Passw0rd!123",
      userMetadata: { full_name: `Creator ${testRunId}` },
    });
    await bootstrapUserProfile({ token: creator.token, baseUrl });
    logResult("Create/login creator", true, creator.userId);

    const adminUser = await createAndLoginUser({
      adminClient,
      publicClient,
      email: adminEmail,
      password: "Passw0rd!123",
      userMetadata: { full_name: `Admin ${testRunId}` },
    });
    await bootstrapUserProfile({ token: adminUser.token, baseUrl });
    logResult("Create/login admin", true, adminUser.userId);

    const buyer1 = await createAndLoginUser({
      adminClient,
      publicClient,
      email: `buyer1+${testPrefix}@example.com`,
      password: "Passw0rd!123",
      userMetadata: { full_name: `Buyer1 ${testRunId}` },
    });
    await bootstrapUserProfile({ token: buyer1.token, baseUrl });
    logResult("Create/login buyer1", true, buyer1.userId);

    const buyer2 = await createAndLoginUser({
      adminClient,
      publicClient,
      email: `buyer2+${testPrefix}@example.com`,
      password: "Passw0rd!123",
      userMetadata: { full_name: `Buyer2 ${testRunId}` },
    });
    await bootstrapUserProfile({ token: buyer2.token, baseUrl });
    logResult("Create/login buyer2", true, buyer2.userId);

    const buyer3 = await createAndLoginUser({
      adminClient,
      publicClient,
      email: `buyer3+${testPrefix}@example.com`,
      password: "Passw0rd!123",
      userMetadata: { full_name: `Buyer3 ${testRunId}` },
    });
    await bootstrapUserProfile({ token: buyer3.token, baseUrl });
    logResult("Create/login buyer3", true, buyer3.userId);

    // Creator profile create
    {
      const { response, data } = await requestJson(`${baseUrl}/api/creator/profile/create`, {
        method: "POST",
        headers: authHeaders(creator.token),
        body: JSON.stringify({
          display_name: `Creator ${testRunId}`,
          bio: "Smoke test creator profile",
          payout_email: `payout+${testPrefix}@example.com`,
        }),
      });
      logResult("POST /api/creator/profile/create", response.ok, data.message || data.onboardingUrl || "ok");
      if (!response.ok) throw new Error("creator profile creation failed");
    }

    // Creator prompt submit
    {
      const imageBuffer = await readFile(smokeImagePath);
      const imageFile = new File([imageBuffer], `smoke-${testRunId}.jpg`, { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("title", `Smoke Prompt ${testRunId}`);
      formData.append("description", "Phase 2 smoke test prompt");
      formData.append("category", "Art");
      formData.append("tags", "smoke,test,phase2");
      formData.append("prompt_text", "smoke test prompt text with enough detail");
      formData.append("is_free", "false");
      formData.append("price", "299");
      formData.append("cover_image", imageFile);

      const extra1 = new File([imageBuffer], `smoke-extra1-${testRunId}.jpg`, { type: "image/jpeg" });
      formData.append("example_images", extra1);

      const response = await fetch(`${baseUrl}/api/creator/prompt/submit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creator.token}`,
        },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      logResult("POST /api/creator/prompt/submit", response.ok, data.message || data.status || "ok");
      if (!response.ok) throw new Error("prompt submit failed");
      createdPromptId = data.id;
    }

    // Admin dashboard route
    {
      const { response, data } = await requestJson(`${baseUrl}/api/admin/dashboard`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${adminUser.token}`,
        },
      });
      logResult("GET /api/admin/dashboard", response.ok, data.message || "ok");
      if (!response.ok) throw new Error("admin dashboard failed");
    }

    // Admin review approve
    {
      const { response, data } = await requestJson(`${baseUrl}/api/admin/marketplace/review`, {
        method: "POST",
        headers: authHeaders(adminUser.token),
        body: JSON.stringify({
          prompt_id: createdPromptId,
          action: "approve",
        }),
      });
      logResult("POST /api/admin/marketplace/review approve", response.ok, data.message || data.status || "ok");
      if (!response.ok) throw new Error("admin approve failed");
    }

    // Buyers purchase prompt
    for (const [index, buyer] of [buyer1, buyer2, buyer3].entries()) {
      const { response, data } = await requestJson(`${baseUrl}/api/marketplace/purchase`, {
        method: "POST",
        headers: authHeaders(buyer.token),
        body: JSON.stringify({
          marketplace_prompt_id: createdPromptId,
        }),
      });
      logResult(
        `POST /api/marketplace/purchase buyer${index + 1}`,
        response.ok,
        data.message || (data.purchased ? "purchased" : "ok"),
      );
      if (!response.ok) throw new Error(`buyer${index + 1} purchase failed`);
    }

    // My purchases
    {
      const { response, data } = await requestJson(`${baseUrl}/api/marketplace/my-purchases`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${buyer1.token}`,
        },
      });
      const hasPrompt = Array.isArray(data.promptIds) && data.promptIds.includes(createdPromptId);
      logResult("GET /api/marketplace/my-purchases", response.ok && hasPrompt, data.message || "ok");
      if (!response.ok || !hasPrompt) throw new Error("my-purchases failed");
    }

    // Rating submit
    {
      const { response, data } = await requestJson(`${baseUrl}/api/ratings/submit`, {
        method: "POST",
        headers: authHeaders(buyer1.token),
        body: JSON.stringify({
          marketplace_prompt_id: createdPromptId,
          rating: 5,
          review_text: "Excellent smoke-test prompt",
        }),
      });
      logResult("POST /api/ratings/submit", response.ok, data.message || `avg=${data.rating_avg}`);
      if (!response.ok) throw new Error("rating submit failed");
    }

    // Creator dashboard
    {
      const { response, data } = await requestJson(`${baseUrl}/api/creator/dashboard`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${creator.token}`,
        },
      });
      const hasSales = response.ok && Number(data?.stats?.totalSales ?? 0) >= 3;
      logResult("GET /api/creator/dashboard", hasSales, data.message || `sales=${data?.stats?.totalSales ?? 0}`);
      if (!hasSales) throw new Error("creator dashboard sales check failed");
    }

    // Creator payout (>= Rs500 after 3 purchases at Rs299)
    {
      const { response, data } = await requestJson(`${baseUrl}/api/creator/payout`, {
        method: "POST",
        headers: authHeaders(creator.token),
        body: JSON.stringify({}),
      });
      logResult("POST /api/creator/payout", response.ok, data.message || data.transferId || "ok");
      if (!response.ok) throw new Error("creator payout failed");
    }

    // Referrals stats + link
    let referralCode = null;
    {
      const { response, data } = await requestJson(`${baseUrl}/api/referrals/stats`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${buyer1.token}`,
        },
      });
      referralCode = data.referralCode ?? null;
      logResult("GET /api/referrals/stats", response.ok && Boolean(referralCode), data.message || "ok");
      if (!response.ok || !referralCode) throw new Error("referrals stats failed");
    }

    {
      const { response, data } = await requestJson(`${baseUrl}/api/referrals/link`, {
        method: "POST",
        headers: authHeaders(buyer2.token),
        body: JSON.stringify({ code: referralCode }),
      });
      logResult("POST /api/referrals/link", response.ok, data.message || `linked=${data.linked}`);
      if (!response.ok) throw new Error("referrals link failed");
    }

    // Analytics event endpoint
    {
      const { response, data } = await requestJson(`${baseUrl}/api/analytics/event`, {
        method: "POST",
        headers: authHeaders(buyer1.token),
        body: JSON.stringify({
          event_type: "share",
          metadata: { source: "smoke_test", run: testRunId },
        }),
      });
      logResult("POST /api/analytics/event", response.ok, data.message || "ok");
      if (!response.ok) throw new Error("analytics event failed");
    }

    // Admin prompts CRUD surface checks
    {
      const { response } = await requestJson(`${baseUrl}/api/admin/prompts`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${adminUser.token}`,
        },
      });
      logResult("GET /api/admin/prompts", response.ok, "ok");
      if (!response.ok) throw new Error("admin prompts get failed");
    }

    {
      const { response } = await requestJson(`${baseUrl}/api/admin/users/manage`, {
        method: "POST",
        headers: authHeaders(adminUser.token),
        body: JSON.stringify({
          user_id: buyer1.userId,
          action: "add_credits",
          amount: 1,
        }),
      });
      logResult("POST /api/admin/users/manage", response.ok, "ok");
      if (!response.ok) throw new Error("admin users manage failed");
    }

    {
      const { response, data } = await requestJson(`${baseUrl}/api/creator/weekly-digest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminUser.token}`,
        },
      });
      logResult("POST /api/creator/weekly-digest", response.ok, data.message || `sent=${data.sent ?? 0}`);
      if (!response.ok) throw new Error("weekly digest failed");
    }

    // Creator prompt manage update
    {
      const { response, data } = await requestJson(`${baseUrl}/api/creator/prompt/manage`, {
        method: "PUT",
        headers: authHeaders(creator.token),
        body: JSON.stringify({
          id: createdPromptId,
          title: `Smoke Prompt ${testRunId} Updated`,
          description: "Updated via smoke test",
        }),
      });
      logResult("PUT /api/creator/prompt/manage", response.ok, data.message || "ok");
      if (!response.ok) throw new Error("creator prompt manage update failed");
    }

    // Creator connect onboarding (expected to work in mock mode when stripe missing)
    {
      const { response, data } = await requestJson(`${baseUrl}/api/creator/connect/onboarding`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creator.token}`,
        },
      });
      logResult("POST /api/creator/connect/onboarding", response.ok, data.message || "ok");
      if (!response.ok) throw new Error("creator connect onboarding failed");
    }

    // Negative auth check
    {
      const { response } = await requestJson(`${baseUrl}/api/marketplace/my-purchases`, {
        method: "GET",
      });
      logResult("GET /api/marketplace/my-purchases unauthorized", response.status === 401, `status=${response.status}`);
    }

    // Cleanup created prompt data from DB to reduce noise
    if (createdPromptId) {
      await adminClient.from("prompt_ratings").delete().eq("marketplace_prompt_id", createdPromptId);
      await adminClient.from("prompt_purchases").delete().eq("marketplace_prompt_id", createdPromptId);
      await adminClient.from("marketplace_prompts").delete().eq("id", createdPromptId);
      logResult("Cleanup marketplace prompt rows", true, createdPromptId);
    }

    const failed = results.filter((item) => !item.ok);
    console.log("\n==== Phase 2 Smoke Summary ====");
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
    await cleanup({ adminClient });
    await stopProcessTree(devProcess);
    devProcess.stdout?.destroy();
    devProcess.stderr?.destroy();
    await sleep(500);
  }
}

main().catch((error) => {
  console.error("Smoke test runner failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
