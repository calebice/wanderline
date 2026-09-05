import { ContactShadows, Edges, OrbitControls, RoundedBox } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AppNav } from "./navigation";
import { sceneTheme } from "./theme";

export type StudyLayerKind =
  | "whole"
  | "composition"
  | "shape-masses"
  | "perspective"
  | "primitives"
  | "measurements"
  | "lighting"
  | "reconstruct";

export type SceneStudy = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  source: { kind: "three_scene" | "illustration"; assetId: string };
  focalPoint: string;
  steps: StudyStep[];
};

type StudyStep = {
  id: StudyLayerKind;
  shortLabel: string;
  title: string;
  prompt: string;
  options: string[];
  insight: string;
  drawPrompt: string;
};

type SavedStudyState = {
  stepIndex: number;
  predictions: Partial<Record<StudyLayerKind, string>>;
  revealed: StudyLayerKind[];
  practiced: StudyLayerKind[];
};

const sharedSteps: StudyStep[] = [
  {
    id: "whole",
    shortLabel: "Whole",
    title: "Read the whole before the parts.",
    prompt: "What carries the scene first?",
    options: ["The main subject", "The empty space", "The cast shadow"],
    insight: "Start with the visual idea, not a list of objects. The strongest mass and contrast should support one clear read.",
    drawPrompt: "Make a ten-second thumbnail using only one enclosing shape and one focal mark.",
  },
  {
    id: "composition",
    shortLabel: "Frame",
    title: "Decide what the frame is doing.",
    prompt: "Which placement gives the subject room without losing focus?",
    options: ["Centered and stable", "Offset with breathing room", "Cropped tightly"],
    insight: "The frame is an active shape. Cropping and placement determine balance before any contour is drawn.",
    drawPrompt: "Draw the frame, then mark only the focal point and the largest empty area.",
  },
  {
    id: "shape-masses",
    shortLabel: "Shapes",
    title: "Compress the scene into large masses.",
    prompt: "How many shapes are needed before the scene becomes recognizable?",
    options: ["Two masses", "Three to five masses", "Every visible object"],
    insight: "Most scenes become readable with three to five flat masses. Small details should wait until those masses work.",
    drawPrompt: "Fill the large masses as flat silhouettes. Leave internal details out.",
  },
  {
    id: "perspective",
    shortLabel: "Space",
    title: "Find the shared space.",
    prompt: "What gives the clearest evidence of depth?",
    options: ["The horizon and edge families", "Surface texture", "Object names"],
    insight: "The horizon, convergence, overlap, and scale make separate objects feel as though they occupy one world.",
    drawPrompt: "Place the horizon and extend two major edge families before drawing an object.",
  },
  {
    id: "primitives",
    shortLabel: "Forms",
    title: "Build objects from volumes.",
    prompt: "Which construction should come first?",
    options: ["Largest enclosing volume", "Smallest interesting detail", "Final outer contour"],
    insight: "Construction moves from large, simple volumes toward smaller attached forms. Hidden edges help keep the volume coherent.",
    drawPrompt: "Draw through each box, cylinder, or sphere. Strengthen the visible contour only afterward.",
  },
  {
    id: "measurements",
    shortLabel: "Measure",
    title: "Compare relationships, not isolated sizes.",
    prompt: "Which comparison is most useful?",
    options: ["Width against height", "A remembered symbol", "The amount of detail"],
    insight: "Ratios, alignments, angles, and negative spaces travel across the whole drawing and prevent local guesses from drifting.",
    drawPrompt: "Mark one width-to-height ratio, one alignment, and one negative-space shape.",
  },
  {
    id: "lighting",
    shortLabel: "Light",
    title: "Separate light from shadow.",
    prompt: "What should be decided before rendering?",
    options: ["The light and shadow families", "Reflected highlights", "Surface texture"],
    insight: "A clear two-value statement establishes the light. Halftones and reflected light belong inside that larger organization.",
    drawPrompt: "Block one connected shadow family, including the cast shadow, before adding halftones.",
  },
  {
    id: "reconstruct",
    shortLabel: "Draw",
    title: "Reconstruct from the large idea.",
    prompt: "What order protects the drawing from detail-first drift?",
    options: ["Frame → masses → forms → values", "Contour → texture → shadows", "Details → outline → background"],
    insight: "The finished study is a sequence of decisions: frame, masses, space, construction, relationships, then light and selective edges.",
    drawPrompt: "Hide the guides and rebuild the scene. Reveal one layer only when you need a checkpoint.",
  },
];

