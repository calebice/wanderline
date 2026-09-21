import { useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams, type Location } from "react-router-dom";
import {
  STYLE_GUIDE_BY_SLUG,
  STYLE_GUIDE_ENTRIES,
  STYLE_REFERENCE_SUBJECTS,
  isStyleGuideSlug,
  type StyleGuideAsset,
  type StyleGuideEntry,
  type StyleGuideSlug,
} from "./style-catalog";
import { FEELING_FIRST_GALLERY } from "./emotion-study-catalog";
import { FeelingFirstStudy } from "./feeling-first";
import { ColorStudy } from "./color-study";
import { ColorMixingProposal } from "./color-mixing-proposal";
import { StartPaintingLink, StudioDialog, StudioConfirmationProvider } from "./studio-ui";
import { PaintingSessions, StudioHome, StudioSettings } from "./studio-pages";
import { AppNav } from "./navigation";
import { WatercolorLesson } from "./watercolor-lesson";
import { DesignSystem } from "./design-system";
import { LessonAssembly, LessonCreator, LessonEditor, LessonTargetReview, SavedLessonLibrary, SavedLessonView } from "./lesson-workflow";

const STUDY_LENSES: Record<StyleGuideSlug, { notice: string; start: string; check: string }> = {
  realism: {
    notice: "Find the largest light and dark families. Notice where edges sharpen nearby and soften with distance.",
    start: "Place the subject's outer envelope, horizon, and three value masses before drawing any texture.",
    check: "Proportion and perspective should feel convincing when every small detail is hidden.",
  },
  cartoon: {
    notice: "Look for the pushed silhouette, repeated shape family, and one proportion choice carrying the personality.",
    start: "Rebuild the subject with five large shapes, then choose one relationship to exaggerate.",
    check: "The idea should still read when interior lines and surface marks are removed.",
  },
  architectural: {
    notice: "Trace the main axes, repeated intervals, and shifts from heavy profile lines to lighter internal structure.",
    start: "Set the horizon or projection axes, draw one bounding volume, then divide it into measured parts.",
    check: "Repeated edges agree, openings align, and line weight explains what sits in front.",
  },
  watercolor: {
    notice: "Find the untouched paper, connected wet shapes, soft blooms, and few deliberately crisp focal edges.",
    start: "Reserve the brightest light and lay one pale, connected wash across the largest color family.",
    check: "Enough paper remains open, and the image reads before small dark accents are added.",
  },
  "anime-environment": {
    notice: "Follow the focal contrast, warm-and-cool color script, and layers that move from crisp foreground to quiet distance.",
    start: "Make a three-value thumbnail, then place one warm focal light inside the dominant cool atmosphere.",
    check: "Detail and sharp edges gather near the story focus instead of spreading evenly across the scene.",
  },
};

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
  const [imageMode, setImageMode] = useState<"color" | "value">("color");
  const subject = STYLE_REFERENCE_SUBJECTS.find(
    (candidate) => candidate.slug === searchParams.get("subject"),
  ) ?? STYLE_REFERENCE_SUBJECTS[0];
  const variant = subject.variants.find(
    (candidate) => candidate.style === searchParams.get("style"),
  ) ?? subject.variants[0];
  const studyLens = STUDY_LENSES[variant.style];

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
          <h1>Choose a painting</h1>
          <p className="lede">
            Choose a subject and a style.
          </p>
          <StartPaintingLink />
        </div>

      </header>



      <section className="style-reference-studio" aria-labelledby="reference-studio-title">
        <h2 className="sr-only" id="reference-studio-title">Interactive style reference selector</h2>
        <div className="style-reference-controls">
          <fieldset>
            <legend>Choose a subject</legend>
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
            <legend>Choose a style</legend>
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
              className={`style-reference-workspace__image${imageMode === "value" ? " is-value-view" : ""}`}
            />
            <fieldset className="style-reference-view-toggle">
              <legend>Reference view</legend>
              <button type="button" className={imageMode === "color" ? "is-selected" : ""} aria-pressed={imageMode === "color"} onClick={() => setImageMode("color")}>Full color</button>
              <button type="button" className={imageMode === "value" ? "is-selected" : ""} aria-pressed={imageMode === "value"} onClick={() => setImageMode("value")}>See light and dark</button>
            </fieldset>
            <figcaption>{variant.reference.alt}</figcaption>
          </figure>

          <aside aria-live="polite">
            <p className="eyebrow">{subject.label}</p>
            <h2>{variant.label}</h2>
            <strong>{variant.treatment}</strong>
            <p>{subject.description}</p>
            <section className="style-study-lens" aria-labelledby="style-study-lens-title">
              <div><p className="eyebrow">A FEW MINUTES TO EXPLORE</p><h3 id="style-study-lens-title">Turn looking into drawing.</h3></div>
              <dl>
                <div><dt>Notice</dt><dd>{studyLens.notice}</dd></div>
                <div><dt>Start</dt><dd>{studyLens.start}</dd></div>
                <div><dt>Check</dt><dd>{studyLens.check}</dd></div>
              </dl>
            </section>
            <div className="style-reference-actions">
              <a href={variant.reference.src} target="_blank" rel="noreferrer">Open full image ↗</a>
              {variant.guidePath && <Link to={`/explore/styles/${variant.style}`}>Tips to try →</Link>}
            </div>

          </aside>
        </div>
      </section>
      <section className="color-study-entry" aria-labelledby="color-study-entry-title">
        <div><h2 id="color-study-entry-title">Spend a little time with color.</h2><p>Explore gentle neighbors, bold opposites, and the colors in between.</p></div>
        <Link className="button-link" to="/explore/color-study">Explore Color Study</Link>
      </section>
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
          <h2 id="feeling-first-card-title">One premise. Five feelings.</h2>
          <p>Move from sadness to joy through five completely different celestial interpretations. See how setting, viewpoint, light, and subject change what an image feels like.</p>
          <Link className="button-link" to="/explore/feeling-first?emotion=pensive">Explore the gallery →</Link>
        </div>
      </section>
      <SavedLessonLibrary />
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
            <Link className="text-link" to="/explore">← Explore</Link>
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

        {entry.slug === "watercolor" && (
          <section className="watercolor-lesson-invitation" aria-labelledby="watercolor-lesson-invitation-title">
            <div>
              <p className="eyebrow">MAKE A LITTLE TIME</p>
              <h2 id="watercolor-lesson-invitation-title">See what the water is doing.</h2>
              <p>Paint one lemon through dry, glossy, damp, and dry-again steps. Each interval shows what to do, what to notice, and when the paper is ready to move on.</p>
            </div>
            <Link className="button-link" to="/explore/watercolor-lesson">Start the lemon session →</Link>
          </section>
        )}

        <details className="studio-guide-details"><summary>What gives this style its character?</summary><section className="style-guide-traits" aria-labelledby="defining-traits-title">
          <div><p className="eyebrow">DEFINING TRAITS</p><h2 id="defining-traits-title">What makes it read this way.</h2></div>
          <ul>{entry.traits.map((trait) => <li key={trait}>{trait}</li>)}</ul>
        </section>

        </details><section className="style-guide-learner" aria-labelledby="learner-reference-title">
          <figure>
            <StyleImage asset={entry.learnerReference} className="style-guide-full-image" />
            <figcaption>{entry.learnerReference.alt}</figcaption>
          </figure>
          <div>
            <p className="eyebrow">A SIMPLE START</p>
            <h2 id="learner-reference-title">The same idea, made attainable.</h2>
            <p>This reduced version keeps the style’s core structure while lowering the number of shapes, edges, colors, and finishing marks you need to manage at once.</p>
            <blockquote>{entry.practicePrompt}</blockquote>
          </div>
        </section>

        <details className="studio-guide-details"><summary>A few choices behind the painting</summary><section className="style-guide-recipe" aria-labelledby="visual-recipe-title">
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

        </details><section className="style-guide-process" aria-labelledby="process-sheet-title">
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



        <nav className="style-guide-pagination" aria-label="Browse style guides">
          <Link to={`/explore/styles/${previous.slug}`}><span>Previous</span><strong>← {previous.label}</strong></Link>
          <Link to="/explore"><span>Overview</span><strong>Compare all styles</strong></Link>
          <Link to={`/explore/styles/${next.slug}`}><span>Next</span><strong>{next.label} →</strong></Link>
        </nav>
      </article>
  );
}

