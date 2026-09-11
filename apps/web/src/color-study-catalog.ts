export const COLOR_SOURCES = [
  { title: "Angela Fehr — Strategies for Building Limited Palettes", url: "https://danielsmith.com/tutorials/angela-fehr-strategies-for-building-limited-palettes/" },
  { title: "Jane Blundell — Watercolour colour wheel and mixtures", url: "https://www.janeblundellart.com/resources.html" },
  { title: "Jane Blundell — Mixing colors with Jane’s Grey", url: "https://danielsmith.com/product-updates/jane-blundell-janes-grey-daniel-smith-watercolor/" },
  { title: "Jane Blundell — Watercolour Triads", url: "https://www.janeblundellart.com/watercolour-triads.html" },
  { title: "Jane Blundell — Greens", url: "https://www.janeblundellart.com/greens.html" },
  { title: "Jane Blundell — Turquoise Watercolour Swatches", url: "https://www.janeblundellart.com/turquoise-watercolour-swatches.html" },
  { title: "Bruce MacEvoy — Watercolor mixing complements", url: "https://www.handprint.com/HP/WCL/mixtable.html" },
  { title: "DANIEL SMITH — Rose of Ultramarine", url: "https://danielsmith.com/color-stories/watercolors/rose-of-ultramarine-watercolor/" },
  { title: "Jane Blundell — Green Watercolour Swatches (PG36)", url: "https://www.janeblundellart.com/green-watercolour-swatches.html" },
  { title: "Bruce MacEvoy — Mixing green", url: "https://www.handprint.com/HP/WCL/tech34.html" },
] as const;

export type Hue = "red" | "orange" | "yellow" | "lime" | "green" | "mint" | "cyan" | "azure" | "blue" | "violet" | "magenta" | "rose";
export type Partner = { name: string; hue: Hue; rgb?: readonly [number, number, number] };
export type Mix = {
  id: string; paint: string; codes: string; partner: Partner; partnerCodes: string;
  result: string; exercise: string; note: string; source: number;
  evidence: "Documented mixture" | "Adapted exercise";
};
type Study = { related: Partner; contrast: Partner; mixes: readonly Mix[] };
const p = (name: string, hue: Hue): Partner => ({ name, hue });
const sienna: Partner = { name: "Burnt Sienna", hue: "orange", rgb: [163, 95, 62] };
export type Comparison = Partner & { kind: "Related" | "Contrast" | "Neutralizing"; source: number; guidance: string };
const neutral: Record<Hue, [Partner, number, string]> = {
  red: [p("Phthalo Green", "green"), 7, "If using Pyrrol Scarlet and PG7 Phthalo Green, test small additions for quieter reds and greens. Pigments and proportions matter."],
  orange: [p("Ultramarine", "blue"), 3, "For an earth-orange version, try Burnt Sienna with Ultramarine. A bright orange tube will not necessarily behave the same way."],
  yellow: [p("Violet", "violet"), 1, "Explore a yellow–violet near-complement. This is a neutralizing direction to test, not a verified recipe for an unspecified yellow."],
  lime: [p("Quinacridone Magenta", "magenta"), 9, "For a PG36 yellow-green, PR122 magenta is a documented mixing opposite. A yellow-and-green mixture will behave differently."],
  green: [{ name: "Anthraquinoid Red", hue: "red", rgb: [155,53,75] }, 5, "If using PG7 Phthalo Green and PR177 Anthraquinoid Red, explore deep greens, maroons, and dark neutrals."],
  mint: [{name:"Pyrrol Scarlet",hue:"red",rgb:[205,67,72]}, 7, "A pale PG7 blue-green can be moderated with Pyrrol Scarlet. Mint is a wash appearance, not a pigment identity; test your paints."],
  cyan: [sienna, 7, "Phthalo Blue GS and some Burnt Sienna formulations make subdued mixtures. Check your tube pigments and compare dried swatches."],
  azure: [sienna, 7, "Cerulean PB36 and Burnt Sienna are documented neutralizing partners for particular brands. Test your own formulation."],
  blue: [sienna, 3, "With Ultramarine PB29 and Burnt Sienna PBr7, explore blue-grays, warmer grays, and browns. Let the samples dry."],
  violet: [p("Sap Green", "green"), 7, "Some Sap Green formulations neutralize PV23 violet. This does not predict mixtures of every violet, including rose-and-blue mixes."],
  magenta: [p("Phthalo Green YS", "lime"), 9, "Confirm PR122 magenta and PG36 Phthalo Green Yellow Shade on the labels before testing this mixing-opposite pair."],
  rose: [p("Phthalo Green YS", "lime"), 7, "PV19 rose and PG36 green form documented neutralizing pairs for particular brands. Add the stronger paint sparingly."],
};
// Editorial comparison sets, not arithmetic wheel opposites or quality scores.
const comparisonHues: Record<Hue, [Hue, Hue, Hue, Hue]> = {
  red:["orange","rose","cyan","mint"], orange:["red","yellow","azure","cyan"],
  yellow:["orange","lime","magenta","blue"], lime:["yellow","green","rose","violet"],
  green:["lime","mint","rose","magenta"], mint:["green","cyan","orange","rose"],
  cyan:["mint","azure","red","rose"], azure:["cyan","blue","yellow","red"],
  blue:["azure","violet","orange","yellow"], violet:["blue","magenta","yellow","orange"],
  magenta:["violet","rose","green","mint"], rose:["red","magenta","green","cyan"],
};
export function comparisonsFor(hue: Hue): Comparison[] {
  const four = comparisonHues[hue].map((id, i): Comparison => ({
    name: id[0].toUpperCase() + id.slice(1), hue: id, kind: i < 2 ? "Related" : "Contrast", source: 1,
    guidance: i < 2 ? "Try these related hues in neighboring washes. Make three mixtures and notice which transition you would use in your painting." : "Keep some of each color unmixed for contrast. Test where they meet, then compare one small accent against a larger wash.",
  }));
  const [partner, source, guidance] = neutral[hue];
  return [...four, { ...partner, kind: "Neutralizing", source, guidance }];
}
const blueGray: Mix = { id: "ultramarine", paint: "Ultramarine", codes: "PB29", partner: sienna, partnerCodes: "PBr7",
  result: "Explore blue-grays, warmer grays, and browns.", exercise: "Make three small mixtures, changing which paint dominates. Let them dry before choosing one.",
  note: "The documented Ultramarine / Burnt Sienna combination can produce granulating grays. Brands and proportions affect the result.", source: 3, evidence: "Documented mixture" };
