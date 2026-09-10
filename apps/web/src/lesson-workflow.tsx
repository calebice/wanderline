import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useSessionNavigate as useNavigate, useStudioConfirm } from "./studio-ui";
import { approveTarget, choosePrimary, createLesson, getLesson, getLessonCapabilities, latestGenerated, removeReference, retryGeneration, saveLesson, startGeneration, startSectionGeneration, startStageGeneration, startTargetGeneration, updateLessonBrief, uploadReferences, waitForGeneration, type GenerationRun } from "./lesson-api";
import { DEFAULT_LESSON_BRIEF, type LessonContent, type LessonGenerationBrief, type LessonStage, type PaintingLesson, type PaletteMix } from "./lesson-model";
import { PaintingRecipeSheet } from "./painting-recipe";
import { CompactStagePalette, LayerProcessSheet, PaintingStepArt, PaintingStepGuidance, WatercolorLessonTemplate } from "./watercolor-lesson";

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", ""]);

export function SavedLessonLibrary() {
  return <section className="session-invitation"><div><h2>Keep a little inspiration close.</h2><p>Your painting sessions are here whenever you feel like picking up a brush.</p></div><Link className="button-link" to="/?view=sessions">Your sessions →</Link></section>;
}

type LocalFile = { file: File; url: string | null; assetId?: string };

type Choice = { value: string; label: string };
const moodChoices: Choice[] = [{ value: "as_shown", label: "As shown" }, { value: "joyous", label: "Joyous" }, { value: "calm", label: "Calm" }, { value: "pensive", label: "Pensive" }, { value: "dramatic", label: "Dramatic" }];
const backgroundChoices: Choice[] = [{ value: "as_shown", label: "As shown" }, { value: "monochrome", label: "Monochrome wash" }, { value: "gradient", label: "Single-color gradient" }, { value: "complementary", label: "Complementary hue" }, { value: "plain_paper", label: "Plain paper" }];
const treatmentChoices: Choice[] = [{ value: "natural", label: "Natural" }, { value: "loose", label: "Loose and expressive" }, { value: "luminous", label: "Soft and luminous" }, { value: "graphic", label: "Graphic and controlled" }, { value: "atmospheric", label: "Atmospheric" }];

function ChoiceGroup({ legend, value, choices, customValue, onChange, onCustom }: { legend: string; value: string; choices: Choice[]; customValue: string | null; onChange: (value: string) => void; onCustom: (value: string) => void }) {
  return <fieldset className="lesson-choice-group"><legend>{legend}</legend><div>{choices.map((choice) => <button type="button" key={choice.value} className={value === choice.value ? "is-selected" : ""} aria-pressed={value === choice.value} onClick={() => onChange(choice.value)}>{choice.label}</button>)}<button type="button" className={value === "custom" ? "is-selected" : ""} aria-pressed={value === "custom"} onClick={() => onChange("custom")}>Something else</button></div>{value === "custom" && <input aria-label={`${legend} custom direction`} value={customValue || ""} maxLength={300} onChange={(event) => onCustom(event.target.value)} placeholder="Describe what you have in mind…" />}</fieldset>;
}

function ArtDirectionControls({ brief, onChange, showStages = true }: { brief: LessonGenerationBrief; onChange: (brief: LessonGenerationBrief) => void; showStages?: boolean }) {
  const sourceMoodChoices = brief.source_mode === "prompt" ? moodChoices.map((choice) => choice.value === "as_shown" ? { ...choice, label: "Let Wanderline decide" } : choice) : moodChoices;
  const sourceBackgroundChoices = brief.source_mode === "prompt" ? backgroundChoices.map((choice) => choice.value === "as_shown" ? { ...choice, label: "Let Wanderline decide" } : choice) : backgroundChoices;
  return <div className="lesson-art-direction">{showStages && <label className="lesson-stage-count"><span><strong>How many steps?</strong><output htmlFor="lesson-stage-count">{brief.stage_count}</output></span><input id="lesson-stage-count" aria-label="Number of session steps" type="range" min={1} max={5} step={1} value={brief.stage_count} onChange={(event) => onChange({ ...brief, stage_count: Number(event.target.value) })} /><small>One focused step to five gradual steps. Three is a calm default.</small></label>}<ChoiceGroup legend="What is the mood?" value={brief.mood} choices={sourceMoodChoices} customValue={brief.custom_mood} onChange={(mood) => onChange({ ...brief, mood: mood as LessonGenerationBrief["mood"] })} onCustom={(custom_mood) => onChange({ ...brief, custom_mood })} /><ChoiceGroup legend="How do you want the background?" value={brief.background} choices={sourceBackgroundChoices} customValue={brief.custom_background} onChange={(background) => onChange({ ...brief, background: background as LessonGenerationBrief["background"] })} onCustom={(custom_background) => onChange({ ...brief, custom_background })} /><ChoiceGroup legend="How should the watercolor feel?" value={brief.treatment} choices={treatmentChoices} customValue={brief.custom_treatment} onChange={(treatment) => onChange({ ...brief, treatment: treatment as LessonGenerationBrief["treatment"] })} onCustom={(custom_treatment) => onChange({ ...brief, custom_treatment })} /></div>;
}

function SequenceStyleControls({ brief, onChange }: { brief: LessonGenerationBrief; onChange: (brief: LessonGenerationBrief) => void }) {
  return <fieldset className="lesson-sequence-style"><legend>How should the steps be built?</legend><div><button type="button" className={brief.sequence_style === "layer_study" ? "is-selected" : ""} aria-pressed={brief.sequence_style === "layer_study"} onClick={() => onChange({ ...brief, sequence_style: "layer_study" })}><strong>Layer-by-layer images</strong><span>One drawing, then cumulative washes from light to dark.</span></button><button type="button" className={brief.sequence_style === "illustrative" ? "is-selected" : ""} aria-pressed={brief.sequence_style === "illustrative"} onClick={() => onChange({ ...brief, sequence_style: "illustrative" })}><strong>Individual step images</strong><span>Separate visual interpretations of each painting step.</span></button></div></fieldset>;
}

