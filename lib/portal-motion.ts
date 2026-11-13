const clamp = (value: number) =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

/** A focus jump may expose the destination early, but must not disable the
 * next reverse transition after navigation reaches the fully open page. */
export function retainPortalBypass(
  bypassed: boolean,
  previousScroll: number,
  scroll: number,
  travel: number,
) {
  return bypassed && scroll < travel && !(scroll <= 2 && previousScroll > 2);
}

/** Scroll-derived geometry: reversible, bounded, and independent of frame rate. */
export function portalFrame(
  scroll: number,
  width: number,
  height: number,
  x: number,
  y: number,
  travel = height,
) {
  const progress = clamp(scroll / Math.max(1, travel));
  const eased = progress * progress * (3 - 2 * progress);
  const cover =
    Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) + 80;
  return {
    progress,
    radius: eased * cover,
    opacity: Math.sin(Math.PI * progress) * 0.8,
    complete: progress >= 1,
  };
}

/** Smooth, closed contour with traveling waves rather than a perfect circle. */
export function waterContour(
  x: number,
  y: number,
  radius: number,
  progress: number,
) {
  const amplitude =
    Math.min(radius * 0.09, 18) * Math.sin(Math.PI * clamp(progress));
  const phase = clamp(progress) * Math.PI * 5;
  const points = Array.from({ length: 80 }, (_, index) => {
    const angle = (index / 80) * Math.PI * 2;
    const r =
      radius +
      amplitude *
        (Math.sin(angle * 3 + phase) + Math.sin(angle * 7 - phase * 1.4) * 0.4);
    return { x: x + Math.cos(angle) * r, y: y + Math.sin(angle) * r };
  });
  const round = (n: number) => n.toFixed(2);
  const middle = (a: (typeof points)[number], b: typeof a) =>
    `${round((a.x + b.x) / 2)} ${round((a.y + b.y) / 2)}`;
  return (
    `M${middle(points[79], points[0])}` +
    points
      .map(
        (point, i) =>
          `Q${round(point.x)} ${round(point.y)} ${middle(point, points[(i + 1) % 80])}`,
      )
      .join("") +
    "Z"
  );
}
