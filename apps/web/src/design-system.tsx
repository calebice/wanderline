import { useRef, useState, type CSSProperties } from "react";
import { GardenButton, GardenChoices, GardenEmpty, GardenHeading, GardenInput, GardenLink, GardenNotice, GardenSelect } from "./garden-ui";
import { StudioDialog } from "./studio-ui";
import { PaintingRecipeSheet } from "./painting-recipe";
import { STYLE_REFERENCE_SUBJECTS } from "./style-catalog";
import { FEELING_FIRST_GALLERY } from "./emotion-study-catalog";
import type { PaintingLesson } from "./lesson-model";
import apple from "../e2e/fixtures/simple-recipe-v1/apple.json";
import applePainting from "../e2e/fixtures/simple-recipe-v1/painting.png";
import appleOutline from "../e2e/fixtures/simple-recipe-v1/outline.png";
import "./design-system.css";
import { ColorMixingProposal } from "./color-mixing-proposal";
import { EMILY_LEX_PAINTS } from "./color-mixing-examples";
import "./color-library.css";
import { readyPaintingReferences } from "./reference-model";
import { ReferenceRail } from "./reference-rail";

// Reuse the frozen content without changing its fixture or contacting the lesson API.
const referenceLesson: PaintingLesson = {
  ...(apple as PaintingLesson),
  assets: apple.assets.map((asset) => ({ ...asset, image_url: asset.role === "tracing_outline" ? appleOutline : applePainting })) as PaintingLesson["assets"],
};
const exampleOptions = [
  { value: "home", label: "Reference carousel" },
  { value: "explore", label: "Explore" },
  { value: "artwork", label: "Artwork stage" },
  { value: "recipe", label: "Painting recipe" },
  { value: "sessions", label: "Sessions" },
  { value: "recovery", label: "Preview recovery" },
  { value: "form", label: "Form & dialog" },
  { value: "settings", label: "Settings" },
  { value: "mixing", label: "Color mixing" },
  { value: "library", label: "Color Library" },
] as const;
type Example = (typeof exampleOptions)[number]["value"];
const exampleNotes: Record<Example, string> = {
  home: "Approved home pattern: a manual horizontal rail of completed generated references. It supports touch, keyboard, and visible controls, never advances on its own, and leaves the next card partly visible.",
  mixing: "Production-approved composition: choose a family, then a shade. The 36 versioned starting mixtures use one to three paints; numbered highlights show order. Saving here remains a local demonstration and never changes learner history.",
  library: "The Color Library reuses the collection and focused-form patterns. Set coverage makes missing single-paint swatches visible; physical swatches follow in a filterable gallery without claiming calibrated color matching.",
  explore: "Compact heading, one action, and artwork. Paper grain and pigment provide the character.",
  artwork: "The artwork can set the mood. The production Feeling First slider is preserved unchanged; these buttons demonstrate the general artwork-control pattern.",
  recipe: "Compact presentation of the frozen apple fixture. Select the artwork to enlarge it. Production recipes retain their approved layout.",
  sessions: "Titles, artwork, and a useful next action. Filters stay compact; an empty collection offers one way forward.",
  recovery: "A paid preview remains visible when automatic review raises a concern. Use one short, category-based explanation and let the learner keep it or explicitly request another version.",
  form: "Visible labels, short hints, and errors beside the field. Secondary decisions belong in a dialog. This example saves only in memory.",
  settings: "Utility pages use the same typography and controls, with restrained surfaces and explicit labels. Figures here are local sample data.",
};

const referenceCarouselExamples = readyPaintingReferences([
  { ...referenceLesson, id: "reference-apple", title: "A red apple", estimated_duration_minutes: 20 },
  { ...referenceLesson, id: "reference-orchard", title: "Quiet orchard light", estimated_duration_minutes: 30, updated_at: "2026-09-10T15:16:39.342667Z" },
  { ...referenceLesson, id: "reference-window", title: "Herbs by the window", estimated_duration_minutes: 25, updated_at: "2026-09-11T15:16:39.342667Z" },
]);

