"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent,
  type KeyboardEvent,
  type FocusEvent,
} from "react";
import type { HolocronController } from "./HolocronScene";

type Gesture = {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  lastTime: number;
  dragged: boolean;
};

export function useHolocronInteraction(
  controller: RefObject<HolocronController | null>,
  enabled: boolean,
  reduced: boolean,
) {
  const button = useRef<HTMLButtonElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  const cancel = useCallback(() => {
    const current = gesture.current;
    gesture.current = null;
    if (current && button.current?.hasPointerCapture(current.id))
      button.current.releasePointerCapture(current.id);
    controller.current?.clearInteraction(true);
    setHovered(false);
    setDragging(false);
  }, [controller]);

  useEffect(() => {
    if (!enabled || reduced) cancel();
  }, [enabled, reduced, cancel]);
  useEffect(() => {
    window.addEventListener("blur", cancel);
    window.addEventListener("resize", cancel);
    return () => {
      window.removeEventListener("blur", cancel);
      window.removeEventListener("resize", cancel);
    };
  }, [cancel]);

  function coordinates(
    event: ReactPointerEvent<HTMLButtonElement> | MouseEvent<HTMLButtonElement>,
  ) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: 1 - ((event.clientY - rect.top) / rect.height) * 2,
      rect,
    };
  }
  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!enabled || event.button !== 0 || !event.isPrimary) return;
    suppressClick.current = false;
    const { x, y } = coordinates(event);
    if (!controller.current?.hitTest(x, y)) return;
    // Touch keeps native vertical panning; the browser cancels this gesture on scroll.
    gesture.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: performance.now(),
      dragged: false,
    };
    if (!reduced) event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!enabled) return;
    const current = gesture.current;
    if (current && current.id === event.pointerId && !reduced) {
      const dx = event.clientX - current.startX,
        dy = event.clientY - current.startY;
      if (!current.dragged && Math.hypot(dx, dy) > 6) {
        if (event.pointerType === "touch" && Math.abs(dy) > Math.abs(dx)) {
          suppressClick.current = true;
          cancel();
          return;
        }
        if (!controller.current?.beginDrag()) return;
        current.dragged = true;
        suppressClick.current = true;
        setDragging(true);
      }
      if (current.dragged) {
        const { rect } = coordinates(event),
          now = performance.now();
        controller.current?.dragBy(
          (event.clientX - current.lastX) / rect.width,
          (event.clientY - current.lastY) / rect.height,
          (now - current.lastTime) / 1000,
        );
        current.lastX = event.clientX;
        current.lastY = event.clientY;
        current.lastTime = now;
        return;
      }
    }
    if (event.pointerType === "touch") return;
    const { x, y } = coordinates(event);
    setHovered(controller.current?.hoverAt(x, y) ?? false);
  }
  function onPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    gesture.current = null;
    if (current.dragged)
      controller.current?.endDrag(performance.now() - current.lastTime < 100);
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    const { x, y } = coordinates(event);
    if (event.pointerType !== "touch")
      setHovered(controller.current?.hoverAt(x, y) ?? false);
    else controller.current?.clearInteraction();
  }
  function onClick(event: MouseEvent<HTMLButtonElement>) {
    if (!enabled) return;
    // Keyboard activation has no pointer coordinates and must always remain available.
    if (event.detail === 0) {
      controller.current?.activate();
      return;
    }
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const { x, y } = coordinates(event);
    if (controller.current?.hitTest(x, y)) controller.current.activate();
  }
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!enabled || reduced) return;
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [-0.24, 0],
      ArrowRight: [0.24, 0],
      ArrowUp: [0, -0.14],
      ArrowDown: [0, 0.14],
    };
    if (steps[event.key]) {
      event.preventDefault();
      controller.current?.nudge(...steps[event.key]);
    } else if (event.key === "Home") {
      event.preventDefault();
      controller.current?.restore();
    }
  }
  return {
    button,
    hovered,
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onClick,
      onKeyDown,
      onFocus: (event: FocusEvent<HTMLButtonElement>) => {
        if (enabled && event.currentTarget.matches(":focus-visible"))
          controller.current?.hoverAt(0, 0);
      },
      onPointerCancel: () => {
        suppressClick.current = true;
        cancel();
      },
      onLostPointerCapture: () => {
        if (gesture.current) {
          suppressClick.current = true;
          cancel();
        }
      },
      onPointerLeave: () => {
        if (!gesture.current) {
          controller.current?.clearInteraction();
          setHovered(false);
        }
      },
      onBlur: () => {
        if (gesture.current) cancel();
        else {
          controller.current?.clearInteraction();
          setHovered(false);
        }
      },
    },
  };
}
