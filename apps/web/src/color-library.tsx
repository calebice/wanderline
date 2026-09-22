import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  createColorSwatch,
  deleteColorSwatch,
  getColorMixCatalog,
  getColorSwatch,
  listColorSwatches,
  replaceColorSwatchImage,
  updateColorSwatch,
  type ColorMixCatalog,
  type ColorMixRecipe,
  type ColorSwatch,
  type ColorSwatchEditable,
  type ColorSwatchSourceType,
} from "./color-mixing-api";
import { GardenButton, GardenEmpty, GardenHeading, GardenInput, GardenLink, GardenNotice, GardenSelect } from "./garden-ui";
import { useStudioConfirm } from "./studio-ui";
import "./color-library.css";

const SOURCE_LABELS: Record<ColorSwatchSourceType, string> = {
  single_paint: "Single paint",
  catalog_mix: "Authored mix",
  custom_mix: "Custom mix",
};

type Draft = ColorSwatchEditable & {
  source_type: ColorSwatchSourceType;
  recipe_id: string | null;
};

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
const defaultComparison = { value: "same" as const, temperature: "same" as const, chroma: "same" as const, close: false };
const emptyDraft = (): Draft => ({
  source_type: "single_paint",
  recipe_id: null,
  name: "",
  ingredients: [],
  paper: { brand: "", product: "", weight_texture: "" },
  capture: { card_brand: "", card_model: "", lighting: "indirect_daylight", other_lighting: "", card_visible: true },
  appearance: { value: "mid", temperature: "neutral", chroma: "moderate" },
  traits: { transparency: "", granulation: "", lifting: "", water_notes: "", drying_notes: "" },
  comparison: defaultComparison,
  notes: "",
  tested_on: today(),
});

function editable(draft: Draft): ColorSwatchEditable {
  return {
    name: draft.name,
    ingredients: draft.ingredients,
    paper: draft.paper,
    capture: draft.capture,
    appearance: draft.appearance,
    traits: draft.traits,
    comparison: draft.source_type === "custom_mix" ? null : draft.comparison || defaultComparison,
    notes: draft.notes,
    tested_on: draft.tested_on,
  };
}

function sourceColor(swatch: ColorSwatch): string | null {
  if (swatch.source_type === "catalog_mix") return typeof swatch.source_snapshot.color === "string" ? swatch.source_snapshot.color : null;
  if (swatch.source_type === "single_paint") {
    const paint = swatch.source_snapshot.paint as { color?: unknown } | undefined;
    return typeof paint?.color === "string" ? paint.color : null;
  }
  return null;
}

