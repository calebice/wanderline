import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AppNav } from "./navigation";

type ReferenceCategory = "Botanical" | "Landscape" | "City" | "Animal" | "Photo" | "Illustration" | "GIF / animation";
type ReferenceMedium = "all" | "photo" | "illustration" | "animated";
type ReferenceArchive = "openverse" | "wikimedia";

type ReferenceImage = {
  id: string;
  title: string;
  category: ReferenceCategory;
  imageUrl?: string;
  fallbackImageUrl?: string;
  sourceUrl?: string;
  sourceName?: string;
  creator?: string;
  license?: string;
  prompt: string;
  builtIn?: "flower" | "river" | "city" | "fox";
};

type OpenverseResult = {
  id: string;
  title?: string | null;
  foreign_landing_url?: string | null;
  thumbnail?: string | null;
  url?: string | null;
  creator?: string | null;
  license?: string | null;
  license_version?: string | null;
  source?: string | null;
  category?: string | null;
  filetype?: string | null;
  fields_matched?: string[];
  tags?: Array<{ name?: string | null; accuracy?: number | null }>;
};

type OpenverseResponse = {
  results?: OpenverseResult[];
};

export type BreakdownReferenceTransfer = {
  file: File;
  title: string;
  creator?: string;
  license?: string;
  sourceUrl?: string;
};

const builtInReferences: ReferenceImage[] = [
  {
    id: "study-flower",
    title: "Wild poppy",
    category: "Botanical",
    prompt: "Find the gesture of the stem first, then build the petals around the center.",
    builtIn: "flower",
  },
  {
    id: "study-river",
    title: "River bend",
    category: "Landscape",
    prompt: "Use three value groups and let the river carry the eye into the distance.",
    builtIn: "river",
  },
  {
    id: "study-city",
    title: "Corner café",
    category: "City",
    prompt: "Place the horizon line, then simplify the buildings into large boxes.",
    builtIn: "city",
  },
  {
    id: "study-fox",
    title: "Seated fox",
    category: "Animal",
    prompt: "Start with the ribcage and hips as two simple masses before adding contour.",
    builtIn: "fox",
  },
];

const quickSearches = ["garden flowers", "winding river landscape", "street corner architecture", "animals sitting"];

const ignoredSearchWords = new Set(["a", "an", "and", "at", "for", "in", "of", "on", "the", "to", "with"]);
const utilityImageWords = new Set(["badge", "chart", "coat", "county", "diagram", "emblem", "flag", "highlighted", "icon", "locator", "logo", "map", "poster", "seal", "sign", "symbol"]);

function searchTokens(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token && !ignoredSearchWords.has(token))
    .map((token) => token.endsWith("ies") ? `${token.slice(0, -3)}y` : token.endsWith("es") && token.length > 4 ? token.slice(0, -2) : token.endsWith("s") && token.length > 3 ? token.slice(0, -1) : token);
}

function tokenMatches(queryToken: string, candidateToken: string) {
  return queryToken === candidateToken || (queryToken.length >= 5 && candidateToken.length >= 5 && (queryToken.startsWith(candidateToken) || candidateToken.startsWith(queryToken)));
}

function relevanceScore(result: OpenverseResult, query: string) {
  const queryWords = searchTokens(query);
  const title = result.title?.trim() ?? "";
  const titleWords = searchTokens(title);
  const tagWords = searchTokens((result.tags ?? []).map((tag) => tag.name ?? "").join(" "));
  if (queryWords.length === 0) return 0;
  const unwantedUtilityWord = [...utilityImageWords].find((utilityWord) =>
    titleWords.some((word) => word === utilityWord || (utilityWord.length >= 4 && word.includes(utilityWord)))
    && !queryWords.some((queryWord) => tokenMatches(queryWord, utilityWord)),
  );
  if (unwantedUtilityWord) return 0;

  const titleHits = queryWords.filter((word) => titleWords.some((candidate) => tokenMatches(word, candidate))).length;
  const tagHits = queryWords.filter((word) => tagWords.some((candidate) => tokenMatches(word, candidate))).length;
  const combinedHits = queryWords.filter((word) => [...titleWords, ...tagWords].some((candidate) => tokenMatches(word, candidate))).length;
  const coverage = combinedHits / queryWords.length;
  if (combinedHits === 0 || (queryWords.length > 1 && coverage < 0.5)) return 0;

  const normalizedTitle = titleWords.join(" ");
  const normalizedQuery = queryWords.join(" ");
  const exactTitlePhrase = normalizedTitle.includes(normalizedQuery);
  const titleCoverage = titleHits / queryWords.length;
  const tagCoverage = tagHits / queryWords.length;
  const titleFieldMatch = result.fields_matched?.includes("title") ?? false;
  return (exactTitlePhrase ? 90 : 0) + titleCoverage * 60 + tagCoverage * 24 + coverage * 20 + (titleFieldMatch ? 12 : 0);
}

