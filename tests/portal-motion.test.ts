import { describe, expect, it } from "vitest";
import {
  portalFrame,
  retainPortalBypass,
  waterContour,
} from "../lib/portal-motion";

describe("temporary focus bypass", () => {
  it("keeps a navigation target exposed until arrival, then restores reverse scrolling", () => {
    let bypass = true;
    let previous = 0;
    for (const scroll of [0, 200, 600]) {
      bypass = retainPortalBypass(bypass, previous, scroll, 900);
      expect(bypass).toBe(true);
      previous = scroll;
    }
    bypass = retainPortalBypass(bypass, previous, 900, 900);
    expect(bypass).toBe(false);
    for (const scroll of [1100, 900, 700, 300, 0]) {
      bypass = retainPortalBypass(bypass, previous, scroll, 900);
      expect(bypass).toBe(false);
      previous = scroll;
    }
  });
  it("does not latch after interacting with a fully open section", () => {
    expect(retainPortalBypass(true, 1200, 1200, 900)).toBe(false);
  });
  it("resets an interrupted focus jump when returning to the hero", () => {
    expect(retainPortalBypass(true, 300, 1, 900)).toBe(false);
    expect(retainPortalBypass(true, 0, 0, 900)).toBe(true);
  });
});

describe("scroll-driven liquid portal geometry", () => {
  it("starts closed and clamps overscroll and invalid input", () => {
    for (const scroll of [0, -50, Number.NaN]) {
      const state = portalFrame(scroll, 375, 812, 187.5, 406);
      expect(state.progress).toBe(0);
      expect(state.radius).toBe(0);
      expect(state.complete).toBe(false);
    }
    expect(portalFrame(10000, 375, 812, 187.5, 406).progress).toBe(1);
    // Mobile toolbar height must not change the measured sticky travel.
    expect(portalFrame(700, 375, 812, 187.5, 350, 700).complete).toBe(true);
  });
  it("covers every viewport corner at the end across portrait and landscape", () => {
    for (const [width, height] of [
      [320, 568],
      [430, 932],
      [844, 390],
      [1920, 1080],
    ]) {
      const x = width / 2,
        y = height * 0.2;
      const state = portalFrame(height, width, height, x, y);
      expect(state.complete).toBe(true);
      expect(Math.abs(state.opacity)).toBeLessThan(0.00001);
      for (const [cx, cy] of [
        [0, 0],
        [width, 0],
        [0, height],
        [width, height],
      ])
        expect(state.radius).toBeGreaterThan(Math.hypot(cx - x, cy - y));
    }
  });
  it("scrubs reversibly without depending on playback history or frame rate", () => {
    const forward = Array.from({ length: 11 }, (_, i) =>
      portalFrame(i * 80, 400, 800, 200, 400),
    );
    const backward = Array.from({ length: 11 }, (_, i) =>
      portalFrame((10 - i) * 80, 400, 800, 200, 400),
    );
    expect(backward.reverse()).toEqual(forward);
    for (let i = 1; i < forward.length; i++)
      expect(forward[i].radius).toBeGreaterThan(forward[i - 1].radius);
  });
  it("keeps the content mask and viewport water edge on the same contour", () => {
    const numbers = (path: string) =>
      [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
    const edge = numbers(waterContour(200, 400, 280, 0.5));
    const local = numbers(waterContour(188, -50, 280, 0.5));
    expect(local.length).toBe(edge.length);
    edge.forEach((value, i) =>
      expect(Math.abs(value - local[i] - (i % 2 ? 450 : 12))).toBeLessThan(
        0.011,
      ),
    );
  });
  it("produces a closed finite boundary with restrained ripple displacement", () => {
    for (const progress of [0, 0.1, 0.5, 0.9, 1]) {
      const radius = progress * 900;
      const path = waterContour(200, 400, radius, progress);
      expect(path.startsWith("M")).toBe(true);
      expect(path.endsWith("Z")).toBe(true);
      expect(path).not.toMatch(/NaN|Infinity/);
      const values = [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) =>
        Number(match[0]),
      );
      for (let i = 0; i < values.length; i += 2)
        expect(
          Math.hypot(values[i] - 200, values[i + 1] - 400),
        ).toBeLessThanOrEqual(radius + 26);
    }
  });
});
