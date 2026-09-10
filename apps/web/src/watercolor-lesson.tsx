import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { PaintingRecipeSheet } from "./painting-recipe";

import { LEMON_LESSON, type PaintingLesson, type PaletteMix, type LessonStage } from "./lesson-model";

function readSavedStage(key: string, stageIds: string[]) {
  try {
    const saved = window.localStorage.getItem(key);
    const stableIndex = stageIds.indexOf(saved || "");
    if (stableIndex >= 0) return stableIndex;
    const legacyIndex = Number(saved);
    return Number.isInteger(legacyIndex) && legacyIndex >= 0 && legacyIndex < stageIds.length ? legacyIndex : 0;
  } catch {
    return 0;
  }
}

function dilutionResult(waterParts: number) {
  if (waterParts >= 8) return "a very pale, luminous wash";
  if (waterParts >= 5) return "a light, transparent wash";
  if (waterParts >= 3) return "a middle-strength wash";
  return "a strong accent mix";
}

function DilutionGuide({ mix }: { mix: PaletteMix }) {
  const tooltipId = useId();
  if (!mix.water_parts) return <small>{mix.dilution}</small>;
  return (
    <span className="watercolor-dilution">
      <button type="button" aria-describedby={tooltipId}>{mix.dilution}<span aria-hidden="true">?</span></button>
      <span className="watercolor-dilution__tooltip" id={tooltipId} role="tooltip">
        <strong>What 1 : {mix.water_parts} means</strong>
        <span className="watercolor-dilution__diagram" aria-hidden="true">
          <span className="watercolor-dilution__measure watercolor-dilution__measure--paint"><i style={{ backgroundColor: mix.swatch }} /><b>1×</b><small>concentrated paint</small></span><b>+</b>
          <span className="watercolor-dilution__measure watercolor-dilution__measure--water"><i /><b>{mix.water_parts}×</b><small>clean water</small></span><b>=</b>
          <span className="watercolor-dilution__measure watercolor-dilution__measure--result"><i style={{ backgroundColor: mix.swatch }} /><small>ready wash</small></span>
        </span>
        <span>Awaken the paint and make the color shown above as a concentrated puddle. Using the same brush, combine one full brush-load of that prepared paint with {mix.water_parts} equally full brush-loads of clean water.</span>
        <em>Expected result: {dilutionResult(mix.water_parts)}. Test it on scrap paper.</em>
      </span>
    </span>
  );
}

function StagePalette({ palette }: { palette: PaletteMix[] }) {
  const titleId = useId();
  return (
    <section className="watercolor-palette" aria-labelledby={titleId}>
      <div className="watercolor-palette__header"><h3 id={titleId}>Mix for this step</h3><p>Color ratios compare pigments; dilution compares prepared paint to water.</p></div>
      <ul className="watercolor-palette__mixes">{palette.map((mix) => <li key={mix.id}><span className="watercolor-palette__swatch" style={{ backgroundColor: mix.swatch }} aria-hidden="true" /><span className="watercolor-palette__details"><strong>{mix.name}</strong><span>{mix.formula}</span><DilutionGuide mix={mix} /></span></li>)}</ul>
      <p className="watercolor-palette__note">Start here, then test a swatch—pigment strength varies by brand.</p>
    </section>
  );
}

export function CompactStagePalette({ palette }: { palette: PaletteMix[] }) {
  return <section className="checkpoint-palette" aria-label="Palette for this step"><strong>Mix for this step</strong><ul>{palette.map((mix) => <li key={mix.id}><span className="checkpoint-palette__swatch" style={{ backgroundColor: mix.swatch }} aria-hidden="true" /><span><b>{mix.name}</b><small>{mix.formula}</small><em>{mix.dilution}</em></span></li>)}</ul></section>;
}

