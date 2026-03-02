import { describe, expect, it } from "vitest";

import { hashApiKey, redactApiKey } from "@/lib/api-keys";

describe("api key helpers", () => {
  it("hashes keys deterministically with sha256 output length", () => {
    const one = hashApiKey("pg_live_test_key_12345");
    const two = hashApiKey("pg_live_test_key_12345");
    const three = hashApiKey("pg_live_other_key_67890");

    expect(one).toBe(two);
    expect(one).not.toBe(three);
    expect(one).toMatch(/^[a-f0-9]{64}$/);
  });

  it("redacts all but the last four characters", () => {
    expect(redactApiKey("abcd")).toBe("abcd");
    expect(redactApiKey("abc")).toBe("abc");
    expect(redactApiKey("pg_live_12345678")).toBe("************5678");
  });
});
