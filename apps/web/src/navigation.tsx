import { Link, useSearchParams } from "react-router-dom";

const links = [
  { to: "/", label: "Compare", view: null },
  { to: "/?view=guide&style=realism", label: "Teaching guides", view: "guide" },
  { to: "/?view=watercolor-lesson", label: "Watercolor lesson", view: "watercolor-lesson" },
  { to: "/?view=feeling-first&emotion=pensive", label: "Feeling First", view: "feeling-first" },
] as const;

export function AppNav() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view");

  return (
    <nav className="app-nav" aria-label="Wanderline navigation">
      <Link className="brand" to="/">
        <span aria-hidden="true">✦</span>
        <span>Wanderline <small>Style Studio</small></span>
      </Link>
      <div>
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={(link.view === null ? !view : view === link.view) ? "is-active" : undefined}
            aria-current={(link.view === null ? !view : view === link.view) ? "page" : undefined}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
