const basePath = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
const displayAsset = (file: string) => file.replace(/\.png$/, ".webp");
const asset = (style: StyleGuideSlug, file: string) =>
  `${basePath}style-guide/japanese-seaside-town/${style}/${displayAsset(file)}`;
const comparisonAsset = (file: string) =>
  `${basePath}style-guide/coastal-stairway/${displayAsset(file)}`;
const astronautAsset = (file: string) =>
  `${basePath}style-guide/astronaut/${displayAsset(file)}`;
const camperVanAsset = (file: string) =>
  `${basePath}style-guide/camper-van/${displayAsset(file)}`;
const bouquetAsset = (file: string) =>
  `${basePath}style-guide/bouquet/${displayAsset(file)}`;
const greenhouseAsset = (file: string) =>
  `${basePath}style-guide/greenhouse/${displayAsset(file)}`;

export const STYLE_GUIDE_SLUGS = [
  "realism",
  "cartoon",
  "architectural",
  "watercolor",
  "anime-environment",
] as const;

export type StyleGuideSlug = (typeof STYLE_GUIDE_SLUGS)[number];

export interface StyleGuideAsset {
  src: string;
  width: number;
  height: number;
  alt: string;
}

export interface StyleGuideProcessPanel {
  title: string;
  description: string;
}

export interface StyleGuideStep {
  title: string;
  instruction: string;
  checkpoint: string;
}

export interface StyleGuideEntry {
  slug: StyleGuideSlug;
  label: string;
  kicker: string;
  definition: string;
  medium: string;
  thumbnail: StyleGuideAsset;
  reference: StyleGuideAsset;
  learnerReference: StyleGuideAsset;
  process: StyleGuideAsset;
  traits: string[];
  visualRecipe: {
    structure: string;
    line: string;
    value: string;
    color: string;
    medium: string;
    texture: string;
    detail: string;
  };
  processPanels: [
    StyleGuideProcessPanel,
    StyleGuideProcessPanel,
    StyleGuideProcessPanel,
    StyleGuideProcessPanel,
  ];
  steps: [StyleGuideStep, StyleGuideStep, StyleGuideStep, StyleGuideStep];
  materials: string[];
  commonMistakes: Array<{ mistake: string; correction: string }>;
  practicePrompt: string;
  futureNote?: string;
}

export interface StyleComparisonVariant {
  style: StyleGuideSlug;
  label: string;
  treatment: string;
  thumbnail: StyleGuideAsset;
  reference: StyleGuideAsset;
}

export interface StyleComparisonSubject {
  slug: "coastal-stairway" | "astronaut" | "camper-van" | "bouquet" | "greenhouse";
  label: string;
  description: string;
  base: StyleGuideAsset;
  variants: readonly StyleComparisonVariant[];
  futureNote: string;
}

export interface StyleReferenceVariant extends StyleComparisonVariant {
  guidePath?: string;
}

export interface StyleReferenceSubject {
  slug: "japanese-seaside-town" | "coastal-stairway" | "astronaut" | "camper-van" | "bouquet" | "greenhouse";
  label: string;
  description: string;
  selectorImage: StyleGuideAsset;
  variants: readonly StyleReferenceVariant[];
  futureNote?: string;
}

function images(
  slug: StyleGuideSlug,
  label: string,
  referenceAlt: string,
  learnerAlt: string,
  processAlt: string,
) {
  return {
    thumbnail: {
      src: asset(slug, "thumbnail.png"),
      width: 768,
      height: 512,
      alt: `${label} interpretation of a fictional Japanese seaside town`,
    },
    reference: { src: asset(slug, "reference.png"), width: 1536, height: 1024, alt: referenceAlt },
    learnerReference: {
      src: asset(slug, "learner-reference.png"),
      width: 1536,
      height: 1024,
      alt: learnerAlt,
    },
    process: { src: asset(slug, "process.png"), width: 1536, height: 1024, alt: processAlt },
  } satisfies Record<string, StyleGuideAsset>;
}

