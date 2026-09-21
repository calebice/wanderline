import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteLessonPermanently, getUsageSummary, listLessons, restoreLesson, type UsageSummary } from "./lesson-api";
import { LEMON_LESSON, type PaintingLesson } from "./lesson-model";
import { readyPaintingReferences } from "./reference-model";
import { ReferenceRail } from "./reference-rail";
import { sessionPath } from "./session-path";
import { StartPaintingLink } from "./studio-ui";
import { useStudioConfirm } from "./studio-ui";

export function StudioHome() {
  const [lessons, setLessons] = useState<PaintingLesson[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true; setState("loading"); listLessons("all").then((value) => { if (active) { setLessons(value); setState("ready"); } }).catch(() => active && setState("failed")); return () => { active = false; }; }, [attempt]);
  const references = readyPaintingReferences(lessons);
  const referenceIds = new Set(references.map((reference) => reference.lesson.id));
  const unfinished = lessons.find((lesson) => !referenceIds.has(lesson.id));
  return <div className="studio-home">
    <header className="studio-home__hero"><div><p className="eyebrow">YOUR PAINTING STUDIO</p><h1>Choose what to paint.</h1><p>Return to a reference you made, or begin with a photo or an idea.</p></div><StartPaintingLink /></header>
    {state === "loading" && <p role="status">Loading your studio…</p>}
    {state === "failed" && <div className="lesson-error" role="alert"><p>Your painting references couldn’t load. You can still start a new painting.</p><button type="button" onClick={() => setAttempt(attempt + 1)}>Try again</button></div>}
    {state === "ready" && references.length > 0 && <ReferenceRail references={references} action={(reference) => <Link className="button-link" to={sessionPath(reference.lesson)}>Paint this reference</Link>} />}
    {state === "ready" && references.length === 0 && <section className="studio-empty"><h2>{lessons.length ? "No painting references are ready yet." : "Create your first painting reference."}</h2><p>{lessons.length ? "Finish preparing a reference, or begin another from a photo or idea." : "Start with a photo you love, or describe something you’ve been imagining."}</p><StartPaintingLink /></section>}
    {state === "ready" && unfinished && <aside className="studio-home__unfinished"><span>Still taking shape</span><Link className="text-link" to={sessionPath(unfinished)}>Continue preparing {unfinished.title} →</Link></aside>}
    <section className="studio-home__explore" aria-labelledby="home-explore-title"><div className="section-heading"><div><p className="eyebrow">EXPLORE</p><h2 id="home-explore-title">Find your next direction.</h2></div><Link className="text-link" to="/explore">See all references →</Link></div><div className="studio-home__links"><Link to="/explore">Style references<span>Choose a subject and visual language.</span></Link><Link to="/explore/feeling-first?emotion=pensive">Feeling First<span>See how choices change a painting’s mood.</span></Link><Link to="/explore/color-study">Color Study<span>Explore relationships around the color wheel.</span></Link><Link to="/color-mixing">Mix colors<span>Try authored starting mixtures with your paints.</span></Link></div></section>
  </div>;
}

export function PaintingSessions() {
  const confirm = useStudioConfirm();
  const [lessons, setLessons] = useState<PaintingLesson[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [filter, setFilter] = useState<"all" | "saved" | "drafts" | "discarded">("all");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true; setState("loading"); listLessons(filter === "discarded" ? "discarded" : "all").then((value) => { if (active) { setLessons(value); setState("ready"); } }).catch(() => active && setState("failed")); return () => { active = false; }; }, [attempt, filter]);
  const shown = lessons.filter((lesson) => filter === "all" || filter === "discarded" || (filter === "saved" ? lesson.saved_at : !lesson.saved_at));
  async function restore(id: string) { try { await restoreLesson(id); setLessons((current) => current.filter((lesson) => lesson.id !== id)); } catch { setState("failed"); } }
  async function purge(id: string) { if (!await confirm("Delete this session forever? Its generated images and AI usage history will also be removed. This cannot be undone.")) return; try { await deleteLessonPermanently(id); setLessons((current) => current.filter((lesson) => lesson.id !== id)); } catch { setState("failed"); } }
  return <div className="sessions-page"><header className="studio-page-heading"><div><h1>Your painting sessions</h1></div><StartPaintingLink /></header>
    <section className="starter-session"><img src={LEMON_LESSON.assets[0].image_url} alt="A sunlit lemon, ready for a little watercolor" /><div><p className="eyebrow">A lovely place to begin · 25 minutes</p><h2>A little lemon, a little light.</h2><p>Let water and color do their thing. Four gentle steps take you from the first pencil line to a luminous wash.</p><Link className="button-link" to="/explore/watercolor-lesson">Paint along →</Link></div></section>
    <section aria-label="Your sessions"><div className="watercolor-view-toggle">{(["all", "saved", "drafts", "discarded"] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} className={filter === value ? "is-selected" : ""} onClick={() => setFilter(value)}>{value === "all" ? "All sessions" : value === "saved" ? "Saved" : value === "drafts" ? "In progress" : "Discarded"}</button>)}</div>
    {state === "loading" && <p role="status">Loading your sessions…</p>}{state === "failed" && <div className="lesson-error" role="alert"><p>Your saved sessions aren’t available right now. You can still paint along with the lemon.</p><button type="button" onClick={() => { setState("loading"); setAttempt(attempt + 1); }}>Try again</button></div>}
    {state === "ready" && shown.length === 0 && <div className="studio-empty"><h2>No painting sessions yet.</h2><p>Start with a photo you love, or describe something you’ve been dreaming about.</p><StartPaintingLink /></div>}
    <div className="session-grid">{shown.map((lesson) => { const image = lesson.assets.find((asset) => asset.id === lesson.approved_target_asset_id) || [...lesson.assets].reverse().find((asset) => asset.role === "target_reference") || lesson.assets.find((asset) => asset.is_primary); const inProgress = ["queued", "generating"].includes(lesson.generation_status); return <article className="session-card" key={lesson.id}>{image ? <img src={image.image_url} alt={image.alt_text} loading="lazy" /> : <div className="session-card__blank" aria-hidden="true">✦</div>}<div><p className="eyebrow">{filter === "discarded" ? "Discarded" : lesson.generation_status === "failed" ? "Needs a little attention" : inProgress ? "In progress" : lesson.content ? "Ready to paint" : "A new beginning"}</p><h2>{lesson.title}</h2><p>{lesson.generation_brief.stage_count} steps · {lesson.estimated_duration_minutes} minutes</p>{filter === "discarded" ? <div className="studio-actions"><button type="button" className="button-secondary" onClick={() => void restore(lesson.id)}>Restore</button><button type="button" onClick={() => void purge(lesson.id)}>Delete forever</button></div> : <Link className="text-link" to={sessionPath(lesson)}>{lesson.saved_at && !inProgress ? "Open session" : "Pick up here"} →</Link>}</div></article>; })}</div></section>
  </div>;
}

