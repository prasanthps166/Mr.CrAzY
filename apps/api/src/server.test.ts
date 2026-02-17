import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";

import type { Server } from "node:http";

interface JsonResponse<T> {
  status: number;
  body: T;
}

let server: Server;
let baseUrl = "";
let tempDir = "";

async function requestJson<T>(path: string, init?: RequestInit): Promise<JsonResponse<T>> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = (await response.json()) as T;
  return {
    status: response.status,
    body
  };
}

before(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "fittrack-api-test-"));

  process.env.NODE_ENV = "test";
  process.env.CORS_ORIGIN = "*";
  process.env.STORAGE_BACKEND = "file";
  process.env.FILE_STORAGE_PATH = join(tempDir, "app-data.json");
  process.env.PORT = "4001";

  const { createServer } = await import("./server.js");
  const app = createServer();

  server = await new Promise<Server>((resolve) => {
    const started = app.listen(0, () => resolve(started));
  });

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
  await requestJson<{ message: string }>("/api/v1/sync/data", {
    method: "DELETE"
  });
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  await rm(tempDir, { recursive: true, force: true });
});

test("GET /health returns service and storage info", async () => {
  const result = await requestJson<{
    status: string;
    storage: {
      backend: string;
      fallbackReason: string | null;
    };
  }>("/health");

  assert.equal(result.status, 200);
  assert.equal(result.body.status, "ok");
  assert.equal(result.body.storage.backend, "file");
});

test("profile roundtrip works", async () => {
  const profile = {
    id: "local-user",
    name: "Test User",
    age: 28,
    heightCm: 176,
    currentWeightKg: 73,
    goal: "maintain",
    dailyCalorieTarget: 2400,
    proteinTargetGrams: 140
  };

  const putResult = await requestJson<{ data: typeof profile }>("/api/v1/profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(profile)
  });

  assert.equal(putResult.status, 200);
  assert.equal(putResult.body.data.name, profile.name);

  const getResult = await requestJson<{ data: typeof profile | null }>("/api/v1/profile");
  assert.equal(getResult.status, 200);
  assert.equal(getResult.body.data?.dailyCalorieTarget, profile.dailyCalorieTarget);
});

test("profile id is always scoped to request user", async () => {
  const unique = Date.now().toString(36);
  const password = "password123";

  const registerResult = await requestJson<{
    token: string;
    user: {
      id: string;
      email: string;
    };
  }>("/api/v1/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email: `scope_${unique}@example.com`, password })
  });

  assert.equal(registerResult.status, 201);

  const putResult = await requestJson<{ data: { id: string } }>("/api/v1/profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${registerResult.body.token}`
    },
    body: JSON.stringify({
      id: "spoofed-profile-id",
      name: "Scoped User",
      age: 31,
      heightCm: 178,
      currentWeightKg: 77,
      goal: "maintain",
      dailyCalorieTarget: 2500,
      proteinTargetGrams: 145
    })
  });

  assert.equal(putResult.status, 200);
  assert.equal(putResult.body.data.id, registerResult.body.user.id);

  const getResult = await requestJson<{ data: { id: string } | null }>("/api/v1/profile", {
    headers: {
      Authorization: `Bearer ${registerResult.body.token}`
    }
  });

  assert.equal(getResult.status, 200);
  assert.equal(getResult.body.data?.id, registerResult.body.user.id);
});

test("workout create/list/delete works", async () => {
  const payload = {
    id: "wk_test_1",
    date: "2026-02-16",
    workoutType: "strength",
    durationMinutes: 48,
    exerciseEntries: [
      {
        id: "ex_test_1",
        name: "Barbell Bench Press",
        sets: 4,
        reps: 6,
        weightKg: 70
      },
      {
        id: "ex_test_2",
        name: "Cable Row",
        sets: 3,
        reps: 10
      }
    ],
    intensityRpe: 8.5,
    caloriesBurned: 390,
    templateName: "Push A",
    notes: "solid session",
    createdAt: new Date().toISOString()
  };

  const createResult = await requestJson<{ data: { id: string } }>("/api/v1/workouts/logs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  assert.equal(createResult.status, 201);
  assert.equal(createResult.body.data.id, payload.id);

  const listResult = await requestJson<{
    count: number;
    data: Array<{
      id: string;
      exerciseEntries: Array<{ name: string; sets: number; reps: number; weightKg?: number }>;
      intensityRpe?: number;
      caloriesBurned?: number;
      templateName?: string;
    }>;
  }>("/api/v1/workouts/logs");
  assert.equal(listResult.status, 200);
  assert.equal(listResult.body.count, 1);
  assert.equal(listResult.body.data[0]?.exerciseEntries.length, 2);
  assert.equal(listResult.body.data[0]?.exerciseEntries[0]?.name, "Barbell Bench Press");
  assert.equal(listResult.body.data[0]?.intensityRpe, 8.5);
  assert.equal(listResult.body.data[0]?.caloriesBurned, 390);
  assert.equal(listResult.body.data[0]?.templateName, "Push A");

  const deleteResult = await requestJson<{ message: string }>("/api/v1/workouts/logs/wk_test_1", {
    method: "DELETE"
  });

  assert.equal(deleteResult.status, 200);
  assert.equal(deleteResult.body.message, "Workout deleted");

  const listAfterDelete = await requestJson<{ count: number }>("/api/v1/workouts/logs");
  assert.equal(listAfterDelete.body.count, 0);
});

test("nutrition put/delete works", async () => {
  const putResult = await requestJson<{ message: string }>("/api/v1/nutrition/logs/2026-02-16", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      calories: 2200,
      protein: 140,
      carbs: 250,
      fat: 70,
      waterLiters: 2.5
    })
  });

  assert.equal(putResult.status, 200);

  const deleteResult = await requestJson<{ message: string }>("/api/v1/nutrition/logs/2026-02-16", {
    method: "DELETE"
  });

  assert.equal(deleteResult.status, 200);
  assert.equal(deleteResult.body.message, "Nutrition deleted");
});

