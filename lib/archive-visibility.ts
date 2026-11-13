/** Pause the covered hero without changing its layout or creating another renderer. */
let covered = false;
const listeners = new Set<() => void>();
export const isArchiveCovered = () => covered;
export const archiveVisibilityServerSnapshot = () => false;
export function subscribeToArchiveVisibility(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function setArchiveCovered(next: boolean) {
  if (next === covered) return;
  covered = next;
  listeners.forEach((listener) => listener());
}
