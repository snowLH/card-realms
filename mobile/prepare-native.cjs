"use strict";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("node:fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("node:path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require("./package.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { computeNativeBuildNumber } = require("./native-version.cjs");
const target = process.argv[2];
const buildNumber = computeNativeBuildNumber(version, process.env.GITHUB_RUN_NUMBER ?? 1);
const root = __dirname;
function edit(file, transform) {
  fs.writeFileSync(file, transform(fs.readFileSync(file, "utf8")));
}
if (target === "android") {
  const native = path.join(root, "android");
  const res = path.join(native, "app", "src", "main", "res");
  if (!fs.existsSync(res)) throw new Error("Generate the Android project before preparing it");
  fs.cpSync(path.join(root, "resources", "android"), res, { recursive: true });
  edit(path.join(native, "app", "build.gradle"), (source) => source
    .replace(/versionCode \d+/, `versionCode ${buildNumber}`)
    .replace(/versionName "[^"]+"/, `versionName "${version}"`));
  edit(path.join(native, "variables.gradle"), (source) => source.replace(/minSdkVersion = \d+/, "minSdkVersion = 24"));
  edit(path.join(res, "values", "styles.xml"), (source) => source.replace(
    /<style name="AppTheme.NoActionBarLaunch"[\s\S]*?<\/style>/,
    `<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">#0b211e</item>
        <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>`,
  ));
} else if (target === "ios") {
  const native = path.join(root, "ios", "App");
  const assets = path.join(native, "App", "Assets.xcassets");
  if (!fs.existsSync(assets)) throw new Error("Generate the iOS project before preparing it");
  fs.copyFileSync(path.join(root, "resources", "ios", "AppIcon.png"), path.join(assets, "AppIcon.appiconset", "AppIcon-512@2x.png"));
  for (const file of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
    fs.copyFileSync(path.join(root, "resources", "ios", "Splash.png"), path.join(assets, "Splash.imageset", file));
  }
  edit(path.join(native, "App.xcodeproj", "project.pbxproj"), (source) => source
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
    .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${buildNumber};`));
  edit(path.join(native, "App", "Info.plist"), (source) => source.includes("<key>UIRequiresFullScreen</key>")
    ? source : source.replace(/<\/dict>\s*<\/plist>/, "<key>UIRequiresFullScreen</key><true/>\n</dict>\n</plist>"));
} else { throw new Error("Select android or ios"); }