export function StudioSettings() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [session, setSession] = useState("all");
  const [model, setModel] = useState("all");
  const [day, setDay] = useState("");
  useEffect(() => { let active = true; getUsageSummary().then((value) => active && setUsage(value)).catch(() => active && setError(true)); return () => { active = false; }; }, [attempt]);
  const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 3 }).format(value);
  const rows = usage?.groups.filter((group) => (session === "all" || group.lesson_id === session) && (model === "all" || group.model === model) && (!day || group.day === day)) || [];
  return <div className="usage-page"><header className="studio-page-heading"><div><h1>Studio usage</h1><p>Estimated generation costs and recent activity.</p></div></header>
    {error ? <div className="lesson-error" role="alert"><p>We couldn’t load usage right now.</p><button onClick={() => { setError(false); setAttempt(attempt + 1); }}>Try again</button></div> : !usage ? <p role="status">Gathering usage…</p> : <><section className="usage-summary"><article><span>Recorded estimate</span><strong>{money(usage.estimated_cost_usd)}</strong><p>USD · all recorded sessions</p></article><article><span>Unknown call costs</span><strong>{usage.unknown_calls}</strong><p>Missing usage is never counted as free.</p></article><article><span>Earlier untracked runs</span><strong>{usage.untracked_runs}</strong><p>Historical costs could not be recovered.</p></article></section>
    <section><h2>Where it went</h2><div className="usage-filters"><label>Session<select value={session} onChange={(event) => setSession(event.target.value)}><option value="all">All sessions</option>{[...new Set(usage.groups.map((group) => group.lesson_id))].map((id) => <option key={id} value={id}>{id.slice(0, 8)}</option>)}</select></label><label>Model<select value={model} onChange={(event) => setModel(event.target.value)}><option value="all">All models</option>{[...new Set(usage.groups.map((group) => group.model))].map((value) => <option key={value}>{value}</option>)}</select></label><label>Day<input type="date" value={day} onChange={(event) => setDay(event.target.value)} /></label></div>
    {!rows.length ? <p>No recorded calls for this selection.</p> : <div className="usage-table" tabIndex={0} role="region" aria-label="AI usage details"><table><thead><tr><th>Day / session</th><th>Operation / model</th><th>Calls / retries</th><th>Tokens / cached</th><th>Estimate</th></tr></thead><tbody>{rows.map((group) => <tr key={[group.day, group.lesson_id, group.operation, group.model].join(":")}><td>{group.day}<br /><Link to={`/sessions/${group.lesson_id}`}>{group.lesson_id.slice(0, 8)}</Link></td><td>{group.operation.replaceAll("_", " ")}<small>{group.model}</small></td><td>{group.calls} / {group.retry_calls}</td><td>{group.tokens.toLocaleString()} / {group.cached_tokens.toLocaleString()}</td><td>{money(group.estimated_cost_usd)}{group.unknown_calls > 0 && <small>+ {group.unknown_calls} unknown</small>}</td></tr>)}</tbody></table></div>}</section></>}
    <section className="usage-explainer"><h2>What goes into a painting session?</h2><p>A medium landscape preview is about $0.041 in image output. A preview and a layer board are about $0.082 together, plus image inputs, written guidance, and board checks. Repainting adds calls; opening a saved session does not.</p><p>These estimates use prices dated September 8, 2026. They aren’t an invoice or your remaining OpenAI balance. This page shares the app’s existing private deployment access.</p><a className="text-link" href="https://developers.openai.com/api/docs/pricing" target="_blank" rel="noreferrer">OpenAI pricing ↗</a></section>
  </div>;
}
