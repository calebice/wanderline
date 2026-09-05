import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";

import {
  createImageDecomposition,
  decompositionImageUrl,
  type DecompositionGuide,
  type DecompositionShape,
  type ImageDecomposition,
} from "./api";
import { geometryCenter, renderDecompositionSvg } from "./decomposition-render";
import { AppNav } from "./navigation";
import type { BreakdownReferenceTransfer } from "./references";

type DetailLevel = "simple" | "medium" | "detailed";

const levelCopy: Record<DetailLevel, { label: string; description: string }> = {
  simple: { label: "Block-in", description: "Grouped masses for the first light marks." },
  medium: { label: "Shapes", description: "Individual regions for the construction pass." },
  detailed: { label: "Details", description: "Every stable region the analysis kept." },
};

function pointsAttribute(points: Array<{ x: number; y: number }>, scale = 1000) {
  return points.map((point) => `${point.x * scale},${point.y * scale}`).join(" ");
}

function GeometryElement({
  geometry,
  className,
  fill,
}: {
  geometry: DecompositionGuide;
  className: string;
  fill?: string;
}) {
  if (geometry.type === "rect") {
    return <rect className={className} fill={fill} x={geometry.x * 1000} y={geometry.y * 1000} width={geometry.width * 1000} height={geometry.height * 1000} />;
  }
  if (geometry.type === "ellipse") {
    return <ellipse className={className} fill={fill} cx={geometry.cx * 1000} cy={geometry.cy * 1000} rx={geometry.rx * 1000} ry={geometry.ry * 1000} transform={`rotate(${geometry.rotation} ${geometry.cx * 1000} ${geometry.cy * 1000})`} />;
  }
  if (geometry.type === "line") {
    return <line className={className} x1={geometry.x1 * 1000} y1={geometry.y1 * 1000} x2={geometry.x2 * 1000} y2={geometry.y2 * 1000} />;
  }
  return <polygon className={className} fill={fill} points={pointsAttribute(geometry.points)} />;
}

