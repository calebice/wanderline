import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";

const basePath = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
const referenceImage = `${basePath}watercolor-lesson/lemon/reference.jpg`;
const processImage = `${basePath}watercolor-lesson/lemon/process.jpg`;
const storageKey = "wanderline.watercolor-lemon.v1";

type LessonStage = {
  title: string;
  shortTitle: string;
  time: string;
  waterState: string;
  principle: string;
  instruction: string;
  lookFor: string;
  moveOn: string;
  alt: string;
  palette: readonly PaletteMix[];
};

type PaletteMix = {
  name: string;
  swatch: string;
  formula: string;
  dilution: string;
  waterParts?: number;
};

const stages: readonly LessonStage[] = [
  {
    title: "Place the shape. Save the light.",
    shortTitle: "Plan",
    time: "3–5 min",
    waterState: "Dry paper",
    principle: "In transparent watercolor, the paper is your brightest paint.",
    instruction: "Draw the lemon and leaf with a light, searching line. Mark the highlight as a simple paper-white shape; do not shade it.",
    lookFor: "The lemon reads as one tilted oval with two small pointed ends. The leaf is one quieter shape, not a collection of veins.",
    moveOn: "Move on when the silhouette feels balanced and the highlight has a clear boundary.",
    alt: "Light graphite outline of one lemon and leaf on watercolor paper with the highlight reserved.",
    palette: [
      { name: "Paper light", swatch: "#f7f2e7", formula: "Leave unpainted", dilution: "0 paint" },
      { name: "Graphite guide", swatch: "#77736c", formula: "HB pencil", dilution: "Feather-light pressure" },
    ],
  },
  {
    title: "Make one luminous first wash.",
    shortTitle: "Wash",
    time: "4–6 min",
    waterState: "Wet paint on dry paper",
    principle: "More water makes a lighter, more transparent color—not a weaker decision.",
    instruction: "Mix a generous puddle of pale yellow. Paint the lemon as one connected shape around the highlight, then place one pale green leaf wash.",
    lookFor: "The wash stays glossy long enough to connect your strokes. Color is even enough to feel calm, with no scrubbing back into drying areas.",
    moveOn: "Let this layer become completely matte and cool to the touch before adding more color.",
    alt: "Pale transparent yellow and green first washes on a lemon and leaf with untouched paper showing through.",
    palette: [
      { name: "Lemon light", swatch: "#f4d860", formula: "Yellow", dilution: "1 : 8 dilution", waterParts: 8 },
      { name: "Leaf light", swatch: "#b4bf77", formula: "Yellow + blue · 3:1", dilution: "1 : 6 dilution", waterParts: 6 },
      { name: "Shadow hint", swatch: "#bac1d1", formula: "Blue + red · 2:1", dilution: "1 : 8 dilution", waterParts: 8 },
    ],
  },
  {
    title: "Charge color while the surface is damp.",
    shortTitle: "Shape",
    time: "6–8 min",
    waterState: "Damp sheen",
    principle: "Damp paper lets pigment travel just far enough to turn a flat wash into form.",
    instruction: "Touch warmer yellow-orange into the lower-right lemon while the wash still has a soft sheen. Deepen the leaf with a cooler green and begin the cast shadow with blue-violet gray.",
    lookFor: "The new color feathers softly instead of exploding into a bloom or sitting as a hard stripe. The light side remains visibly lighter.",
    moveOn: "Stop touching the lemon when the sheen disappears. Let every area dry before the final glaze.",
    alt: "Partly developed watercolor lemon with warm damp-in-damp shadow, layered green leaf, and a pale cast shadow.",
    palette: [
      { name: "Warm turn", swatch: "#e9a742", formula: "Yellow + red · 4:1", dilution: "1 : 4 dilution", waterParts: 4 },
      { name: "Leaf middle", swatch: "#718944", formula: "Yellow + blue · 2:1", dilution: "1 : 3 dilution", waterParts: 3 },
      { name: "Cast shadow", swatch: "#8792ad", formula: "Blue + red · 2:1", dilution: "1 : 5 dilution", waterParts: 5 },
    ],
  },
  {
    title: "Glaze once. Accent selectively.",
    shortTitle: "Finish",
    time: "6–8 min",
    waterState: "Dry again",
    principle: "A glaze changes what is beneath it; it should clarify the form, not cover it.",
    instruction: "On fully dry paper, sweep one transparent warm glaze across the turning side. Strengthen the contact shadow, stem, leaf fold, and lemon tip with only a few darker marks.",
    lookFor: "The lemon feels round because of one clear light-to-shadow turn. The highlight still belongs to the paper and the darkest darks stay small.",
    moveOn: "Finish when the subject feels grounded. If a new mark will not explain form, edge, or contact, leave it out.",
    alt: "Finished attainable transparent watercolor of one lemon and leaf with a luminous highlight and soft blue-violet cast shadow.",
    palette: [
      { name: "Lemon glaze", swatch: "#dfa033", formula: "Yellow + red · 5:1", dilution: "1 : 3 dilution", waterParts: 3 },
      { name: "Deep green", swatch: "#3f5f2b", formula: "Blue + yellow · 1:2", dilution: "1 : 2 dilution", waterParts: 2 },
      { name: "Deep neutral", swatch: "#646375", formula: "Blue + red · 1:1", dilution: "1 : 2 dilution", waterParts: 2 },
    ],
  },
] as const;