export const STYLE_GUIDE_ENTRIES: readonly StyleGuideEntry[] = [
  {
    slug: "realism",
    label: "Realism",
    kicker: "Observe before you interpret",
    definition:
      "A naturalistic approach that prioritizes believable proportion, perspective, light, material, and atmospheric depth. The goal is not photographic copying; it is a convincing record of what the scene would feel like to observe.",
    medium: "Colored pencil on warm paper",
    ...images(
      "realism",
      "Realism",
      "Detailed colored-pencil view of a fictional Japanese coastal hillside, with tiled houses, descending stairs, utility lines, dense greenery, and a blue harbor.",
      "Simplified colored-pencil study of the same coastal town, organized into clear foreground, hillside, roof, stair, and sea shapes.",
      "Four-panel realism process sheet progressing from large masses to perspective structure, value and color grouping, and selective colored-pencil detail.",
    ),
    traits: [
      "Observed proportions and converging perspective",
      "Light describes volume before texture is added",
      "Edges soften with distance and atmosphere",
      "Material changes are carried by value, color, and mark direction",
    ],
    visualRecipe: {
      structure: "Block the coastline and stacked buildings as a few measured masses, then locate the stair axis and horizon.",
      line: "Use light construction lines; reserve darker, sharper marks for overlaps and the foreground focal area.",
      value: "Group sunlit roofs and walls, middle halftones, and deep foliage shadows before modeling smaller turns.",
      color: "Begin with muted local color, then shift warmer in light and cooler in distance rather than coloring every object independently.",
      medium: "Layer colored pencil lightly, building opacity through repeated directional passes instead of pressing hard at the start.",
      texture: "Change pencil direction to describe roof tile, foliage, plaster, stone, and water without filling every surface.",
      detail: "Concentrate crisp windows, rails, and roof seams near the town center; simplify the distant coast and sea.",
    },
    processPanels: [
      { title: "Composition and major masses", description: "A pale horizon, hillside wedge, sea band, and compact town cluster establish the whole scene before individual houses appear." },
      { title: "Structure and perspective", description: "Roof ridges, wall corners, stairs, and utility poles share a believable horizon and descending spatial rhythm." },
      { title: "Value and color organization", description: "Sunlit warm walls separate from cool sea and sky while one connected dark foliage family anchors the hillside." },
      { title: "Colored-pencil finish", description: "Selective layers describe tiles, vegetation, wires, and water, with the sharpest contrast kept around the central buildings." },
    ],
    steps: [
      { title: "Place the big geography", instruction: "Draw the horizon, one hillside silhouette, the sea shape, and one block for the town.", checkpoint: "The image should read as coast, hill, and settlement at thumbnail size." },
      { title: "Build the town as boxes", instruction: "Add three to five stacked building boxes, then cap them with simple roof prisms and connect them with one stair path.", checkpoint: "Verticals agree and roof edges converge consistently." },
      { title: "Group light and color", instruction: "Assign one light family, one middle family, and one connected dark family; glaze a restrained warm/cool palette over them.", checkpoint: "The scene still reads if you squint or view it in monochrome." },
      { title: "Earn the small marks", instruction: "Add windows, roof seams, foliage accents, wires, and water strokes only where they clarify material or focus.", checkpoint: "At least half the scene remains quieter than the focal buildings." },
    ],
    materials: ["Warm white drawing paper", "Graphite HB pencil", "Colored pencils: warm ochre, terracotta, olive, deep green, sky blue, indigo", "Kneaded eraser", "White pencil or gel pen, optional"],
    commonMistakes: [
      { mistake: "Rendering windows and roof tiles before the buildings sit correctly.", correction: "Return to boxes, horizon, and stair direction; detail cannot repair uncertain structure." },
      { mistake: "Using equally hard edges everywhere.", correction: "Soften distant contours and keep the darkest, sharpest edges near the focal cluster." },
      { mistake: "Pressing colored pencil to full opacity in the first pass.", correction: "Build several light layers so hue, value, and texture can still be adjusted." },
    ],
    practicePrompt: "Draw only the learner reference’s hillside, three largest building masses, stairs, and sea. Use three values first; add no more than twelve colored-pencil accents in the final five minutes.",
  },
  {
    slug: "cartoon",
    label: "Cartoon",
    kicker: "Design the read",
    definition:
      "A shape-driven approach that simplifies reality into clear silhouettes, pushed proportions, rhythmic contours, and grouped color. Believability comes from consistent design logic, not from including every observed fact.",
    medium: "Ink-like contour with flat digital color",
    ...images(
      "cartoon",
      "Cartoon",
      "Bold, colorful cartoon interpretation of a fictional Japanese seaside hillside with compact houses, playful stairs, utility poles, greenery, and harbor shapes.",
      "Simplified cartoon study using a small set of chunky house, foliage, stair, and sea shapes with expressive but controlled proportions.",
      "Four-panel cartoon process sheet showing silhouette masses, shape construction, flat color groups, and selective expressive line and detail.",
    ),
    traits: [
      "Readable silhouette and a small vocabulary of repeated shapes",
      "One or two proportion pushes carry the personality",
      "Bold contours vary around focal overlaps",
      "Flat color groups stay legible before texture or accents",
    ],
    visualRecipe: {
      structure: "Reduce the scene to a hill wedge, a stepped town cluster, foliage puffs, and a sea band.",
      line: "Use confident outer contours and fewer interior lines; thicken overlaps and focal corners.",
      value: "Keep three broad value families with clean separation instead of gradual modeling.",
      color: "Assign a dominant green-blue family, a warm building family, and one small accent color.",
      medium: "Draw with brush pen or a pressure-sensitive digital brush, then place opaque color beneath the linework.",
      texture: "Use a few graphic marks—roof dashes, leaf clusters, water stripes—rather than continuous surface rendering.",
      detail: "Repeat simplified windows and tiles, then break the pattern once or twice for charm and focus.",
    },
    processPanels: [
      { title: "Composition and major masses", description: "The cliff, town, tree canopy, and harbor become four bold interlocking silhouettes." },
      { title: "Structure and shape design", description: "Stacked boxes bend into a lively stair rhythm while roofs, shrubs, and clouds repeat a consistent shape family." },
      { title: "Flat value and color", description: "Three value groups and a compact warm/cool palette make every major form readable without shading." },
      { title: "Expressive finish", description: "Variable contour, sparse texture marks, and a few brighter accents add character without weakening the big shapes." },
    ],
    steps: [
      { title: "Make four silhouettes", instruction: "Cut the scene into cliff, town, canopy, and water shapes. Push one of them larger than observation.", checkpoint: "Each mass is recognizable as a filled shape with no interior detail." },
      { title: "Repeat a shape family", instruction: "Build houses from related chunky rectangles and roofs; echo the same curve or angle in trees and stairs.", checkpoint: "The parts look as if they belong to one designed world." },
      { title: "Assign three color jobs", instruction: "Choose a dominant, supporting, and accent family, keeping each major mass mostly unified.", checkpoint: "No small color patch competes with the main town shape." },
      { title: "Ink the hierarchy", instruction: "Strengthen the outside silhouette and key overlaps, then add only the marks that improve rhythm or personality.", checkpoint: "The drawing feels lively without every edge receiving the same weight." },
    ],
    materials: ["Smooth drawing paper or tablet", "Soft pencil for thumbnails", "Brush pen or variable digital ink brush", "Three to five opaque colors", "White correction pen, optional"],
    commonMistakes: [
      { mistake: "Simplifying details but leaving the overall silhouette ordinary.", correction: "Push the largest relationship first; small stylization reads only after the big shape changes." },
      { mistake: "Outlining every interior object at equal weight.", correction: "Let color boundaries carry some separations and strengthen only useful overlaps." },
      { mistake: "Adding many unrelated bright colors.", correction: "Give each color a role and reserve the strongest accent for one focal area." },
    ],
    practicePrompt: "Redraw the learner reference with only six filled shapes and three colors. Then add a maximum of twenty contour or texture marks to make it feel animated.",
  },
  {
    slug: "architectural",
    label: "Architectural drawing",
    kicker: "Explain the space",
    definition:
      "A communicative drawing system that makes spatial relationships, construction, access, and scale easy to inspect. Accuracy is supported by projection, line-weight hierarchy, measured repetition, and selective notation.",
    medium: "Technical pen, graphite, and restrained marker tone",
    ...images(
      "architectural",
      "Architectural drawing",
      "Precise architectural presentation of a fictional Japanese coastal hillside, emphasizing stacked buildings, stairs, retaining walls, vertical elevation, and line-weight hierarchy.",
      "Simplified architectural learner study of a vertical coastal settlement with clear perspective guides, stacked building volumes, stairs, and sparse tonal hierarchy.",
      "Four-panel architectural process sheet moving from composition envelope to perspective construction, line-weight and value hierarchy, and precise presentation detail.",
    ),
    traits: [
      "Projection and perspective make dimensions inspectable",
      "Line weight separates cut, profile, overlap, and distant information",
      "Repeated elements establish scale and construction rhythm",
      "Tone supports hierarchy without obscuring the drawing system",
    ],
    visualRecipe: {
      structure: "Establish a vertical datum, horizon, cliff envelope, and stepped floor levels before drawing roofs or windows.",
      line: "Use heaviest lines for the primary profile, medium lines for visible edges, and light lines for grids, distant forms, and guides.",
      value: "Use sparse shadow or gray tone to separate planes and clarify depth, not to create painterly atmosphere.",
      color: "Keep color absent or limited to one restrained annotation/accent family.",
      medium: "Construct lightly in graphite, ink confirmed edges with technical pens, then erase or retain guides according to the presentation goal.",
      texture: "Indicate material through economical conventions—parallel hatch, roof rhythm, foliage symbols—rather than literal rendering.",
      detail: "Repeat window bays, posts, rails, and stair treads consistently so they communicate scale and assembly.",
    },
    processPanels: [
      { title: "Composition and vertical datum", description: "A tall cliff envelope, sea level, major terraces, and building cluster establish the composition’s strong sense of verticality." },
      { title: "Perspective and construction", description: "Light projection lines coordinate roof ridges, floor levels, stairs, retaining walls, and repeated structural bays." },
      { title: "Line-weight and tone hierarchy", description: "Dark profiles, medium visible edges, pale guides, and limited shadow separate information by importance." },
      { title: "Presentation finish", description: "Windows, railings, supports, roof modules, and restrained entourage communicate scale while the underlying system stays visible." },
    ],
    steps: [
      { title: "Set the datums", instruction: "Place sea level, horizon, one strong cliff vertical, and three terrace heights.", checkpoint: "Every later building can attach to a clear level or slope." },
      { title: "Project the volumes", instruction: "Build the largest building blocks and roofs with shared vanishing logic, then connect them using stairs and platforms.", checkpoint: "Edges that are parallel in space behave consistently on the page." },
      { title: "Code the line weights", instruction: "Trace primary profile, visible edges, and secondary detail with three distinct weights.", checkpoint: "The main section and vertical rise are obvious from arm’s length." },
      { title: "Add scale and material", instruction: "Repeat a few windows, posts, railings, roof seams, and foliage symbols; add restrained plane tone.", checkpoint: "Detail explains construction and scale instead of decorating empty areas." },
    ],
    materials: ["Layout or tracing paper", "2H and HB pencils", "Technical pens: 0.1, 0.3, and 0.6 mm", "Ruler and triangle", "Cool gray marker or diluted ink, optional"],
    commonMistakes: [
      { mistake: "Starting with individual buildings before establishing levels and projection.", correction: "Set the horizon, datums, terrace heights, and largest envelope first." },
      { mistake: "Using a single line weight.", correction: "Create a three-level hierarchy so profile, visible edge, and secondary information separate instantly." },
      { mistake: "Adding shadows that hide structural information.", correction: "Keep tone light and local; drawing clarity remains the priority." },
    ],
    practicePrompt: "Using the learner reference, draw only sea level, cliff profile, three terraces, four building boxes, and the main stair. Finish with three line weights and one gray shadow family.",
  },
  {
    slug: "watercolor",
    label: "Watercolor",
    kicker: "Let water carry the atmosphere",
    definition:
      "A transparent painting approach built through reserved paper, flowing washes, glazing, and controlled edge variety. The scene emerges from large light-to-dark relationships before descriptive accents.",
    medium: "Transparent watercolor",
    ...images(
      "watercolor",
      "Watercolor",
      "Loose atmospheric watercolor of a fictional Japanese seaside hillside, with luminous paper, flowing blue-green washes, warm roofs, soft distant edges, and selective dark accents.",
      "Simplified watercolor learner reference with a broad sky and sea wash, one hillside shape, a compact town cluster, and a few controlled accents.",
      "Four-panel watercolor process sheet showing reserved lights and large washes, structural placement, glazed value and color groups, and selective dry-brush finish.",
    ),
    traits: [
      "White paper is planned as the lightest value",
      "Large transparent washes connect the scene",
      "Soft, lost, and hard edges direct attention",
      "Dark accents arrive late and remain selective",
    ],
    visualRecipe: {
      structure: "Place only the horizon, hill, town envelope, and stair gesture in a pale, water-soluble drawing.",
      line: "Keep preliminary line minimal and allow most boundaries to be created by adjacent washes rather than ink.",
      value: "Paint light to dark in connected groups, drying between major glazes where an edge must remain clear.",
      color: "Mix color families on the page—cool blue-green atmosphere against restrained warm roofs and walls—while preserving luminous neutrals.",
      medium: "Use a large brush for initial washes, a medium pointed round for shapes, and a nearly dry brush for a few final textures.",
      texture: "Let blooms, granulation, broken brush, and pigment settling suggest foliage, stone, and water without overworking them.",
      detail: "Use the smallest brush only for the focal roofs, rails, wires, and a handful of dark joins.",
    },
    processPanels: [
      { title: "Composition and reserved paper", description: "Untouched paper marks the brightest walls and water glints while broad pale washes establish sky, sea, and hillside." },
      { title: "Structure and perspective", description: "A few deliberate roof, stair, and shoreline marks hold the architecture without enclosing every form." },
      { title: "Glazed value and color", description: "Transparent blue-green and warm earth glazes deepen connected shadow families while earlier light remains luminous." },
      { title: "Watercolor finish", description: "Selective hard edges, dry-brush foliage, roof accents, and deep darks focus the town amid softer atmospheric passages." },
    ],
    steps: [
      { title: "Reserve the light", instruction: "Mark the brightest roof planes, walls, and water glints, then wash sky and sea broadly around them.", checkpoint: "The white paper already creates a believable light path." },
      { title: "Drop in the big shapes", instruction: "Paint the hillside and town envelope with two connected mid-value washes, varying wetness to create soft and firm edges.", checkpoint: "The scene reads with no windows, tiles, or foliage marks." },
      { title: "Glaze the structure", instruction: "After drying, add roof planes, shadow sides, stairs, and one deeper foliage family with transparent glazes.", checkpoint: "Light areas remain clean and the darkest family is still limited." },
      { title: "Place the accents", instruction: "Use a smaller, drier brush for a few roof seams, branches, rails, wires, and ripples.", checkpoint: "Every dark accent has a job; none was added simply to fill space." },
    ],
    materials: ["Cold-press watercolor paper", "Large mop or wash brush", "Medium and small pointed rounds", "Transparent blue, green, yellow ochre, burnt sienna, and neutral dark", "Two water containers and absorbent cloth", "Masking tape, optional"],
    commonMistakes: [
      { mistake: "Drawing and enclosing every object before painting.", correction: "Let neighboring washes create most edges; keep line only where structure needs help." },
      { mistake: "Returning to a damp passage until it becomes muddy.", correction: "Make one clear wash decision, then let it dry before glazing." },
      { mistake: "Spending the white paper too early.", correction: "Identify the brightest path before the first wash and protect it deliberately." },
    ],
    practicePrompt: "Paint the learner reference with one sky/sea wash, one hillside wash, one warm town wash, and one dark accent mixture. Stop after fifteen deliberate accents.",
  },
  {
    slug: "anime-environment",
    label: "Anime environment",
    kicker: "Step a place with a story",
    definition:
      "An animation-background approach that combines clear layout, cinematic perspective, controlled tonal planning, atmospheric color, and selective lived-in detail. The environment is designed to support mood and implied narrative while remaining readable behind moving characters.",
    medium: "Layered digital gouache-style environment painting",
    ...images(
      "anime-environment",
      "Anime environment",
      "Cinematic animated-environment painting of an original cliffside Japanese inn above a waterfall and blue inlet, surrounded by layered rock, trees, paths, and warm lived-in details.",
      "Simplified learner-ready animated environment of the same original cliffside inn and waterfall, reduced to large readable rock, building, foliage, and water shapes.",
      "Four-panel anime environment process sheet progressing from cinematic masses to perspective layout, tonal and color scripting, and selective painted atmosphere and detail.",
    ),
    traits: [
      "Cinematic layout and a clear route for the eye",
      "Large tonal plan supports readable action and depth",
      "Atmospheric color separates foreground, middle ground, and distance",
      "Lived-in details imply story but cluster around the focal area",
    ],
    visualRecipe: {
      structure: "Arrange cliff, inn, waterfall, inlet, and framing trees as a strong depth sequence; verify every platform and support in perspective.",
      line: "Use clean layout lines during construction, then absorb most of them into painted edges while retaining a few crisp architectural joins.",
      value: "Design a readable dark cliff and foliage frame around a lighter building and waterfall focal path.",
      color: "Script a dominant cool natural world, warm inhabited architecture, and luminous water accents; shift distant planes lighter and less saturated.",
      medium: "Build opaque-to-semi-opaque digital paint layers with broad textured brushes, separating layout, flats, light, atmosphere, and detail.",
      texture: "Use designed brush clusters for rock strata, foliage canopies, timber, and falling water rather than uniform noise.",
      detail: "Concentrate windows, railings, plants, steps, lamps, and structural joins around the inn; keep distant cliffs graphic.",
    },
    processPanels: [
      { title: "Composition and major masses", description: "A dark cliff and tree frame surrounds the lighter inn and vertical waterfall, creating an immediate cinematic focal path." },
      { title: "Layout and perspective", description: "Terraces, roofs, supports, paths, and the watercourse are constructed as a coherent climb through three-dimensional space." },
      { title: "Tonal plan and color script", description: "Cool rock and foliage masses support warm architecture while pale atmospheric planes separate the distant valley." },
      { title: "Painted atmosphere and detail", description: "Rock strata, tree clusters, waterfall spray, railings, windows, and small signs of habitation sharpen toward the inn." },
    ],
    steps: [
      { title: "Step the focal path", instruction: "Place the cliff, inn, waterfall, inlet, and framing trees as five simple shapes. Let the waterfall point toward the building.", checkpoint: "The eye reaches the inn without needing any detail." },
      { title: "Solve the layout", instruction: "Build the inn from stacked boxes and roofs, then connect platforms, supports, stairs, and water to the cliff logic.", checkpoint: "The place feels inhabitable and structurally possible." },
      { title: "Script value and color", instruction: "Group dark frame, mid-value cliff, warm focal architecture, light water, and pale distance before rendering.", checkpoint: "The focal building separates even when the image is viewed very small." },
      { title: "Paint the story clues", instruction: "Add clustered tree, rock, timber, water, and habitation details, using atmosphere to quiet the distance.", checkpoint: "The setting feels lived in, but the large tonal design remains intact." },
    ],
    materials: ["Tablet and pressure-sensitive stylus", "Digital painting app with layers", "Broad textured opaque brush", "Smaller hard-edge layout brush", "Soft atmospheric brush used sparingly", "Optional: three-value thumbnail template"],
    commonMistakes: [
      { mistake: "Rendering foliage and architecture before the cinematic value plan works.", correction: "Reduce the scene to five masses and verify the focal path at thumbnail size." },
      { mistake: "Using atmosphere as blur everywhere.", correction: "Control contrast, saturation, edge, and scale together; keep the focal architecture crisp." },
      { mistake: "Adding charming props without structural logic.", correction: "Solve platforms, supports, stairs, and access first so lived-in detail reinforces a believable place." },
    ],
    practicePrompt: "Rebuild the learner reference as five value shapes, then add the inn as four stacked boxes. Use one warm light family and reserve detail for the building-waterfall junction.",
    futureNote: "Future Anime Style Explorer: a dedicated guide can expand this entry into animation-background traditions, manga language, character design, and additional substyles without treating anime as one fixed look.",
  },
] as const;

