import base64
import json
from dataclasses import dataclass
from typing import Any, Protocol

from openai import AsyncOpenAI
from openai.lib._pydantic import to_strict_json_schema
from pydantic import BaseModel, create_model

from app.config import Settings
from app.generation_runtime import measured_call
from app.lesson_response_schemas import (
    GeneratedLessonContent,
    GeneratedLessonResponse,
    GeneratedLessonStage,
    ProcessBoardValidation,
)
from app.lesson_schemas import (
    LessonContent,
    LessonGenerationBrief,
    layer_study_phases,
)
from app.simple_recipe import (
    RECIPE_VERSION,
    PaintingRecipe,
    RecipeMix,
    recipe_content,
    recipe_contract,
)


@dataclass(frozen=True)
class LessonGenerationRequest:
    title: str
    subject: str | None
    artistic_context: str | None
    difficulty: str
    estimated_duration_minutes: int
    primary_image: bytes
    primary_content_type: str
    secondary_images: list[tuple[bytes, str]]
    generation_brief: LessonGenerationBrief
    recipe_version: str | None = RECIPE_VERSION


class LessonTextProvider(Protocol):
    name: str
    model: str
    is_demo: bool

    async def generate(self, request: LessonGenerationRequest) -> LessonContent: ...

    async def regenerate(
        self, request: LessonGenerationRequest, content: LessonContent, section_key: str
    ) -> object: ...


class StudyImageProvider(Protocol):
    async def generate(self, images: list[tuple[bytes, str]], prompt: str) -> tuple[bytes, str]: ...

    async def generate_from_prompt(self, prompt: str) -> tuple[bytes, str]: ...

    async def validate_process_board(
        self, images: list[tuple[bytes, str]], prompt: str
    ) -> ProcessBoardValidation: ...


def generated_section(
    content: LessonContent, section_key: str, current: LessonContent | None = None
) -> object:
    if section_key.startswith("stages."):
        stage_id = section_key.split(".", 1)[1]
        stage = next((item for item in content.stages if item.id == stage_id), None)
        if stage is None and current is not None:
            current_index = next(
                (index for index, item in enumerate(current.stages) if item.id == stage_id), None
            )
            if current_index is not None:
                stage = content.stages[min(current_index, len(content.stages) - 1)].model_copy(
                    update={"id": stage_id}
                )
        if stage is None:
            raise ValueError("Unknown lesson stage.")
        return stage.model_dump(mode="json")
    value = getattr(content, section_key, None)
    if value is None:
        raise ValueError("Unknown lesson section.")
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, list):
        result = [
            item.model_dump(mode="json") if hasattr(item, "model_dump") else item for item in value
        ]
        if current is not None and section_key in {"palette", "common_mistakes", "teaching_guide"}:
            current_items = getattr(current, section_key)
            for index, item in enumerate(result):
                if index < len(current_items) and isinstance(item, dict):
                    item["id"] = current_items[index].id
        return result
    return value


