type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitRecord>();
const upstashRestUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const upstashRestToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  backend: "memory" | "redis";
};

function checkRateLimitInMemory(
  key: string,
  limit = 5,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetAt,
      backend: "memory",
    };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt, backend: "memory" };
  }

  current.count += 1;
  store.set(key, current);
  return {
    allowed: true,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
    backend: "memory",
  };
}

function isRedisRateLimitConfigured() {
  return Boolean(upstashRestUrl && upstashRestToken);
}

async function runRedisCommand(args: Array<string | number>) {
  if (!upstashRestUrl || !upstashRestToken) {
    throw new Error("Upstash Redis is not configured");
  }

  const response = await fetch(`${upstashRestUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${upstashRestToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([args]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Redis command failed with status ${response.status}`);
  }

  const payload = (await response.json()) as Array<{
    result?: unknown;
    error?: string;
  }>;
  const first = Array.isArray(payload) ? payload[0] : null;
  if (!first || first.error) {
    throw new Error(first?.error || "Invalid Redis response");
  }
  return first.result;
}

async function checkRateLimitInRedis(key: string, limit = 5, windowMs = 60_000): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;
  const now = Date.now();

  const incrementResult = await runRedisCommand(["INCR", redisKey]);
  const count = Number(incrementResult);
  if (!Number.isFinite(count) || count < 1) {
    throw new Error("Invalid Redis increment result");
  }

  let ttlMs: number;
  if (count === 1) {
    await runRedisCommand(["PEXPIRE", redisKey, Math.max(1, Math.floor(windowMs))]);
    ttlMs = windowMs;
  } else {
    const ttlResult = await runRedisCommand(["PTTL", redisKey]);
    const parsedTtl = Number(ttlResult);
    ttlMs = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : windowMs;
  }

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: now + ttlMs,
    backend: "redis",
  };
}

export async function checkRateLimit(key: string, limit = 5, windowMs = 60_000): Promise<RateLimitResult> {
  if (!isRedisRateLimitConfigured()) {
    return checkRateLimitInMemory(key, limit, windowMs);
  }

  try {
    return await checkRateLimitInRedis(key, limit, windowMs);
  } catch {
    return checkRateLimitInMemory(key, limit, windowMs);
  }
}