const comparisonImage = (path: string, alt: string): StyleGuideAsset => ({
  src: comparisonAsset(path),
  width: path.endsWith("thumbnail.png") ? 768 : 1536,
  height: path.endsWith("thumbnail.png") ? 512 : 1024,
  alt,
});

const astronautImage = (path: string, alt: string): StyleGuideAsset => ({
  src: astronautAsset(path),
  width: path.endsWith("thumbnail.png") ? 768 : 1536,
  height: path.endsWith("thumbnail.png") ? 512 : 1024,
  alt,
});

const camperVanImage = (path: string, alt: string): StyleGuideAsset => ({
  src: camperVanAsset(path),
  width: path.endsWith("thumbnail.png") ? 768 : 1536,
  height: path.endsWith("thumbnail.png") ? 512 : 1024,
  alt,
});

const bouquetImage = (path: string, alt: string): StyleGuideAsset => ({
  src: bouquetAsset(path),
  width: path.endsWith("thumbnail.png") ? 768 : 1536,
  height: path.endsWith("thumbnail.png") ? 512 : 1024,
  alt,
});

const greenhouseImage = (path: string, alt: string): StyleGuideAsset => ({
  src: greenhouseAsset(path),
  width: path.endsWith("thumbnail.png") ? 768 : 1536,
  height: path.endsWith("thumbnail.png") ? 512 : 1024,
  alt,
});

