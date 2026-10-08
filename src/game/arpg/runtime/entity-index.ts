/** Creates a temporary lookup once per server snapshot, rather than scanning
 * every local sprite for every authoritative enemy (quadratic work).
 */
export function indexRuntimeEntities<T extends { getData(key: string): unknown }>(
  entities: readonly T[],
): Map<string, T> {
  const byId = new Map<string, T>();
  for (const entity of entities) {
    const value = entity.getData("runtimeId");
    if (typeof value === "string" && value.length > 0) {
      byId.set(value, entity);
    }
  }
  return byId;
}
