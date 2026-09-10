# UI Regression Register

Status: Current
Authority: Project-wide UI invariants and regression record
Last reviewed: 2026-09-09

This file records recurring visual failures that must remain fixed across Wanderline.
Treat these checks as project-wide layout invariants, not page-specific polish.

## R-002: Content clipped inside rounded cards

**Status:** Guarded by Playwright

**Observed:** Twice, most recently in the Feeling First emotion panel. At narrow or
enlarged-text layouts, headings and paragraphs extended beyond the card's usable width.
The card used `overflow: hidden` for its rounded artwork frame, so the excess content was
silently cut off instead of producing obvious page-level horizontal scrolling.

**Root cause:** A responsive grid switched to a bare `1fr` track. Its automatic minimum
allowed long or enlarged content to make the track wider than the containing card.
Page-level `scrollWidth` assertions did not detect clipping inside the overflow boundary.

**Permanent rules:**

- Responsive grid tracks containing prose use `minmax(0, 1fr)`.
- Grid and flex children that contain copy have `min-width: 0`.
- Text containers and their direct children cannot exceed the visible container bounds.
- Long headings, medium labels, body copy, prompts, and actions must reflow without being
  hidden, truncated, or cut off.
- Responsive QA includes narrow widths and 200% text sizing.
- Variant-driven panels are checked with every variant, not only the default or shortest copy.
- Do not rely only on document-level horizontal-overflow tests; compare descendant bounds
  with the component's own visible boundary and check component `scrollWidth`.

**Automated guard:** `apps/web/e2e/style-studio.spec.ts`, test
`Feeling First copy remains inside its panel with enlarged text`.

## R-003: Emotion controls separated from the artwork

**Status:** Guarded by Playwright

**Observed:** The Feeling First selector occupied a large editorial block above the artwork.
Changing an emotion required scrolling up to the control and back down to see the result.

**Permanent rules:**

- Controls that directly alter a visual preview stay spatially attached to that preview.
- The Feeling First selector remains compact and sticky while its gallery is in view.
- Changing a feeling brings the artwork back into view automatically; reduced-motion users
  get the same behavior without smooth scrolling.
- The gap between the selector and artwork stays at or below 20 CSS pixels.
- At common phone and desktop sizes, the artwork begins within the initial viewport.
- Sticky feature controls must account for persistent global navigation and must not overlap it.

**Automated guard:** `apps/web/e2e/style-studio.spec.ts`, test
`Feeling First keeps its compact selector attached to the artwork`.

## R-004: Tracing print disabled by a cached image response

The display image may be cached without CORS headers before the tracing canvas requests it.
Do not prepare a canvas by reusing that cross-origin image response. Fetch the outline with
`cache: no-store`, decode a local blob URL, and revoke it on cleanup. Abort requests on unmount.
Keep loading/error feedback visible and provide a retry action. The browser regression supplies
CORS headers only for the fetch, not the ordinary image, and verifies a one-page outline print.
Verified against the saved apple in the live local app as well as mocked browser tests.
