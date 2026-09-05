import { OrbitControls, RoundedBox } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  completeLibraryAttempt,
  getLibraryAttempt,
  getLibraryExercise,
  getLibraryExercises,
  getLibraryHistory,
  recordLibraryDigitalExport,
  startLibraryAttempt,
  type LibraryAttempt,
  type LibraryExercise,
} from "./api";
import { useOnlineStatus } from "./offline";
import { AppNav } from "./navigation";
import { sceneTheme } from "./theme";
import { IpadInstallHint, ProcreateOverlayEditor } from "./procreate";

const trackLabels = {
  perspective: "Perspective",
  solid_form: "Solid Form",
  hatching_light: "Hatching & Light",
  portrait_foundations: "Portrait Foundations",
  figure_creature: "Figure & Creature",
} as const;

const difficultyLabels = {
  too_easy: "Too easy",
  just_right: "Right level",
  too_hard: "Too hard",
} as const;

const LibraryNav = AppNav;

function TrackMark({ track }: { track: LibraryExercise["track"] }) {
  return (
    <svg className={`track-mark track-mark--${track}`} viewBox="0 0 80 80" aria-hidden="true">
      {track === "perspective" && <><path d="M8 62 L40 37 L72 62" /><path d="M8 18 L40 37 L72 18" /><circle cx="40" cy="37" r="4" /></>}
      {track === "solid_form" && <><path d="M17 29 L41 16 L65 29 L41 43Z M17 29 V55 L41 68 V43 M41 68 L65 55 V29" /></>}
      {track === "hatching_light" && <>{[0, 1, 2, 3, 4].map((line) => <path key={line} d={`M${15 + line * 9} 62 L${39 + line * 9} 18`} />)}<circle cx="35" cy="40" r="24" /></>}
      {track === "portrait_foundations" && <><ellipse cx="40" cy="34" rx="22" ry="26" /><path d="M19 38 C22 57 29 68 40 72 C51 68 58 57 61 38 M40 8 C44 26 44 52 40 72 M21 34 C31 29 49 29 59 34 M25 48 C34 45 46 45 55 48" /></>}
      {track === "figure_creature" && <><ellipse cx="29" cy="35" rx="14" ry="18" /><ellipse cx="52" cy="41" rx="18" ry="14" /><path d="M14 35 L7 25 M21 19 L15 8 M38 23 L45 12 M45 53 L36 70 M56 54 L62 71 M65 36 L73 29" /></>}
    </svg>
  );
}

function ExerciseCard({ exercise }: { exercise: LibraryExercise }) {
  const action = exercise.active_attempt_id ? "Resume" : exercise.attempt_count ? "Practice again" : "Preview drill";
  const href = exercise.active_attempt_id
    ? `/library/${exercise.id}/attempt/${exercise.active_attempt_id}`
    : `/library/${exercise.id}`;
  return (
    <article className={`library-card library-card--${exercise.track}`}>
      <div className="library-card__top"><TrackMark track={exercise.track} /><span>{String(exercise.sequence_index).padStart(2, "0")}</span></div>
      <p className="eyebrow">{trackLabels[exercise.track]}</p>
      <h3>{exercise.title}</h3>
      <p>{exercise.objective}</p>
      <div className="library-card__meta"><span>{exercise.duration_minutes} min</span><span>Level {exercise.difficulty}</span>{exercise.attempt_count > 0 && <span>{exercise.attempt_count} {exercise.attempt_count === 1 ? "study" : "studies"}</span>}</div>
      <Link to={href}>{action} →</Link>
    </article>
  );
}

