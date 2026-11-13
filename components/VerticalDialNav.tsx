"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import {
  introServerSnapshot,
  isIntroComplete,
  subscribeToIntro,
} from "@/lib/intro-lifecycle";
import { sectionScrollTop } from "@/lib/section-scroll";
import styles from "./vertical-dial-nav.module.css";

const sections = [
  { id: "archive", label: "The Holocron" },
  { id: "mission", label: "The mission" },
  { id: "domains", label: "Challenge domains" },
  { id: "brief", label: "Mission brief" },
  { id: "join", label: "Join the archive" },
];
const SECTION_INSET = 24;
const RADIUS = 235;

/** Rotating wheel with pointer-held geometry for reliable one-click selection. */
export function VerticalDialNav() {
  const introComplete = useSyncExternalStore(
    subscribeToIntro,
    isIntroComplete,
    introServerSnapshot,
  );
  const [active, setActive] = useState("archive");
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [available, setAvailable] = useState(sections);
  const root = useRef<HTMLDivElement>(null),
    dial = useRef<HTMLElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]),
    toggle = useRef<HTMLButtonElement>(null);
  const pending = useRef<{ id: string; top: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useRef<() => void>(() => {});

  useEffect(() => {
    // Build from the remaining DOM sections: removed blocks cannot create dead links.
    const targets = sections.flatMap((section) => {
      const element = document.getElementById(section.id);
      return element ? [{ ...section, element }] : [];
    });
    setAvailable(targets.map(({ id, label }) => ({ id, label })));
    let frame: number | null = null;
    const clearPending = () => {
      pending.current = null;
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    };
    const update = () => {
      frame = null;
      const moved = window.scrollY > 2;
      setScrolled(moved);
      if (!moved) setOpen(false);
      if (pending.current) {
        if (Math.abs(window.scrollY - pending.current.top) > 3) {
          setActive(pending.current.id);
          return;
        }
        clearPending();
      }
      let next = targets[0]?.id ?? "archive";
      const marker = Math.min(window.innerHeight * 0.32, 240);
      for (const target of targets)
        if (
          sectionScrollTop(target.element, window.scrollY) - window.scrollY <=
          marker
        )
          next = target.id;
      if (
        moved &&
        window.scrollY + window.innerHeight >=
          document.documentElement.scrollHeight - 3
      )
        next = targets.at(-1)?.id ?? next;
      setActive(next);
    };
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };
    refresh.current = schedule;
    const interrupt = () => {
      clearPending();
      schedule();
    };
    const resize = () => {
      // A held desktop transform must not survive switching to/from the mobile
      // menu, where labels use normal flow instead of wheel coordinates.
      releaseWheel();
      interrupt();
    };
    const scrollEnd = () => {
      // Ignore an earlier scroll's end event while a new destination is in flight.
      if (pending.current && Math.abs(window.scrollY - pending.current.top) > 3)
        return;
      interrupt();
    };
    const key = (event: globalThis.KeyboardEvent) => {
      if (
        !event.defaultPrevented &&
        [
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
          "PageUp",
          "PageDown",
          " ",
        ].includes(event.key)
      )
        interrupt();
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", resize);
    window.addEventListener("scrollend", scrollEnd);
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("touchstart", interrupt, { passive: true });
    window.addEventListener("keydown", key);
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(schedule)
        : null;
    observer?.observe(document.documentElement);
    update();
    return () => {
      clearPending();
      refresh.current = () => {};
      if (frame !== null) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scrollend", scrollEnd);
      window.removeEventListener("wheel", interrupt);
      window.removeEventListener("touchstart", interrupt);
      window.removeEventListener("keydown", key);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        if (root.current?.contains(document.activeElement))
          toggle.current?.focus({ preventScroll: true });
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function holdWheel() {
    if (
      !window.matchMedia("(min-width: 1101px) and (min-height: 521px)").matches
    ) {
      releaseWheel();
      return;
    }
    // Capture the rendered matrix, including an in-flight transition. Pointer
    // focus and scroll updates cannot move a link between pointerdown and click.
    dial.current?.querySelectorAll<HTMLElement>("li").forEach((item) => {
      const transform = getComputedStyle(item).transform;
      item.style.transition = "none";
      item.style.transform = transform;
    });
  }
  function releaseWheel() {
    dial.current?.querySelectorAll<HTMLElement>("li").forEach((item) => {
      item.style.removeProperty("transition");
      item.style.removeProperty("transform");
    });
  }

  function navigate(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
      return;
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const maximum = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    // The removed header no longer needs its previous 90px clearance.
    const top =
      id === "archive"
        ? 0
        : Math.max(
            0,
            Math.min(
              maximum,
              sectionScrollTop(target, window.scrollY, SECTION_INSET),
            ),
          );
    if (timer.current !== null) clearTimeout(timer.current);
    pending.current = { id, top };
    setActive(id);
    target.focus({ preventScroll: true });
    history.replaceState(null, "", `#${id}`);
    setOpen(false);
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({ top, behavior: reduced ? "instant" : "smooth" });
    timer.current = setTimeout(() => {
      pending.current = null;
      timer.current = null;
      refresh.current();
    }, 2000);
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      toggle.current?.focus({ preventScroll: true });
      return;
    }
    const current = links.current.indexOf(
      document.activeElement as HTMLAnchorElement,
    );
    if (current < 0) return;
    let next = current;
    if (event.key === "ArrowDown" || event.key === "ArrowRight")
      next = Math.min(current + 1, available.length - 1);
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
      next = Math.max(current - 1, 0);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = available.length - 1;
    else return;
    event.preventDefault();
    releaseWheel();
    const link = links.current[next];
    link?.focus({ preventScroll: true });
    // On short mobile screens scroll only the menu, never the underlying page.
    if (link && dial.current) {
      const box = link.getBoundingClientRect(),
        viewport = dial.current.getBoundingClientRect();
      if (box.top < viewport.top)
        dial.current.scrollTop += box.top - viewport.top - 8;
      else if (box.bottom > viewport.bottom)
        dial.current.scrollTop += box.bottom - viewport.bottom + 8;
    }
  }

  if (!introComplete || !scrolled || !available.length) return null;
  return (
    <div
      ref={root}
      className={styles.shell}
      data-open={open}
      onKeyDown={onKeyDown}
    >
      <button
        ref={toggle}
        type="button"
        className={styles.toggle}
        aria-label={
          open ? "Close section navigation" : "Open section navigation"
        }
        aria-expanded={open}
        aria-controls="archive-section-dial"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{open ? "×" : "Menu"}</span>
      </button>
      <nav
        ref={dial}
        id="archive-section-dial"
        className={styles.dial}
        aria-label="Archive sections"
        onPointerEnter={holdWheel}
        onPointerDown={holdWheel}
        onPointerLeave={releaseWheel}
        onPointerCancel={releaseWheel}
      >
        <svg className={styles.scale} viewBox="0 0 200 430" aria-hidden="true">
          <circle cx="405" cy="215" r={RADIUS} />
          {Array.from({ length: 41 }, (_, index) => {
            const angle = (index - 20) * 0.035,
              radius = index % 5 === 0 ? 225 : 230;
            return (
              <line
                key={index}
                x1={405 - Math.cos(angle) * RADIUS}
                y1={215 + Math.sin(angle) * RADIUS}
                x2={405 - Math.cos(angle) * radius}
                y2={215 + Math.sin(angle) * radius}
              />
            );
          })}
        </svg>
        <ol className={styles.items}>
          {available.map(({ id, label }, index) => {
            const activeIndex = Math.max(
              0,
              available.findIndex((section) => section.id === active),
            );
            // Limit travel at the ends so every destination stays on the wheel.
            const center = Math.max(
              1,
              Math.min(available.length - 2, activeIndex),
            );
            const angle = (index - center) * 0.17;
            const x = RADIUS * (1 - Math.cos(angle));
            const y = RADIUS * Math.sin(angle);
            return (
              <li
                key={id}
                className={styles.item}
                style={
                  {
                    "--wheel-x": `${x}px`,
                    "--wheel-y": `${y - 22}px`,
                    "--wheel-angle": `${-angle * 0.5}rad`,
                  } as CSSProperties
                }
              >
                <a
                  ref={(node) => {
                    links.current[index] = node;
                  }}
                  href={`#${id}`}
                  aria-label={label}
                  aria-current={active === id ? "location" : undefined}
                  onClick={(event) => navigate(event, id)}
                >
                  <span className={styles.number} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={styles.label}>{label}</span>
                  <span className={styles.tick} aria-hidden="true" />
                </a>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