function licenseLabel(result: OpenverseResult) {
  const code = result.license?.toUpperCase();
  if (!code) return "See source for license";
  if (code === "PDM") return `Public Domain Mark${result.license_version ? ` ${result.license_version}` : ""}`;
  if (code === "CC0") return `CC0${result.license_version ? ` ${result.license_version}` : ""}`;
  return `CC ${code}${result.license_version ? ` ${result.license_version}` : ""}`;
}

function sourceLabel(source: string | null | undefined) {
  if (!source) return "Openverse archive";
  if (source === "wikimedia") return "Wikimedia Commons";
  if (source === "flickr") return "Flickr";
  if (source === "inaturalist") return "iNaturalist";
  return source.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function searchOpenverse(query: string, medium: ReferenceMedium, archive: ReferenceArchive): Promise<ReferenceImage[]> {
  const params = new URLSearchParams({
    q: query,
    page_size: "20",
    mature: "false",
  });
  if (medium === "photo") params.set("category", "photograph");
  if (medium === "illustration") params.set("category", "illustration");
  if (medium === "animated") params.set("extension", "gif");
  if (archive === "wikimedia") params.set("source", "wikimedia");

  const response = await fetch(`https://api.openverse.org/v1/images/?${params}`);
  if (!response.ok) throw new Error("The open reference archive is taking a break. Try again in a moment.");
  const payload = (await response.json()) as OpenverseResponse;

  return (payload.results ?? [])
    .map((result, index) => ({ result, index, score: relevanceScore(result, query) }))
    .filter(({ result, score }) => score > 0 && Boolean(result.thumbnail || result.url))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ result }) => {
      const isAnimated = medium === "animated" || result.filetype?.toLowerCase() === "gif";
      const isIllustration = result.category === "illustration" || result.category === "digitized_artwork";
      return {
        id: `openverse-${result.id}`,
        title: result.title?.trim() || "Untitled reference",
        category: isAnimated ? "GIF / animation" as const : isIllustration ? "Illustration" as const : "Photo" as const,
        imageUrl: result.thumbnail ?? result.url ?? undefined,
        fallbackImageUrl: result.thumbnail && result.url && result.thumbnail !== result.url ? result.url : undefined,
        sourceUrl: result.foreign_landing_url ?? undefined,
        sourceName: sourceLabel(result.source),
        creator: result.creator?.trim() || "Unknown creator",
        license: licenseLabel(result),
        prompt: "Block in the largest shapes first. Save texture and small details for the final minutes.",
      };
    });
}

