import { describe, expect, it } from "vitest";

import {
  buildApiKeysCsv,
  filterAndSortApiKeys,
  getApiKeysExportFileName,
} from "@/lib/dashboard-api-keys";

const rows = [
  {
    id: "key-1",
    name: "Production",
    is_active: true,
    total_calls: 250,
    monthly_limit: 1000,
    created_at: "2026-03-05T08:00:00.000Z",
    last_used_at: "2026-03-05T09:00:00.000Z",
    key_preview: "pg_live_xxxx",
  },
  {
    id: "key-2",
    name: "Staging",
    is_active: false,
    total_calls: 80,
    monthly_limit: 500,
    created_at: "2026-03-04T08:00:00.000Z",
    last_used_at: null,
    key_preview: "pg_live_yyyy",
  },
] as const;

describe("filterAndSortApiKeys", () => {
  it("filters by status", () => {
    const result = filterAndSortApiKeys(rows, {
      search: "",
      status: "active",
      sort: "newest",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("key-1");
  });

  it("sorts by name", () => {
    const result = filterAndSortApiKeys(rows, {
      search: "",
      status: "all",
      sort: "name",
    });

    expect(result.map((row) => row.id)).toEqual(["key-1", "key-2"]);
  });
});

describe("buildApiKeysCsv", () => {
  it("returns csv with headers", () => {
    const csv = buildApiKeysCsv(rows);

    expect(csv).toContain("key_id,name,status,total_calls,monthly_limit,last_used_at,created_at,key_preview");
    expect(csv).toContain("key-1");
    expect(csv.endsWith("\n")).toBe(true);
  });
});

describe("getApiKeysExportFileName", () => {
  it("builds deterministic export filename", () => {
    const fileName = getApiKeysExportFileName(new Date("2026-03-05T10:45:00.000Z"));
    expect(fileName).toBe("promptgallery-api-keys-20260305-1045.csv");
  });
});