export function LessonCreator({ active = true }: { active?: boolean }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const resumeId = params.get("lesson");
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [primary, setPrimary] = useState(0);
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [difficulty, setDifficulty] = useState("beginner");
  const [duration, setDuration] = useState(30);
  const [brief, setBrief] = useState<LessonGenerationBrief>({ ...DEFAULT_LESSON_BRIEF });
  const [customizing, setCustomizing] = useState(false);
  const [imageAvailable, setImageAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "failed">("idle");
  const [error, setError] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const filesRef = useRef(files);
  const submitting = useRef(false);
  const loadedDraft = useRef<string | null>(null);
  useEffect(() => { filesRef.current = files; }, [files]);
  useEffect(() => () => filesRef.current.forEach((item) => item.url?.startsWith("blob:") && URL.revokeObjectURL(item.url)), []);
  useEffect(() => { if (active) getLessonCapabilities().then((result) => setImageAvailable(result.image_generation_available)).catch(() => setImageAvailable(null)); }, [active]);
  useEffect(() => {
    if (!active || !resumeId || loadedDraft.current === resumeId) return;
    loadedDraft.current = resumeId;
    getLesson(resumeId).then((draft) => {
      setDraftId(draft.id); setBrief(draft.generation_brief); setTitle(draft.title); setContext(draft.artistic_context || ""); setDifficulty(draft.difficulty); setDuration(draft.estimated_duration_minutes);
      const references = draft.assets.filter((asset) => asset.role === "original_reference").sort((a, b) => a.order_index - b.order_index);
      setFiles(references.map((asset) => ({ file: new File([], asset.filename, { type: asset.original_content_type }), assetId: asset.id, url: asset.image_url })));
      setPrimary(Math.max(0, references.findIndex((asset) => asset.is_primary)));
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "We couldn’t reopen that draft."));
  }, [active, resumeId]);

  function addFiles(incoming: File[]) {
    setError("");
    const valid = incoming.filter((file) => acceptedTypes.has(file.type) && file.size <= 15_728_640);
    if (valid.length !== incoming.length) setError("Use JPEG, PNG, WebP, or HEIC images up to 15 MB each.");
    else if (valid.length > 6 - files.length) setError("You can add up to six photos.");
    setFiles((current) => [...current, ...valid.slice(0, 6 - current.length).map((file) => ({ file, url: /heic|heif/i.test(file.type || file.name) ? null : URL.createObjectURL(file) }))]);
  }
  function drop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); if (!submitting.current) addFiles(Array.from(event.dataTransfer.files)); }
  async function remove(index: number) {
    const item = files[index];
    if (draftId && item.assetId) { try { await removeReference(draftId, item.assetId); } catch { setError("We couldn’t remove that photo. Try again."); return; } }
    if (item.url?.startsWith("blob:")) URL.revokeObjectURL(item.url);
    setFiles((current) => current.filter((_, i) => i !== index));
    setPrimary((current) => current === index ? 0 : current > index ? current - 1 : current);
  }
  async function generate(basics: boolean) {
    if (submitting.current) return;
    const chosen = basics ? { ...DEFAULT_LESSON_BRIEF, source_mode: brief.source_mode, scene_prompt: brief.scene_prompt, sequence_style: brief.sequence_style === "simple_recipe" ? "simple_recipe" as const : DEFAULT_LESSON_BRIEF.sequence_style } : brief;
    if (chosen.source_mode === "upload" && !files.length) { setError("Add at least one photo to begin."); return; }
    if (chosen.source_mode === "prompt" && !chosen.scene_prompt?.trim()) { setError("Describe the scene you’d like to paint."); return; }
    if (chosen.source_mode === "prompt" && imageAvailable !== true) { setError("Creating an image is unavailable right now. You can still start with a photo."); return; }
    const missing = [[chosen.mood, chosen.custom_mood, "mood"], [chosen.background, chosen.custom_background, "background"], [chosen.treatment, chosen.custom_treatment, "watercolor feel"]].find(([choice, custom]) => choice === "custom" && !custom?.trim());
    if (missing) { setError(`Describe your ${missing[2]}.`); return; }
    const metadata = { title: basics ? null : title || null, artistic_context: basics ? null : context || null, difficulty: basics ? "beginner" : difficulty, estimated_duration_minutes: basics ? 30 : duration };
    setBrief(chosen); setError(""); submitting.current = true; setStatus("uploading");
    try {
      const draft = draftId ? await updateLessonBrief(draftId, chosen, metadata) : await createLesson({ ...metadata, generation_brief: chosen });
      setDraftId(draft.id);
      const pending = chosen.source_mode === "upload" ? files.filter((item) => !item.assetId) : [];
      const uploaded = pending.length ? await uploadReferences(draft.id, pending.map((item) => item.file)) : draft;
      const references = uploaded.assets.filter((asset) => asset.role === "original_reference").sort((a, b) => a.order_index - b.order_index);
      setFiles((current) => current.map((item, index) => ({ ...item, assetId: item.assetId || references[index]?.id })));
      if (chosen.source_mode === "upload" && references[primary] && !references[primary].is_primary) await choosePrimary(draft.id, references[primary].id);
      const run = await startTargetGeneration(draft.id);
      files.forEach((item) => item.url?.startsWith("blob:") && URL.revokeObjectURL(item.url));
      setFiles([]); setDraftId(null); setTitle(""); setContext(""); setDifficulty("beginner"); setDuration(30); setBrief({ ...DEFAULT_LESSON_BRIEF }); setCustomizing(false); setStatus("idle"); loadedDraft.current = null;
      navigate(`/?view=lesson-build&lesson=${draft.id}&run=${run.id}&next=target`);
    } catch (reason) { setStatus("failed"); setError(reason instanceof Error ? reason.message : "We couldn’t prepare your preview."); }
    finally { submitting.current = false; }
  }
  function submit(event: FormEvent) { event.preventDefault(); void generate(!customizing); }
  return <article className="lesson-creator">
    <header><p className="eyebrow">A little room to create</p><h1>What would you love to paint?</h1><p className="lede">Bring a photo or a daydream. We’ll help you find a place to start.</p></header>
    <form onSubmit={submit}>
      <fieldset className="creator-fields" disabled={status === "uploading"}>
        <section aria-label="Your inspiration"><div className="lesson-source-tabs"><button type="button" className={brief.source_mode === "upload" ? "is-selected" : ""} aria-pressed={brief.source_mode === "upload"} onClick={() => setBrief({ ...brief, source_mode: "upload", scene_prompt: null })}>Use a photo</button><button type="button" className={brief.source_mode === "prompt" ? "is-selected" : ""} aria-pressed={brief.source_mode === "prompt"} disabled={imageAvailable !== true} onClick={() => setBrief({ ...brief, source_mode: "prompt" })}>Describe an idea</button></div>
        {imageAvailable === false && <p className="lesson-capability-note">Start with a photo and sample painting tips. Imagined previews are unavailable in this studio right now.</p>}
        {brief.source_mode === "upload" ? <><div className="lesson-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={drop}><label><strong>Drop a photo that inspires you</strong><span>or choose from your device</span><small>JPEG, PNG, WebP, HEIC · up to 6 photos · 15 MB each</small><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={(event) => addFiles(Array.from(event.target.files || []))} /></label></div>{files.length > 0 && <ul className="lesson-upload-previews">{files.map((item, index) => <li key={`${item.file.name}-${index}`} className={primary === index ? "is-primary" : ""}>{item.url ? <img src={item.url} alt={`Preview of ${item.file.name}`} /> : <div className="lesson-heic-placeholder">Photo preview after upload</div>}<div><label><input type="radio" name="primary" checked={primary === index} onChange={() => setPrimary(index)} /> Main inspiration</label><span>{item.file.name}</span><button type="button" onClick={() => void remove(index)}>Remove</button></div></li>)}</ul>}</> : <label className="lesson-scene-prompt">What’s in your imagination?<textarea value={brief.scene_prompt || ""} maxLength={2000} onChange={(event) => setBrief({ ...brief, scene_prompt: event.target.value })} placeholder="A little greenhouse after rain, warm light catching the leaves…" /></label>}</section>
        <label className="creator-recipe-option"><input type="checkbox" checked={brief.sequence_style === "simple_recipe"} onChange={(event) => setBrief({ ...brief, sequence_style: event.target.checked ? "simple_recipe" : "layer_study", stage_count: 3, background: event.target.checked ? "plain_paper" : "as_shown", treatment: "natural", custom_background: null, custom_treatment: null })} /><span><strong>Simple painting recipe</strong><small>A gentle finished painting, matching tracing outline, and up to six short paint steps with your mixes.</small></span></label>
        <p className="creator-defaults">{brief.sequence_style === "simple_recipe" ? "One subject · a few colors · one printable page" : "3 steps · 30 minutes · easygoing watercolor"}</p>
        <button type="button" className="creator-customize button-secondary" aria-expanded={customizing} onClick={() => setCustomizing(!customizing)}>{customizing ? "Close options" : "Make it yours"}</button>
        {customizing && <section className="creator-options">{brief.sequence_style !== "simple_recipe" && <><ArtDirectionControls brief={brief} onChange={setBrief} /><SequenceStyleControls brief={brief} onChange={setBrief} /></>}<details className="lesson-more-options"><summary>A few more touches</summary><div className="lesson-form-grid"><label>Session title<input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} placeholder="We can suggest one" /></label><label>How much guidance?<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="beginner">A gentle start</option><option value="intermediate">A little experience</option><option value="advanced">Room to stretch</option></select></label><label>Time to paint<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>{[20, 30, 45, 60].map((time) => <option key={time} value={time}>{time} minutes</option>)}</select></label><label className="is-wide">Anything you’d like to explore?<textarea value={context} maxLength={1000} onChange={(event) => setContext(event.target.value)} /></label></div></details></section>}
      </fieldset>
      {error && <div className="lesson-error" role="alert">{error}</div>}
      <div className="studio-actions creator-submit">{customizing && <button type="button" className="button-secondary" disabled={status === "uploading"} onClick={() => void generate(true)}>Just stick to basics</button>}<button className="lesson-generate" type="submit" disabled={status === "uploading"}>{status === "uploading" ? "Preparing your inspiration…" : customizing ? "Create my preview →" : "Just stick to basics"}</button></div>
      <p className="lesson-privacy">{imageAvailable ? "Your photos and ideas are shared with OpenAI to prepare your painting session. They stay out of the public gallery." : "Your photos stay in your private studio."}</p>
    </form>
  </article>;
}