function LegacyViewRedirect() {
  const [params] = useSearchParams();
  const view = params.get("view");
  if (!view) {
    if (params.has("subject") || params.has("style")) {
      const next = new URLSearchParams();
      if (params.get("subject")) next.set("subject", params.get("subject")!);
      if (params.get("style")) next.set("style", params.get("style")!);
      return <Navigate replace to={`/explore?${next.toString()}`} />;
    }
    return <StudioHome />;
  }
  const lesson = params.get("lesson");
  const run = params.get("run");
  const next = params.get("next");
  const style = params.get("style");
  const emotion = params.get("emotion");
  const target = view === "guide" ? `/explore/styles/${isStyleGuideSlug(style) ? style : STYLE_GUIDE_ENTRIES[0].slug}${params.get("subject") ? `?subject=${encodeURIComponent(params.get("subject")!)}` : ""}`
    : view === "design-system" ? "/internal/design-system"
    : view === "feeling-first" ? `/explore/feeling-first${emotion ? `?emotion=${encodeURIComponent(emotion)}` : ""}`
    : view === "color-study" ? "/explore/color-study"
    : view === "sessions" ? "/sessions"
    : view === "settings" ? "/settings/usage"
    : view === "watercolor-lesson" ? "/explore/watercolor-lesson"
    : view === "lesson-build" && lesson && run ? `/sessions/${lesson}/build/${run}${next ? `?next=${encodeURIComponent(next)}` : ""}`
    : view === "lesson-review" && lesson ? `/sessions/${lesson}/edit`
    : view === "lesson" && lesson ? `/sessions/${lesson}`
    : view === "lesson-target" && lesson ? `/sessions/${lesson}/target`
    : view === "lesson-create" ? `/sessions/new${lesson ? `?lesson=${lesson}` : ""}`
    : "/explore";
  return <Navigate replace to={target} />;
}

