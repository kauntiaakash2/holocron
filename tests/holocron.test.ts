import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { HolocronModel } from "@/components/holocron/HolocronModel";
import { HolocronMotion } from "@/components/holocron/motion";

describe("native holocron geometry", () => {
  it("batches the six symmetric faces while retaining a separate animated core", () => {
    const model = new HolocronModel();
    const meshes: THREE.Mesh[] = [];
    model.root.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object);
    });
    expect(meshes).toHaveLength(8);
    expect(meshes).toContain(model.inner);
    expect(new Set(meshes.map((mesh) => mesh.material)).size).toBe(8);
    const bounds = new THREE.Box3().setFromObject(model.root);
    for (const axis of ["x", "y", "z"] as const) {
      expect(bounds.max[axis]).toBeCloseTo(-bounds.min[axis], 5);
      expect(bounds.max[axis]).toBeGreaterThan(1.4);
      expect(bounds.max[axis]).toBeLessThan(1.7);
    }
    for (const mesh of meshes) {
      expect(
        Array.from(mesh.geometry.getAttribute("position").array).every(
          Number.isFinite,
        ),
      ).toBe(true);
    }
    model.dispose();
  });
  it("disposes every owned geometry/material exactly once across repeated cleanup", () => {
    const model = new HolocronModel();
    const spies: ReturnType<typeof vi.spyOn>[] = Object.values(
      model.materials,
    ).map((material) => vi.spyOn(material, "dispose"));
    model.root.traverse((object) => {
      if (object instanceof THREE.Mesh)
        spies.push(vi.spyOn(object.geometry, "dispose"));
    });
    model.dispose();
    model.dispose();
    spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    expect(model.root.children).toHaveLength(0);
  });
});
describe("artifact motion", () => {
  it("ignores repeat activation and returns to idle after a bounded sequence", () => {
    const motion = new HolocronMotion();
    expect(motion.activate()).toBe(true);
    expect(motion.activate()).toBe(false);
    for (let i = 0; i < 210; i++) {
      motion.step(1 / 60, false, false, { x: 0, y: 0 });
      expect(motion.activation).toBeGreaterThanOrEqual(0);
      expect(motion.activation).toBeLessThanOrEqual(1);
    }
    expect(motion.active).toBe(false);
    expect(motion.activation).toBe(0);
    expect(motion.activate()).toBe(true);
  });
  it("uses elapsed time rather than frame counts", () => {
    const a = new HolocronMotion(),
      b = new HolocronMotion();
    for (let i = 0; i < 60; i++) a.step(1 / 60, false, false, { x: 1, y: 1 });
    for (let i = 0; i < 120; i++) b.step(1 / 120, false, false, { x: 1, y: 1 });
    expect(a.rotation).toBeCloseTo(b.rotation, 10);
    expect(a.tiltX).toBeCloseTo(b.tiltX, 10);
    expect(a.rise).toBeCloseTo(b.rise, 10);
  });
  it("keeps reduced motion static and limits large resumed frame deltas", () => {
    const motion = new HolocronMotion();
    motion.step(5, true, false, { x: 1, y: 1 });
    expect(motion.elapsed).toBe(0);
    expect(motion.rotation).toBe(0.55);
    expect(motion.entrance).toBe(1);
    motion.step(5, false, false, { x: 0, y: 0 });
    expect(motion.elapsed).toBe(0.05);
    motion.step(0.05, false, true, { x: 0, y: 0 });
    expect(motion.elapsed).toBe(0.05);
  });
});

describe("direct artifact manipulation", () => {
  it("smooths hover entry and return without rolling the model off axis", () => {
    const motion = new HolocronMotion();
    motion.entrance = 1;
    motion.setHovered(true);
    motion.step(1 / 60, false, true, { x: 1, y: 1 });
    expect(motion.pointerX).toBeGreaterThan(0);
    expect(motion.pointerX).toBeLessThan(0.2);
    expect(motion.tiltZ).toBeGreaterThan(0.14);
    for (let i = 0; i < 90; i++)
      motion.step(1 / 60, false, true, { x: 1, y: 1 });
    expect(motion.yaw).toBeGreaterThan(0.67);
    const previous = motion.pointerX;
    motion.setHovered(false);
    motion.step(1 / 60, false, true, { x: 0, y: 0 });
    expect(motion.pointerX).toBeGreaterThan(0);
    expect(motion.pointerX).toBeLessThan(previous);
    for (let i = 0; i < 120; i++)
      motion.step(1 / 60, false, true, { x: 0, y: 0 });
    expect(motion.yaw).toBeCloseTo(0.55, 4);
    expect(motion.needsUpdate).toBe(false);
  });
  it("damps drag movement, bounds pitch and settles release inertia", () => {
    const motion = new HolocronMotion();
    expect(motion.beginDrag()).toBe(true);
    expect(motion.activate()).toBe(false);
    motion.dragBy(0.1, 1, 1 / 60);
    expect(motion.yaw).toBe(0.55);
    motion.step(1 / 60, false, true, { x: 0, y: 0 });
    expect(motion.yaw).toBeGreaterThan(0.55);
    expect(motion.yaw).toBeLessThan(0.89);
    for (let i = 0; i < 20; i++) {
      motion.dragBy(0.1, 1, 1 / 60);
      motion.step(1 / 60, false, true, { x: 0, y: 0 });
    }
    const beforeRelease = motion.yaw;
    motion.endDrag();
    for (let i = 0; i < 240; i++)
      motion.step(1 / 60, false, true, { x: 0, y: 0 });
    expect(motion.yaw).toBeGreaterThan(beforeRelease);
    expect(motion.tiltX).toBeLessThanOrEqual(0.420001);
    const settled = motion.yaw;
    for (let i = 0; i < 60; i++)
      motion.step(1 / 60, false, true, { x: 0, y: 0 });
    expect(motion.yaw).toBeCloseTo(settled, 4);
    expect(motion.needsUpdate).toBe(false);
    expect(motion.activate()).toBe(true);
  });
  it("stops held-pointer momentum when release or visibility cancels it", () => {
    const motion = new HolocronMotion();
    motion.beginDrag();
    motion.dragBy(0.1, 0, 1 / 60);
    motion.endDrag(false);
    for (let i = 0; i < 180; i++)
      motion.step(1 / 60, false, true, { x: 0, y: 0 });
    expect(motion.yaw).toBeCloseTo(0.89, 5);
    motion.resetInteraction();
    motion.restore();
    for (let i = 0; i < 180; i++)
      motion.step(1 / 60, false, true, { x: 0, y: 0 });
    expect(motion.yaw).toBeCloseTo(0.55, 5);
  });
  it("keeps reduced-motion input still and permits a fresh activation after cancellation", () => {
    const motion = new HolocronMotion();
    motion.beginDrag();
    motion.dragBy(0.1, 0.1, 1 / 60);
    motion.resetInteraction();
    for (let i = 0; i < 60; i++)
      motion.step(1 / 60, true, false, { x: 1, y: 1 });
    expect(motion.yaw).toBe(0.55);
    expect(motion.tiltX).toBe(-0.23);
    expect(motion.activate()).toBe(true);
  });
});
