import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { FEELING_FIRST_GALLERY, isEmotionSlug, type EmotionInterpretation } from "./emotion-study-catalog";

const gallery = FEELING_FIRST_GALLERY;

function EmotionArtwork({ interpretation }: { interpretation: EmotionInterpretation }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="emotion-gallery__fallback" role="img" aria-label={interpretation.artwork.alt}>
        <strong>{interpretation.title}</strong>
        <p>{interpretation.artwork.alt}</p>
      </div>
    );
  }
  return <img src={interpretation.artwork.src} width={interpretation.artwork.width} height={interpretation.artwork.height} alt={interpretation.artwork.alt} onError={() => setFailed(true)} decoding="async" />;
}

export function FeelingFirstStudy() {
  const [searchParams, setSearchParams] = useSearchParams();
  const artworkRef = useRef<HTMLElement>(null);
  const emotionParam = searchParams.get("emotion");
  const activeSlug = isEmotionSlug(emotionParam) ? emotionParam : gallery.defaultInterpretation;
  const activeIndex = gallery.interpretations.findIndex((interpretation) => interpretation.slug === activeSlug);
  const active = gallery.interpretations[activeIndex];

  useEffect(() => {
    if (!isEmotionSlug(emotionParam)) {
      const next = new URLSearchParams(searchParams);
      next.set("view", "feeling-first");
      next.set("emotion", gallery.defaultInterpretation);
      setSearchParams(next, { replace: true });
    }
  }, [emotionParam, searchParams, setSearchParams]);

  useEffect(() => {
    for (const index of [activeIndex - 1, activeIndex + 1]) {
      const adjacent = gallery.interpretations[index];
      if (adjacent) {
        const preload = new Image();
        preload.src = adjacent.artwork.src;
      }
    }
  }, [activeIndex]);

  function chooseInterpretation(index: number, replace = false) {
    const interpretation = gallery.interpretations[index];
    if (!interpretation) return;
    const artwork = artworkRef.current;
    if (typeof artwork?.scrollIntoView === "function") {
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      artwork.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    }
    const next = new URLSearchParams(searchParams);
    next.set("view", "feeling-first");
    next.set("emotion", interpretation.slug);
    setSearchParams(next, { replace });
  }

  return (
      <article className="emotion-gallery">
        <header className="emotion-gallery__hero">
          <Link className="text-link" to="/">← Style reference studio</Link>
          <p className="eyebrow">{gallery.eyebrow}</p>
          <h1>{gallery.title}</h1>
          <p className="lede">{gallery.description}</p>
        </header>

        <section className="emotion-gallery__selector" aria-labelledby="emotion-selector-title">
          <div className="emotion-gallery__selector-copy">
            <p className="eyebrow">CHOOSE A FEELING</p>
            <h2 id="emotion-selector-title">Change the mood, keep the view.</h2>
          </div>
          <div className="emotion-range">
            <input type="range" min="0" max={gallery.interpretations.length - 1} step="1" value={activeIndex} aria-label="Emotional interpretation" aria-valuetext={`${active.emotion}: ${active.title}`} onChange={(event) => chooseInterpretation(Number(event.target.value), true)} style={{ "--emotion-accent": active.accent } as CSSProperties} />
            <div className="emotion-range__labels">
              {gallery.interpretations.map((interpretation, index) => (
                <button type="button" key={interpretation.slug} className={interpretation.slug === active.slug ? "is-selected" : ""} aria-pressed={interpretation.slug === active.slug} onClick={() => chooseInterpretation(index)}>
                  <span style={{ background: interpretation.accent }} aria-hidden="true" />
                  {interpretation.emotion}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="emotion-gallery__workspace" aria-live="polite">
          <figure className="emotion-gallery__artwork" key={active.slug} ref={artworkRef}>
            <EmotionArtwork interpretation={active} />
            <figcaption>{active.artwork.alt}</figcaption>
          </figure>
          <aside style={{ "--emotion-accent": active.accent } as CSSProperties}>
            <p className="eyebrow">{active.emotion}</p>
            <h2>{active.title}</h2>
            <strong>{active.medium}</strong>
            <div className="emotion-gallery__palette" aria-label={`${active.emotion} color palette`}>
              {active.palette.map((color) => <i key={color} style={{ background: color }} aria-hidden="true" />)}
            </div>
            <p>{active.observation}</p>
            <blockquote><span>Try this feeling</span>{active.prompt}</blockquote>
            <a href={active.artwork.src} target="_blank" rel="noreferrer">Open full image ↗</a>
          </aside>
        </section>
      </article>
  );
}
