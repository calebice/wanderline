import { Link, useSearchParams } from "react-router-dom";
import { StartPaintingLink } from "./studio-ui";

export function AppNav() {
  const [params] = useSearchParams();
  const view = params.get("view");
  const current = view === "feeling-first" ? "feeling" : view === "sessions" || view?.includes("lesson") ? "sessions" : "explore";
  return <nav className="app-nav" aria-label="Wanderline navigation">
    <Link className="brand" to="/"><span aria-hidden="true">✦</span><span>Wanderline<small>A little room to create</small></span></Link>
    <div>{[{ id: "explore", label: "Explore", to: "/" }, { id: "sessions", label: "Painting sessions", to: "/?view=sessions" }, { id: "feeling", label: "Feeling First", to: "/?view=feeling-first&emotion=pensive" }].map((item) => <Link key={item.id} to={item.to} className={current === item.id ? "is-active" : undefined} aria-current={current === item.id ? "page" : undefined}>{item.label}</Link>)}<StartPaintingLink /></div>
  </nav>;
}
