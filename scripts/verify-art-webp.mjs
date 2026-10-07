import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const publicArt = path.join(root, "public", "art");
const archivedArt = path.join(root, "artifacts", "archive", "public-art");
const webpFiles = (await fs.readdir(publicArt)).filter((file) => file.endsWith(".webp")).sort();
const rows = [];

for (const file of webpFiles) {
  const sourcePath = path.join(archivedArt, file.replace(/\.webp$/i, ".png"));
  const outputPath = path.join(publicArt, file);
  const [sourceBuffer, outputMeta, source, output] = await Promise.all([
    fs.readFile(sourcePath),
    sharp(outputPath).metadata(),
    sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(outputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);

  let alphaMismatches = 0;
  let visibleRgbMismatches = 0;
  let transparentRgbMismatches = 0;
  if (source.info.width !== output.info.width || source.info.height !== output.info.height) {
    visibleRgbMismatches += 1;
  } else {
    for (let i = 0; i < source.data.length; i += 4) {
      const alpha = source.data[i + 3];
      if (alpha !== output.data[i + 3]) alphaMismatches += 1;
      if (alpha === 0) {
        for (let channel = 0; channel < 3; channel += 1) {
          if (source.data[i + channel] !== output.data[i + channel]) transparentRgbMismatches += 1;
        }
      } else {
        for (let channel = 0; channel < 3; channel += 1) {
          if (source.data[i + channel] !== output.data[i + channel]) visibleRgbMismatches += 1;
        }
      }
    }
  }

  rows.push({
    file,
    width: output.info.width,
    height: output.info.height,
    format: outputMeta.format,
    hasAlpha: outputMeta.hasAlpha,
    sourceBytes: sourceBuffer.byteLength,
    outputBytes: (await fs.stat(outputPath)).size,
    alphaMismatches,
    visibleRgbMismatches,
    transparentRgbMismatches,
  });
}

const totals = rows.reduce((result, row) => ({
  sourceBytes: result.sourceBytes + row.sourceBytes,
  outputBytes: result.outputBytes + row.outputBytes,
  alphaMismatches: result.alphaMismatches + row.alphaMismatches,
  visibleRgbMismatches: result.visibleRgbMismatches + row.visibleRgbMismatches,
  transparentRgbMismatches: result.transparentRgbMismatches + row.transparentRgbMismatches,
}), { sourceBytes: 0, outputBytes: 0, alphaMismatches: 0, visibleRgbMismatches: 0, transparentRgbMismatches: 0 });
const report = {
  count: rows.length,
  ...totals,
  savings: 1 - totals.outputBytes / totals.sourceBytes,
  pixelPreservation: "All alpha values and RGB channels for alpha > 0 must match exactly. RGB values under alpha = 0 are reported because they cannot affect rendering.",
  rows,
};
console.log(JSON.stringify(report, null, 2));

if (rows.length === 0 || rows.some((row) => row.format !== "webp" || row.alphaMismatches || row.visibleRgbMismatches)) {
  process.exitCode = 1;
}