def demo_lesson(
    subject: str | None, title: str, minutes: int, stage_count: int = 3
) -> LessonContent:
    name = (subject or title or "your subject").strip()
    content = LessonContent.model_validate(
        {
            "overview": f"Make a little space to paint {name}. These sample tips use your written details, not a visual reading of your photo.",
            "learning_objective": "Simplify the reference into connected value masses while reserving paper for the clearest light.",
            "composition_crop": "Crop until the main subject occupies roughly two-thirds of the page, leaving one quieter area for breathing room.",
            "focal_point": "Choose one overlap or light-against-dark transition as the focal point and keep nearby edges most specific.",
            "large_value_shapes": "Begin with paper white, one broad middle-value family, and one small connected dark family. Ignore texture until those shapes read.",
            "palette": [
                {
                    "id": "warm-light",
                    "name": "Warm light",
                    "swatch": "#e4c46d",
                    "formula": "Yellow ochre + warm red · 4:1",
                    "dilution": "1 : 7 dilution",
                    "water_parts": 7,
                },
                {
                    "id": "cool-middle",
                    "name": "Cool middle",
                    "swatch": "#7c9b91",
                    "formula": "Blue + yellow · 2:1",
                    "dilution": "1 : 5 dilution",
                    "water_parts": 5,
                },
                {
                    "id": "deep-neutral",
                    "name": "Deep neutral",
                    "swatch": "#555a62",
                    "formula": "Blue + warm red · 1:1",
                    "dilution": "1 : 2 dilution",
                    "water_parts": 2,
                },
            ],
            "light_shadow": "Keep the light family joined and let reflected light remain quieter than the directly lit paper. Place the darkest accent only where forms touch or overlap.",
            "materials": [
                "Cold-pressed watercolor paper",
                "Large wash brush",
                "Medium pointed round",
                "Small round for final accents",
                "Two water containers and an absorbent cloth",
            ],
            "underdrawing": "Use a light searching line to place only the outer envelope, focal overlap, and boundary of the reserved light.",
            "wash_control": "Mix enough paint before touching the paper. Connect strokes while the surface is glossy, stop during the sticky half-dry stage, and glaze only when matte.",
            "edges": {
                "hard": "Keep a few crisp edges around the focal overlap and contact points.",
                "soft": "Soften turns inside the large middle-value family while the wash has a damp sheen.",
                "lost": "Let at least one non-focal contour dissolve into a neighboring wash of similar value.",
            },
            "details": {
                "preserve": ["The main silhouette", "The focal light-dark overlap"],
                "simplify": ["Repeated texture", "Small background divisions"],
                "exaggerate": ["The clearest light path", "One directional brush rhythm"],
                "omit": ["Incidental specks", "Competing sharp edges"],
            },
            "common_mistakes": [
                {
                    "id": "detail-first",
                    "mistake": "Beginning with small descriptive marks.",
                    "correction": "Return to the three largest value shapes and connect them first.",
                },
                {
                    "id": "damp-scrub",
                    "mistake": "Correcting a wash while it is half dry.",
                    "correction": "Leave it, dry completely, then make one transparent glaze.",
                },
                {
                    "id": "equal-edges",
                    "mistake": "Making every contour equally crisp.",
                    "correction": "Choose one focal edge and soften or lose two others.",
                },
            ],
            "stages": [
                {
                    "id": "plan",
                    "title": "Place the shape. Save the light.",
                    "short_title": "Plan",
                    "time": "3–5 min",
                    "water_state": "Dry paper",
                    "principle": "The paper is your brightest paint.",
                    "instruction": "Place the outer envelope and reserved light with a pale drawing.",
                    "checkpoint_action": "Place the main shape and protect the brightest paper.",
                    "approach_steps": [
                        "Mark only the outer envelope and focal overlap.",
                        "Indicate the reserved light with a feather-light line.",
                    ],
                    "look_for": "The subject reads without interior detail.",
                    "move_on": "Continue when the crop and light path feel deliberate.",
                    "palette_mix_ids": ["warm-light"],
                },
                {
                    "id": "wash",
                    "title": "Connect the first wash.",
                    "short_title": "Wash",
                    "time": "5–7 min",
                    "water_state": "Glossy wash",
                    "principle": "A generous puddle gives you time to connect shapes.",
                    "instruction": "Lay the lightest color family in one connected pass around the reserved paper.",
                    "checkpoint_action": "Connect the lightest color family in one generous wash.",
                    "approach_steps": [
                        "Mix enough transparent color before touching the paper.",
                        "Paint around the reserved light while the surface stays glossy.",
                        "Stop before the wash becomes sticky or half dry.",
                    ],
                    "look_for": "The surface stays glossy and brush marks join without scrubbing.",
                    "move_on": "Stop when the sheen starts to disappear, then dry fully.",
                    "palette_mix_ids": ["warm-light", "cool-middle"],
                },
                {
                    "id": "shape",
                    "title": "Turn the form with one glaze.",
                    "short_title": "Shape",
                    "time": "6–8 min",
                    "water_state": "Dry, then damp",
                    "principle": "One value change can explain more than many details.",
                    "instruction": "Glaze the middle-value mass and soften selected interior turns.",
                    "checkpoint_action": "Turn the form with one controlled middle-value glaze.",
                    "approach_steps": [
                        "Let the first wash dry completely.",
                        "Glaze the connected middle-value shape without filling the light.",
                        "Soften only the interior turns that should recede.",
                    ],
                    "look_for": "Light and shadow remain separate at thumbnail size.",
                    "move_on": "Continue when the large forms feel dimensional without texture.",
                    "palette_mix_ids": ["cool-middle", "deep-neutral"],
                },
                {
                    "id": "finish",
                    "title": "Place selective accents.",
                    "short_title": "Finish",
                    "time": "4–6 min",
                    "water_state": "Dry paper",
                    "principle": "A final mark should explain focus, form, or contact.",
                    "instruction": "Add a few dark joins, broken textures, and crisp focal edges.",
                    "checkpoint_action": "Add only the accents that clarify focus, form, or contact.",
                    "approach_steps": [
                        "Place the darkest joins at overlaps and contact points.",
                        "Add one or two broken textures near the focal area.",
                        "Leave the rest of the painting quieter.",
                    ],
                    "look_for": "Most of the painting remains quieter than the focal area.",
                    "move_on": "Finish before detail spreads evenly across the page.",
                    "palette_mix_ids": ["deep-neutral"],
                },
            ],
            "timed_study": {
                "duration_minutes": 8,
                "notice": "Find the reserved paper, largest connected wash, and sharpest edge.",
                "start": "Draw the outer envelope, then place three value masses.",
                "check": "The subject should read before any small marks are added.",
            },
            "teaching_guide": [
                {
                    "id": "staging",
                    "title": "Stage the page",
                    "body": "Use the crop and empty space to make the intended focal area easy to find before painting.",
                },
                {
                    "id": "atmosphere",
                    "title": "Let water carry atmosphere",
                    "body": "Join related shapes while wet, then use dry-again glazes only where structure needs clarification.",
                },
                {
                    "id": "marks",
                    "title": "Make fewer, clearer marks",
                    "body": "Vary pressure, moisture, and edge quality instead of describing every photographic detail.",
                },
            ],
            "reflection_prompts": [
                "Which edge best directs attention?",
                "Where did the water create something worth keeping?",
            ],
            "completion_notes": f"Aim for about {minutes} minutes of active painting, with unhurried drying pauses.",
            "user_notes": "",
        }
    )
    if stage_count == 5:
        content.stages.append(
            content.stages[-1].model_copy(
                update={
                    "id": "refine",
                    "title": "Refine one quiet passage.",
                    "short_title": "Refine",
                    "time": "2–4 min",
                    "instruction": "Make one final adjustment that supports the focal point, then stop.",
                    "checkpoint_action": "Make one quiet adjustment that strengthens the focal point.",
                    "approach_steps": [
                        "Step back and name the single weakest passage.",
                        "Change only that passage, then stop painting.",
                    ],
                    "look_for": "The new mark belongs to the whole painting rather than calling attention to itself.",
                    "move_on": "Finish when no additional mark has a clear job.",
                }
            )
        )
    content.stages = content.stages[:stage_count]
    return content