const controlDirections = [
  { id: "paint", title: "1 · Soft pigment", note: "Filled green, softly uneven corners, and subtle pigment depth." },
  { id: "edge", title: "2 · Pigment edge", note: "Pale interiors with a stronger green edge. Lighter overall." },
  { id: "ink", title: "3 · Ink & paper", note: "Crisp lines, quiet corners, and solid color. Character from typography." },
] as const;

function ControlComparison() {
  const [view, setView] = useState("color");
  const [title, setTitle] = useState("A red apple");
  const [size, setSize] = useState("medium");
  const [saved, setSaved] = useState(false);
  return <section className="design-section" id="design-control-comparison" aria-label="Control comparison">
    <div className="design-section__label"><h2>Compare the controls</h2><p>Preferred pairing: paper A with option 2, Pigment edge. The alternatives remain here for comparison.</p></div>
    <div className="control-comparison__grid">{controlDirections.map((direction) => <article className={`control-study control-study--${direction.id}`} key={direction.id} aria-label={direction.title}>
      <h3>{direction.title}</h3><p className="control-study__note">{direction.note}</p>
      <div className="control-study__controls">
        <span className="control-study__label">Actions</span><div className="garden-actions"><GardenButton onClick={() => setSaved(true)}>Save painting</GardenButton><GardenButton variant="secondary" onClick={() => { setSaved(false); setTitle("A red apple"); }}>Cancel</GardenButton><GardenButton variant="quiet" onClick={() => setSaved(false)}>Reset preview</GardenButton></div>
        <span className="control-study__label">Selection</span><GardenChoices label={`${direction.title} reference view`} value={view} onChange={setView} options={[{ value: "color", label: "Color" }, { value: "outline", label: "Outline" }]} />
        <GardenInput label="Painting title" value={title} onChange={(event) => { setTitle(event.target.value); setSaved(false); }} />
        <GardenSelect label="Outline size" value={size} onChange={(event) => setSize(event.target.value)}><option value="small">Small · 4 inches</option><option value="medium">Medium · 6 inches</option><option value="large">Large · 8 inches</option></GardenSelect>
        <GardenButton disabled>Preparing…</GardenButton>
      </div>
    </article>)}</div>
    <p aria-live="polite" className="garden-small">{saved ? "Painting saved for this preview only." : "Try hovering, pressing, selecting, and tabbing through the controls. No changes are saved."}</p>
  </section>;
}

function MaterialComparison() {
  const [open, setOpen] = useState<"paper" | "wash" | null>(null);
  return <section className="design-section material-comparison" id="design-material-comparison" aria-label="Material comparison">
    <div className="design-section__label"><h2>Compare the atmosphere</h2><p>Same content and controls. Two ways to give the paper character.</p></div>
    <div className="material-comparison__grid">{(["paper", "wash"] as const).map((treatment) => <article key={treatment}>
      <h3>{treatment === "paper" ? "A · Paper with traces of paint" : "B · A continuous watercolor wash"}</h3>
      <p>{treatment === "paper" ? "Mostly warm paper, with a faint pigment trace at the edge." : "A flowing sage wash, with uneven color and a clear center."}</p>
      <div className={`material-sample material-sample--${treatment}`}>
        <GardenHeading title="Choose a painting" level={3} />
        <figure><img src={applePainting} alt="A red watercolor apple" /><figcaption>A red apple · Three simple steps</figcaption></figure>
        <div className="garden-actions"><GardenButton onClick={() => setOpen(treatment)}>Start painting</GardenButton><GardenButton variant="secondary" onClick={() => setOpen(treatment)}>Preview dialog</GardenButton></div>
        <GardenInput label="Painting title" defaultValue="A red apple" />
      </div>
    </article>)}</div>
    <p className="garden-small">Compare what catches your eye first: the apple, the action, or the background. A is your preferred surface direction. B remains here for comparison.</p>
    <StudioDialog open={open !== null} onClose={() => setOpen(null)} label="Material preview" className={`garden-dialog material-sample material-sample--${open ?? "paper"}`}>
      <GardenHeading title="Name your painting" level={2} /><GardenInput label="Painting title" defaultValue="A red apple" /><div className="garden-actions"><GardenButton onClick={() => setOpen(null)}>Done</GardenButton></div>
    </StudioDialog>
  </section>;
}