export const COASTAL_STAIRWAY_COMPARISON: StyleComparisonSubject = {
  slug: "coastal-stairway",
  label: "Coastal stairway",
  description:
    "One compact composition held at the same viewpoint so differences in line, value, color, edge, and medium are easier to compare.",
  base: comparisonImage(
    "base-thumbnail.png",
    "Neutral graphite-gray construction study of a coastal house reached by stone stairs, with potted plants, a retaining wall, and the sea beyond.",
  ),
  variants: [
    {
      style: "realism",
      label: "Realism",
      treatment: "Observed light, material, and modeled form",
      thumbnail: comparisonImage(
        "realism/thumbnail.png",
        "Naturalistic full-color realism drawing of the shared coastal stairway composition.",
      ),
      reference: comparisonImage(
        "realism/reference-candidate.png",
        "Naturalistic full-color realism drawing of the shared coastal stairway composition, with modeled stone, foliage, architecture, sky, and sea.",
      ),
    },
    {
      style: "cartoon",
      label: "Cartoon",
      treatment: "Bold contours, simplified shapes, and flat color",
      thumbnail: comparisonImage(
        "cartoon/thumbnail.png",
        "Shape-driven cartoon rendering of the shared coastal stairway composition.",
      ),
      reference: comparisonImage(
        "cartoon/reference-candidate.png",
        "Color cartoon rendering of the shared coastal stairway composition, using strong outlines, simplified foliage, and graphic shadows.",
      ),
    },
    {
      style: "architectural",
      label: "Architectural drawing",
      treatment: "Measured structure and disciplined line hierarchy",
      thumbnail: comparisonImage(
        "architectural/thumbnail.png",
        "Architectural presentation drawing of the shared coastal stairway composition.",
      ),
      reference: comparisonImage(
        "architectural/reference-candidate.png",
        "Architectural perspective rendering of the shared coastal stairway composition, with precise construction, vertical emphasis, and restrained color.",
      ),
    },
    {
      style: "watercolor",
      label: "Watercolor",
      treatment: "Transparent washes and soft atmospheric edges",
      thumbnail: comparisonImage(
        "watercolor/thumbnail.png",
        "Loose transparent watercolor rendering of the shared coastal stairway composition.",
      ),
      reference: comparisonImage(
        "watercolor/reference-candidate.png",
        "Atmospheric watercolor rendering of the shared coastal stairway composition, with reserved paper, layered washes, and selective edges.",
      ),
    },
    {
      style: "anime-environment",
      label: "Anime environment",
      treatment: "Cinematic color, clear masses, and painted atmosphere",
      thumbnail: comparisonImage(
        "anime-environment/thumbnail.png",
        "Original animation-environment rendering of the shared coastal stairway composition.",
      ),
      reference: comparisonImage(
        "anime-environment/reference-candidate.png",
        "Original cinematic animation-background rendering of the shared coastal stairway composition, with luminous color and layered environmental depth.",
      ),
    },
  ],
  futureNote:
    "First-pass comparison. A future art-direction pass will push structural differences in shape, proportion, value design, edge logic, and detail hierarchy.",
};

