import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  STYLE_GUIDE_BY_SLUG,
  STYLE_GUIDE_ENTRIES,
  STYLE_REFERENCE_SUBJECTS,
  isStyleGuideSlug,
  type StyleGuideAsset,
  type StyleGuideEntry,
} from "./style-catalog";
import { FEELING_FIRST_GALLERY } from "./emotion-study-catalog";
import { FeelingFirstStudy } from "./feeling-first";
import { AppNav } from "./navigation";

function StyleImage({ asset, className }: { asset: StyleGuideAsset; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={`style-guide-image-fallback ${className ?? ""}`} role="img" aria-label={asset.alt}>
        <span>Reference image unavailable</span>
        <p>{asset.alt}</p>
      </div>
    );
  }
  return (
    <img
      className={className}
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt={asset.alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export function StyleGuideGallery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const subject = STYLE_REFERENCE_SUBJECTS.find(
    (candidate) => candidate.slug === searchParams.get("subject"),
  ) ?? STYLE_REFERENCE_SUBJECTS[0];
  const variant = subject.variants.find(
    (candidate) => candidate.style === searchParams.get("style"),
  ) ?? subject.variants[0];

  function chooseReference(subjectSlug: string, styleSlug: string) {
    const next = new URLSearchParams();
    next.set("subject", subjectSlug);
    next.set("style", styleSlug);
    setSearchParams(next, { replace: true });
  }

  return (
    <>
      <header className="style-guide-hero style-guide-hero--compact">
        <div>
          <p className="eyebrow">CURATED STYLE REFERENCE GUIDE</p>
          <h1>Style reference studio.</h1>
          <p className="lede">
            Choose a subject, switch its drawing language, and compare how construction,
            staging, light, and mark-making change without searching through a long gallery.
          </p>
        </div>
        <aside>
          <span>Reference studio</span>
          <strong>{STYLE_REFERENCE_SUBJECTS.length} subjects × {STYLE_GUIDE_ENTRIES.length} styles</strong>
          <p>Every pairing is available immediately.</p>
        </aside>
      </header>

      <section className="feeling-first-card" aria-labelledby="feeling-first-card-title">
        <img
          src={FEELING_FIRST_GALLERY.thumbnail.src}
          width={FEELING_FIRST_GALLERY.thumbnail.width}
          height={FEELING_FIRST_GALLERY.thumbnail.height}
          alt={FEELING_FIRST_GALLERY.thumbnail.alt}
          loading="lazy"
          decoding="async"
        />
        <div>
          <p className="eyebrow">NEW · EMOTIONAL SPACE GALLERY</p>
          <h2 id="feeling-first-card-title">One premise. Five feelings.</h2>
          <p>Move from sadness to joy through five completely different celestial interpretations. See how setting, viewpoint, light, and subject change what an image feels like.</p>
          <Link className="button-link" to="/?view=feeling-first&emotion=pensive">Explore the gallery →</Link>
        </div>
      </section>

      <section className="style-reference-studio" aria-labelledby="reference-studio-title">
        <h2 className="sr-only" id="reference-studio-title">Interactive style reference selector</h2>
        <div className="style-reference-controls">
          <fieldset>
            <legend><span>01</span> Choose a subject</legend>
            <div className="style-reference-subjects">
              {STYLE_REFERENCE_SUBJECTS.map((candidate) => (
                <button
                  type="button"
                  key={candidate.slug}
                  className={candidate.slug === subject.slug ? "is-selected" : ""}
                  aria-pressed={candidate.slug === subject.slug}
                  onClick={() => chooseReference(candidate.slug, variant.style)}
                >
                  <StyleImage asset={candidate.selectorImage} />
                  <span><strong>{candidate.label}</strong><small>{candidate.description}</small></span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend><span>02</span> Choose a drawing language</legend>
            <div className="style-reference-styles">
              {subject.variants.map((candidate) => (
                <button
                  type="button"
                  key={candidate.style}
                  className={candidate.style === variant.style ? "is-selected" : ""}
                  aria-pressed={candidate.style === variant.style}
                  onClick={() => chooseReference(subject.slug, candidate.style)}
                >
                  <strong>{candidate.label}</strong>
                  <small>{candidate.treatment}</small>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="style-reference-workspace">
          <figure>
            <StyleImage
              key={`${subject.slug}-${variant.style}`}
              asset={variant.reference}
              className="style-reference-workspace__image"
            />
            <figcaption>{variant.reference.alt}</figcaption>
          </figure>

          <aside aria-live="polite">
            <p className="eyebrow">{subject.label}</p>
            <h2>{variant.label}</h2>
            <strong>{variant.treatment}</strong>
            <p>{subject.description}</p>
            <div className="style-reference-actions">
              <a href={variant.reference.src} target="_blank" rel="noreferrer">Open full image ↗</a>
              {variant.guidePath && <Link to={`/?view=guide&style=${variant.style}`}>Open teaching guide →</Link>}
            </div>
            {subject.futureNote && (
              <small className="style-reference-future-note">
                <strong>Future revisit:</strong> {subject.futureNote}
              </small>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}

export function StyleGuideDetail({ entry }: { entry: StyleGuideEntry }) {
  const styleSlug = entry.slug;
  const index = STYLE_GUIDE_ENTRIES.findIndex((candidate) => candidate.slug === styleSlug);
  const previous = STYLE_GUIDE_ENTRIES[(index - 1 + STYLE_GUIDE_ENTRIES.length) % STYLE_GUIDE_ENTRIES.length];
  const next = STYLE_GUIDE_ENTRIES[(index + 1) % STYLE_GUIDE_ENTRIES.length];

  return (
      <article className={`style-guide-detail style-guide-detail--${entry.slug}`}>
        <header className="style-guide-detail__header">
          <div>
            <Link className="text-link" to="/">← Comparison studio</Link>
            <p className="eyebrow">STYLE {String(index + 1).padStart(2, "0")} OF 05</p>
            <h1>{entry.label}</h1>
            <p className="style-guide-kicker">{entry.kicker}</p>
            <p className="lede">{entry.definition}</p>
          </div>
          <aside><span>Primary medium</span><strong>{entry.medium}</strong></aside>
        </header>

        <section className="style-guide-showcase" aria-labelledby="finished-reference-title">
          <div className="section-heading">
            <div><p className="eyebrow">FINISHED REFERENCE</p><h2 id="finished-reference-title">See the full visual language.</h2></div>
            <p>Use for direction, not tracing.</p>
          </div>
          <figure>
            <StyleImage asset={entry.reference} className="style-guide-full-image" />
            <figcaption>{entry.reference.alt}</figcaption>
          </figure>
        </section>

        <section className="style-guide-traits" aria-labelledby="defining-traits-title">
          <div><p className="eyebrow">DEFINING TRAITS</p><h2 id="defining-traits-title">What makes it read this way.</h2></div>
          <ul>{entry.traits.map((trait) => <li key={trait}>{trait}</li>)}</ul>
        </section>

        <section className="style-guide-learner" aria-labelledby="learner-reference-title">
          <figure>
            <StyleImage asset={entry.learnerReference} className="style-guide-full-image" />
            <figcaption>{entry.learnerReference.alt}</figcaption>
          </figure>
          <div>
            <p className="eyebrow">LEARNER REFERENCE</p>
            <h2 id="learner-reference-title">The same idea, made attainable.</h2>
            <p>This reduced version keeps the style’s core structure while lowering the number of shapes, edges, colors, and finishing marks you need to manage at once.</p>
            <blockquote>{entry.practicePrompt}</blockquote>
          </div>
        </section>

        <section className="style-guide-recipe" aria-labelledby="visual-recipe-title">
          <div className="section-heading">
            <div><p className="eyebrow">VISUAL RECIPE</p><h2 id="visual-recipe-title">Seven decisions behind the result.</h2></div>
            <p>Read top to bottom.</p>
          </div>
          <dl>
            {Object.entries(entry.visualRecipe).map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        </section>

        <section className="style-guide-process" aria-labelledby="process-sheet-title">
          <div className="section-heading">
            <div><p className="eyebrow">FOUR-STAGE PROCESS</p><h2 id="process-sheet-title">From blank page to finish.</h2></div>
            <p>Each panel has a written equivalent below.</p>
          </div>
          <figure>
            <StyleImage asset={entry.process} className="style-guide-full-image" />
            <figcaption>{entry.process.alt}</figcaption>
          </figure>
          <ol className="style-guide-process-notes">
            {entry.processPanels.map((panel, panelIndex) => (
              <li key={panel.title}><span>{panelIndex + 1}</span><div><h3>{panel.title}</h3><p>{panel.description}</p></div></li>
            ))}
          </ol>
        </section>

        <section className="style-guide-steps" aria-labelledby="drawing-steps-title">
          <div><p className="eyebrow">ON YOUR PAGE</p><h2 id="drawing-steps-title">Four drawing steps.</h2></div>
          <ol>
            {entry.steps.map((step, stepIndex) => (
              <li key={step.title}>
                <span>{String(stepIndex + 1).padStart(2, "0")}</span>
                <div><h3>{step.title}</h3><p>{step.instruction}</p><small><strong>Check:</strong> {step.checkpoint}</small></div>
              </li>
            ))}
          </ol>
        </section>

        <section className="style-guide-practical">
          <article aria-labelledby="materials-title">
            <p className="eyebrow">MATERIALS</p><h2 id="materials-title">A useful starting kit.</h2>
            <ul>{entry.materials.map((material) => <li key={material}>{material}</li>)}</ul>
          </article>
          <article aria-labelledby="mistakes-title">
            <p className="eyebrow">COMMON DETOURS</p><h2 id="mistakes-title">What to correct first.</h2>
            <ul>{entry.commonMistakes.map((item) => <li key={item.mistake}><strong>{item.mistake}</strong><span>{item.correction}</span></li>)}</ul>
          </article>
        </section>

        {entry.futureNote && <aside className="style-guide-future-note"><p className="eyebrow">FUTURE EXPANSION</p><p>{entry.futureNote}</p></aside>}

        <nav className="style-guide-pagination" aria-label="Browse style guides">
          <Link to={`/?view=guide&style=${previous.slug}`}><span>Previous</span><strong>← {previous.label}</strong></Link>
          <Link to="/"><span>Overview</span><strong>Compare all styles</strong></Link>
          <Link to={`/?view=guide&style=${next.slug}`}><span>Next</span><strong>{next.label} →</strong></Link>
        </nav>
      </article>
  );
}

export function StyleStudioApp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view");
  const style = searchParams.get("style");
  const guide = isStyleGuideSlug(style) ? STYLE_GUIDE_BY_SLUG.get(style) : undefined;

  useEffect(() => {
    if (view === "guide" && !guide) {
      setSearchParams({ view: "guide", style: STYLE_GUIDE_ENTRIES[0].slug }, { replace: true });
    } else if (view && view !== "guide" && view !== "feeling-first") {
      setSearchParams({}, { replace: true });
    }
  }, [guide, setSearchParams, view]);

  const content = view === "guide" && guide
    ? <StyleGuideDetail entry={guide} />
    : view === "feeling-first"
      ? <FeelingFirstStudy />
      : <StyleGuideGallery />;

  return (
    <div className="site-shell">
      <AppNav />
      <main id="main-content">{content}</main>
      <footer className="site-footer">
        <span>Wanderline Style Studio</span>
        <p>Look closely. Choose boldly. Make it yours.</p>
      </footer>
    </div>
  );
}
