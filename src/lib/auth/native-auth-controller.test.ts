import { describe, expect, it, vi } from "vitest";
import { NativeAuthController, NATIVE_AUTH_PENDING_KEY, NATIVE_AUTH_TIMEOUT_MS } from "./native-auth-controller";

const callback = "folklard://auth/callback?code=12345678-code&sb_flow_id=flow_1234";
function fixture() {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const exchange = vi.fn().mockResolvedValue({ data: { session: { user: { id: "account" } } }, error: null });
  const clock = { now: 1000 };
  const controller = new NativeAuthController(storage, "https://game.example", exchange, () => clock.now);
  return { storage, exchange, clock, controller };
}
describe("native PKCE session exchange", () => {
  it("exchanges in the initiating app and forwards flow ID", async () => {
    const { controller, exchange, storage } = fixture();
    controller.begin();
    expect(await controller.accept(callback)).toBe("signed-in");
    expect(exchange).toHaveBeenCalledExactlyOnceWith("12345678-code", { flowId: "flow_1234" });
    expect(storage.getItem(NATIVE_AUTH_PENDING_KEY)).toBeNull();
  });
  it("restores a pending transaction after closing/reopening the app", async () => {
    const { controller, storage, exchange, clock } = fixture();
    controller.begin();
    const restarted = new NativeAuthController(storage, "https://game.example", exchange, () => clock.now);
    expect(await restarted.accept(callback)).toBe("signed-in");
    expect(await controller.accept(callback)).toBe("ignored");
    expect(exchange).toHaveBeenCalledOnce();
  });
  it("does not exchange unsolicited, malformed, cross-origin or expired callbacks", async () => {
    const { controller, storage, exchange, clock } = fixture();
    expect(await controller.accept(callback)).toBe("ignored");
    controller.begin();
    expect(await controller.accept("https://bad.example/?code=12345678")).toBe("ignored");
    const otherOrigin = new NativeAuthController(storage, "https://other.example", exchange);
    expect(await otherOrigin.accept(callback)).toBe("ignored");
    clock.now += NATIVE_AUTH_TIMEOUT_MS + 1;
    expect(await controller.accept(callback)).toBe("expired");
    expect(exchange).not.toHaveBeenCalled();
  });
  it("serializes duplicate/warm/cold deliveries while exchange is pending", async () => {
    const { controller, exchange } = fixture();
    let finish!: (value: unknown) => void;
    exchange.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    controller.begin();
    const first = controller.accept(callback);
    expect(await controller.accept(callback)).toBe("ignored");
    expect(await controller.accept(callback.replace("12345678-code", "other123-code"))).toBe("ignored");
    expect(() => controller.begin()).toThrow("Aguarde");
    expect(() => controller.cancel()).toThrow("Aguarde");
    finish({ data: { session: {} }, error: null });
    expect(await first).toBe("signed-in");
    expect(exchange).toHaveBeenCalledOnce();
  });
  it("retains the pending transaction on network failure and allows recovery", async () => {
    const { controller, exchange, storage } = fixture();
    controller.begin(); exchange.mockRejectedValueOnce(new Error("offline"));
    expect(await controller.accept(callback)).toBe("exchange-error");
    expect(storage.getItem(NATIVE_AUTH_PENDING_KEY)).not.toBeNull();
    expect(await controller.accept(callback)).toBe("signed-in");
  });
  it("does not treat a returned null session or cancellation as success", async () => {
    const { controller, exchange } = fixture();
    controller.begin(); exchange.mockResolvedValueOnce({ data: { session: null }, error: null });
    expect(await controller.accept(callback)).toBe("exchange-error");
    expect(await controller.accept("folklard://auth/callback?error=access_denied")).toBe("provider-error");
  });
  it("ignores a previous attempt's callback without consuming the current PKCE flow", async () => {
    const { controller, exchange } = fixture();
    controller.begin();
    controller.trackOAuthRedirect(`https://project.supabase.co/auth/v1/authorize?redirect_to=${encodeURIComponent("folklard://auth/callback?sb_flow_id=current_1234")}`);
    expect(await controller.accept(callback)).toBe("ignored");
    expect(exchange).not.toHaveBeenCalled();
    expect(await controller.accept(callback.replace("flow_1234", "current_1234"))).toBe("signed-in");
  });
});
