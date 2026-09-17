// Authored design-review recipes, not measured Emily Lex pigment predictions.
// General mixing reference (other paints, not validation of these formulas):
// https://danielsmith.com/artists/insights/jane-blundell-the-ultimate-watercolor-mixing-selection/
export const MIXING_EXAMPLE_VERSION = 1;
export const EMILY_LEX_PAINTS = [
  ["White", "#eee9dc"], ["Lemon Yellow", "#ded33c"], ["Yellow Middle", "#e9b631"],
  ["Orange Yellow", "#dc942f"], ["Yellow Ochre", "#b88b39"], ["Scarlet", "#bd3934"],
  ["Vermillion Hue", "#cf5132"], ["Rose", "#bd4f7e"], ["Violet", "#61507e"],
  ["Cerulean Blue", "#6a9eb3"], ["Ultramarine", "#476294"], ["Prussian Blue", "#28465e"],
  ["Yellow Green", "#99ad40"], ["Permanent Green", "#659854"], ["Green Deep", "#346847"],
  ["Hooker’s Green", "#428056"], ["Burnt Umber", "#775039"], ["Lamp Black", "#33342f"],
] as const;
export type EmilyPaint = typeof EMILY_LEX_PAINTS[number][0];
export const COLOR_FAMILIES = [
  { id: "reds", name: "Reds", color: "#bc4541" },
  { id: "oranges", name: "Oranges", color: "#d88742" },
  { id: "yellows", name: "Yellows", color: "#d6bb42" },
  { id: "greens", name: "Greens", color: "#73884c" },
  { id: "teals", name: "Teals", color: "#4e9390" },
  { id: "blues", name: "Blues", color: "#527ba3" },
  { id: "purples", name: "Purples", color: "#7c658e" },
  { id: "pinks", name: "Pinks", color: "#cd8d9f" },
  { id: "browns", name: "Browns", color: "#98724f" },
  { id: "grays", name: "Grays", color: "#7a8180" },
] as const;
export type ColorFamily = typeof COLOR_FAMILIES[number]["id"];
type Ingredient = { paint: EmilyPaint; amount: string; role: string };
export type MixingExample = {
  id: string; family: ColorFamily; name: string; color: string;
  ingredients: Ingredient[]; water: string;
  correction: { label: string; paint: EmilyPaint; instruction: string };
};
const ingredient = (paint: EmilyPaint, amount: string, role: string): Ingredient => ({ paint, amount, role });
const medium = "Add water gradually until the wash flows easily. Test on your painting paper and compare after it dries.";
const pale = "Move a little prepared paint into a clean well and add water gradually for a pale wash. Test and let it dry.";
const rich = "Use a concentrated puddle with just enough water for a flowing stroke. Test and let it dry before deepening it.";
function recipe(family: ColorFamily, id: string, name: string, color: string, ingredients: Ingredient[], water: string, label: string, paint: EmilyPaint, instruction: string): MixingExample {
  return { family, id, name, color, ingredients, water, correction: { label, paint, instruction } };
}
export const MIXING_EXAMPLES: readonly MixingExample[] = [
  recipe("reds", "poppy-red", "Poppy red", "#c65040", [ingredient("Scarlet", "2 parts", "gives the red base"), ingredient("Vermillion Hue", "1 part", "warms it toward orange-red")], medium, "Too orange", "Scarlet", "Add a little Scarlet to pull the mixture back toward red."),
  recipe("reds", "berry-red", "Berry red", "#a64964", [ingredient("Rose", "2 parts", "gives a cool red base"), ingredient("Scarlet", "1 part", "brings it toward red"), ingredient("Ultramarine", "a tiny touch", "deepens the cool note")], medium, "Too purple", "Scarlet", "Add a small touch of Scarlet to bring the mixture back toward red."),
  recipe("reds", "brick-red", "Brick red", "#a9634c", [ingredient("Scarlet", "2 parts", "gives the red base"), ingredient("Yellow Ochre", "1 part", "adds earthy warmth"), ingredient("Burnt Umber", "a small touch", "quiets the bright red")], medium, "Too brown", "Scarlet", "Add Scarlet to a separate portion to restore its red character."),
  recipe("oranges", "tangerine", "Tangerine", "#d9893d", [ingredient("Orange Yellow", "2 parts", "gives the golden base"), ingredient("Vermillion Hue", "1 part", "turns the yellow toward orange")], medium, "Too red", "Orange Yellow", "Add Orange Yellow a little at a time to recover a golden orange."),
  recipe("oranges", "apricot", "Apricot", "#e7b47f", [ingredient("Yellow Middle", "3 parts", "gives a warm yellow base"), ingredient("Rose", "a small touch", "adds a soft red note")], pale, "Too pink", "Yellow Middle", "Add a little Yellow Middle, then dilute a test portion again."),
  recipe("oranges", "terracotta", "Terracotta", "#b67c59", [ingredient("Orange Yellow", "2 parts", "gives the warm base"), ingredient("Scarlet", "1 part", "brings in a red-orange note"), ingredient("Burnt Umber", "a small touch", "adds an earthy finish")], medium, "Too brown", "Orange Yellow", "Add a little Orange Yellow to return some orange warmth."),
  recipe("yellows", "lemon-wash", "Lemon wash", "#dfd76c", [ingredient("Lemon Yellow", "a small puddle", "supplies the cool yellow hue")], pale, "Too pale", "Lemon Yellow", "Add more prepared Lemon Yellow, using less additional water."),
  recipe("yellows", "golden-yellow", "Golden yellow", "#d7b448", [ingredient("Yellow Middle", "3 parts", "gives the sunny base"), ingredient("Orange Yellow", "1 part", "adds a golden warmth")], medium, "Too orange", "Yellow Middle", "Add Yellow Middle gradually to bring the mix toward yellow."),
  recipe("yellows", "antique-gold", "Antique gold", "#b79a51", [ingredient("Yellow Ochre", "2 parts", "gives the earthy base"), ingredient("Yellow Middle", "1 part", "adds a yellow glow"), ingredient("Burnt Umber", "a tiny touch", "quiets the gold")], medium, "Too brown", "Yellow Middle", "Add Yellow Middle to a separate portion to restore yellow warmth."),
  recipe("greens", "olive-green", "Olive green", "#85904f", [ingredient("Lemon Yellow", "2 parts", "sets a yellow-led base"), ingredient("Green Deep", "1 part, added gradually", "builds the green"), ingredient("Burnt Umber", "a tiny touch, added last", "mutes the green toward earthy olive")], medium, "Too brown", "Lemon Yellow", "Try a little Lemon Yellow in a separate portion. If it stays muddy, start fresh and use less Burnt Umber."),
  recipe("greens", "fresh-leaf", "Fresh leaf", "#91ae58", [ingredient("Lemon Yellow", "2 parts", "gives the light yellow base"), ingredient("Permanent Green", "1 part", "builds a fresh yellow-green")], medium, "Too yellow", "Permanent Green", "Add Permanent Green in small touches until the yellow becomes leafy green."),
  recipe("greens", "forest-green", "Forest green", "#45674f", [ingredient("Green Deep", "2 parts", "gives the green base"), ingredient("Prussian Blue", "a small touch", "deepens and cools the green"), ingredient("Burnt Umber", "a tiny touch", "softens the brightness")], rich, "Too blue", "Green Deep", "Add Green Deep to a separate portion to restore its green character."),
  recipe("teals", "turquoise", "Turquoise", "#629fa5", [ingredient("Cerulean Blue", "3 parts", "gives a blue base"), ingredient("Permanent Green", "a small touch", "turns it toward turquoise")], medium, "Too green", "Cerulean Blue", "Add Cerulean Blue a little at a time to restore a blue-led turquoise."),
  recipe("teals", "lagoon", "Lagoon", "#447c83", [ingredient("Prussian Blue", "2 parts", "gives a deep blue base"), ingredient("Permanent Green", "1 part", "brings in the green note")], medium, "Too green", "Prussian Blue", "Add a tiny touch of Prussian Blue; stop before blue takes over."),
  recipe("teals", "sea-glass", "Sea glass", "#9fbab0", [ingredient("Cerulean Blue", "2 parts", "gives the blue base"), ingredient("Permanent Green", "1 part", "brings in green"), ingredient("Burnt Umber", "a tiny touch", "softens the brightness")], pale, "Too earthy", "Cerulean Blue", "Add a little Cerulean Blue to a separate portion, then dilute another test stroke."),
  recipe("blues", "sky-blue", "Sky blue", "#9bbaca", [ingredient("Cerulean Blue", "a small puddle", "supplies the sky-blue hue")], pale, "Too pale", "Cerulean Blue", "Add more prepared Cerulean Blue, using less additional water."),
  recipe("blues", "cornflower", "Cornflower", "#7186b0", [ingredient("Ultramarine", "2 parts", "gives a warm blue base"), ingredient("Cerulean Blue", "1 part", "brings it toward a softer sky blue")], medium, "Too violet", "Cerulean Blue", "Add a little Cerulean Blue to soften the violet-blue direction."),
  recipe("blues", "midnight-blue", "Midnight blue", "#3e5069", [ingredient("Prussian Blue", "2 parts", "gives the deep blue base"), ingredient("Ultramarine", "1 part", "adds a warmer blue note"), ingredient("Burnt Umber", "a tiny touch", "quiets the strong blue")], rich, "Too gray", "Prussian Blue", "Add a small touch of Prussian Blue to restore the blue character."),
  recipe("purples", "lavender", "Lavender", "#aaa0bd", [ingredient("Violet", "a small puddle", "supplies the violet hue")], pale, "Too pale", "Violet", "Add a little more prepared Violet to a separate portion of the wash."),
  recipe("purples", "plum", "Plum", "#83627e", [ingredient("Rose", "2 parts", "gives a red-violet base"), ingredient("Violet", "1 part", "deepens the purple note")], medium, "Too pink", "Violet", "Add Violet in small touches until the mixture feels more purple."),
  recipe("purples", "dusky-mauve", "Dusky mauve", "#a38b9a", [ingredient("Rose", "2 parts", "gives the rosy base"), ingredient("Ultramarine", "1 part", "turns it toward violet"), ingredient("Yellow Ochre", "a tiny touch", "softens the bright violet")], pale, "Too earthy", "Rose", "Add a little Rose to restore its rosy character, then test a diluted stroke."),
  recipe("pinks", "soft-rose", "Soft rose", "#d99aaa", [ingredient("Rose", "a small puddle", "supplies the rosy hue")], pale, "Too strong", "Rose", "Move some of the Rose wash to a clean well and add a little water."),
  recipe("pinks", "coral-pink", "Coral pink", "#df9b8c", [ingredient("Rose", "2 parts", "gives the pink base"), ingredient("Orange Yellow", "a small touch", "warms the pink toward coral")], pale, "Too orange", "Rose", "Add a little Rose to bring the mixture back toward pink."),
  recipe("pinks", "dusty-pink", "Dusty pink", "#bb9396", [ingredient("Rose", "3 parts", "gives the pink base"), ingredient("Yellow Ochre", "a small touch", "warms it"), ingredient("Ultramarine", "a tiny touch", "softens the brightness")], pale, "Too gray", "Rose", "Add a little Rose to a separate portion to restore the pink."),
  recipe("browns", "warm-brown", "Warm brown", "#997252", [ingredient("Burnt Umber", "3 parts", "gives the earthy base"), ingredient("Yellow Ochre", "1 part", "adds golden warmth")], medium, "Too golden", "Burnt Umber", "Add a small touch of Burnt Umber to quiet the gold."),
  recipe("browns", "sand", "Sand", "#cbb792", [ingredient("Yellow Ochre", "3 parts", "gives a warm earth-yellow base"), ingredient("Burnt Umber", "a small touch", "softens it toward tan")], pale, "Too brown", "Yellow Ochre", "Add Yellow Ochre to restore the golden note, then dilute a test portion."),
  recipe("browns", "caramel", "Caramel", "#ad824e", [ingredient("Yellow Ochre", "2 parts", "gives the golden base"), ingredient("Burnt Umber", "1 part", "turns it toward brown"), ingredient("Orange Yellow", "a small touch", "adds orange warmth")], medium, "Too orange", "Burnt Umber", "Add a small touch of Burnt Umber to quiet the orange."),
  recipe("browns", "chestnut", "Chestnut", "#8e5e4c", [ingredient("Burnt Umber", "2 parts", "gives the brown base"), ingredient("Scarlet", "1 part", "adds a red warmth"), ingredient("Ultramarine", "a tiny touch", "softens the red")], medium, "Too red", "Burnt Umber", "Add Burnt Umber to bring the mixture back toward an earthy brown."),
  recipe("browns", "walnut", "Walnut", "#675747", [ingredient("Burnt Umber", "3 parts", "gives the brown base"), ingredient("Ultramarine", "a small touch", "cools and deepens the brown")], rich, "Too gray", "Burnt Umber", "Add Burnt Umber to restore the earthy brown character."),
  recipe("browns", "taupe", "Taupe", "#a49787", [ingredient("Burnt Umber", "2 parts", "gives the brown base"), ingredient("Ultramarine", "1 part, added gradually", "quiets it toward gray-brown"), ingredient("Yellow Ochre", "a small touch", "returns some warm earth color")], pale, "Too blue", "Burnt Umber", "Add a little Burnt Umber to pull the mixture back toward gray-brown."),
  recipe("grays", "slate-gray", "Slate gray", "#727d82", [ingredient("Ultramarine", "1 part", "gives the cool blue base"), ingredient("Burnt Umber", "about 1 part, added gradually", "quiets the blue toward gray")], medium, "Too blue", "Burnt Umber", "Add a small touch of Burnt Umber to a separate portion. Stop as the blue softens."),
  recipe("grays", "pearl-gray", "Pearl gray", "#c1c2be", [ingredient("Lamp Black", "a small puddle", "gives the neutral base")], pale, "Too pale", "Lamp Black", "Add a tiny amount of prepared Lamp Black to deepen the wash."),
  recipe("grays", "warm-stone", "Warm stone", "#a49b8c", [ingredient("Burnt Umber", "1 part", "gives a warm base"), ingredient("Ultramarine", "about 1 part, added gradually", "quiets the brown"), ingredient("Yellow Ochre", "a tiny touch", "adds a warm stone note")], pale, "Too golden", "Ultramarine", "Test a tiny touch of Ultramarine in a separate portion to quiet the gold."),
  recipe("grays", "blue-smoke", "Blue smoke", "#9aaab6", [ingredient("Ultramarine", "2 parts", "gives the blue base"), ingredient("Burnt Umber", "1 part, added gradually", "softens the blue without removing it")], pale, "Too blue", "Burnt Umber", "Add a small touch of Burnt Umber until the blue feels quieter."),
  recipe("grays", "violet-shadow", "Violet shadow", "#8d8595", [ingredient("Violet", "2 parts", "gives the violet base"), ingredient("Yellow Ochre", "a small touch", "quiets the violet"), ingredient("Ultramarine", "a small touch", "adds a cool shadow note")], medium, "Too purple", "Yellow Ochre", "Test a tiny touch of Yellow Ochre in a separate portion to soften the purple."),
  recipe("grays", "charcoal", "Charcoal", "#525653", [ingredient("Lamp Black", "a small puddle", "supplies the dark neutral")], rich, "Too pale", "Lamp Black", "Add more prepared Lamp Black and less additional water for the next test."),
];
