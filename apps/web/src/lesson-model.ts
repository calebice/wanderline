const basePath = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

export type PaletteMix = {
  id: string;
  name: string;
  swatch: string;
  formula: string;
  dilution: string;
  water_parts?: number | null;
  ingredients?: Array<{ color: string; parts: number }> | null;
  consistency?: "very watery" | "watery" | "less water" | "lightly creamy" | null;
};

export type LessonStage = {
  id: string;
  title: string;
  short_title: string;
  time: string;
  water_state: string;
  principle: string;
  instruction: string;
  checkpoint_action?: string | null;
  approach_steps?: string[];
  process_phase?: "drawing_map" | "light_wash" | "light_and_middle_washes" | "middle_values" | "dark_forms" | "finished_target" | null;
  look_for: string;
  move_on: string;
  palette_mix_ids: string[];
};

export type LessonContent = {
  recipe?: { version?: string | null; finishing: { instruction: string; mix: PaletteMix } | null } | null;
  overview: string;
  learning_objective: string;
  composition_crop: string;
  focal_point: string;
  large_value_shapes: string;
  palette: PaletteMix[];
  light_shadow: string;
  materials: string[];
  underdrawing: string;
  wash_control: string;
  edges: { hard: string; soft: string; lost: string };
  details: { preserve: string[]; simplify: string[]; exaggerate: string[]; omit: string[] };
  common_mistakes: Array<{ id: string; mistake: string; correction: string }>;
  stages: LessonStage[];
  timed_study: { duration_minutes: number; notice: string; start: string; check: string };
  teaching_guide: Array<{ id: string; title: string; body: string }>;
  reflection_prompts: string[];
  completion_notes: string;
  user_notes: string;
};

export type LessonAsset = {
  id: string;
  role: "original_reference" | "study_reference" | "target_reference" | "stage_image" | "process_sheet" | "tracing_outline";
  order_index: number;
  is_primary: boolean;
  stage_id: string | null;
  render_set_id: string | null;
  is_current: boolean;
  original_content_type: string;
  display_content_type: string;
  width: number;
  height: number;
  filename: string;
  alt_text: string;
  image_url: string;
};

export type LessonGenerationBrief = {
  source_mode: "upload" | "prompt";
  sequence_style: "layer_study" | "illustrative" | "simple_recipe";
  scene_prompt: string | null;
  stage_count: number;
  mood: "as_shown" | "joyous" | "calm" | "pensive" | "dramatic" | "custom";
  background: "as_shown" | "monochrome" | "gradient" | "complementary" | "plain_paper" | "custom";
  treatment: "natural" | "loose" | "luminous" | "graphic" | "atmospheric" | "custom";
  custom_mood: string | null;
  custom_background: string | null;
  custom_treatment: string | null;
  additional_direction: string | null;
};

export const DEFAULT_LESSON_BRIEF: LessonGenerationBrief = {
  source_mode: "upload",
  sequence_style: "layer_study",
  scene_prompt: null,
  stage_count: 3,
  mood: "as_shown",
  background: "as_shown",
  treatment: "natural",
  custom_mood: null,
  custom_background: null,
  custom_treatment: null,
  additional_direction: null,
};

export type PaintingLesson = {
  latest_run_id?: string | null;
  latest_run_scope?: string | null;
  id: string;
  schema_version: "painting-lesson.v1" | string;
  template: "watercolor" | string;
  medium: "watercolor" | string;
  title: string;
  subject: string | null;
  artistic_context: string | null;
  difficulty: "beginner" | "intermediate" | "advanced" | string;
  estimated_duration_minutes: number;
  source_mode: "upload" | "prompt" | string;
  scene_prompt: string | null;
  generation_brief: LessonGenerationBrief;
  sequence_style_configured: boolean;
  approved_target_asset_id: string | null;
  active_render_set_id: string | null;
  image_generation_available: boolean;
  content: LessonContent | null;
  revision: number;
  saved_at: string | null;
  generation_status: string;
  generation_error: { code?: string; message?: string } | null;
  provider_mode: string;
  is_demo: boolean;
  assets: LessonAsset[];
  created_at: string;
  updated_at: string;
  process_image?: string;
};