export const ASTRONAUT_COMPARISON: StyleComparisonSubject = {
  slug: "astronaut",
  label: "Laid-back astronaut",
  description:
    "One relaxed, oversized-suit character re-staged for each style, showing how style can shape pose, camera, composition, and environment—not only surface treatment.",
  base: astronautImage(
    "base-thumbnail.png",
    "Neutral graphite construction drawing of a relaxed astronaut in a roomy, ruffled suit, seated casually on a floating moon-rock ledge among sparse stars.",
  ),
  variants: [
    {
      style: "realism",
      label: "Realism",
      treatment: "Observed weight, fabric, light, and lunar texture",
      thumbnail: astronautImage(
        "realism/thumbnail.png",
        "Naturalistic colored illustration of a relaxed astronaut reclining inside a shallow moon crater.",
      ),
      reference: astronautImage(
        "realism/reference.png",
        "Low three-quarter realism illustration of a relaxed astronaut reclining in a shallow moon crater, with a nearby boot, carefully modeled ruffled suit, distant planet arc, and quiet star field.",
      ),
    },
    {
      style: "cartoon",
      label: "Cartoon",
      treatment: "Pushed shapes, buoyant pose, and flat graphic color",
      thumbnail: astronautImage(
        "cartoon/thumbnail.png",
        "Shape-driven cartoon astronaut floating through space in a playful lounging pose.",
      ),
      reference: astronautImage(
        "cartoon/reference.png",
        "Warm cartoon illustration of a chunky astronaut floating diagonally with hands behind the helmet, oversized boots, simplified suit folds, graphic stars, and small rounded asteroids.",
      ),
    },
    {
      style: "architectural",
      label: "Architectural drawing",
      treatment: "Constructed volumes, line hierarchy, and vertical staging",
      thumbnail: astronautImage(
        "architectural/thumbnail.png",
        "Architectural presentation drawing of an astronaut perched on a tall fractured rock column.",
      ),
      reference: astronautImage(
        "architectural/reference.png",
        "Textbook-like architectural drawing of an astronaut perched on a tall geometric lunar rock column, using fine construction lines, clear suit volumes, restrained marker tone, and strong vertical negative space.",
      ),
    },
    {
      style: "watercolor",
      label: "Watercolor",
      treatment: "Luminous washes, flowing edges, and spacious atmosphere",
      thumbnail: astronautImage(
        "watercolor/thumbnail.png",
        "Luminous watercolor of a relaxed astronaut lying along a lunar ridge beneath a violet star field.",
      ),
      reference: astronautImage(
        "watercolor/reference.png",
        "Dreamy transparent watercolor of an astronaut resting along a curved lunar ridge beneath an expansive indigo-violet sky, scattered stars, and a softly glowing planet.",
      ),
    },
    {
      style: "anime-environment",
      label: "Anime environment",
      treatment: "Cinematic scale, graphic light, and environmental wonder",
      thumbnail: astronautImage(
        "anime-environment/thumbnail.png",
        "Original cinematic animation-environment illustration of an astronaut watching a ringed planet.",
      ),
      reference: astronautImage(
        "anime-environment/reference.png",
        "Original cinematic animation-environment scene viewed from behind a seated astronaut on an asteroid rim, looking across a luminous blue star field toward an immense ringed planet.",
      ),
    },
  ],
  futureNote:
    "This collection intentionally lets every style direct its own pose, camera angle, and background while retaining the same relaxed astronaut idea.",
};

