const clamp = (x: number, low = 0, high = 1) =>
  Math.max(low, Math.min(high, x));
const smooth = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};
export const ACTIVATION_SECONDS = 3.2;
/** All orientation and lighting responses advance on simulation time. */
export class HolocronMotion {
  elapsed = 0;
  entrance = 0;
  rotation = 0.55;
  tiltX = -0.23;
  tiltZ = 0.15;
  activation = 0;
  engagement = 0;
  pointerX = 0;
  pointerY = 0;
  private activationTime: number | null = null;
  private hovered = false;
  private dragging = false;
  private orbitYaw = 0;
  private orbitPitch = 0;
  private targetYaw = 0;
  private targetPitch = 0;
  private velocityYaw = 0;
  private velocityPitch = 0;
  private hoverYaw = 0;
  private desiredPointerX = 0;
  private desiredPointerY = 0;
  get active() {
    return this.activationTime !== null;
  }
  get yaw() {
    return this.rotation + this.orbitYaw + this.hoverYaw;
  }
  get needsUpdate() {
    return (
      this.dragging ||
      Math.abs(this.targetYaw - this.orbitYaw) +
        Math.abs(this.targetPitch - this.orbitPitch) >
        0.0001 ||
      Math.abs(this.velocityYaw) + Math.abs(this.velocityPitch) > 0.001 ||
      Math.abs(Number(this.hovered) - this.engagement) > 0.001 ||
      Math.abs(this.desiredPointerX - this.pointerX) +
        Math.abs(this.desiredPointerY - this.pointerY) >
        0.0001
    );
  }
  setHovered(next: boolean) {
    this.hovered = next;
  }
  beginDrag() {
    if (this.active) return false;
    this.dragging = true;
    this.velocityYaw = this.velocityPitch = 0;
    return true;
  }
  dragBy(dx: number, dy: number, dt: number) {
    if (!this.dragging) return;
    const yaw = clamp(dx, -0.15, 0.15) * 3.4,
      pitch = clamp(dy, -0.15, 0.15) * 2.1;
    this.targetYaw += yaw;
    this.targetPitch = clamp(this.targetPitch + pitch, -0.65, 0.65);
    dt = clamp(dt, 1 / 240, 0.1);
    this.velocityYaw =
      this.velocityYaw * 0.6 + clamp(yaw / dt, -2.4, 2.4) * 0.4;
    this.velocityPitch =
      this.velocityPitch * 0.6 + clamp(pitch / dt, -1.2, 1.2) * 0.4;
  }
  endDrag(inertia = true) {
    this.dragging = false;
    if (!inertia) this.velocityYaw = this.velocityPitch = 0;
  }
  nudge(yaw: number, pitch: number) {
    if (this.active) return;
    this.velocityYaw = this.velocityPitch = 0;
    this.targetYaw += yaw;
    this.targetPitch = clamp(this.targetPitch + pitch, -0.65, 0.65);
  }
  restore() {
    this.velocityYaw = this.velocityPitch = 0;
    const delta = 0.55 - this.rotation - this.targetYaw;
    this.targetYaw += Math.atan2(Math.sin(delta), Math.cos(delta));
    this.targetPitch = 0;
  }
  resetInteraction() {
    this.hovered = false;
    this.dragging = false;
    this.velocityYaw = this.velocityPitch = 0;
    this.pointerX =
      this.pointerY =
      this.desiredPointerX =
      this.desiredPointerY =
        0;
  }
  activate() {
    if (this.active || this.dragging) return false;
    this.velocityYaw = this.velocityPitch = 0;
    this.activationTime = 0;
    return true;
  }
  resetActivation() {
    this.activationTime = null;
    this.activation = 0;
  }
  step(
    dt: number,
    reduced: boolean,
    paused: boolean,
    pointer: { x: number; y: number },
  ) {
    dt = clamp(dt, 0, 0.05);
    this.entrance = reduced ? 1 : Math.min(1, this.entrance + dt / 1.1);
    if (this.activationTime !== null) {
      this.activationTime += dt;
      const t = this.activationTime;
      this.activation =
        t < 0.65
          ? smooth(t / 0.65)
          : t < 1.65
            ? 1
            : 1 - smooth((t - 1.65) / 1.55);
      if (t >= ACTIVATION_SECONDS) this.resetActivation();
    }
    if (reduced) return;
    const follow = 1 - Math.exp(-dt * 9);
    this.engagement +=
      (Number(this.hovered || this.dragging) - this.engagement) * follow;
    this.desiredPointerX = this.hovered && !this.dragging ? pointer.x : 0;
    this.desiredPointerY = this.hovered && !this.dragging ? pointer.y : 0;
    this.pointerX += (this.desiredPointerX - this.pointerX) * follow;
    this.pointerY += (this.desiredPointerY - this.pointerY) * follow;
    if (!paused) {
      this.elapsed += dt;
      this.rotation +=
        dt *
        0.075 *
        (1 - 0.94 * this.activation) *
        (1 - 0.93 * this.engagement);
    }
    if (!this.dragging) {
      const decay = Math.exp(-4.8 * dt),
        travel = (1 - decay) / 4.8;
      this.targetYaw += this.velocityYaw * travel;
      this.targetPitch = clamp(
        this.targetPitch + this.velocityPitch * travel,
        -0.65,
        0.65,
      );
      this.velocityYaw *= decay;
      this.velocityPitch *= decay;
      if (Math.abs(this.velocityYaw) < 0.001) this.velocityYaw = 0;
      if (
        Math.abs(this.velocityPitch) < 0.001 ||
        Math.abs(this.targetPitch) >= 0.65
      )
        this.velocityPitch = 0;
    }
    const orbitFollow = 1 - Math.exp(-dt * 14);
    this.orbitYaw += (this.targetYaw - this.orbitYaw) * orbitFollow;
    this.orbitPitch += (this.targetPitch - this.orbitPitch) * orbitFollow;
    const sensitivity = 1 - this.activation * 0.8;
    this.hoverYaw = this.pointerX * 0.13 * sensitivity;
    this.tiltX = -0.23 + this.orbitPitch + this.pointerY * 0.09 * sensitivity;
    this.tiltZ = 0.15 - this.pointerX * 0.02 * sensitivity;
  }
  get rise() {
    return (
      Math.sin(this.elapsed * 0.75) * 0.045 * (1 - this.engagement * 0.65) +
      this.engagement * 0.025
    );
  }
  get entranceScale() {
    return (
      (0.92 + 0.08 * smooth(this.entrance)) *
      (1 + this.engagement * 0.014 + this.activation * 0.018)
    );
  }
}