function ExploreExample({ onPaint }: { onPaint: () => void }) {
  const subjects = STYLE_REFERENCE_SUBJECTS.slice(0, 3);
  return <div className="garden-page-example">
    <GardenHeading title="Choose a painting" expressive action={<GardenButton onClick={onPaint}>Start painting</GardenButton>} />
    <div className="garden-art-grid">{subjects.map((subject) => {
      const art = subject.variants.find((variant) => variant.style === "watercolor")!;
      return <button className="garden-art-card" key={subject.slug} onClick={onPaint} type="button"><img src={art.thumbnail.src} alt={art.thumbnail.alt} /><span><strong>{subject.label}</strong><span>Watercolor study <span aria-hidden="true">↗</span></span></span></button>;
    })}</div>
  </div>;
}

function ReferenceCarouselExample({ onPaint }: { onPaint: () => void }) {
  return <div className="garden-page-example"><ReferenceRail references={referenceCarouselExamples} action={() => <GardenButton onClick={onPaint}>Paint this reference</GardenButton>} /></div>;
}

function ArtworkExample() {
  const [feeling, setFeeling] = useState(FEELING_FIRST_GALLERY.defaultInterpretation);
  const selected = FEELING_FIRST_GALLERY.interpretations.find((item) => item.slug === feeling)!;
  return <div className="garden-page-example">
    <GardenHeading title="Feeling First" />
    <div className="garden-art-stage">
      <div className="garden-art-stage__controls"><GardenChoices label="Example feeling" value={feeling} onChange={setFeeling} options={FEELING_FIRST_GALLERY.interpretations.map((item) => ({ value: item.slug, label: item.emotion }))} /></div>
      <figure><img src={selected.artwork.src} alt={selected.artwork.alt} width={1536} height={1024} /><figcaption><h3>{selected.title}</h3><p>{selected.prompt}</p></figcaption></figure>
    </div>
  </div>;
}

function SessionsExample({ onPaint }: { onPaint: () => void }) {
  const [filter, setFilter] = useState("all");
  return <div className="garden-page-example">
    <GardenHeading title="Your painting sessions" action={<GardenButton onClick={onPaint}>Start painting</GardenButton>} />
    <GardenChoices label="Example session filter" value={filter} onChange={setFilter} options={[{ value: "all", label: "All sessions" }, { value: "saved", label: "Saved" }, { value: "progress", label: "In progress" }]} />
    {filter === "progress" ? <GardenEmpty title="No sessions in progress" action={<GardenButton onClick={onPaint}>Start painting</GardenButton>}>Choose a subject to begin a painting.</GardenEmpty> : <div className="garden-session-example"><img src={applePainting} alt="A simple red watercolor apple" /><div><p className="garden-eyebrow">Ready to paint · 20 minutes</p><h3>A red apple</h3><p>Three actions. A few colors.</p><GardenButton variant="secondary" onClick={onPaint}>Open session</GardenButton></div></div>}
  </div>;
}

function PreviewRecoveryExample({ onPaint }: { onPaint: () => void }) {
  return <div className="garden-page-example"><div className="lesson-error" role="status"><strong>This preview needs your eye.</strong><p>This version may be more detailed than a simple recipe usually calls for. You can keep it as it is or ask for a simpler version.</p><section className="rejected-preview" aria-label="Generated preview under review"><figure><img src={applePainting} alt="Generated watercolor apple" /><figcaption>Generated painting</figcaption></figure><figure><img src={appleOutline} alt="Matching apple outline" /><figcaption>Matching outline</figcaption></figure></section><div className="lesson-error__actions"><GardenButton onClick={onPaint}>Keep this version</GardenButton><GardenButton variant="secondary" onClick={onPaint}>Try a simpler version</GardenButton><GardenLink to="/settings/usage">Review AI usage</GardenLink></div></div></div>;
}

