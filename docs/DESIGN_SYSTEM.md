# Garden Studio design system

Status: Current — revision 04 approved; application styling adopted
Authority: Approved application UX and visual design contract
Last reviewed: 2026-09-16

## Start here

Wanderline is an expressive Garden Studio: warm paper, botanical colors, pigment washes,
organic shapes, and an encouraging voice. The frame invites exploration through tactile materials; the workspace gives content room.
Titles provide quiet orientation rather than occupying hero sections. **Remove before adding.** Personality must not become extra panels,
extra prose, or extra steps.

Open the [live reference](http://localhost:4173/?view=design-system) after running
`npm --prefix apps/web run dev -- --host 127.0.0.1 --port 4173` from the repository root.
On another host or base path, append `?view=design-system` to the application URL.
The reference is available by direct link, outside everyday navigation. All examples use local
data and artwork. Its save/retry controls are demonstrations with memory-only state, not API calls.

The owner approved paper A and Pigment edge controls and authorized application adoption.
The live reference and this contract guide future UI work. Shared production styling is in
`apps/web/src/garden-application.css`, loaded after the existing feature styles. Keep feature-specific
layout and art data separate from shared control and typography rules.

**Protected exceptions:** the complete Feeling First selector stays unchanged, including its
slider, labels, appearance, sticky placement, and artwork scrolling. The frozen Simple Recipe
v1 presentation, content, assets, and printing also remain unchanged. The compact recipe is an
opt-in reference example. The color-mixing proposal remains a reference-only feature.

## Identity and foundations

### Color roles

Use semantic roles in components; define pigment values only in `src/themes/garden-studio.css`.
Keep the current palette. Content colors (paint mixes and art palettes) are data, not UI tokens.

| Role | Token / current color | Rule |
| --- | --- | --- |
| Page | `--surface-page` / #f1efe6 | Warm canvas behind the work |
| Panel | `--surface-panel` / #fbf8ee | Quiet paper surface |
| Main text | `--text-primary` / #29302d | Body and headings |
| Secondary text | `--text-secondary` / #5c655f | Hints and supporting detail; never low-opacity text |
| Primary action | `--interactive-primary` / #285747 | Green text and edge on pale sage; stronger lower edge |
| Selection | Pale sage + green text and edge | Underline plus pressed/selected semantics |
| Coral | `--theme-accent` / #d97666 | Expressive accents; dark coral for text/errors |
| Gold | `--theme-highlight` / #e0ad40 | Pigment detail, never small white-on-gold text |
| Blue / plum | `--theme-info`, `--theme-reflective` | Supporting information and reflective accents |
| Borders | `--theme-border` | Decorative separation only |
| Control border | `--garden-border-control` / #7a857e | Visible input/control boundary |
| Error | `--garden-error`, `--garden-error-surface` | Explicit error message plus coral surface |
| Success | `--garden-success`, `--garden-success-surface` | Explicit success message plus green surface |
| Art stage | `--garden-stage`, `--garden-stage-text`, `--garden-stage-muted` | Dark artwork enclosure; controls remain on paper |

Use one primary action in each active task area. Accent colors do not denote competing primary
actions. Rich artwork is not a reason to introduce unrelated interface colors. Gradients or
translucency may decorate pigment shapes, never reduce the legibility of text or focus indicators.

### Type, space, and shape

- Body: Avenir Next → Avenir → Segoe UI → system sans. Display: Iowan Old Style → Palatino → Georgia.
  Preserve system fallbacks; no new downloaded fonts. Set body copy at 1rem, line height 1.5–1.6.
- Page titles: 1.5–1.75rem (24–28px); section headings: 1.125–1.375rem (18–22px).
  Use a compact heading row near relevant actions. Remove oversized mastheads, repeated
  introductions, and decorative subtitles. The reference compact recipe uses a 1.5rem title;
  production recipes retain their frozen presentation until a separately approved migration.
- Serif headings use weight 500–600, line height 1.1–1.2, and restrained negative letter spacing.
  Body weight is 400–500; controls and labels 650–750. Eyebrows are optional, .75rem uppercase;
  do not repeat the title in an eyebrow. Body lines should usually stay within 45–65 characters.
- Spacing tokens in rem: .25, .5, .75, 1, 1.5, 2, 3, 4 (4–64px at default text size).
  Use 8–12px within a control group, 12–16px between related items, 12–16px panel padding,
  and 24px between reference sections. Keep heading padding to 8–12px. Reduce framing before
  reducing artwork or text, and allow content-driven reflow.
- Corners: 12px controls, 18px panels, 24px expressive frames, expressed as rem tokens.
  Organic contours belong to pigment swatches and decorative washes, not input hit areas.
- Borders are thin and quiet. Use `--garden-shadow-panel` for a distinct framed surface only;
  do not stack shadows and nested cards to manufacture hierarchy.
- Motion: 160ms color/border transitions. No decorative loops, parallax, or layout motion.
  Honor reduced motion; no action or information depends on animation.

### Expression boundaries

Use material A: warm paper with fine grain and only faint sage traces at the outer sheet edge.
Keep nested panels, headings, and input interiors clear. Do not repeat multicolor washes on
buttons or behind content. Personality comes from paper, typography, and the artwork itself.
Pigment-shaped swatches remain appropriate when they represent actual paint colors.

Use Pigment edge controls: pale sage primary and selected actions, green labels and borders,
and a stronger lower edge. Secondary actions use paper interiors; quiet actions remain text.
Selections include an underline and pressed semantics. Fields use a clear paper interior and
an understated lower border. Preserve visible focus, minimum target sizes, and error messages.

The local paper texture requires no generated images or external downloads. Artwork stages
can retain their atmosphere, including Feeling First's darkness, while controls remain on paper.
The comparison studies below the live reference preserve earlier experiments for context;
revision 04 is the current consolidated proposal and supersedes their expression rules.

## Approved patterns

The live reference demonstrates the approved page patterns. The production adoption covers
Explore/teaching guides, artwork stages, sessions, creation/review/editing, lessons, and usage.

| Pattern | Composition and behavior |
| --- | --- |
| Explore / teaching entry | Compact heading, one main action, artwork immediately below; no introductory feature-card wall. Long teaching content follows the reference or uses optional disclosure. |
| Artwork with controls | Compact controls immediately adjacent to the preview; preserve the user's selection. Controls remain keyboard accessible. In a full feature page, keep them sticky during viewing, account for navigation, and bring changed artwork into view. |
| Focused lesson | Complete artwork beside concise numbered actions, with enlargement available in the compact reference; stack on phones. Reuse the actual Simple Recipe renderer and frozen fixture. Keep swatches adjacent, mixing below, optional detail closed, print controls in the existing dialog. |
| Session collection | Clear title and primary action, compact filters, artwork/title/status/action per item. One helpful empty state, no duplicate calls to action inside every surrounding section. |
| Form / dialog | Visible labels, one brief hint if useful, error beside its field; keep values after an error. One primary submit. Put secondary decisions in an accessible dialog with an explicit close, Escape support, contained focus, and focus restoration. |
| Settings / usage | Calm heading, a small set of meaningful figures, filters beside results, semantic tables. Explain unknown data plainly; avoid promotional language and oversized hero layouts. |

Shared implementations live in `src/garden-ui.tsx`: `GardenButton` and `GardenLink` expose
`primary`, `secondary`, and `quiet` variants; `GardenHeading` exposes heading level and expressive
framing; `GardenInput` connects labels/hints/errors; `GardenSelect`, `GardenChoices`, `GardenNotice`,
and `GardenEmpty` handle recurrent interaction states. Compose these before adding abstractions.
Use the existing `StudioDialog` for modal behavior. Native inputs, selects, buttons, and links
remain the underlying controls. Link means navigation; button means an action.

`PaintingRecipeSheet` accepts an optional `actions` slot and `presentation="compact"` for the
reference. The default `standard` presentation and production actions are unchanged. The compact
variant adds a keyboard-accessible artwork enlargement dialog with Escape dismissal and focus
restoration. `StudioDialog` accepts an optional `className` to apply the reviewed surface treatment
only where requested; existing dialogs retain their presentation.
The reference imports the frozen fixture and resolves its artwork to bundled local assets.

## Voice

Warm and direct. Encouragement comes from approachable actions, not repeated reassurance.
Use everyday terms, short sentences, and verbs in action labels. Reserve an occasional poetic
invitation for an exploratory opening, never routine controls, costs, errors, or loading states.

| Situation | Use | Avoid |
| --- | --- | --- |
| Invitation | Choose something that catches your eye. | Welcome to your sanctuary of endless inspiration… |
| Empty | No saved paintings yet. Start a painting to save it here. | A magical creative journey is waiting to unfold. |
| Loading | Loading your sessions… | Gathering your inspiration… |
| Error | Your sessions couldn’t load. Try again. | Something went wrong on your creative journey. |
| Success | Painting saved. | You took another wonderful step on your journey! |
| Guidance | Let the wash dry before adding the next color. | Pause and embrace the patient rhythm of watercolor. |

Do not rewrite frozen/generated lesson content as a copy cleanup. Apply voice rules to application
chrome. Changes to generated guidance belong to a separately reviewed generation contract.

## Access and responsive acceptance

- The short apple recipe must show its title, complete uncropped artwork, all three instructions,
  and every mixing description simultaneously at normal text size at 1366×768, 1440×900,
  1024×768, and 768×1024 browser viewports. These are viewport sizes, not physical device sizes.
- Select a page pattern to align its example into view. The current navigation scrolls normally;
  the example clears the viewport top by 12px. Any future sticky navigation must be included in
  this space budget. There is no nested recipe scroll area.
- Compact recipe body text remains at least 16px. Keep balanced, prominent contained artwork with on-demand
  enlargement; reduce decorative space before shrinking reading text. Longer recipes, phones, and 200% text may naturally
  scroll; never hide mixing details, truncate copy, or crop the artwork to force a fit.

- Minimum control target 44px; labels remain visible. Use a 3px focus outline with 4px offset.
  Use text and semantics alongside status colors. Target 4.5:1 normal text and 3:1 large text,
  focus indicators, and essential component boundaries.
- Grids containing copy use `minmax(0, 1fr)` and children use `min-width: 0`.
  Do not fix overflow by clipping text. Imagery may be framed; important artwork must not be cropped.
- At 390, 768, and 1440px and 200% text, verify descendant bounds, not only page scroll width.
  Include every content variant and empty/loading/error state. Tables may use labeled horizontal
  scrolling; prose and controls may not silently truncate.
- Preserve all invariants in `UI_REGRESSIONS.md`, including attached artwork controls and
  Simple Recipe printing. The reference artwork example embeds in a long documentation page;
  the first-viewport artwork rule applies to production feature pages, not the document masthead.

## Adoption and future work

### Color construction proposal — pending owner review

The live reference now includes **Color mixing** in Page patterns. This is a layout-only
proposal with 36 Emily Lex targets and memory-only feedback; it does not enable the
production feature or change the Simple Recipe contract. Paint names and chart order come
from the owner's supplied 18-color card. Screen colors are illustrative; the sample guidance
has not been tested with these paints.

The owner accepted the highlighted-paint approach as a starting point and requested color
families to avoid clutter, broad spectrum coverage, and mixtures of up to three paints.
The owner subsequently requested a vertical stack instead of a dropdown. The revised reference
uses ten always-visible family buttons in a left column and shows only that family's three to six
named shades. Ten families span reds, oranges, yellows, greens, teals, blues, purples, pinks,
browns, and grays. These are authored directions to try, not a measured gamut or exhaustive
list of achievable mixtures. One- and two-paint recipes remain useful; three paints are a
maximum, not a requirement. Olive green demonstrates Lemon Yellow, Green Deep, then a tiny
touch of Burnt Umber. Numbered palette highlights correspond to each ingredient's mixing step,
amount, and role. Water guidance stays separate. Recipe content lives in a typed, versioned
example catalog; no screen-color interpolation determines ingredients or proportions.

The proposed composition keeps this compact family/shade chooser above a two-column workspace:
target wash and labeled palette on the left, numbered mixing instructions and test adjustments
on the right. Used paints have a border and explicit order text. Notes and one primary save action
follow the instructions. At narrow widths the sections stack, and the palette changes to three
columns, and the vertical family list stacks above the workspace on phones. Family options
remain a vertical list at every width, with pressed semantics and colored chips. The left column
spans both shade selection and mixing content so it does not push the instructions down on desktop. Adjustment history is optional disclosure;
the current next step remains visible. Selecting the active shade again preserves work; changing
shade or family resets example adjustments and notes.

Owner review is required for this composition before production implementation. Approval of
this feature proposal does not imply approval of application-wide Garden Studio migration.
After approval, the production plan adds reviewed recipes for two confirmed palette
presets, editable pan arrangement, and learner-scoped saved mixes with optimistic revisions.

General teaching reference: [Jane Blundell on two- and three-color mixing](https://danielsmith.com/artists/insights/jane-blundell-the-ultimate-watercolor-mixing-selection/).
That reference uses other paints and does not validate the Emily Lex formulas or amounts.

1. Review the written contract and live examples with the owner. Record requested changes here
   and iterate until the reference is approved.
2. Migrate all active query views: Explore, teaching guides, Feeling First, Color Study, sessions,
   lesson creation/target/build/review/saved rendering, watercolor lessons, and settings. Preserve
   current routing and data flow. Archived source is excluded; no selectable themes are added.
3. Replace duplicated structural styles with shared patterns. Do not hide information without
   keeping it available where needed. Preserve Simple Recipe v1 content, imagery, generation, and print. Its existing production layout
   remains frozen while the opt-in compact layout is reviewed.
4. Check frontend lint/types/tests/build/static budget and browser regressions with local fixtures.
   Review intentional screenshot differences. Never update frozen baselines just to pass tests.
5. Update the live and written reference together when a pattern changes. A new pattern or
   departure from an approved one requires a concrete proposal and owner approval **before** use.
   Reusing existing patterns requires no repeated permission.

For every future page, identify its pattern, primary action, useful first-viewport content, optional
detail, state handling, and mobile layout. Inspect its rendered result against the reference. If
the design requires another explanatory paragraph or panel, first try removing or combining one.

### Revision 02 — confirmed owner feedback

Keep the palette, serif/sans pairing, and warm direct voice. Make headings secondary to content.
Add watercolor-paper and pigment texture to paper surfaces and accents while keeping inputs clear.
Fit the complete short recipe on desktop and iPad viewports, with artwork enlargement and natural
scrolling when longer content or enlarged text needs more space. These requested revisions are
implemented in the reference; the revised visual result is still pending approval.

### Review checklist

- [x] Pigment framing has the right amount of personality.
- [x] Focused pages remain sparse and useful.
- [x] Typography, controls, examples, and voice capture the intended identity.
- [x] The owner approves application-wide migration against this reference.

Only after this checklist is accepted should the document status change to Current.

### Revision 03 — historical experiment, superseded by revision 04

The owner requested more visible watercolor character, using Color and materials as the visual
anchor. Use one shared sage-led edge wash with restrained gold and coral blooms, fading toward
clear content areas. Establish this treatment before proposing page-specific variations. The
local `painted-paper.svg` adds deterministic translucent pools and uneven pigment edges.
Dialogs resemble painted sheets with subtly irregular corners; inputs retain clean interiors.
Buttons use softly irregular corners, grain, and pigment pooling: richer sage for primary and
selected controls, lighter washes for secondary controls, minimal decoration for quiet actions.
Selected controls also have an underline; focus outlines and 44px targets stay unobstructed.
No animation, clipping, or altered hit areas are used to create painted edges.
The reference apple is enlarged by roughly 50% at landscape target heights, with the complete
image, all instructions, and mixing descriptions retained. Production presentation is unchanged.
These changes remain pending visual approval; application migration has not begun.

### September 16 — material comparison, pending choice

Revision 03's repeated multicolor blobs were rejected as flat and distracting. The reference
now offers two side-by-side material studies at `#design-material-comparison`: warm paper with
faint pigment traces, and a continuous sage watercolor wash. Both use identical artwork, copy,
single-color buttons, a field, and an interactive dialog. Neither is approved. The comparison
sits on neutral paper; older examples remain available below as historical review context.
Choose the atmosphere before applying it throughout the reference or application.

### Preferred material and control exploration

The owner prefers material A (warm paper with faint paint traces) over B. This selects the
surface direction, not approval for application migration. The next review is at
`#design-control-comparison`: soft pigment, pigment edge, and ink-and-paper controls, all on
the same quiet paper. Each includes actions, pressed selections, a text field, a select, and
a disabled action. State is mirrored for a fair comparison; nothing persists. The owner selected option 2, Pigment edge: pale interiors, green text, and a stronger green
edge. Dark green filled controls in options 1 and 3 felt too harsh. Pair these controls with
material A; avoid multicolor motifs and large dark fills on individual controls. This records
the preferred pairing; the consolidated reference still needs review before application migration.

### Revision 04 — consolidated reference

Paper A and Pigment edge controls are now combined across all current reference patterns,
including the color-mixing proposal. Pale primary/selected controls have green text, a green
border, and a stronger lower edge; selections also use an underline. Secondary actions retain
paper interiors. Fields use the selected understated lower-border treatment and clear interiors.
Keep paper grain at the page/sheet level, with only faint sage traces. Remove multicolor blobs
from headings, controls, forms, and dialogs; do not repeat washes in nested panels. Artwork and
actual paint swatches retain their colors. The dark artwork stage and larger compact recipe
remain intact. Earlier comparison studies are retained below the current reference.
The pairing was selected by the owner; this consolidated rendering still awaits visual approval
before production migration. Production recipe content, presentation, and printing are unchanged.

## Production adoption

Use the approved paper and control styles in `garden-application.css`. This shared layer is
scoped to the active studio shell; archived surfaces are excluded. Its exclusions protect the
entire Feeling First selector, frozen recipe descendants, and design comparison studies.
Navigation and data flows remain unchanged. Headings are compact; forms use clear interiors;
selected controls pair pale pigment with underlines and semantic state. User-facing loading
and collection copy is direct. The existing accessible dialog handles focus and dismissal.

Browser coverage compares the Feeling First selector's rendered styling with the adoption
layer enabled and disabled at phone, tablet, and desktop widths. Frozen recipe/print screenshot
baselines remain unchanged. Future changes must preserve these guards. Earlier revision notes
below/above are historical; this approved contract takes precedence over their review status.
