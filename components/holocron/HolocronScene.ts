import * as THREE from "three";
import { HolocronModel } from "./HolocronModel";
import { HolocronMotion } from "./motion";

export type SceneOptions = {
  reducedMotion: boolean;
  onActiveChange: (active: boolean) => void;
  onFailure: () => void;
};
export type HolocronController = ReturnType<typeof createHolocronScene>;

/** Owns exactly one WebGL context, renderer, observer and scheduled RAF. */
export function createHolocronScene(host: HTMLElement, options: SceneOptions) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.tabIndex = -1;
  const context = canvas.getContext("webgl2", {
    alpha: true,
    antialias: true,
    powerPreference: "default",
  });
  if (!context) throw new Error("WebGL2 unavailable");
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      alpha: true,
      antialias: true,
    });
  } catch (error) {
    context.getExtension("WEBGL_lose_context")?.loseContext();
    throw error;
  }
  let model: HolocronModel;
  try {
    model = new HolocronModel();
  } catch (error) {
    renderer.dispose();
    renderer.forceContextLoss();
    throw error;
  }
  const scene = new THREE.Scene();
  scene.add(model.root);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(5.9, 4.35, 7.7);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0x98b5d6, 1.18));
  const key = new THREE.DirectionalLight(0xffddae, 3.7);
  key.position.set(-4, 7, 8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x42b8ff, 2.2);
  fill.position.set(5, 0, -5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.15);
  rim.position.set(-1, -5, -3);
  scene.add(rim);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  renderer.setClearColor(0x000000, 0);
  const motion = new HolocronMotion();
  const pointer = { x: 0, y: 0 };
  // Pick the model's oriented structural bounds, not the empty canvas rectangle.
  const bounds = new THREE.Box3()
    .setFromObject(model.root)
    .expandByScalar(0.025);
  const raycaster = new THREE.Raycaster();
  const localRay = new THREE.Ray();
  const inverse = new THREE.Matrix4();
  const point = new THREE.Vector2();
  const intersection = new THREE.Vector3();
  camera.updateMatrixWorld();
  let disposed = false,
    visible = false,
    reduced = options.reducedMotion,
    paused = false;
  let frame: number | null = null,
    previous = 0,
    activeNotified = false;
  let quality = 1,
    constrained = false,
    samples = 0,
    sampleTime = 0;
  let reducedTimer: ReturnType<typeof setTimeout> | null = null;
  let reducedActive = false;
  let prepared = false;

  function resize() {
    if (disposed) return;
    const width = Math.max(host.clientWidth, 1),
      height = Math.max(host.clientHeight, 1);
    // Fit a bounding sphere in both axes, rather than clipping tall mobile canvases.
    const aspect = width / height;
    camera.aspect = aspect;
    camera.fov = THREE.MathUtils.radToDeg(
      2 *
        Math.atan(
          Math.tan(THREE.MathUtils.degToRad(34) / 2) / Math.min(aspect, 1),
        ),
    );
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        1.75,
        Math.sqrt(900000 / (width * height)),
      ) * quality,
    );
    renderer.setSize(width, height, false);
    // Resizing clears the canvas even while the intro holds idle motion.
    if (prepared && !visible) prepare();
    requestFrame();
  }
  function notifyActive(active: boolean) {
    if (active !== activeNotified) {
      activeNotified = active;
      options.onActiveChange(active);
    }
  }
  function requestFrame() {
    if (!disposed && visible && frame === null)
      frame = requestAnimationFrame(tick);
  }
  function tick(now: number) {
    frame = null;
    if (disposed || !visible) return;
    const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 1 / 60;
    const interval = previous ? (now - previous) / 1000 : 0;
    previous = now;
    motion.step(dt, reduced, paused || constrained, pointer);
    model.root.rotation.set(motion.tiltX, motion.yaw, motion.tiltZ);
    model.root.position.y = reduced ? 0 : motion.rise;
    model.root.scale.setScalar(reduced ? 1 : motion.entranceScale);
    const activation = reducedActive ? 1 : motion.activation;
    model.materials.crystal.emissiveIntensity =
      (0.33 +
        activation * 0.65 +
        (reduced
          ? 0
          : Math.sin(motion.elapsed * 1.2) * 0.02 + motion.engagement * 0.07)) *
      motion.entrance;
    model.materials.glow.opacity = 0.09 + activation * 0.15;
    fill.intensity =
      2.2 + (reduced ? 0 : motion.engagement * 0.18) + activation * 0.3;
    fill.position.x = 5 + (reduced ? 0 : motion.pointerX * 0.6);
    if (model.inner && !reduced && !paused && !constrained)
      model.inner.rotation.y += dt * 0.09;
    try {
      renderer.render(scene, camera);
    } catch {
      fail();
      return;
    }
    notifyActive(motion.active || reducedActive);
    // Observe actual cadence, not user agent/device labels. Once quality is
    // lowered, don't oscillate. Very slow devices retain an on-demand still.
    if (
      !reduced &&
      !paused &&
      !constrained &&
      motion.entrance === 1 &&
      interval > 0 &&
      interval < 0.5
    ) {
      samples++;
      sampleTime += interval;
      if (samples >= 120) {
        const average = sampleTime / samples;
        samples = 0;
        sampleTime = 0;
        if (average > 0.035 && quality === 1) {
          quality = 0.7;
          resize();
        } else if (average > 0.065 && quality < 1) {
          constrained = true;
          host.dataset.renderMode = "on-demand";
        }
      }
    }
    if (
      !reduced &&
      ((!paused && !constrained) ||
        motion.active ||
        motion.needsUpdate ||
        motion.entrance < 1)
    )
      requestFrame();
  }
  /** Render the final idle appearance once while the intro covers the page. */
  function prepare() {
    if (disposed) return false;
    motion.entrance = 1;
    model.root.rotation.set(motion.tiltX, motion.yaw, motion.tiltZ);
    model.root.scale.setScalar(1);
    model.materials.crystal.emissiveIntensity = 0.33;
    model.materials.glow.opacity = 0.09;
    try {
      renderer.render(scene, camera);
      prepared = true;
      return true;
    } catch {
      fail();
      return false;
    }
  }
  function setVisible(next: boolean) {
    visible = next;
    previous = 0;
    if (!next) {
      motion.resetInteraction();
      pointer.x = pointer.y = 0;
    }
    if (!next && frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
    host.dataset.rendering = next ? "visible" : "suspended";
    if (next) requestFrame();
  }
  function setReducedMotion(next: boolean) {
    reduced = next;
    pointer.x = 0;
    pointer.y = 0;
    if (next) {
      motion.resetActivation();
      motion.resetInteraction();
    }
    notifyActive(reducedActive || motion.active);
    requestFrame();
  }
  function setPaused(next: boolean) {
    paused = next;
    pointer.x = 0;
    pointer.y = 0;
    requestFrame();
  }
  function hitTest(x: number, y: number) {
    if (disposed || !visible || !Number.isFinite(x) || !Number.isFinite(y))
      return false;
    point.set(x, y);
    model.root.updateMatrixWorld(true);
    raycaster.setFromCamera(point, camera);
    inverse.copy(model.root.matrixWorld).invert();
    localRay.copy(raycaster.ray).applyMatrix4(inverse);
    return localRay.intersectBox(bounds, intersection) !== null;
  }
  function setPointer(x: number, y: number) {
    if (disposed || reduced || paused) return;
    pointer.x = THREE.MathUtils.clamp(x, -1, 1);
    pointer.y = THREE.MathUtils.clamp(y, -1, 1);
    requestFrame();
  }
  function hoverAt(x: number, y: number) {
    const hit = hitTest(x, y);
    motion.setHovered(hit);
    setPointer(hit ? x * 2 : 0, hit ? y * 2 : 0);
    return hit;
  }
  function clearInteraction(cancelMotion = false) {
    motion.setHovered(false);
    if (cancelMotion) motion.endDrag(false);
    pointer.x = pointer.y = 0;
    requestFrame();
  }
  function beginDrag() {
    if (disposed || !visible || reduced || paused || !motion.beginDrag())
      return false;
    requestFrame();
    return true;
  }
  function dragBy(dx: number, dy: number, dt: number) {
    if (disposed || reduced || paused) return;
    motion.dragBy(dx, dy, dt);
    requestFrame();
  }
  function endDrag(inertia = true) {
    motion.endDrag(inertia);
    requestFrame();
  }
  function nudge(yaw: number, pitch: number) {
    if (disposed || !visible || reduced || paused) return;
    motion.nudge(yaw, pitch);
    requestFrame();
  }
  function restore() {
    if (disposed || !visible || reduced || paused) return;
    motion.restore();
    requestFrame();
  }
  function activate() {
    if (disposed || !visible || motion.active || reducedActive) return false;
    if (reduced) {
      reducedActive = true;
      notifyActive(true);
      requestFrame();
      reducedTimer = setTimeout(() => {
        reducedActive = false;
        notifyActive(false);
        requestFrame();
      }, 1200);
    } else {
      if (!motion.activate()) return false;
      notifyActive(true);
      requestFrame();
    }
    return true;
  }
  function fail() {
    dispose();
    options.onFailure();
  }
  function contextLost(event: Event) {
    event.preventDefault();
    fail();
  }
  let observer: ResizeObserver | null = null;
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    if (reducedTimer !== null) clearTimeout(reducedTimer);
    observer?.disconnect();
    canvas.removeEventListener("webglcontextlost", contextLost);
    model.dispose();
    scene.clear();
    renderer.renderLists.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }
  try {
    canvas.addEventListener("webglcontextlost", contextLost);
    host.append(canvas);
    observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    prepare,
    activate,
    setVisible,
    setReducedMotion,
    setPaused,
    setPointer,
    hitTest,
    hoverAt,
    clearInteraction,
    beginDrag,
    dragBy,
    endDrag,
    nudge,
    restore,
    dispose,
  };
}