class DemoLessonProvider:
    name = "demo"
    model = "deterministic-demo-v1"
    is_demo = True

    async def generate(self, request: LessonGenerationRequest) -> LessonContent:
        content = demo_lesson(
            request.subject,
            request.title,
            request.estimated_duration_minutes,
            request.generation_brief.stage_count,
        )
        if request.generation_brief.sequence_style == "simple_recipe":
            recipe = PaintingRecipe.model_validate(
                {
                    "inferred_title": request.title,
                    "inferred_subject": request.subject or "Your subject",
                    "invitation": "Sample painting tips: these colors are suggestions, not a reading of your photo.",
                    "palette": [
                        {
                            **mix.model_dump(),
                            "name": name,
                            "ingredients": [{"color": color, "parts": 1}],
                            "consistency": consistency,
                        }
                        for mix, name, color, consistency in zip(
                            content.palette,
                            ["Light yellow", "Green", "Dark brown"],
                            ["yellow", "green", "brown"],
                            ["very watery", "watery", "lightly creamy"],
                            strict=True,
                        )
                    ],
                    "materials": [
                        "Watercolor paper",
                        "Round brush",
                        "Paint, water and scrap paper",
                    ],
                    "steps": [
                        {
                            "title": "Begin pale",
                            "instruction": "Draw one large shape lightly. Add a pale wash, leaving small white gaps.",
                            "paper_state": "Dry paper",
                            "dry_before_next": "Let the wash dry completely.",
                            "palette_mix_ids": ["warm-light"],
                        },
                        {
                            "title": "Add a little color",
                            "instruction": "Add one smaller patch of color. Leave most of the first wash showing.",
                            "paper_state": "Dry paper",
                            "dry_before_next": "Let the wash dry completely.",
                            "palette_mix_ids": ["cool-middle"],
                        },
                        {
                            "title": "Finish with a few marks",
                            "instruction": "Use the brush tip for two or three dark marks. Stop while it still feels light.",
                            "paper_state": "Dry paper",
                            "dry_before_next": "Leave your painting to dry.",
                            "palette_mix_ids": ["deep-neutral"],
                        },
                    ],
                }
            )
            for mix, consistency in zip(
                recipe.palette,
                ["Very watery, like tea", "Watery, like tea", "Lightly creamy, like milk"],
                strict=True,
            ):
                mix.dilution = consistency
            return recipe_content(
                recipe, request.estimated_duration_minutes, request.recipe_version
            )
        if request.generation_brief.sequence_style == "layer_study":
            for stage, phase in zip(
                content.stages, layer_study_phases(len(content.stages)), strict=True
            ):
                stage.process_phase = phase
        return content

    async def regenerate(
        self, request: LessonGenerationRequest, content: LessonContent, section_key: str
    ) -> object:
        fresh = await self.generate(request)
        return generated_section(fresh, section_key, content)