const sceneStudies: SceneStudy[] = [
  {
    id: "single-cube",
    title: "One cube, clearly understood",
    eyebrow: "FOUNDATION STUDY",
    description: "Use a single form to see how framing, perspective, planes, and one light source work together.",
    source: { kind: "three_scene", assetId: "cube-v1" },
    focalPoint: "The meeting point of the three visible planes",
    steps: sharedSteps,
  },
  {
    id: "mug-book-apple",
    title: "A small studio still life",
    eyebrow: "GROUPED FORM STUDY",
    description: "Reduce a mug, two books, and an apple into a stable arrangement of boxes, cylinders, and a sphere.",
    source: { kind: "three_scene", assetId: "still-life-v1" },
    focalPoint: "The mug rim and apple overlap",
    steps: sharedSteps,
  },
  {
    id: "sunset-sail",
    title: "Sunset sail, built from shapes",
    eyebrow: "ILLUSTRATED SCENE STUDY",
    description: "Build a nostalgic seascape from a low horizon, cloud masses, one bold triangle, and foreground overlaps—with color or values only.",
    source: { kind: "illustration", assetId: "sunset-sail-v1" },
    focalPoint: "The bright sail against the warm sky",
    steps: [
      {
        ...sharedSteps[0],
        prompt: "What makes this scene readable at thumbnail size?",
        options: ["One bright triangular sail", "Every cloud contour", "The texture in the rocks"],
        insight: "The sail is the clearest shape and strongest light-against-warm contrast. Everything else frames that first read.",
        drawPrompt: "Draw a postcard frame, one sail triangle, and one horizon line. Stop there.",
      },
      {
        ...sharedSteps[1],
        prompt: "How does the frame keep a centered sunset from feeling static?",
        options: ["Uneven edge framing", "Perfect bilateral symmetry", "Equal detail everywhere"],
        insight: "Clouds enter at different sizes and the foreground rises unevenly from both corners. This asymmetry gives a centered glow and sail somewhere to live.",
        drawPrompt: "Mark the horizon near the lower third. Add only the big edge intrusions and the sail's centerline.",
      },
      {
        ...sharedSteps[2],
        prompt: "Which flat-shape plan carries the scene?",
        options: ["Sky, water, sail, foreground", "Individual rocks and stars", "Outlines without masses"],
        insight: "Four large shape families do most of the work: open sky, calm water, light sail, and dark foreground. Clouds are supporting cutouts in the sky mass.",
        drawPrompt: "Make a four-value thumbnail: sky, water, sail, and foreground. Merge small objects into their parent mass.",
      },
      {
        ...sharedSteps[3],
        prompt: "What establishes depth in a mostly flat, graphic scene?",
        options: ["Overlap, scale, and a low horizon", "Complex vanishing points", "More texture in the distance"],
        insight: "A level horizon anchors the view. Large cropped foreground shapes overlap smaller midground rocks, while tiny birds and clouds sit farther back.",
        drawPrompt: "Draw the horizon, then place one foreground, midground, and distant shape at clearly different scales.",
      },
      {
        ...sharedSteps[4],
        title: "Construct the icon shapes.",
        prompt: "Which simple shapes build the focal boat?",
        options: ["Triangles over a shallow hull", "A detailed contour first", "Rectangles of equal size"],
        insight: "Two tapered sail triangles sit on a mast above a shallow trapezoid. Clear shape design matters more than nautical detail.",
        drawPrompt: "Build the boat from a mast line, two triangles, and one shallow hull. Add curves only after the proportions read.",
      },
      {
        ...sharedSteps[5],
        prompt: "Which relationship should you check first?",
        options: ["Sail height against frame height", "Number of stars", "Length of each wave mark"],
        insight: "The sail is a little over half the scene height and the horizon stays low. Those two ratios preserve the calm, spacious feeling.",
        drawPrompt: "Check sail height, horizon placement, and the negative sky around the mast before adding any small marks.",
      },
      {
        ...sharedSteps[6],
        title: "Plan values, then choose a palette.",
        prompt: "What survives when color is removed?",
        options: ["Light sail, middle sky/water, dark foreground", "The exact sunset hue", "Tiny white stars"],
        insight: "A three-value structure holds the image together. Color can then stay limited: warm sky, cool water, pale sail, dark warm foreground, and one small accent.",
        drawPrompt: "Test the scene in three values. If it reads, assign one warm family, one cool family, and one accent color.",
      },
      {
        ...sharedSteps[7],
        prompt: "What order keeps this decorative style clear?",
        options: ["Frame → masses → focal shape → overlaps → accents", "Stars → plants → rocks → boat", "Outline every object equally"],
        insight: "The nostalgic finish comes last: restrained contour lines, a few repeated marks, and selective texture over a strong large-shape design.",
        drawPrompt: "Redraw from the large masses. Add only three accent families at the end: cloud folds, water dashes, and foreground plants.",
      },
    ],
  },
];

const emptyStudyState: SavedStudyState = {
  stepIndex: 0,
  predictions: {},
  revealed: [],
  practiced: [],
};

