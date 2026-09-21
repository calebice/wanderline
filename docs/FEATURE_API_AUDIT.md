# Feature and API Audit

Status: Current
Authority: Consolidation disposition and removal ledger
Last reviewed: 2026-09-20

## Baseline and method

The consolidation began from a clean checkout with healthy Compose services, **91 passing backend
tests**, **38 passing frontend tests**, and a passing frontend type check. Evidence was collected from
the React routes and calls, FastAPI route table/OpenAPI, SQLAlchemy models and migrations, worker
queue handlers, object keys, tests, documentation, and repository references.

Disposition vocabulary: **retained** is production product scope; **internal/reference-only** is not
normal navigation; **removed** completed its export/removal gate; **unimplemented promise** was
documented but not shipped; **active** describes the consolidated surface.

## User surfaces and routes

| Surface / durable route | Evidence | Classification | Disposition / compatibility | Removal release |
| --- | --- | --- | --- | --- |
| Home `/` | `StudioHome`; lists all painting lessons | active, retained | Ready generated-reference carousel, unfinished-work recovery, Start painting, exploration | — |
| Explore `/explore` | `StyleGuideGallery`, static typed catalog | retained | Keep; subject/style query state is bookmarkable | — |
| Style guide `/explore/styles/:style` | five authored guides and local WebP assets | retained | Keep | — |
| Feeling First `/explore/feeling-first` | protected selector and gallery | retained | Keep entire selector unchanged; preserve `emotion` | — |
| Color Study `/explore/color-study` | local interactive palette | retained | Keep | — |
| Lemon lesson `/explore/watercolor-lesson` | canonical bundled lesson | retained | Keep | — |
| Color mixing `/color-mixing` | production catalog/trial API | active, retained | Promote approved composition; label recipes illustrative | — |
| Sessions `/sessions` | painting lesson list and discarded-session controls | active, retained | Standardize visible term; support restore and explicit permanent deletion | — |
| New session `/sessions/new` | `LessonCreator` dialog | retained | Keep; persistence/API keeps lesson naming | — |
| Session `/sessions/:id` | `SavedLessonView` | retained | Keep | — |
| Edit `/sessions/:id/edit` | `LessonEditor` | retained | Keep | — |
| Target `/sessions/:id/target` | `LessonTargetReview` | retained | Keep | — |
| Build `/sessions/:id/build/:runId` | `LessonAssembly` | retained | Keep `next=target|review` | — |
| Usage `/settings/usage` | provider usage summary | retained | Keep | — |
| Design system `/internal/design-system` | live Garden Studio reference | internal/reference-only | Keep outside primary navigation | — |
| Legacy `/?view=…` bookmarks | redirect map in `style-lab.tsx` | deprecated URL form | Redirect with lesson/run/style/subject/emotion state preserved | next release after redirect telemetry review |
| Drawing dashboard/curriculum | archived React source only | orphaned but functional | Retire; no production route | stale source removed now |
| Generic exercise/practice/library/progress UI | archived React source only | removed | Source, APIs, persistence, and tests removed after export | complete |
| Sketch critique/upload | archived React source plus former API | removed | Records/objects exported; feature and storage type removed | complete |
| Image decomposition/digital exports | archived React source plus former API | removed | Records exported; feature removed | complete |
| 3D scene studio/configuration | documentation and archived source; no current route/API | unimplemented promise | Remove from current claims | no runtime removal |

## HTTP operations

All current paths are verified against FastAPI. The removed drawing-era operations are absent from
OpenAPI and return 404.

