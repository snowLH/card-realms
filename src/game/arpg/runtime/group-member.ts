export function pickGroupMember<T>(
  contains: (candidate: T) => boolean,
  first: T,
  second: T,
): T | null {
  if (contains(first)) return first;
  if (contains(second)) return second;
  return null;
}
