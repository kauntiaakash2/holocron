/** Document-local signal shared by the existing intro and noncritical visuals. */
let complete = false;
const listeners = new Set<() => void>();
export const isIntroComplete = () => complete;
export const introServerSnapshot = () => false;
export function subscribeToIntro(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function completeIntro() {
  if (complete) return;
  complete = true;
  for (const listener of listeners) listener();
}
