export async function runAfterPersistingLoadout(
  dirty: boolean,
  persist: () => Promise<boolean>,
  action: () => void,
): Promise<boolean> {
  if (dirty && !(await persist())) return false;
  action();
  return true;
}
