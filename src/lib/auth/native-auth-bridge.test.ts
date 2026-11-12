// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({ isNativePlatform: vi.fn(() => false), isPluginAvailable: vi.fn(() => true) }));
const app = vi.hoisted(() => ({ addListener: vi.fn(), getLaunchUrl: vi.fn().mockResolvedValue(undefined) }));
const browser = vi.hoisted(() => ({ open: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@capacitor/core", () => ({ Capacitor: native }));
vi.mock("@capacitor/app", () => ({ App: app }));
vi.mock("@capacitor/browser", () => ({ Browser: browser }));
import { connectNativeAuth, nativeAuthPlatform, openNativeAuth } from "./native-auth-bridge";
afterEach(() => { vi.clearAllMocks(); native.isNativePlatform.mockReturnValue(false); native.isPluginAvailable.mockReturnValue(true); delete window.folklardDesktop; app.getLaunchUrl.mockResolvedValue(undefined); });
describe("native auth lifecycle bridge", () => {
  it("does not register native listeners on the web", () => {
    expect(nativeAuthPlatform()).toBe("web"); connectNativeAuth(vi.fn())();
    expect(app.addListener).not.toHaveBeenCalled();
  });
  it("registers warm callbacks before reading the cold launch URL", async () => {
    native.isNativePlatform.mockReturnValue(true);
    let callback!: (value: { url: string }) => void;
    const remove = vi.fn().mockResolvedValue(undefined);
    app.addListener.mockImplementation(async (event, listener) => {
      expect(event).toBe("appUrlOpen"); expect(app.getLaunchUrl).not.toHaveBeenCalled(); callback = listener; return { remove };
    });
    app.getLaunchUrl.mockResolvedValueOnce({ url: "folklard://auth/callback?code=cold1234" });
    const receive = vi.fn(); const dispose = connectNativeAuth(receive);
    await vi.waitFor(() => expect(receive).toHaveBeenCalledWith("folklard://auth/callback?code=cold1234"));
    callback({ url: "folklard://auth/callback?code=warm1234" });
    expect(receive).toHaveBeenCalledTimes(2); dispose();
    callback({ url: "folklard://auth/callback?code=late1234" });
    expect(receive).toHaveBeenCalledTimes(2); expect(remove).toHaveBeenCalledOnce();
  });
  it("cleans up late registrations after unmount", async () => {
    native.isNativePlatform.mockReturnValue(true);
    let finish!: (handle: unknown) => void;
    app.addListener.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const dispose = connectNativeAuth(vi.fn()); dispose();
    const remove = vi.fn().mockResolvedValue(undefined); finish({ remove });
    await vi.waitFor(() => expect(remove).toHaveBeenCalledOnce());
    expect(app.getLaunchUrl).not.toHaveBeenCalled();
  });
  it("uses the system auth browser on mobile and isolated preload on desktop", async () => {
    native.isNativePlatform.mockReturnValue(true);
    const url = "https://test.supabase.co/auth/v1/authorize?provider=google";
    await openNativeAuth(url); expect(browser.open).toHaveBeenCalledWith({ url, toolbarColor: "#0b211e" });
    native.isNativePlatform.mockReturnValue(false);
    const openAuth = vi.fn().mockResolvedValue(undefined); const unsubscribe = vi.fn();
    const onAuthCallback = vi.fn(() => unsubscribe);
    window.folklardDesktop = { version: 1, openAuth, onAuthCallback };
    await openNativeAuth(url); expect(openAuth).toHaveBeenCalledExactlyOnceWith(url);
    connectNativeAuth(vi.fn())(); expect(unsubscribe).toHaveBeenCalledOnce();
    await expect(openNativeAuth("javascript:alert(1)")).rejects.toThrow("inválido");
  });
});