export const CAMPER_VAN_COMPARISON: StyleComparisonSubject = {
  slug: "camper-van",
  label: "Camper van overlook",
  description:
    "A compact cream-and-sage camper becomes a vehicle study, a shape-design exercise, and an atmospheric travel scene across five independently staged interpretations.",
  base: camperVanImage(
    "watercolor/thumbnail.png",
    "Watercolor view of a cream-and-sage camper van beside a folding chair at a spacious coastal overlook near sunrise.",
  ),
  variants: [
    {
      style: "realism",
      label: "Realism",
      treatment: "Believable vehicle structure, materials, and golden light",
      thumbnail: camperVanImage(
        "realism/thumbnail.png",
        "Naturalistic colored illustration of a compact camper van at a mountain overlook during sunset.",
      ),
      reference: camperVanImage(
        "realism/reference.png",
        "Naturalistic golden-hour illustration of a cream-and-sage pop-top camper van with an open side door and folding chair, parked on a textured mountain overlook above a layered valley.",
      ),
    },
    {
      style: "cartoon",
      label: "Cartoon",
      treatment: "Friendly proportions, bold contour, and graphic landscape shapes",
      thumbnail: camperVanImage(
        "cartoon/thumbnail.png",
        "Shape-driven cartoon camper van and orange folding chair on a bright coastal hill.",
      ),
      reference: camperVanImage(
        "cartoon/reference.png",
        "Playful low-angle cartoon of a squat cream-and-sage pop-top camper van with oversized wheels, open door, orange folding chair, bold outlines, flat shadows, and simplified coastal hills.",
      ),
    },
    {
      style: "architectural",
      label: "Architectural drawing",
      treatment: "Measured boxes, wheel ellipses, line hierarchy, and circulation",
      thumbnail: camperVanImage(
        "architectural/thumbnail.png",
        "Industrial-design presentation drawing of a camper van with an open side door and chair.",
      ),
      reference: camperVanImage(
        "architectural/reference.png",
        "Elevated three-quarter architectural presentation of a cream-and-sage pop-top camper van, showing precise wheel ellipses, open-door circulation, interior modules, construction traces, and restrained marker washes.",
      ),
    },
    {
      style: "watercolor",
      label: "Watercolor",
      treatment: "Open paper, coastal washes, and quiet morning atmosphere",
      thumbnail: camperVanImage(
        "watercolor/thumbnail.png",
        "Transparent watercolor of a small camper van and folding chair at a coastal sunrise overlook.",
      ),
      reference: camperVanImage(
        "watercolor/reference.png",
        "Spacious transparent watercolor of a cream-and-sage camper van with an open door and folding chair beside a winding coastal road, surrounded by luminous sea, sunrise sky, distant headlands, and loose grasses.",
      ),
    },
    {
      style: "anime-environment",
      label: "Anime environment",
      treatment: "Cinematic blue hour, warm shelter, and expansive depth",
      thumbnail: camperVanImage(
        "anime-environment/thumbnail.png",
        "Original cinematic animation-environment scene of a camper van glowing at a mountain overlook.",
      ),
      reference: camperVanImage(
        "anime-environment/reference.png",
        "Original cinematic blue-hour environment illustration of a small pop-top camper van and folding chair at a forest overlook, with a warm open doorway, starry sky, layered mountains, and a winding river valley below.",
      ),
    },
  ],
  futureNote:
    "The repeated van identity makes it possible to compare vehicle construction while each style independently controls viewpoint, landscape, and mood.",
};

