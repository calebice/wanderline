export type EmotionSlug = "sad" | "heaviness" | "pensive" | "awed" | "joy";

export type EmotionArtwork = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

export type EmotionInterpretation = {
  slug: EmotionSlug;
  emotion: string;
  title: string;
  medium: string;
  artwork: EmotionArtwork;
  observation: string;
  prompt: string;
  palette: readonly string[];
  accent: string;
};

export type EmotionGallery = {
  id: string;
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  defaultInterpretation: EmotionSlug;
  thumbnail: EmotionArtwork;
  interpretations: readonly EmotionInterpretation[];
};

const basePath = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const studyAsset = (file: string) => `${basePath}/style-guide/feeling-first/the-last-tree/${file}`;
const artwork = (file: string, alt: string): EmotionArtwork => ({
  src: studyAsset(file),
  width: 1536,
  height: 1024,
  alt,
});

export const FEELING_FIRST_GALLERY: EmotionGallery = {
  id: "the-last-tree",
  slug: "the-last-tree",
  title: "Feeling First",
  eyebrow: "EMOTIONAL SPACE GALLERY",
  description: "Five completely different answers to the same question: how can a celestial scene carry a feeling before it tells a story?",
  defaultInterpretation: "pensive",
  thumbnail: {
    src: studyAsset("thumbnail.webp"),
    width: 720,
    height: 480,
    alt: "A quiet traveler beside a campfire on a small floating island beneath a ringed planet in the Pensive interpretation.",
  },
  interpretations: [
    {
      slug: "sad",
      emotion: "Sad",
      title: "The Last Lights",
      medium: "Charcoal, dry gouache, and colored pencil",
      artwork: artwork("sad.webp", "A sparse tree on a dim asteroid as its last glowing leaves drift through an almost empty star field."),
      observation: "The darkness is not just a backdrop—it seems to be slowly overtaking the few lights that remain. The low tree and falling leaves make the whole image settle downward.",
      prompt: "What could you remove from your scene so the few remaining lights matter more?",
      palette: ["#10131c", "#2f3542", "#8c8175", "#c8ad78"],
      accent: "#9b8c78",
    },
    {
      slug: "heaviness",
      emotion: "Heaviness",
      title: "The Pull",
      medium: "Dense gouache, ink, and scratched pastel",
      artwork: artwork("heaviness.webp", "A rooted tree, fractured asteroid, and flying debris bend toward the glowing rim of an immense black hole."),
      observation: "Every shape answers the same invisible force. The trunk, roots, rock, and debris strain along one diagonal, so the weight belongs to the entire world rather than one object.",
      prompt: "Choose one invisible force and make every major shape respond to it.",
      palette: ["#09090d", "#302a37", "#625565", "#c48a49"],
      accent: "#c48a49",
    },
    {
      slug: "pensive",
      emotion: "Pensive",
      title: "Camp Beyond the Map",
      medium: "Hand-painted gouache with block-print shapes",
      artwork: artwork("pensive.webp", "A tiny traveler rests beside a warm campfire on a small rocky island suspended beneath a ringed planet and expansive stars."),
      observation: "The tiny fire makes the floating island feel briefly like home, while the exposed rocky edge opens directly into an unknowable sky. There is nowhere to hurry to, so the scene becomes a place to sit and wonder.",
      prompt: "Place one familiar, warm object inside an unfamiliar landscape.",
      palette: ["#142b45", "#38536d", "#6c7186", "#df8650"],
      accent: "#df8650",
    },
    {
      slug: "awed",
      emotion: "Awed",
      title: "Beneath the Living Sky",
      medium: "Transparent watercolor and restrained ink",
      artwork: artwork("awed.webp", "A foreground bonsai and tiny observer overlook a reflective pond curving toward a waterfall in space beneath broad watercolor nebula clouds."),
      observation: "The nearby bonsai gives the eye somewhere quiet to stand before the pond curves away into open space. One distant figure and a single waterfall reveal the scale without showing the whole world.",
      prompt: "Let one familiar foreground form lead the eye into something immeasurably larger.",
      palette: ["#163a65", "#45bfc0", "#7060b5", "#e49ac2"],
      accent: "#55c9c6",
    },
    {
      slug: "joy",
      emotion: "Joy",
      title: "Skyward",
      medium: "Luminous gouache and colored pencil",
      artwork: artwork("joy.webp", "A healthy upright tree rises from sunlit green ground into a radiant blue celestial sky filled with warm sweeping light."),
      observation: "The stable ground, unbending tree, lifted viewpoint, and generous light make the scene feel open and alive. Nearly every important shape moves upward or outward.",
      prompt: "Build your composition around one shape that rises confidently into the light.",
      palette: ["#155b89", "#50a8c3", "#6c9d39", "#f0c84e"],
      accent: "#e6b638",
    },
  ],
};

export function isEmotionSlug(value: string | null): value is EmotionSlug {
  return FEELING_FIRST_GALLERY.interpretations.some((interpretation) => interpretation.slug === value);
}