| Operation(s) | Classification | Evidence / replacement | Removal release |
| --- | --- | --- | --- |
| `GET /health/live`, `GET /health/ready` | retained | service health and database readiness | — |
| `GET /api/v1/color-mixing/catalog` | active, retained | versioned 36-recipe Emily Lex catalog | — |
| `GET, POST /api/v1/color-mixing/trials` | active, retained | learner-scoped history and creation | — |
| `PUT /api/v1/color-mixing/trials/{trial_id}` | active, retained | optimistic `expected_revision` updates | — |
| `GET, POST /api/v1/color-mixing/swatches` | active, retained | learner-private physical swatch library and multipart creation | — |
| `GET, PUT, DELETE /api/v1/color-mixing/swatches/{swatch_id}` | active, retained | read, optimistic metadata update, and confirmed permanent deletion | — |
| `PUT /api/v1/color-mixing/swatches/{swatch_id}/image` | active, retained | private physical-swatch photo replacement with optimistic revision | — |
| `GET /api/v1/color-mixing/swatches/{swatch_id}/image` | active, retained | authorized normalized swatch display image | — |
| `POST, GET /api/v1/painting-lessons` | retained | create/list painting sessions | — |
| `GET /api/v1/painting-lessons/capabilities` | retained | provider availability | — |
| `GET, DELETE /api/v1/painting-lessons/{lesson_id}` | retained | open or safely discard a session; discarding initially preserves usage history | — |
| `POST …/{lesson_id}/restore`, `DELETE …/{lesson_id}/permanent` | retained | restore from Discarded or explicitly erase session, objects, runs, and usage | — |
| `PATCH /api/v1/painting-lessons/{lesson_id}/brief` | retained | edit creation brief | — |
| `POST /api/v1/painting-lessons/{lesson_id}/references` | retained | private reference upload | — |
| `PATCH …/references/{asset_id}/primary`, `DELETE …/references/{asset_id}` | retained | choose/remove reference | — |
| `POST …/{lesson_id}/target-generations`, `POST …/{lesson_id}/target` | retained | generate and approve target | — |
| `POST …/{lesson_id}/generations`, `POST …/{lesson_id}/stage-generations` | retained | full/checkpoint generation | — |
| `POST …/{lesson_id}/sections/{section_key}/generations` | retained | section regeneration | — |
| `GET /api/v1/lesson-generations/{run_id}`, `POST …/{run_id}/retry` | retained | durable job state/retry | — |
| `POST …/{run_id}/rejected-target` | retained | materializes an already-paid rejected Simple Recipe checkpoint for learner review; never calls the provider | — |
| `POST …/{run_id}/rejected-target/accept` | retained | approves the recovered candidate with its captured Simple Recipe brief; never calls the provider | — |
| `GET …/{lesson_id}/sections/{section_key}/latest-generated` | retained | provisional section result | — |
| `PUT /api/v1/painting-lessons/{lesson_id}` | retained | optimistic save | — |
| `GET /api/v1/lesson-assets/{asset_id}/image` | retained | authorized private display object | — |
| `GET /api/v1/studio/usage` | retained | provider usage reporting | — |
| Drawing exercises, progress, practice, library attempts, critique, decomposition, sketch image, and generic image operations | removed | No retained consumer; exported before removal | complete |
| `/api/v1/prompts/generate` | unimplemented promise | appeared only in old contract | documentation corrected now |
| `/api/v1/uploads/presign` | unimplemented promise | uploads use bounded API multipart requests | documentation corrected now |
| `/api/v1/recommendations/today` | unimplemented promise | no production recommendation engine | documentation corrected now |
| 3D/model APIs | unimplemented promise | no production contract | documentation corrected now |

## Data models and tables

### Machine-checked route index

The audit test matches every FastAPI route against this literal index (method groupings above remain
the human-readable disposition):

```text
/health/live
/health/ready
/api/v1/color-mixing/catalog
/api/v1/color-mixing/trials
/api/v1/color-mixing/trials/{trial_id}
/api/v1/color-mixing/swatches
/api/v1/color-mixing/swatches/{swatch_id}
/api/v1/color-mixing/swatches/{swatch_id}/image
/api/v1/painting-lessons
/api/v1/painting-lessons/capabilities
/api/v1/painting-lessons/{lesson_id}
/api/v1/painting-lessons/{lesson_id}/restore
/api/v1/painting-lessons/{lesson_id}/permanent
/api/v1/painting-lessons/{lesson_id}/brief
/api/v1/painting-lessons/{lesson_id}/references
/api/v1/painting-lessons/{lesson_id}/references/{asset_id}/primary
/api/v1/painting-lessons/{lesson_id}/references/{asset_id}
/api/v1/painting-lessons/{lesson_id}/target-generations
/api/v1/painting-lessons/{lesson_id}/target
/api/v1/painting-lessons/{lesson_id}/generations
/api/v1/painting-lessons/{lesson_id}/stage-generations
/api/v1/painting-lessons/{lesson_id}/sections/{section_key}/generations
/api/v1/lesson-generations/{run_id}
/api/v1/lesson-generations/{run_id}/retry
/api/v1/lesson-generations/{run_id}/rejected-target
/api/v1/lesson-generations/{run_id}/rejected-target/accept
/api/v1/painting-lessons/{lesson_id}/sections/{section_key}/latest-generated
/api/v1/lesson-assets/{asset_id}/image
/api/v1/studio/usage
```

