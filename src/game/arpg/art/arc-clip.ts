/** Invisible mask coordinates for the authored circular decal. No visible geometry. */
export function arcClip(angle: number, arc: number) {
  if (arc >= Math.PI * 2 - 0.001) return undefined;
  const points = ["50% 50%"];
  const steps = Math.max(2, Math.ceil(arc * 32));
  for (let index = 0; index <= steps; index++) {
    const theta = angle - arc / 2 + arc * index / steps;
    points.push(`${50 + Math.cos(theta) * 50}% ${50 + Math.sin(theta) * 50}%`);
  }
  return `polygon(${points.join(",")})`;
}