export const BOUQUET_COMPARISON: StyleComparisonSubject = {
  slug: "bouquet",
  label: "Bouquets & vessels",
  description:
    "Five distinct arrangements pair different flowers and vessels with the style that best explains their shape, structure, atmosphere, and character.",
  base: bouquetImage(
    "watercolor/thumbnail.png",
    "Airy watercolor meadow bouquet in a translucent sea-green glass jar beside a rain-washed window.",
  ),
  variants: [
    {
      style: "realism",
      label: "Realism",
      treatment: "Translucent glass, observed stems, and quiet window light",
      thumbnail: bouquetImage(
        "realism/thumbnail.png",
        "Naturalistic arrangement of peach tulips, white narcissus, and olive branches in a smoky glass bottle.",
      ),
      reference: bouquetImage(
        "realism/reference.png",
        "Naturalistic colored illustration of peach tulips, white narcissus, and spare olive branches arranged in a tall smoky-teal glass bottle on a dark walnut table beside cool window light.",
      ),
    },
    {
      style: "cartoon",
      label: "Cartoon",
      treatment: "Oversized blooms, rhythmic contours, and bright graphic color",
      thumbnail: bouquetImage(
        "cartoon/thumbnail.png",
        "Bold cartoon bouquet of coral peonies, yellow daisies, lavender, and eucalyptus in a round cream vase.",
      ),
      reference: bouquetImage(
        "cartoon/reference.png",
        "Playful high-angle cartoon illustration of oversized coral peonies, sunny yellow daisies, purple lavender spikes, and long eucalyptus branches in a squat cream vase with a cobalt band.",
      ),
    },
    {
      style: "architectural",
      label: "Architectural drawing",
      treatment: "Faceted construction, directional stems, and measured negative space",
      thumbnail: bouquetImage(
        "architectural/thumbnail.png",
        "Design-presentation bouquet of calla lilies and rust protea in a faceted charcoal concrete vessel.",
      ),
      reference: bouquetImage(
        "architectural/reference.png",
        "Precise architectural presentation drawing of white calla lilies, rust-orange pincushion protea, and blade-like leaves arranged as directional volumes in a tall faceted concrete vessel on a stone plinth.",
      ),
    },
    {
      style: "watercolor",
      label: "Watercolor",
      treatment: "Wind-tossed wildflowers, transparent glazing, and open paper",
      thumbnail: bouquetImage(
        "watercolor/thumbnail.png",
        "Transparent watercolor meadow bouquet in a sea-green glass jar beside a softly rainy window.",
      ),
      reference: bouquetImage(
        "watercolor/reference.png",
        "Luminous transparent watercolor of loose red poppies, pink cosmos, cobalt cornflowers, white lace flowers, and fine grasses in a translucent sea-green jar beside a pale rain-washed garden window.",
      ),
    },
    {
      style: "anime-environment",
      label: "Anime environment",
      treatment: "Cinematic scale, cascading foliage, and warm-after-rain light",
      thumbnail: bouquetImage(
        "anime-environment/thumbnail.png",
        "Original cinematic bouquet of orange lilies and blue hydrangeas in a tall terracotta vase near open balcony doors.",
      ),
      reference: bouquetImage(
        "anime-environment/reference.png",
        "Original cinematic animation-environment illustration of orange tiger lilies, blue hydrangeas, willow branches, and glossy leaves cascading from a tall ribbed terracotta vase beside open balcony doors after rain.",
      ),
    },
  ],
  futureNote:
    "This collection varies the flowers, vessel, silhouette, and setting deliberately so each style demonstrates a different way to design the subject—not only a different finish.",
};

