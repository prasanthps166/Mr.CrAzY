import { afterEach, describe, expect, it, vi } from "vitest";

async function importServerUserModule(options: {
  cookieNames: string[];
  getUserImpl?: () => Promise<{ data: { user: { id: string } | null } }>;
}) {
  vi.resetModules();

  const createServerClient = vi.fn(() => ({
    auth: {
      getUser: options.getUserImpl ?? vi.fn().mockResolvedValue({ data: { user: { id: "viewer-1" } } }),
    },
  }));

  vi.doMock("next/headers", () => ({
    cookies: () => ({
      getAll: () => options.cookieNames.map((name) => ({ name })),
      get: () => undefined,
    }),
  }));

  vi.doMock("@supabase/ssr", () => ({
    createServerClient,
  }));

  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

  const module = await import("@/lib/server-user");
  return { ...module, createServerClient };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("getViewerUserId", () => {
  it("returns null without a Supabase auth cookie and skips the server client", async () => {
    const { createServerClient, getViewerUserId } = await importServerUserModule({
      cookieNames: ["theme"],
    });

    const result = await getViewerUserId();

    expect(result).toBeNull();
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("returns the signed-in user id when an auth cookie is present", async () => {
    const { getViewerUserId } = await importServerUserModule({
      cookieNames: ["sb-project-auth-token"],
      getUserImpl: vi.fn().mockResolvedValue({ data: { user: { id: "viewer-42" } } }),
    });

    const result = await getViewerUserId();

    expect(result).toBe("viewer-42");
  });

  it("returns null when the auth lookup fails", async () => {
    const { getViewerUserId } = await importServerUserModule({
      cookieNames: ["sb-project-auth-token"],
      getUserImpl: vi.fn().mockRejectedValue(new Error("network error")),
    });

    const result = await getViewerUserId();

    expect(result).toBeNull();
  });
});