export function LessonTargetReview({ id }: { id: string | null }) {
  const confirm = useStudioConfirm();
  const [adjusting, setAdjusting] = useState(false);
  const navigate = useNavigate();
  const { lesson, error } = useLesson(id);
  const [brief, setBrief] = useState<LessonGenerationBrief | null>(null);
  const [adjustment, setAdjustment] = useState("");
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState("");
  useEffect(() => { if (lesson) setBrief(lesson.generation_brief); }, [lesson]);
  if (error) return <section className="lesson-state"><h1>Preview unavailable</h1><p>{error}</p></section>;
  if (!lesson || !brief) return <section className="lesson-state"><h1>Preparing your preview…</h1></section>;
  const currentLesson = lesson;
  const currentBrief = brief;
  const original = lesson.assets.find((asset) => asset.role === "original_reference" && asset.is_primary);
  const targets = lesson.assets.filter((asset) => asset.role === "target_reference");
  const target = targets[targets.length - 1] || (!lesson.image_generation_available ? original : undefined);
  const visualDirectionChanged = ["mood", "custom_mood", "background", "custom_background", "treatment", "custom_treatment", "additional_direction"].some((key) => brief[key as keyof LessonGenerationBrief] !== lesson.generation_brief[key as keyof LessonGenerationBrief]);
  const tracing = lesson.assets.find((asset) => asset.role === "tracing_outline" && asset.stage_id === target?.id);
  const stageCountChanged = brief.stage_count !== lesson.generation_brief.stage_count;
  async function regenerate() { if (!id) return; setWorking(true); setActionError(""); try { await updateLessonBrief(id, brief!); const run = await startTargetGeneration(id, adjustment); navigate(`/?view=lesson-build&lesson=${id}&run=${run.id}&next=target`); } catch (reason) { setActionError(reason instanceof Error ? reason.message : "Could not repaint the preview."); } finally { setWorking(false); } }
  async function approve() {
    if (!target || !id) return;
    if (visualDirectionChanged && currentLesson.image_generation_available) { setActionError("Create a new preview to see your changes before using this image."); return; }
    if (stageCountChanged && currentLesson.content) {
      const nextImages = Math.max(0, currentBrief.stage_count - 1);
      const currentImages = Math.max(0, currentLesson.content.stages.length - 1);
      if (!await confirm(`Changing to ${currentBrief.stage_count} steps will rebuild the written sequence and repaint ${nextImages} intermediate image${nextImages === 1 ? "" : "s"}. It will replace ${currentImages} current intermediate image${currentImages === 1 ? "" : "s"}; the approved preview remains the final step. Continue?`)) return;
    }
    if (target.id === currentLesson.approved_target_asset_id && !stageCountChanged && !visualDirectionChanged && currentLesson.content) { navigate(`/?view=lesson-review&lesson=${id}`); return; }
    setWorking(true); setActionError("");
    try { await updateLessonBrief(id, currentBrief); await approveTarget(id, target.id); const run = await startGeneration(id, false); navigate(`/?view=lesson-build&lesson=${id}&run=${run.id}&next=review`); } catch (reason) { setActionError(reason instanceof Error ? reason.message : "Could not begin the session."); } finally { setWorking(false); }
  }
  return <article className="lesson-target-review"><header><Link className="text-link" to="/?view=lesson-create">← Start over</Link><p className="eyebrow">YOUR PAINTING PREVIEW</p><h1>Does this feel like you?</h1><p className="lede">Choose the image you’d love to paint. We’ll prepare the steps from here.</p></header><section className={`lesson-target-images${original ? " has-original" : ""}`}>{original && <figure><img src={original.image_url} alt={original.alt_text} /><figcaption>Original photo</figcaption></figure>}<figure>{target ? <img src={target.image_url} alt={target.alt_text} /> : <div className="lesson-image-missing">Preview image unavailable</div>}<figcaption>{lesson.image_generation_available ? "Painting preview" : "Your photo · sample guidance to follow"}</figcaption></figure>{tracing && <figure><img src={tracing.image_url} alt="Matching tracing outline" /><figcaption>Your tracing outline</figcaption></figure>}</section><button type="button" className="button-secondary" onClick={() => setAdjusting(!adjusting)} aria-expanded={adjusting}>Try a change</button>{adjusting && <section className="lesson-target-adjust"><h2>Make a little room for a new idea.</h2>{brief.sequence_style !== "simple_recipe" && <ArtDirectionControls brief={brief} onChange={setBrief} />}<label>One more adjustment <input value={adjustment} maxLength={1000} onChange={(event) => setAdjustment(event.target.value)} placeholder="Keep the window reflections, but simplify the garden…" /></label>{visualDirectionChanged && lesson.image_generation_available && <p className="lesson-capability-note">Your art direction changed. Create a new preview to see the changes before using this image.</p>}</section>}{actionError && <div className="lesson-error" role="alert">{actionError}</div>}<div className="lesson-checkpoint-actions">{adjusting && <button type="button" className="button-secondary" disabled={working} onClick={() => void regenerate()}>Try another version</button>}<button type="button" disabled={working || !target || visualDirectionChanged && lesson.image_generation_available} onClick={() => void approve()}>Use this image →</button></div></article>;
}