function GuidanceDetails({ lesson }: { lesson: PaintingLesson }) {
  const content = lesson.content!;
  const detailGroups = [
    { title: "Look a little closer", eyebrow: "COMPOSITION · VALUE · FOCUS", body: [content.composition_crop, content.focal_point, content.large_value_shapes] },
    { title: "Color and light", eyebrow: "PALETTE · LIGHT · SHADOW", body: [content.light_shadow] },
    { title: "Materials and drawing", eyebrow: "SETUP · UNDER-SKETCH", body: [content.underdrawing, ...content.materials] },
    { title: "Control the wash and edges", eyebrow: "WATER · HARD · SOFT · LOST", body: [content.wash_control, `Hard: ${content.edges.hard}`, `Soft: ${content.edges.soft}`, `Lost: ${content.edges.lost}`] },
  ];
  return (
    <section className="watercolor-guidance" aria-label="Complete watercolor guidance">
      {detailGroups.map((group, index) => <details key={group.title} open={index === 0}><summary><span className="eyebrow">{group.eyebrow}</span><strong>{group.title}</strong></summary><div>{group.body.map((item) => <p key={item}>{item}</p>)}</div></details>)}
      <details><summary><span className="eyebrow">PRESERVE · SIMPLIFY · EXAGGERATE · OMIT</span><strong>Make deliberate detail choices</strong></summary><div className="watercolor-detail-grid">{Object.entries(content.details).map(([key, values]) => <section key={key}><h3>{key}</h3><ul>{values.map((value) => <li key={value}>{value}</li>)}</ul></section>)}</div></details>
      <details><summary><span className="eyebrow">COMMON DETOURS</span><strong>What to correct first</strong></summary><div className="watercolor-mistakes">{content.common_mistakes.map((item) => <p key={item.id}><strong>{item.mistake}</strong> {item.correction}</p>)}</div></details>
      <section className="style-study-lens watercolor-study-lens" aria-labelledby="lesson-study-lens-title"><div><p className="eyebrow">{content.timed_study.duration_minutes} MINUTES TO EXPLORE</p><h2 id="lesson-study-lens-title">Turn looking into painting.</h2></div><dl><div><dt>Notice</dt><dd>{content.timed_study.notice}</dd></div><div><dt>Start</dt><dd>{content.timed_study.start}</dd></div><div><dt>Check</dt><dd>{content.timed_study.check}</dd></div></dl></section>
      <details><summary><span className="eyebrow">COMPLETE TEACHING GUIDE</span><strong>Read the deeper session</strong></summary><div>{content.teaching_guide.map((section) => <section key={section.id}><h3>{section.title}</h3><p>{section.body}</p></section>)}</div></details>
      <details><summary><span className="eyebrow">REFLECTION · NOTES</span><strong>Notice what changed</strong></summary><div><ul>{content.reflection_prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}</ul>{content.user_notes && <p><strong>Your notes:</strong> {content.user_notes}</p>}</div></details>
    </section>
  );
}

function checkpointAsset(lesson: PaintingLesson, stageId: string) {
  return lesson.assets.find((asset) => asset.stage_id === stageId && asset.is_current && asset.role === "stage_image")
    ?? lesson.assets.find((asset) => asset.stage_id === stageId && asset.is_current && (asset.id === lesson.approved_target_asset_id || asset.render_set_id === lesson.active_render_set_id));
}

export function LayerProcessSheet({ lesson }: { lesson: PaintingLesson }) {
  const content = lesson.content!;
  return <section className="layer-process-sheet" aria-label="All watercolor steps">{content.stages.map((stage, index) => { const image = checkpointAsset(lesson, stage.id); const palette = stage.palette_mix_ids.map((id) => content.palette.find((mix) => mix.id === id)).filter((mix): mix is PaletteMix => Boolean(mix)); return <article key={stage.id}><figure>{image ? <img src={image.image_url} width={image.width} height={image.height} alt={image.alt_text} /> : <div className="lesson-image-missing">Step image unavailable</div>}<figcaption><span>{String(index + 1).padStart(2, "0")}</span><strong>{stage.short_title}</strong></figcaption></figure><div><p>{stage.checkpoint_action || stage.instruction}</p><ul aria-label={`Palette for step ${index + 1}`}>{palette.map((mix) => <li key={mix.id}><span style={{ backgroundColor: mix.swatch }} aria-hidden="true" /><small><b>{mix.name}</b>{mix.formula} · {mix.dilution}</small></li>)}</ul></div></article>; })}</section>;
}

