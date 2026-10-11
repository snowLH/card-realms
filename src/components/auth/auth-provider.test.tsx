// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({
  getUser: vi.fn(), signInWithOAuth: vi.fn(), signInWithOtp: vi.fn(), signOut: vi.fn(), exchangeCodeForSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}));
const platform = vi.hoisted(() => ({
  nativeAuthPlatform: vi.fn(() => "web"), supportsNativeAuth: vi.fn(() => true),
  openNativeAuth: vi.fn().mockResolvedValue(undefined), closeNativeAuth: vi.fn().mockResolvedValue(undefined), connectNativeAuth: vi.fn(),
}));
const refresh = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ refresh }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => ({ auth }) }));
vi.mock("@/lib/supabase/provider-settings", () => ({ isGoogleOAuthEnabled: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/auth/native-auth-bridge", () => platform);
vi.mock("./use-cloud-sound-preference", () => ({ useCloudSoundPreference: vi.fn() }));
import { AuthProvider, useAuth } from "./auth-provider";
type User = { id: string; email: string };
let sessionListener: (event: string, session: { user: User } | null) => void;
let nativeListener: (url: string) => void;
function Probe() {
  const value = useAuth();
  return <><p>{value.identity?.name ?? "Visitante"}</p><p role="status">{value.message}</p>
    <button onClick={value.signInWithGoogle}>Google</button>
    <button onClick={() => value.sendMagicLink("traveler@example.com")}>Email</button>
    <button onClick={value.signOut}>Sair</button></>;
}
beforeEach(() => {
  vi.clearAllMocks(); window.localStorage.clear(); platform.nativeAuthPlatform.mockReturnValue("web"); platform.supportsNativeAuth.mockReturnValue(true);
  auth.getUser.mockResolvedValue({ data: { user: null } });
  auth.signInWithOAuth.mockResolvedValue({ data: { url: "https://test.supabase.co/auth/v1/authorize?provider=google" }, error: null });
  auth.signInWithOtp.mockResolvedValue({ error: null }); auth.signOut.mockResolvedValue({ error: null });
  auth.onAuthStateChange.mockImplementation((listener) => { sessionListener = listener; return { data: { subscription: { unsubscribe: vi.fn() } } }; });
  platform.connectNativeAuth.mockImplementation((listener) => { nativeListener = listener; return vi.fn(); });
});
afterEach(cleanup);
describe("shared auth provider", () => {
  it("preserves browser OAuth redirects", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await userEvent.click(screen.getByText("Google"));
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback`, skipBrowserRedirect: false } });
    expect(platform.openNativeAuth).not.toHaveBeenCalled();
  });
  it("opens native PKCE externally and refreshes authoritative progress on return", async () => {
    platform.nativeAuthPlatform.mockReturnValue("mobile");
    auth.exchangeCodeForSession.mockImplementation(async () => {
      sessionListener("SIGNED_IN", { user: { id: "native-account", email: "arthur@example.com" } });
      return { data: { session: {} }, error: null };
    });
    render(<AuthProvider><Probe /></AuthProvider>);
    await userEvent.click(screen.getByText("Google"));
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: "folklard://auth/callback", skipBrowserRedirect: true } });
    expect(platform.openNativeAuth).toHaveBeenCalledOnce();
    act(() => nativeListener("folklard://auth/callback?code=12345678-code&sb_flow_id=flow_1234"));
    await waitFor(() => expect(screen.getByText("arthur")).toBeTruthy());
    expect(auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith("12345678-code", { flowId: "flow_1234" });
    expect(refresh).toHaveBeenCalledOnce();
    act(() => nativeListener("folklard://auth/callback?code=12345678-code&sb_flow_id=flow_1234"));
    expect(auth.exchangeCodeForSession).toHaveBeenCalledOnce();
  });
  it("refreshes on account switches/sign-out without deleting guest progress", async () => {
    window.localStorage.setItem("card-realms:progress:v4", "guest-backup");
    render(<AuthProvider><Probe /></AuthProvider>);
    act(() => sessionListener("INITIAL_SESSION", { user: { id: "a", email: "a@example.com" } }));
    act(() => sessionListener("SIGNED_IN", { user: { id: "b", email: "b@example.com" } }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    act(() => sessionListener("TOKEN_REFRESHED", { user: { id: "b", email: "b@example.com" } }));
    expect(refresh).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByText("Sair"));
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    act(() => sessionListener("SIGNED_OUT", null));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    expect(window.localStorage.getItem("card-realms:progress:v4")).toBe("guest-backup");
  });
  it("does not restore the previous user's UI after a late initial lookup", async () => {
    let finish!: (value: unknown) => void;
    auth.getUser.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    render(<AuthProvider><Probe /></AuthProvider>);
    act(() => sessionListener("SIGNED_IN", { user: { id: "b", email: "b@example.com" } }));
    await act(async () => finish({ data: { user: { id: "a", email: "a@example.com" } } }));
    expect(screen.getByText("b")).toBeTruthy(); expect(screen.queryByText("a")).toBeNull();
  });
  it("keeps old clients in the app and supports native magic-link return", async () => {
    platform.nativeAuthPlatform.mockReturnValue("mobile"); platform.supportsNativeAuth.mockReturnValue(false);
    render(<AuthProvider><Probe /></AuthProvider>);
    await userEvent.click(screen.getByText("Google"));
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("Atualize");
    platform.supportsNativeAuth.mockReturnValue(true);
    await userEvent.click(screen.getByText("Email"));
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: "traveler@example.com", options: { emailRedirectTo: "folklard://auth/callback" } });
  });
});
