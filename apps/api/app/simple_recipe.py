"""Compact painting recipes, adapted to the existing saved-session contract."""

from io import BytesIO
from typing import Annotated, Literal

from PIL import Image
from pydantic import Field, model_validator

from app.lesson_response_schemas import GeneratedPaletteMix
from app.lesson_schemas import LessonContent, LessonStage, PaintIngredient, StrictLessonSchema

RECIPE_ART_DIRECTION = (
    "Create exactly TWO equal panels side by side, divided at the exact horizontal midpoint "
    "of the canvas width. LEFT: a finished, very simple watercolor of one isolated main subject "
    "on white paper, using only two or three pigments, pale flat washes and a few dark accents. "
    "Reduce complex references to one recognizable focal subject, large easy shapes and minimal "
    "interior marks. No background, elaborate perspective, texture effects or expert brushwork. "
    "RIGHT: a matching clean graphite tracing outline of that SAME painting, at exactly the same "
    "scale, position and proportions within its panel. Only the silhouette and essential inner "
    "boundaries, including faint closed boundaries around highlights to leave white. "
    "Use thin visible gray lines on pure white; no shading or paint. "
    "Leave ample white margins around both subjects. No text, labels, swatches, border or gutter. "
)

RECIPE_VALIDATION = (
    "Check this two-panel beginner painting recipe. Approve only if the left half contains a "
    "simple isolated watercolor with few colors on white, and the right half contains its clean "
    "unpainted tracing outline. Both subjects must be complete, uncropped, and match in shape, "
    "pose, scale and position within their equal half-width panels. Reject missing outlines, "
    "extra panels, lettering, complex backgrounds or a detailed expert-level painting."
)


RECIPE_VERSION = "simple-recipe.v1"
RECIPE_GUIDANCE = "Write a tiny beginner watercolor recipe for this finished painting. Choose one to six short numbered-by-the-interface paint steps as needed by the actual image: pale base wash, small color/shadow areas, a few final accents. The user already has a tracing outline; do not spend a paint step drawing. Use two or three named pigments total, with at most four mixes. Every step needs its active palette IDs, dry/wet paper state and drying cue. Use structured ingredients with one or two everyday paint colors and positive approximate parts per mix. Reuse the SAME paint ingredients at different water strengths for light and dark variants whenever possible. For a red apple, use red alone with more or less water, plus ready-made brown for the stem. The consistency field is a short cue beside the swatch; dilution explains it simply in the mixing section. Return finishing=null unless one OPTIONAL short action and a separate mix adds a clear easy enhancement. The main steps must match the finished target without that enhancement. Keep the materials to a compact everyday supplies list, no pigment-specific names. Use everyday color names: red, brown, gray, green, yellow, blue; only add light or dark when needed. Never invent labels such as Pale Apple Red. Every instruction should be one short sentence: Paint the apple red, leaving the shine and stem unpainted. No stage-title preamble, no float, glaze, value masses or separate wetting directions. Prefer easy painting on dry paper. Put necessary drying advice in the short instruction itself. Keep mixing details out of instructions. Each mix formula uses everyday color names and approximate proportions (for example: 2 parts red + 1 part yellow); pigment-specific names are optional parenthetical hints only when useful. Dilution must describe paint consistency in plain language (very watery like tea, or lightly creamy like milk). Use water_parts=null rather than invented precision. Match the visible painting, with no extra background or advanced effects. Keep every instruction concrete and short. No introductory technique essays. "


def recipe_contract(version: str | None) -> tuple[str, str, str]:
    """Keep v1 immutable; retain old contracts when adding future versions.

    Unversioned runs use the pre-versioning contract, which v1 freezes unchanged.
    """
    if version not in (None, "simple-recipe.v1"):
        raise ValueError(f"Unsupported recipe version: {version}. No generation was started.")
    return RECIPE_ART_DIRECTION, RECIPE_VALIDATION, RECIPE_GUIDANCE


def split_recipe_art(data: bytes) -> tuple[bytes, bytes]:
    with Image.open(BytesIO(data)) as source:
        image = source.convert("RGB")
        middle = image.width // 2
        panels = []
        for box in [(0, 0, middle, image.height), (middle, 0, image.width, image.height)]:
            output = BytesIO()
            image.crop(box).save(output, format="PNG")
            panels.append(output.getvalue())
        return panels[0], panels[1]


class RecipeMix(GeneratedPaletteMix):
    name: str = Field(
        pattern=r"^(?:[Ll]ight |[Dd]ark )?(?:[Rr]ed|[Oo]range|[Yy]ellow|[Gg]reen|[Bb]lue|[Pp]urple|[Pp]ink|[Bb]rown|[Gg]ray|[Bb]lack|[Ww]hite)$"
    )
    ingredients: list[PaintIngredient] = Field(min_length=1, max_length=2)
    consistency: Literal["very watery", "watery", "less water", "lightly creamy"]


