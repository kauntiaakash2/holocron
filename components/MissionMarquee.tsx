import styles from "./mission-marquee.module.css";

const names = ["OpenAI SC", "AlgoZenith", "Kodewrek"];

export function MissionMarquee() {
  return (
    <div className={styles.marquee}>
      <div className={styles.viewport}>
        <div className={styles.track} data-mission-marquee-track>
          {[0, 1, 2].map((copy) => (
            <div
              className={styles.group}
              key={copy}
              aria-hidden={copy > 0 ? true : undefined}
            >
              {names.map((name) => (
                <span className={styles.name} key={name}>
                  {name}
                  <span className={styles.separator} aria-hidden="true">
                    ×
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
