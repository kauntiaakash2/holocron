import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  render: vi.fn(),
  dispose: vi.fn(),
  lose: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  return {
    ...actual,
    WebGLRenderer: class {
      render = state.render;
      dispose = state.dispose;
      forceContextLoss = state.lose;
      renderLists = { dispose: vi.fn() };
      setPixelRatio = vi.fn();
      setSize = vi.fn();
      setClearColor = vi.fn();
    },
  };
});
import { createHolocronScene } from "@/components/holocron/HolocronScene";
let queue: Map<number, FrameRequestCallback>, next: number, now: number;
let resize: () => void;
let canvas: EventTarget & {
  setAttribute: ReturnType<typeof vi.fn>;
  getContext: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};
function flush() {
  now += 1000 / 60;
  const pending = [...queue.values()];
  queue.clear();
  pending.forEach((fn) => fn(now));
}
function setup(reducedMotion = false) {
  const host = {
    clientWidth: 500,
    clientHeight: 450,
    dataset: {},
    append: vi.fn(),
  } as unknown as HTMLElement;
  const onFailure = vi.fn(),
    onActiveChange = vi.fn();
  const scene = createHolocronScene(host, {
    reducedMotion,
    onFailure,
    onActiveChange,
  });
  return { scene, onFailure, onActiveChange, host };
}
beforeEach(() => {
  vi.clearAllMocks();
  state.render.mockReset();
  queue = new Map();
  next = 0;
  now = 0;
  canvas = Object.assign(new EventTarget(), {
    setAttribute: vi.fn(),
    getContext: vi.fn(() => ({})),
    remove: vi.fn(),
  });
  vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });
  vi.stubGlobal("window", { devicePixelRatio: 3 });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe = vi.fn();
      disconnect = state.disconnect;
    },
  );
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    queue.set(++next, fn);
    return next;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => queue.delete(id));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("does no rendering before visibility, has one loop and cancels it offscreen", () => {
  const { scene, host } = setup();
  expect(queue.size).toBe(0);
  expect(state.render).not.toHaveBeenCalled();
  scene.setVisible(true);
  scene.setVisible(true);
  expect(queue.size).toBe(1);
  flush();
  expect(state.render).toHaveBeenCalledTimes(1);
  expect(queue.size).toBe(1);
  scene.setVisible(false);
  expect(queue.size).toBe(0);
  expect(host.dataset.rendering).toBe("suspended");
  scene.setVisible(true);
  expect(queue.size).toBe(1);
  scene.dispose();
  scene.dispose();
  expect(queue.size).toBe(0);
  expect(state.dispose).toHaveBeenCalledTimes(1);
  expect(state.lose).toHaveBeenCalledTimes(1);
  expect(state.disconnect).toHaveBeenCalledTimes(1);
  expect(canvas.remove).toHaveBeenCalledTimes(1);
});
it("renders reduced motion on demand, with a bounded static activation", () => {
  vi.useFakeTimers();
  const { scene, onActiveChange } = setup(true);
  scene.setVisible(true);
  flush();
  expect(queue.size).toBe(0);
  expect(scene.activate()).toBe(true);
  expect(scene.activate()).toBe(false);
  flush();
  expect(queue.size).toBe(0);
  expect(onActiveChange).toHaveBeenLastCalledWith(true);
  vi.advanceTimersByTime(1200);
  flush();
  expect(onActiveChange).toHaveBeenLastCalledWith(false);
  expect(queue.size).toBe(0);
  scene.dispose();
});
it("returns to a static fallback after context loss and releases resources", () => {
  const { scene, onFailure } = setup();
  scene.setVisible(true);
  canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  expect(onFailure).toHaveBeenCalledTimes(1);
  expect(state.dispose).toHaveBeenCalledTimes(1);
  expect(queue.size).toBe(0);
  expect(scene.activate()).toBe(false);
});
it("handles render failures without leaving a running animation loop", () => {
  const { scene, onFailure } = setup();
  state.render.mockImplementationOnce(() => {
    throw new Error("GPU failure");
  });
  scene.setVisible(true);
  flush();
  expect(onFailure).toHaveBeenCalledTimes(1);
  expect(queue.size).toBe(0);
  expect(state.dispose).toHaveBeenCalledTimes(1);
});
it("rejects unavailable WebGL before creating a renderer", () => {
  canvas.getContext.mockReturnValue(null);
  expect(() => setup()).toThrow("WebGL2 unavailable");
  expect(queue.size).toBe(0);
});

it("prepares a fully illuminated GPU frame behind the intro without starting RAF", () => {
  const { scene } = setup();
  expect(scene.prepare()).toBe(true);
  expect(state.render).toHaveBeenCalledTimes(1);
  expect(queue.size).toBe(0);
  const renderedScene = state.render.mock.calls[0][0];
  const modelRoot = renderedScene.children[0];
  expect(modelRoot.scale.x).toBe(1);
  const crystal = modelRoot.children.find(
    (mesh: { material: { emissiveIntensity?: number } }) =>
      mesh.material.emissiveIntensity === 0.33,
  );
  expect(crystal).toBeDefined();
  scene.setVisible(true);
  flush();
  expect(modelRoot.scale.x).toBe(1);
  scene.setVisible(false);
  const beforeResize = state.render.mock.calls.length;
  resize();
  expect(state.render).toHaveBeenCalledTimes(beforeResize + 1);
  expect(queue.size).toBe(0);
  scene.dispose();
});

it("keeps the fallback when the preparation render fails", () => {
  const { scene, onFailure } = setup();
  state.render.mockImplementationOnce(() => {
    throw new Error("Shader failure");
  });
  expect(scene.prepare()).toBe(false);
  expect(onFailure).toHaveBeenCalledTimes(1);
  expect(queue.size).toBe(0);
  expect(state.dispose).toHaveBeenCalledTimes(1);
});

it("picks the artifact instead of the empty canvas and rejects suspended input", () => {
  const { scene } = setup();
  scene.prepare();
  expect(scene.hitTest(0, 0)).toBe(false);
  scene.setVisible(true);
  flush();
  expect(scene.hitTest(0, 0)).toBe(true);
  expect(scene.hitTest(0.95, 0.95)).toBe(false);
  expect(scene.hitTest(NaN, 0)).toBe(false);
  expect(scene.hoverAt(0, 0)).toBe(true);
  expect(scene.beginDrag()).toBe(true);
  scene.dragBy(0.1, 0.1, 1 / 60);
  flush();
  expect(scene.activate()).toBe(false);
  scene.endDrag();
  expect(scene.activate()).toBe(true);
  scene.setVisible(false);
  expect(scene.hitTest(0, 0)).toBe(false);
  expect(scene.beginDrag()).toBe(false);
  expect(queue.size).toBe(0);
  scene.dispose();
});

it("allows keyboard turning without enabling drag for reduced-motion users", () => {
  const { scene } = setup(true);
  scene.prepare();
  scene.setVisible(true);
  flush();
  expect(scene.beginDrag()).toBe(false);
  scene.nudge(0.3, 0.1);
  scene.restore();
  expect(queue.size).toBe(0);
  scene.dispose();
});