function studyStorageKey(sceneId: string) {
  return `drawcoach-scene-study-${sceneId}-v1`;
}

function loadStudyState(sceneId: string): SavedStudyState {
  try {
    const value = JSON.parse(localStorage.getItem(studyStorageKey(sceneId)) ?? "null") as Partial<SavedStudyState> | null;
    if (!value) return emptyStudyState;
    return {
      stepIndex: Math.max(0, Math.min(sharedSteps.length - 1, Number(value.stepIndex ?? 0))),
      predictions: value.predictions ?? {},
      revealed: Array.isArray(value.revealed) ? value.revealed : [],
      practiced: Array.isArray(value.practiced) ? value.practiced : [],
    };
  } catch {
    return emptyStudyState;
  }
}

function SceneObjects({
  sceneId,
  layer,
  cubeColor,
}: {
  sceneId: string;
  layer: StudyLayerKind;
  cubeColor: string;
}) {
  const valueMode = layer === "lighting";
  const constructionMode = layer === "primitives";
  const cubeMaterial = valueMode ? "#b8b8ad" : cubeColor;
  if (sceneId === "single-cube") return (
    <RoundedBox args={[1.65, 1.65, 1.65]} position={[0, 0.83, 0]} radius={0.045} smoothness={4}>
      <meshStandardMaterial color={cubeMaterial} roughness={0.76} wireframe={constructionMode} />
      <Edges color={sceneTheme.ink} threshold={15} />
    </RoundedBox>
  );
  return (
    <group>
      <RoundedBox args={[2.7, 0.28, 1.8]} position={[-0.25, 0.16, 0]} rotation={[0, -0.08, 0]} radius={0.035}>
        <meshStandardMaterial color={valueMode ? "#77776f" : sceneTheme.plum} roughness={0.82} wireframe={constructionMode} />
        <Edges color={sceneTheme.ink} threshold={15} />
      </RoundedBox>
      <RoundedBox args={[2.35, 0.24, 1.55]} position={[-0.2, 0.43, 0.04]} rotation={[0, 0.08, 0]} radius={0.03}>
        <meshStandardMaterial color={valueMode ? "#a6a69d" : sceneTheme.gold} roughness={0.82} wireframe={constructionMode} />
        <Edges color={sceneTheme.ink} threshold={15} />
      </RoundedBox>
      <group position={[-0.55, 1.16, 0.02]} rotation={[0, -0.18, 0]}>
        <mesh>
          <cylinderGeometry args={[0.55, 0.49, 1.35, 48]} />
          <meshStandardMaterial color={valueMode ? "#d1d1c6" : sceneTheme.coral} roughness={0.7} wireframe={constructionMode} />
          <Edges color={sceneTheme.ink} threshold={15} />
        </mesh>
        <mesh position={[0.58, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.35, 0.085, 18, 42]} />
          <meshStandardMaterial color={valueMode ? "#d1d1c6" : sceneTheme.coral} roughness={0.7} wireframe={constructionMode} />
        </mesh>
      </group>
      <mesh position={[0.8, 0.93, 0.2]}>
        <sphereGeometry args={[0.5, 48, 48]} />
        <meshStandardMaterial color={valueMode ? "#929289" : sceneTheme.green} roughness={0.78} wireframe={constructionMode} />
        <Edges color={sceneTheme.ink} threshold={25} />
      </mesh>
    </group>
  );
}

