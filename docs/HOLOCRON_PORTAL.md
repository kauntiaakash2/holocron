# Scroll into the archive

`HolocronPortal.tsx` wraps the existing homepage hero and the actual event sections. After the existing intro completes, native scrolling expands an irregular water boundary from the artifact’s visible center. The mission appears through this opening; returning to the top reverses the same geometry. The portal runs once across the hero-to-mission boundary, not at every section.

## Composition and motion

The hero and the **real mission** now occupy the same sticky frame during the opening. The destination starts as a full viewport behind a zero-area liquid mask, so it is revealed from the artifact rather than sliding upward from below. A separate runway contains the measured hero travel plus the mission’s natural height. Once the opening finishes, the frame releases into document scrolling with continuous positions. A mission taller than the viewport retains its full height and is read through normal page scrolling after release; it does not become an inner scrolling panel. This replaces the earlier 70svh overlap approach that produced the straight curtain edge shown in `Screenshot 2026-10-16 153622.png`.

The mask and its liquid edge share the same smooth quadratic contour, with bounded traveling-wave harmonics driven entirely by scroll progress. The boundary is SVG strokes over the existing scene; no second WebGL renderer, scene snapshot, iframe or new dependency is introduced. Neither a time-based loop nor wheel/touch interception drives this effect.

The content mask reaches its endpoint after approximately one viewport of scrolling and is then removed. Later sections keep their restrained individual reveals. The mission’s inner entrance animations are suppressed while the portal is enabled, so it gets one coherent entrance. The model’s screen area is not scaled or moved by extra interaction transforms.

`portal-motion.ts` owns deterministic contour/progress geometry. `archive-visibility.ts` tells the existing model and wordmark effect when the hero is fully covered: rendering and input suspend, and the covered hero becomes inert/hidden from assistive technology. Scrolling back restores it. Lifecycle cleanup clears the mask, listeners, observers, queued frame and shared covered state.

## Access and fallback

The mission is top-aligned with 32–48px opening space instead of vertical centering. `MissionMarquee` follows the copy and occupies the lower space with pale OpenAI SC, AlgoZenith and Kodewrek text. Three equal copies form a continuous CSS translation; duplicate copies are hidden from assistive technology. The visible playback control is omitted at the user’s request; reduced-motion mode presents a static, wrapping row. The strip is text requested for the composition, without sponsor or partnership claims. The existing height observer includes the strip when calculating the portal release.

The revealed mission places its headline across the available width, with the gold second line establishing the focal point. Story copy and the core principle sit below a shared divider in two balanced columns; phones stack these in reading order. The headline scales from 52–96px on desktop and 34–56px on phones. Natural content height and the existing measured-height release prevent clipping or an inner scrollbar. These styles are scoped to the mission; supporting sections retain their existing typography.

Navigation uses `sectionScrollTop` to resolve the pinned mission’s released document coordinate, including its inset. A top-aligned tall phone mission clamps to the release point so clicking cannot leave it partially masked. Active-section tracking uses the same coordinates. Other sections keep their ordinary document coordinates. Focusing any content control or destination immediately removes the mask and bypasses the portal until returning to the top; keyboard users and direct section navigation never have to wait for a visual transition. Water strokes never capture pointers. Native vertical scrolling, model gestures and pinch zoom remain available.

Reduced motion, missing CSS path support and no JavaScript use the normal page layout with fully exposed content. The existing static-model WebGL fallback can still serve as the portal origin when WebGL is unavailable. Hidden tabs stop queued visual work. A view restored beyond the hero starts with its content exposed. The intro remains bounded and does not wait for this effect.

## Checks

Scroll stability correction: layout dimensions and the artifact's local origin are cached on setup, viewport changes and observed content resizing. Scroll frames read the scroll offset and reuse those dimensions; after release they generate no mask paths or layout writes. The mask and edge now reuse one contour, with an SVG group translating the edge into viewport coordinates. A focus/navigation bypass expires upon reaching the fully open destination, allowing a continuous reverse reveal after interacting with sections. Backgrounding keeps the current mask instead of clearing it before restoration. The name strip pauses during masking to avoid two simultaneous moving surfaces. Unit regression cases cover focus-navigation arrival, interaction after release and interrupted navigation returning to the hero.

- `npm run typecheck`
- `npm test` (includes five geometry checks: bounds/overscroll, viewport coverage, reversible progress, edge/mask alignment and ripple bounds)
- `npm run build`
- With the site running, `npm run test:e2e -- tests/e2e/portal.spec.ts tests/e2e/dial-navigation.spec.ts tests/e2e/devices.spec.ts`

The portal browser cases cover native scroll opening, reversal, stationary mission geometry during opening, continuous release, renderer suspension, section links and reduced-motion keyboard access. Actual browser appearance, scroll feel, mobile toolbar resizing and real touch-device performance remain unverified in this environment because Chromium cannot launch (`setsockopt: Operation not permitted`). No browser passes, FPS figures or physical-device compatibility results are claimed.

The initial portal passed 54 automated unit/integration tests and the production build. The pinning correction additionally has regression cases for sticky/released navigation coordinates and a browser check for a continuous handoff. Playwright attempted the portal cases but failed at browser launch with `setsockopt: Operation not permitted`/SIGTRAP, before any browser assertion executed. Visual timing, sticky/mask rendering and device gestures still need browser-capable review.

Pinning-correction validation: all 57 unit/integration tests, type checking, formatting and the production build pass. New navigation tests verify stable released destinations throughout the pin, normal-flow fallback, and the tall-phone release boundary. The browser case now checks that the mission stays stationary during opening, the next section retains its document position, and release changes the mission position by less than 3px across the boundary. Chromium again failed at launch before these browser assertions could execute; visual smoothness remains unverified here.

Scroll-stability validation: production build (including TypeScript) and all 60 unit/integration tests pass. Browser verification was not completed: the Playwright CLI prerequisite failed with `ENOTCACHED` in offline mode. The previously recorded Chromium launch restriction also remains unresolved; no new visual smoothness or device-performance result is claimed.