function FormExample() {
  const [title, setTitle] = useState("");
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState("medium");
  return <div className="garden-page-example garden-form-example">
    <GardenHeading title="Name your painting" /><form onSubmit={(event) => { event.preventDefault(); setError(!title.trim()); setSaved(Boolean(title.trim())); }}>
      <GardenInput label="Painting title" value={title} onChange={(event) => { setTitle(event.target.value); setError(false); setSaved(false); }} hint="A subject or a few words is enough." error={error ? "Enter a title to save this example." : undefined} />
      <div className="garden-actions"><GardenButton type="submit">Save example</GardenButton><GardenButton variant="secondary" onClick={() => setOpen(true)}>Outline options</GardenButton></div>
      {saved && <GardenNotice kind="success">“{title.trim()}” is saved for this preview.</GardenNotice>}
    </form>
    <StudioDialog open={open} onClose={() => setOpen(false)} label="Example outline options" className="garden-dialog">
      <div className="garden-form-example"><GardenHeading title="Outline options" level={2} /><GardenSelect label="Outline size" value={size} onChange={(event) => setSize(event.target.value)}><option value="small">Small · 4 inches</option><option value="medium">Medium · 6 inches</option><option value="large">Large · 8 inches</option></GardenSelect><div className="garden-actions"><GardenButton onClick={() => setOpen(false)}>Done</GardenButton></div></div>
    </StudioDialog>
  </div>;
}

function SettingsExample() {
  const [filter, setFilter] = useState("all");
  return <div className="garden-page-example"><GardenHeading title="Studio usage" /><div className="garden-metrics"><div><span>Recorded estimate</span><strong>$0.082</strong></div><div><span>Painting sessions</span><strong>1</strong></div><div><span>Unknown costs</span><strong>0</strong></div></div>
    <GardenSelect label="Show operations" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All operations</option><option value="preview">Painting preview</option><option value="layers">Layer board</option></GardenSelect>
    <div className="garden-table" role="region" aria-label="Example usage details" tabIndex={0}><table><caption>Example usage · USD</caption><thead><tr><th scope="col">Operation</th><th scope="col">Calls</th><th scope="col">Estimate</th></tr></thead><tbody>{[{ id: "preview", title: "Painting preview" }, { id: "layers", title: "Layer board" }].filter((row) => filter === "all" || row.id === filter).map((row) => <tr key={row.id}><th scope="row">{row.title}</th><td>1</td><td>$0.041</td></tr>)}</tbody></table></div>
    <p className="garden-small">Sample estimates for this reference; not live account usage.</p>
  </div>;
}

function ColorLibraryExample() {
  const recorded = new Set(EMILY_LEX_PAINTS.slice(0, 3).map(([name]) => name));
  return <div className="garden-page-example color-library">
    <GardenHeading title="Color Library" action={<GardenButton>Add a swatch</GardenButton>}><p>Keep a private record of how your paints and mixes look after they dry.</p></GardenHeading>
    <section className="color-library__coverage"><div><h2>Your paint set</h2><p>3 of 18 paints recorded</p></div><progress value={3} max={18}>3 of 18</progress><ul>{EMILY_LEX_PAINTS.map(([name, color]) => <li key={name} className={recorded.has(name) ? "is-recorded" : ""}><a href="#design-examples" onClick={(event) => event.preventDefault()}><span style={{ backgroundColor: color }} aria-hidden="true" /><strong>{name}</strong><small>{recorded.has(name) ? "Recorded" : "Add swatch"}</small></a></li>)}</ul></section>
    <GardenEmpty title="No mixed swatches yet" action={<GardenButton variant="secondary">Add a mixture</GardenButton>}>Single paints and mixtures share one physical color library.</GardenEmpty>
  </div>;
}