function StudyArtwork({ kind }: { kind: NonNullable<ReferenceImage["builtIn"]> }) {
  if (kind === "flower") {
    return (
      <svg viewBox="0 0 640 520" role="img" aria-label="A coral poppy on a curved stem">
        <rect width="640" height="520" fill="#d8d6c8" />
        <path d="M292 520 C278 382 320 300 335 215" fill="none" stroke="#3f5547" strokeWidth="16" />
        <path d="M294 396 C212 336 158 374 134 425 C211 436 263 426 294 396Z" fill="#788f75" />
        <path d="M306 337 C389 286 455 319 487 373 C414 391 350 383 306 337Z" fill="#607b64" />
        <g transform="translate(338 191)">
          <path d="M0 5 C-89 47 -147 5 -126 -61 C-106 -119 -41 -96 0 -24Z" fill="#d9674f" />
          <path d="M-3 2 C-48 -72 -15 -132 45 -120 C105 -109 87 -47 25 -10Z" fill="#e57a58" />
          <path d="M9 7 C68 -62 132 -42 137 19 C142 77 72 81 20 36Z" fill="#ca5746" />
          <path d="M1 15 C-25 74 -84 74 -111 29 C-133 -9 -78 -31 -10 -17Z" fill="#ed8660" />
          <circle cx="3" cy="4" r="31" fill="#2e332c" />
          <circle cx="3" cy="4" r="16" fill="#d8a941" />
        </g>
      </svg>
    );
  }
  if (kind === "river") {
    return (
      <svg viewBox="0 0 640 520" role="img" aria-label="A river curving between hills toward distant mountains">
        <rect width="640" height="520" fill="#c7d0cb" />
        <path d="M0 232 L111 126 L201 218 L301 81 L424 226 L513 137 L640 232Z" fill="#78847b" />
        <path d="M0 275 C128 216 217 242 320 270 C445 304 535 234 640 246 V520 H0Z" fill="#7e936d" />
        <path d="M352 259 C279 310 400 335 307 378 C233 413 251 469 278 520 H477 C431 467 377 441 431 390 C498 326 421 288 477 258Z" fill="#b8c9c1" />
        <path d="M0 330 C85 288 176 292 276 340" fill="none" stroke="#52694f" strokeWidth="22" />
        <path d="M442 326 C509 289 569 292 640 310" fill="none" stroke="#52694f" strokeWidth="25" />
        <circle cx="540" cy="92" r="35" fill="#d8ae55" />
      </svg>
    );
  }
  if (kind === "city") {
    return (
      <svg viewBox="0 0 640 520" role="img" aria-label="A quiet café at a city street corner">
        <rect width="640" height="520" fill="#d6d2c6" />
        <path d="M0 454 L640 375 V520 H0Z" fill="#a9a79e" />
        <path d="M79 90 L458 47 V406 L79 452Z" fill="#c77d5c" />
        <path d="M458 47 L590 123 V379 L458 406Z" fill="#a95e4c" />
        <path d="M57 265 L477 220 L495 278 L49 327Z" fill="#3d5149" />
        <path d="M82 284 L464 245 L474 272 L75 315Z" fill="#e6d7b5" />
        <rect x="130" y="332" width="111" height="105" fill="#4b5e5a" transform="rotate(-6 130 332)" />
        <rect x="293" y="309" width="101" height="105" fill="#73918b" transform="rotate(-6 293 309)" />
        <path d="M514 162 L556 183 V258 L514 242Z M514 290 L556 302 V352 L514 344Z" fill="#6e8b88" />
        <g fill="#6f5a4b"><circle cx="247" cy="454" r="19"/><circle cx="354" cy="440" r="19"/><path d="M247 431 H354 L373 445 H228Z"/></g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 640 520" role="img" aria-label="A seated red fox in profile">
      <rect width="640" height="520" fill="#d8d3c6" />
      <ellipse cx="330" cy="445" rx="236" ry="27" fill="#b9b3a5" />
      <path d="M202 403 C102 356 113 265 205 284 C282 299 314 369 326 430 C270 449 232 433 202 403Z" fill="#b95842" />
      <path d="M279 420 C244 298 273 209 362 191 C452 174 505 255 475 348 C455 409 421 434 353 440Z" fill="#cc6749" />
      <path d="M322 215 L304 92 L383 166 L459 105 L449 234Z" fill="#bb5942" />
      <path d="M322 214 C355 273 413 279 455 224 C456 312 413 338 368 323 C327 309 304 267 322 214Z" fill="#e8d8bd" />
      <path d="M335 146 L324 112 L364 159Z M420 158 L451 126 L442 178Z" fill="#3e3932" />
      <circle cx="361" cy="218" r="8" fill="#242622" /><circle cx="424" cy="213" r="8" fill="#242622" />
      <path d="M386 252 L401 246 L410 257 L398 265Z" fill="#242622" />
      <path d="M339 430 C299 368 275 359 239 350 C238 401 261 434 297 446Z" fill="#e8d8bd" />
    </svg>
  );
}

function ReferenceVisual({ reference }: { reference: ReferenceImage }) {
  const [activeImageUrl, setActiveImageUrl] = useState(reference.imageUrl);

  useEffect(() => setActiveImageUrl(reference.imageUrl), [reference.id, reference.imageUrl]);

  if (activeImageUrl) {
    return (
      <img
        src={activeImageUrl}
        alt={reference.title}
        onError={() => setActiveImageUrl(activeImageUrl === reference.imageUrl ? reference.fallbackImageUrl : undefined)}
      />
    );
  }
  if (reference.imageUrl) {
    return (
      <div className="reference-preview-unavailable" role="img" aria-label={`Preview unavailable for ${reference.title}`}>
        <span aria-hidden="true">◇</span>
        <small>Preview unavailable</small>
      </div>
    );
  }
  return <StudyArtwork kind={reference.builtIn!} />;
}

function ReferenceCard({ reference, onSelect }: { reference: ReferenceImage; onSelect: (reference: ReferenceImage) => void }) {
  return (
    <article className="reference-card">
      <button type="button" className="reference-card__visual" onClick={() => onSelect(reference)} aria-label={`Open ${reference.title}`}>
        <ReferenceVisual reference={reference} />
        <span>Open reference</span>
      </button>
      <div className="reference-card__copy">
        <span>{reference.category}{reference.sourceName ? ` · ${reference.sourceName}` : ""}</span>
        <h3>{reference.title}</h3>
        <button type="button" onClick={() => onSelect(reference)}>Practice from this</button>
      </div>
    </article>
  );
}

function safeFilename(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "drawing-reference";
}

async function rasterizeReference(blob: Blob, title: string, dimensions?: { width: number; height: number }) {
  const source = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("That reference could not be converted to PNG."));
      element.src = source;
    });
    const width = Math.max(1, Math.round(dimensions?.width || image.naturalWidth || image.width));
    const height = Math.max(1, Math.round(dimensions?.height || image.naturalHeight || image.height));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Reference conversion is unavailable in this browser.");
    context.drawImage(image, 0, 0, width, height);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Reference conversion failed.")), "image/png"));
    return new File([png], `${safeFilename(title)}.png`, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(source);
  }
}