const turquoise: Mix = { id: "phthalo-blue", paint: "Phthalo Blue Green Shade", codes: "PB15:3", partner: p("Phthalo Green Blue Shade", "green"), partnerCodes: "PG7",
  result: "Explore turquoise between blue and green.", exercise: "Add green to a small pool of blue in tiny steps. Compare a mixed swatch with two separate shapes.",
  note: "Phthalo mixtures are generally staining and non-granulating. Begin with a small amount of the partner.", source: 6, evidence: "Documented mixture" };
export const COLOR_STUDIES: Record<Hue, Study> = {
  red: { related: p("Orange", "orange"), contrast: p("Subdued green", "green"), mixes: [{ id: "scarlet", paint: "Pyrrol Scarlet", codes: "PR255", partner: p("Hansa Yellow Medium", "yellow"), partnerCodes: "PY97", result: "Explore a range of warm oranges.", exercise: "Start with yellow, then add scarlet gradually across three swatches. Keep pure red beside them.", note: "This recipe names a warm scarlet; a different red may make a different orange.", source: 2, evidence: "Documented mixture" }] },
  orange: { related: p("Golden yellow", "yellow"), contrast: p("Ultramarine", "blue"), mixes: [{ ...blueGray, id: "sienna", paint: "Burnt Sienna (earth-orange alternative)", codes: "PBr7", partner: p("Ultramarine", "blue"), partnerCodes: "PB29", note: "Burnt Sienna is an earth-orange alternative, not a substitute prediction for every bright orange paint." }] },
  yellow: { related: p("Yellow-green", "lime"), contrast: p("Violet", "violet"), mixes: [{ id: "cool-yellow", paint: "Hansa Yellow Light", codes: "PY3", partner: p("Phthalo Blue Green Shade", "cyan"), partnerCodes: "PB15:3", result: "Explore bright greens with a cool yellow and cool blue.", exercise: "Add a little blue to yellow, then increase the blue across three swatches. Choose a green that suits your subject.", note: "A warm yellow changes this result. This exercise uses a cool-yellow example, not every yellow paint.", source: 4, evidence: "Adapted exercise" }] },
  lime: { related: p("Mid green", "green"), contrast: p("Rose", "rose"), mixes: [{ id: "yellow-green", paint: "Cool yellow + Phthalo Green mixture", codes: "PY3 + PG7", partner: p("Ultramarine", "blue"), partnerCodes: "PB29", result: "Shift a yellow-green toward a cooler foliage color.", exercise: "Add blue to your yellow-green in small increments. Compare the first and last swatches as light and shadow shapes.", note: "The starting color already contains two pigments; this exercise uses three ingredients in total.", source: 10, evidence: "Adapted exercise" }] },
  green: { related: p("Yellow-green", "lime"), contrast: p("Crimson", "red"), mixes: [{ id: "phthalo-green", paint: "Phthalo Green Blue Shade", codes: "PG7", partner: { name: "Anthraquinoid Red", hue: "red", rgb: [155, 53, 75] }, partnerCodes: "PR177", result: "Explore deep greens, maroons, and dark neutrals.", exercise: "Introduce crimson gradually. Stop at a quieter green, then continue in a separate pool to explore darker mixtures.", note: "The documented pairing uses a cool crimson. A warm red can give a different neutralizing result.", source: 5, evidence: "Documented mixture" }] },
  mint: { related: p("Turquoise", "cyan"), contrast: { name: "Warm coral", hue: "red", rgb: [214, 133, 114] }, mixes: [{ id: "pale-green", paint: "Pale Phthalo Green Blue Shade wash", codes: "PG7 + water", partner: p("Ultramarine", "blue"), partnerCodes: "PB29", result: "Explore aqua and turquoise from a pale blue-green wash.", exercise: "Dilute the starting wash, then add Ultramarine to part of it. Compare the dried colors.", note: "Mint describes a pale appearance, not a unique pigment. The ingredient pair is documented; dilution is an adapted exercise.", source: 5, evidence: "Adapted exercise" }] },
  cyan: { related: p("Blue-green", "mint"), contrast: sienna, mixes: [turquoise] },
  azure: { related: p("Ultramarine", "blue"), contrast: sienna, mixes: [{ id: "cerulean", paint: "Cerulean Chromium", codes: "PB36", partner: sienna, partnerCodes: "PBr7", result: "Test subdued neutrals with a sky-blue starting color.", exercise: "Introduce a little Burnt Sienna into Cerulean. Keep pure blue beside it and compare the dried texture.", note: "Historical tests document this pair for particular brands. Cerulean formulations vary; test your own paint.", source: 7, evidence: "Documented mixture" }] },
  blue: { related: p("Violet", "violet"), contrast: sienna, mixes: [blueGray, turquoise] },
  violet: { related: p("Rose", "rose"), contrast: p("Golden yellow", "yellow"), mixes: [{ id: "mixed-violet", paint: "Ultramarine + Quinacridone Rose mixture", codes: "PB29 + PV19", partner: p("Quinacridone Rose", "rose"), partnerCodes: "PV19", result: "Shift a mixed violet toward a warmer rose-violet.", exercise: "Add rose to part of your violet. Compare it with the original as two petal shadows.", note: "This adjusts an existing two-pigment mix. It is not a prediction for a single-pigment violet.", source: 8, evidence: "Adapted exercise" }] },
  magenta: { related: p("Violet", "violet"), contrast: p("Yellow-green", "lime"), mixes: [{ id: "magenta", paint: "Quinacridone Magenta / Lilac", codes: "PR122", partner: p("Phthalo Green Yellow Shade", "lime"), partnerCodes: "PG36", result: "Test a mixing opposite to reduce magenta’s intensity.", exercise: "Add green sparingly. Stop at a useful muted color and keep both unmixed endpoints for comparison.", note: "Confirm PR122 and PG36 on the labels. Other paints called magenta or phthalo green need different advice.", source: 9, evidence: "Documented mixture" }] },
  rose: { related: p("Red-violet", "violet"), contrast: p("Foliage green", "green"), mixes: [{ id: "quin-rose", paint: "Quinacridone Rose", codes: "PV19", partner: p("Ultramarine", "blue"), partnerCodes: "PB29", result: "Explore rose-violet through to blue-violet.", exercise: "Keep a pale rose passage beside a rose-and-blue shadow. Try allowing just one small edge to mingle.", note: "The documented combination can show blue settling within the rose wash. Actual texture depends on the paints and paper.", source: 8, evidence: "Documented mixture" }] },
};
