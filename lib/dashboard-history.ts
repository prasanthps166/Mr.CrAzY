import { GenerationWithPrompt } from "@/types";

export type DashboardHistoryPeriod = "all" | "7d" | "30d";
export type DashboardHistorySort = "newest" | "oldest";

export type DashboardHistoryFilters = {
  search: string;
  period: DashboardHistoryPeriod;
  sort: DashboardHistorySort;
};

type HistoryLike = Pick<
  GenerationWithPrompt,
  "id" | "prompt_id" | "created_at" | "generated_image_url" | "original_image_url" | "is_public" | "prompt"
>;

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

function includesSearch(item: HistoryLike, normalizedSearch: string) {
  if (!normalizedSearch) return true;
  const haystack = normalize(
    `${item.prompt?.title ?? ""} ${item.prompt?.category ?? ""} ${item.prompt?.description ?? ""}`,
  );
  return haystack.includes(normalizedSearch);
}

function isWithinPeriod(item: HistoryLike, period: DashboardHistoryPeriod, nowMs: number) {
  if (period === "all") return true;
  const maxAgeDays = period === "7d" ? 7 : 30;
  const minTimestamp = nowMs - maxAgeDays * 24 * 60 * 60 * 1000;
  return new Date(item.created_at).getTime() >= minTimestamp;
}

export function filterDashboardHistory<T extends HistoryLike>(
  items: T[],
  filters: DashboardHistoryFilters,
  nowMs = Date.now(),
) {
  const normalizedSearch = normalize(filters.search);
  return [...items]
    .filter((item) => includesSearch(item, normalizedSearch))
    .filter((item) => isWithinPeriod(item, filters.period, nowMs))
    .sort((a, b) => {
      const left = new Date(a.created_at).getTime();
      const right = new Date(b.created_at).getTime();
      return filters.sort === "oldest" ? left - right : right - left;
    });
}

export function buildDashboardHistoryCsv(items: HistoryLike[]) {
  const headers = [
    "generation_id",
    "created_at",
    "prompt_id",
    "prompt_title",
    "prompt_category",
    "is_public",
    "original_image_url",
    "generated_image_url",
  ];

  const rows = items.map((item) => [
    item.id,
    item.created_at,
    item.prompt_id,
    item.prompt?.title ?? "",
    item.prompt?.category ?? "",
    item.is_public ? "yes" : "no",
    item.original_image_url,
    item.generated_image_url,
  ]);

  const csvRows = [headers, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\n");

  return `${csvRows}\n`;
}
