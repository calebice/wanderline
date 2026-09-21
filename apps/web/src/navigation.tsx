import { Link, useLocation } from "react-router-dom";
import { StartPaintingLink } from "./studio-ui";

export function AppNav() {
  const location = useLocation();
  const current = location.pathname === "/" ? "home" : location.pathname.startsWith("/sessions") ? "sessions" : location.pathname === "/color-mixing" ? "mixing" : location.pathname.startsWith("/explore") ? "explore" : null;
  return <nav className="app-nav" aria-label="Wanderline navigation">
    <Link className="brand" to="/"><span aria-hidden="true">✦</span><span>Wanderline<small>A little room to create</small></span></Link>
    <div>{[{ id: "home", label: "Home", to: "/" }, { id: "explore", label: "Explore", to: "/explore" }, { id: "sessions", label: "Sessions", to: "/sessions" }, { id: "mixing", label: "Color mixing", to: "/color-mixing" }].map((item) => <Link key={item.id} to={item.to} className={current === item.id ? "is-active" : undefined} aria-current={current === item.id ? "page" : undefined}>{item.label}</Link>)}<StartPaintingLink /></div>
  </nav>;
}