test("progress post/delete and snapshot consistency works", async () => {
  const progressPayload = {
    id: "prog_test_1",
    date: "2026-02-16",
    weightKg: 72.4,
    bodyFatPct: 16.2,
    waistCm: 80
  };

  const createResult = await requestJson<{ message: string }>("/api/v1/progress/entries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(progressPayload)
  });
  assert.equal(createResult.status, 201);

  const snapshotBeforeDelete = await requestJson<{
    progressEntries: Array<{ id: string }>;
  }>("/api/v1/sync/snapshot");
  assert.equal(snapshotBeforeDelete.status, 200);
  assert.equal(snapshotBeforeDelete.body.progressEntries.length, 1);

  const deleteResult = await requestJson<{ message: string }>("/api/v1/progress/entries/prog_test_1", {
    method: "DELETE"
  });
  assert.equal(deleteResult.status, 200);
  assert.equal(deleteResult.body.message, "Progress deleted");

  const snapshotAfterDelete = await requestJson<{
    progressEntries: Array<{ id: string }>;
  }>("/api/v1/sync/snapshot");
  assert.equal(snapshotAfterDelete.status, 200);
  assert.equal(snapshotAfterDelete.body.progressEntries.length, 0);
});

test("auth register/login/me works", async () => {
  const unique = Date.now().toString(36);
  const email = `tester_${unique}@example.com`;
  const password = "password123";

  const registerResult = await requestJson<{
    token: string;
    user: {
      id: string;
      email: string;
    };
  }>("/api/v1/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  assert.equal(registerResult.status, 201);
  assert.equal(registerResult.body.user.email, email);
  assert.equal(typeof registerResult.body.token, "string");

  const loginResult = await requestJson<{
    token: string;
    user: {
      id: string;
      email: string;
    };
  }>("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  assert.equal(loginResult.status, 200);
  assert.equal(loginResult.body.user.email, email);
  assert.equal(typeof loginResult.body.token, "string");

  const meResult = await requestJson<{
    user: {
      id: string;
      email: string;
    };
  }>("/api/v1/auth/me", {
    headers: {
      Authorization: `Bearer ${loginResult.body.token}`
    }
  });

  assert.equal(meResult.status, 200);
  assert.equal(meResult.body.user.email, email);
});

test("auth users are data-isolated", async () => {
  const unique = Date.now().toString(36);
  const password = "password123";

  const registerA = await requestJson<{
    token: string;
    user: {
      id: string;
      email: string;
    };
  }>("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `a_${unique}@example.com`, password })
  });
  assert.equal(registerA.status, 201);

  const registerB = await requestJson<{
    token: string;
    user: {
      id: string;
      email: string;
    };
  }>("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `b_${unique}@example.com`, password })
  });
  assert.equal(registerB.status, 201);

  const profileA = {
    id: "profile-a",
    name: "User A",
    age: 30,
    heightCm: 175,
    currentWeightKg: 70,
    goal: "maintain",
    dailyCalorieTarget: 2400,
    proteinTargetGrams: 130
  };

  const profileB = {
    id: "profile-b",
    name: "User B",
    age: 26,
    heightCm: 168,
    currentWeightKg: 62,
    goal: "lose_weight",
    dailyCalorieTarget: 1900,
    proteinTargetGrams: 110
  };

  const putProfileA = await requestJson<{ data: { name: string } }>("/api/v1/profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${registerA.body.token}`
    },
    body: JSON.stringify(profileA)
  });
  assert.equal(putProfileA.status, 200);

  const putProfileB = await requestJson<{ data: { name: string } }>("/api/v1/profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${registerB.body.token}`
    },
    body: JSON.stringify(profileB)
  });
  assert.equal(putProfileB.status, 200);

  const snapshotA = await requestJson<{ profile: { name: string } | null }>("/api/v1/sync/snapshot", {
    headers: {
      Authorization: `Bearer ${registerA.body.token}`
    }
  });
  const snapshotB = await requestJson<{ profile: { name: string } | null }>("/api/v1/sync/snapshot", {
    headers: {
      Authorization: `Bearer ${registerB.body.token}`
    }
  });

  assert.equal(snapshotA.status, 200);
  assert.equal(snapshotB.status, 200);
  assert.equal(snapshotA.body.profile?.name, "User A");
  assert.equal(snapshotB.body.profile?.name, "User B");
});
