# Native Holocron integration

## Source and scope

The procedural implementation in `holocron-web.zip` (`holocron-web/holocron.js`) was inspected and extracted to a temporary directory. The ZIP remains unchanged in the repository. Its standalone HTML/demo and CDN import are not used. This is a native React/Three.js integration, without an iframe or React Three Fiber.

Discovery identified Next.js 16.4.1 App Router, React 19.3.1, TypeScript, npm, Vitest and Playwright. No rendering library was previously installed. Added `three@0.186.1` and development types `@types/three@0.186.0`, recorded in package-lock.json. All executable code and assets are bundled or self-hosted. No security header, CSP, database, registration, ticketing or authentication changes were required.

## Architecture and placement

The home page (`app/page.tsx`) now mounts `<HolocronExperience waitForIntro centered />` as a centered, full-viewport artifact presentation, per the subsequent design request. The opening viewport contains only the artifact. Navigation, organizer information, mission, domains, event brief, registration links and the cropped bottom wordmark are restored beneath it in `components/HomeSections.tsx`. The explicitly removed footer remains absent. `app/home.module.css` supplies the near-black background and subtle blue radial glow. Registration remains available at `/register`; its route and business logic are unchanged. The visible pause control was removed at the user’s request; system reduced-motion preferences remain supported. Registration routes do not mount the artifact.

- `components/holocron/HolocronExperience.tsx`: React lifecycle, dynamic import, visibility/media preference tracking, accessible controls and failure state.
- `HolocronScene.ts`: one transparent WebGL2 canvas, camera, lighting, rendering, performance adaptation and resource lifecycle.
- `HolocronModel.ts`: reusable procedural geometry and materials independent of React or the DOM.
- `motion.ts`: bounded, frame-independent hover/drag/inertia and activation state.
- `useHolocronInteraction.ts`: gesture capture, tap/drag separation, cursor feedback and keyboard controls.
- `HolocronFallback.tsx` and `holocron.module.css`: stable responsive composition, static image and interaction styles.
- `lib/intro-lifecycle.ts`: document-local completion signal from the existing cockpit intro. Normal completion, skip, failure, reduced motion and actual unmount release the artifact; Strict Mode cleanup does not prematurely release it.

The scene module is dynamically imported as soon as the stage intersects the viewport and the document is visible. A single fully lit GPU frame is prepared behind the intro; continuous motion waits for intro completion. No second loading gate is introduced. A static artifact is server-rendered immediately, so failed imports or unavailable WebGL do not leave a blank hero. Reusing the component elsewhere defaults to `waitForIntro={false}`; only opt into waiting where the existing Preloader is mounted.

## Geometry, appearance and customization

Bronze rails, beveled triangular insets, raised diamonds, concentric rings, blue panels, six repeated face assemblies and corner structures come from the supplied implementation. Geometry is cached during construction and static meshes are merged by material. There are seven static meshes and one separate animated inner mesh. This is a mesh count, not a measured GPU draw-call count; transparent double-sided materials can require additional passes.

Edit `HolocronModel.makeMaterials()` for metal/crystal color and surface response. Adjust camera/lights, pixel budget and adaptation thresholds in `HolocronScene.ts`; adjust idle speed, pointer tilt and 3.2-second activation envelope in `motion.ts`. The source's camera and initial orientation are retained. Regenerate the fallback after geometry or appearance changes:

```sh
node --import tsx scripts/render-holocron-fallback.ts
```

`public/media/holocron-fallback.webp` is a transparent 640px CPU-shaded projection of the actual mesh, with provenance in the adjacent JSON. It is not an unrelated illustration or a pixel-identical WebGL capture. The generator uses existing Sharp and local Three.js, without an external renderer or asset service.

The source is a geometric approximation of a Clone Wars Jedi Holocron. It has not been compared against licensed production reference imagery and is not claimed to be screen-accurate. Transparent surfaces retain the source's stylized treatment; there is no physical refraction/environment map. Batching also changes transparent triangle ordering, which needs visual review on target GPUs.

## Motion, accessibility and failure behavior

The prepared canvas replaces the fallback without a shading crossfade. Initial illumination and scale are already settled before the intro reveals it. Idle rotation, floating and pointer response are restrained. Fine pointers receive damped hover yaw/pitch, a slight lift and smoothly eased illumination. Mouse/pen dragging and horizontal touch gestures rotate the model with bounded pitch and short release inertia; native vertical touch scrolling and pinch zoom are preserved. Activation never triggers registration or navigation and ignores repeated clicks while active. The model returns to idle after the activation envelope.

Activation uses a real labeled button, accessible with Enter/Space and visible focus. Arrow keys turn the artifact; Home restores its orientation. Pointer hit testing uses the model’s oriented structural bounds instead of the full canvas. A six-pixel movement threshold separates click/tap activation from dragging. Drag-generated clicks are suppressed, and pointer capture, cancellation, focus loss and stale release velocity are handled. Canvas content is hidden from assistive technology. Status feedback is announced politely. There is no visible Pause/Resume control. Reduced-motion users receive a static orientation and on-demand rendering; activation briefly changes illumination without continuous movement. There are no CSS entrance fades.

Import/initialization/render/context-loss failures leave or restore the derived static fallback, remove the activation control and retain the surrounding content and CTA. Failed contexts are disposed rather than automatically recreated in a retry loop. A reload can attempt WebGL again. The viewport reserves space before initialization; the canvas and activation area are bounded by the existing artifact stage.

## Performance and lifecycle

