"use strict";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { build } = require("./package.json");
module.exports = {
  ...build,
  appId: "com.folklard.auroria.qa",
  productName: "Folklard Native QA",
  directories: { output: "dist-qa" },
  artifactName: "Folklard-Native-QA-${version}.${ext}",
  extraMetadata: { folklardNativeQaOrigin: "http://127.0.0.1:3000/" },
};