class UnconfiguredOpenAIProvider:
    name = "openai"
    is_demo = False

    def __init__(self, settings: Settings) -> None:
        self.model = settings.openai_lesson_model

    async def generate(self, request: LessonGenerationRequest) -> LessonContent:
        raise RuntimeError(
            "OpenAI lesson generation is selected, but OPENAI_API_KEY is not configured."
        )

    async def regenerate(
        self, request: LessonGenerationRequest, content: LessonContent, section_key: str
    ) -> object:
        raise RuntimeError(
            "OpenAI lesson generation is selected, but OPENAI_API_KEY is not configured."
        )


class OpenAILessonProvider:
    name = "openai"
    is_demo = False

    def __init__(self, settings: Settings) -> None:
        self.model = settings.openai_lesson_model
        self.settings = settings
        self.client = AsyncOpenAI(
            api_key=settings.openai_api_key, timeout=settings.openai_timeout_seconds, max_retries=0
        )
        self.inferred_title: str | None = None
        self.inferred_subject: str | None = None

    @staticmethod
    def _image_item(content: bytes, content_type: str, detail: str) -> dict[str, str]:
        encoded = base64.b64encode(content).decode("ascii")
        return {
            "type": "input_image",
            "image_url": f"data:{content_type};base64,{encoded}",
            "detail": detail,
        }

    async def generate(self, request: LessonGenerationRequest) -> LessonContent:
        brief = request.generation_brief
        if brief.sequence_style == "simple_recipe":
            response = await structured_response(
                self.client,
                self.model,
                [
                    {
                        "type": "input_text",
                        "text": (
                            recipe_contract(request.recipe_version)[2]
                            + f"Title hint: {request.title}. Subject: {request.subject or 'infer from image'}."
                        ),
                    },
                    self._image_item(request.primary_image, request.primary_content_type, "high"),
                ],
                PaintingRecipe,
                min(2400, self.settings.openai_text_max_output_tokens),
                "session_text",
            )
            if response is None:
                raise RuntimeError("No painting recipe was returned.")
            self.inferred_title = response.inferred_title
            self.inferred_subject = response.inferred_subject
            return recipe_content(
                response, request.estimated_duration_minutes, request.recipe_version
            )
        if brief.sequence_style == "layer_study":
            expected_phases = layer_study_phases(brief.stage_count)
            phase_direction = (
                "This is a layer-by-layer process study. Assign process_phase values in this exact order: "
                f"{', '.join(expected_phases)}. The first checkpoint must be a dry-paper, transferable "
                "contour drawing for a representational subject or a sparse placement/value map for an "
                "abstract subject. Each later checkpoint describes only physical additions to the same "
                "sheet of paper: light washes before middle values, middle values before connected darks, "
                "and final accents last. Never move a form, remove established paint, introduce later detail "
                "early, or make a later checkpoint visually simpler. The finished_target checkpoint must be last. "
            )
        else:
            expected_phases = []
            phase_direction = "This is an illustrative progression. Set process_phase to null for every checkpoint. "
        prompt = (
            "Create a practical transparent-watercolor lesson from the approved finished target. "
            "Teach deliberate simplification, staging, value masses, reflected light, atmosphere, edge variety, and mark-making. "
            "Use warm, encouraging studio language and concrete painting actions. Call this a painting session and each checkpoint a step in user-facing prose. Explain unfamiliar terms simply. Do not merely describe the image. "
            "For every stage, write one checkpoint_action sentence of at most 180 characters and "
            "two or three approach_steps of at most 180 characters each. The action names the one "
            "dominant visible goal; the steps explain how to reach it without repeating palette or overview prose. "
            "Do not prefix stage titles with a stage number because the interface supplies numbering. "
            "List only pigments introduced or actively used in each checkpoint's palette_mix_ids. "
            f"{phase_direction}"
            f"Title hint: {request.title}. Subject/location: {request.subject or 'infer from image'}. "
            f"Intention: {request.artistic_context or 'none supplied'}. Difficulty: {request.difficulty}. "
            f"Active duration: {request.estimated_duration_minutes} minutes."
            f" Return exactly {brief.stage_count} cumulative painting stages. "
            f"Mood and teaching tone: {brief.custom_mood or brief.mood}. "
            f"Background direction: {brief.custom_background or brief.background}. "
            f"Watercolor treatment: {brief.custom_treatment or brief.treatment}. "
            f"Additional direction: {brief.additional_direction or 'none supplied'}."
        )
        items: list[dict[str, str]] = [{"type": "input_text", "text": prompt}]
        items.append(self._image_item(request.primary_image, request.primary_content_type, "high"))
        items.extend(self._image_item(data, mime, "low") for data, mime in request.secondary_images)
        response = await structured_response(
            self.client,
            self.model,
            items,
            GeneratedLessonResponse,
            self.settings.openai_text_max_output_tokens,
            "session_text",
        )
        if response is None:
            raise RuntimeError("The OpenAI lesson provider returned no structured lesson.")
        self.inferred_title = response.inferred_title
        self.inferred_subject = response.inferred_subject
        content = LessonContent.model_validate(response.content.model_dump(mode="json"))
        if len(content.stages) != brief.stage_count:
            raise RuntimeError(
                f"The lesson provider returned {len(content.stages)} stages; "
                f"{brief.stage_count} were requested."
            )
        if brief.sequence_style == "layer_study":
            actual_phases = [stage.process_phase for stage in content.stages]
            if actual_phases != expected_phases:
                raise RuntimeError(
                    "The lesson provider returned an invalid layer-study phase sequence: "
                    f"{actual_phases}; expected {expected_phases}."
                )
        return content

    async def regenerate(
        self, request: LessonGenerationRequest, content: LessonContent, section_key: str
    ) -> object:
        if section_key == "user_notes":
            raise ValueError("Your notes are yours to write.")
        field_type: Any
        context: dict[str, Any]
        is_stage = section_key.startswith("stages.")
        if is_stage:
            field_type = GeneratedLessonStage
            current = next(
                stage for stage in content.stages if stage.id == section_key.split(".", 1)[1]
            )
            context = {
                "stage": current.model_dump(mode="json"),
                "palette": [mix.model_dump(mode="json") for mix in content.palette],
                "overview": content.overview,
            }
        else:
            if section_key == "stages":
                raise ValueError("Change the step count from the preview first.")
            field = GeneratedLessonContent.model_fields[section_key]
            field_type = (
                list[RecipeMix]
                if section_key == "palette"
                and request.generation_brief.sequence_style == "simple_recipe"
                else field.annotation
            )
            context = {
                "current": generated_section(content, section_key),
                "overview": content.overview,
                "steps": [
                    {"id": stage.id, "title": stage.title, "palette_mix_ids": stage.palette_mix_ids}
                    for stage in content.stages
                ],
            }
        response_type = create_model(
            "SessionSectionResponse", __base__=BaseModel, value=(field_type, ...)
        )
        prompt = f"Rewrite only {section_key} for this painting session. Use warm, concise instructions. Preserve all IDs, palette references, and process phases. Return only the requested section. Context: {json.dumps(context)}"
        items = [
            {"type": "input_text", "text": prompt},
            self._image_item(request.primary_image, request.primary_content_type, "high"),
        ]
        parsed = await structured_response(
            self.client,
            self.model,
            items,
            response_type,
            self.settings.openai_section_max_output_tokens,
            "section_text",
        )
        value = parsed.model_dump(mode="json")["value"]
        candidate = content.model_dump(mode="json")
        if is_stage:
            if value["id"] != current.id or value.get("process_phase") != current.process_phase:
                raise ValueError("The new step changed its identity or painting order.")
            candidate["stages"] = [
                value if stage["id"] == current.id else stage for stage in candidate["stages"]
            ]
        else:
            candidate[section_key] = value
        if section_key == "palette" and [mix["id"] for mix in value] != [
            mix.id for mix in content.palette
        ]:
            raise ValueError("The new palette changed its existing paint mix IDs.")
        if is_stage and value["palette_mix_ids"] != current.palette_mix_ids:
            raise ValueError("The new step changed its paint mix references.")
        validated = LessonContent.model_validate(candidate)
        return generated_section(validated, section_key)


