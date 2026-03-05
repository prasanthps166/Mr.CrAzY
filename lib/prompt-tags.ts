import { Prompt } from "@/types";

export function normalizePromptTag(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function matchesPromptTag(prompt: Pick<Prompt, "tags">, tag: string) {
  const normalizedTag = normalizePromptTag(tag);
  if (!normalizedTag) return true;

  return prompt.tags.some((candidate) => normalizePromptTag(candidate) === normalizedTag);
}

export function buildPromptTagCloud(prompts: Array<Pick<Prompt, "tags">>, limit = 12) {
  const counts = new Map<string, number>();

  for (const prompt of prompts) {
    for (const rawTag of prompt.tags) {
      const normalizedTag = normalizePromptTag(rawTag);
      if (!normalizedTag) continue;
      counts.set(normalizedTag, (counts.get(normalizedTag) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    })
    .slice(0, Math.max(1, limit))
    .map(([tag, count]) => ({ tag, count }));
}