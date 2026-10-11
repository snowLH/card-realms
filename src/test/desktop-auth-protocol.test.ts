import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
const require = createRequire(import.meta.url);
const { createAuthMailbox, findAuthCallback } = require("../../desktop/auth-protocol.cjs");
const callback = "folklard://auth/callback?code=12345678";
describe("desktop cold/warm auth mailbox", () => {
  it("finds a launch callback without relying on argv position", () => {
    expect(findAuthCallback(["exe", callback, "--flag"])).toBe(callback);
    expect(findAuthCallback(["exe", "https://bad.example", "folklard://other/callback"])).toBeUndefined();
  });
  it("retains cold callbacks until the renderer is ready and delivers warm callbacks once", () => {
    const mailbox = createAuthMailbox(); const receive = vi.fn();
    mailbox.accept(callback); mailbox.subscribe(receive);
    expect(receive).toHaveBeenCalledExactlyOnceWith(callback);
    mailbox.subscribe(receive);
    expect(receive).toHaveBeenCalledOnce();
    mailbox.accept(callback);
    expect(receive).toHaveBeenCalledTimes(2);
  });
  it("retains callbacks during navigation/renderer restart and rejects arbitrary protocols", () => {
    const mailbox = createAuthMailbox(); const receive = vi.fn();
    mailbox.subscribe(receive); mailbox.disconnect(); mailbox.accept(callback);
    expect(receive).not.toHaveBeenCalled(); mailbox.subscribe(receive);
    expect(receive).toHaveBeenCalledOnce();
    for (const raw of ["javascript:alert(1)", "file:///secret", "folklard://auth/other", "folklard://user@auth/callback"]) {
      expect(mailbox.accept(raw)).toBe(false);
    }
  });
});
