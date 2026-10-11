import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
const require = createRequire(import.meta.url);
const { registerAndroidAuth, registerIosAuth } = require("../../mobile/native-auth-config.cjs");
const { resolveAppConfig } = require("../../desktop/app-config.cjs");
describe("native auth registration", () => {
  it("registers the exact callback on MainActivity, preserving launcher/other activities and idempotence", () => {
    const source = `<manifest><application><activity android:name=".Other"></activity>
      <activity android:name=".MainActivity" android:launchMode="singleTask" android:exported="true">
      <intent-filter><action android:name="android.intent.action.MAIN" /></intent-filter></activity></application></manifest>`;
    const result = registerAndroidAuth(source);
    expect(result).toContain('<activity android:name=".Other"></activity>');
    expect(result).toContain('android.intent.action.MAIN');
    expect(result).toContain('android.intent.category.BROWSABLE');
    expect(result).toContain('android:scheme="folklard" android:host="auth" android:path="/callback"');
    expect(registerAndroidAuth(result)).toBe(result);
    expect(() => registerAndroidAuth("<manifest></manifest>")).toThrow("MainActivity missing");
  });
  it("registers iOS URL types without removing an existing scheme", () => {
    const source = '<plist><dict><key>CFBundleURLTypes</key><array><dict><key>CFBundleURLSchemes</key><array><string>existing</string></array></dict></array><key>UIRequiresFullScreen</key><true/></dict></plist>';
    const result = registerIosAuth(source);
    expect(result).toContain("<string>folklard</string>"); expect(result).toContain("<string>existing</string>");
    expect(registerIosAuth(result)).toBe(result);
    expect(registerIosAuth("<plist><dict></dict></plist>")).toContain("CFBundleURLTypes");
  });
  it("keeps production origin by default; local QA requires explicit flags and loopback only", () => {
    expect(resolveAppConfig({}, [])).toMatchObject({ qa: false, gameUrl: "https://card-realms.vercel.app/" });
    const config = resolveAppConfig({ FOLKLARD_NATIVE_QA: "1", FOLKLARD_NATIVE_QA_URL: "http://127.0.0.1:3000" }, []);
    expect(config).toMatchObject({ qa: true, gameUrl: "http://127.0.0.1:3000/" });
    expect(resolveAppConfig({}, ["exe", ...config.protocolArgs, "folklard://auth/callback?code=12345678"])).toEqual(config);
    expect(() => resolveAppConfig({ FOLKLARD_NATIVE_QA: "1", FOLKLARD_NATIVE_QA_URL: "https://evil.example" }, [])).toThrow("loopback");
    expect(resolveAppConfig({}, [], "http://127.0.0.1:3000/")).toEqual(config);
    expect(() => resolveAppConfig({}, [], "https://evil.example/")).toThrow("loopback");
  });
});