class OpenAIStudyImageProvider:
    def __init__(self, settings: Settings) -> None:
        self.model = settings.openai_image_model
        self.validation_model = settings.openai_lesson_model
        self.settings = settings
        self.client = AsyncOpenAI(
            api_key=settings.openai_api_key, timeout=settings.openai_timeout_seconds, max_retries=0
        )

    @staticmethod
    def _source(image: bytes, content_type: str, index: int = 0) -> tuple[str, bytes, str]:
        extensions = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
        extension = extensions.get(content_type)
        if extension is None:
            raise ValueError("Study image input must be JPEG, PNG, or WebP.")
        return (f"reference-{index + 1}.{extension}", image, content_type)

    @staticmethod
    def _decode(response: Any) -> tuple[bytes, str]:
        if not response.data:
            raise RuntimeError("The image provider returned no image data.")
        encoded = response.data[0].b64_json
        if not encoded:
            raise RuntimeError("The image provider returned no image data.")
        return base64.b64decode(encoded), "image/png"

    async def generate(self, images: list[tuple[bytes, str]], prompt: str) -> tuple[bytes, str]:
        if not images:
            return await self.generate_from_prompt(prompt)
        sources = [self._source(image, mime, index) for index, (image, mime) in enumerate(images)]
        response = await measured_call(
            self.model,
            "image_edit",
            {"size": "1536x1024", "quality": "medium", "input_images": len(images)},
            lambda: self.client.images.edit(
                model=self.model,
                image=sources[0] if len(sources) == 1 else sources,
                prompt=prompt,
                size="1536x1024",
                quality="medium",
            ),
        )
        return self._decode(response)

    async def generate_from_prompt(self, prompt: str) -> tuple[bytes, str]:
        response = await measured_call(
            self.model,
            "image_generation",
            {"size": "1536x1024", "quality": "medium"},
            lambda: self.client.images.generate(
                model=self.model,
                prompt=prompt,
                size="1536x1024",
                quality="medium",
            ),
        )
        return self._decode(response)

    async def validate_process_board(
        self, images: list[tuple[bytes, str]], prompt: str
    ) -> ProcessBoardValidation:
        if not images:
            raise ValueError("Process-board validation requires at least one image.")
        items: list[dict[str, str]] = [{"type": "input_text", "text": prompt}]
        for index, (data, mime) in enumerate(images):
            encoded = base64.b64encode(data).decode("ascii")
            items.append(
                {
                    "type": "input_image",
                    "image_url": f"data:{mime};base64,{encoded}",
                    "detail": "high" if index == 0 else "low",
                }
            )
        response = await structured_response(
            self.client,
            self.validation_model,
            items,
            ProcessBoardValidation,
            self.settings.openai_validation_max_output_tokens,
            "board_validation",
        )
        if response is None:
            raise RuntimeError("The image provider returned no process-board validation.")
        return ProcessBoardValidation.model_validate(response)