function ShapeLayer({
  shapes,
  hints,
  labels,
  guides,
  mode,
}: {
  shapes: DecompositionShape[];
  hints: ImageDecomposition["construction_hints"];
  labels: boolean;
  guides: boolean;
  mode: "overlay" | "reconstruction";
}) {
  const visibleIds = new Set(shapes.map((shape) => shape.id));
  return (
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label={mode === "overlay" ? "Detected shape overlay" : "Clean shape reconstruction"}>
      {shapes.map((shape) => (
        <GeometryElement
          key={shape.id}
          geometry={shape.geometry}
          className={`breakdown-shape breakdown-shape--${mode}`}
          fill={shape.color}
        />
      ))}
      {guides && hints.filter((hint) => hint.member_shape_ids.some((id) => visibleIds.has(id))).flatMap((hint) =>
        hint.guides.map((guide, index) => (
          <GeometryElement key={`${hint.id}-${index}`} geometry={guide} className="breakdown-guide" />
        )),
      )}
      {labels && shapes.map((shape, index) => {
        const center = geometryCenter(shape.geometry);
        return <text key={`label-${shape.id}`} className="breakdown-label" x={center.x * 1000} y={center.y * 1000}>{index + 1} · {shape.kind.replaceAll("_", " ")}</text>;
      })}
    </svg>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function exportPng(svg: string, decomposition: ImageDecomposition) {
  const source = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("The reconstruction could not be rasterized."));
      element.src = source;
    });
    const scale = Math.min(1, 2048 / Math.max(decomposition.image.width, decomposition.image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(decomposition.image.width * scale));
    canvas.height = Math.max(1, Math.round(decomposition.image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PNG export is not available in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG export failed.")), "image/png"));
    downloadBlob(blob, `wanderline-breakdown-${decomposition.id.slice(0, 8)}.png`);
  } finally {
    URL.revokeObjectURL(source);
  }
}

function BreakdownResults({ decomposition }: { decomposition: ImageDecomposition }) {
  const [level, setLevel] = useState<DetailLevel>("simple");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [photoOpacity, setPhotoOpacity] = useState(58);
  const [labels, setLabels] = useState(false);
  const [guides, setGuides] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const levelIds = decomposition.levels[level];
  const shapes = useMemo(() => decomposition.shapes.filter((shape) => levelIds.includes(shape.id) && !hidden.has(shape.id)), [decomposition.shapes, hidden, levelIds]);
  const visibleIds = shapes.map((shape) => shape.id);

  function toggleShape(id: string) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exportSvg() {
    const svg = renderDecompositionSvg(decomposition, visibleIds, labels, guides);
    downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `wanderline-breakdown-${decomposition.id.slice(0, 8)}.svg`);
    setExportStatus("SVG downloaded.");
  }

  async function handlePngExport() {
    setExportStatus("Preparing PNG…");
    try {
      await exportPng(renderDecompositionSvg(decomposition, visibleIds, labels, guides), decomposition);
      setExportStatus("PNG downloaded.");
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "PNG export failed.");
    }
  }

  const activeSteps = decomposition.drawing_steps.filter((step) => visibleIds.includes(step.shape_id));
  const fallbackShare = shapes.length > 0 ? shapes.filter((shape) => shape.source === "fallback").length / shapes.length : 1;
  const quality = decomposition.confidence >= 0.8 && fallbackShare <= 0.4 ? "Strong geometric separation" : decomposition.confidence >= 0.58 ? "Mixed geometric fit" : "Weak geometric fit";
  return (
    <section className="breakdown-results" aria-labelledby="breakdown-results-title">
      <div className="breakdown-results__heading">
        <div>
          <p className="eyebrow">LOCAL GEOMETRIC STUDY</p>
          <h2 id="breakdown-results-title">Build it from the largest shapes.</h2>
          <p>{decomposition.summary}</p>
        </div>
        <span>{quality}</span>
      </div>
      <div className="breakdown-levels" aria-label="Reconstruction detail">
        {(["simple", "medium", "detailed"] as const).map((item) => <button key={item} type="button" className={level === item ? "is-selected" : ""} aria-pressed={level === item} onClick={() => setLevel(item)}>{levelCopy[item].label}<small>{decomposition.levels[item].length} shapes</small></button>)}
      </div>
      <p className="breakdown-level-note"><strong>{levelCopy[level].label}:</strong> {levelCopy[level].description}</p>
      <div className="breakdown-workspace">
        <div className="breakdown-views">
          <figure>
            <div className="breakdown-canvas" style={{ aspectRatio: `${decomposition.image.width} / ${decomposition.image.height}` }}>
              <img src={decompositionImageUrl(decomposition.image.id)} alt="Uploaded reference with geometric overlay" style={{ opacity: photoOpacity / 100 }} />
              <ShapeLayer shapes={shapes} hints={decomposition.construction_hints} labels={labels} guides={guides} mode="overlay" />
            </div>
            <figcaption>Photo overlay</figcaption>
          </figure>
          <figure>
            <div className="breakdown-canvas breakdown-canvas--clean" style={{ aspectRatio: `${decomposition.image.width} / ${decomposition.image.height}` }}>
              <ShapeLayer shapes={shapes} hints={decomposition.construction_hints} labels={labels} guides={guides} mode="reconstruction" />
            </div>
            <figcaption>Clean reconstruction</figcaption>
          </figure>
        </div>
        <aside className="breakdown-controls" aria-label="Shape display controls">
          <div className="breakdown-opacity"><label htmlFor="breakdown-photo-opacity">Photo opacity</label><output htmlFor="breakdown-photo-opacity">{photoOpacity}%</output><input id="breakdown-photo-opacity" type="range" min="0" max="100" value={photoOpacity} onChange={(event) => setPhotoOpacity(Number(event.target.value))} /></div>
          <label className="breakdown-check"><input type="checkbox" checked={labels} onChange={(event) => setLabels(event.target.checked)} /> Show geometry labels</label>
          <label className="breakdown-check"><input type="checkbox" checked={guides} onChange={(event) => setGuides(event.target.checked)} /> Show construction guides</label>
          <div className="breakdown-shape-list">
            <strong>Visible shapes</strong>
            {decomposition.shapes.filter((shape) => levelIds.includes(shape.id)).map((shape, index) => (
              <label key={shape.id}><input type="checkbox" checked={!hidden.has(shape.id)} onChange={() => toggleShape(shape.id)} /><i className="breakdown-color" style={{ background: shape.color }} aria-hidden="true" /><span><b>{index + 1}. {shape.kind.replaceAll("_", " ")}</b><small>{Math.round(shape.confidence * 100)}% · {shape.source}</small></span></label>
            ))}
          </div>
        </aside>
      </div>
      <div className="breakdown-aftercare">
        <article>
          <p className="eyebrow">DRAWING ORDER</p>
          <ol>{activeSteps.map((step, index) => <li key={step.shape_id}><span>{index + 1}</span>{step.instruction}</li>)}</ol>
        </article>
        <article>
          <p className="eyebrow">TAKE IT WITH YOU</p>
          <h3>Export the visible study</h3>
          <p>The private source photo is never embedded in either file.</p>
          <div><button type="button" onClick={exportSvg}>Download SVG</button><button type="button" className="quiet-button" onClick={handlePngExport}>Download PNG</button></div>
          {exportStatus && <small role="status">{exportStatus}</small>}
        </article>
      </div>
      {decomposition.warnings.length > 0 && <aside className="breakdown-warnings"><strong>Best-effort notes</strong><ul>{decomposition.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></aside>}
      <p className="breakdown-limit">{decomposition.limitations}</p>
    </section>
  );
}