- No post-processing, model downloads, external fonts or remote assets added.
- DPR capped at 1.75, with a 900,000-pixel initial render budget.
- After 120 measured visible frames, mean frame interval above 35ms lowers resolution to 70%; a subsequent mean above 65ms stops continuous idle rendering and retains on-demand interaction. These thresholds are implemented policy, not measured performance claims.
- One scheduled RAF at a time. Intersection/visibility changes cancel RAF offscreen or in hidden tabs; resume resets the clock to prevent jumps.
- Reduced motion draws only on visibility, resize, preference/control changes and activation-state changes.
- Frame delta capped at 50ms. No UA/mobile-device classification.
- Cleanup disconnects observers/listeners, cancels RAF/timers, disposes geometry/materials/render lists/renderer and releases the WebGL context. Async imports are guarded against unmount.

## Validation (16 October 2026)

- `npm run typecheck`: passed.
- `npm test`: 47 tests passed across six files, including existing registration/database/ticket/security tests and eighteen geometry, motion and mocked renderer-lifecycle tests.
- `npm run build`: passed after the final code changes.
- No ESLint/lint script is configured in this repository. Scoped Prettier formatting/checks are used; these are not a substitute for linting.
- Dependency installs reported zero vulnerabilities. A separate `npm audit --audit-level=high` could not reach the registry (`EAI_AGAIN registry.npmjs.org`); a fresh advisory check remains required.
- The development server started successfully on port 4202.
- Three Playwright scenarios were attempted but all stopped at Chromium launch: `setsockopt: Operation not permitted`, SIGTRAP. No page assertions ran. This is an environment limitation, not a passing browser test.

New `tests/e2e/holocron.spec.ts` covers activation by keyboard, absence of a pause button, direct registration-route access, reduced motion at 320/375/430/768/1024/1440/1920px, horizontal overflow, centered positioning, and WebGL-unavailable fallback. Run against a running server:

```sh
TEST_ORIGIN=http://127.0.0.1:4202 npm run test:e2e -- tests/e2e/holocron.spec.ts tests/e2e/visual.spec.ts
```

If needed set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to a compatible installed browser. The existing complete registration E2E suite additionally requires a configured disposable PostgreSQL database; see TESTING.md. Do not use production participant data.

Renderer lifecycle tests mock only the browser/GPU boundary; actual procedural geometry is tested. These establish scheduling/disposal/failure behavior but cannot establish shader compilation, visual correctness, real FPS or browser layout.

## Remaining release checks and improvements

Before deployment, run the browser suites in an environment that permits Chromium, review screenshots at all seven widths, inspect actual canvas appearance/transparent sorting, exercise mobile touch and keyboard controls, test hidden-tab suspension and import/network failures, and measure performance on representative GPUs. Check production CSP/console output and run the full registration browser regression suite. Refresh npm audit with registry access. No deployment or Git commit was performed.

Potential improvements after measurement: a GPU-rendered fallback for closer shading parity, licensed-reference geometry comparison, and per-face transparent batching if visual sorting requires it. Avoid adding rendering dependencies without evidence of a benefit.

The centered homepage layout is type/build checked; browser layout verification remains blocked by the Chromium environment restriction described above.

Latest handoff correction: preparation performs one real render, including shader initialization, behind the existing intro. Resizing while idle redraws that prepared frame. Early skips or slow module downloads may still show the fallback until the first GPU frame is ready; the intro is never extended to wait for 3D.

## Hero atmosphere

`HolocronAtmosphere.tsx` provides oversized metallic HOL0CRON lettering behind the artifact, radial backlighting, two restrained light shafts and ten embers. The floor-light line was removed at the user’s request. The previous circular field and arcs were removed at the user's request. Its CSS module scopes decoration to the opening viewport; it is hidden from assistive technology and does not capture pointer input.

The connected SVG wordmark now refracts through an SVG displacement filter. A small offscreen 2D canvas generates a local repulsion field and up to seven damped traveling ripples from fine-pointer movement. Resolution follows the wordmark’s rendered width (96–192 samples wide, with height matching the padded filter), limiting work on small canvases without assuming device capability from a user-agent string. A generated local PNG updates `feImage` at at most 30fps while the displacement is changing. This adds no network request or second WebGL context; the existing CSP permits the local data image. After the ripples settle, rendering stops. Leaving the text lets the field return to rest. Reduced motion, hidden tabs, offscreen content and unmount stop the effect and restore undistorted text. Primary touch input creates a softer ripple with at most four traveling waves. Passive listeners observe taps and drags without pointer capture or preventDefault; release, cancellation, scrolling and multi-touch release the field. Native vertical panning and pinch zoom remain available. The 3D model separately handles horizontal drag and intentional activation. Orientation/viewport resizing cancels the current model drag to prevent a jump from stale pointer coordinates. Failure to create/update the 2D field preserves the static text.

Embers use paused CSS animations, enabled only after intro completion while the hero is visible. No dependency was added. Type checking and the production build pass; actual browser rendering, filter compatibility and performance remain unverified because of the documented Chromium restriction.

Interaction refinement: the idle turn is slower and eases down during inspection. Hover primarily changes yaw/pitch, with minimal roll. Drag motion uses damped targets, bounded pitch and exponentially decaying release velocity. Touch scrolling, background tabs, reduced motion and context failure retain their previous safeguards. Six additional unit tests cover hover settling, inertia, pitch bounds, reset/reduced motion, oriented picking and suspended input. The browser suite includes empty-space clicks, mouse drag without accidental activation, keyboard turning and restoration. These new browser assertions remain unexecuted here because Chromium cannot launch in this environment; manual drag feel, touch panning and GPU responsiveness still need browser verification.

Responsive handoff: `tests/e2e/devices.spec.ts` adds phone tap/ripple settling, native CDP horizontal drag versus vertical swipe, organizer/content bounds at portrait/landscape widths, mandatory event details and 16px form-input checks. These browser assertions remain unverified in the restricted environment; see `docs/RESPONSIVE.md`. No device FPS or real hardware compatibility claims are made.
