import { describe, expect, it, vi } from "vitest";
import { isGoogleOAuthEnabled } from "./provider-settings";

describe("isGoogleOAuthEnabled", () => {
  it("returns the public Google provider state from Supabase Auth", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ external: { google: true } }), { status: 200 }),
    );

    await expect(isGoogleOAuthEnabled("https://project.supabase.co/", "sb_publishable_test", fetcher))
      .resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledWith("https://project.supabase.co/auth/v1/settings", {
      headers: { apikey: "sb_publishable_test" },
      cache: "no-store",
    });
  });

  it("returns false when Google is disabled instead of starting a broken OAuth redirect", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ external: { google: false } }), { status: 200 }),
    );

    await expect(isGoogleOAuthEnabled("https://project.supabase.co", "sb_publishable_test", fetcher))
      .resolves.toBe(false);
  });

  it("surfaces a failed settings check so callers can keep the user in the app", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("unavailable", { status: 503 }),
    );

    await expect(isGoogleOAuthEnabled("https://project.supabase.co", "sb_publishable_test", fetcher))
      .rejects.toThrow("503");
  });
});
