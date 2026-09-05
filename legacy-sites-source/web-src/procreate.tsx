import { useEffect, useMemo, useState } from "react";

import type { LibraryAttempt, LibraryExercise } from "./api";
import {
  OVERLAY_PRESETS,
  overlayFilename,
  renderOverlayPng,
  renderOverlaySvg,
  validateOverlaySize,
  type OverlaySettings,
} from "./overlay";

type ProcreateOverlayEditorProps = {
  exercise: LibraryExercise;
  attempt: LibraryAttempt;
  onClose: () => void;
  onExport: () => Promise<void>;
};

function supportsPngClipboard() {
  return typeof navigator !== "undefined" && Boolean(navigator.clipboard?.write) && typeof ClipboardItem !== "undefined";
}

function supportsFileShare(file?: File) {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  return file && typeof navigator.canShare === "function" ? navigator.canShare({ files: [file] }) : true;
}

function isIpadSafari() {
  if (typeof navigator === "undefined") return false;
  const ipad = /iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return ipad && /Safari/.test(navigator.userAgent) && !/(CriOS|FxiOS|EdgiOS)/.test(navigator.userAgent);
}

function isStandaloneWebApp() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function IpadInstallHint() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("drawcoach-install-hint-dismissed") === "true");
  if (dismissed || !isIpadSafari() || isStandaloneWebApp()) return null;
  return (
    <aside className="ipad-install-hint" aria-label="Install Wanderline on iPad">
      <div>
        <p className="eyebrow">QUICKER ON IPAD</p>
        <strong>Keep Wanderline beside Procreate.</strong>
        <p>In Safari, tap Share, choose Add to Home Screen, then turn on Open as Web App.</p>
      </div>
      <button type="button" className="text-button" onClick={() => { localStorage.setItem("drawcoach-install-hint-dismissed", "true"); setDismissed(true); }}>Dismiss</button>
    </aside>
  );
}

const DEFAULT_SETTINGS: OverlaySettings = {
  width: 2048,
  height: 2048,
  color: "#d94f35",
  opacity: 0.72,
  lineWeight: 4,
  labels: false,
};