class OptionalFinishing(StrictLessonSchema):
    instruction: str = Field(min_length=1, max_length=180)
    mix: RecipeMix


class RecipeStep(StrictLessonSchema):
    title: str = Field(min_length=1, max_length=60)
    instruction: str = Field(min_length=1, max_length=180)
    paper_state: str = Field(min_length=1, max_length=60)
    dry_before_next: str = Field(min_length=1, max_length=100)
    palette_mix_ids: list[str] = Field(min_length=1, max_length=2)


class PaintingRecipe(StrictLessonSchema):
    inferred_title: str = Field(min_length=1, max_length=100)
    inferred_subject: str = Field(min_length=1, max_length=100)
    invitation: str = Field(min_length=1, max_length=160)
    palette: list[RecipeMix] = Field(min_length=1, max_length=4)
    finishing: OptionalFinishing | None = None
    steps: list[RecipeStep] = Field(min_length=1, max_length=6)
    materials: list[Annotated[str, Field(min_length=1, max_length=80)]] = Field(
        min_length=3, max_length=5
    )

    @model_validator(mode="after")
    def valid_palette_references(self) -> "PaintingRecipe":
        ids = {mix.id for mix in self.palette}
        if len(ids) != len(self.palette) or any(
            not set(step.palette_mix_ids) <= ids for step in self.steps
        ):
            raise ValueError("Recipe steps must reference unique, existing palette mixes.")
        if self.finishing and self.finishing.mix.id in ids:
            raise ValueError("The optional mix needs its own ID.")
        for mix in [*self.palette, *([self.finishing.mix] if self.finishing else [])]:
            if len({item.color for item in mix.ingredients}) != len(mix.ingredients):
                raise ValueError("Combine duplicate paint ingredients into one proportion.")
            mix.formula = " + ".join(
                f"{item.parts:g} part{'s' if item.parts != 1 else ''} {item.color}"
                for item in mix.ingredients
            )
        return self


def recipe_content(
    recipe: PaintingRecipe, minutes: int, version: str | None = RECIPE_VERSION
) -> LessonContent:
    """Fill compatibility-only fields locally instead of paying to generate hidden prose."""
    stages = [
        LessonStage(
            id=f"recipe-{index + 1}",
            title=step.title,
            short_title=step.title,
            time=f"About {max(1, minutes // len(recipe.steps))} min",
            water_state=step.paper_state,
            principle="A few marks are enough.",
            instruction=step.instruction,
            checkpoint_action=step.instruction,
            approach_steps=[],
            process_phase=None,
            look_for="Keep some white paper showing.",
            move_on=step.dry_before_next,
            palette_mix_ids=step.palette_mix_ids,
        )
        for index, step in enumerate(recipe.steps)
    ]
    return LessonContent.model_validate(
        {
            "recipe": {
                "version": version,
                "finishing": recipe.finishing.model_dump() if recipe.finishing else None,
            },
            "overview": recipe.invitation,
            "learning_objective": "Enjoy a few simple washes.",
            "composition_crop": "One subject with room around it.",
            "focal_point": recipe.inferred_subject,
            "large_value_shapes": "Light, middle and a few dark marks.",
            "palette": [mix.model_dump() for mix in recipe.palette],
            "light_shadow": "Keep the first wash pale.",
            "materials": recipe.materials,
            "underdrawing": "Trace the outline lightly onto watercolor paper.",
            "wash_control": "Try each mix on scrap paper first. Let each wash dry before the next.",
            "edges": {
                "hard": "Paint on dry paper.",
                "soft": "A damp brush can soften an edge.",
                "lost": "Leave a small gap.",
            },
            "details": {
                "preserve": ["Main shape"],
                "simplify": ["Small marks"],
                "exaggerate": [],
                "omit": ["Background"],
            },
            "common_mistakes": [
                {
                    "id": "too-dark",
                    "mistake": "The first wash feels dark.",
                    "correction": "Add water and test on scrap paper.",
                },
                {
                    "id": "too-wet",
                    "mistake": "Colors run together.",
                    "correction": "Let the paper dry before continuing.",
                },
            ],
            "stages": [stage.model_dump() for stage in stages],
            "timed_study": {
                "duration_minutes": min(minutes, 60),
                "notice": "Find the main shape.",
                "start": "Trace lightly.",
                "check": "Leave a little white.",
            },
            "teaching_guide": [
                {
                    "id": "trace",
                    "title": "Begin with the outline",
                    "body": "Trace lightly. It is fine to leave out small details.",
                },
                {
                    "id": "mix",
                    "title": "Test your mix",
                    "body": "Ratios are starting points; pigment strength varies.",
                },
            ],
            "reflection_prompts": [],
            "completion_notes": "Let it dry. You made time to paint.",
            "user_notes": "",
        }
    )
