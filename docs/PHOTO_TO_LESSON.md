# Photo-to-lesson workflow

Status: Current
Authority: Feature behavior and verification record
Last reviewed: 2026-09-09

## Creation dialog

The dialog leads with photo upload or an imagined scene, followed by the existing Simple
painting recipe choice. **Just stick to basics** is the primary action above optional controls;
it keeps the source and recipe selection and uses the existing beginner defaults.
**Make it yours** reveals art direction and sequence choices, with title, guidance, timing,
and context inside **A few more touches**. **Create my preview** submits those custom choices.
Both actions retain the existing preview approval, generation, review, and save workflow.

## Current status

### Simple painting recipe

Choose **Simple painting recipe** in the creation dialog for a finished painting, matching
tracing outline and up to six numbered instructions with each step's paint mixes and consistency.
The option works with a photo or an idea and remains selected when using **Just stick to basics**.
It isolates one subject on white paper with a small palette; richer layer sessions remain available.

The normal path uses one image generation for the painting/outline pair, one visual check,
and one compact guidance request after preview approval. It generates no intermediate images.
Choose **Print tracing outline** for an enlarged outline on A4, or browser Save as PDF. Instructions sit beside quick color references; mixing details appear in a section at the bottom.
Demo mode retains the original photo and generic tips and clearly states that no outline was made.
See [ADR 0004](decisions/0004-simple-painting-recipes.md) for contracts and verification limits.

The reusable watercolor lesson workflow is implemented in the Style Reference Studio. The
canonical lemon lesson and saved/generated lessons render through the same data-driven
`WatercolorLessonTemplate`. The default provider is a clearly labeled deterministic demo provider;
real OpenAI generation is opt-in through server configuration.

## Use it today

1. From the repository root, start the local stack with `docker compose up --build`, or run the API and web app using the
   development commands in the root README.
2. Open the Style Reference Studio at `http://localhost:3000` and choose **Create lesson from
   photo**.
3. Choose either **Upload photos** or **Describe an image**. Uploads accept up to six JPEG, PNG,
   WebP, or HEIC/HEIF photographs; text prompts are available when the image provider is configured.
   The two source modes remain exclusive. Described images default to **Layer-by-layer study**;
   **Illustrative progression** remains available, while uploads stay illustrative in this release.
4. Choose 1–5 stages (three by default), mood, background, and watercolor treatment. Each guided
   choice supports one short custom direction. Title, difficulty, duration, and extra intention
   stay in the collapsed **More options** section.
5. Choose **Create watercolor target**. The dedicated assembly route stores the lesson and run IDs,
   reports real phases, and can be safely left or reopened.
6. At checkpoint one, compare the upload with its watercolor transformation, or inspect the target
   created from a text prompt. Adjust the guided direction or add one short instruction, regenerate
   if needed, then choose **Use this image**.
7. Wanderline writes exactly the requested number of cumulative checkpoints. The approved target
   is assigned directly to the last stable stage ID. Illustrative lessons paint intermediate
   checkpoints sequentially. Layer studies make one image request for a process board containing
   every intermediate state, validate that drawing, light washes, middle values, and darks advance
   in order, then crop the board into stage-linked images and compose a process-sheet asset. A
   rejected board is retried once before the recoverable run fails.
8. At checkpoint two, use the image-led carousel to review each checkpoint's dominant action and
   two or three short approach steps. Open
   **Teaching details** for deeper cues, or repaint a stage and every later stage with guided chips.
   The existing prose and curriculum controls remain under **Advanced lesson editor**.
9. Choose **Save lesson**. The editor sends the expected revision and receives HTTP 409 if another
   edit changed the lesson first. Saved lessons appear below the reference workspace after choosing
   **Show saved lessons** and reopen in the shared lesson view.

Existing `painting-lesson.v1` lessons preserve the original interaction model, including the
curated lemon process sheet. Existing v2 lessons without a `sequence_style` remain illustrative.
Newly created
`painting-lesson.v2` lessons use a checkpoint-first view: compact metadata, a scrollable thumbnail
rail, the large active checkpoint, one concise action, brief approach steps, water/time cues, and
the move-on cue. Layer studies keep Current checkpoint, Process sheet, Finished target, and any
Original photo controls directly above the active image, with the active palette always visible.
Teaching details and complete lesson notes start closed. Structural stage controls are hidden in
the v2 Advanced editor because changing order or count would invalidate the visual progression.

## Provider configuration

Copy `.env.example` to `.env` for local defaults. The important settings are:

```dotenv
LESSON_GENERATION_PROVIDER=auto
OPENAI_LESSON_MODEL=gpt-5.6-terra
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_API_KEY=
```