export function ExerciseLibrary() {
  const [track, setTrack] = useState<string>("");
  const [difficulty, setDifficulty] = useState<number | undefined>();
  const exercises = useQuery({
    queryKey: ["library-exercises", track, difficulty],
    queryFn: () => getLibraryExercises(track || undefined, difficulty),
  });
  const history = useQuery({ queryKey: ["library-history"], queryFn: getLibraryHistory });
  const completedTotal = history.data?.exercises.reduce((sum, item) => sum + item.attempt_count, 0) ?? 0;

  return (
    <>
      <AppNav />
      <IpadInstallHint />
      <header className="library-hero">
        <div><p className="eyebrow">SELECTABLE DRAWING DRILLS</p><h1>Practice the part<br />that feels fuzzy.</h1><p className="lede">Focused exercises for perspective, solid form, controlled hatching, portrait construction, and believable creatures. Pick any one; nothing is locked.</p></div>
        <aside className="library-history-card"><span>Independent practice</span><strong>{completedTotal}</strong><p>completed {completedTotal === 1 ? "study" : "studies"}</p><small>Your four-week path stays exactly where you left it.</small></aside>
      </header>

      <section className="library-toolbar" aria-label="Filter exercise library">
        <div className="track-filters">
          <button type="button" className={!track ? "is-selected" : ""} onClick={() => setTrack("")}>All tracks</button>
          {(Object.entries(trackLabels) as [LibraryExercise["track"], string][]).map(([value, label]) => <button type="button" key={value} className={`track-filter track-filter--${value} ${track === value ? "is-selected" : ""}`} onClick={() => setTrack(value)}>{label}</button>)}
        </div>
        <label><span>Difficulty</span><select value={difficulty ?? ""} onChange={(event) => setDifficulty(event.target.value ? Number(event.target.value) : undefined)}><option value="">All levels</option><option value="1">Level 1</option><option value="2">Level 2</option><option value="3">Level 3</option></select></label>
      </section>

      {exercises.isPending ? <div className="dashboard-loading" role="status"><span /><p>Opening the drill shelf…</p></div> : exercises.isError ? <p role="alert">The exercise library could not be loaded.</p> : (
        <section className="library-catalog" aria-labelledby="catalog-title">
          <div className="section-heading"><div><p className="eyebrow">SUGGESTED FOUNDATION ORDER</p><h2 id="catalog-title">Choose today’s page.</h2></div><p>{exercises.data.length} unlocked {exercises.data.length === 1 ? "exercise" : "exercises"}</p></div>
          {exercises.data.length ? <div className="library-grid">{exercises.data.map((exercise) => <ExerciseCard key={exercise.id} exercise={exercise} />)}</div> : <div className="library-empty"><h3>No drills match both filters.</h3><button type="button" onClick={() => { setTrack(""); setDifficulty(undefined); }}>Clear filters</button></div>}
        </section>
      )}

      {history.data && history.data.recent_attempts.length > 0 && <section className="recent-library" aria-labelledby="recent-library-title"><p className="eyebrow">RECENT LIBRARY WORK</p><h2 id="recent-library-title">A record of showing up.</h2><div>{history.data.recent_attempts.slice(0, 4).map((attempt) => <Link key={attempt.id} to={`/library/${attempt.exercise_slug}${attempt.status === "in_progress" ? `/attempt/${attempt.id}` : ""}`}><strong>{history.data.exercises.find((item) => item.exercise_slug === attempt.exercise_slug)?.title ?? attempt.exercise_slug}</strong><span>{attempt.status === "completed" ? "Completed" : "In progress"}</span></Link>)}</div></section>}
    </>
  );
}