export const GREENHOUSE_COMPARISON: StyleComparisonSubject = {
  slug: "greenhouse",
  label: "Greenhouse after rain",
  description:
    "A warm glasshouse in a rain-darkened garden becomes a study in reflected light, structure, simplified shape, and quiet atmosphere.",
  base: greenhouseImage(
    "watercolor/thumbnail.png",
    "Luminous watercolor of a warmly glowing glass greenhouse beside a reflective garden path after rain.",
  ),
  variants: [
    {
      style: "realism",
      label: "Realism",
      treatment: "Observed glass, wet foliage, material texture, and reflected light",
      thumbnail: greenhouseImage(
        "realism/thumbnail.png",
        "Naturalistic colored drawing of a dark-framed greenhouse glowing warmly in a wet garden.",
      ),
      reference: greenhouseImage(
        "realism/reference.png",
        "Naturalistic eye-level illustration of a rain-beaded dark green greenhouse, warm potting table and chair, wet path reflections, hydrangeas, ferns, and broad hosta leaves.",
      ),
    },
    {
      style: "cartoon",
      label: "Cartoon",
      treatment: "Chunky construction, lively contours, and graphic puddle reflections",
      thumbnail: greenhouseImage(
        "cartoon/thumbnail.png",
        "Bold cartoon greenhouse with an arched doorway, bright plants, stepping stones, and puddles.",
      ),
      reference: greenhouseImage(
        "cartoon/reference.png",
        "Playful low-angle cartoon of a squat teal greenhouse with oversized arched doors, bold outlines, warm flat light, simplified plant masses, stepping stones, and reflective puddles.",
      ),
    },
    {
      style: "architectural",
      label: "Architectural drawing",
      treatment: "Axonometric construction, line hierarchy, and visible interior organization",
      thumbnail: greenhouseImage(
        "architectural/thumbnail.png",
        "Elevated architectural presentation of a glass greenhouse and its organized interior workspace.",
      ),
      reference: greenhouseImage(
        "architectural/reference.png",
        "Elevated axonometric architectural drawing of a dark-framed greenhouse showing roof pitch, mullions, shelves, chair, potting bench, restrained planting, and wet paving reflections.",
      ),
    },
    {
      style: "watercolor",
      label: "Watercolor",
      treatment: "Transparent rainy washes, lost edges, and a warm luminous center",
      thumbnail: greenhouseImage(
        "watercolor/thumbnail.png",
        "Atmospheric watercolor greenhouse glowing beside a curving wet path in a blue-green garden.",
      ),
      reference: greenhouseImage(
        "watercolor/reference.png",
        "Transparent watercolor of a warm glass greenhouse set off-center in a rain-softened blue-green garden, with a curving reflective path, open paper, granulated foliage, chair, and potting table.",
      ),
    },
    {
      style: "anime-environment",
      label: "Anime environment",
      treatment: "Cinematic blue hour, deep garden framing, and luminous shelter",
      thumbnail: greenhouseImage(
        "anime-environment/thumbnail.png",
        "Original cinematic blue-hour greenhouse glowing among deep wet garden foliage.",
      ),
      reference: greenhouseImage(
        "anime-environment/reference.png",
        "Original cinematic environment illustration of a warmly lit greenhouse nested in a deep indigo garden at blue hour, framed by rain-dark foliage and broad reflective paving.",
      ),
    },
  ],
  futureNote:
    "The shared greenhouse idea stays recognizable while each style independently controls camera, silhouette, edge behavior, detail density, and the balance between warm light and rainy garden atmosphere.",
};

export const STYLE_REFERENCE_SUBJECTS: readonly StyleReferenceSubject[] = [
  {
    slug: "japanese-seaside-town",
    label: "Japanese seaside town",
    description:
      "A layered coastal settlement with architecture, foliage, elevation, atmosphere, and water.",
    selectorImage: STYLE_GUIDE_ENTRIES[0].thumbnail,
    variants: STYLE_GUIDE_ENTRIES.map((entry) => ({
      style: entry.slug,
      label: entry.label,
      treatment: entry.kicker,
      thumbnail: entry.thumbnail,
      reference: entry.reference,
      guidePath: `/style-lab/styles/${entry.slug}`,
    })),
  },
  {
    slug: COASTAL_STAIRWAY_COMPARISON.slug,
    label: COASTAL_STAIRWAY_COMPARISON.label,
    description: COASTAL_STAIRWAY_COMPARISON.description,
    selectorImage: COASTAL_STAIRWAY_COMPARISON.base,
    variants: COASTAL_STAIRWAY_COMPARISON.variants,
    futureNote: COASTAL_STAIRWAY_COMPARISON.futureNote,
  },
  {
    slug: ASTRONAUT_COMPARISON.slug,
    label: ASTRONAUT_COMPARISON.label,
    description: ASTRONAUT_COMPARISON.description,
    selectorImage: ASTRONAUT_COMPARISON.base,
    variants: ASTRONAUT_COMPARISON.variants,
    futureNote: ASTRONAUT_COMPARISON.futureNote,
  },
  {
    slug: CAMPER_VAN_COMPARISON.slug,
    label: CAMPER_VAN_COMPARISON.label,
    description: CAMPER_VAN_COMPARISON.description,
    selectorImage: CAMPER_VAN_COMPARISON.base,
    variants: CAMPER_VAN_COMPARISON.variants,
    futureNote: CAMPER_VAN_COMPARISON.futureNote,
  },
  {
    slug: BOUQUET_COMPARISON.slug,
    label: BOUQUET_COMPARISON.label,
    description: BOUQUET_COMPARISON.description,
    selectorImage: BOUQUET_COMPARISON.base,
    variants: BOUQUET_COMPARISON.variants,
    futureNote: BOUQUET_COMPARISON.futureNote,
  },
  {
    slug: GREENHOUSE_COMPARISON.slug,
    label: GREENHOUSE_COMPARISON.label,
    description: GREENHOUSE_COMPARISON.description,
    selectorImage: GREENHOUSE_COMPARISON.base,
    variants: GREENHOUSE_COMPARISON.variants,
    futureNote: GREENHOUSE_COMPARISON.futureNote,
  },
] as const;

export const STYLE_GUIDE_BY_SLUG = new Map(
  STYLE_GUIDE_ENTRIES.map((entry) => [entry.slug, entry] as const),
);

export function isStyleGuideSlug(value: string | null | undefined): value is StyleGuideSlug {
  return STYLE_GUIDE_SLUGS.includes(value as StyleGuideSlug);
}
