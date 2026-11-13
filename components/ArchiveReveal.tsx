"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import {
  introServerSnapshot,
  isIntroComplete,
  subscribeToIntro,
} from "@/lib/intro-lifecycle";
import styles from "./archive-reveal.module.css";

/** Reveal actual content as it enters view, rather than the section's empty padding. */
export function ArchiveReveal({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const ready = useSyncExternalStore(
    subscribeToIntro,
    isIntroComplete,
    introServerSnapshot,
  );

  useEffect(() => {
    const element = root.current;
    if (!element || !ready) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const items = [
      ...element.querySelectorAll<HTMLElement>("[data-archive-reveal]"),
    ];
    const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
    let observer: IntersectionObserver | null = null;
    const finish = (item: HTMLElement) => {
      item.dataset.revealState = "done";
      const timer = timers.get(item);
      if (timer !== undefined) clearTimeout(timer);
      timers.delete(item);
    };
    const showAll = () => {
      observer?.disconnect();
      items.forEach(finish);
    };
    if (media.matches || typeof IntersectionObserver === "undefined") {
      showAll();
      return;
    }
    // Nothing is concealed without a functioning observer. A restored scroll or
    // an anchor jump gets the same entrance as ordinary scrolling.
    observer = new IntersectionObserver(
      (entries) => {
        let cardOrder = 0;
        for (const entry of entries) {
          const item = entry.target as HTMLElement;
          if (!entry.isIntersecting || item.dataset.revealState !== "armed")
            continue;
          item.style.setProperty(
            "--reveal-delay",
            item.dataset.archiveReveal === "card"
              ? `${Math.min(cardOrder++, 2) * 60}ms`
              : item.dataset.archiveReveal === "copy"
                ? "80ms"
                : "0ms",
          );
          item.dataset.revealState = "playing";
          observer?.unobserve(item);
          timers.set(
            item,
            setTimeout(() => finish(item), 1200),
          );
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0 },
    );
    items.forEach((item) => {
      // Avoid hiding anything that already holds keyboard focus.
      if (item.contains(document.activeElement)) finish(item);
      else {
        item.dataset.revealState = "armed";
        observer?.observe(item);
      }
    });
    const end = (event: AnimationEvent) => {
      const item = event.target;
      if (
        item instanceof HTMLElement &&
        items.includes(item) &&
        (!event.pseudoElement || event.pseudoElement === "::after")
      )
        finish(item);
    };
    const focus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      // Focusing the section anchor must not cancel its entire reveal. Only
      // expose the particular block containing a focused interactive control.
      const item = target.closest<HTMLElement>("[data-archive-reveal]");
      if (item && items.includes(item)) finish(item);
    };
    const motion = () => {
      if (media.matches) showAll();
    };
    element.addEventListener("animationend", end);
    element.addEventListener("focusin", focus);
    media.addEventListener("change", motion);
    return () => {
      showAll();
      element.removeEventListener("animationend", end);
      element.removeEventListener("focusin", focus);
      media.removeEventListener("change", motion);
    };
  }, [ready]);

  return (
    <div ref={root} className={styles.reveal}>
      {children}
    </div>
  );
}