function supportsWebGL() {
  if (typeof window === "undefined" || !window.WebGLRenderingContext) return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

function Primitive({ variant }: { variant: Record<string, unknown> }) {
  const primitive = String(variant.primitive ?? "box");
  const rotation = Number(variant.rotation ?? 0) * Math.PI / 180;
  const elevation = Number(variant.elevation ?? 8) * Math.PI / 180;
  if (variant.object_template === "mug") return <group rotation={[0, rotation, 0]}><mesh><cylinderGeometry args={[0.72, 0.62, 1.5, 40]} /><meshStandardMaterial color={sceneTheme.coral} roughness={0.72} /></mesh><mesh position={[0.75, 0, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.42, 0.1, 20, 40]} /><meshStandardMaterial color={sceneTheme.coral} /></mesh></group>;
  if (variant.object_template === "bottle") return <group rotation={[0, rotation, 0]}><mesh position={[0, -0.2, 0]}><cylinderGeometry args={[0.58, 0.68, 1.5, 40]} /><meshStandardMaterial color={sceneTheme.green} /></mesh><mesh position={[0, 0.78, 0]}><cylinderGeometry args={[0.24, 0.4, 0.65, 32]} /><meshStandardMaterial color={sceneTheme.green} /></mesh></group>;
  if (variant.object_template === "stool") return <group rotation={[0, rotation, 0]}><RoundedBox args={[1.7, 0.22, 1.2]} position={[0, 0.7, 0]} radius={0.05}><meshStandardMaterial color={sceneTheme.gold} /></RoundedBox>{[[-0.65, 0.05, -0.4], [0.65, 0.05, -0.4], [-0.65, 0.05, 0.4], [0.65, 0.05, 0.4]].map((position, index) => <mesh key={index} position={position as [number, number, number]}><cylinderGeometry args={[0.08, 0.1, 1.25, 16]} /><meshStandardMaterial color={sceneTheme.green} /></mesh>)}</group>;
  if (primitive === "sphere") return <mesh rotation={[elevation, rotation, 0]}><sphereGeometry args={[1, 48, 48]} /><meshStandardMaterial color={sceneTheme.coral} roughness={0.72} /></mesh>;
  if (primitive === "cylinder") return <group rotation={[elevation, rotation, 0]}><mesh><cylinderGeometry args={[0.72, 0.72, 1.7, 40]} /><meshStandardMaterial color={sceneTheme.blue} roughness={0.72} /></mesh></group>;
  if (primitive === "cone") return <group rotation={[elevation, rotation, 0]}><mesh><coneGeometry args={[0.85, 1.8, 40]} /><meshStandardMaterial color={sceneTheme.gold} roughness={0.72} /></mesh></group>;
  return <RoundedBox args={[1.45, 1.45, 1.45]} rotation={[elevation, rotation, 0]} radius={0.045}><meshStandardMaterial color={sceneTheme.coral} roughness={0.72} /></RoundedBox>;
}

const anatomyDiagramKinds = new Set([
  "head-construction",
  "facial-proportions",
  "facial-turn",
  "creature-gesture",
  "human-mannequin",
  "quadruped-masses",
  "animal-legs",
  "dog-head",
  "cat-head",
  "animal-paws",
  "creature-synthesis",
]);

function AnatomyDiagram({ kind, variant, reveal }: { kind: string; variant: Record<string, unknown>; reveal: boolean }) {
  const headTurn = Number(variant.head_turn ?? 0);
  const headTilt = Number(variant.head_tilt ?? 0);
  const direction = Number(variant.direction ?? 1);
  const mirror = direction < 0 ? "translate(720 0) scale(-1 1)" : undefined;
  const subject = String(variant.subject ?? "human");
  const species = String(variant.species ?? "dog");
  const pose = String(variant.pose ?? "stand");

  if (kind === "head-construction" || kind === "facial-proportions" || kind === "facial-turn") {
    const centerX = 360 + headTurn * 0.65;
    const farSide = headTurn < 0 ? 1 : -1;
    return <g transform={`rotate(${headTilt} 360 235)`}>
      <path className="anatomy-fill" d="M360 72 C282 72 244 129 252 219 C258 301 301 382 360 405 C419 382 462 301 468 219 C476 129 438 72 360 72Z" />
      <ellipse className="anatomy-line anatomy-line--soft" cx="360" cy="174" rx="109" ry="102" />
      {kind === "head-construction" && <>
        <path className="anatomy-line anatomy-line--soft" d={`M${centerX} 82 C${centerX + headTurn * .35} 175 ${centerX + headTurn * .4} 308 360 405`} />
        <path className="anatomy-line anatomy-line--soft" d={`M270 207 Q${centerX} ${190 - Math.abs(headTurn) * .18} 451 208`} />
        <ellipse className="anatomy-line anatomy-line--soft" cx={360 - 75 * farSide} cy="177" rx="31" ry="46" />
      </>}
      {kind !== "head-construction" && <>
        <path className="anatomy-line" d={`M${centerX - 66} 218 Q${centerX - 35} 204 ${centerX - 8} 219 M${centerX + 12} 219 Q${centerX + 41} 204 ${centerX + 67} 220`} />
        <path className="anatomy-line" d={`M${centerX} 219 Q${centerX + headTurn * .25} 272 ${centerX + headTurn * .4} 294 L${centerX + 13 * farSide} 300`} />
        <path className="anatomy-line" d={`M${centerX - 38} 330 Q${centerX} 342 ${centerX + 40} 329`} />
      </>}
      {kind === "facial-turn" && <>
        <path className="anatomy-plane" d={`M${centerX} 180 L${centerX + 77 * farSide} 224 L${centerX + 47 * farSide} 305 L${centerX} 330Z`} />
        <path className="anatomy-plane" d={`M${centerX} 180 L${centerX - 77 * farSide} 224 L${centerX - 47 * farSide} 305 L${centerX} 330Z`} />
      </>}
      {reveal && <g className="diagram-reveal" data-testid="reveal-overlay">
        <path d={`M${centerX} 82 C${centerX + headTurn * .35} 175 ${centerX + headTurn * .4} 308 360 405`} />
        <path d={`M270 207 Q${centerX} ${190 - Math.abs(headTurn) * .18} 451 208`} />
        <path d="M274 250 Q360 270 447 250 M292 301 Q360 319 428 301 M317 345 Q360 355 404 344" strokeDasharray="8 8" />
        <ellipse cx={360 - 75 * farSide} cy="177" rx="31" ry="46" />
      </g>}
      {kind === "facial-proportions" && <g className="diagram-labels" aria-hidden="true"><text x="486" y="211">brow / eyes</text><text x="486" y="254">nose base</text><text x="486" y="306">mouth</text><text x="486" y="351">chin</text></g>}
    </g>;
  }

  if (kind === "human-mannequin" || (kind === "creature-gesture" && subject === "human")) {
    const reach = pose === "reach";
    const stride = pose === "stride";
    return <g transform={mirror}>
      <circle className="anatomy-fill" cx="350" cy="85" r="34" />
      <ellipse className="anatomy-fill" cx="363" cy="175" rx="56" ry="72" transform="rotate(-10 363 175)" />
      <path className="anatomy-fill" d="M326 245 Q365 224 404 248 L392 305 Q359 322 322 293Z" />
      <g className="anatomy-limb">
        <path d={reach ? "M320 146 L238 104 L166 72" : "M319 145 L266 214 L231 279"} />
        <path d="M405 148 L461 215 L493 273" />
        <path d={stride ? "M342 299 L292 377 L255 448" : "M342 299 L321 382 L301 448"} />
        <path d={stride ? "M382 299 L428 372 L483 429" : "M382 299 L407 382 L421 448"} />
      </g>
      {reveal && <g className="diagram-reveal" data-testid="reveal-overlay"><path d="M350 52 Q391 180 359 290 Q337 364 301 448" /><line x1="350" y1="52" x2="350" y2="454" strokeDasharray="8 8" />{[[320,146],[238,104],[405,148],[461,215],[342,299],[292,377],[382,299],[428,372]].map(([x,y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="7" />)}</g>}
    </g>;
  }

  if (kind === "quadruped-masses" || (kind === "creature-gesture" && subject !== "human") || kind === "creature-synthesis") {
    const crouch = pose === "crouch" || String(variant.body_plan) === "burrower";
    const cat = subject === "cat" || species === "cat" || String(variant.inspiration) === "cat";
    return <g transform={mirror}>
      <ellipse className="anatomy-fill" cx="292" cy={crouch ? 247 : 218} rx="82" ry={crouch ? 58 : 82} transform="rotate(-8 292 218)" />
      <ellipse className="anatomy-fill" cx="435" cy={crouch ? 259 : 232} rx="72" ry={crouch ? 52 : 65} transform="rotate(8 435 232)" />
      <ellipse className="anatomy-fill" cx="155" cy={crouch ? 223 : 176} rx={cat ? 48 : 55} ry={cat ? 45 : 52} />
      <path className="anatomy-line" d={cat ? "M122 143 L132 91 L160 137 L190 98 L194 154" : "M112 147 L95 102 L139 132 M188 145 L213 109 L203 167"} />
      <path className="anatomy-line" d="M205 193 Q228 205 235 219" />
      <g className="anatomy-limb"><path d="M255 258 L235 346 L218 430" /><path d="M318 270 L335 352 L319 432" /><path d="M408 278 L387 356 L399 434" /><path d="M465 276 L500 347 L533 423" /></g>
      <path className="anatomy-line" d={cat ? "M492 222 Q590 158 604 80" : "M492 220 Q566 208 600 164"} />
      {kind === "creature-synthesis" && <path className="anatomy-adaptation" d={String(variant.body_plan) === "climber" ? "M245 332 Q174 363 137 432 M471 334 Q535 365 575 424" : String(variant.body_plan) === "burrower" ? "M225 422 L171 440 L222 449 M530 418 L581 438 L534 449" : "M215 430 L159 449 M534 423 L597 439"} />}
      {reveal && <g className="diagram-reveal" data-testid="reveal-overlay"><path d={`M118 ${crouch ? 218 : 174} Q300 ${crouch ? 190 : 137} 483 ${crouch ? 245 : 219}`} /><line x1="82" y1="442" x2="628" y2="442" strokeDasharray="8 8" />{[[255,258],[235,346],[318,270],[335,352],[408,278],[387,356],[465,276],[500,347]].map(([x,y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="7" />)}</g>}
    </g>;
  }

  if (kind === "animal-legs") return <g>
    {[170, 360, 550].map((x, index) => <g key={x}>
      <text className="diagram-species-label" x={x} y="82" textAnchor="middle">{["HUMAN", "DOG", "CAT"][index]}</text>
      <circle className="anatomy-joint" cx={x} cy="130" r="14" />
      <path className="anatomy-limb" d={index === 0 ? `M${x} 142 L${x - 22} 258 L${x + 5} 370 L${x + 43} 428` : index === 1 ? `M${x} 142 L${x + 30} 245 L${x - 2} 342 L${x + 32} 418 L${x + 72} 430` : `M${x} 142 L${x + 21} 250 L${x - 11} 354 L${x + 17} 420 L${x + 56} 431`} />
      {reveal && <g className="diagram-reveal" data-testid={index === 0 ? "reveal-overlay" : undefined}>{(index === 0 ? [[x-22,258],[x+5,370]] : [[x+30,245],[x-2,342],[x+32,418]]).map(([cx,cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="7" />)}</g>}
    </g>)}
    <line className="diagram-ground" x1="86" y1="438" x2="640" y2="438" />
  </g>;

  if (kind === "dog-head" || kind === "cat-head") {
    const dog = kind === "dog-head";
    const turnOffset = headTurn * .7;
    const muzzleLength = String(variant.muzzle) === "long" ? 112 : String(variant.muzzle) === "short" ? 70 : 90;
    return <g>
      <ellipse className="anatomy-fill" cx="338" cy="213" rx={dog ? 132 : 124} ry={dog ? 119 : 112} />
      {dog ? <>
        <path className="anatomy-fill" d="M234 163 L180 79 Q236 76 282 135 M435 154 L490 83 Q512 150 462 220" />
        <path className="anatomy-fill anatomy-fill--muzzle" d={`M${330 + turnOffset} 225 Q${420 + turnOffset} 219 ${440 + turnOffset + muzzleLength * .25} 278 Q${417 + turnOffset} 348 ${322 + turnOffset} 321Z`} />
      </> : <>
        <path className="anatomy-fill" d="M226 164 L244 63 L314 130 M404 129 L472 66 L464 180" />
        <path className="anatomy-fill anatomy-fill--muzzle" d={`M${312 + turnOffset} 246 Q${360 + turnOffset} 211 ${408 + turnOffset} 248 L${394 + turnOffset} 330 Q${360 + turnOffset} 355 ${326 + turnOffset} 329Z`} />
      </>}
      <path className="anatomy-line" d={`M${278 + turnOffset} 211 Q${316 + turnOffset} 190 ${340 + turnOffset} 214 M${375 + turnOffset} 213 Q${408 + turnOffset} 190 ${436 + turnOffset} 214`} />
      <path className="anatomy-line" d={`M${347 + turnOffset} 279 Q${364 + turnOffset} 267 ${380 + turnOffset} 280 Q${364 + turnOffset} 300 ${347 + turnOffset} 279`} />
      {reveal && <g className="diagram-reveal" data-testid="reveal-overlay"><path d={`M${360 + turnOffset} 100 Q${375 + turnOffset} 218 ${364 + turnOffset} 349`} /><path d={`M239 211 Q${360 + turnOffset} 172 466 215`} /><path d={`M${dog ? 322 : 311} 241 L${dog ? 457 + muzzleLength * .25 : 411} 249 L${dog ? 440 + muzzleLength * .25 : 394} 330 L${dog ? 322 : 326} 321Z`} /></g>}
    </g>;
  }

  if (kind === "animal-paws") {
    const side = String(variant.view) === "side";
    return <g>
      <path className="anatomy-fill" d={side ? "M300 81 L386 92 L399 281 Q473 291 505 351 L488 415 L274 415 L279 348 L319 284Z" : "M303 69 L416 69 L405 296 Q458 320 484 372 L460 426 L262 426 L238 372 Q264 320 315 296Z"} />
      {[0,1,2,3].map((toe) => <ellipse key={toe} className="anatomy-toe" cx={(side ? 327 : 277) + toe * (side ? 45 : 55)} cy={side ? 389 - toe * 4 : 394} rx={side ? 37 : 31} ry={side ? 24 : 37} />)}
      {reveal && <g className="diagram-reveal" data-testid="reveal-overlay"><path d={side ? "M344 90 L341 305 Q390 356 488 387" : "M360 74 L360 308 M360 310 L277 393 M360 310 L332 397 M360 310 L388 397 M360 310 L443 393"} /><line x1="192" y1="430" x2="535" y2="430" strokeDasharray="8 8" /></g>}
    </g>;
  }

  return null;
}

function GuideDiagram({ kind, variant, reveal }: { kind: string; variant: Record<string, unknown>; reveal: boolean }) {
  const horizon = Number(variant.horizon_y ?? 0.5) * 480;
  const vpX = Number(variant.vanishing_x ?? 0.52) * 720;
  const hatchAngle = Number(variant.hatch_angle ?? 45);
  const lightRight = String(variant.light_side ?? variant.light_direction ?? "left").includes("right");
  const primitive = String(variant.primitive ?? "box");
  return (
    <svg viewBox="0 0 720 480" role="img" aria-label={`${kind.replaceAll("-", " ")} exercise reference`}>
      <defs>
        <pattern id="hatch-light" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform={`rotate(${hatchAngle})`}><line x1="0" y1="0" x2="0" y2="18" stroke="#4c5048" strokeWidth="2" /></pattern>
        <pattern id="hatch-dark" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform={`rotate(${hatchAngle})`}><line x1="0" y1="0" x2="0" y2="7" stroke="#383b36" strokeWidth="2" /></pattern>
        <linearGradient id="form-light" x1={lightRight ? "0%" : "100%"} x2={lightRight ? "100%" : "0%"}><stop offset="0" stopColor="#454943"/><stop offset="0.55" stopColor="#b7b7ae"/><stop offset="1" stopColor="#f1ede1"/></linearGradient>
      </defs>
      <rect width="720" height="480" rx="24" fill="#dfddd3" />
      {anatomyDiagramKinds.has(kind) && <AnatomyDiagram kind={kind} variant={variant} reveal={reveal} />}
      {(kind === "one-point" || kind === "two-point") && <>
        <line x1="0" y1={horizon} x2="720" y2={horizon} className="diagram-horizon" />
        {kind === "one-point" && <circle cx={vpX} cy={horizon} r="6" fill="#d6b55d" stroke="#775f33" strokeWidth="2" />}
        <path d="M180 175 H310 V300 H180Z M180 175 L120 125 H245 L310 175 M180 300 L120 360 H245 L310 300 M120 125 V360 M245 125 V360" className="diagram-form" />
        {kind === "two-point" && <path d="M440 175 L550 145 L550 290 L440 320Z M440 175 L375 140 L486 115 L550 145 M440 320 L375 274 L486 248 L550 290 M375 140 V274 M486 115 V248" className="diagram-form" />}
        {reveal && <g data-testid="reveal-overlay" className="diagram-reveal"><circle cx={vpX} cy={horizon} r="7" />{[[180,175],[310,175],[180,300],[310,300]].map(([x,y], index) => <line key={index} x1={x} y1={y} x2={vpX} y2={horizon} />)}{kind === "two-point" && <><circle cx="38" cy={horizon} r="7"/><circle cx="682" cy={horizon} r="7"/><path d={`M375 140 L38 ${horizon} M375 274 L38 ${horizon} M550 145 L682 ${horizon} M550 290 L682 ${horizon}`} /></>}</g>}
      </>}
      {(kind === "hatch-ladder") && <>{[0,1,2,3,4].map((step) => <g key={step}><rect x={65 + step * 120} y="145" width="105" height="160" rx="7" fill={step === 0 ? "#f3efe4" : step < 3 ? "url(#hatch-light)" : "url(#hatch-dark)"} stroke="#545850" strokeWidth="2" />{step === 4 && <path d={`M${65 + step * 120} 145 l105 160 M${65 + step * 120} 305 l105 -160`} stroke="#545850" strokeWidth="2" opacity=".55"/>}<text x={118 + step * 120} y="335" textAnchor="middle">{step + 1}</text></g>)}{reveal && <g data-testid="reveal-overlay" className="diagram-reveal"><path d="M65 365 H650" /><circle cx="65" cy="365" r="5" /><circle cx="650" cy="365" r="5" /></g>}</>}
      {(kind === "hatch-form" || kind === "light-logic") && <><ellipse cx="360" cy="240" rx="145" ry="145" fill={kind === "light-logic" ? "url(#form-light)" : "url(#hatch-light)"} stroke="#4e524b" strokeWidth="3" />{kind === "hatch-form" && <path d="M236 185 C302 225 418 225 484 185 M220 240 C298 285 422 285 500 240 M236 298 C302 335 418 335 484 298" fill="none" stroke="#62685e" strokeWidth="2" />}{reveal && <g data-testid="reveal-overlay" className="diagram-reveal"><path d={lightRight ? "M580 90 L478 170" : "M140 90 L242 170"}/><path d="M360 96 C300 155 300 325 360 384" strokeDasharray="8 8"/><ellipse cx={lightRight ? 262 : 458} cy="380" rx="120" ry="28"/></g>}</>}
      {!(["one-point","two-point","hatch-ladder","hatch-form","light-logic"].includes(kind)) && !anatomyDiagramKinds.has(kind) && <>{primitive === "sphere" ? <circle cx="360" cy="240" r="145" className="diagram-form" /> : primitive === "cylinder" ? <><ellipse cx="360" cy="130" rx="105" ry="38" className="diagram-form"/><path d="M255 130 V340 M465 130 V340" className="diagram-form"/><ellipse cx="360" cy="340" rx="105" ry="38" className="diagram-form"/></> : primitive === "cone" ? <><ellipse cx="360" cy="346" rx="125" ry="38" className="diagram-form"/><path d="M235 346 L360 92 L485 346" className="diagram-form"/></> : <path d="M208 164 L360 88 L514 166 L361 249Z M208 164 V318 L361 396 V249 M361 396 L514 316 V166" className="diagram-form" />}{reveal && <g data-testid="reveal-overlay" className="diagram-reveal"><path d="M208 318 L514 166 M208 164 L514 316 M360 88 V396" strokeDasharray="9 9" />{kind === "cross-contour" && <><path d="M220 202 C295 245 430 246 501 204 M216 249 C293 292 433 292 506 248 M220 294 C296 337 428 338 501 296" /></>}</g>}</>}
    </svg>
  );
}

function LibraryVisual({ exercise, attempt, reveal }: { exercise: LibraryExercise; attempt: LibraryAttempt; reveal: boolean }) {
  const [webgl, setWebgl] = useState(false);
  const [viewIndex, setViewIndex] = useState(0);
  useEffect(() => setWebgl(supportsWebGL()), []);
  const is3d = exercise.visual_config.mode === "3d";
  const presetRotations = Array.isArray(attempt.variant_data.rotations) ? attempt.variant_data.rotations as number[] : [];
  const displayedVariant = presetRotations.length ? { ...attempt.variant_data, rotation: presetRotations[viewIndex] } : attempt.variant_data;
  if (is3d && webgl) return (
    <div className="library-visual library-visual--3d" data-testid="library-3d-reference">
      <Canvas camera={{ position: [3.4, 2.7, 4.2], fov: 42 }}>
        <color attach="background" args={[sceneTheme.canvas]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[String(attempt.variant_data.light_direction).includes("right") ? 4 : -4, 6, 3]} intensity={1.8} />
        <Primitive variant={displayedVariant} />
        <gridHelper args={[10, 10, sceneTheme.plum, sceneTheme.greenSoft]} position={[0, -1.05, 0]} />
        <OrbitControls makeDefault />
      </Canvas>
      {presetRotations.length > 0 && <div className="library-view-presets" aria-label="Generated viewpoints">{presetRotations.map((_, index) => <button key={index} type="button" className={viewIndex === index ? "is-selected" : ""} onClick={() => setViewIndex(index)}>View {index + 1}</button>)}</div>}
      {reveal && <div className="library-visual__guide" data-testid="reveal-overlay"><span>Guide revealed</span><p>Trace the main axis and extend matching edge families on your page.</p></div>}
    </div>
  );
  return <div className="library-visual library-visual--diagram" data-testid={is3d ? "library-svg-fallback" : "library-diagram-reference"}><GuideDiagram kind={exercise.visual_kind} variant={attempt.variant_data} reveal={reveal} /></div>;
}

export function LibraryExercisePreview() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const exercise = useQuery({ queryKey: ["library-exercise", slug], queryFn: () => getLibraryExercise(slug) });
  const start = useMutation({ mutationFn: () => startLibraryAttempt(slug), onSuccess: (attempt) => navigate(`/library/${slug}/attempt/${attempt.id}`) });
  if (exercise.isPending) return <><AppNav /><div className="dashboard-loading" role="status"><span /><p>Opening the exercise…</p></div></>;
  if (exercise.isError) return <><AppNav /><p role="alert">This library exercise could not be loaded.</p></>;
  const drill = exercise.data;
  return <><LibraryNav /><article className={`library-preview library-preview--${drill.track}`}><div><Link to="/library">← Exercise library</Link><p className="eyebrow">{trackLabels[drill.track]} · LEVEL {drill.difficulty}</p><h1>{drill.title}</h1><p className="lede">{drill.objective}</p><div className="lesson-meta"><span>{drill.duration_minutes} minutes</span><span>Paper or iPad</span><span>Generated variation</span></div><button type="button" onClick={() => start.mutate()} disabled={start.isPending || !online}>{start.isPending ? "Generating your setup…" : !online ? "Connect to start a new drill" : drill.active_attempt_id ? "Resume this drill" : drill.attempt_count ? "Try another variation" : "Begin this drill"}</button></div><TrackMark track={drill.track} /></article><section className="library-concept"><article><p className="eyebrow">THE IDEA</p><h2>{drill.concept}</h2></article><article><p className="eyebrow">WATCH FOR</p><h2>One common detour</h2><p>{drill.common_mistake}</p></article></section><section className="lesson-steps"><p className="eyebrow">ON YOUR PAGE</p><h2>Three clear moves.</h2><ol>{drill.instructions.map((instruction, index) => <li key={instruction}><span>{index + 1}</span><p>{instruction}</p></li>)}</ol></section></>;
}

function AttemptTimer({ exercise, attemptId, onReview }: { exercise: LibraryExercise; attemptId: string; onReview: () => void }) {
  const storageKey = `drawcoach-library-timer-${attemptId}`;
  const stored = useMemo(() => { try { return JSON.parse(localStorage.getItem(storageKey) ?? "null") as { phase: number; seconds: number } | null; } catch { return null; } }, [storageKey]);
  const [phaseIndex, setPhaseIndex] = useState(stored?.phase ?? 0);
  const [secondsRemaining, setSecondsRemaining] = useState(stored?.seconds ?? exercise.timed_phases[0].minutes * 60);
  const [running, setRunning] = useState(false);
  const phase = exercise.timed_phases[phaseIndex];
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify({ phase: phaseIndex, seconds: secondsRemaining })); }, [phaseIndex, secondsRemaining, storageKey]);
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => setSecondsRemaining((value) => { if (value > 0) return value - 1; setRunning(false); return 0; }), 1000); return () => window.clearInterval(timer); }, [running]);
  function nextPhase() { if (phaseIndex === exercise.timed_phases.length - 1) { onReview(); return; } const next = phaseIndex + 1; setPhaseIndex(next); setSecondsRemaining(exercise.timed_phases[next].minutes * 60); setRunning(false); }
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  return <section className="practice-timer library-timer"><div className="phase-rail">{exercise.timed_phases.map((item, index) => <span key={item.label} className={index <= phaseIndex ? "is-active" : ""}>{item.label}<small>{item.minutes} min</small></span>)}</div><div className="timer-focus"><div><p className="eyebrow">PHASE {phaseIndex + 1} OF {exercise.timed_phases.length}</p><h2>{phase.label}</h2><p>{phase.instruction}</p></div><output aria-label={`${minutes} minutes and ${seconds} seconds remaining`}>{String(minutes).padStart(2,"0")}<small>:</small>{String(seconds).padStart(2,"0")}</output></div><div className="timer-actions"><button type="button" onClick={() => setRunning((value) => !value)}>{running ? "Pause" : "Start timer"}</button><button type="button" className="quiet-button" onClick={nextPhase}>{phaseIndex === exercise.timed_phases.length - 1 ? "Finish and self-check" : "Next phase"}</button><button type="button" className="text-button" onClick={onReview}>Finish early</button></div></section>;
}

