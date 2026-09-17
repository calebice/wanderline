import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router-dom";
import "./garden-ui.css";

type ActionVariant = "primary" | "secondary" | "quiet";

export function GardenButton({ variant = "primary", className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ActionVariant }) {
  return <button {...props} type={type} className={`garden-action garden-action--${variant} ${className}`} />;
}

export function GardenLink({ variant = "quiet", className = "", ...props }: LinkProps & { variant?: ActionVariant }) {
  return <Link {...props} className={`garden-action garden-action--${variant} ${className}`} />;
}

export function GardenHeading({ title, eyebrow, children, action, expressive = false, level = 2 }: { title: string; eyebrow?: string; children?: ReactNode; action?: ReactNode; expressive?: boolean; level?: 1 | 2 | 3 }) {
  const Heading = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
  return <header className={`garden-heading${expressive ? " garden-heading--expressive" : ""}`}>
    <div>{eyebrow && <p className="garden-eyebrow">{eyebrow}</p>}<Heading>{title}</Heading>{children && <div className="garden-heading__description">{children}</div>}</div>
    {action && <div className="garden-heading__action">{action}</div>}
  </header>;
}

export function GardenInput({ label, hint, error, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const descriptions = [props["aria-describedby"], hint && `${fieldId}-hint`, error && `${fieldId}-error`].filter(Boolean).join(" ") || undefined;
  return <div className="garden-field"><label htmlFor={fieldId}>{label}</label>
    <input {...props} id={fieldId} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={descriptions} />
    {hint && <p id={`${fieldId}-hint`}>{hint}</p>}{error && <p className="garden-field__error" id={`${fieldId}-error`}>{error}</p>}
  </div>;
}

export function GardenSelect({ label, id, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  return <div className="garden-field"><label htmlFor={fieldId}>{label}</label><select {...props} id={fieldId}>{children}</select></div>;
}

export function GardenChoices<T extends string>({ label, options, value, onChange }: { label: string; options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <div className="garden-choices" role="group" aria-label={label}>{options.map((option) =>
    <GardenButton key={option.value} variant="secondary" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>{option.label}</GardenButton>,
  )}</div>;
}

export function GardenNotice({ kind = "info", children, action }: { kind?: "info" | "loading" | "success" | "error"; children: ReactNode; action?: ReactNode }) {
  return <div className={`garden-notice garden-notice--${kind}`} role={kind === "error" ? "alert" : "status"}>
    <p><strong>{kind === "error" ? "Needs attention" : kind === "success" ? "Saved" : kind === "loading" ? "Loading" : "Please note"}</strong>{children}</p>{action}
  </div>;
}

export function GardenEmpty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="garden-empty"><span className="garden-pigment" aria-hidden="true" /><h3>{title}</h3><p>{children}</p>{action}</section>;
}
