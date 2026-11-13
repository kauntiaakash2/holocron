"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  introServerSnapshot,
  isIntroComplete,
  subscribeToIntro,
} from "@/lib/intro-lifecycle";
import {
  isArchiveCovered,
  subscribeToArchiveVisibility,
  archiveVisibilityServerSnapshot,
} from "@/lib/archive-visibility";
import type { HolocronController } from "./HolocronScene";
import { HolocronFallback } from "./HolocronFallback";
import { useHolocronInteraction } from "./useHolocronInteraction";
import styles from "./holocron.module.css";

type Status = "waiting" | "loading" | "ready" | "failed";
export function HolocronExperience({
  waitForIntro = false,
  centered = false,
}: {
  waitForIntro?: boolean;
  centered?: boolean;
}) {
  const introComplete = useSyncExternalStore(
    subscribeToIntro,
    isIntroComplete,
    introServerSnapshot,
  );
  const covered = useSyncExternalStore(
    subscribeToArchiveVisibility,
    isArchiveCovered,
    archiveVisibilityServerSnapshot,
  );
  const root = useRef<HTMLDivElement>(null),
    host = useRef<HTMLDivElement>(null);
  const controller = useRef<HolocronController | null>(null);
  const environment = useRef({ visible: false, reduced: false });
  const [requested, setRequested] = useState(false),
    [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(false),
    [reduced, setReduced] = useState(false);
  const [status, setStatus] = useState<Status>("waiting");
  const [active, setActive] = useState(false);
  const readyToPresent =
    (!waitForIntro || introComplete) && inView && tabVisible && !covered;
  environment.current = { visible: readyToPresent, reduced };
  const instructionsId = useId();
  const interaction = useHolocronInteraction(
    controller,
    readyToPresent && status === "ready",
    reduced,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(media.matches);
    const visibility = () => setTabVisible(!document.hidden);
    motion();
    visibility();
    media.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => setInView(entries[0]?.isIntersecting ?? false),
            { threshold: 0.05 },
          )
        : null;
    if (observer && root.current) observer.observe(root.current);
    else setInView(true);
    return () => {
      observer?.disconnect();
      media.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    // Prepare the real GPU frame behind the intro, without starting idle motion.
    if (inView && tabVisible) setRequested(true);
  }, [inView, tabVisible]);
  useEffect(() => {
    if (!requested) return;
    let cancelled = false;
    setStatus("loading");
    // No Three.js code enters the initial route chunk, nor any form route.
    void import("./HolocronScene")
      .then(({ createHolocronScene }) => {
        if (cancelled || !host.current) return;
        const instance = createHolocronScene(host.current, {
          reducedMotion: environment.current.reduced,
          onActiveChange: (value) => {
            if (!cancelled) setActive(value);
          },
          onFailure: () => {
            if (!cancelled) {
              setStatus("failed");
              setActive(false);
            }
          },
        });
        controller.current = instance;
        if (!instance.prepare()) return;
        instance.setVisible(environment.current.visible);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
      controller.current?.dispose();
      controller.current = null;
    };
  }, [requested]);
  useEffect(() => {
    controller.current?.setVisible(readyToPresent);
  }, [readyToPresent]);
  useEffect(() => {
    controller.current?.setReducedMotion(reduced);
  }, [reduced]);

  return (
    <div
      ref={root}
      className={`${styles.experience} ${centered ? styles.centered : ""}`}
      data-holocron-state={status}
      data-motion={reduced ? "reduced" : "animated"}
    >
      <div
        className={`${styles.viewport} ${status === "ready" ? styles.ready : ""}`}
      >
        <HolocronFallback hidden={status === "ready"} />
        <div ref={host} className={styles.canvasHost} aria-hidden="true" />
        {status === "ready" && (
          <button
            ref={interaction.button}
            type="button"
            className={styles.activate}
            data-hovered={interaction.hovered}
            data-dragging={interaction.dragging}
            aria-describedby={instructionsId}
            aria-label="Activate Jedi Holocron"
            aria-disabled={active}
            {...interaction.handlers}
          />
        )}
      </div>
      <span id={instructionsId} className={styles.instructions}>
        {reduced
          ? "Press Enter or Space to illuminate the artifact."
          : "Drag to rotate the artifact. Arrow keys turn it, Home restores the view, and Enter or Space activates it."}
      </span>
      <div className={styles.controls}>
        <span role="status" aria-live="polite">
          {status === "failed"
            ? "STATIC ARTIFACT"
            : interaction.dragging
              ? "ROTATING ARTIFACT"
              : active
                ? "ARCHIVE ACTIVATED"
                : status === "ready"
                  ? "ACTIVATE THE ARTIFACT ↗"
                  : "JEDI HOLOCRON"}
        </span>
      </div>
    </div>
  );
}