export const LEMON_LESSON: PaintingLesson = {
  id: "lemon-water-control",
  schema_version: "painting-lesson.v1",
  template: "watercolor",
  medium: "watercolor",
  title: "Understand the water.",
  subject: "One lemon",
  artistic_context: "Learn what dry, glossy, damp, and dry-again paper lets you do.",
  difficulty: "beginner",
  estimated_duration_minutes: 25,
  source_mode: "upload",
  scene_prompt: null,
  generation_brief: { ...DEFAULT_LESSON_BRIEF, stage_count: 4 },
  sequence_style_configured: false,
  approved_target_asset_id: null,
  active_render_set_id: null,
  image_generation_available: true,
  revision: 1,
  saved_at: "2026-09-01T00:00:00Z",
  generation_status: "completed",
  generation_error: null,
  provider_mode: "curated",
  is_demo: false,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  process_image: `${basePath}watercolor-lesson/lemon/process.jpg`,
  assets: [{
    id: "lemon-original",
    role: "original_reference",
    order_index: 0,
    is_primary: true,
    stage_id: null,
    render_set_id: null,
    is_current: true,
    original_content_type: "image/jpeg",
    display_content_type: "image/jpeg",
    width: 1536,
    height: 1024,
    filename: "reference.jpg",
    alt_text: "Single yellow lemon with one green leaf and a soft shadow on a warm white surface.",
    image_url: `${basePath}watercolor-lesson/lemon/reference.jpg`,
  }],
  content: {
    overview: "Paint one simple subject in four visible steps. Notice when the paper is dry, glossy, damp, and dry again—and know what each state lets you do.",
    learning_objective: "Control water by reserving light, connecting a first wash, charging color while damp, and glazing only when dry.",
    composition_crop: "Keep the lemon large and slightly off-center, with the leaf and cast shadow balancing its tilted oval.",
    focal_point: "The paper-white highlight and the warm-to-cool turn immediately beside it.",
    large_value_shapes: "Read the lemon as one light oval, the leaf as one middle shape, and the cast/contact shadow as one quiet dark family.",
    palette: [
      { id: "paper-light", name: "Paper light", swatch: "#f7f2e7", formula: "Leave unpainted", dilution: "0 paint" },
      { id: "graphite-guide", name: "Graphite guide", swatch: "#77736c", formula: "HB pencil", dilution: "Feather-light pressure" },
      { id: "lemon-light", name: "Lemon light", swatch: "#f4d860", formula: "Yellow", dilution: "1 : 8 dilution", water_parts: 8 },
      { id: "leaf-light", name: "Leaf light", swatch: "#b4bf77", formula: "Yellow + blue · 3:1", dilution: "1 : 6 dilution", water_parts: 6 },
      { id: "shadow-hint", name: "Shadow hint", swatch: "#bac1d1", formula: "Blue + red · 2:1", dilution: "1 : 8 dilution", water_parts: 8 },
      { id: "warm-turn", name: "Warm turn", swatch: "#e9a742", formula: "Yellow + red · 4:1", dilution: "1 : 4 dilution", water_parts: 4 },
      { id: "leaf-middle", name: "Leaf middle", swatch: "#718944", formula: "Yellow + blue · 2:1", dilution: "1 : 3 dilution", water_parts: 3 },
      { id: "cast-shadow", name: "Cast shadow", swatch: "#8792ad", formula: "Blue + red · 2:1", dilution: "1 : 5 dilution", water_parts: 5 },
      { id: "lemon-glaze", name: "Lemon glaze", swatch: "#dfa033", formula: "Yellow + red · 5:1", dilution: "1 : 3 dilution", water_parts: 3 },
      { id: "deep-green", name: "Deep green", swatch: "#3f5f2b", formula: "Blue + yellow · 1:2", dilution: "1 : 2 dilution", water_parts: 2 },
      { id: "deep-neutral", name: "Deep neutral", swatch: "#646375", formula: "Blue + red · 1:1", dilution: "1 : 2 dilution", water_parts: 2 },
    ],
    light_shadow: "Reserve the highlight as paper, let the lemon turn gradually toward a warmer lower-right shadow, and keep the blue-violet cast shadow softer than the contact point.",
    materials: ["Cold-pressed watercolor paper, postcard size or larger", "One medium round with a good point", "Transparent yellow, warm red, and blue", "Two cups: one to rinse, one to keep clean", "Cloth for controlling the brush, not scrubbing the paper"],
    underdrawing: "Draw the lemon and leaf with a light searching line, marking the highlight as a simple paper-white shape.",
    wash_control: "Use a generous puddle for the first wash, charge pigment during a damp sheen, and wait for a fully matte surface before glazing.",
    edges: { hard: "Keep the lemon tip, stem, and contact point selective and crisp.", soft: "Feather the warm turn and cast-shadow edge while damp.", lost: "Let a quiet section of the lemon or leaf merge with a similar-value background." },
    details: { preserve: ["Highlight shape", "Tilted oval silhouette", "Leaf fold"], simplify: ["Peel texture", "Leaf veins"], exaggerate: ["Warm-to-cool turn", "Contact shadow"], omit: ["Specks that do not describe form"] },
    common_mistakes: [
      { id: "spent-light", mistake: "Painting through the highlight.", correction: "Plan and protect the paper-white shape before the first wash." },
      { id: "muddy-damp", mistake: "Scrubbing a wash as it loses its sheen.", correction: "Stop, let it dry, and make one clean glaze." },
      { id: "too-many-marks", mistake: "Adding peel and vein detail everywhere.", correction: "Keep only marks that clarify form, edge, or contact." },
    ],
    stages: [
      { id: "plan", title: "Place the shape. Save the light.", short_title: "Plan", time: "3–5 min", water_state: "Dry paper", principle: "In transparent watercolor, the paper is your brightest paint.", instruction: "Draw the lemon and leaf with a light, searching line. Mark the highlight as a simple paper-white shape; do not shade it.", look_for: "The lemon reads as one tilted oval with two small pointed ends. The leaf is one quieter shape, not a collection of veins.", move_on: "Move on when the silhouette feels balanced and the highlight has a clear boundary.", palette_mix_ids: ["paper-light", "graphite-guide"] },
      { id: "wash", title: "Make one luminous first wash.", short_title: "Wash", time: "4–6 min", water_state: "Wet paint on dry paper", principle: "More water makes a lighter, more transparent color—not a weaker decision.", instruction: "Mix a generous puddle of pale yellow. Paint the lemon as one connected shape around the highlight, then place one pale green leaf wash.", look_for: "The wash stays glossy long enough to connect your strokes. Color is even enough to feel calm, with no scrubbing back into drying areas.", move_on: "Let this layer become completely matte and cool to the touch before adding more color.", palette_mix_ids: ["lemon-light", "leaf-light", "shadow-hint"] },
      { id: "shape", title: "Charge color while the surface is damp.", short_title: "Shape", time: "6–8 min", water_state: "Damp sheen", principle: "Damp paper lets pigment travel just far enough to turn a flat wash into form.", instruction: "Touch warmer yellow-orange into the lower-right lemon while the wash still has a soft sheen. Deepen the leaf with a cooler green and begin the cast shadow with blue-violet gray.", look_for: "The new color feathers softly instead of exploding into a bloom or sitting as a hard stripe. The light side remains visibly lighter.", move_on: "Stop touching the lemon when the sheen disappears. Let every area dry before the final glaze.", palette_mix_ids: ["warm-turn", "leaf-middle", "cast-shadow"] },
      { id: "finish", title: "Glaze once. Accent selectively.", short_title: "Finish", time: "6–8 min", water_state: "Dry again", principle: "A glaze changes what is beneath it; it should clarify the form, not cover it.", instruction: "On fully dry paper, sweep one transparent warm glaze across the turning side. Strengthen the contact shadow, stem, leaf fold, and lemon tip with only a few darker marks.", look_for: "The lemon feels round because of one clear light-to-shadow turn. The highlight still belongs to the paper and the darkest darks stay small.", move_on: "Finish when the subject feels grounded. If a new mark will not explain form, edge, or contact, leave it out.", palette_mix_ids: ["lemon-glaze", "deep-green", "deep-neutral"] },
    ],
    timed_study: { duration_minutes: 8, notice: "Find the untouched paper, connected yellow shape, soft turn, and small crisp accents.", start: "Place the oval and highlight, then make one pale connected wash.", check: "The lemon should read before peel texture or leaf veins appear." },
    teaching_guide: [
      { id: "reserve", title: "Reserve before you paint", body: "Decide which light belongs to the paper itself. A saved highlight stays more luminous than lifted or opaque white." },
      { id: "sheen", title: "Read the sheen", body: "Glossy paint accepts connected strokes; a damp sheen softens charged color; matte paper can receive a controlled glaze." },
      { id: "finish", title: "Finish selectively", body: "Use the darkest and driest marks only where they explain contact, overlap, or the focal turn." },
    ],
    reflection_prompts: ["Which paper state felt easiest to recognize?", "Where did one edge do more work than several details?"],
    completion_notes: "Reserve the light. Connect the first wash. Add pigment while damp. Glaze only when dry.",
    user_notes: "",
  },
};
