# ADR 0004: Simple painting recipes

Status: Accepted

## Decision

Offer `simple_recipe` alongside the existing `layer_study` and `illustrative` sequence styles.
Keep existing defaults and saved-session interpretations. The simple option is available for
photos and imagined subjects and survives the creator's “Just stick to basics” action.
It supports one to six short paint actions, a white background, one main subject, and a small
palette.

One image request produces two equal vertical panels on the existing 1536×1024 medium canvas:
a simplified finished watercolor and its matching tracing outline. A durable visual validation
checks the pair before publishing either asset. Rejection requires an explicit new preview;
it does not silently buy another image. The application crops each panel to 768×1024.
The outline's `stage_id` stores its paired target asset UUID (only for `tracing_outline` assets).
This ties an outline to one immutable candidate rather than whichever preview is newest.

After explicit preview approval, one compact structured text request generates the paint actions,
per-step pigment mixes, consistency, and paper/drying cues. The existing lesson content
contract is populated through a local adapter; no intermediate images or process board are
generated. Page text and swatches render in HTML and support browser printing. On phones the
painting and outline stack. Normal generated content fits one printed A4 page; unusually long
manual edits can continue onto additional pages rather than being clipped.

## Cost and reliability

The normal path is one image call, one visual-validation call, and one compact guidance call.
It is not a single total provider request. Models and image quality remain unchanged. Existing
call accounting, immutable run snapshots, idempotency, and durable checkpoints cover these
operations. Lower output complexity alone is not presented as a token discount.

Demo mode generates no artwork, clearly identifies generic guidance and shows the original
photo with a manual drawing suggestion. It never claims to have made a tracing outline.

## Verification boundary

Automated tests use synthetic image pairs and provider doubles. They verify workflow behavior,
pair association, crop geometry, compact response contracts, compatibility, and print/layout
bounds. Human review of the apple, pear, daisy, mug, and bird examples established the initial
attainability and outline-matching baseline; future generated subjects still require review.

## Recipe presentation refinement

Numbered instructions appear without step headings, beside compact everyday color labels and
swatches. Mixing formulas and consistency move to one section at the bottom. New guidance uses
short painting actions and everyday color names. Existing saved prose is preserved; recognized
color names are simplified for display only. Printing includes only the matching outline, fitted
proportionally to the full A4 printable area without cropping. Printing is disabled when no outline
exists.

## Approved next pass — September 9

Simple recipes now choose 1–6 instructions from the approved image. Other sequence modes
retain their five-step limit. Generated mixes contain 1–2 structured everyday paint colors
with positive parts, a short consistency cue, and a longer dilution explanation. The optional
`content.recipe.finishing` carries one independent action and mix; it is closed initially and
never requires another image. Older saved data can omit the metadata and mix extensions.
The main page omits overview/completion prose and puts consistency beside each quick swatch.

Print sizes measure detected ink (including faint highlight boundaries), with 2% safety padding.
Small/Medium/Large select a 4/6/8-inch longest subject dimension; Medium is the default.
A4 and Letter use 12 mm margins and automatic orientation. The UI reports the actual subject
size when fitting reduces it. Local canvas processing makes no generation request, never crops
ink, and blocks printing if the image is unavailable or no ink can be identified.

## Simple Recipe v1 reference locked — September 9

The user approved the revised apple template, including the larger painting beside its
instructions and a top Print Outline modal defaulting to Medium/A4. See
`../SIMPLE_RECIPE_V1.md` for the frozen standard, version compatibility, accepted subject
coverage, and regression workflow.