export function ColorLibrary() {
  const [catalog, setCatalog] = useState<ColorMixCatalog | null>(null);
  const [swatches, setSwatches] = useState<ColorSwatch[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [error, setError] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [familyFilter, setFamilyFilter] = useState("");
  const [paintFilter, setPaintFilter] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getColorMixCatalog(), listColorSwatches()]).then(([nextCatalog, nextSwatches]) => {
      if (!active) return;
      setCatalog(nextCatalog);
      setSwatches(nextSwatches);
      setState("ready");
    }).catch((reason) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : "Your Color Library couldn’t load.");
      setState("failed");
    });
    return () => { active = false; };
  }, []);

  const recordedPaints = useMemo(() => new Set(swatches.filter((swatch) => swatch.source_type === "single_paint").map((swatch) => swatch.ingredients[0]?.paint)), [swatches]);
  const filtered = swatches.filter((swatch) =>
    (!sourceFilter || swatch.source_type === sourceFilter)
    && (!familyFilter || swatch.family === familyFilter)
    && (!paintFilter || swatch.ingredients.some((ingredient) => ingredient.paint === paintFilter)),
  );

  if (state === "loading") return <GardenNotice kind="loading">Loading your physical swatches…</GardenNotice>;
  if (state === "failed" || !catalog) return <GardenNotice kind="error">{error || "Your Color Library couldn’t load."}</GardenNotice>;

  return <div className="color-library">
    <GardenHeading level={1} eyebrow="COLOR MIXING" title="Color Library" action={<GardenLink variant="primary" to="/color-mixing/library/new">Add a swatch</GardenLink>}>
      <p>Keep a private record of how your paints and mixes look after they dry.</p>
    </GardenHeading>
    <section className="color-library__coverage" aria-labelledby="set-coverage-title">
      <div><h2 id="set-coverage-title">Your paint set</h2><p>{recordedPaints.size} of {catalog.palette.paints.length} paints recorded</p></div>
      <progress value={recordedPaints.size} max={catalog.palette.paints.length}>{recordedPaints.size} of {catalog.palette.paints.length}</progress>
      <ul>{catalog.palette.paints.map((paint) => <li key={paint.name} className={recordedPaints.has(paint.name) ? "is-recorded" : ""}>
        <Link to={`/color-mixing/library/new?kind=single_paint&paint=${encodeURIComponent(paint.name)}`} aria-label={`${paint.name}: ${recordedPaints.has(paint.name) ? "recorded" : "not recorded"}`}>
          <span style={{ backgroundColor: paint.color }} aria-hidden="true" /><strong>{paint.name}</strong><small>{recordedPaints.has(paint.name) ? "Recorded" : "Add swatch"}</small>
        </Link>
      </li>)}</ul>
    </section>
    <section aria-labelledby="swatch-gallery-title">
      <div className="color-library__section-heading"><div><h2 id="swatch-gallery-title">Physical swatches</h2><p>{swatches.length} saved</p></div><GardenLink to="/color-mixing">Back to mixing</GardenLink></div>
      <div className="color-library__filters" aria-label="Filter physical swatches">
        <GardenSelect label="Type" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="">All types</option>{Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</GardenSelect>
        <GardenSelect label="Color family" value={familyFilter} onChange={(event) => setFamilyFilter(event.target.value)}><option value="">All families</option>{catalog.families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}</GardenSelect>
        <GardenSelect label="Paint" value={paintFilter} onChange={(event) => setPaintFilter(event.target.value)}><option value="">All paints</option>{catalog.palette.paints.map((paint) => <option key={paint.name}>{paint.name}</option>)}</GardenSelect>
      </div>
      {filtered.length === 0 ? <GardenEmpty title={swatches.length ? "No swatches match these filters." : "No physical swatches yet."} action={!swatches.length ? <GardenLink variant="primary" to="/color-mixing/library/new">Add your first swatch</GardenLink> : undefined}>{swatches.length ? "Choose a different type, family, or paint." : "Start with one paint from your set or record a mixture."}</GardenEmpty> : <div className="color-library__gallery">{filtered.map((swatch) => <article key={swatch.id}>
        <Link to={`/color-mixing/library/${swatch.id}`}><img src={swatch.image_url} width={swatch.image_width} height={swatch.image_height} alt={`Physical watercolor swatch: ${swatch.name}`} /><div><p>{SOURCE_LABELS[swatch.source_type]}</p><h3>{swatch.name}</h3><span>{swatch.ingredients.map((ingredient) => ingredient.paint).join(" + ")}</span><small>{new Date(`${swatch.tested_on}T12:00:00`).toLocaleDateString()}</small></div></Link>
      </article>)}</div>}
    </section>
  </div>;
}

function draftForSource(catalog: ColorMixCatalog, sourceType: ColorSwatchSourceType, paintName?: string | null, recipeId?: string | null): Draft {
  const base = emptyDraft();
  if (sourceType === "catalog_mix") {
    const recipe = catalog.recipes.find((item) => item.id === recipeId) || catalog.recipes[0];
    return { ...base, source_type: sourceType, recipe_id: recipe.id, name: recipe.name, ingredients: recipe.ingredients.map((item) => ({ paint: item.paint, parts: 1 })) };
  }
  if (sourceType === "custom_mix") return { ...base, source_type: sourceType, comparison: null, name: "Custom mix", ingredients: catalog.palette.paints.slice(0, 2).map((paint) => ({ paint: paint.name, parts: 1 })) };
  const paint = catalog.palette.paints.find((item) => item.name === paintName) || catalog.palette.paints[0];
  return { ...base, source_type: "single_paint", name: paint.name, ingredients: [{ paint: paint.name, parts: 1 }] };
}

