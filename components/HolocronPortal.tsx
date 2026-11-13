"use client";

import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  introServerSnapshot,
  isIntroComplete,
  subscribeToIntro,
} from "@/lib/intro-lifecycle";
import {
  setArchiveCovered,
  isArchiveCovered,
  subscribeToArchiveVisibility,
  archiveVisibilityServerSnapshot,
} from "@/lib/archive-visibility";
import {
  portalFrame,
  retainPortalBypass,
  waterContour,
} from "@/lib/portal-motion";
import styles from "./holocron-portal.module.css";

/** The actual page emerges through a scroll-driven water surface; no duplicated content. */
export function HolocronPortal({
  hero,
  mission,
  children,
}: {
  hero: ReactNode;
  mission: ReactNode;
  children: ReactNode;
}) {
  const ready = useSyncExternalStore(
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
    content = useRef<HTMLDivElement>(null),
    heroLayer = useRef<HTMLDivElement>(null),
    pin = useRef<HTMLDivElement>(null),
    rest = useRef<HTMLDivElement>(null);
  const surface = useRef<SVGSVGElement>(null);
  const id = useId().replace(/:/g, "");

  useEffect(() => {
    const element = root.current,
      archive = content.current,
      water = surface.current;
    const heroElement = heroLayer.current;
    if (!ready || !element || !archive || !water || !heroElement) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const supported =
      typeof CSS !== "undefined" &&
      CSS.supports("clip-path", 'path("M0 0H1V1Z")');
    const paths = [
      ...water.querySelectorAll<SVGPathElement>("[data-water-edge]"),
    ];
    const artifact = element.querySelector<HTMLElement>(
      "[data-holocron-state]",
    );
    const edgeGroup = water.querySelector<SVGGElement>("[data-water-edges]");
    let frame: number | null = null,
      focusBypass = false,
      previousScroll = 0,
      needsMeasure = true,
      masked = false,
      lastProgress = -1;
    let geometry: {
      top: number;
      width: number;
      height: number;
      travel: number;
      x: number;
      y: number;
      left: number;
    } | null = null;
    const clear = () => {
      if (masked) archive.style.removeProperty("clip-path");
      masked = false;
      water.style.opacity = "0";
      lastProgress = -1;
    };
    const measure = () => {
      // Layout reads happen only on setup/resize/content changes. In particular,
      // never rewrite runway dimensions and then measure them on each scroll.
      const heroBox = heroElement.getBoundingClientRect();
      const box = archive.getBoundingClientRect();
      const core = artifact?.getBoundingClientRect();
      const travel = Math.max(1, heroBox.height);
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      geometry = {
        top: element.getBoundingClientRect().top + window.scrollY,
        width,
        height,
        travel,
        left: box.left,
        x: core ? core.left + core.width / 2 - box.left : width / 2,
        // Source-local coordinates stay fixed when the sticky pin releases.
        y: core ? core.top + core.height / 2 - heroBox.top : travel / 2,
      };
      element.style.setProperty("--portal-travel", `${travel}px`);
      element.style.setProperty(
        "--portal-panel-height",
        `${Math.max(travel, box.height)}px`,
      );
      element.dataset.portalTravel = String(travel);
      water.setAttribute("viewBox", `0 0 ${width} ${height}`);
      edgeGroup?.setAttribute("transform", `translate(${box.left} 0)`);
      needsMeasure = false;
      lastProgress = -1;
    };
    const update = () => {
      frame = null;
      const enabled = supported && !media.matches;
      if (element.dataset.enabled !== String(enabled)) {
        element.dataset.enabled = String(enabled);
        needsMeasure = true;
      }
      if (!enabled) {
        clear();
        element.dataset.phase = "static";
        setArchiveCovered(false);
        return;
      }
      if (needsMeasure || !geometry) measure();
      if (!geometry) return;
      const { top, width, height, travel, x, y, left } = geometry;
      const scroll = Math.max(0, window.scrollY - top);
      const state = portalFrame(scroll, width, height, x + left, y, travel);
      focusBypass = retainPortalBypass(
        focusBypass,
        previousScroll,
        scroll,
        travel,
      );
      previousScroll = scroll;
      setArchiveCovered(state.complete || focusBypass);
      const phase = focusBypass
        ? "bypassed"
        : state.complete
          ? "open"
          : state.progress > 0
            ? "opening"
            : "idle";
      if (element.dataset.phase !== phase) element.dataset.phase = phase;
      if (state.complete || focusBypass) {
        // Clear once on leaving the transition; ordinary page scrolling does
        // not generate paths or touch styles for a fully open portal.
        if (masked || lastProgress !== -1) clear();
        return;
      }
      if (state.progress === lastProgress) return;
      lastProgress = state.progress;
      // One contour drives both layers; no independent geometry can drift.
      const contour = waterContour(x, y, state.radius, state.progress);
      archive.style.clipPath = `path("${contour}")`;
      masked = true;
      water.style.opacity = String(state.opacity);
      paths.forEach((path) => path.setAttribute("d", contour));
    };
    const schedule = () => {
      if (frame === null && !document.hidden)
        frame = requestAnimationFrame(update);
    };
    const focus = () => {
      // Do not strand focused controls behind a visual mask or delay a nav click.
      focusBypass = true;
      clear();
      schedule();
    };
    const invalidate = () => {
      needsMeasure = true;
      schedule();
    };
    const visibility = () => {
      if (document.hidden) {
        // Keep the current mask while backgrounded; exposing it here flashes
        // the destination before the first frame when the tab is restored.
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
      } else invalidate();
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", invalidate);
    archive.addEventListener("focusin", focus);
    rest.current?.addEventListener("focusin", focus);
    media.addEventListener("change", invalidate);
    document.addEventListener("visibilitychange", visibility);
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(invalidate)
        : null;
    observer?.observe(archive);
    observer?.observe(heroElement);
    const remaining = rest.current;
    update();
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", invalidate);
      archive.removeEventListener("focusin", focus);
      remaining?.removeEventListener("focusin", focus);
      media.removeEventListener("change", invalidate);
      document.removeEventListener("visibilitychange", visibility);
      element.dataset.enabled = "false";
      element.style.removeProperty("--portal-travel");
      element.style.removeProperty("--portal-panel-height");
      delete element.dataset.portalTravel;
      clear();
      setArchiveCovered(false);
    };
  }, [ready]);

  return (
    <div
      ref={root}
      className={styles.journey}
      data-archive-portal
      data-enabled="false"
      data-phase="static"
    >
      <div className={styles.runway}>
        <div ref={pin} className={styles.pin} data-portal-pin>
          <div
            ref={heroLayer}
            className={styles.hero}
            inert={covered}
            aria-hidden={covered ? true : undefined}
          >
            {hero}
          </div>
          <div ref={content} className={styles.mission} data-portal-panel>
            {mission}
          </div>
        </div>
      </div>
      <div ref={rest} className={styles.rest}>
        {children}
      </div>
      <svg
        ref={surface}
        className={styles.water}
        aria-hidden="true"
        focusable="false"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`${id}-water`} x2=".8" y2="1">
            <stop stopColor="#55ddf3" stopOpacity=".15" />
            <stop offset=".4" stopColor="#c3f4f6" stopOpacity=".9" />
            <stop offset=".75" stopColor="#6cbbd1" stopOpacity=".5" />
            <stop offset="1" stopColor="#e5bd65" stopOpacity=".3" />
          </linearGradient>
        </defs>
        <g data-water-edges fill="none" stroke={`url(#${id}-water)`}>
          <path data-water-edge strokeWidth="28" opacity=".06" />
          <path data-water-edge strokeWidth="9" opacity=".2" />
          <path data-water-edge strokeWidth="1.5" opacity=".8" />
        </g>
      </svg>
    </div>
  );
}