function SunsetSailReference({ valueOnly }: { valueOnly: boolean }) {
  return (
    <svg
      className={`sunset-sail-reference ${valueOnly ? "is-value-only" : ""}`}
      viewBox="0 0 800 520"
      role="img"
      aria-label={`Original illustrated sailboat scene, ${valueOnly ? "three-value" : "limited-color"} view`}
    >
      <defs>
        <linearGradient id="sunset-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c95f70" />
          <stop offset=".62" stopColor="#ee9b70" />
          <stop offset="1" stopColor="#f4c276" />
        </linearGradient>
        <radialGradient id="sun-glow">
          <stop offset="0" stopColor="#f8d35f" stopOpacity=".98" />
          <stop offset=".52" stopColor="#f5b85e" stopOpacity=".76" />
          <stop offset="1" stopColor="#f5a56b" stopOpacity="0" />
        </radialGradient>
        <pattern id="paper-grain" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="5" r=".7" fill="#fff" opacity=".15" />
          <circle cx="13" cy="12" r=".6" fill="#3b2b2c" opacity=".1" />
        </pattern>
      </defs>

      <rect width="800" height="520" rx="28" fill="url(#sunset-sky)" />
      <circle cx="455" cy="232" r="130" fill="url(#sun-glow)" />
      <circle className="sail-scene-sun" cx="455" cy="232" r="61" />
      <rect width="800" height="520" rx="28" fill="url(#paper-grain)" />

      <g className="sail-scene-stars">
        {[[82,62],[128,35],[183,76],[238,44],[305,83],[355,48],[420,68],[492,38],[552,88],[624,54],[707,84],[751,42],[212,142],[580,145],[677,126],[338,124]].map(([x, y], index) => (
          <path key={`${x}-${y}`} d={index % 3 === 0 ? `M${x - 4} ${y}H${x + 4}M${x} ${y - 4}V${y + 4}` : `M${x - 2} ${y}H${x + 2}M${x} ${y - 2}V${y + 2}`} />
        ))}
      </g>

      <g className="sail-scene-clouds">
        <path d="M0 58 C24 31 64 35 82 61 C105 33 154 43 160 78 C185 60 222 72 222 98 C188 111 153 103 126 110 C87 119 41 111 0 116Z" />
        <path d="M577 112 C598 87 635 92 648 116 C671 88 719 91 727 128 C755 113 784 128 800 150 V176 H574 C558 160 562 128 577 112Z" />
        <path d="M0 230 C22 212 50 219 58 241 C81 226 119 237 123 266 H0Z" />
        <path d="M611 280 C630 251 674 256 688 283 C707 259 748 264 757 291 C778 283 792 291 800 302 V321 H599 C592 305 598 290 611 280Z" />
      </g>

      <path className="sail-scene-water" d="M0 356 H800 V520 H0Z" />
      <g className="sail-scene-water-lines">
        <path d="M20 385 H134 M165 407 H282 M315 379 H412 M468 401 H586 M635 381 H772" />
        <path d="M56 438 H194 M234 460 H370 M415 432 H512 M562 463 H736" />
        <path d="M102 490 H251 M329 493 H466 M525 488 H678" />
      </g>

      <g className="sail-scene-boat">
        <path className="sail-scene-sail sail-scene-sail--left" d="M326 111 L316 337 L207 337Z" />
        <path className="sail-scene-sail sail-scene-sail--right" d="M333 110 L339 337 L462 337Z" />
        <path className="sail-scene-mast" d="M329 105 V369" />
        <path className="sail-scene-hull" d="M190 339 Q326 362 478 340 L452 389 Q337 410 224 383Z" />
        <path className="sail-scene-hull-stripe" d="M208 361 Q333 382 462 358 L453 373 Q333 394 216 374Z" />
        <path className="sail-scene-deck" d="M228 338 H443 M266 338 L281 317 H349 L369 339" />
      </g>

      <g className="sail-scene-birds"><path d="M529 263 q8-10 16 0 q8-10 16 0 M585 245 q6-7 12 0 q6-7 12 0" /></g>
      <g className="sail-scene-mid-rocks"><path d="M377 454 l20-20 20 20Z M508 432 l15-13 18 13Z" /></g>

      <g className="sail-scene-foreground">
        <path d="M0 410 Q55 380 104 414 Q151 433 190 475 L222 520 H0Z" />
        <path d="M800 393 Q746 385 709 428 Q673 452 640 520 H800Z" />
        <path className="sail-scene-rock" d="M0 444 L49 409 L85 432 L113 418 L153 464 L119 520 H0Z" />
        <path className="sail-scene-rock" d="M654 520 L690 452 L727 431 L754 449 L800 414 V520Z" />
        <g className="sail-scene-plants"><path d="M38 478 q2-34-17-51 M42 479 q13-27 33-42 M118 497 q-3-31-19-50 M703 493 q5-36 28-59 M711 495 q-15-31-38-45 M763 476 q0-24 17-43" /></g>
      </g>
    </svg>
  );
}