export function ImageBreakdown() {
  const location = useLocation();
  const reference = (location.state as { reference?: BreakdownReferenceTransfer } | null)?.reference;
  const [file, setFile] = useState<File | null>(reference?.file ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const decomposition = useMutation({ mutationFn: createImageDecomposition });

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (file) decomposition.mutate(file);
  }

  let content: ReactNode;
  if (decomposition.data) {
    content = <><BreakdownResults decomposition={decomposition.data} /><button type="button" className="breakdown-another" onClick={() => { decomposition.reset(); setFile(null); }}>Break down another image</button></>;
  } else {
    content = (
      <form className="upload-form" onSubmit={submit}>
        <div className="breakdown-source-picker" aria-label="Image source">
          <div><strong>Upload your own</strong><span>Use a photo already on this device.</span></div>
          <Link to="/references?for=breakdown"><strong>Use Reference Finder</strong><span>Search curated open archives by subject, style, or source.</span></Link>
        </div>
        {reference && <p className="breakdown-reference-note"><strong>Selected from Reference Finder:</strong> {reference.title}{reference.creator ? ` · ${reference.creator}` : ""}{reference.license ? ` · ${reference.license}` : ""}{reference.sourceUrl && <> · <a href={reference.sourceUrl} target="_blank" rel="noreferrer">View source ↗</a></>}</p>}
        <label className="upload-dropzone">
          <input type="file" accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          {previewUrl ? <img src={previewUrl} alt="Selected reference preview" /> : <><strong>Choose a JPEG, PNG, or HEIC reference</strong><span>One clear subject against a distinct background works best. Maximum 15 MB.</span></>}
        </label>
        {decomposition.isError && <p role="alert">{decomposition.error.message}</p>}
        <button type="submit" disabled={!file || decomposition.isPending}>{decomposition.isPending ? "Finding drawable shapes…" : "Break down image"}</button>
      </form>
    );
  }

  return <><AppNav /><section className="breakdown-page"><Link className="back-link" to="/library">← Exercise library</Link><p className="eyebrow">IMAGE BREAKDOWN</p><h1>See the simple shapes underneath.</h1><p className="lede">Turn one clear reference into a private, local study of large masses and geometric construction hints. The result is an approximation—not object recognition.</p>{content}</section></>;
}
