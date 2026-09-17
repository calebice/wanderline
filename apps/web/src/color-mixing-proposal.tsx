import { useState, type CSSProperties } from "react";
import { GardenButton, GardenHeading, GardenInput, GardenNotice } from "./garden-ui";
import "./color-mixing-proposal.css";

import { COLOR_FAMILIES, EMILY_LEX_PAINTS, MIXING_EXAMPLES } from "./color-mixing-examples";

// Review surface only; successful-mix persistence is implemented after layout review.
export function ColorMixingProposal() {
  const [selected, setSelected] = useState("olive-green");
  const [adjustments, setAdjustments] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const recipe = MIXING_EXAMPLES.find((target) => target.id === selected)!;
  const family = COLOR_FAMILIES.find((item) => item.id === recipe.family)!;
  const targets = MIXING_EXAMPLES.filter((target) => target.family === family.id);
  function choose(id: string) { if (id === selected) return; setSelected(id); setAdjustments([]); setNotes(""); setSaved(false); }
  return <div className="garden-page-example mixing-proposal">
    <GardenHeading title="Mix a color" action={<span className="mixing-proposal__set">Emily Lex · 18 colors</span>} />
    <div className="mixing-proposal__browse">
      <div className="mixing-proposal__families" role="group" aria-label="Color family">
        <p>Color family</p>
        {COLOR_FAMILIES.map((item) => <GardenButton key={item.id} variant="secondary" aria-pressed={family.id === item.id} onClick={() => { if (family.id !== item.id) choose(MIXING_EXAMPLES.find((target) => target.family === item.id)!.id); }}><span className="mixing-proposal__chip" style={{ backgroundColor: item.color }} aria-hidden="true" />{item.name}</GardenButton>)}
      </div>
      <div className="mixing-proposal__content">
      <div className="mixing-proposal__shades">
        <p id="mixing-shade-label">{family.name} · {targets.length} shades</p>
        <div className="mixing-proposal__targets" role="group" aria-labelledby="mixing-shade-label">{targets.map((target) =>
          <GardenButton variant="secondary" key={target.id} aria-pressed={selected === target.id} onClick={() => choose(target.id)}><span className="mixing-proposal__chip" style={{ backgroundColor: target.color }} aria-hidden="true" />{target.name}</GardenButton>,
        )}</div>
      </div>
    <div className="mixing-proposal__workspace">
      <section aria-label="Paints for this mixture">
        <div className="mixing-proposal__target" style={{ "--target-color": recipe.color } as CSSProperties}><span aria-hidden="true" /><div><h3>{recipe.name}</h3><p>{recipe.ingredients.map((item) => item.paint).join(" + ")}</p></div></div>
        <h3>Your paints</h3>
        <p className="mixing-proposal__caption">Marked colors are used in this mix. Arrangement follows your swatch card.</p>
        <ol className="mixing-proposal__palette">{EMILY_LEX_PAINTS.map(([name, color]) => {
          const order = recipe.ingredients.findIndex((item) => item.paint === name);
          return <li key={name} className={order >= 0 ? "is-used" : ""}><span className="mixing-proposal__paint" style={{ backgroundColor: color }} aria-hidden="true" /><span>{name}</span><strong>{order >= 0 ? `${order + 1} · ${order === 0 ? "Start" : "Add"}` : ""}</strong></li>;
        })}</ol>
      </section>
      <section aria-label="Mixing instructions">
        <h3>Start your mix</h3>
        <p className="mixing-proposal__caption">{recipe.ingredients.length} paint{recipe.ingredients.length === 1 ? "" : "s"} · starting amounts of prepared paint</p>
        <ol className="mixing-proposal__steps">{recipe.ingredients.map((item, index) => <li key={item.paint}><strong>{index === 0 ? "Start with" : "Add"} {item.paint}</strong> — {item.amount}. It {item.role}.</li>)}</ol>
        <p><strong>Water & test:</strong> {recipe.water}</p>
        <h3>How did your test turn out?</h3>
        <div className="mixing-proposal__adjustments">{[
          [recipe.correction.label, `${recipe.correction.instruction} Test again and let it dry.`],
          ["Too light", "Add a little more of your prepared mixture to a separate portion, using less extra water. Test again and let it dry."],
          ["Too dark", "Move a little of the mixture into a clean well and add water gradually. Test again and let it dry."],
        ].map(([label, guidance]) => <GardenButton variant="secondary" key={label} onClick={() => { setAdjustments((previous) => [...previous, guidance]); setSaved(false); }}>{label}</GardenButton>)}</div>
        <div aria-live="polite">{adjustments.length > 0 && <p className="mixing-proposal__guidance">{adjustments.at(-1)}</p>}</div>
        {adjustments.length > 0 && <details><summary>Your adjustments ({adjustments.length})</summary><ol>{adjustments.map((adjustment, index) => <li key={index}>{adjustment}</li>)}</ol></details>}
        <GardenInput label="Notes for next time" value={notes} onChange={(event) => { setNotes(event.target.value); setSaved(false); }} placeholder="What worked on your paper?" />
        <GardenButton onClick={() => setSaved(true)}>Save example mix</GardenButton>
        {saved && <GardenNotice kind="success">Example saved in memory. The finished feature will save across devices.</GardenNotice>}
      </section>
    </div>
      </div>
    </div>
    <p className="mixing-proposal__caption">36 starting points across your palette’s color range. Screen swatches are illustrative; these recipes still need testing with your paints. Saving in this preview is a local demonstration.</p>
  </div>;
}
