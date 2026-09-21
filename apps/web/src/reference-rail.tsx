import { useRef, useState, type KeyboardEvent, type ReactNode, type UIEvent } from "react";

import type { ReadyPaintingReference } from "./reference-model";

type ReferenceRailProps = {
  references: ReadyPaintingReference[];
  action: (reference: ReadyPaintingReference) => ReactNode;
  label?: string;
};

export function ReferenceRail({ references, action, label = "Painting references" }: ReferenceRailProps) {
  const rail = useRef<HTMLUListElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function moveTo(index: number) {
    const next = Math.max(0, Math.min(index, references.length - 1));
    setActiveIndex(next);
    const card = rail.current?.children.item(next) as HTMLElement | null;
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    card?.focus({ preventScroll: true });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    moveTo(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
  }

  function handleScroll(event: UIEvent<HTMLUListElement>) {
    const list = event.currentTarget;
    const cards = Array.from(list.children) as HTMLElement[];
    if (!cards.length) return;
    const nearest = cards.reduce((best, card, index) => (
      Math.abs(card.offsetLeft - list.scrollLeft) < Math.abs(cards[best].offsetLeft - list.scrollLeft) ? index : best
    ), 0);
    setActiveIndex(nearest);
  }

  return <div className="reference-carousel" role="region" aria-roledescription="carousel" aria-label={label} tabIndex={0} onKeyDown={handleKeyDown}>
    <div className="reference-carousel__heading">
      <div><p className="eyebrow">YOUR PAINTING REFERENCES</p><h2>What catches your eye?</h2></div>
      {references.length > 1 && <div className="reference-carousel__controls" aria-label="Reference carousel controls">
        <button type="button" className="button-secondary" aria-label="Previous painting reference" disabled={activeIndex === 0} onClick={() => moveTo(activeIndex - 1)}>←</button>
        <button type="button" className="button-secondary" aria-label="Next painting reference" disabled={activeIndex === references.length - 1} onClick={() => moveTo(activeIndex + 1)}>→</button>
      </div>}
    </div>
    <ul className="reference-carousel__rail" ref={rail} onScroll={handleScroll}>
      {references.map((reference, index) => <li className="reference-carousel__slide" key={reference.lesson.id} tabIndex={-1} aria-roledescription="slide" aria-label={`${index + 1} of ${references.length}: ${reference.lesson.title}`}>
        <img src={reference.image.image_url} alt={reference.image.alt_text} loading={index === 0 ? "eager" : "lazy"} />
        <div className="reference-carousel__body"><p className="eyebrow">GENERATED REFERENCE</p><h3>{reference.lesson.title}</h3><p>{reference.lesson.generation_brief.stage_count} steps · {reference.lesson.estimated_duration_minutes} minutes</p>{action(reference)}</div>
      </li>)}
    </ul>
    <p className="sr-only" aria-live="polite">Reference {activeIndex + 1} of {references.length}</p>
  </div>;
}
