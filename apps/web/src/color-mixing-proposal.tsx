import { useEffect, useState, type CSSProperties } from "react";
import { createColorMixTrial, getColorMixCatalog, listColorMixTrials, updateColorMixTrial, type ColorMixCatalog, type ColorMixTrial } from "./color-mixing-api";
import { COLOR_FAMILIES, EMILY_LEX_PAINTS, MIXING_EXAMPLES, MIXING_EXAMPLE_VERSION } from "./color-mixing-examples";
import { GardenButton, GardenHeading, GardenInput, GardenNotice } from "./garden-ui";
import "./color-mixing-proposal.css";

const referenceCatalog: ColorMixCatalog = {
  schema_version: "color-mix-catalog.v1",
  version: MIXING_EXAMPLE_VERSION,
  palette: { id: "emily-lex-18", name: "Emily Lex · 18 colors", paints: EMILY_LEX_PAINTS.map(([name, color]) => ({ name, color })) },
  families: COLOR_FAMILIES.map((family) => ({ ...family })),
  recipes: MIXING_EXAMPLES.map((recipe) => ({ ...recipe, ingredients: recipe.ingredients.map((item) => ({ ...item })), correction: { ...recipe.correction } })),
  guidance_status: "illustrative",
  guidance_note: "These authored starting points have not been physically validated with every paint and paper.",
};

const INITIAL_RECIPE_ID = "olive-green";