function draftFromSwatch(swatch: ColorSwatch): Draft {
  return {
    name: swatch.name,
    ingredients: swatch.ingredients,
    paper: swatch.paper,
    capture: swatch.capture,
    appearance: swatch.appearance,
    traits: swatch.traits,
    comparison: swatch.comparison,
    notes: swatch.notes,
    tested_on: swatch.tested_on,
    source_type: swatch.source_type,
    recipe_id: swatch.source_type === "catalog_mix" && typeof swatch.source_snapshot.id === "string" ? swatch.source_snapshot.id : null,
  };
}

export function ColorSwatchForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<ColorMixCatalog | null>(null);
  const [current, setCurrent] = useState<ColorSwatch | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "saving" | "failed">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = editing && id ? Promise.all([getColorMixCatalog(), getColorSwatch(id)]) : Promise.all([getColorMixCatalog(), Promise.resolve(null)]);
    load.then(([nextCatalog, swatch]) => {
      if (!active) return;
      setCatalog(nextCatalog);
      setCurrent(swatch);
      const requestedKind = params.get("kind");
      const kind: ColorSwatchSourceType = requestedKind === "catalog_mix" || requestedKind === "custom_mix" ? requestedKind : "single_paint";
      setDraft(swatch ? draftFromSwatch(swatch) : draftForSource(nextCatalog, kind, params.get("paint"), params.get("recipe")));
      setState("ready");
    }).catch((reason) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : "This swatch couldn’t load.");
      setState("failed");
    });
    return () => { active = false; };
  }, [editing, id, params]);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (state === "loading") return <GardenNotice kind="loading">Loading the swatch form…</GardenNotice>;
  if (state === "failed" || !catalog) return <GardenNotice kind="error">{error || "This swatch couldn’t load."}</GardenNotice>;
  const activeCatalog = catalog;

  function chooseSource(sourceType: ColorSwatchSourceType) { setDraft(draftForSource(activeCatalog, sourceType)); setFile(null); }
  function chooseRecipe(recipe: ColorMixRecipe) { setDraft((value) => ({ ...value, recipe_id: recipe.id, name: recipe.name, ingredients: recipe.ingredients.map((item) => ({ paint: item.paint, parts: 1 })) })); }
  function updateIngredient(index: number, field: "paint" | "parts", value: string) {
    setDraft((currentDraft) => ({ ...currentDraft, ingredients: currentDraft.ingredients.map((ingredient, itemIndex) => itemIndex === index ? { ...ingredient, [field]: field === "parts" ? Number(value) : value } : ingredient) }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing && !file) { setError("Add a photo showing the dry swatch and reference card."); return; }
    setState("saving"); setError("");
    try {
      let saved: ColorSwatch;
      if (editing && current) {
        saved = await updateColorSwatch(current.id, editable(draft), current.revision);
        if (file) saved = await replaceColorSwatchImage(saved.id, file, saved.revision);
      } else {
        saved = await createColorSwatch({ ...editable(draft), source_type: draft.source_type, palette_id: activeCatalog.palette.id, catalog_version: activeCatalog.version, recipe_id: draft.recipe_id }, file!);
      }
      navigate(`/color-mixing/library/${saved.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This swatch couldn’t be saved.");
      setState("ready");
    }
  }

  const comparisonRequired = draft.source_type !== "custom_mix";
  return <div className="color-library color-swatch-form">
    <GardenHeading level={1} eyebrow="COLOR LIBRARY" title={editing ? "Edit physical swatch" : "Add a physical swatch"} action={<GardenLink to={editing && current ? `/color-mixing/library/${current.id}` : "/color-mixing/library"}>Cancel</GardenLink>}>
      <p>Photograph the fully dry paint and reference card together in even light.</p>
    </GardenHeading>
    <form onSubmit={(event) => void submit(event)}>
      <section><h2>Formula</h2>{!editing && <GardenSelect label="Swatch type" value={draft.source_type} onChange={(event) => chooseSource(event.target.value as ColorSwatchSourceType)}>{Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</GardenSelect>}
        {draft.source_type === "catalog_mix" && <GardenSelect label="Authored mixture" value={draft.recipe_id || ""} onChange={(event) => chooseRecipe(catalog.recipes.find((recipe) => recipe.id === event.target.value)!)}>{catalog.recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</GardenSelect>}
        <GardenInput required label="Swatch name" value={draft.name} maxLength={160} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        <fieldset><legend>Paint proportions</legend><p>Use parts to record the relative amount of prepared paint.</p>{draft.ingredients.map((ingredient, index) => <div className="color-swatch-form__ingredient" key={`${index}-${ingredient.paint}`}>
          <GardenSelect label={`Paint ${index + 1}`} value={ingredient.paint} disabled={draft.source_type === "catalog_mix" || Boolean(editing && draft.source_type === "single_paint")} onChange={(event) => { if (draft.source_type === "single_paint") setDraft({ ...draft, name: event.target.value, ingredients: [{ paint: event.target.value, parts: 1 }] }); else updateIngredient(index, "paint", event.target.value); }}>{catalog.palette.paints.map((paint) => <option key={paint.name}>{paint.name}</option>)}</GardenSelect>
          <GardenInput required label="Parts" type="number" min="0.01" max="1000" step="0.01" disabled={draft.source_type === "single_paint"} value={ingredient.parts} onChange={(event) => updateIngredient(index, "parts", event.target.value)} />
        </div>)}{draft.source_type === "custom_mix" && draft.ingredients.length < 3 && <GardenButton variant="secondary" onClick={() => setDraft({ ...draft, ingredients: [...draft.ingredients, { paint: catalog.palette.paints.find((paint) => !draft.ingredients.some((item) => item.paint === paint.name))?.name || catalog.palette.paints[0].name, parts: 1 }] })}>Add a third paint</GardenButton>}{draft.source_type === "custom_mix" && draft.ingredients.length === 3 && <GardenButton variant="quiet" onClick={() => setDraft({ ...draft, ingredients: draft.ingredients.slice(0, 2) })}>Remove third paint</GardenButton>}</fieldset>
      </section>
      <section><h2>Paper and appearance</h2><div className="color-swatch-form__grid"><GardenInput required label="Paper brand" value={draft.paper.brand} onChange={(event) => setDraft({ ...draft, paper: { ...draft.paper, brand: event.target.value } })} /><GardenInput required label="Paper product" value={draft.paper.product} onChange={(event) => setDraft({ ...draft, paper: { ...draft.paper, product: event.target.value } })} /><GardenInput label="Weight or texture (optional)" value={draft.paper.weight_texture} onChange={(event) => setDraft({ ...draft, paper: { ...draft.paper, weight_texture: event.target.value } })} /><GardenInput required label="Test date" type="date" value={draft.tested_on} onChange={(event) => setDraft({ ...draft, tested_on: event.target.value })} /></div>
        <div className="color-swatch-form__grid"><GardenSelect label="Value" value={draft.appearance.value} onChange={(event) => setDraft({ ...draft, appearance: { ...draft.appearance, value: event.target.value as Draft["appearance"]["value"] } })}><option value="light">Light</option><option value="mid">Mid</option><option value="dark">Dark</option></GardenSelect><GardenSelect label="Temperature" value={draft.appearance.temperature} onChange={(event) => setDraft({ ...draft, appearance: { ...draft.appearance, temperature: event.target.value as Draft["appearance"]["temperature"] } })}><option value="warm">Warm</option><option value="neutral">Neutral</option><option value="cool">Cool</option></GardenSelect><GardenSelect label="Chroma" value={draft.appearance.chroma} onChange={(event) => setDraft({ ...draft, appearance: { ...draft.appearance, chroma: event.target.value as Draft["appearance"]["chroma"] } })}><option value="muted">Muted</option><option value="moderate">Moderate</option><option value="vivid">Vivid</option></GardenSelect></div>
        <details><summary>Watercolor characteristics</summary><div className="color-swatch-form__grid"><GardenSelect label="Transparency" value={draft.traits.transparency} onChange={(event) => setDraft({ ...draft, traits: { ...draft.traits, transparency: event.target.value as Draft["traits"]["transparency"] } })}><option value="">Not recorded</option><option value="transparent">Transparent</option><option value="semi_transparent">Semi-transparent</option><option value="opaque">Opaque</option></GardenSelect><GardenSelect label="Granulation" value={draft.traits.granulation} onChange={(event) => setDraft({ ...draft, traits: { ...draft.traits, granulation: event.target.value as Draft["traits"]["granulation"] } })}><option value="">Not recorded</option><option value="none">None</option><option value="some">Some</option><option value="strong">Strong</option></GardenSelect><GardenSelect label="Lifting or staining" value={draft.traits.lifting} onChange={(event) => setDraft({ ...draft, traits: { ...draft.traits, lifting: event.target.value as Draft["traits"]["lifting"] } })}><option value="">Not recorded</option><option value="lifts_easily">Lifts easily</option><option value="lifts_some">Lifts some</option><option value="staining">Staining</option></GardenSelect></div><label className="color-library__field">Water notes<textarea value={draft.traits.water_notes} maxLength={1000} onChange={(event) => setDraft({ ...draft, traits: { ...draft.traits, water_notes: event.target.value } })} /></label><label className="color-library__field">Drying notes<textarea value={draft.traits.drying_notes} maxLength={1000} onChange={(event) => setDraft({ ...draft, traits: { ...draft.traits, drying_notes: event.target.value } })} /></label></details>
      </section>
      {comparisonRequired && draft.comparison && <section><h2>Compare with the screen target</h2><p>Screen colors remain illustrative. Record what you see rather than treating this as a calibrated measurement.</p><div className="color-swatch-form__grid"><GardenSelect label="Value difference" value={draft.comparison.value} onChange={(event) => setDraft({ ...draft, comparison: { ...draft.comparison!, value: event.target.value as NonNullable<Draft["comparison"]>["value"] } })}><option value="lighter">Lighter</option><option value="same">About the same</option><option value="darker">Darker</option></GardenSelect><GardenSelect label="Temperature difference" value={draft.comparison.temperature} onChange={(event) => setDraft({ ...draft, comparison: { ...draft.comparison!, temperature: event.target.value as NonNullable<Draft["comparison"]>["temperature"] } })}><option value="cooler">Cooler</option><option value="same">About the same</option><option value="warmer">Warmer</option></GardenSelect><GardenSelect label="Chroma difference" value={draft.comparison.chroma} onChange={(event) => setDraft({ ...draft, comparison: { ...draft.comparison!, chroma: event.target.value as NonNullable<Draft["comparison"]>["chroma"] } })}><option value="duller">Duller</option><option value="same">About the same</option><option value="brighter">Brighter</option></GardenSelect></div><label className="color-library__check"><input type="checkbox" checked={draft.comparison.close} onChange={(event) => setDraft({ ...draft, comparison: { ...draft.comparison!, close: event.target.checked } })} /> Close enough to use as intended</label></section>}
      <section><h2>Capture</h2><div className="color-swatch-form__capture-guide"><strong>Before you photograph</strong><ul><li>Let the paint dry completely.</li><li>Use even light without glare or cast shadows.</li><li>Keep the swatch and reference card on the same plane.</li><li>Include the full card; do not use a decorative crop.</li></ul></div><div className="color-swatch-form__grid"><GardenInput required label="Reference-card brand" value={draft.capture.card_brand} onChange={(event) => setDraft({ ...draft, capture: { ...draft.capture, card_brand: event.target.value } })} /><GardenInput required label="Reference-card model" value={draft.capture.card_model} onChange={(event) => setDraft({ ...draft, capture: { ...draft.capture, card_model: event.target.value } })} /><GardenSelect label="Lighting" value={draft.capture.lighting} onChange={(event) => setDraft({ ...draft, capture: { ...draft.capture, lighting: event.target.value as Draft["capture"]["lighting"] } })}><option value="indirect_daylight">Indirect daylight</option><option value="neutral_artificial">Neutral artificial light</option><option value="other">Other</option></GardenSelect>{draft.capture.lighting === "other" && <GardenInput required label="Describe the lighting" value={draft.capture.other_lighting} onChange={(event) => setDraft({ ...draft, capture: { ...draft.capture, other_lighting: event.target.value } })} />}</div><label className="color-library__check"><input required type="checkbox" checked={draft.capture.card_visible} onChange={(event) => setDraft({ ...draft, capture: { ...draft.capture, card_visible: event.target.checked } })} /> The dry swatch and full reference card are visible on the same plane.</label><label className="color-library__field">{editing ? "Replace photo (optional)" : "Dry swatch photo"}<input required={!editing} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>{(preview || current?.image_url) && <img className="color-swatch-form__preview" src={preview || current!.image_url} alt="Swatch photograph preview" />}</section>
      <section><h2>Notes</h2><label className="color-library__field">Observations<textarea value={draft.notes} maxLength={4000} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="What would you want to remember before using this color again?" /></label></section>
      {error && <GardenNotice kind="error">{error}</GardenNotice>}<div className="color-swatch-form__submit"><GardenButton type="submit" disabled={state === "saving"}>{state === "saving" ? "Saving…" : editing ? "Save swatch changes" : "Save physical swatch"}</GardenButton><GardenLink to={editing && current ? `/color-mixing/library/${current.id}` : "/color-mixing/library"}>Cancel</GardenLink></div>
    </form>
  </div>;
}

export function ColorSwatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useStudioConfirm();
  const [swatch, setSwatch] = useState<ColorSwatch | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (id) getColorSwatch(id).then(setSwatch).catch((reason) => setError(reason instanceof Error ? reason.message : "This swatch couldn’t load.")); }, [id]);
  if (error) return <GardenNotice kind="error">{error}</GardenNotice>;
  if (!swatch) return <GardenNotice kind="loading">Loading this physical swatch…</GardenNotice>;
  const target = sourceColor(swatch);
  async function remove() {
    if (!await confirm("Delete this physical swatch forever? Its photograph and observations will also be removed. This cannot be undone.")) return;
    try { await deleteColorSwatch(swatch!.id); navigate("/color-mixing/library"); } catch (reason) { setError(reason instanceof Error ? reason.message : "This swatch couldn’t be deleted."); }
  }
  return <article className="color-library color-swatch-detail">
    <GardenHeading level={1} eyebrow="COLOR LIBRARY" title={swatch.name} action={<div className="color-swatch-detail__actions"><GardenLink variant="secondary" to={`/color-mixing/library/${swatch.id}/edit`}>Edit swatch</GardenLink><GardenLink to="/color-mixing/library">Back to library</GardenLink></div>}><p>{SOURCE_LABELS[swatch.source_type]} · tested {new Date(`${swatch.tested_on}T12:00:00`).toLocaleDateString()}</p></GardenHeading>
    <div className="color-swatch-detail__comparison"><figure><img src={swatch.image_url} width={swatch.image_width} height={swatch.image_height} alt={`Physical watercolor swatch: ${swatch.name}`} /><figcaption>Dry swatch with {swatch.capture.card_brand} {swatch.capture.card_model}</figcaption></figure>{target && <section><span className="color-swatch-detail__target" style={{ backgroundColor: target }} aria-hidden="true" /><h2>Illustrative screen target</h2><p>Use the photograph and your written observations as the physical record. The screen target is not calibrated.</p></section>}</div>
    <div className="color-swatch-detail__facts"><section><h2>Formula</h2><ol>{swatch.ingredients.map((ingredient) => <li key={ingredient.paint}><strong>{ingredient.paint}</strong><span>{ingredient.parts} part{ingredient.parts === 1 ? "" : "s"}</span></li>)}</ol><p>{swatch.paper.brand} · {swatch.paper.product}{swatch.paper.weight_texture ? ` · ${swatch.paper.weight_texture}` : ""}</p></section><section><h2>Appearance</h2><dl><div><dt>Value</dt><dd>{swatch.appearance.value}</dd></div><div><dt>Temperature</dt><dd>{swatch.appearance.temperature}</dd></div><div><dt>Chroma</dt><dd>{swatch.appearance.chroma}</dd></div>{swatch.comparison && <><div><dt>Target value</dt><dd>{swatch.comparison.value}</dd></div><div><dt>Target temperature</dt><dd>{swatch.comparison.temperature}</dd></div><div><dt>Target chroma</dt><dd>{swatch.comparison.chroma}</dd></div><div><dt>Close enough</dt><dd>{swatch.comparison.close ? "Yes" : "No"}</dd></div></>}</dl></section></div>
    {(swatch.notes || swatch.traits.water_notes || swatch.traits.drying_notes) && <section className="color-swatch-detail__notes"><h2>Observations</h2>{swatch.notes && <p>{swatch.notes}</p>}{swatch.traits.water_notes && <p><strong>Water:</strong> {swatch.traits.water_notes}</p>}{swatch.traits.drying_notes && <p><strong>Drying:</strong> {swatch.traits.drying_notes}</p>}</section>}
    <div className="color-swatch-detail__danger"><GardenButton variant="quiet" onClick={() => void remove()}>Delete swatch forever</GardenButton></div>
  </article>;
}