function CheckpointLessonTemplate({ lesson }: { lesson: PaintingLesson }) {
  const content = lesson.content!;
  const stages = content.stages;
  const storageKey = `wanderline.watercolor-lesson.${lesson.id}.stage`;
  const [activeStage, setActiveStage] = useState(() => readSavedStage(storageKey, stages.map((stage) => stage.id)));
  const [completed, setCompleted] = useState(false);
  const [imageMode, setImageMode] = useState<"stage" | "process" | "target" | "original">("stage");
  const isLayerStudy = lesson.generation_brief.sequence_style === "layer_study";
  const stage = stages[Math.min(activeStage, stages.length - 1)];
  const image = checkpointAsset(lesson, stage.id);
  const palette = stage.palette_mix_ids.map((id) => content.palette.find((mix) => mix.id === id)).filter((mix): mix is PaletteMix => Boolean(mix));
  const target = lesson.assets.find((asset) => asset.id === lesson.approved_target_asset_id)
    ?? lesson.assets.find((asset) => (asset.role === "target_reference" || asset.role === "study_reference") && asset.is_current);
  const original = lesson.assets.find((asset) => asset.role === "original_reference" && asset.is_primary)
    ?? lesson.assets.find((asset) => asset.role === "original_reference");
  const shownAsset = imageMode === "target" ? target : imageMode === "original" ? original : image;
  const modes: Array<"stage" | "process" | "target" | "original"> = ["stage", ...(isLayerStudy ? ["process"] as const : []), ...(target ? ["target"] as const : []), ...(original ? ["original"] as const : [])];

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, stage.id); } catch { /* optional */ }
  }, [stage.id, storageKey]);

  function chooseStage(index: number) {
    setActiveStage(index);
    setCompleted(false);
  }

  return (
    <article className="checkpoint-lesson">
      <header className="checkpoint-lesson__header">
        <div><Link className="text-link" to="/?view=guide&style=watercolor">← Watercolor guide</Link><p className="eyebrow">GUIDED WATERCOLOR · {lesson.difficulty}</p><h1>{lesson.title}</h1></div>
        <dl><div><dt>Steps</dt><dd>{stages.length}</dd></div><div><dt>Active time</dt><dd>{lesson.estimated_duration_minutes} min</dd></div></dl>
      </header>
      {lesson.is_demo && <aside className="lesson-demo-note" role="status"><strong>A sample session.</strong> These tips offer a starting point; they are not based on a visual reading of your photo.</aside>}
      <nav className="checkpoint-lesson__rail" aria-label="Session steps">
        {stages.map((item, index) => { const thumbnail = checkpointAsset(lesson, item.id); return <button type="button" key={item.id} className={index === activeStage ? "is-active" : ""} aria-current={index === activeStage ? "step" : undefined} onClick={() => chooseStage(index)}>{thumbnail ? <img src={thumbnail.image_url} alt="" /> : <span className="checkpoint-lesson__thumb-placeholder" aria-hidden="true" /> }<span><small>{String(index + 1).padStart(2, "0")}</small><strong>{item.short_title}</strong></span></button>; })}
      </nav>
      <section className="checkpoint-lesson__active" aria-labelledby="checkpoint-action-title">
        <div className="checkpoint-lesson__visual"><div className="watercolor-view-toggle" aria-label="Session image view">{modes.map((mode) => <button type="button" key={mode} className={imageMode === mode ? "is-selected" : ""} aria-pressed={imageMode === mode} onClick={() => setImageMode(mode)}>{mode === "stage" ? "Current step" : mode === "process" ? "Process sheet" : mode === "target" ? "Finished painting" : "Original photo"}</button>)}</div>{imageMode === "process" ? <LayerProcessSheet lesson={lesson} /> : <figure>{imageMode === "stage" ? <PaintingStepArt lesson={lesson} stageId={stage.id} /> : shownAsset ? <img src={shownAsset.image_url} width={shownAsset.width} height={shownAsset.height} alt={shownAsset.alt_text} /> : null}<figcaption>{imageMode === "target" ? "Finished painting" : imageMode === "original" ? "Original photograph" : `Step ${activeStage + 1} of ${stages.length} · ${stage.water_state}`}</figcaption></figure>}<CompactStagePalette palette={palette} /></div>
        <aside><div className="checkpoint-lesson__stage-meta"><span>{stage.time}</span><span>{stage.water_state}</span></div><p className="eyebrow">STEP {String(activeStage + 1).padStart(2, "0")}</p><PaintingStepGuidance stage={stage} headingId="checkpoint-action-title" /><div className="watercolor-stage-actions"><button type="button" disabled={activeStage === 0} onClick={() => chooseStage(activeStage - 1)}>← Previous</button>{activeStage < stages.length - 1 ? <button type="button" onClick={() => chooseStage(activeStage + 1)}>Next step →</button> : <button type="button" onClick={() => setCompleted(true)}>Finish session</button>}</div></aside>
      </section>
      <section className="checkpoint-lesson__drawers" aria-label="Supporting session details">
        <details><summary><span><strong>Palette details</strong><small>Color formulas and dilution</small></span></summary><StagePalette palette={palette} /></details>
        <details><summary><span><strong>More painting tips</strong><small>Principle, full instruction, and what to look for</small></span></summary><div className="checkpoint-lesson__drawer-copy"><blockquote>{stage.principle}</blockquote><h3>Full technique</h3><p>{stage.instruction}</p><h3>Look for</h3><p>{stage.look_for}</p></div></details>
        <details><summary><span><strong>All your painting notes</strong><small>Composition, setup, edges, detours, and extended guide</small></span></summary><div className="checkpoint-lesson__complete-notes"><h2>Your starting point</h2><p>{content.overview}</p><h3>What you’ll explore</h3><p>{content.learning_objective}</p><GuidanceDetails lesson={lesson} /></div></details>
      </section>
      {completed && <section className="watercolor-complete" aria-live="polite"><div><p className="eyebrow">SESSION COMPLETE</p><h2>You practiced watercolor decisions.</h2><p>{content.completion_notes}</p></div><button type="button" onClick={() => chooseStage(0)}>Paint it again</button></section>}
    </article>
  );
}

