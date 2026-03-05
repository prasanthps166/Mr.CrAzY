import { Prompt } from "@/types";

type PreferenceProfile = {
  categoryScores: Map<string, number>;
  tagScores: Map<string, number>;
};

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase();
}

function getSignal(signals: Map<string, number>, promptId: string) {
  return signals.get(promptId) ?? 1;
}

function buildPreferenceProfile(sourcePrompts: Prompt[], signals: Map<string, number>): PreferenceProfile {
  const categoryScores = new Map<string, number>();
  const tagScores = new Map<string, number>();

  for (const prompt of sourcePrompts) {
    const signal = getSignal(signals, prompt.id);

    const categoryKey = prompt.category.trim().toLowerCase();
    categoryScores.set(categoryKey, (categoryScores.get(categoryKey) ?? 0) + signal * 2);

    for (const tag of prompt.tags) {
      const tagKey = normalizeTag(tag);
      if (!tagKey) continue;
      tagScores.set(tagKey, (tagScores.get(tagKey) ?? 0) + signal);
    }
  }

  return {
    categoryScores,
    tagScores,
  };
}

function getRecencyBonus(createdAt: string) {
  const createdMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdMs)) return 0;
  const ageDays = (Date.now() - createdMs) / (24 * 60 * 60 * 1000);
  if (ageDays <= 30) return 1;
  if (ageDays <= 90) return 0.5;
  return 0;
}

export function scorePromptCandidate(
  prompt: Prompt,
  profile: PreferenceProfile,
) {
  const categoryKey = prompt.category.trim().toLowerCase();
  const categoryScore = profile.categoryScores.get(categoryKey) ?? 0;

  let tagScore = 0;
  for (const tag of prompt.tags) {
    const tagKey = normalizeTag(tag);
    if (!tagKey) continue;
    tagScore += profile.tagScores.get(tagKey) ?? 0;
  }

  const popularityScore = prompt.use_count * 0.05;
  const featuredScore = prompt.is_featured ? 2 : 0;
  const recencyBonus = getRecencyBonus(prompt.created_at);

  return categoryScore * 2 + tagScore * 1.2 + popularityScore + featuredScore + recencyBonus;
}

export function rankRecommendedPrompts(options: {
  sourcePrompts: Prompt[];
  candidates: Prompt[];
  signals: Map<string, number>;
  limit: number;
}) {
  const { sourcePrompts, candidates, signals, limit } = options;
  const sourceIds = new Set(sourcePrompts.map((prompt) => prompt.id));
  const profile = buildPreferenceProfile(sourcePrompts, signals);

  const ranked = candidates
    .filter((prompt) => !sourceIds.has(prompt.id))
    .map((prompt) => ({
      prompt,
      score: scorePromptCandidate(prompt, profile),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return +new Date(right.prompt.created_at) - +new Date(left.prompt.created_at);
    })
    .map((item) => item.prompt);

  return ranked.slice(0, limit);
}
export function rankRelatedPrompts(options: {
  sourcePrompt: Prompt;
  candidates: Prompt[];
  limit: number;
}) {
  const { sourcePrompt, candidates, limit } = options;
  const sourceId = sourcePrompt.id;
  const sourceCategory = sourcePrompt.category.trim().toLowerCase();
  const sourceTags = new Set(sourcePrompt.tags.map(normalizeTag).filter(Boolean));

  const ranked = candidates
    .filter((candidate) => candidate.id !== sourceId)
    .map((candidate) => {
      const candidateCategory = candidate.category.trim().toLowerCase();
      const categoryScore = candidateCategory === sourceCategory ? 8 : 0;

      let overlapScore = 0;
      for (const tag of candidate.tags) {
        const normalizedTag = normalizeTag(tag);
        if (!normalizedTag) continue;
        if (sourceTags.has(normalizedTag)) {
          overlapScore += 3;
        }
      }

      const popularityScore = candidate.use_count * 0.03;
      const featuredScore = candidate.is_featured ? 1 : 0;
      const recencyBonus = getRecencyBonus(candidate.created_at);
      const score = categoryScore + overlapScore + popularityScore + featuredScore + recencyBonus;

      return { prompt: candidate, score };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.prompt.use_count !== left.prompt.use_count) return right.prompt.use_count - left.prompt.use_count;
      return +new Date(right.prompt.created_at) - +new Date(left.prompt.created_at);
    })
    .map((entry) => entry.prompt);

  return ranked.slice(0, limit);
}