| Model / table | Classification | Evidence and disposition | Removal release |
| --- | --- | --- | --- |
| `LearnerProfile` / `learner_profiles` | retained | ownership boundary for painting lessons and color trials | — |
| `PaintingLesson` / `painting_lessons` | retained | painting-session source of truth | — |
| `LessonAsset` / `lesson_assets` | retained | private originals/displays/targets/stages/outlines | — |
| `LessonGenerationRun` / `lesson_generation_runs` | retained | durable worker state and snapshots | — |
| `GenerationUsage` / `generation_usage` | retained | usage reporting | — |
| `ColorMixRecipe` / `color_mix_recipes` | retained | immutable version/palette/slug records | — |
| `ColorMixTrial` / `color_mix_trials` | retained | learner trials, ordered adjustments, notes, revision, timestamps | — |
| `ColorSwatch` / `color_swatches` | active, retained | physical single-paint and mixture records with source, formula, material, capture, and observation snapshots | — |
| `ColorSwatchAsset` / `color_swatch_assets` | active, retained | one learner-private original/display photo pair per physical swatch | — |
| `Exercise`, `PracticeSession`, `LibraryExercise`, `LibraryAttempt`, `Sketch`, `Analysis` and their six tables | removed | Real export verified; dropped by `0014` | complete |

Historical migrations `0001`–`0011` are immutable. Migration `0012` adds color-mixing persistence;
`0013` adds safe session discarding; `0014` drops only the six exported drawing-era tables.
Migration `0015` additively introduces the personal physical Color Library without rewriting recipes
or existing mix-note records.

## Worker operations and storage

| Item | Classification | Disposition |
| --- | --- | --- |
| Redis queue `wanderline:lesson-generation` | retained | target, full, stage/checkpoint, and section generation |
| Target image generation | retained | approval remains mandatory |
| Lesson text generation | retained | provider boundary retained |
| Layer-study/process/stage image generation | retained | retryable worker work |
| Tracing-outline generation for Simple Recipe | retained, frozen presentation | do not change v1 output/printing |
| Usage recording | retained | model/operation/token/cost provenance |
| Lesson source objects | retained | private original plus bounded display rendition |
| Generated target/stage/process/outline objects | retained | addressed by `lesson_assets` |
| Physical color-swatch originals/displays | active, retained | private `color-swatches/{swatch}/{asset}/…` objects addressed by `color_swatch_assets` |
| Sketch upload objects | removed | Export contained no sketch objects; storage type removed |
| Generic image alias | removed | Duplicate endpoint removed with sketch storage |
| Curated guide/Feeling First/lemon assets | retained static | bundled with web build |
| `legacy-sites-source`, `legacy-sites-assets` | stale material | no runtime/build/import references; delete in consolidation |

## Tests and claims

| Test/claim group | Classification | Disposition |
| --- | --- | --- |
| Painting lesson API/service/provider/worker/schema/usage tests | retained | Preserve and extend |
| Simple Recipe unit, print, accessibility, enlarged-text, responsive, screenshot tests | retained and protected | Must pass unchanged |
| Style guide, Feeling First, Color Study tests | retained | Use durable routes; preserve behavior |
| Health and migration tests | retained | Cover `0012` color mixing, `0013` discarding, and scoped `0014` removal |
| Color mixing catalog/trial tests | active | Seed/version/create/update/conflict/isolation/history |
| Color Library API/storage/browser tests | active | Source validation, snapshots, private images, optimistic edits, filtering, coverage, replacement, and deletion |
| Exercise/library/practice/analysis/decomposition compatibility tests | removed | Deleted with the retired implementation after export |
| Archived-site-only tests | obsolete | delete with stale bundle |
| “drawing curriculum is primary” | contradicted claim | replaced by watercolor-first boundary |
| prompt generation, adaptive recommendation, presigned upload, production 3D | unimplemented promises | removed from current documents |
| color-mixing is reference-only | contradicted claim | replaced by production approval and illustrative caveat |

## Removal record

The owner confirmed Wanderline had no other consumers. A real export was written to the Git-ignored
`apps/api/.local-backups/2026-09-18-pre-legacy-removal/` directory before migration `0014`:

- 12 exercises and 20 library exercises
- no practice sessions, attempts, sketches, analyses, or private sketch objects
- 70 KB `legacy-records.json`
- SHA-256 `9ae3f81163f9b3cb6a58e12131a36ee0c0a46f69960d590f773e4ef09c7f9ade`

The migration test verifies retained painting, learner, generation, usage, recipe, and color-trial
tables survive while only the six exported tables are dropped.
