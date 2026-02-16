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

test("workout create/list/delete works", async () => {
  const payload = {
    id: "wk_test_1",
    date: "2026-02-16",
    workoutType: "strength",
    durationMinutes: 48,
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

  const listResult = await requestJson<{ count: number }>("/api/v1/workouts/logs");
  assert.equal(listResult.status, 200);
  assert.equal(listResult.body.count, 1);

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
