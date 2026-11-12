"use strict";
function registerAndroidAuth(source) {
  let found = false;
  const result = source.replace(/<activity\b[^>]*android:name="[^"]*MainActivity"[\s\S]*?<\/activity>/, (activity) => {
    found = true;
    if (activity.includes('android:scheme="folklard"')) return activity;
    return activity.replace("</activity>", `<intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="folklard" android:host="auth" android:path="/callback" />
            </intent-filter>
        </activity>`);
  });
  if (!found) throw new Error("Generated Android MainActivity missing");
  return result;
}
function registerIosAuth(source) {
  if (source.includes("<string>folklard</string>")) return source;
  const scheme = `<dict><key>CFBundleURLName</key><string>com.folklard.auroria.auth</string>
        <key>CFBundleURLSchemes</key><array><string>folklard</string></array></dict>`;
  if (source.includes("<key>CFBundleURLTypes</key>")) {
    return source.replace(/(<key>CFBundleURLTypes<\/key>\s*<array>)/, `$1${scheme}`);
  }
  if (!/<\/dict>\s*<\/plist>/.test(source)) throw new Error("Generated iOS Info.plist missing root dictionary");
  return source.replace(/<\/dict>\s*<\/plist>/, `<key>CFBundleURLTypes</key><array>${scheme}</array>\n</dict>\n</plist>`);
}
module.exports = { registerAndroidAuth, registerIosAuth };