function ComponentExamples() {
  const [choice, setChoice] = useState("color");
  const [notice, setNotice] = useState<"info" | "loading" | "success" | "error">("info");
  const messages = { info: "This reference uses local examples.", loading: "Loading your sessions…", success: "Your painting session is ready to reopen.", error: "Your sessions couldn’t load. Try again." };
  return <section className="design-section" id="design-components"><div className="design-section__label"><span>03 / Building blocks</span><h2>Components</h2><p>Use an existing pattern before inventing another.</p></div>
    <div className="design-component-grid">
      <article><h3>Actions</h3><div className="garden-actions"><GardenButton onClick={() => setNotice("success")}>Save example</GardenButton><GardenButton variant="secondary" onClick={() => setNotice("info")}>Cancel</GardenButton><GardenLink to="/internal/design-system#design-foundations" onClick={() => document.getElementById("design-foundations")?.scrollIntoView()}>View foundations</GardenLink><GardenButton disabled>Preparing…</GardenButton></div><p className="garden-small">Pale fills and green edges distinguish actions without dark blocks. Selected controls also use an underline. Try hover, press, and keyboard focus.</p></article>
      <article><h3>Choices</h3><GardenChoices label="Reference view example" value={choice} onChange={setChoice} options={[{ value: "color", label: "Color" }, { value: "value", label: "Value" }]} /><p className="garden-small">Selected view: {choice}. Selection uses contrast and a pressed state, never color alone.</p></article>
      <article><h3>Fields</h3><GardenInput label="Subject" placeholder="A small bowl" hint="Name the main subject." /><GardenInput label="Painting title with an error" defaultValue="" error="Enter a title to continue." /></article>
      <article><h3>Feedback</h3><GardenChoices label="Feedback state" value={notice} onChange={setNotice} options={[{ value: "info", label: "Info" }, { value: "loading", label: "Loading" }, { value: "success", label: "Success" }, { value: "error", label: "Error" }]} /><GardenNotice kind={notice} action={notice === "error" ? <GardenButton variant="secondary" onClick={() => setNotice("success")}>Try again</GardenButton> : undefined}>{messages[notice]}</GardenNotice></article>
    </div>
  </section>;
}