export function ProcreateOverlayEditor({ exercise, attempt, onClose, onExport }: ProcreateOverlayEditorProps) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const sizeError = validateOverlaySize(settings.width, settings.height);
  const filename = overlayFilename(exercise.id, attempt.variant_seed, settings.width, settings.height);
  const svgPreview = useMemo(() => sizeError ? "" : renderOverlaySvg({ exercise, attempt, settings }), [attempt, exercise, settings, sizeError]);

  useEffect(() => {
    if (sizeError) {
      setBlob(null);
      setRendering(false);
      return;
    }
    let active = true;
    let nextUrl: string | null = null;
    const timer = window.setTimeout(() => {
      setRendering(true);
      void renderOverlayPng({ exercise, attempt, settings }).then((nextBlob) => {
        if (!active) return;
        nextUrl = URL.createObjectURL(nextBlob);
        setBlob(nextBlob);
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return nextUrl;
        });
        setRendering(false);
      }).catch((error: unknown) => {
        if (!active) return;
        setRendering(false);
        setStatus(error instanceof Error ? error.message : "The PNG could not be prepared.");
      });
    }, 120);
    return () => {
      active = false;
      window.clearTimeout(timer);
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [attempt, exercise, settings, sizeError]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const file = blob ? new File([blob], filename, { type: "image/png" }) : undefined;
  const canCopy = supportsPngClipboard();
  const canShare = supportsFileShare(file);

  async function markExported(message: string) {
    await onExport();
    setStatus(message);
  }

  async function copyOverlay() {
    if (!blob || !canCopy) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      await markExported("Copied. Switch to Procreate and choose Paste to add the guide as a new layer.");
    } catch {
      setStatus("Copy was blocked. Use Share PNG or Save PNG instead.");
    }
  }

  async function shareOverlay() {
    if (!file || !canShare) return;
    try {
      await navigator.share({ files: [file], title: `${exercise.title} guide` });
      await markExported("Overlay shared as a transparent PNG.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("The share sheet could not open. Save the PNG to Files instead.");
    }
  }

  function saveOverlay() {
    if (!previewUrl) return;
    const anchor = document.createElement("a");
    anchor.href = previewUrl;
    anchor.download = filename;
    anchor.click();
    void markExported("PNG saved. In Procreate use Actions → Add → Insert a file, or Insert a private file.");
  }

  function choosePreset(width: number, height: number) {
    setSettings((current) => ({ ...current, width, height }));
  }

  return (
    <div className="procreate-editor-backdrop" role="presentation">
      <section className="procreate-editor" role="dialog" aria-modal="true" aria-labelledby="procreate-editor-title">
        <header>
          <div><p className="eyebrow">TRANSPARENT PROCREATE GUIDE</p><h2 id="procreate-editor-title">Place the construction on your canvas.</h2></div>
          <button type="button" className="procreate-close" aria-label="Close overlay editor" onClick={onClose}>×</button>
        </header>
        <div className="procreate-editor__layout">
          <div className="procreate-preview-wrap">
            <div className="procreate-preview" style={{ aspectRatio: `${settings.width} / ${settings.height}` }}>
              {svgPreview && <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgPreview)}`} alt={`${exercise.title} transparent overlay preview`} draggable={Boolean(previewUrl)} onDragStart={(event) => { if (!previewUrl) return; event.dataTransfer.setData("DownloadURL", `image/png:${filename}:${previewUrl}`); event.dataTransfer.setData("text/uri-list", previewUrl); }} />}
              {rendering && <span>Preparing exact-size PNG…</span>}
            </div>
            <p>Drag this preview into Procreate in Split View, or use one of the transfer actions.</p>
          </div>
          <form className="procreate-controls" onSubmit={(event) => event.preventDefault()}>
            <fieldset><legend>Canvas size</legend><div className="overlay-presets">{OVERLAY_PRESETS.map((preset) => <button type="button" key={preset.label} className={settings.width === preset.width && settings.height === preset.height ? "is-selected" : ""} onClick={() => choosePreset(preset.width, preset.height)}><strong>{preset.label}</strong><span>{preset.width} × {preset.height}</span></button>)}</div><div className="dimension-inputs"><label><span>Width</span><input aria-label="Overlay width" type="number" min="256" value={settings.width} onChange={(event) => setSettings((current) => ({ ...current, width: Number(event.target.value) }))} /></label><span>×</span><label><span>Height</span><input aria-label="Overlay height" type="number" min="256" value={settings.height} onChange={(event) => setSettings((current) => ({ ...current, height: Number(event.target.value) }))} /></label></div>{sizeError && <p role="alert">{sizeError}</p>}</fieldset>
            <fieldset><legend>Guide appearance</legend><div className="overlay-colors">{["#d94f35", "#1689a8", "#7c4dcc", "#252720", "#f1b92c"].map((color) => <button key={color} type="button" aria-label={`Guide color ${color}`} className={settings.color === color ? "is-selected" : ""} style={{ backgroundColor: color }} onClick={() => setSettings((current) => ({ ...current, color }))} />)}</div><label><span>Opacity <output>{Math.round(settings.opacity * 100)}%</output></span><input aria-label="Guide opacity" type="range" min="0.1" max="1" step="0.05" value={settings.opacity} onChange={(event) => setSettings((current) => ({ ...current, opacity: Number(event.target.value) }))} /></label><label><span>Line weight <output>{settings.lineWeight}px</output></span><input aria-label="Guide line weight" type="range" min="1" max="12" step="1" value={settings.lineWeight} onChange={(event) => setSettings((current) => ({ ...current, lineWeight: Number(event.target.value) }))} /></label><label className="overlay-label-toggle"><input type="checkbox" checked={settings.labels} onChange={(event) => setSettings((current) => ({ ...current, labels: event.target.checked }))} /><span>Include short instructional labels</span></label></fieldset>
          </form>
        </div>
        <div className="procreate-transfer-actions">
          <button type="button" onClick={() => void copyOverlay()} disabled={!blob || rendering || !canCopy}>Copy overlay</button>
          <button type="button" className="quiet-button" onClick={() => void shareOverlay()} disabled={!file || rendering || !canShare}>Share PNG</button>
          <button type="button" className="quiet-button" onClick={saveOverlay} disabled={!previewUrl || rendering}>Save PNG</button>
        </div>
        {!canCopy && <p className="capability-note">PNG clipboard copy is unavailable here. Share or save the file, then insert it in Procreate.</p>}
        {status && <p className="procreate-status" role="status">{status}</p>}
        <ol className="procreate-steps"><li><strong>Transfer</strong><span>Copy, share, save, or drag the transparent PNG.</span></li><li><strong>Place</strong><span>Paste it into Procreate as a new layer and lower the layer opacity if needed.</span></li><li><strong>Draw</strong><span>Add a layer above the guide. Use Insert a private file when you want guides excluded from previews and time-lapse.</span></li></ol>
      </section>
    </div>
  );
}
