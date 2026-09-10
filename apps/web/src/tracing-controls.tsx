import { useEffect, useState } from "react";
import { StudioDialog } from "./studio-ui";
import { inkBounds, tracingSize, type InkBounds } from "./tracing-print";

export function TracingControls({ url }: { url?: string }) {
  const [open, setOpen] = useState(false);
  const [inches, setInches] = useState(6);
  const [paper, setPaper] = useState<"A4" | "Letter">("A4");
  const [prepared, setPrepared] = useState<{ url: string; bounds: InkBounds; source: string } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!url) return;
    let active = true;
    const image = new Image();
    const controller = new AbortController();
    let objectUrl: string | undefined;
    image.onload = () => {
      if (!active) return;
      try {
        const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
        const bounds = inkBounds(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        if (!bounds) throw new Error("No visible outline was found. Choose another preview before printing.");
        const padding = tracingSize(bounds, 6, "A4").padding;
        const crop = document.createElement("canvas"); crop.width = bounds.width + 2 * padding; crop.height = bounds.height + 2 * padding;
        const ctx = crop.getContext("2d")!; ctx.fillStyle = "white"; ctx.fillRect(0, 0, crop.width, crop.height);
        ctx.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height, padding, padding, bounds.width, bounds.height);
        setPrepared({ url, bounds, source: crop.toDataURL("image/png") }); setError("");
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not prepare the outline for printing."); }
    };
    image.onerror = () => { if (active) setError("Could not load the outline. Refresh to try again."); };
    // Fetch separately: the visible image can have a cached non-CORS response.
    // A fresh CORS fetch followed by a local blob keeps canvas readable.
    void fetch(url, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("The outline could not be loaded. Try again.");
      const blob = await response.blob();
      if (!active) return;
      objectUrl = URL.createObjectURL(blob); image.src = objectUrl;
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not prepare the outline. Try again.");
    });
    return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url, attempt]);
  const current = prepared?.url === url ? prepared : null;
  const size = current ? tracingSize(current.bounds, inches, paper) : null;
  return <>
    <button type="button" className="recipe-print-action recipe-sheet__tools" onClick={() => setOpen(true)}>Print Outline</button>
    <StudioDialog open={open} onClose={() => setOpen(false)} label="Print Outline">
    <h2>Your outline, ready for paper.</h2>
    {url && <img className="tracing-dialog-preview" src={url} alt="Matching outline to trace lightly onto watercolor paper" />}
    <div className="recipe-sheet__print-controls recipe-sheet__tools">
      <label>Tracing size<select value={inches} onChange={(e) => setInches(Number(e.target.value))}><option value={4}>Small · 4 in / 10.2 cm</option><option value={6}>Medium · 6 in / 15.2 cm</option><option value={8}>Large · 8 in / 20.3 cm</option></select></label>
      <label>Paper<select value={paper} onChange={(e) => setPaper(e.target.value as "A4" | "Letter")}><option>A4</option><option value="Letter">US Letter</option></select></label>
      <button type="button" className="recipe-print-action" disabled={!size} onClick={() => window.print()}>Print tracing outline</button>
      {size && <small>Subject’s longest side: {size.actualInches.toFixed(1)} in / {(size.actualInches * 2.54).toFixed(1)} cm{size.actualInches < inches - .01 ? " · reduced to fit this paper" : ""}. Print at 100% scale with browser headers and footers off.</small>}
      {!url && <small>No tracing outline is available for this session.</small>}
      {url && !size && !error && <small role="status">Preparing your outline…</small>}
      {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Try loading the outline again</button></div>}
    </div>
    </StudioDialog>
    {current && size && <><style>{`@media print { @page { size: ${paper === "Letter" ? "letter" : "A4"} ${size.landscape ? "landscape" : "portrait"}; margin: 12mm; } }`}</style><div className="recipe-print-only"><img src={current.source} alt="Sized tracing outline for printing" style={{ width: `${size.widthMM}mm`, height: `${size.heightMM}mm` }} /></div></>}
  </>;
}