function SceneOverlay({ sceneId, layer, visible }: { sceneId: string; layer: StudyLayerKind; visible: boolean }) {
  const stillLife = sceneId === "mug-book-apple";
  const sunsetSail = sceneId === "sunset-sail";
  return (
    <svg
      className={`scene-study-overlay layer-${layer} ${visible ? "is-visible" : ""}`}
      viewBox="0 0 800 520"
      role="img"
      aria-label={`${layer.replaceAll("-", " ")} study guide`}
    >
      {layer === "whole" && <>
        <path className="overlay-mass overlay-mass--primary" d={sunsetSail ? "M190 398 L205 327 L326 106 L476 340 L468 390 Q340 422 190 398Z" : stillLife ? "M180 365 Q215 150 405 120 Q610 118 675 340 Q510 455 224 430Z" : "M235 398 L258 120 L550 102 L601 371 L420 463Z"} />
        <circle className="overlay-focal" cx={sunsetSail ? 332 : stillLife ? 455 : 410} cy={sunsetSail ? 236 : stillLife ? 230 : 240} r={sunsetSail ? 52 : 34} />
      </>}
      {layer === "composition" && <>
        <rect className="overlay-frame" x="72" y="48" width="656" height="424" rx="12" />
        <path className="overlay-guide" d="M291 48 V472 M509 48 V472 M72 189 H728 M72 331 H728" />
        <circle className="overlay-focal" cx={sunsetSail ? 326 : stillLife ? 505 : 400} cy={sunsetSail ? 235 : stillLife ? 190 : 260} r="26" />
      </>}
      {layer === "shape-masses" && (sunsetSail ? <>
        <path className="overlay-flat overlay-flat--coral" d="M0 0 H800 V356 H0Z" />
        <path className="overlay-flat overlay-flat--green" d="M0 356 H800 V520 H0Z" />
        <path className="overlay-flat overlay-flat--plum" d="M0 410 Q128 382 222 520 H0Z M800 393 Q690 395 640 520 H800Z" />
        <path className="overlay-form" d="M326 110 L207 337 H462Z" />
      </> : stillLife ? <>
        <path className="overlay-flat overlay-flat--plum" d="M145 347 L619 321 L650 399 L175 438Z" />
        <path className="overlay-flat overlay-flat--coral" d="M260 135 Q350 116 390 177 L402 344 L255 353Z" />
        <circle className="overlay-flat overlay-flat--green" cx="540" cy="284" r="80" />
      </> : <path className="overlay-flat overlay-flat--coral" d="M244 176 L430 90 L594 190 L410 286 L244 176 V379 L410 466 L594 371 V190" />)}
      {layer === "perspective" && <>
        <path className="overlay-horizon" d={sunsetSail ? "M0 356 H800" : "M35 217 H765"} />
        {!sunsetSail && <><circle className="overlay-point" cx="54" cy="217" r="7" /><circle className="overlay-point" cx="746" cy="217" r="7" /></>}
        <path className="overlay-guide" d={sunsetSail ? "M0 520 L455 356 L800 520 M0 410 L455 356 L800 393" : stillLife ? "M54 217 L165 348 M54 217 L650 399 M746 217 L145 347 M746 217 L619 321" : "M54 217 L244 176 M54 217 L410 286 M746 217 L430 90 M746 217 L594 371"} />
      </>}
      {layer === "primitives" && (sunsetSail ? <>
        <path className="overlay-form" d="M326 110 L207 337 L316 337Z M333 110 L339 337 L462 337Z M190 339 Q326 362 478 340 L452 389 Q337 410 224 383Z" />
        <path className="overlay-axis" d="M329 92 V406 M180 337 H491" />
      </> : stillLife ? <>
        <path className="overlay-form" d="M151 346 L600 322 L647 397 L181 436Z M181 436 V399 M647 397 V358" />
        <ellipse className="overlay-form" cx="330" cy="172" rx="75" ry="24" />
        <path className="overlay-form" d="M255 172 V346 M405 172 V346" />
        <ellipse className="overlay-form" cx="330" cy="346" rx="75" ry="24" />
        <circle className="overlay-form" cx="539" cy="283" r="78" />
        <path className="overlay-axis" d="M330 120 V389 M460 283 H620" />
      </> : <>
        <path className="overlay-form" d="M244 176 L430 90 L594 190 L410 286Z M244 176 V379 L410 466 V286 M410 466 L594 371 V190" />
        <path className="overlay-axis" d="M244 379 L594 190 M244 176 L594 371 M430 90 L410 466" />
      </>)}
      {layer === "measurements" && <>
        <path className="overlay-measure" d={sunsetSail ? "M182 88 V404 M172 88 H192 M172 404 H192 M190 420 H478 M190 410 V430 M478 410 V430" : stillLife ? "M145 456 H650 M145 446 V466 M650 446 V466 M232 112 V438 M222 112 H242 M222 438 H242" : "M224 480 H614 M224 470 V490 M614 470 V490 M210 89 V465 M200 89 H220 M200 465 H220"} />
        <path className="overlay-negative" d={sunsetSail ? "M341 108 Q478 116 573 209 L477 332 L341 332Z" : stillLife ? "M406 202 Q462 180 482 244 Q472 303 418 318Z" : "M315 198 L413 151 L503 204 L407 253Z"} />
      </>}
      {layer === "lighting" && <>
        {!sunsetSail && <path className="overlay-light-arrow" d="M126 78 L246 165" />}
        <path className="overlay-shadow" d={sunsetSail ? "M0 410 Q128 382 222 520 H0Z M800 393 Q690 395 640 520 H800Z" : stillLife ? "M296 374 Q438 340 654 403 Q570 468 361 450Z" : "M370 414 L632 360 L716 407 L459 476Z"} />
        <path className="overlay-terminator" d={sunsetSail ? "M0 356 H800 M326 110 L207 337 M333 110 L462 337" : stillLife ? "M330 150 Q375 245 329 347 M540 205 Q588 283 536 359" : "M430 91 L410 286 L410 466"} />
      </>}
      {layer === "reconstruct" && <>
        <path className="overlay-sequence" d="M95 445 H705" />
        {["Frame", "Masses", "Space", "Forms", "Values"].map((label, index) => <g key={label}><circle className="overlay-point" cx={130 + index * 135} cy="445" r="12" /><text x={130 + index * 135} y="480" textAnchor="middle">{label}</text></g>)}
      </>}
    </svg>
  );
}

