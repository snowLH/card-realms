import { spawnSync } from "node:child_process";

// Creative sources come from image_gen with the approved Naturalist references.
// Use the SAME v5 atlas exporter as every other active character: 64px logical
// cells, 48 colours, binary alpha, uniform framing and nearest-neighbour output.
const args = ["scripts/export-character-atlases.mjs", "scripts/king-arthur-art.json"];
if (process.argv[2]) args.push(process.argv[2]);
const result = spawnSync(process.execPath, args, { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