async function referenceFile(reference: ReferenceImage, builtInArtwork: SVGSVGElement | null) {
  if (reference.imageUrl) {
    let lastError: unknown;
    const candidates = [...new Set([reference.imageUrl, reference.fallbackImageUrl].filter((value): value is string => Boolean(value)))];
    for (const candidate of candidates) {
      try {
        const response = await fetch(candidate);
        if (!response.ok) throw new Error("Image request failed.");
        const blob = await response.blob();
        if (!blob.type.startsWith("image/")) throw new Error("That result is not a usable image.");
        if (["image/jpeg", "image/png", "image/heic", "image/heif"].includes(blob.type)) {
          const extension = blob.type === "image/png" ? "png" : blob.type === "image/jpeg" ? "jpg" : "heic";
          return new File([blob], `${safeFilename(reference.title)}.${extension}`, { type: blob.type });
        }
        return await rasterizeReference(blob, reference.title);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("That reference could not be prepared. Try another image.");
  }

  if (!builtInArtwork) throw new Error("That reference could not be prepared. Try another image.");
  const markup = new XMLSerializer().serializeToString(builtInArtwork);
  const viewBox = builtInArtwork.viewBox.baseVal;
  return rasterizeReference(
    new Blob([markup], { type: "image/svg+xml;charset=utf-8" }),
    reference.title,
    { width: viewBox.width || 1280, height: viewBox.height || 960 },
  );
}

export function ReferenceFinder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isBreakdownPicker = searchParams.get("for") === "breakdown";
  const [query, setQuery] = useState("");
  const [medium, setMedium] = useState<ReferenceMedium>("all");
  const [archive, setArchive] = useState<ReferenceArchive>("openverse");
  const [searchLabel, setSearchLabel] = useState("");
  const [results, setResults] = useState<ReferenceImage[]>([]);
  const [selected, setSelected] = useState<ReferenceImage | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isPreparingBreakdown, setIsPreparingBreakdown] = useState(false);
  const [error, setError] = useState("");
  const [breakdownError, setBreakdownError] = useState("");
  const [minutes, setMinutes] = useState(10);
  const selectedArtwork = useRef<HTMLDivElement>(null);
  const searchSequence = useRef(0);
  const visibleResults = useMemo(() => results.slice(0, 12), [results]);

  useEffect(() => {
    if (!selected) return;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [selected]);

  async function runSearch(searchTerm: string, nextMedium = medium, nextArchive = archive) {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;
    const sequence = ++searchSequence.current;
    setQuery(trimmed);
    setIsSearching(true);
    setError("");
    try {
      const found = await searchOpenverse(trimmed, nextMedium, nextArchive);
      if (sequence !== searchSequence.current) return;
      setResults(found);
      setSearchLabel(trimmed);
      if (found.length === 0) setError("No strong subject matches found. Try a simpler subject, a different type, or all open archives.");
    } catch (searchError) {
      if (sequence !== searchSequence.current) return;
      setError(searchError instanceof Error ? searchError.message : "Reference search is unavailable.");
    } finally {
      if (sequence === searchSequence.current) setIsSearching(false);
    }
  }

  function chooseMedium(nextMedium: ReferenceMedium) {
    setMedium(nextMedium);
    if (searchLabel) void runSearch(searchLabel, nextMedium, archive);
  }

  function chooseArchive(nextArchive: ReferenceArchive) {
    setArchive(nextArchive);
    if (searchLabel) void runSearch(searchLabel, medium, nextArchive);
  }

  function surpriseMe() {
    const next = builtInReferences[Math.floor(Math.random() * builtInReferences.length)];
    setSelected(next);
  }

  async function prepareForBreakdown() {
    if (!selected) return;
    setIsPreparingBreakdown(true);
    setBreakdownError("");
    try {
      const file = await referenceFile(selected, selectedArtwork.current?.querySelector("svg") ?? null);
      const transfer: BreakdownReferenceTransfer = {
        file,
        title: selected.title,
        creator: selected.creator,
        license: selected.license,
        sourceUrl: selected.sourceUrl,
      };
      void navigate("/breakdown", { state: { reference: transfer } });
    } catch (preparationError) {
      setBreakdownError(preparationError instanceof Error ? preparationError.message : "That reference could not be prepared.");
    } finally {
      setIsPreparingBreakdown(false);
    }
  }

  if (selected) {
    return (
      <section className="reference-focus" aria-labelledby="focus-title">
        <nav className="focus-nav">
          <button type="button" className="back-button" onClick={() => setSelected(null)}>← Back to references</button>
          <Link to="/">Wanderline</Link>
        </nav>
        <div className="focus-layout">
          <div className="focus-image" ref={selectedArtwork}><ReferenceVisual reference={selected} /></div>
          <aside className="focus-guide">
            <p className="eyebrow">{selected.category} · REFERENCE</p>
            <h1 id="focus-title">{selected.title}</h1>
            <p className="focus-prompt">{selected.prompt}</p>
            <button type="button" className="focus-breakdown" disabled={isPreparingBreakdown} onClick={() => void prepareForBreakdown()}>{isPreparingBreakdown ? "Preparing reference…" : "Break down this reference"}</button>
            {breakdownError && <p className="reference-error reference-error--focus" role="alert">{breakdownError}</p>}
            <div className="duration-picker" aria-label="Study length">
              <span>Choose a study length</span>
              <div>{[5, 10, 20].map((value) => (
                <button key={value} type="button" className={minutes === value ? "is-selected" : ""} onClick={() => setMinutes(value)}>{value} min</button>
              ))}</div>
            </div>
            <ol className="focus-steps">
              <li><span>01</span><p>Spend one minute looking for the largest angle and shape.</p></li>
              <li><span>02</span><p>Use light marks to place the whole subject before adding detail.</p></li>
              <li><span>03</span><p>Stop at {minutes} minutes and write down one thing you noticed.</p></li>
            </ol>
            {selected.sourceUrl && (
              <p className="source-credit">Reference by {selected.creator} via {selected.sourceName}. {selected.license}. <a href={selected.sourceUrl} target="_blank" rel="noreferrer">View source ↗</a></p>
            )}
          </aside>
        </div>
      </section>
    );
  }

  return (
    <section className="reference-page" aria-labelledby="reference-page-title">
      <AppNav />
      <header className="reference-hero">
        <div>
          <p className="eyebrow">REFERENCE FINDER</p>
          <h1 id="reference-page-title">Find something<br />worth noticing.</h1>
          <p className="lede">{isBreakdownPicker ? "Choose a strong subject match, then send it directly to Image Breakdown." : "Search openly licensed image collections or let us choose a simple study. Weak text-only matches are filtered out before you see them."}</p>
        </div>
        <button type="button" className="surprise-button" onClick={surpriseMe}>
          <span aria-hidden="true">↝</span>
          <strong>Surprise me</strong>
          <small>Pick a ready-to-draw reference</small>
        </button>
      </header>

      <form className="reference-search" onSubmit={(event) => { event.preventDefault(); void runSearch(query); }}>
        <label htmlFor="reference-query">What would you like to draw?</label>
        <div className="reference-query-row">
          <span aria-hidden="true">⌕</span>
          <input id="reference-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “old bicycle” or “bird in flight”" />
          <button type="submit" disabled={isSearching || !query.trim()}>{isSearching ? "Searching…" : "Find references"}</button>
        </div>
        <nav aria-label="Quick reference searches">
          <span>Quick ideas</span>
          {quickSearches.map((idea) => <button key={idea} type="button" onClick={() => void runSearch(idea)}>{idea}</button>)}
        </nav>
        <div className="reference-filters">
          <fieldset>
            <legend>Reference type</legend>
            <div>
              {([
                ["all", "All images"],
                ["photo", "Photos"],
                ["illustration", "Illustrations"],
                ["animated", "GIF / animation"],
              ] as Array<[ReferenceMedium, string]>).map(([value, label]) => (
                <button key={value} type="button" className={medium === value ? "is-selected" : ""} aria-pressed={medium === value} onClick={() => chooseMedium(value)}>{label}</button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Archive</legend>
            <div>
              <button type="button" className={archive === "openverse" ? "is-selected" : ""} aria-pressed={archive === "openverse"} onClick={() => chooseArchive("openverse")}>All open archives</button>
              <button type="button" className={archive === "wikimedia" ? "is-selected" : ""} aria-pressed={archive === "wikimedia"} onClick={() => chooseArchive("wikimedia")}>Wikimedia only</button>
            </div>
          </fieldset>
        </div>
        <p className="reference-search__note">Powered by Openverse. Results must match the subject in their title or tags. GIF / animation targets GIF files; some archives also contain still GIFs.</p>
      </form>

      {error && <p className="reference-error" role="alert">{error} Your built-in studies are still ready below.</p>}
      {visibleResults.length > 0 && (
        <section className="reference-results" aria-labelledby="search-results-title">
          <div className="section-heading"><div><p className="eyebrow">STRONG SUBJECT MATCHES</p><h2 id="search-results-title">Results for “{searchLabel}”</h2></div><span>{visibleResults.length} references</span></div>
          <div className="reference-grid">{visibleResults.map((reference) => <ReferenceCard key={reference.id} reference={reference} onSelect={setSelected} />)}</div>
        </section>
      )}

      <section className="starter-studies" aria-labelledby="starter-title">
        <div className="section-heading">
          <div><p className="eyebrow">READY WHEN YOU ARE</p><h2 id="starter-title">Four ways to start seeing.</h2></div>
          <p>Built-in studies work even when you are offline.</p>
        </div>
        <div className="reference-grid reference-grid--starter">{builtInReferences.map((reference) => <ReferenceCard key={reference.id} reference={reference} onSelect={setSelected} />)}</div>
      </section>
      <footer className="reference-footer">Online results come through Openverse, including Wikimedia Commons and other open collections. Creator, archive, and license details stay attached to each image.</footer>
    </section>
  );
}