def lesson_provider(settings: Settings) -> LessonTextProvider:
    if settings.lesson_generation_provider == "demo":
        return DemoLessonProvider()
    if settings.openai_api_key:
        return OpenAILessonProvider(settings)
    if settings.lesson_generation_provider == "openai":
        return UnconfiguredOpenAIProvider(settings)
    return DemoLessonProvider()


def image_generation_available(settings: Settings) -> bool:
    return settings.lesson_generation_provider != "demo" and bool(settings.openai_api_key)


async def structured_response(
    client: Any,
    model: str,
    items: list[dict[str, str]],
    schema: type[BaseModel],
    limit: int,
    operation: str,
) -> Any:
    # Receive and account for the raw response before local schema validation.
    response = await measured_call(
        model,
        operation,
        {"max_output_tokens": limit},
        lambda: client.responses.create(
            model=model,
            input=[
                {
                    "role": "developer",
                    "content": [
                        {
                            "type": "input_text",
                            "text": "You are Wanderline, a warm creative studio companion. Give concise, specific guidance for painting on paper. Preserve the supplied structure and personal intentions.",
                        }
                    ],
                },
                {"role": "user", "content": items},
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": schema.__name__,
                    "strict": True,
                    "schema": to_strict_json_schema(schema),
                }
            },
            max_output_tokens=limit,
            store=False,
        ),
    )
    if response.status != "completed" or not response.output_text:
        raise RuntimeError("The painting guidance was incomplete. Your saved session is unchanged.")
    return schema.model_validate_json(response.output_text)
