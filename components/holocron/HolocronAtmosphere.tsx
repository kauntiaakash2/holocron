"use client";

import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
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
import styles from "./holocron-atmosphere.module.css";

// Cover the entire filter, including more than the maximum 47.5-unit shift.
// Outside an feImage SVG samples transparent black, which shifts glyph pixels
// again and can create a detached copy of the R descender below the wordmark.
const WATER_REGION = { x: -80, y: -80, width: 1360, height: 440 };

const embers = [
  [18, 34, 8, -2],
  [25, 70, 11, -7],
  [35, 22, 9, -4],
  [41, 79, 12, -8],
  [57, 17, 10, -3],
  [66, 74, 13, -9],
  [75, 31, 9, -6],
  [82, 63, 11, -1],
  [30, 47, 14, -10],
  [71, 52, 12, -5],
];

/** A small CPU displacement field refracts the whole word like disturbed water. */
export function HolocronAtmosphere() {
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
  const root = useRef<HTMLDivElement>(null);
  const word = useRef<SVGSVGElement>(null);
  const mapImage = useRef<SVGFEImageElement>(null);
  const displacement = useRef<SVGFEDisplacementMapElement>(null);
  const id = useId().replace(/:/g, "");

  useEffect(() => {
    const element = root.current,
      svg = word.current;
    const image = mapImage.current,
      warp = displacement.current;
    const hero = element?.parentElement;
    if (!element || !svg || !image || !warp || !hero) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const canvas = document.createElement("canvas");
    // Size work to the rendered lettering, not device labels or screen DPR.
    const fieldWidth = () =>
      Math.max(
        96,
        Math.min(192, Math.ceil(svg.getBoundingClientRect().width / 6)),
      );
    canvas.width = fieldWidth();
    canvas.height = Math.round(
      (canvas.width * WATER_REGION.height) / WATER_REGION.width,
    );
    let context: CanvasRenderingContext2D | null = null;
    try {
      context = canvas.getContext("2d");
    } catch {
      /* Static SVG remains usable. */
    }
    let pixels = context?.createImageData(canvas.width, canvas.height);
    let box = svg.getBoundingClientRect(),
      dirty = true,
      visible = true,
      disposed = false;
    let touchId: number | null = null;
    let frame: number | null = null,
      previous = 0;
    let x = 600,
      y = 140,
      targetX = x,
      targetY = y,
      pressure = 0,
      targetPressure = 0;
    let lastDropX = -1000,
      lastDropY = -1000,
      lastDropTime = 0;
    const ripples: { x: number; y: number; born: number; power: number }[] = [];
    const allowed = () =>
      ready && !covered && visible && !document.hidden && !media.matches;
    const stop = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      previous = 0;
    };
    const reset = () => {
      stop();
      ripples.length = 0;
      touchId = null;
      pressure = targetPressure = 0;
      warp.setAttribute("scale", "0");
      element.dataset.waterState = "idle";
    };
    const schedule = () => {
      if (!disposed && allowed() && context && pixels && frame === null)
        frame = requestAnimationFrame(tick);
    };
    const tick = (now: number) => {
      frame = null;
      if (disposed || !allowed()) {
        reset();
        return;
      }
      // Keep the tiny raster field at 30fps; the artifact retains its own cadence.
      if (previous && now - previous < 32) {
        schedule();
        return;
      }
      const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 1 / 30;
      previous = now;
      const follow = 1 - Math.exp(-12 * dt);
      x += (targetX - x) * follow;
      y += (targetY - y) * follow;
      pressure += (targetPressure - pressure) * follow;
      for (let i = ripples.length - 1; i >= 0; i--)
        if (now - ripples[i].born > 2200) ripples.splice(i, 1);
      const moving =
        Math.abs(targetX - x) +
          Math.abs(targetY - y) +
          Math.abs(targetPressure - pressure) * 100 >
        0.08;
      if (!ripples.length && pressure < 0.001) {
        reset();
        return;
      }
      if (!context || !pixels) return;
      const data = pixels.data;
      for (let row = 0; row < canvas.height; row++) {
        const py =
          WATER_REGION.y + (row / (canvas.height - 1)) * WATER_REGION.height;
        for (let column = 0; column < canvas.width; column++) {
          const px =
            WATER_REGION.x + (column / (canvas.width - 1)) * WATER_REGION.width;
          const dx = px - x,
            dy = py - y;
          const radius = Math.hypot(dx, dy);
          // Sampling toward the pointer pushes the visible lettering outward.
          const repel = -0.28 * pressure * Math.exp((-radius * radius) / 13000);
          let vx = (dx / Math.max(radius, 1)) * repel;
          let vy = (dy / Math.max(radius, 1)) * repel;
          for (const ripple of ripples) {
            const rx = px - ripple.x,
              ry = py - ripple.y;
            const distance = Math.hypot(rx, ry);
            const age = (now - ripple.born) / 1000;
            const front = distance - age * 235;
            const wave =
              Math.sin(front * 0.085) *
              Math.exp((-front * front) / 2400) *
              Math.exp(-age * 1.7) *
              ripple.power;
            vx += (rx / Math.max(distance, 1)) * wave;
            vy += (ry / Math.max(distance, 1)) * wave;
          }
          const offset = (row * canvas.width + column) * 4;
          data[offset] = Math.max(0, Math.min(255, 128 + vx * 255));
          data[offset + 1] = Math.max(0, Math.min(255, 128 + vy * 255));
          data[offset + 2] = 128;
          data[offset + 3] = 255;
        }
      }
      try {
        context.putImageData(pixels, 0, 0);
        image.setAttribute("href", canvas.toDataURL("image/png"));
        warp.setAttribute("scale", "95");
        element.dataset.waterState = "active";
      } catch {
        reset();
        return;
      }
      if (moving || ripples.length) schedule();
      else previous = 0;
    };
    const disturb = (event: PointerEvent, touch = false) => {
      if (!allowed()) return;
      if (dirty) {
        box = svg.getBoundingClientRect();
        dirty = false;
      }
      if (!box.width || !box.height) return;
      targetX = ((event.clientX - box.left) / box.width) * 1200;
      targetY = ((event.clientY - box.top) / box.height) * 280;
      if (targetX < -80 || targetX > 1280 || targetY < -90 || targetY > 370) {
        leave();
        return;
      }
      targetPressure = touch ? 0.65 : 1;
      const now = performance.now();
      const travel = Math.hypot(targetX - lastDropX, targetY - lastDropY);
      if (travel > 16 && now - lastDropTime > (touch ? 90 : 55)) {
        ripples.push({
          x: targetX,
          y: targetY,
          born: now,
          power: Math.min(0.2, 0.08 + travel * 0.001),
        });
        if (ripples.length > (touch ? 4 : 7)) ripples.shift();
        lastDropX = targetX;
        lastDropY = targetY;
        lastDropTime = now;
      }
      schedule();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        if (touchId === event.pointerId) disturb(event, true);
      } else if (fine.matches || event.pointerType === "pen") disturb(event);
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      if (!event.isPrimary) {
        touchId = null;
        leave();
        return;
      }
      touchId = event.pointerId;
      lastDropX = lastDropY = -1000;
      lastDropTime = -Infinity;
      disturb(event, true);
    };
    const up = (event: PointerEvent) => {
      if (touchId === event.pointerId) {
        touchId = null;
        leave();
      }
    };
    function leave() {
      targetPressure = 0;
      if (pressure > 0.001 || ripples.length) schedule();
    }
    const sync = () => {
      element.dataset.moving = String(allowed());
      if (!allowed()) reset();
    };
    const resized = () => {
      dirty = true;
      touchId = null;
      reset();
      const nextWidth = fieldWidth();
      if (context && nextWidth !== canvas.width) {
        canvas.width = nextWidth;
        canvas.height = Math.round(
          (nextWidth * WATER_REGION.height) / WATER_REGION.width,
        );
        pixels = context.createImageData(canvas.width, canvas.height);
      }
    };
    const scrolled = () => {
      dirty = true;
      touchId = null;
      leave();
    };
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            visible = entries[0]?.isIntersecting ?? false;
            sync();
          })
        : null;
    observer?.observe(hero);
    const sizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(resized)
        : null;
    sizeObserver?.observe(svg);
    // Observe touch gestures without capturing them or cancelling native scroll.
    hero.addEventListener("pointerdown", down, { passive: true });
    hero.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    window.addEventListener("pointercancel", up, { passive: true });
    hero.addEventListener("pointerleave", leave, { passive: true });
    document.addEventListener("visibilitychange", sync);
    media.addEventListener("change", sync);
    fine.addEventListener("change", reset);
    window.addEventListener("resize", resized);
    window.addEventListener("scroll", scrolled, { passive: true });
    sync();
    return () => {
      disposed = true;
      reset();
      observer?.disconnect();
      sizeObserver?.disconnect();
      hero.removeEventListener("pointerdown", down);
      hero.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      hero.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", sync);
      media.removeEventListener("change", sync);
      fine.removeEventListener("change", reset);
      window.removeEventListener("resize", resized);
      window.removeEventListener("scroll", scrolled);
      canvas.width = canvas.height = 0;
    };
  }, [ready, covered]);

  return (
    <div
      ref={root}
      className={styles.atmosphere}
      aria-hidden="true"
      data-moving="false"
    >
      <div className={styles.backlight} />
      <div className={styles.shaft} />
      <div className={styles.warmShaft} />
      <svg
        ref={word}
        className={styles.wordmark}
        viewBox="0 0 1200 280"
        focusable="false"
      >
        <defs>
          <linearGradient id={`${id}-silver`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f0f4f2" stopOpacity=".58" />
            <stop offset=".45" stopColor="#b2ccd5" stopOpacity=".3" />
            <stop offset="1" stopColor="#6390a3" stopOpacity=".1" />
          </linearGradient>
          <filter
            id={`${id}-water`}
            x={WATER_REGION.x}
            y={WATER_REGION.y}
            width={WATER_REGION.width}
            height={WATER_REGION.height}
            filterUnits="userSpaceOnUse"
            primitiveUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              ref={mapImage}
              x={WATER_REGION.x}
              y={WATER_REGION.y}
              width={WATER_REGION.width}
              height={WATER_REGION.height}
              preserveAspectRatio="none"
              result="water"
            />
            <feDisplacementMap
              ref={displacement}
              in="SourceGraphic"
              in2="water"
              scale="0"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
        <text
          x="30"
          y="220"
          textLength="1140"
          lengthAdjust="spacingAndGlyphs"
          fill={`url(#${id}-silver)`}
          filter={`url(#${id}-water)`}
        >
          HOL0CRON
        </text>
      </svg>
      {embers.map(([x, y, duration, delay], index) => (
        <span
          key={index}
          className={styles.ember}
          style={
            {
              left: `${x}%`,
              top: `${y}%`,
              "--duration": `${duration}s`,
              "--delay": `${delay}s`,
            } as CSSProperties
          }
        />
      ))}
      <div className={styles.vignette} />
    </div>
  );
}