export function LessonAssembly({ id, runId, next }: { id: string | null; runId: string | null; next: string | null }) {
  const navigate = useNavigate();
  const [run, setRun] = useState<GenerationRun | null>(null);
  const [lesson, setLesson] = useState<PaintingLesson | null>(null);
  const [error, setError] = useState("");
  const [pollAttempt, setPollAttempt] = useState(0);
  useEffect(() => { if (id) getLesson(id).then(setLesson).catch(() => undefined); }, [id]);
  useEffect(() => {
    const controller = new AbortController();
    if (!runId || !id) { setError("This preparation is unavailable."); return; }
    let previousProgress = "";
    waitForGeneration(runId, (value) => {
      if (controller.signal.aborted) return;
      setRun(value);
      const progress = JSON.stringify([value.progress?.phase, value.progress?.completed]);
      if (progress !== previousProgress) {
        previousProgress = progress;
        getLesson(id).then((updated) => { if (!controller.signal.aborted) setLesson(updated); }).catch(() => undefined);
      }
    }, controller.signal).then((value) => {
      if (controller.signal.aborted) return;
      setRun(value);
      if (value.status === "completed") navigate(next === "target" ? `/?view=lesson-target&lesson=${id}` : `/?view=lesson-review&lesson=${id}`, { replace: true });
      else setError(value.error_message || "We couldn’t finish preparing this session.");
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Preparation is unavailable."); });
    return () => controller.abort();
  }, [id, navigate, next, pollAttempt, runId]);
  const total = run?.progress?.total || (next === "target" ? 1 : (lesson?.generation_brief.stage_count || 3) + 1);
  const completed = run?.progress?.completed || 0;
  const phase = run?.progress?.phase;
  const stageItems = run?.progress?.items?.filter((item) => item.key !== "lesson") || [];
  const runningStage = stageItems.findIndex((item) => item.status === "running");
  const finishedStages = stageItems.filter((item) => item.status === "completed").length;
  const stageNumber = runningStage >= 0 ? runningStage + 1 : Math.min(finishedStages + 1, Math.max(1, total - 1));
  const statusText = phase === "target" ? "Painting your watercolor preview…" : phase === "lesson_text" ? "Writing the session…" : phase === "painting_process_sheet" ? "Painting the layer-by-layer process sheet…" : phase === "validating_process_order" ? "Checking that each layer advances naturally…" : phase === "preparing_stage_views" ? "Preparing the step views…" : phase === "stage_images" ? `Painting step ${stageNumber} of ${Math.max(1, total - 1)}…` : phase === "review" ? "Preparing your review…" : "Preparing your reference…";
  const stageAssets = lesson?.content?.stages.map((stage) => activeCheckpointAsset(lesson, stage.id)) || [];
  const targetAsset = [...(lesson?.assets || [])].reverse().find((asset) => asset.role === "target_reference") || lesson?.assets.find((asset) => asset.role === "original_reference" && asset.is_primary);
  const cards = next === "target" ? [targetAsset] : Array.from({ length: Math.max(1, total - 1) }, (_, index) => stageAssets[index]);
  async function retry() { if (!runId) return; setError(""); try { const retried = await retryGeneration(runId); setRun(retried); setPollAttempt((attempt) => attempt + 1); } catch (reason) { setError(reason instanceof Error ? reason.message : "We couldn’t resume yet."); } }
  return <article className="lesson-assembly"><header><p className="eyebrow">ASSEMBLING YOUR SESSION</p><h1>Paint, paper, and a little patience.</h1><p>Your draft is safe. You can leave this page and reopen it while Wanderline keeps working.</p></header>{next !== "target" && targetAsset && <figure className="assembly-preview"><img src={targetAsset.image_url} alt={targetAsset.alt_text} /><figcaption>Your painting preview</figcaption></figure>}<section aria-live="polite" role="status"><div className="lesson-assembly__papers" aria-hidden="true">{cards.map((asset, index) => <span key={index} className={asset || index < Math.max(0, completed - 1) ? "is-complete" : ""}>{asset ? <img src={asset.image_url} alt="" /> : String(index + 1).padStart(2, "0")}</span>)}</div><strong>{statusText}</strong><progress max={total} value={completed}>{completed} of {total}</progress><p>{completed} of {total} assembly steps complete</p></section>{error && <div className="lesson-error" role="alert"><strong>We couldn’t finish that pass.</strong><p>{error}</p>{run?.status === "failed" && run.recoverable !== false && <button type="button" onClick={() => void retry()}>Resume preparation</button>}{run?.recoverable === false && <><Link className="text-link" to="/?view=settings">Review AI usage</Link>{lesson && <Link className="button-link" to={`/?view=${lesson.approved_target_asset_id ? "lesson-target" : "lesson-create"}&lesson=${lesson.id}`}>Try a new version</Link>}</>}</div>}<Link className="text-link" to="/?view=sessions">Return to your sessions →</Link></article>;
}

function useLesson(id: string | null) {
  const [lesson, setLesson] = useState<PaintingLesson | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (!id) { setError("No session was selected."); return; } getLesson(id).then(setLesson).catch((reason) => setError(reason instanceof Error ? reason.message : "Session unavailable.")); }, [id]);
  return { lesson, setLesson, error };
}

