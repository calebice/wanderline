# A Red Apple — Simple Recipe Review

Status: Historical
Authority: Completed reference-review record
Last reviewed: 2026-09-10

This record summarizes the review that established the first approved Simple Recipe v1 example.
The current implementation contract lives in `docs/SIMPLE_RECIPE_V1.md`; use this document only
when investigating why the apple reference changed.

## Review goal

Confirm that a true beginner can move from a finished watercolor example to a matching tracing
outline and a short set of paint actions without advanced terminology or unnecessary detail.

## Changes accepted

- The finished apple uses a pale red base, a broader dark-red shadow, a brown stem, and a reserved
  white highlight without the earlier yellow dimple.
- The matching outline includes the contour, stem, highlight boundary, and the minimum interior
  boundaries needed to begin confidently.
- The interface places the finished painting beside numbered instructions and compact color
  references, with mix formulas and consistency guidance below.
- Instructions use everyday color names and short direct actions instead of pigment-specific or
  advanced watercolor vocabulary.
- Print Outline opens an accessible size chooser, defaults to Medium (6 in) on A4, and fits the
  measured outline proportionally inside the printable page.
- Saved content remains revision-protected, and opening or printing a lesson does not trigger
  generation work.

## Final decision

The apple painting, outline, instructions, responsive layout, and print behavior were approved on
September 9, 2026. Its note-free content and matching images are frozen under
`apps/web/e2e/fixtures/simple-recipe-v1` and protected by visual regression tests. Later pear,
daisy, mug, and bird reviews confirmed the same contract across different subject shapes.

No further apple-specific review is pending. Future changes must update the versioned contract or
introduce a new recipe version rather than silently changing Simple Recipe v1.
