import { expect, it } from "vitest";
import { sectionScrollTop } from "../lib/section-scroll";

function destination(scroll: number, offset: number, enabled = true) {
  const release = 1000;
  const pinTop = scroll <= release ? 0 : release - scroll;
  const pin = { getBoundingClientRect: () => ({ top: pinTop }) };
  const portal = {
    dataset: { enabled: String(enabled), portalTravel: "900" },
    getBoundingClientRect: () => ({ top: 100 - scroll }),
    querySelector: () => pin,
  };
  const panel = { closest: () => portal };
  return {
    closest: () => panel,
    getBoundingClientRect: () => ({ top: pinTop + offset }),
  } as unknown as HTMLElement;
}
it("resolves the same mission destination before, during and after sticky release", () => {
  for (const scroll of [200, 800, 1000, 1600]) {
    expect(sectionScrollTop(destination(scroll, 180), scroll)).toBe(1180);
    expect(sectionScrollTop(destination(scroll, 180), scroll, 24)).toBe(1156);
  }
});
it("never leaves a tall phone mission before the portal's release point", () => {
  expect(sectionScrollTop(destination(200, 0), 200, 24)).toBe(1000);
});
it("uses normal section coordinates outside the portal or in reduced motion", () => {
  const normal = {
    closest: () => null,
    getBoundingClientRect: () => ({ top: 60 }),
  } as unknown as HTMLElement;
  expect(sectionScrollTop(normal, 400, 24)).toBe(436);
  expect(sectionScrollTop(destination(200, 180, false), 200, 24)).toBe(356);
});
