import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

const workspace = process.cwd();
const envPath = path.join(workspace, ".env.local");
const port = 3600 + Math.floor(Math.random() * 300);
const baseUrl = `http://127.0.0.1:${port}`;
const testRunId = Date.now();
const testPrefix = `phase3-smoke-${testRunId}`;
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

async function bootstrapUserProfile({ token }) {
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

async function run() {
  if (!existsSync(envPath)) {
    throw new Error(".env.local not found");
  }

  const envContent = await readFile(envPath, "utf8");
  const fileEnv = parseEnv(envContent);
  const billingMode = (fileEnv.BILLING_MODE ?? fileEnv.NEXT_PUBLIC_BILLING_MODE ?? "mock").trim().toLowerCase();
  const isStripeBilling = billingMode === "stripe";

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

  try {
    {
      if (isStripeBilling) {
        const { error } = await adminClient.from("billing_transactions").select("id", { count: "exact", head: true });
        logResult("DB table exists: billing_transactions", !error, error?.message || "ok");
        if (error) throw new Error("Missing required table: billing_transactions");
      } else {
        logResult("DB table exists: billing_transactions (stripe mode only)", true, "skipped in mock billing mode");
      }
    }

    {
      if (isStripeBilling) {
        const { error } = await adminClient.from("users").select("stripe_subscription_id").limit(1);
        logResult("DB column exists: users.stripe_subscription_id", !error, error?.message || "ok");
        if (error) throw new Error("Missing required column: users.stripe_subscription_id");
      } else {
        logResult(
          "DB column exists: users.stripe_subscription_id (stripe mode only)",
          true,
          "skipped in mock billing mode",
        );
      }
    }

    const buyer = await createAndLoginUser({
      adminClient,
      publicClient,
      email: `buyer+${testPrefix}@example.com`,
      password: "Passw0rd!123",
      userMetadata: { full_name: `Buyer ${testRunId}` },
    });
    await bootstrapUserProfile({ token: buyer.token });
    logResult("Create/login buyer", true, buyer.userId);

    const adminUser = await createAndLoginUser({
      adminClient,
      publicClient,
      email: adminEmail,
      password: "Passw0rd!123",
      userMetadata: { full_name: `Admin ${testRunId}` },
    });
    await bootstrapUserProfile({ token: adminUser.token });
    logResult("Create/login admin", true, adminUser.userId);

    const beforeCreditsResponse = await requestJson(`${baseUrl}/api/credits`, {
      method: "GET",
      headers: { Authorization: `Bearer ${buyer.token}` },
    });
    const beforeCredits = Number(beforeCreditsResponse.data.credits ?? 0);
    logResult("GET /api/credits before checkout", beforeCreditsResponse.response.ok, `credits=${beforeCredits}`);
    if (!beforeCreditsResponse.response.ok) throw new Error("Failed to fetch credits before checkout");

    const checkoutResult = await requestJson(`${baseUrl}/api/stripe/checkout`, {
      method: "POST",
      headers: authHeaders(buyer.token),
      body: JSON.stringify({ plan: "credits_20" }),
    });
    const checkoutOk = checkoutResult.response.ok;
    logResult("POST /api/stripe/checkout", checkoutOk, checkoutResult.data.message || "ok");
    if (!checkoutOk) throw new Error("Stripe checkout route failed");

    const inStripeMode = Boolean(checkoutResult.data.checkoutUrl);
    logResult(
      "Checkout mode detected",
      true,
      inStripeMode ? "stripe (session URL returned)" : "mock (instant grant)",
    );

    if (inStripeMode) {
      const checkoutUrl = String(checkoutResult.data.checkoutUrl || "");
      logResult("Stripe checkout URL returned", checkoutUrl.startsWith("http"), checkoutUrl.slice(0, 80));
    } else {
      const afterCreditsResponse = await requestJson(`${baseUrl}/api/credits`, {
        method: "GET",
        headers: { Authorization: `Bearer ${buyer.token}` },
      });
      const afterCredits = Number(afterCreditsResponse.data.credits ?? 0);
      const expected = beforeCredits + 20;
      logResult("GET /api/credits after mock checkout", afterCreditsResponse.response.ok, `credits=${afterCredits}`);
      if (!afterCreditsResponse.response.ok) throw new Error("Failed to fetch credits after mock checkout");
      logResult("Mock checkout grants +20 credits", afterCredits === expected, `expected=${expected}, actual=${afterCredits}`);
      logResult("billing_transactions logging in mock checkout", true, "not required in mock billing mode");
    }

    {
      const webhookResult = await requestJson(`${baseUrl}/api/stripe/webhook`, {
        method: "POST",
      });

      if (inStripeMode) {
        logResult(
          "POST /api/stripe/webhook without signature",
          webhookResult.response.status === 400,
          `status=${webhookResult.response.status}`,
        );
      } else {
        logResult(
          "POST /api/stripe/webhook in mock mode",
          webhookResult.response.status === 200 && webhookResult.data.mock === true,
          webhookResult.data.message || `status=${webhookResult.response.status}`,
        );
      }
    }

    if (isStripeBilling) {
      const dashboardResult = await requestJson(`${baseUrl}/api/admin/dashboard`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${adminUser.token}`,
        },
      });
      logResult("GET /api/admin/dashboard", dashboardResult.response.ok, dashboardResult.data.message || "ok");
      if (!dashboardResult.response.ok) {
        throw new Error("Admin dashboard endpoint failed");
      }

      const breakdown = dashboardResult.data?.revenue?.breakdown ?? {};
      const hasBreakdownShape =
        typeof breakdown.subscriptions === "number" &&
        typeof breakdown.creditPacks === "number" &&
        typeof breakdown.marketplaceFees === "number";
      logResult("Admin revenue breakdown shape", hasBreakdownShape, JSON.stringify(breakdown));
      if (!hasBreakdownShape) {
        throw new Error("Admin revenue breakdown shape is invalid");
      }

      const monthly = Array.isArray(dashboardResult.data?.revenue?.monthly)
        ? dashboardResult.data.revenue.monthly
        : [];
      const hasMonthlyShape =
        monthly.length === 0 ||
        monthly.every(
          (item) =>
            typeof item.subscriptions === "number" &&
            typeof item.creditPacks === "number" &&
            typeof item.marketplaceFees === "number",
        );
      logResult("Admin monthly revenue shape", hasMonthlyShape, `rows=${monthly.length}`);
      if (!hasMonthlyShape) {
        throw new Error("Admin monthly revenue shape is invalid");
      }
    } else {
      logResult("GET /api/admin/dashboard (stripe mode only)", true, "skipped in mock billing mode");
    }

    const failed = results.filter((item) => !item.ok);
    console.log("\n==== Phase 3 Smoke Summary ====");
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

run().catch((error) => {
  console.error("Phase 3 smoke runner failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