export function SavedLessonView({ id }: { id: string | null }) {
  const { lesson, error } = useLesson(id);
  if (error) return <section className="lesson-state"><h1>Session unavailable</h1><p>{error}</p><Link className="text-link" to="/">Return to the studio</Link></section>;
  if (!lesson) return <section className="lesson-state" aria-live="polite"><h1>Opening your session…</h1></section>;
  return <><div className="lesson-view-actions"><Link className="text-link" to="/?view=sessions">← Your sessions</Link><Link className="button-link" to={`/?view=lesson-review&lesson=${lesson.id}`}>Edit session</Link></div><WatercolorLessonTemplate lesson={lesson} /></>;
}

function replaceSection(content: LessonContent, key: string, value: unknown): LessonContent {
  if (key.startsWith("stages.")) { const id = key.split(".")[1]; return { ...content, stages: content.stages.map((stage) => stage.id === id ? value as LessonStage : stage) }; }
  return { ...content, [key]: value };
}

function stageAdjustmentSuggestions(stage: LessonStage, index: number, total: number) {
  const goal = `${stage.title} ${stage.instruction} ${stage.principle}`.toLowerCase();
  if (goal.includes("draw") || goal.includes("shape")) return ["Simpler shapes", "Lighter guide marks", "Reserve more paper"];
  if (goal.includes("wash") || goal.includes("wet")) return ["Lighter wash", "Softer edges", "Fewer blooms"];
  if (goal.includes("edge") || goal.includes("detail")) return ["Fewer details", "Softer background", "Crisper focal edge"];
  if (index === total - 1) return ["Stronger focal contrast", "Fewer details", "Deeper accents"];
  return ["Lighter values", "Simpler background", "More open paper"];
}

function activeCheckpointAsset(lesson: PaintingLesson, stageId: string) {
  return lesson.assets.find((asset) => asset.role === "stage_image" && asset.stage_id === stageId && asset.is_current)
    ?? lesson.assets.find((asset) => (asset.id === lesson.approved_target_asset_id || asset.render_set_id === lesson.active_render_set_id) && asset.stage_id === stageId && asset.is_current);
}

