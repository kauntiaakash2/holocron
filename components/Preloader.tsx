"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { completeIntro } from "@/lib/intro-lifecycle";

// Document-local: reloads replay the intro; internal navigation does not.
let played = false;
const MAX_INTRO_MS = 10000;
const COCKPIT_FLIGHT_MS = 1600;
const introTiming = {
  "--intro-flight-duration": `${COCKPIT_FLIGHT_MS}ms`,
} as CSSProperties;

export function Preloader() {
  const [visible, setVisible] = useState(false);
  const [entering, setEntering] = useState(false);
  const [dimensionEntry, setDimensionEntry] = useState(false);
  const started = useRef(false);
  const mounted = useRef(false);
  const playbackStarted = useRef(false);
  const enteringRef = useRef(false);
  const closed = useRef(false);
  const video = useRef<HTMLVideoElement>(null);
  const cockpitFrame = useRef<HTMLImageElement>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dimensionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Media failures and Escape open the page immediately. Normal completion
  // releases the cockpit while the nonblocking light bloom finishes above it.
  const dismiss = useCallback(() => {
    closed.current = true;
    completeIntro();
    video.current?.pause();
    if (exitTimer.current !== null) clearTimeout(exitTimer.current);
    setVisible(false);
  }, []);

  const enterCockpit = useCallback(() => {
    if (closed.current || enteringRef.current) return;
    if (!cockpitFrame.current?.complete || !cockpitFrame.current.naturalWidth) {
      dismiss();
      return;
    }
    enteringRef.current = true;
    video.current?.pause();
    setEntering(true);
    setDimensionEntry(true);
    dimensionTimer.current = setTimeout(() => {
      setDimensionEntry(false);
      dimensionTimer.current = null;
    }, COCKPIT_FLIGHT_MS + 100);
    // CSS drives the traced glass mask and camera push. This timeout is a
    // deterministic fallback if animationend is suppressed or interrupted.
    exitTimer.current = setTimeout(dismiss, COCKPIT_FLIGHT_MS + 100);
  }, [dismiss]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if ((played && !started.current) || reducedMotion.matches) {
      completeIntro();
      return;
    }
    mounted.current = true;
    started.current = true;
    played = true;
    setVisible(true);
    const startupTimer = setTimeout(() => {
      if (!playbackStarted.current) dismiss();
    }, 2200);
    const deadline = setTimeout(dismiss, MAX_INTRO_MS);
    const handleMotion = () => {
      if (reducedMotion.matches) {
        setDimensionEntry(false);
        dismiss();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDimensionEntry(false);
        dismiss();
      }
    };
    reducedMotion.addEventListener("change", handleMotion);
    window.addEventListener("keydown", handleKey);
    return () => {
      mounted.current = false;
      // Strict Mode immediately re-runs setup; only a real unmount completes.
      queueMicrotask(() => {
        if (!mounted.current) completeIntro();
      });
      clearTimeout(startupTimer);
      clearTimeout(deadline);
      if (exitTimer.current !== null) clearTimeout(exitTimer.current);
      exitTimer.current = null;
      if (dimensionTimer.current !== null) clearTimeout(dimensionTimer.current);
      dimensionTimer.current = null;
      reducedMotion.removeEventListener("change", handleMotion);
      window.removeEventListener("keydown", handleKey);
    };
  }, [dismiss]);

  return (
    <>
      {dimensionEntry && (
        <div
          className="preloader-dimension"
          style={introTiming}
          aria-hidden="true"
          onAnimationEnd={(event) => {
            if (event.animationName !== "dimension-entry-envelope") return;
            setDimensionEntry(false);
            if (dimensionTimer.current !== null)
              clearTimeout(dimensionTimer.current);
            dimensionTimer.current = null;
          }}
        />
      )}
      {visible && (
        <div
          className={`preloader${entering ? " preloader--cockpit" : ""}`}
          style={introTiming}
          aria-label="HOL0CRON cinematic introduction"
        >
          <div className="preloader-scene" aria-hidden="true">
            <div
              className="preloader-flight"
              onAnimationEnd={(event) => {
                if (event.animationName === "cockpit-fly-through") dismiss();
              }}
            >
              <video
                ref={video}
                className="preloader-film"
                src="/media/archive-cockpit-intro.mp4"
                poster="/media/archive-cockpit-poster.jpg"
                autoPlay
                muted
                playsInline
                preload="auto"
                disablePictureInPicture
                tabIndex={-1}
                onPlaying={() => {
                  playbackStarted.current = true;
                }}
                onEnded={enterCockpit}
                onError={dismiss}
              />
              {/* Exact decoded final frame: the aperture follows its real glass. */}
              <img
                ref={cockpitFrame}
                className="preloader-cockpit-frame"
                src="/media/archive-cockpit-end.jpg"
                width="1280"
                height="760"
                alt=""
                decoding="async"
              />
            </div>
          </div>
          <div className="preloader-shade" aria-hidden="true" />
          <div className="preloader-heading" aria-hidden="true">
            <span>HOL0CRON</span>
            <span>ENTER THE ARCHIVE / 2026</span>
          </div>
        </div>
      )}
    </>
  );
}
