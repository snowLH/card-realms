import { beforeEach, describe, expect, it, vi } from "vitest";
const exchange = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { exchangeCodeForSession: exchange } }) }));
vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: () => true }));
import { GET } from "./auth-callback";
beforeEach(() => { vi.clearAllMocks(); exchange.mockResolvedValue({ error: null }); });
describe("web PKCE callback", () => {
  it("exchanges the SDK's specific flow and strips auth codes from the destination", async () => {
    const response = await GET(new Request("https://game.example/auth/callback?code=12345678&sb_flow_id=flow_1234&next=/instalar"));
    expect(exchange).toHaveBeenCalledExactlyOnceWith("12345678", { flowId: "flow_1234" });
    expect(response.headers.get("location")).toBe("https://game.example/instalar");
  });
  it.each(["https://evil.example", "//evil.example", "/\\evil.example"])("rejects an external return path %s", async (next) => {
    const response = await GET(new Request(`https://game.example/auth/callback?code=12345678&next=${encodeURIComponent(next)}`));
    expect(response.headers.get("location")).toBe("https://game.example/");
  });
  it("handles invalid/expired codes without throwing or leaking them", async () => {
    exchange.mockRejectedValueOnce(new Error("network"));
    const response = await GET(new Request("https://game.example/auth/callback?code=12345678"));
    expect(response.headers.get("location")).toBe("https://game.example/?auth=erro");
    await GET(new Request("https://game.example/auth/callback?code=12345678&sb_flow_id=bad"));
    expect(exchange).toHaveBeenCalledOnce();
  });
});
