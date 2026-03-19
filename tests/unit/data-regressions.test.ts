import { afterEach, describe, expect, it, vi } from "vitest";

import type { Prompt, UserProfile } from "@/types";

const nowIso = new Date().toISOString();

function prompt(overrides: Partial<Prompt> & Pick<Prompt, "id" | "title" | "category">): Prompt {
  return {
    id: overrides.id,
    title: overrides.title,
    description: overrides.description ?? "desc",
    prompt_text: overrides.prompt_text ?? "text",
    category: overrides.category,
    example_image_url: overrides.example_image_url ?? `https://img/${overrides.id}.jpg`,
    tags: overrides.tags ?? [],
    is_featured: overrides.is_featured ?? false,
    use_count: overrides.use_count ?? 0,
    created_at: overrides.created_at ?? nowIso,
    is_sponsored: false,
    sponsor_name: null,
    sponsor_logo_url: null,
  };
}

class FakePromptQuery implements PromiseLike<{ data: Prompt[] }> {
  private category: string | null = null;
  private featuredOnly = false;
  private limitValue = Number.POSITIVE_INFINITY;
  private requiredTags: string[] = [];
  private searchTerm = "";

  constructor(private readonly rows: Prompt[]) {}

  eq(field: string, value: unknown) {
    if (field === "category") {
      this.category = String(value);
    }
    if (field === "is_featured") {
      this.featuredOnly = Boolean(value);
    }
    return this;
  }

  contains(field: string, value: unknown) {
    if (field === "tags" && Array.isArray(value) && typeof value[0] === "string") {
      this.requiredTags.push(value[0].toLowerCase());
    }
    return this;
  }

  or(expression: string) {
    const match = expression.match(/%(.+?)%/);
    this.searchTerm = match ? match[1].toLowerCase() : "";
    return this;
  }

  order() {
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  then<TResult1 = { data: Prompt[] }, TResult2 = never>(
    onfulfilled?: ((value: { data: Prompt[] }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    let filtered = [...this.rows];

    if (this.category && this.category !== "All") {
      filtered = filtered.filter((item) => item.category === this.category);
    }

    if (this.featuredOnly) {
      filtered = filtered.filter((item) => item.is_featured);
    }

    if (this.requiredTags.length) {
      filtered = filtered.filter((item) => {
        const normalizedTags = item.tags.map((tag) => tag.toLowerCase());
        return this.requiredTags.every((tag) => normalizedTags.includes(tag));
      });
    }

    if (this.searchTerm) {
      filtered = filtered.filter((item) =>
        `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(this.searchTerm),
      );
    }

    filtered = filtered.slice(0, this.limitValue);

    return Promise.resolve({ data: filtered }).then(onfulfilled, onrejected);
  }
}

async function importDataModuleWithSupabase(fakeSupabase: unknown) {
  vi.resetModules();

  vi.doMock("next/cache", () => ({
    unstable_cache: (fn: unknown) => fn,
  }));

  vi.doMock("@/lib/starter-prompts", () => ({
    STARTER_PROMPTS: [],
  }));

  vi.doMock("@/lib/supabase", () => ({
    createServiceRoleClient: () => fakeSupabase,
    isSupabaseServiceConfigured: () => true,
  }));

  return import("@/lib/data");
}

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("getPrompts fallback search behavior", () => {
  it("keeps text search matches when the RPC path is unavailable", async () => {
    const rows = [
      prompt({ id: "popular", title: "Anime Hero", category: "Anime", use_count: 500 }),
      prompt({ id: "match", title: "Vintage Portrait", category: "Vintage", use_count: 5 }),
    ];

    const fakeSupabase = {
      rpc: vi.fn().mockRejectedValue(new Error("rpc unavailable")),
      from: vi.fn((table: string) => {
        if (table !== "prompts") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          select: vi.fn(() => new FakePromptQuery(rows)),
        };
      }),
    };

    const { getPrompts } = await importDataModuleWithSupabase(fakeSupabase);
    const results = await getPrompts({ search: "vintage", limit: 1, sort: "trending" });

    expect(results.map((item) => item.id)).toEqual(["match"]);
  });

  it("keeps tag-only search matches when the RPC path is unavailable", async () => {
    const rows = [
      prompt({ id: "popular", title: "Studio Headshot", category: "Portrait", use_count: 500 }),
      prompt({
        id: "match",
        title: "Moody Portrait",
        description: "low key lighting",
        category: "Portrait",
        tags: ["cinematic"],
        use_count: 5,
      }),
    ];

    const fakeSupabase = {
      rpc: vi.fn().mockRejectedValue(new Error("rpc unavailable")),
      from: vi.fn((table: string) => {
        if (table !== "prompts") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          select: vi.fn(() => new FakePromptQuery(rows)),
        };
      }),
    };

    const { getPrompts } = await importDataModuleWithSupabase(fakeSupabase);
    const results = await getPrompts({ search: "cinematic", limit: 1, sort: "trending" });

    expect(results.map((item) => item.id)).toEqual(["match"]);
  });
});

describe("ensureUserProfile sync behavior", () => {
  it("updates stored name and avatar when auth metadata changes", async () => {
    const existingProfile: UserProfile = {
      id: "user-1",
      email: "user@example.com",
      phone: null,
      full_name: "Old Name",
      avatar_url: "https://img/old.png",
      credits: 10,
      daily_credits_used: 0,
      daily_reset_at: null,
      daily_ad_credits: 0,
      daily_share_credits: 0,
      login_bonus_at: null,
      is_pro: false,
      is_suspended: false,
      credits_reset_at: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      referral_code: null,
      referred_by: null,
      referred_by_user_id: null,
      welcome_email_sent_at: null,
      created_at: nowIso,
    };

    const updatedProfile: UserProfile = {
      ...existingProfile,
      full_name: "New Name",
      avatar_url: "https://img/new.png",
    };

    const maybeSingle = vi.fn().mockResolvedValue({ data: existingProfile });
    const single = vi.fn().mockResolvedValue({ data: updatedProfile });
    const upsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single,
      }),
    });

    const fakeSupabase = {
      from: vi.fn((table: string) => {
        if (table !== "users") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle,
            })),
          })),
          upsert,
        };
      }),
    };

    const { ensureUserProfile } = await importDataModuleWithSupabase(fakeSupabase);

    const result = await ensureUserProfile({
      id: "user-1",
      email: "user@example.com",
      user_metadata: {
        full_name: "New Name",
        avatar_url: "https://img/new.png",
      },
    } as never);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-1",
        email: "user@example.com",
        full_name: "New Name",
        avatar_url: "https://img/new.png",
      }),
      { onConflict: "id" },
    );
    expect(result).toEqual(updatedProfile);
  });
});
