import styles from "./holocron.module.css";
export function HolocronFallback({ hidden = false }: { hidden?: boolean }) {
  return (
    <img
      className={styles.fallback}
      src="/media/holocron-fallback.webp"
      width="640"
      height="640"
      alt={
        hidden
          ? ""
          : "Jedi Holocron with bronze framing, concentric rings, and blue crystalline panels"
      }
      aria-hidden={hidden || undefined}
    />
  );
}