export function LibraryAttemptPage() {
  const { slug = "", attemptId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const exercise = useQuery({ queryKey: ["library-exercise", slug], queryFn: () => getLibraryExercise(slug) });
  const attempt = useQuery({ queryKey: ["library-attempt", attemptId], queryFn: () => getLibraryAttempt(attemptId) });
  const [reviewing, setReviewing] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [responses, setResponses] = useState<Record<string, "met" | "needs_work">>({});
  const [difficulty, setDifficulty] = useState<keyof typeof difficultyLabels | null>(null);
  const [takeaway, setTakeaway] = useState("");
  const [procreateOpen, setProcreateOpen] = useState(false);
  const complete = useMutation({ mutationFn: () => completeLibraryAttempt(attemptId, responses, difficulty!, takeaway), onSuccess: (data) => { queryClient.setQueryData(["library-attempt", attemptId], data); void queryClient.invalidateQueries({ queryKey: ["library-exercises"] }); void queryClient.invalidateQueries({ queryKey: ["library-history"] }); localStorage.removeItem(`drawcoach-library-timer-${attemptId}`); } });
  const restart = useMutation({ mutationFn: () => startLibraryAttempt(slug), onSuccess: (data) => navigate(`/library/${slug}/attempt/${data.id}`, { replace: true }) });
  const digitalExport = useMutation({ mutationFn: (current: LibraryAttempt) => recordLibraryDigitalExport(current), onSuccess: (data) => queryClient.setQueryData(["library-attempt", attemptId], data) });
  if (exercise.isPending || attempt.isPending) return <><LibraryNav /><div className="dashboard-loading" role="status"><span /><p>Restoring your study…</p></div></>;
  if (exercise.isError || attempt.isError) return <><LibraryNav /><p role="alert">This exercise attempt could not be restored.</p></>;
  const drill = exercise.data;
  const study = attempt.data;
  if (study.status === "completed") return <><LibraryNav /><section className="library-complete"><div className="completion-mark">✓</div><p className="eyebrow">LIBRARY STUDY SAVED</p><h1>Notice what changed.</h1><p className="lede">You completed {drill.title}. The self-check is a record of attention, not a score.</p><div className="library-complete__checks">{drill.self_checks.map((check) => <span key={check.id} className={study.self_check_responses?.[check.id] === "met" ? "is-met" : ""}>{study.self_check_responses?.[check.id] === "met" ? "✓" : "↗"} {check.label}</span>)}</div><div className="completion-actions"><button type="button" disabled={restart.isPending || !online} onClick={() => restart.mutate()}>{restart.isPending ? "Generating…" : online ? "Try another variation" : "Connect to try another variation"}</button><Link className="text-link" to="/library">Return to library</Link></div></section></>;
  const allAnswered = drill.self_checks.every((check) => responses[check.id]);
  return <><LibraryNav /><header className="library-attempt-header"><Link to={`/library/${slug}`}>← Exercise overview</Link><p className="eyebrow">{trackLabels[drill.track]} · VARIATION {String(study.variant_seed).slice(-4)}</p><div className="library-attempt-title"><div><h1>{drill.title}</h1><p>{drill.objective}</p></div><button type="button" className="procreate-launch" onClick={() => setProcreateOpen(true)}><span>Use in</span>Procreate ↗</button></div>{!online && <p className="offline-notice" role="status">Offline mode: this cached variation can still be exported. Connect to complete or start another drill.</p>}</header><LibraryVisual exercise={drill} attempt={study} reveal={reveal} />{!reviewing ? <AttemptTimer exercise={drill} attemptId={attemptId} onReview={() => setReviewing(true)} /> : <section className="library-self-check"><div><p className="eyebrow">REVEAL &amp; COMPARE</p><h2>Read your page, not a grade.</h2><p>Reveal the construction guide, then answer each observation honestly. “Needs work” still completes the drill.</p><button type="button" className="quiet-button" onClick={() => setReveal((value) => !value)}>{reveal ? "Hide visual guides" : "Reveal visual guides"}</button></div><div className="self-check-list">{drill.self_checks.map((check) => <fieldset key={check.id}><legend>{check.label}</legend><button type="button" className={responses[check.id] === "met" ? "is-selected" : ""} onClick={() => setResponses((value) => ({ ...value, [check.id]: "met" }))}>I see it</button><button type="button" className={responses[check.id] === "needs_work" ? "is-selected" : ""} onClick={() => setResponses((value) => ({ ...value, [check.id]: "needs_work" }))}>Needs another pass</button></fieldset>)}</div><div className="library-reflection"><h3>How did that level feel?</h3><div className="difficulty-options">{(Object.entries(difficultyLabels) as [keyof typeof difficultyLabels, string][]).map(([value, label]) => <button key={value} type="button" className={difficulty === value ? "is-selected" : ""} onClick={() => setDifficulty(value)}>{label}</button>)}</div><label><span>What did you notice? <em>Optional</em></span><textarea value={takeaway} maxLength={500} onChange={(event) => setTakeaway(event.target.value)} placeholder="The depth edges felt more consistent when…" /></label>{complete.isError && <p role="alert">This attempt could not be saved. Please try again.</p>}{!online && <p role="status">Connect to save the completed self-check.</p>}<button type="button" disabled={!allAnswered || !difficulty || complete.isPending || !online} onClick={() => complete.mutate()}>{complete.isPending ? "Saving study…" : "Complete this study"}</button></div></section>}{procreateOpen && <ProcreateOverlayEditor exercise={drill} attempt={study} onClose={() => setProcreateOpen(false)} onExport={async () => { await digitalExport.mutateAsync(study); }} />}</>;
}
