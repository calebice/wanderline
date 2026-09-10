# Simple Recipe v1

Status: Current — standard and all reviewed subjects approved
Authority: Frozen experience and generation contract
Last reviewed: 2026-09-10

## Approved reference

A Red Apple — Simple Recipe is the approved reference for this contract. The note-free fixture in
`apps/web/e2e/fixtures/simple-recipe-v1` contains the accepted content, painting, and outline, with
image SHA-256 hashes in its manifest. Approval as a reference does not rewrite existing saved
lessons that predate recipe versioning.

## Experience contract

- Show the finished painting prominently beside one to six numbered paint actions; stack the
  layout on phones.
- Put an everyday color name, swatch, and short consistency cue beside each action.
- Put mixing proportions below the actions; omit materials, introductory prose, and completion
  prose from the compact recipe.
- Allow at most one closed-by-default “Try a little more” action. The main steps must reproduce the
  basic example without it.
- Open Print Outline from the top of the recipe in an accessible modal, initially Medium (6 in) on
  A4. Print only the outline, fit measured ink bounds proportionally, and report the actual size if
  the page requires a reduction.
- Use no stage headings and no more than two paints per mixture. Reuse base paints at different
  water strengths and place necessary drying cues in the relevant action.

## Generation and compatibility

`simple-recipe.v1` freezes the art, visual-validation, and compact-guidance prompts in
`app/simple_recipe.py`. Keep those prompts immutable and introduce a new contract for future
behavior changes.

New generation snapshots pin the recipe version, and generated content records it in optional
`recipe.version`. Missing versions remain legacy/untracked and resolve to the frozen
pre-versioning contract. Unsupported versions fail before provider work. These additive JSON
fields require no endpoint rename or schema migration. Durable operations, usage accounting,
explicit preview approval, idempotency, and retry rules remain in force.

## Accepted subject coverage

| Subject | Accepted result | Known acceptable simplification |
| --- | --- | --- |
| Red apple | Three short actions with light red, dark red, and brown | White highlight remains unpainted |
| Pear | Three actions using green and brown | Drying advice may remain in the move-on cue |
| Single daisy | Gray petal shadows, yellow center, and green stem | Small center dots need not be described separately |
| Plain mug | Three blue strengths and a reserved white shine/rim | Tonal wash variation need not become another action |
| Side-view bird | Brown strengths with a brown/gray accent mix | A very pale throat patch may remain unpainted |

The examples demonstrate different silhouettes, proportions, light areas, and palette sizes. They
do not guarantee semantic agreement between arbitrary generated artwork and instructions; that
remains an explicit human review step.

## Acceptance checklist

1. The subject is recognizable through large, easy shapes and few colors.
2. The painting and outline are complete, sparse, and clearly matched, including reserved whites.
3. Every basic painted area can be made from the listed actions and mixtures.
4. Necessary drying cues, paint names, and consistency descriptions are easy to understand.
5. Any optional enhancement is unnecessary to match the basic example.
6. The page, modal, and printed outline remain usable on phones and with enlarged text.

Automated schema checks enforce counts and references, and visual validation checks the generated
pair. Semantic instruction/artwork matching requires human review. The frozen apple is a reference,
not proof for every future subject.

## Regression workflow

Run backend tests, frontend unit tests, and the Playwright suite without paid calls. The
`simple-recipe-v1.spec.ts` tests load local fixtures and compare approved screenshots. Run visual
checks on the same OS and browser version, review every changed image, and never use
`--update-snapshots` merely to make a failure pass.

Broader browser and print-unit checks cover 200% text, A4 and Letter, wide and square subjects,
proportional fitting, and the guarantee that reopening a lesson or opening print controls performs
no write request.