export function ColorMixingProposal({ production = false }: { production?: boolean }) {
  const [catalog, setCatalog] = useState<ColorMixCatalog | null>(production ? null : referenceCatalog);
  const [trials, setTrials] = useState<ColorMixTrial[]>([]);
  const [trial, setTrial] = useState<ColorMixTrial | null>(null);
  const [selected, setSelected] = useState(INITIAL_RECIPE_ID);
  const [adjustments, setAdjustments] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "saving" | "saved" | "failed">(production ? "loading" : "ready");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!production) return;
    let active = true;
    Promise.all([getColorMixCatalog(), listColorMixTrials()]).then(([nextCatalog, nextTrials]) => {
      if (!active) return;
      const savedTrial = nextTrials.find((item) => item.recipe.id === INITIAL_RECIPE_ID) || null;
      setCatalog(nextCatalog);
      setTrials(nextTrials);
      setTrial(savedTrial);
      setAdjustments(savedTrial?.adjustments || []);
      setNotes(savedTrial?.notes || "");
      setState("ready");
    }).catch((reason) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : "Color mixing couldn’t load.");
      setState("failed");
    });
    return () => { active = false; };
  }, [production]);

  if (!catalog) return <div className="mixing-proposal"><p role={state === "failed" ? "alert" : "status"}>{state === "failed" ? error : "Loading color mixtures…"}</p></div>;
  const recipe = catalog.recipes.find((target) => target.id === selected) || catalog.recipes[0];
  const family = catalog.families.find((item) => item.id === recipe.family)!;
  const targets = catalog.recipes.filter((target) => target.family === family.id);

  function choose(id: string) {
    if (id === selected) return;
    const savedTrial = trials.find((item) => item.recipe.id === id) || null;
    setSelected(id);
    setTrial(savedTrial);
    setAdjustments(savedTrial?.adjustments || []);
    setNotes(savedTrial?.notes || "");
    setState("ready");
    setError("");
  }

  async function save() {
    if (!production) { setState("saved"); return; }
    setState("saving");
    setError("");
    try {
      const saved = trial
        ? await updateColorMixTrial(trial.id, trial.revision, adjustments, notes)
        : await createColorMixTrial(recipe.id, catalog!.version, adjustments, notes);
      setTrial(saved);
      setTrials((previous) => [saved, ...previous.filter((item) => item.id !== saved.id)]);
      setState("saved");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your color trial couldn’t be saved.");
      setState("failed");
    }
  }

  return <div className={`garden-page-example mixing-proposal${production ? " mixing-proposal--production" : ""}`}>
    <GardenHeading level={production ? 1 : 2} title="Mix a color" eyebrow={production ? "COLOR MIXING" : undefined} action={<span className="mixing-proposal__set">{catalog.palette.name}</span>}>{production && <p>Choose a starting mixture, test it on your paper, and keep what you notice.</p>}</GardenHeading>
    <div className="mixing-proposal__browse">
      <div className="mixing-proposal__families" role="group" aria-label="Color family"><p>Color family</p>{catalog.families.map((item) => <GardenButton key={item.id} variant="secondary" aria-pressed={family.id === item.id} onClick={() => { if (family.id !== item.id) choose(catalog.recipes.find((target) => target.family === item.id)!.id); }}><span className="mixing-proposal__chip" style={{ backgroundColor: item.color }} aria-hidden="true" />{item.name}</GardenButton>)}</div>
      <div className="mixing-proposal__content">
        <div className="mixing-proposal__shades"><p id="mixing-shade-label">{family.name} · {targets.length} shades</p><div className="mixing-proposal__targets" role="group" aria-labelledby="mixing-shade-label">{targets.map((target) => <GardenButton variant="secondary" key={target.id} aria-pressed={selected === target.id} onClick={() => choose(target.id)}><span className="mixing-proposal__chip" style={{ backgroundColor: target.color }} aria-hidden="true" />{target.name}</GardenButton>)}</div></div>
        <div className="mixing-proposal__workspace">
          <section aria-label="Paints for this mixture"><div className="mixing-proposal__target" style={{ "--target-color": recipe.color } as CSSProperties}><span aria-hidden="true" /><div><h2>{recipe.name}</h2><p>{recipe.ingredients.map((item) => item.paint).join(" + ")}</p></div></div><h3>Your paints</h3><p className="mixing-proposal__caption">Marked colors are used in this mix. Arrangement follows your swatch card.</p><ol className="mixing-proposal__palette">{catalog.palette.paints.map(({ name, color }) => { const order = recipe.ingredients.findIndex((item) => item.paint === name); return <li key={name} className={order >= 0 ? "is-used" : ""}><span className="mixing-proposal__paint" style={{ backgroundColor: color }} aria-hidden="true" /><span>{name}</span><strong>{order >= 0 ? `${order + 1} · ${order === 0 ? "Start" : "Add"}` : ""}</strong></li>; })}</ol></section>
          <section aria-label="Mixing instructions"><h2>Start your mix</h2><p className="mixing-proposal__caption">{recipe.ingredients.length} paint{recipe.ingredients.length === 1 ? "" : "s"} · starting amounts of prepared paint</p><ol className="mixing-proposal__steps">{recipe.ingredients.map((item, index) => <li key={item.paint}><strong>{index === 0 ? "Start with" : "Add"} {item.paint}</strong> — {item.amount}. It {item.role}.</li>)}</ol><p><strong>Water & test:</strong> {recipe.water}</p><h3>How did your test turn out?</h3>
            <div className="mixing-proposal__adjustments">{[[recipe.correction.label, `${recipe.correction.instruction} Test again and let it dry.`], ["Too light", "Add a little more of your prepared mixture to a separate portion, using less extra water. Test again and let it dry."], ["Too dark", "Move a little of the mixture into a clean well and add water gradually. Test again and let it dry."]].map(([label, guidance]) => <GardenButton variant="secondary" key={label} onClick={() => { setAdjustments((previous) => [...previous, guidance]); setState("ready"); }}>{label}</GardenButton>)}</div>
            <div aria-live="polite">{adjustments.length > 0 && <p className="mixing-proposal__guidance">{adjustments.at(-1)}</p>}</div>{adjustments.length > 0 && <details><summary>Your adjustments ({adjustments.length})</summary><ol>{adjustments.map((adjustment, index) => <li key={`${index}-${adjustment}`}>{adjustment}</li>)}</ol></details>}
            <GardenInput label="Notes for next time" value={notes} onChange={(event) => { setNotes(event.target.value); setState("ready"); }} placeholder="What worked on your paper?" /><GardenButton disabled={state === "saving"} onClick={() => void save()}>{state === "saving" ? "Saving…" : !production ? "Save example mix" : trial ? "Update color trial" : "Save color trial"}</GardenButton>{state === "saved" && <GardenNotice kind="success">{production ? "Color trial saved." : "Example saved in memory."}</GardenNotice>}{state === "failed" && <GardenNotice kind="error">{error}</GardenNotice>}
          </section>
        </div>
      </div>
    </div>
    <p className="mixing-proposal__caption">{catalog.recipes.length} authored starting points across this palette. {catalog.guidance_note} Screen swatches are illustrative; paint, paper, and water change the result.</p>
    {production && trials.length > 0 && <details className="mixing-proposal__history"><summary>Saved color trials ({trials.length})</summary><ul>{trials.map((item) => <li key={item.id}><button type="button" onClick={() => choose(item.recipe.id)}><span className="mixing-proposal__chip" style={{ backgroundColor: item.recipe.color }} aria-hidden="true" />{item.recipe.name}</button><span>{new Date(item.updated_at).toLocaleDateString()}</span></li>)}</ul></details>}
  </div>;
}