function SceneStage({
  scene,
  layer,
  guideVisible,
  referenceMode,
  onReferenceModeChange,
  cubeColor,
  lightPosition,
  lightIntensity,
  lightAngle,
}: {
  scene: SceneStudy;
  layer: StudyLayerKind;
  guideVisible: boolean;
  referenceMode: "color" | "value";
  onReferenceModeChange: (mode: "color" | "value") => void;
  cubeColor: string;
  lightPosition: [number, number, number];
  lightIntensity: number;
  lightAngle: number;
}) {
  return (
    <div className="scene-study-stage" data-layer={layer} data-guide-visible={guideVisible}>
      {scene.source.kind === "three_scene" ? (
        <Canvas camera={{ position: scene.id === "single-cube" ? [3, 3, 3] : [4.5, 3.2, 5.5], fov: 44 }} aria-label={`Interactive 3D reference for ${scene.title}`} shadows>
          <color attach="background" args={[sceneTheme.canvas]} />
          <ambientLight intensity={layer === "lighting" ? 0.18 : 0.42} />
          <spotLight position={lightPosition} intensity={lightIntensity} angle={(lightAngle * Math.PI) / 180} penumbra={0.35} decay={0} castShadow />
          <SceneObjects sceneId={scene.id} layer={layer} cubeColor={cubeColor} />
          <ContactShadows position={[0, 0.01, 0]} opacity={layer === "lighting" ? 0.42 : 0.22} scale={8} blur={2.2} far={5} />
          <gridHelper args={[10, 10, sceneTheme.plum, sceneTheme.greenSoft]} />
          <OrbitControls makeDefault target={[0, 0.75, 0]} enablePan={false} />
        </Canvas>
      ) : <SunsetSailReference valueOnly={referenceMode === "value"} />}
      <SceneOverlay sceneId={scene.id} layer={layer} visible={guideVisible} />
      {scene.source.kind === "illustration" && (
        <div className="scene-reference-mode" role="group" aria-label="Reference display mode">
          <button type="button" className={referenceMode === "color" ? "is-selected" : ""} aria-pressed={referenceMode === "color"} onClick={() => onReferenceModeChange("color")}>Color</button>
          <button type="button" className={referenceMode === "value" ? "is-selected" : ""} aria-pressed={referenceMode === "value"} onClick={() => onReferenceModeChange("value")}>3 values</button>
        </div>
      )}
      <div className="scene-stage-caption" aria-live="polite">
        <span>{guideVisible ? "Guide visible" : "Observe first"}</span>
        <strong>{layer === "whole" ? scene.focalPoint : layer.replaceAll("-", " ")}</strong>
      </div>
    </div>
  );
}

