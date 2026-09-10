import { TracingControls } from "./tracing-controls";
import { Link } from "react-router-dom";
import type { PaintingLesson } from "./lesson-model";
import "./painting-recipe.css";

function simpleColor(name: string) {
  const colors = name.match(/\b(red|orange|yellow|green|blue|purple|pink|brown|gray|grey|black|white)\b/gi);
  if (!colors) return name;
  const color = colors[colors.length - 1].toLowerCase().replace("grey", "gray");
  const shade = /\bdark\b/i.test(name) ? "Dark " : /\b(light|pale)\b/i.test(name) ? "Light " : "";
  return shade + color;
}

export function PaintingRecipeSheet({ lesson }: { lesson: PaintingLesson }) {
  const content = lesson.content!;
  const painting = lesson.assets.find((asset) => asset.id === lesson.approved_target_asset_id);
  const outline = lesson.assets.find((asset) => asset.role === "tracing_outline" && asset.stage_id === painting?.id);
  return <section className="recipe-sheet" aria-label="Simple painting recipe">
    <header className="recipe-sheet__heading"><div><p className="eyebrow">A little time to paint</p><h1>{lesson.title}</h1></div><TracingControls url={outline?.image_url} /></header>
    {lesson.is_demo && <p className="recipe-sheet__notice">Sample guidance only. Your photo has not been simplified, and no tracing outline has been generated.</p>}
    <div className="recipe-sheet__workspace"><div className="recipe-sheet__art">
      <figure>{painting ? <img src={painting.image_url} width={painting.width} height={painting.height} alt={lesson.is_demo ? "Your original inspiration" : "Simple finished watercolor painting"} /> : <p>Your painting image is unavailable.</p>}{lesson.is_demo && <figcaption>Your inspiration</figcaption>}</figure>
    </div>
    <ol className="recipe-sheet__steps">{content.stages.map((step) => {
      const mixes = step.palette_mix_ids.flatMap((id) => content.palette.filter((mix) => mix.id === id));
      let instruction = step.checkpoint_action || step.instruction;
      for (const mix of [...content.palette].sort((a, b) => b.name.length - a.name.length)) instruction = instruction.split(mix.name).join(simpleColor(mix.name));
      return <li key={step.id}><span>{instruction}</span><span className="recipe-sheet__quick-colors" aria-label="Quick color reference">{mixes.map((mix) => <a key={mix.id} href={`#recipe-mix-${mix.id}`}><span className="recipe-sheet__swatch" style={{ backgroundColor: mix.swatch }} aria-hidden="true" />{simpleColor(mix.name)} · {mix.consistency || mix.dilution}</a>)}</span></li>;
    })}</ol></div>
    <section className="recipe-sheet__mixing" aria-label="How to mix your colors"><h2>Mix your colors</h2><p>A little paint, a little water. Try each mix on scrap paper first.</p><ul>{content.palette.map((mix) => <li id={`recipe-mix-${mix.id}`} key={mix.id}><span className="recipe-sheet__swatch" style={{ backgroundColor: mix.swatch }} aria-hidden="true" /><div><strong>{simpleColor(mix.name)}</strong><span>{mix.ingredients?.map((item) => `${item.parts} ${item.parts === 1 ? "part" : "parts"} ${item.color}`).join(" + ") || mix.formula}</span><span>{mix.dilution}</span></div></li>)}</ul></section>
    {content.recipe?.finishing && <details className="recipe-sheet__extra"><summary>Try a little more</summary><p>{content.recipe.finishing.instruction}</p><p><span className="recipe-sheet__swatch" style={{ backgroundColor: content.recipe.finishing.mix.swatch }} aria-hidden="true" /> {content.recipe.finishing.mix.name} · {content.recipe.finishing.mix.consistency}</p><p>{content.recipe.finishing.mix.formula} · {content.recipe.finishing.mix.dilution}</p></details>}
    <footer><p>Mix ratios are starting points. Test on scrap paper; pigment strength varies.</p></footer>
    <nav className="recipe-sheet__tools" aria-label="Recipe actions"><Link className="text-link" to={`/?view=lesson-target&lesson=${lesson.id}`}>Try a different painting</Link><Link className="text-link" to="/?view=sessions">Your painting sessions</Link></nav>
  </section>;
}
