import { describe, expect, it } from "vitest";
import { NATIVE_AUTH_CALLBACK, parseNativeAuthCallback } from "./native-callback";

describe("native OAuth callback parsing", () => {
  it("preserves the PKCE code and SDK flow ID", () => {
    expect(parseNativeAuthCallback(`${NATIVE_AUTH_CALLBACK}?code=abcdef12-1234&sb_flow_id=flow_1234`))
      .toEqual({ kind: "code", code: "abcdef12-1234", flowId: "flow_1234" });
  });
  it.each([
    "https://auth/callback?code=abcdef12", "folklard://attacker/callback?code=abcdef12",
    "folklard://auth/other?code=abcdef12", "folklard://user@auth/callback?code=abcdef12",
    "folklard://auth:123/callback?code=abcdef12", "folklard://auth/callback?code=one&code=two",
    "folklard://auth/callback?code=abcdef12&sb_flow_id=short", "folklard://auth/callback?code=abcdef12&sb_flow_id=flow_1234&sb_flow_id=flow_5678",
    "folklard://auth/callback#access_token=secret", "folklard://auth/callback?code=abcdef12&refresh_token=secret",
    "folklard://auth/callback?code=abcdef12#refresh_token=secret", "invalid", "x".repeat(4097),
  ])("rejects invalid callback %s", (url) => { expect(parseNativeAuthCallback(url)).toBeNull(); });
  it("maps OAuth cancellation without exposing provider text or accepting tokens", () => {
    expect(parseNativeAuthCallback(`${NATIVE_AUTH_CALLBACK}#error=access_denied&error_description=untrusted`)).toEqual({ kind: "error" });
    expect(parseNativeAuthCallback(`${NATIVE_AUTH_CALLBACK}?error=bad&access_token=secret`)).toBeNull();
  });
});