export function LessonEditor({ id }: { id: string | null }) {
  const confirm = useStudioConfirm();
  const navigate = useNavigate();
  const { lesson, setLesson, error } = useLesson(id);
  const [draft, setDraft] = useState<PaintingLesson | null>(null);
  const [dirty, setDirty] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [activeReviewStage, setActiveReviewStage] = useState(0);
  const [stageAdjustment, setStageAdjustment] = useState("");
  const [reviewImageMode, setReviewImageMode] = useState<"stage" | "process" | "target" | "original">("stage");
  useEffect(() => { if (lesson) setDraft(structuredClone(lesson)); }, [lesson]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  const content = draft?.content;
  const update = (next: PaintingLesson) => { setDraft(next); setDirty(true); setMessage(""); };
  const updateContent = (next: LessonContent) => draft && update({ ...draft, content: next });

  const sectionPolling = useRef<AbortController | null>(null);
  useEffect(() => () => sectionPolling.current?.abort(), []);
  async function regenerate(key: string, restore = false) {
    if (!draft || !content || working) return;
    const controller = new AbortController(); sectionPolling.current = controller;
    setWorking(key); setMessage("");
    try {
      const run = restore ? await latestGenerated(draft.id, key) : await waitForGeneration((await startSectionGeneration(draft.id, key, content)).id, undefined, controller.signal);
      if (run.status === "failed") throw new Error(run.error_message || "Section generation failed.");
      if (controller.signal.aborted) return;
      setDraft((current) => current?.content ? { ...current, content: replaceSection(current.content, key, run.result) } : current); setDirty(true);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "We couldn’t make another version of this section."); }
    finally { setWorking(null); }
  }

  async function save() {
    if (!draft || !content) return;
    const isRecipe = draft.generation_brief.sequence_style === "simple_recipe";
    if (draft.schema_version === "painting-lesson.v2" && content.stages.some((stage) => !stage.checkpoint_action?.trim() || (!isRecipe && (!stage.approach_steps || stage.approach_steps.length < 2 || stage.approach_steps.length > 3)))) {
      setMessage(isRecipe ? "Every recipe step needs one painting action." : "Every step needs one action and two or three approach steps.");
      return;
    }
    setWorking("save");
    try { const saved = await saveLesson(draft, content); setLesson(saved); setDraft(saved); setDirty(false); navigate(`/?view=lesson&lesson=${saved.id}`); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not save the session."); }
    finally { setWorking(null); }
  }

  async function regenerateStageImages(stageId: string, adjustment: string) {
    if (!draft) return;
    setWorking(`image.${stageId}`); setMessage("");
    try {
      const stageIndex = content?.stages.findIndex((stage) => stage.id === stageId) ?? 0;
      const affected = content ? content.stages.length - stageIndex - (draft.schema_version === "painting-lesson.v2" ? 1 : 0) : 1;
      if (affected < 1) {
        navigate(`/?view=lesson-target&lesson=${draft.id}`);
        return;
      }
      if (!await confirm(`This will repaint ${affected} step image${affected === 1 ? "" : "s"}, starting here.${dirty ? " Your text changes will be saved first." : ""}`)) return;
      if (dirty) {
        const saved = await saveLesson(draft, content!);
        setLesson(saved); setDraft(saved); setDirty(false);
      }
      const run = await startStageGeneration(draft.id, stageId, adjustment);
      navigate(`/?view=lesson-build&lesson=${draft.id}&run=${run.id}&next=review`);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not repaint the steps."); }
    finally { setWorking(null); }
  }

  if (error) return <section className="lesson-state"><h1>Session unavailable</h1><p>{error}</p></section>;
  if (!draft || !content) return <section className="lesson-state"><h1>Preparing your session…</h1></section>;
  const textSections: Array<[keyof LessonContent, string]> = [["overview", "Your starting point"], ["learning_objective", "What you’ll explore"], ["composition_crop", "Composition and crop"], ["focal_point", "Focal point"], ["large_value_shapes", "Large value and shape breakdown"], ["light_shadow", "Light and shadow"], ["underdrawing", "Under-sketch guidance"], ["wash_control", "Wash control"], ["completion_notes", "Completion notes"], ["user_notes", "Your notes"]];
  return (
    <article className="lesson-editor" onClickCapture={async (event) => { const link = (event.target as HTMLElement).closest("a"); if (link && dirty && !link.getAttribute("href")?.startsWith("#")) { event.preventDefault(); if (await confirm("Leave without saving your session changes?")) navigate(link.getAttribute("href") || "/"); } }}>
      <header><Link className="text-link" to={`/?view=lesson&lesson=${draft.id}`}>← Session preview</Link><p className="eyebrow">YOUR PAINTING SESSION</p><h1>{draft.generation_brief.sequence_style === "simple_recipe" ? "Your little painting recipe." : "Review the painting journey."}</h1><p className="lede">{draft.generation_brief.sequence_style === "simple_recipe" ? "Trace the shape, mix a little color, and begin. Save your recipe to keep it close." : "Move through the images and essential instructions. The complete written editor is available only when you want it."}</p></header>
      <div className="lesson-editor__bar"><span className={dirty ? "is-dirty" : ""}>{dirty ? "Unsaved changes" : draft.saved_at ? "Saved" : "Generated draft"}</span><button type="button" onClick={save} disabled={!dirty && Boolean(draft.saved_at) || working === "save"}>{draft.saved_at ? "Save changes" : "Save session"}</button></div>
      {draft.is_demo && <aside className="lesson-demo-note"><strong>Sample guidance</strong> These tips have not been matched to the contents of your photo.</aside>}
      {message && <div className="lesson-error" role="alert">{message}</div>}
      <section className="lesson-review-summary"><div><p className="eyebrow">LESSON SETUP</p><strong>{content.stages.length} steps · {draft.generation_brief.mood.replace("_", " ")} · {draft.generation_brief.treatment} watercolor</strong></div><Link className="text-link" to={`/?view=lesson-target&lesson=${draft.id}`}>Change art direction →</Link></section>
      {draft.generation_brief.sequence_style === "simple_recipe" ? <PaintingRecipeSheet lesson={draft} /> : (() => {
        const stage = content.stages[Math.min(activeReviewStage, content.stages.length - 1)];
        const image = activeCheckpointAsset(draft, stage.id);
        const suggestions = stageAdjustmentSuggestions(stage, activeReviewStage, content.stages.length);
        const isV2 = draft.schema_version === "painting-lesson.v2";
        const isLayerStudy = draft.generation_brief.sequence_style === "layer_study";
        const usesImageControls = draft.sequence_style_configured;
        const isFinalTarget = isV2 && activeReviewStage === content.stages.length - 1;
        const affected = content.stages.length - activeReviewStage - (isV2 ? 1 : 0);
        const palette = stage.palette_mix_ids.map((mixId) => content.palette.find((mix) => mix.id === mixId)).filter((mix): mix is PaletteMix => Boolean(mix));
        const target = draft.assets.find((asset) => asset.id === draft.approved_target_asset_id) ?? draft.assets.find((asset) => (asset.role === "target_reference" || asset.role === "study_reference") && asset.is_current);
        const original = draft.assets.find((asset) => asset.role === "original_reference" && asset.is_primary) ?? draft.assets.find((asset) => asset.role === "original_reference");
        const shownAsset = reviewImageMode === "target" ? target : reviewImageMode === "original" ? original : image;
        const imageModes: Array<"stage" | "process" | "target" | "original"> = usesImageControls ? ["stage", ...(isLayerStudy ? ["process"] as const : []), "target", ...(original ? ["original"] as const : [])] : [];
        return <section className="lesson-stage-review" aria-labelledby="lesson-stage-review-title">
          <nav aria-label="Review session steps">{content.stages.map((item, index) => { const thumbnail = activeCheckpointAsset(draft, item.id); return <button type="button" key={item.id} className={index === activeReviewStage ? "is-selected" : ""} aria-current={index === activeReviewStage ? "step" : undefined} onClick={() => { setActiveReviewStage(index); setStageAdjustment(""); setReviewImageMode("stage"); }}>{thumbnail && <img src={thumbnail.image_url} alt="" />}<span>{String(index + 1).padStart(2, "0")}</span><strong>{item.short_title}</strong></button>; })}</nav>
          <div className="lesson-stage-review__body"><div className="lesson-stage-review__visual">{usesImageControls && <div className="watercolor-view-toggle" aria-label="Review image view">{imageModes.map((mode) => <button type="button" key={mode} className={reviewImageMode === mode ? "is-selected" : ""} aria-pressed={reviewImageMode === mode} onClick={() => setReviewImageMode(mode)}>{mode === "stage" ? "Current step" : mode === "process" ? "Process sheet" : mode === "target" ? "Finished painting" : "Original photo"}</button>)}</div>}{isLayerStudy && reviewImageMode === "process" ? <LayerProcessSheet lesson={draft} /> : <figure>{reviewImageMode === "stage" ? <PaintingStepArt lesson={draft} stageId={stage.id} /> : shownAsset ? <img src={shownAsset.image_url} alt={shownAsset.alt_text} /> : null}<figcaption>{reviewImageMode === "target" ? "Finished painting" : reviewImageMode === "original" ? "Original photograph" : `Step ${activeReviewStage + 1} of ${content.stages.length}`}</figcaption></figure>}{usesImageControls && <CompactStagePalette palette={palette} />}</div><div><p className="eyebrow">{stage.water_state}</p><PaintingStepGuidance stage={stage} headingId="lesson-stage-review-title" /><details><summary>More painting tips</summary><blockquote>{stage.principle}</blockquote>{isV2 && <><h3>Full technique</h3><p>{stage.instruction}</p></>}<h3>Look for</h3><p>{stage.look_for}</p><h3>Palette</h3><p>{stage.palette_mix_ids.map((id) => content.palette.find((mix) => mix.id === id)?.name).filter(Boolean).join(" · ")}</p></details>{isFinalTarget ? <div className="lesson-stage-review__target-adjust"><strong>This step is your approved preview.</strong><p>Adjusting it returns to preview approval and rebuilds the intermediate sequence.</p><Link className="button-link" to={`/?view=lesson-target&lesson=${draft.id}`}>Adjust finished painting →</Link></div> : <fieldset><legend>Adjust this step onward</legend><div>{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => setStageAdjustment(suggestion)} aria-pressed={stageAdjustment === suggestion}>{suggestion}</button>)}</div><input aria-label="Describe a step image change" value={stageAdjustment} onChange={(event) => setStageAdjustment(event.target.value)} placeholder="Describe a change…" /><button type="button" disabled={working === `image.${stage.id}` || !draft.image_generation_available} onClick={() => void regenerateStageImages(stage.id, stageAdjustment)}>Repaint {affected} image{affected === 1 ? "" : "s"}</button></fieldset>}</div></div>
          <div className="lesson-stage-review__pager"><button type="button" disabled={activeReviewStage === 0} onClick={() => setActiveReviewStage((current) => current - 1)}>← Previous</button><button type="button" disabled={activeReviewStage === content.stages.length - 1} onClick={() => setActiveReviewStage((current) => current + 1)}>Next step →</button></div>
        </section>;
      })()}
      {draft.generation_brief.sequence_style !== "simple_recipe" && content.stages.some((stage) => !activeCheckpointAsset(draft, stage.id)) && <button className="lesson-retry-images" type="button" disabled={!draft.image_generation_available} onClick={() => { const firstMissing = content.stages.find((stage) => !activeCheckpointAsset(draft, stage.id)); if (firstMissing) void regenerateStageImages(firstMissing.id, ""); }}>Retry remaining images</button>}
      <details className="lesson-advanced-editor"><summary><span><strong>Make it yours</strong><small>Edit all generated prose, palette, timing, and painting notes.</small></span></summary><div>
      <section className="lesson-editor__metadata"><label>Session title<input value={draft.title} onChange={(event) => update({ ...draft, title: event.target.value })} /></label><label>Subject or location<input value={draft.subject || ""} onChange={(event) => update({ ...draft, subject: event.target.value })} /></label><label>Artistic intention<textarea value={draft.artistic_context || ""} onChange={(event) => update({ ...draft, artistic_context: event.target.value })} /></label></section>
      <section className="lesson-editor__sections" aria-label="Editable session sections">{textSections.map(([key, label]) => <article key={key}><div><h2>{label}</h2><span>{key !== "user_notes" && <><button type="button" disabled={working === key} onClick={() => regenerate(key)}>Try another version</button><button type="button" onClick={() => regenerate(key, true)}>Restore generated</button></>}</span></div><textarea aria-label={label} value={String(content[key])} onChange={(event) => updateContent({ ...content, [key]: event.target.value })} /></article>)}</section>
      <section className="lesson-editor__palette"><div className="section-heading"><div><p className="eyebrow">PALETTE</p><h2>Adjust the color plan.</h2></div><button type="button" onClick={() => regenerate("palette")}>Try another palette</button></div>{content.palette.map((mix, index) => <div className="lesson-palette-row" key={mix.id}><input type="color" aria-label={`${mix.name} color`} value={mix.swatch} onChange={(event) => updateContent({ ...content, palette: content.palette.map((item, itemIndex) => itemIndex === index ? { ...item, swatch: event.target.value } : item) })} /><input aria-label={`Palette color ${index + 1} name`} value={mix.name} onChange={(event) => updateContent({ ...content, palette: content.palette.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} /><input aria-label={`${mix.name} formula`} value={mix.formula} onChange={(event) => updateContent({ ...content, palette: content.palette.map((item, itemIndex) => itemIndex === index ? { ...item, formula: event.target.value } : item) })} /><button type="button" disabled={content.palette.length <= 2} onClick={() => updateContent({ ...content, palette: content.palette.filter((_, itemIndex) => itemIndex !== index) })}>Remove</button></div>)}</section>
      <section className="lesson-editor__structured" aria-labelledby="lesson-editor-decisions"><div className="section-heading"><div><p className="eyebrow">PAINTING DECISIONS</p><h2 id="lesson-editor-decisions">Edit the practical guidance.</h2></div></div><label>Materials, one per line<textarea value={content.materials.join("\n")} onChange={(event) => updateContent({ ...content, materials: event.target.value.split("\n").filter(Boolean) })} /></label>{(["hard", "soft", "lost"] as const).map((key) => <label key={key}>{key[0].toUpperCase() + key.slice(1)} edges<textarea value={content.edges[key]} onChange={(event) => updateContent({ ...content, edges: { ...content.edges, [key]: event.target.value } })} /></label>)}{(["preserve", "simplify", "exaggerate", "omit"] as const).map((key) => <label key={key}>{key[0].toUpperCase() + key.slice(1)}, one per line<textarea value={content.details[key].join("\n")} onChange={(event) => updateContent({ ...content, details: { ...content.details, [key]: event.target.value.split("\n").filter(Boolean) } })} /></label>)}</section>
      <section className="lesson-editor__structured" aria-labelledby="lesson-editor-detours"><div className="section-heading"><div><p className="eyebrow">COMMON DETOURS</p><h2 id="lesson-editor-detours">Keep corrections useful.</h2></div><button type="button" onClick={() => regenerate("common_mistakes")}>Try another version detours</button></div>{content.common_mistakes.map((item, index) => <div className="lesson-editor__paired" key={item.id}><label>Mistake<input value={item.mistake} onChange={(event) => updateContent({ ...content, common_mistakes: content.common_mistakes.map((mistake, itemIndex) => itemIndex === index ? { ...mistake, mistake: event.target.value } : mistake) })} /></label><label>Correction<textarea value={item.correction} onChange={(event) => updateContent({ ...content, common_mistakes: content.common_mistakes.map((mistake, itemIndex) => itemIndex === index ? { ...mistake, correction: event.target.value } : mistake) })} /></label></div>)}</section>
      <section className="lesson-editor__stages"><div className="section-heading"><div><p className="eyebrow">PAINTING SEQUENCE</p><h2>Edit the steps.</h2>{draft.schema_version === "painting-lesson.v2" && <p className="lesson-editor__structure-note">Step order and count are locked to protect the visual progression. Change the step count from the preview step.</p>}</div>{draft.schema_version !== "painting-lesson.v2" && <button type="button" disabled={content.stages.length >= 5} onClick={() => updateContent({ ...content, stages: [...content.stages, { ...content.stages[content.stages.length - 1], id: crypto.randomUUID(), title: "New painting step", short_title: "New" }] })}>Add step</button>}</div>{content.stages.map((stage, index) => <article key={stage.id}><div className="lesson-stage-editor__actions"><span>Step {index + 1}</span>{draft.schema_version !== "painting-lesson.v2" && <><button type="button" disabled={index === 0} onClick={() => { const stages = [...content.stages]; [stages[index - 1], stages[index]] = [stages[index], stages[index - 1]]; updateContent({ ...content, stages }); }}>Move up</button><button type="button" disabled={index === content.stages.length - 1} onClick={() => { const stages = [...content.stages]; [stages[index + 1], stages[index]] = [stages[index], stages[index + 1]]; updateContent({ ...content, stages }); }}>Move down</button><button type="button" disabled={content.stages.length <= 1} onClick={() => updateContent({ ...content, stages: content.stages.filter((item) => item.id !== stage.id) })}>Remove</button></>}<button type="button" onClick={() => regenerate(`stages.${stage.id}`)}>Try another version</button></div><label>Step title<input value={stage.title} onChange={(event) => updateContent({ ...content, stages: content.stages.map((item) => item.id === stage.id ? { ...item, title: event.target.value } : item) })} /></label>{draft.schema_version === "painting-lesson.v2" && <><label>Step action<input maxLength={180} value={stage.checkpoint_action || ""} onChange={(event) => updateContent({ ...content, stages: content.stages.map((item) => item.id === stage.id ? { ...item, checkpoint_action: event.target.value } : item) })} /></label><label>Approach steps, one per line<textarea value={(stage.approach_steps || []).join("\n")} onChange={(event) => updateContent({ ...content, stages: content.stages.map((item) => item.id === stage.id ? { ...item, approach_steps: event.target.value.split("\n").filter(Boolean).slice(0, 3).map((step) => step.slice(0, 180)) } : item) })} /></label></>}<label>On your paper<textarea value={stage.instruction} onChange={(event) => updateContent({ ...content, stages: content.stages.map((item) => item.id === stage.id ? { ...item, instruction: event.target.value } : item) })} /></label><label>Look for<textarea value={stage.look_for} onChange={(event) => updateContent({ ...content, stages: content.stages.map((item) => item.id === stage.id ? { ...item, look_for: event.target.value } : item) })} /></label></article>)}</section>
      <section className="lesson-editor__structured" aria-labelledby="lesson-editor-guide"><div className="section-heading"><div><p className="eyebrow">A LITTLE MORE TO EXPLORE</p><h2 id="lesson-editor-guide">Refine the long-form session.</h2></div><button type="button" onClick={() => regenerate("teaching_guide")}>Try another set of tips</button></div><label>8-minute notice<textarea value={content.timed_study.notice} onChange={(event) => updateContent({ ...content, timed_study: { ...content.timed_study, notice: event.target.value } })} /></label><label>8-minute start<textarea value={content.timed_study.start} onChange={(event) => updateContent({ ...content, timed_study: { ...content.timed_study, start: event.target.value } })} /></label><label>8-minute check<textarea value={content.timed_study.check} onChange={(event) => updateContent({ ...content, timed_study: { ...content.timed_study, check: event.target.value } })} /></label>{content.teaching_guide.map((section, index) => <div className="lesson-editor__paired" key={section.id}><label>Guide heading<input value={section.title} onChange={(event) => updateContent({ ...content, teaching_guide: content.teaching_guide.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) })} /></label><label>Guide text<textarea value={section.body} onChange={(event) => updateContent({ ...content, teaching_guide: content.teaching_guide.map((item, itemIndex) => itemIndex === index ? { ...item, body: event.target.value } : item) })} /></label></div>)}<label>Reflection prompts, one per line<textarea value={content.reflection_prompts.join("\n")} onChange={(event) => updateContent({ ...content, reflection_prompts: event.target.value.split("\n").filter(Boolean) })} /></label></section>
      </div></details>
      <div className="lesson-editor__bar lesson-editor__bar--bottom"><span>{dirty ? "Review complete? Save this version." : "Your painting session is ready."}</span><button type="button" onClick={save} disabled={!dirty && Boolean(draft.saved_at) || working === "save"}>Save session</button></div>
    </article>
  );
}