function readSavedStage() {
  try {
    const saved = Number(window.localStorage.getItem(storageKey));
    return Number.isInteger(saved) && saved >= 0 && saved < stages.length ? saved : 0;
  } catch {
    return 0;
  }
}

function StageArtwork({ stage }: { stage: number }) {
  return (
    <div className="watercolor-stage-artwork">
      <img
        className={`watercolor-stage-sheet watercolor-stage-sheet--${stage + 1}`}
        src={processImage}
        width="1536"
        height="1024"
        alt={stages[stage].alt}
      />
    </div>
  );
}

function dilutionResult(waterParts: number) {
  if (waterParts >= 8) return "a very pale, luminous wash";
  if (waterParts >= 5) return "a light, transparent wash";
  if (waterParts >= 3) return "a middle-strength wash";
  return "a strong accent mix";
}

function DilutionGuide({ mix }: { mix: PaletteMix }) {
  const tooltipId = useId();

  if (!mix.waterParts) return <small>{mix.dilution}</small>;

  return (
    <span className="watercolor-dilution">
      <button type="button" aria-describedby={tooltipId}>
        {mix.dilution}
        <span aria-hidden="true">?</span>
      </button>
      <span className="watercolor-dilution__tooltip" id={tooltipId} role="tooltip">
        <strong>What 1 : {mix.waterParts} means</strong>
        <span className="watercolor-dilution__diagram" aria-hidden="true">
          <span className="watercolor-dilution__measure watercolor-dilution__measure--paint">
            <i style={{ backgroundColor: mix.swatch }} />
            <b>1×</b>
            <small>concentrated paint</small>
          </span>
          <b>+</b>
          <span className="watercolor-dilution__measure watercolor-dilution__measure--water">
            <i />
            <b>{mix.waterParts}×</b>
            <small>clean water</small>
          </span>
          <b>=</b>
          <span className="watercolor-dilution__measure watercolor-dilution__measure--result">
            <i style={{ backgroundColor: mix.swatch }} />
            <small>ready wash</small>
          </span>
        </span>
        <span>Awaken the paint and make the color shown above as a concentrated puddle. Using the same brush, combine one full brush-load of that prepared paint with {mix.waterParts} equally full brush-loads of clean water.</span>
        <em>Expected result: {dilutionResult(mix.waterParts)}. Test it on scrap paper before painting.</em>
      </span>
    </span>
  );
}

function StagePalette({ palette }: { palette: readonly PaletteMix[] }) {
  return (
    <section className="watercolor-palette" aria-labelledby="watercolor-palette-title">
      <div className="watercolor-palette__header">
        <h3 id="watercolor-palette-title">Mix for this stage</h3>
        <p>Color ratios compare pigments; dilution compares one brush-load of concentrated prepared paint to water.</p>
      </div>
      <ul className="watercolor-palette__mixes">
        {palette.map((mix) => (
          <li key={mix.name}>
            <span className="watercolor-palette__swatch" style={{ backgroundColor: mix.swatch }} aria-hidden="true" />
            <span className="watercolor-palette__details">
              <strong>{mix.name}</strong>
              <span>{mix.formula}</span>
              <DilutionGuide mix={mix} />
            </span>
          </li>
        ))}
      </ul>
      <p className="watercolor-palette__note">Start here, then test a swatch—pigment strength varies by brand.</p>
    </section>
  );
}