`auto` uses OpenAI when `OPENAI_API_KEY` is set and otherwise uses the deterministic demo provider.
Set `LESSON_GENERATION_PROVIDER=demo` to force local deterministic output. Set it to `openai` only
when the server has a valid key; a missing key becomes a recoverable configuration error. The key
is read only by the API/worker and is never included in frontend configuration.

The text provider sends the approved target plus low-detail secondary context images to the
Responses API with `store: false`. It parses inferred title and subject plus lesson content into a
dedicated strict response model in which every property is required; values that can be absent
semantically, such as palette water parts, are nullable instead. The response is then validated
into the more permissive persisted lesson model so older saved lessons can continue reading up to
eight stages. Every generated v2 stage requires an unnumbered title, a checkpoint action of at most
180 characters, and two or three approach steps of at most 180 characters each. Target and stage
rendering use `gpt-image-2`; illustrative stages send both the target and previous stage as edit
inputs. Layer studies send one fixed process board to a structured visual audit before any
candidate stage assets are promoted. See the
official [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs)
and [image generation guide](https://developers.openai.com/api/docs/guides/image-generation).
Multipart inputs declare filenames and MIME types explicitly rather than relying on runtime
inference. A stage-provider failure preserves the written lesson and completed image prefix; a
failed adjustment keeps the accepted render set.

## API surface

All endpoints are versioned under `/api/v1`:

- `POST/GET /painting-lessons` creates a draft and lists saved lessons only.
- `GET /painting-lessons/{id}` reopens a draft or saved lesson.
- `POST /painting-lessons/{id}/references` uploads up to six validated references.
- `PATCH /painting-lessons/{id}/brief` persists source mode, sequence style, and art direction.
- `PATCH .../references/{asset_id}/primary` selects the primary; `DELETE .../references/{asset_id}`
  removes one and promotes the first remaining reference when needed.
- `POST /painting-lessons/{id}/target-generations` creates or adjusts a target; `POST .../target`
  approves it.
- `POST /painting-lessons/{id}/generations` queues the written lesson and all stage images. The
  legacy `include_study_image` request property is accepted but ignored.
- `POST /painting-lessons/{id}/stage-generations` creates a candidate intermediate-checkpoint
  cascade. A v2 final-checkpoint adjustment is redirected to target generation and approval.
- `GET /lesson-generations/{run_id}` polls status; `POST /lesson-generations/{run_id}/retry`
  requeues recoverable failures.
- `POST /painting-lessons/{id}/sections/{section_key}/generations` queues isolated section or
  stage regeneration; `GET .../latest-generated` retrieves the newest successful snapshot.
- `PUT /painting-lessons/{id}` saves the complete edited lesson with optimistic revision checking.
- `GET /lesson-assets/{asset_id}/image` streams a private display asset with private cache headers.

Source upload bytes remain private in S3-compatible storage. The API creates orientation-corrected,
bounded WebP display renditions; it does not expose object-store credentials or public URLs.

## Data and operations

Migration `0009` adds `painting_lessons`, `lesson_assets`, and `lesson_generation_runs`; migration
`0010` adds the persisted generation brief, approved target and active render-set pointers,
stage-linked assets, adjustments, and typed run progress. PostgreSQL
stores lesson metadata/content, revisions, saved timestamps, job state, and generated snapshots.
Redis carries the `wanderline:lesson-generation` queue; the worker records structured JSON logs for
dequeue, running, completion, enqueue failure, and provider failure events. Redis is transport, not
the lesson source of truth: a failed or interrupted job can be inspected and retried from
PostgreSQL.

The browser stores only the current stage ID for each lesson in `localStorage`, allowing stage
reordering without losing identity. Uploaded sources, generated targets and stages, lesson content, and job
state are server-side.

### Port conflicts

MinIO defaults to host ports 9000 (S3 API) and 9001 (console). If either is occupied, set
`MINIO_API_PORT` and/or `MINIO_CONSOLE_PORT` in `.env` to free host ports. Do not change
`S3_ENDPOINT_URL=http://minio:9000`; that address is used inside the Compose network. Update
`S3_PUBLIC_ENDPOINT_URL` only if you use the host-side S3 API directly.

## Verification

The current checkout verifies API schemas, generation jobs, process-board validation and promotion,
TypeScript/Vitest behavior, production builds, static assets, and Playwright coverage for the v2
opening viewport, layer-study views, mobile layouts, horizontal overflow, focus visibility,
enlarged text, and reduced motion.

### Simple recipe controls (September 9 update)

New recipes choose 1–6 short actions, use at most two paints per mixture, and show a
consistency cue beside each swatch. “Try a little more” contains one optional enhancement.
Print tracing outline offers 4, 6, or 8 inches (6 by default), A4 or Letter, and shows any
reduction needed to fit. Size measures the subject, not its surrounding white canvas.
