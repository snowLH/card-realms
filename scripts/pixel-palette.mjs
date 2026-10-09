// Deterministic, undithered production palette conversion. Alpha stays binary.
// PNG bit depths round colour limits to 16/256; use an explicit 48-entry palette.
export function limitPixelPalette(rgba, maximum = 48) {
  const histogram = new Map();
  for (let i = 0; i < rgba.length; i += 4) {
    if (!rgba[i + 3]) continue;
    const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
    const colour = histogram.get(key);
    if (colour) colour.weight++;
    else histogram.set(key, { key, rgb: [rgba[i], rgba[i + 1], rgba[i + 2]], weight: 1 });
  }
  const bounds = (entries) => {
    const ranges = [0, 1, 2].map((channel) => {
      let low = 255; let high = 0;
      for (const colour of entries) { low = Math.min(low, colour.rgb[channel]); high = Math.max(high, colour.rgb[channel]); }
      return high - low;
    });
    const channel = ranges.indexOf(Math.max(...ranges));
    return { entries, channel, score: ranges[channel] * Math.sqrt(entries.reduce((sum, c) => sum + c.weight, 0)) };
  };
  const boxes = [bounds([...histogram.values()])];
  while (boxes.length < maximum - 1) {
    boxes.sort((a, b) => b.score - a.score);
    const index = boxes.findIndex((box) => box.entries.length > 1);
    if (index < 0) break;
    const box = boxes.splice(index, 1)[0];
    const entries = box.entries.sort((a, b) => a.rgb[box.channel] - b.rgb[box.channel] || a.key - b.key);
    const half = entries.reduce((sum, c) => sum + c.weight, 0) / 2;
    let weight = 0; let cut = 1;
    for (; cut < entries.length; cut++) { weight += entries[cut - 1].weight; if (weight >= half) break; }
    boxes.push(bounds(entries.slice(0, cut)), bounds(entries.slice(cut)));
  }
  const lookup = new Map();
  for (const box of boxes) {
    const total = box.entries.reduce((sum, c) => sum + c.weight, 0);
    const rgb = [0, 1, 2].map((channel) => Math.round(box.entries.reduce((sum, c) => sum + c.rgb[channel] * c.weight, 0) / total));
    for (const colour of box.entries) lookup.set(colour.key, rgb);
  }
  const output = Buffer.from(rgba);
  for (let i = 0; i < output.length; i += 4) {
    if (!output[i + 3]) { output.fill(0, i, i + 4); continue; }
    const rgb = lookup.get((output[i] << 16) | (output[i + 1] << 8) | output[i + 2]);
    output[i] = rgb[0]; output[i + 1] = rgb[1]; output[i + 2] = rgb[2]; output[i + 3] = 255;
  }
  return output;
}