export function DesignSystem() {
  const [example, setExample] = useState<Example>("explore");
  const exampleFrame = useRef<HTMLDivElement>(null);
  function navigateExample(next: Example) {
    setExample(next);
    requestAnimationFrame(() => {
      const frame = exampleFrame.current;
      if (!frame) return;
      frame.focus({ preventScroll: true });
      frame.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  function showRecipe() { navigateExample("recipe"); }
  return <div className="design-reference">
    <header className="design-masthead"><div><h1>Garden Studio</h1><p>Design reference · Revision 04</p></div></header>
    <div className="design-review-note"><span>Approved design system</span><p>Paper A + Pigment edge controls. Feeling First retains its original slider.</p></div>
    <nav className="design-index" aria-label="Design reference sections"><a href="#design-control-comparison">Compare controls</a><a href="#design-material-comparison">Compare materials</a><a href="#design-foundations">01 Foundations</a><a href="#design-examples">02 Page patterns</a><a href="#design-components">03 Components</a><a href="#design-voice">04 Voice & boundaries</a></nav>

    <div className="design-current">

    <section className="design-section" id="design-foundations"><div className="design-section__label"><span>01 / Foundations</span><h2>Color & materials</h2><p>Paper makes room. Green guides action. Pigment brings personality.</p></div>
      <div className="design-palette">{[
        ["Paper", "--theme-paper", "Surfaces"], ["Ink", "--theme-ink", "Primary text"], ["Forest", "--theme-primary-strong", "Primary actions"], ["Coral", "--theme-accent", "Expressive accent"], ["Gold", "--theme-highlight", "Expressive accent"], ["Blue", "--theme-info", "Supporting information"], ["Plum", "--theme-reflective", "Reflective accents"],
      ].map(([name, token, role]) => <div key={name}><span className="design-palette__paint" style={{ "--paint": `var(${token})` } as CSSProperties} /><strong>{name}</strong><small>{role}</small><code>{token}</code></div>)}</div>
      <div className="design-type-grid"><article><p className="garden-eyebrow">Display / Iowan Old Style → Palatino → Georgia</p><p className="design-type-specimen">Let the artwork lead.</p><p>Serif headings bring warmth; a clear hierarchy does the organizing.</p></article><article><p className="garden-eyebrow">Body / Avenir Next → Avenir → Segoe UI → System</p><p className="design-body-specimen">Paint the first wash lightly. Leave the brightest areas as paper.</p><p>Plain language, readable lines, and room to breathe.</p></article></div>
      <dl className="design-rules"><div><dt>Space</dt><dd>4 · 8 · 12 · 16 · 24 · 32 · 48 · 64<br />Rem-based rhythm</dd></div><div><dt>Shape</dt><dd>12px controls · 18px panels · 24px frames<br />Organic pigment; orderly controls</dd></div><div><dt>Motion</dt><dd>160ms color transitions<br />No decorative loops or required motion</dd></div><div><dt>Access</dt><dd>44px minimum controls · visible focus<br />Reflow at 200% text</dd></div></dl>
    </section>

    <section className="design-section" id="design-examples"><div className="design-section__label"><span>02 / Page patterns</span><h2>Page patterns</h2><p>Interactive examples using shared controls and local artwork.</p></div>
      <GardenChoices label="Page pattern" options={exampleOptions} value={example} onChange={navigateExample} />
      <p className="design-example-note">{exampleNotes[example]}</p>
      <div className="design-example-frame" ref={exampleFrame} tabIndex={-1} role="region" aria-label={`${exampleOptions.find((item) => item.value === example)!.label} page example`}>
        {example === "home" && <ReferenceCarouselExample onPaint={showRecipe} />}
        {example === "explore" && <ExploreExample onPaint={showRecipe} />}
        {example === "artwork" && <ArtworkExample />}
        {example === "recipe" && <PaintingRecipeSheet presentation="compact" lesson={referenceLesson} actions={<GardenButton variant="quiet" onClick={() => navigateExample("sessions")}>Your painting sessions</GardenButton>} />}
        {example === "sessions" && <SessionsExample onPaint={showRecipe} />}
        {example === "recovery" && <PreviewRecoveryExample onPaint={showRecipe} />}
        {example === "form" && <FormExample />}
        {example === "settings" && <SettingsExample />}
        {example === "mixing" && <ColorMixingProposal />}
        {example === "library" && <ColorLibraryExample />}
      </div>
    </section>

    <ComponentExamples />

    <section className="design-section" id="design-voice"><div className="design-section__label"><span>04 / Voice & boundaries</span><h2>Voice & boundaries</h2><p>Remove before adding. Every sentence and control should earn its place.</p></div>
      <div className="design-voice-grid"><article><span className="design-verdict">Use this</span><h3>No saved paintings yet</h3><p>Start a painting to save it here.</p><span className="design-copy-action">Start painting</span><ul><li>One clear next action</li><li>Encouragement through useful guidance</li><li>Artwork before explanation</li></ul></article><article className="design-avoid"><span className="design-verdict">Too much</span><h3>Your creative journey awaits</h3><p>Welcome to your cozy sanctuary of endless inspiration, where every brushstroke is a new beginning. Let’s discover all the wonderful possibilities together.</p><ul><li>Repeated introductions and decorative sections</li><li>Multiple competing primary actions</li><li>New styling for an existing pattern</li></ul></article></div>
      <div className="design-copy-table"><div><strong>Loading</strong><span>“Loading your sessions…”</span></div><div><strong>Error</strong><span>“Your sessions couldn’t load. Try again.”</span></div><div><strong>Success</strong><span>“Painting saved.”</span></div><div><strong>Instruction</strong><span>“Let the wash dry before adding the next color.”</span></div></div>
      <aside className="design-boundary"><h3>What can vary?</h3><p>Artwork stages can change atmosphere. Navigation, controls, type, and behavior stay familiar. Paper grain and soft pigment bring warmth to the frame and dialog surfaces; text and input interiors stay clear.</p><p>Reuse an approved pattern freely. Propose a new pattern for review before adding it, then update the written and live references together.</p></aside>
    </section>
    </div>
    <ControlComparison />
    <MaterialComparison />
  </div>;
}