export function WatercolorLessonTemplate({ lesson }: { lesson: PaintingLesson }) {
  if (!lesson.content?.stages.length) return <section className="lesson-state"><h1>Your session is still taking shape.</h1><Link className="text-link" to="/?view=sessions">Return to your sessions</Link></section>;
  if (lesson.generation_brief.sequence_style === "simple_recipe") return <PaintingRecipeSheet lesson={lesson} />;
  return <CheckpointLessonTemplate lesson={lesson} />;
}

export function PaintingStepArt({ lesson, stageId }: { lesson: PaintingLesson; stageId: string }) {
  const image = checkpointAsset(lesson, stageId);
  const index = lesson.content?.stages.findIndex((stage) => stage.id === stageId) ?? -1;
  if (image) return <img src={image.image_url} width={image.width} height={image.height} alt={image.alt_text} />;
  if (lesson.process_image && index >= 0 && index < 4) return <div className="watercolor-stage-artwork"><img className={`watercolor-step-sheet watercolor-step-sheet--${index + 1}`} src={lesson.process_image} width="1536" height="1024" alt={`${lesson.content!.stages[index].short_title}: ${lesson.content!.stages[index].instruction}`} /></div>;
  const original = lesson.assets.find((asset) => asset.is_primary && asset.role === "original_reference");
  if (lesson.is_demo && original) return <><img src={original.image_url} alt={original.alt_text} /><p className="lesson-capability-note">Your photo, with sample painting guidance.</p></>;
  return <div className="lesson-image-missing"><strong>This step’s image isn’t ready.</strong><span>Your painting notes are still here.</span></div>;
}

export function PaintingStepGuidance({ stage, headingId }: { stage: LessonStage; headingId: string }) {
  const instructions = stage.approach_steps?.length ? stage.approach_steps : [stage.instruction, stage.look_for];
  return <><h2 id={headingId}>{stage.checkpoint_action || stage.title}</h2><ol className="painting-step-instructions">{instructions.map((step) => <li key={step}>{step}</li>)}</ol><div className="watercolor-ready-cue"><strong>Ready when</strong><p>{stage.move_on}</p></div></>;
}

export function WatercolorLesson() { return <WatercolorLessonTemplate lesson={LEMON_LESSON} />; }