export function WatercolorLesson() {
  const [activeStage, setActiveStage] = useState(readSavedStage);
  const [showReference, setShowReference] = useState(false);
  const [completed, setCompleted] = useState(false);
  const stage = stages[activeStage];

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, String(activeStage));
    } catch {
      // The lesson remains fully usable when browser storage is unavailable.
    }
  }, [activeStage]);

  function chooseStage(index: number) {
    setActiveStage(index);
    setShowReference(false);
    setCompleted(false);
  }

  return (
    <article className="watercolor-lesson">
      <header className="watercolor-lesson__header">
        <div>
          <Link className="text-link" to="/?view=guide&style=watercolor">← Watercolor guide</Link>
          <p className="eyebrow">GUIDED WATERCOLOR · ONE LEMON</p>
          <h1>Understand the water.</h1>
          <p className="lede">Paint one simple subject in four visible stages. The goal is to notice when the paper is dry, glossy, damp, and dry again—and to know what each state lets you do.</p>
        </div>
        <aside>
          <span>Active painting time</span>
          <strong>20–30 minutes</strong>
          <p>Drying pauses are part of the lesson. Advance when the paper is ready, not when a timer says so.</p>
        </aside>
      </header>

      <section className="watercolor-principle-strip" aria-label="Watercolor lesson sequence">
        {stages.map((item, index) => (
          <button
            type="button"
            key={item.shortTitle}
            className={index === activeStage ? "is-active" : index < activeStage ? "is-past" : ""}
            aria-current={index === activeStage ? "step" : undefined}
            onClick={() => chooseStage(index)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{item.shortTitle}</strong>
            <small>{item.waterState}</small>
          </button>
        ))}
      </section>

      <section className="watercolor-workspace" aria-labelledby="watercolor-stage-title">
        <div className="watercolor-visual">
          <div className="watercolor-view-toggle" aria-label="Lesson image view">
            <button type="button" className={!showReference ? "is-selected" : ""} aria-pressed={!showReference} onClick={() => setShowReference(false)}>Current stage</button>
            <button type="button" className={showReference ? "is-selected" : ""} aria-pressed={showReference} onClick={() => setShowReference(true)}>Reference photo</button>
          </div>
          {showReference ? (
            <img className="watercolor-reference" src={referenceImage} width="1536" height="1024" alt="Single yellow lemon with one green leaf and a soft shadow on a warm white surface." />
          ) : (
            <StageArtwork stage={activeStage} />
          )}
          <p>{showReference ? "Observe the large light, middle, and shadow shapes. Ignore the peel texture." : `Stage ${activeStage + 1} of ${stages.length} · ${stage.waterState}`}</p>
          <StagePalette palette={stage.palette} />
        </div>

        <aside className="watercolor-instruction" aria-live="polite">
          <div className="watercolor-stage-meta">
            <span>{stage.time}</span>
            <span>{stage.waterState}</span>
          </div>
          <p className="eyebrow">STEP {String(activeStage + 1).padStart(2, "0")}</p>
          <h2 id="watercolor-stage-title">{stage.title}</h2>
          <blockquote>{stage.principle}</blockquote>
          <div className="watercolor-instruction__section">
            <h3>On your paper</h3>
            <p>{stage.instruction}</p>
          </div>
          <div className="watercolor-instruction__section">
            <h3>Look for</h3>
            <p>{stage.lookFor}</p>
          </div>
          <div className="watercolor-ready-cue">
            <strong>Ready for the next stage?</strong>
            <p>{stage.moveOn}</p>
          </div>

          <div className="watercolor-stage-actions">
            <button type="button" disabled={activeStage === 0} onClick={() => chooseStage(activeStage - 1)}>← Previous</button>
            {activeStage < stages.length - 1 ? (
              <button type="button" onClick={() => chooseStage(activeStage + 1)}>Next stage →</button>
            ) : (
              <button type="button" onClick={() => setCompleted(true)}>Finish lesson</button>
            )}
          </div>
        </aside>
      </section>

      {completed && (
        <section className="watercolor-complete" aria-live="polite">
          <div>
            <p className="eyebrow">LESSON COMPLETE</p>
            <h2>You practiced the rhythm of watercolor.</h2>
            <p>Reserve the light. Connect the first wash. Add pigment while damp. Glaze only when dry.</p>
          </div>
          <button type="button" onClick={() => chooseStage(0)}>Paint it again</button>
        </section>
      )}

      <section className="watercolor-lesson-kit" aria-labelledby="watercolor-kit-title">
        <div>
          <p className="eyebrow">SMALL KIT · CLEAR JOBS</p>
          <h2 id="watercolor-kit-title">Set up before the paper gets wet.</h2>
        </div>
        <ul>
          <li><strong>Paper</strong><span>Cold-pressed watercolor paper, postcard size or larger</span></li>
          <li><strong>Brush</strong><span>One medium round with a good point</span></li>
          <li><strong>Color</strong><span>Transparent yellow, warm red, and blue</span></li>
          <li><strong>Water</strong><span>Two cups: one to rinse, one to keep clean</span></li>
          <li><strong>Cloth</strong><span>For controlling the brush, not scrubbing the paper</span></li>
        </ul>
      </section>
    </article>
  );
}
