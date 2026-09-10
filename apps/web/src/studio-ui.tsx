import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, type NavigateOptions } from "react-router-dom";

export function StartPaintingLink({ children = "Start painting", className = "button-link" }: { children?: ReactNode; className?: string }) {
  const location = useLocation();
  return <Link className={className} to="/?view=lesson-create" state={{ background: location }}>{children}</Link>;
}

export function StudioDialog({ open, onClose, children, wide = false, label = "Start a painting session" }: { open: boolean; onClose: () => void; children: ReactNode; wide?: boolean; label?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, [open]);
  return <dialog ref={ref} className={`studio-dialog${wide ? " studio-dialog--wide" : ""}`} aria-label={label} onKeyDown={(event) => {
    if (event.key !== "Tab") return;
    const dialog = ref.current;
    const controls = Array.from(dialog?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, [tabindex="0"]') || []).filter((element) => element.getClientRects().length > 0);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <button type="button" className="studio-dialog__close" onClick={onClose} aria-label="Close dialog">×</button>
    <div className="studio-dialog__body">{children}</div>
  </dialog>;
}

type Confirmation = { message: string; resolve: (result: boolean) => void };
const ConfirmationContext = createContext<(message: string) => Promise<boolean>>(async () => false);

export function StudioConfirmationProvider({ children }: { children: ReactNode }) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const ask = useCallback((message: string) => new Promise<boolean>((resolve) => setConfirmation({ message, resolve })), []);
  function finish(value: boolean) { confirmation?.resolve(value); setConfirmation(null); }
  return <ConfirmationContext.Provider value={ask}>{children}<StudioDialog open={Boolean(confirmation)} onClose={() => finish(false)} label="Review this change"><h2>A small pause before we change things.</h2><p>{confirmation?.message}</p><div className="studio-actions"><button type="button" className="button-secondary" onClick={() => finish(false)}>Keep this version</button><button type="button" onClick={() => finish(true)}>Continue</button></div></StudioDialog></ConfirmationContext.Provider>;
}

// These hooks share the dialog's context and navigation state.
// eslint-disable-next-line react-refresh/only-export-components
export function useStudioConfirm() { return useContext(ConfirmationContext); }
// eslint-disable-next-line react-refresh/only-export-components
export function useSessionNavigate() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback((to: string, options?: NavigateOptions) => navigate(to, { state: location.state, ...options }), [navigate, location.state]);
}