function StyleGuideRoute() {
  const { style } = useParams();
  const guide = isStyleGuideSlug(style) ? STYLE_GUIDE_BY_SLUG.get(style) : undefined;
  return guide ? <StyleGuideDetail entry={guide} /> : <Navigate replace to={`/explore/styles/${STYLE_GUIDE_ENTRIES[0].slug}`} />;
}

function SessionViewRoute() { const { id } = useParams(); return <SavedLessonView id={id || null} />; }
function SessionEditRoute() { const { id } = useParams(); return <LessonEditor id={id || null} />; }
function SessionBuildRoute() { const { id, runId } = useParams(); const [params] = useSearchParams(); return <LessonAssembly id={id || null} runId={runId || null} next={params.get("next")} />; }

function StudioShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const newSession = location.pathname === "/sessions/new";
  const targetMatch = location.pathname.match(/^\/sessions\/([^/]+)\/target$/);
  const buildMatch = location.pathname.match(/^\/sessions\/([^/]+)\/build\/([^/]+)$/);
  const modal = newSession || Boolean(targetMatch) || Boolean(buildMatch && params.get("next") === "target");
  const background = (location.state as { background?: Location } | null)?.background;
  const pageLocation = modal ? background || { ...location, pathname: "/sessions", search: "", state: null } : location;
  function close() { if (background) navigate(background.pathname + background.search, { replace: true }); else navigate("/sessions", { replace: true }); }
  return <div className="site-shell studio-aligned"><a className="skip-link" href="#main-content">Skip to the artwork</a>
    <AppNav /><main id="main-content"><Routes location={pageLocation}>
      <Route path="/" element={<LegacyViewRedirect />} />
      <Route path="/explore" element={<StyleGuideGallery />} />
      <Route path="/explore/styles/:style" element={<StyleGuideRoute />} />
      <Route path="/explore/feeling-first" element={<FeelingFirstStudy />} />
      <Route path="/explore/color-study" element={<ColorStudy />} />
      <Route path="/explore/watercolor-lesson" element={<WatercolorLesson />} />
      <Route path="/color-mixing" element={<ColorMixingProposal production />} />
      <Route path="/sessions" element={<PaintingSessions />} />
      <Route path="/sessions/:id" element={<SessionViewRoute />} />
      <Route path="/sessions/:id/edit" element={<SessionEditRoute />} />
      <Route path="/sessions/:id/build/:runId" element={<SessionBuildRoute />} />
      <Route path="/settings/usage" element={<StudioSettings />} />
      <Route path="/internal/design-system" element={<DesignSystem />} />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes></main>
    <footer className="site-footer"><span>Wanderline</span><p>Look closely. Choose boldly. Make it yours.</p><Link to="/settings/usage">Studio settings</Link></footer>
    <StudioDialog open={modal} onClose={close} wide={!newSession}>
      <div hidden={!newSession}><LessonCreator active={newSession} /></div>
      {targetMatch && <LessonTargetReview id={targetMatch[1]} />}
      {buildMatch && params.get("next") === "target" && <LessonAssembly id={buildMatch[1]} runId={buildMatch[2]} next="target" />}
    </StudioDialog>
  </div>;
}

export function StyleStudioApp() { return <StudioConfirmationProvider><StudioShell /></StudioConfirmationProvider>; }
