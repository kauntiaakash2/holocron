/** Resolve a section's released document position while its portal layer is sticky. */
export function sectionScrollTop(
  element: HTMLElement,
  scroll: number,
  inset = 0,
) {
  const panel = element.closest<HTMLElement>("[data-portal-panel]");
  const portal = panel?.closest<HTMLElement>("[data-archive-portal]");
  const pin = portal?.querySelector<HTMLElement>("[data-portal-pin]");
  const travel = Number(portal?.dataset.portalTravel);
  if (
    portal?.dataset.enabled === "true" &&
    pin &&
    Number.isFinite(travel) &&
    travel > 0
  ) {
    return (
      portal.getBoundingClientRect().top +
      scroll +
      travel +
      Math.max(
        0,
        element.getBoundingClientRect().top -
          pin.getBoundingClientRect().top -
          inset,
      )
    );
  }
  return element.getBoundingClientRect().top + scroll - inset;
}
