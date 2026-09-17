# Wanderline Project State

Status: Current
Authority: Volatile project coordination state
Last reviewed: 2026-09-16

## Current milestone

The owner approved Garden Studio revision 04 and authorized application adoption. Active pages
now share paper A, Pigment edge controls, compact typography, and calm forms through
`apps/web/src/garden-application.css`. Feeling First's entire selector and the frozen Simple
Recipe/print presentation are protected exceptions. The reference remains at `?view=design-system`.
The color-mixing feature proposal remains reference-only; no backend or generation contracts changed.

The apple recipe template and the pear, single daisy, plain mug, and side-view bird examples are
approved. Simple Recipe v1 has a frozen reference fixture, versioned generation contracts, and
visual regressions. See `docs/SIMPLE_RECIPE_V1.md`.

## Current product truth

- Wanderline is a calm, paper-first drawing studio for beginners.
- The guided practice loop remains the primary product journey.
- Sketch critique and photo-to-lesson creation are optional tools.
- Local analysis is descriptive and uncertainty-aware; it is not an objective art grade.
- Curated style references are static, authored frontend content.
- Generated lesson artwork requires explicit preview approval before guidance generation.

## Recently completed

- Photo-to-lesson creation, editing, saving, reopening, and generation accounting.
- Simple recipe support with 1–6 instructions, compact everyday color labels, optional finishing guidance, and local outline print sizing.
- Curated five-style reference guide and responsive process sheets.
- Local geometric image breakdown and bounded synchronous sketch analysis.

## Acceptance complete

- Apple template and pear, daisy, mug, and bird recipes accepted by the user.
- Mug and bird saved at revision 4 with approved content unchanged.
- Removed the redundant “Your finished painting” caption from generated simple recipes.
- No remaining subject approval gates for this pass.

## Canonical artifacts

- Application UX and style: `docs/DESIGN_SYSTEM.md` (approved revision 04)
- Product requirements: `docs/PRODUCT.md`
- Architecture: `docs/ARCHITECTURE.md`
- Delivery plan: `docs/ROADMAP.md`
- Photo-to-lesson workflow: `docs/PHOTO_TO_LESSON.md`
- Simple recipe decision: `docs/decisions/0004-simple-painting-recipes.md`
- Historical apple review record: `docs/APPLE_RECIPE_REVIEW.md`
- Regression register: `docs/UI_REGRESSIONS.md`

## Active architectural/product decisions

- Keep browser, API, worker, PostgreSQL, Redis, and object storage behind explicit boundaries.
- Keep local sketch analysis bounded, deterministic, and synchronous for the current slice.
- Keep curated style content typed, static, and versioned with the frontend.
- Keep simple recipe generation compact, approval-gated, idempotent, and backward compatible.

## Verification status

September 13: The revised color-mixing reference passes frontend lint/types, all 38 unit tests,
the production build, and static validation (17.6 MB). All nine design-reference browser tests
pass, including every one of the 36 targets with an adjustment at 390/768/1440px and normal/200%
text, three-paint highlighting, family filtering, keyboard activation, and preserved instructions.
The new olive example was visually inspected in the live reference. This verifies the software
and layout, not the physical accuracy of recipes; an Emily Lex swatch review remains outstanding.

September 11: Garden Studio revision 02 passes frontend lint/type checks, 35 unit tests, all 31
browser tests, production build, and static validation (17.5 MB against a 45 MB budget).
The new browser coverage exercises six reference patterns at 390/768/1440px and 200% text,
local-only interactions, errors, selection, dialog focus, and reduced motion. Four additional tests
verify simultaneous title/artwork/instructions/mixes visibility at 1366×768, 1440×900, 1024×768,
and 768×1024 with body text at least 16px. Enlargement opens by keyboard and restores focus. Existing frozen
apple and print screenshots pass without baseline changes. Desktop examples and phone reference
were visually inspected. Application-wide migration remains pending owner review of the reference.

September 10: 91 backend tests, 28 frontend tests, 21 browser tests, lint/type checks,
backend formatting, production build, and static validation pass. Approved desktop/phone
screenshots and the print modal are protected by visual regression tests. The reviewed subject
set completed human approval without changing the frozen v1 contract.

## Recommended next task

September 13: Color construction layout proposal added to the live design reference's
**Color mixing** pattern. The owner accepted paint highlighting as a starting point and requested
families and three-paint mixes. The revised reference now contains 36 Emily Lex targets in ten
families, displaying only three to six shades at once. Olive green uses Lemon Yellow, Green Deep,
and Burnt Umber with numbered highlights and ingredient roles. Revised visual review remains
pending; instructions, adjustments, and save feedback still run only in the reference.
The owner subsequently requested visible vertical family options. The dropdown is replaced by
a ten-button family column beside the shade/mixing workspace; on phones the vertical list sits
above it. The selected family retains a pressed state, and selecting it again preserves the mix.
The requested production catalogs, API, and persistence are not yet implemented; visual
approval is the next checkpoint. Existing views and frozen Simple Recipe v1 remain unchanged.

Use the approved design contract for future UI work. No additional approval is needed to reuse
its patterns. Propose departures explicitly; preserve the documented selector and recipe exceptions.

Use the frozen reference and regression checks for future Simple Recipe changes. Introduce a new
recipe version for behavior that would change the approved v1 contract.

September 12: Revision 03 adds sage-led watercolor edge washes, painted-sheet dialogs, softly
painted controls, and larger reference artwork. Visual approval remains pending.

The owner prefers material A. Three control studies are now available at
`?view=design-system#design-control-comparison`; the owner selected option 2, Pigment edge, because the other options felt too harsh in color.
The preferred pairing is paper A with pale, green-edged controls. Consolidated reference review
and application migration approval remain pending.

Revision 04 consolidates paper A and Pigment edge across the current reference patterns.
Comparison studies remain below for context. Next: owner visual review of the combined result.

Revision 04 validation: 38 unit tests, 32 browser regressions, lint, TypeScript/build, and static
validation pass. Recipe fit, enlarged text, and frozen production screenshots remain intact.

Application adoption supersedes the historical pending-review notes above.

Adoption validation: lint, TypeScript/production build, static validation, and 38 unit tests
passed. All 32 existing browser regressions passed without changing screenshot baselines.
Six new adoption checks pass after correcting narrow-screen subject cards and enlarged-text
labels: selector style preservation and component reflow at 390, 768, and 1440px. Reflow checks
cover normal and 200% text across exploration, guides, Feeling First, Color Study, sessions,
settings, lessons, and creation. Local fixtures avoid paid generation calls.
