# Responsive behavior

The homepage keeps its centered artifact and existing scrollable event sections. The event date, venue, eligibility and exactly-three-member requirement are unchanged. Registration, authorization and ticket issuance business logic are unchanged.

## Touch and animation

- The wordmark ripple responds to primary touch as well as fine mouse/pen input. Touch uses lower pressure, at most four waves and a slower drop cadence. Passive listeners do not capture pointers or cancel scrolling. Release, pointer cancellation, scroll and multi-touch release touch pressure. Hidden tabs, offscreen content and reduced motion reset the effect.
- The field resolution follows the actual wordmark size, from 96 to 192 horizontal samples; its height follows the padded filter aspect ratio. Rendering stays capped at approximately 30 updates/second and stops when the field settles. The neutral padding that prevents detached glyph fragments remains intact.
- Artifact horizontal dragging, activation and keyboard controls remain available. Vertical gestures and pinch zoom remain browser gestures. Resizing cancels a held artifact gesture before recalculating its coordinates. Existing WebGL rendering retains its pixel-budget/DPR cap, measured-cadence quality reduction, offscreen suspension and context-loss fallback; this pass makes no FPS claim.
- The existing bounded inline/muted preloader and synchronized portal/light reveal are preserved. Reduced motion skips the cinematic sequence and continuous effects. No skip or pause controls were reintroduced.

## Layout and reading

- The organizer lockup uses compact sizing below 375px, safe horizontal insets and a more readable chapter subtitle. Logos and names remain beside one another.
- Mobile navigation respects safe-area edges and opens a bounded menu. Existing wheel behavior, held click targets, keyboard navigation and resize cleanup remain intact.
- Form inputs use 16px text to avoid iOS focus zoom. Native browser zoom remains enabled. Mobile field labels, errors, consent text and progress labels are larger; actions stack on narrow phones and remain at least 44px targets.
- Confirmation headings wrap safely. Download actions stack, ticket previews keep the correct 5:3 aspect ratio, and the accessible HTML roster/event details remain below the preview. The PNG and PDF retain their independent high-resolution layout; tiny preview microtext should be read in the downloaded ticket or equivalent HTML details. Download anchors are temporarily attached to the document before activation for mobile-browser compatibility, then removed; object URLs are revoked afterward. The two previously removed ticket links remain removed.
- Existing single-column phone challenge cards, two-column tablet cards and responsive desktop spacing are preserved.

## Verification

Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e -- tests/e2e/devices.spec.ts tests/e2e/holocron.spec.ts tests/e2e/dial-navigation.spec.ts tests/e2e/archive-reveal.spec.ts`. The browser suites require a running application; the complete registration workflow additionally requires a disposable configured PostgreSQL database.

Browser cases cover 320, 375, 390, 430, 768, 1024, 1440 and 1920px widths plus short landscape. The new phone cases use actual touch input and Chromium native touch dispatch for scrolling/dragging, rather than substituting mouse gestures. Existing suites cover reduced motion, unavailable WebGL, registration and QR/export behavior.

Real iOS Safari, Android Chrome, hardware performance, visual browser screenshots, native pinch zoom and orientation/keyboard behavior require device review. Chromium launch is blocked here by `setsockopt: Operation not permitted`, so browser assertions and real-device behavior must not be treated as verified.

Validation for this pass: all 49 unit/integration tests, type checking, production build and formatting checks passed. Playwright discovers the three new device cases, but execution stops at Chromium launch (`setsockopt: Operation not permitted`, SIGTRAP) before any browser assertion runs. No screenshots, touch performance figures or real-device passes are claimed.

The subsequent `HolocronPortal.tsx` integration adds a scroll-derived liquid entrance from hero to mission. It uses existing geometry as the origin, does not intercept native input and fully bypasses the sticky/masking enhancement for reduced motion or unsupported clipping. The pinned mission uses its released document coordinate for navigation; remaining content stays in normal flow. Fully covered model/wordmark rendering suspends. Browser scroll, visual and toolbar-resize checks remain unverified; see `HOLOCRON_PORTAL.md`.