export function SceneBreakdownStudio() {
  const [sceneId, setSceneId] = useState(sceneStudies[0].id);
  const scene = sceneStudies.find((item) => item.id === sceneId) ?? sceneStudies[0];
  const [studyState, setStudyState] = useState<SavedStudyState>(() => loadStudyState(sceneId));
  const [guideVisible, setGuideVisible] = useState(false);
  const [comparisonLayer, setComparisonLayer] = useState<StudyLayerKind | null>(null);
  const [referenceMode, setReferenceMode] = useState<"color" | "value">("color");
  const [cubeColor, setCubeColor] = useState<string>(sceneTheme.coral);
  const [lightX, setLightX] = useState(4);
  const [lightY, setLightY] = useState(6);
  const [lightZ, setLightZ] = useState(3);
  const [lightIntensity, setLightIntensity] = useState(1.5);
  const [lightAngle, setLightAngle] = useState(45);
  const step = scene.steps[studyState.stepIndex];
  const selectedPrediction = studyState.predictions[step.id];
  const revealed = studyState.revealed.includes(step.id);
  const practiced = studyState.practiced.includes(step.id);
  const displayLayer = comparisonLayer ?? step.id;
  const progress = Math.round((studyState.practiced.length / scene.steps.length) * 100);
  const lightPosition = useMemo<[number, number, number]>(() => [lightX, lightY, lightZ], [lightX, lightY, lightZ]);
  const horizontalPosition = lightX < -1 ? "left" : lightX > 1 ? "right" : "center";
  const depthPosition = lightZ < -1 ? "back" : lightZ > 1 ? "front" : "center";
  const lightPreviewLeft = `${((lightX + 6) / 12) * 100}%`;
  const lightPreviewTop = `${((lightZ + 6) / 12) * 100}%`;

  useEffect(() => {
    localStorage.setItem(studyStorageKey(sceneId), JSON.stringify(studyState));
  }, [sceneId, studyState]);

  function chooseScene(nextSceneId: string) {
    setSceneId(nextSceneId);
    setStudyState(loadStudyState(nextSceneId));
    setGuideVisible(false);
    setComparisonLayer(null);
    setReferenceMode("color");
  }

  function chooseStep(index: number) {
    setStudyState((value) => ({ ...value, stepIndex: index }));
    setGuideVisible(false);
    setComparisonLayer(null);
  }

  function choosePrediction(option: string) {
    setStudyState((value) => ({ ...value, predictions: { ...value.predictions, [step.id]: option } }));
  }

  function revealGuide() {
    setGuideVisible(true);
    setStudyState((value) => ({ ...value, revealed: value.revealed.includes(step.id) ? value.revealed : [...value.revealed, step.id] }));
  }

  function markPracticed() {
    setStudyState((value) => ({ ...value, practiced: value.practiced.includes(step.id) ? value.practiced : [...value.practiced, step.id] }));
  }

  function nextStep() {
    markPracticed();
    if (studyState.stepIndex < scene.steps.length - 1) chooseStep(studyState.stepIndex + 1);
  }

  function moveLightOnGrid(event: React.MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const xRatio = (event.clientX - bounds.left) / bounds.width;
    const zRatio = (event.clientY - bounds.top) / bounds.height;
    setLightX(Math.max(-6, Math.min(6, xRatio * 12 - 6)));
    setLightZ(Math.max(-6, Math.min(6, zRatio * 12 - 6)));
  }

  return (
    <>
      <AppNav />
      <section className="scene-study-page" aria-labelledby="scene-study-title">
        <header className="scene-study-hero">
          <div>
            <Link className="back-link" to="/library">← Exercise library</Link>
            <p className="eyebrow">SCENE BREAKDOWN STUDIO</p>
            <h1 id="scene-study-title">See the scene.<br />Build the drawing.</h1>
            <p className="lede">Predict what matters, reveal one visual idea, draw it on your page, and compare without turning the study into a tracing exercise.</p>
          </div>
          <div className="scene-study-progress" aria-label={`${progress}% of this scene study practiced`}>
            <span>Study progress</span><strong>{progress}%</strong>
            <div><i style={{ width: `${progress}%` }} /></div>
            <small>Saved on this device</small>
          </div>
        </header>

        <div className="scene-picker" role="group" aria-label="Choose a study scene">
          {sceneStudies.map((item) => <button key={item.id} type="button" className={scene.id === item.id ? "is-selected" : ""} aria-pressed={scene.id === item.id} onClick={() => chooseScene(item.id)}><span>{item.eyebrow}</span><strong>{item.title}</strong><small>{item.description}</small></button>)}
        </div>

        <nav className="study-step-rail" aria-label="Scene study stages">
          {scene.steps.map((item, index) => <button key={item.id} type="button" className={`${index === studyState.stepIndex ? "is-current" : ""} ${studyState.practiced.includes(item.id) ? "is-practiced" : ""}`} aria-current={index === studyState.stepIndex ? "step" : undefined} onClick={() => chooseStep(index)}><span>{studyState.practiced.includes(item.id) ? "✓" : index + 1}</span>{item.shortLabel}</button>)}
        </nav>

        <div className="scene-study-workspace">
          <div>
            <SceneStage scene={scene} layer={displayLayer} guideVisible={guideVisible || comparisonLayer !== null} referenceMode={referenceMode} onReferenceModeChange={setReferenceMode} cubeColor={cubeColor} lightPosition={lightPosition} lightIntensity={lightIntensity} lightAngle={lightAngle} />
            <div className="comparison-bar" aria-label="Compare revealed study layers">
              <span>Compare layers</span>
              {scene.steps.map((item) => <button key={item.id} type="button" disabled={!studyState.revealed.includes(item.id)} className={comparisonLayer === item.id ? "is-selected" : ""} aria-pressed={comparisonLayer === item.id} onClick={() => setComparisonLayer((value) => value === item.id ? null : item.id)}>{item.shortLabel}</button>)}
              <button type="button" className="comparison-original" onClick={() => { setComparisonLayer(null); setGuideVisible(false); }}>Original</button>
            </div>
          </div>

          <aside className="study-coach" aria-labelledby="study-step-title">
            <p className="eyebrow">STEP {studyState.stepIndex + 1} OF {scene.steps.length}</p>
            <h2 id="study-step-title">{step.title}</h2>
            <p>{step.prompt}</p>
            <div className="prediction-options" role="group" aria-label="Choose your prediction">
              {step.options.map((option) => <button type="button" key={option} className={selectedPrediction === option ? "is-selected" : ""} aria-pressed={selectedPrediction === option} onClick={() => choosePrediction(option)}>{option}</button>)}
            </div>
            {!revealed ? <button type="button" className="reveal-guide" disabled={!selectedPrediction} onClick={revealGuide}>{selectedPrediction ? "Reveal the visual guide" : "Make a prediction first"}</button> : <div className="study-insight" role="status"><span>What to notice</span><p>{step.insight}</p></div>}
            {revealed && <div className="paper-prompt"><span aria-hidden="true">✎</span><div><strong>On your page</strong><p>{step.drawPrompt}</p></div></div>}
            {revealed && <div className="study-actions"><button type="button" className={practiced ? "is-complete" : ""} onClick={markPracticed}>{practiced ? "✓ Stage practiced" : "I drew this stage"}</button><button type="button" onClick={nextStep}>{studyState.stepIndex === scene.steps.length - 1 ? "Save this study" : "Next idea →"}</button></div>}
          </aside>
        </div>

        {progress === 100 && (
          <section className="scene-study-complete" role="status" aria-labelledby="scene-study-complete-title">
            <span className="scene-study-complete__mark" aria-hidden="true">✓</span>
            <div>
              <p className="eyebrow">STUDY COMPLETE</p>
              <h2 id="scene-study-complete-title">You turned one scene into eight clear decisions.</h2>
              <p>Try one final redraw from memory. Keep the frame, masses, space, forms, and light—then compare only after your page has a complete read.</p>
            </div>
            <button type="button" onClick={() => chooseStep(0)}>Redraw from memory</button>
          </section>
        )}

        {scene.source.kind === "three_scene" ? <details className="scene-explore-controls">
          <summary>Explore viewpoint, color, and light</summary>
          <div className="scene-control-grid">
            <label className="color-control"><span>Cube color</span><input aria-label="Cube color" type="color" value={cubeColor} onChange={(event) => setCubeColor(event.target.value)} /><output>{cubeColor.toUpperCase()}</output></label>
            <div className="light-position-controls">
              <button type="button" className="light-preview" aria-label="Set light position on grid" onClick={moveLightOnGrid}>
                <span className="light-preview__back">Back</span><span className="light-preview__left">Left</span><span className="light-preview__cube" aria-hidden="true" /><span className="light-preview__position" aria-hidden="true" style={{ left: lightPreviewLeft, top: lightPreviewTop }} /><span className="light-preview__right">Right</span><span className="light-preview__front">Front</span>
              </button>
              <label className="height-control"><span>Top</span><input aria-label="Vertical light position" type="range" min="1" max="10" step="0.5" value={lightY} onChange={(event) => setLightY(Number(event.target.value))} /><span>Bottom</span></label>
            </div>
            <div className="light-sliders">
              <output className="light-position-readout">Light placed: {horizontalPosition}, {depthPosition}</output>
              <label><span>Lighting intensity</span><input aria-label="Lighting intensity" type="range" min="0.2" max="3" step="0.1" value={lightIntensity} onChange={(event) => setLightIntensity(Number(event.target.value))} /><output>{lightIntensity.toFixed(1)}</output></label>
              <label><span>Light beam angle</span><input aria-label="Light beam angle" type="range" min="20" max="80" step="5" value={lightAngle} onChange={(event) => setLightAngle(Number(event.target.value))} /><output>{lightAngle}°</output></label>
            </div>
          </div>
          <p>Drag the scene to orbit. Scroll or pinch to move closer. The teaching overlay stays aligned to the authored study view; use free orbit to understand the forms between drawing passes.</p>
        </details> : <section className="scene-palette-lesson" aria-labelledby="scene-palette-title">
          <div>
            <p className="eyebrow">LIMITED PALETTE</p>
            <h2 id="scene-palette-title">Color is the finish, not the foundation.</h2>
            <p>Use the 3 values switch on the reference first. Once the light sail, middle-distance sky and water, and dark foreground read clearly, map those values to a small warm/cool palette.</p>
          </div>
          <div className="scene-palette-swatches" aria-label="Suggested scene palette">
            <span style={{ background: "#c95f70" }}><small>Warm sky</small></span>
            <span style={{ background: "#f4bc6a" }}><small>Glow</small></span>
            <span style={{ background: "#efe0bf" }}><small>Light sail</small></span>
            <span style={{ background: "#2f8c91" }}><small>Cool water</small></span>
            <span style={{ background: "#413f3b" }}><small>Dark frame</small></span>
          </div>
          <Link className="button-link" to="/style-lab">See this scene-building process across five styles</Link>
        </section>}
      </section>
    </>
  );
}
