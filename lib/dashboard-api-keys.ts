export type ApiKeyRowLike = {
  id: string;
  name: string;
  is_active: boolean;
  total_calls: number;
  monthly_limit: number;
  created_at: string;
  last_used_at: string | null;
  key_preview: string;
};

export type ApiKeyStatusFilter = "all" | "active" | "revoked";
export type ApiKeySort = "newest" | "most_calls" | "name";

export type ApiKeyFilters = {
  search: string;
  status: ApiKeyStatusFilter;
  sort: ApiKeySort;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function escapeCsvValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (!text.includes(",") && !text.includes('"') && !text.includes("\n")) {
    return text;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function padTwo(value: number) {
  return String(value).padStart(2, "0");
}

export function filterAndSortApiKeys<T extends ApiKeyRowLike>(
  rows: T[],
  filters: ApiKeyFilters,
) {
  const normalizedSearch = normalize(filters.search);

  return [...rows]
    .filter((row) => {
      if (filters.status === "active" && !row.is_active) return false;
      if (filters.status === "revoked" && row.is_active) return false;
      return true;
    })
    .filter((row) => {
      if (!normalizedSearch) return true;
      return normalize(`${row.name} ${row.key_preview}`).includes(normalizedSearch);
    })
    .sort((a, b) => {
      if (filters.sort === "most_calls") {
        if (b.total_calls !== a.total_calls) return b.total_calls - a.total_calls;
      }
      if (filters.sort === "name") {
        return a.name.localeCompare(b.name);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

export function buildApiKeysCsv(rows: ApiKeyRowLike[]) {
  const headers = [
    "key_id",
    "name",
    "status",
    "total_calls",
    "monthly_limit",
    "last_used_at",
    "created_at",
    "key_preview",
  ];

  const values = rows.map((row) => [
    row.id,
    row.name,
    row.is_active ? "active" : "revoked",
    row.total_calls,
    row.monthly_limit,
    row.last_used_at ?? "",
    row.created_at,
    row.key_preview,
  ]);

  const csvRows = [headers, ...values]
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\n");

  return `${csvRows}\n`;
}

export function getApiKeysExportFileName(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = padTwo(now.getUTCMonth() + 1);
  const day = padTwo(now.getUTCDate());
  const hours = padTwo(now.getUTCHours());
  const minutes = padTwo(now.getUTCMinutes());

  return `promptgallery-api-keys-${year}${month}${day}-${hours}${minutes}.csv`;
}
