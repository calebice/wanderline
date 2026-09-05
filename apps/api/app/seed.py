import asyncio
from typing import Any

from sqlalchemy.dialects.postgresql import insert

from app.database import session_factory
from app.library_seed import LIBRARY_EXERCISES
from app.models import Exercise, LearnerProfile, LibraryExercise


def lesson(
    slug: str,
    title: str,
    skill: str,
    sequence: int,
    objective: str,
    concept: str,
    why: str,
    mistake: str,
    instructions: list[str],
    phases: list[tuple[str, int, str]],
    visual_kind: str,
    replay: str,
    *,
    reference_mode: str = "diagram",
    three_d_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "slug": slug,
        "title": title,
        "skill": skill,
        "difficulty": 1 if sequence <= 6 else 2,
        "duration_minutes": 15,
        "instructions": instructions,
        "completion_requirements": {"reflection": True},
        "reference_mode": reference_mode,
        "sequence_index": sequence,
        "week_number": ((sequence - 1) // 3) + 1,
        "objective": objective,
        "concept": concept,
        "why_it_matters": why,
        "common_mistake": mistake,
        "materials": ["Paper", "Pencil or pen", "A comfortable drawing surface"],
        "timed_phases": [
            {"label": label, "minutes": minutes, "instruction": instruction}
            for label, minutes, instruction in phases
        ],
        "visual_kind": visual_kind,
        "three_d_config": three_d_config,
        "replay_variation": replay,
    }


SEED_EXERCISES: list[dict[str, Any]] = [
    lesson(
        "confident-lines-001",
        "Confident Lines",
        "line_control",
        1,
        "Make deliberate straight marks from a planned start to a planned finish.",
        "A confident line is planned with the whole arm before it touches the page. Accuracy grows through committed attempts, not repeated corrections.",
        "Clear lines make every later shape easier to understand and revise.",
        "Slowly steering the pencil or tracing back over a line to hide a miss.",
        [
            "Place pairs of dots across the page.",
            "Ghost each path three times.",
            "Draw once with a smooth, committed motion.",
        ],
        [
            ("Prepare", 2, "Fill the page with pairs of start and end points."),
            ("Practice", 10, "Ghost and draw one line between each pair."),
            ("Notice", 3, "Circle three lines that felt most decisive."),
        ],
        "lines",
        "Use shorter dot pairs and ghost five times before each stroke.",
    ),
    lesson(
        "ellipses-shapes-001",
        "Ellipses & Simple Shapes",
        "shape_accuracy",
        2,
        "Draw circles, ellipses, and simple shapes with an even rhythm.",
        "Ellipses are circular forms seen at an angle. Drawing through them twice encourages a continuous motion instead of a cautious outline.",
        "Simple shapes are the vocabulary used to simplify everything you observe.",
        "Pinching the ends of an ellipse or slowing down to force it through every point.",
        [
            "Draw rows of loose circles.",
            "Add ellipses with different tilts.",
            "Place ellipses inside simple four-sided frames.",
        ],
        [
            ("Loosen", 3, "Draw circles from the shoulder without correcting them."),
            ("Practice", 9, "Draw through varied ellipses twice."),
            ("Compare", 3, "Mark the most even ellipse in each row."),
        ],
        "ellipses",
        "Draw larger ellipses in wide frames and focus only on a smooth motion.",
    ),
    lesson(
        "contour-observation-001",
        "Contour Observation",
        "observation",
        3,
        "Slow down your eyes and follow the changing edge of one object.",
        "Contour drawing links eye movement to hand movement. The goal is careful looking, not a polished outline.",
        "Observation improves when you spend more time looking at the subject than at the page.",
        "Drawing the object symbol you remember instead of tracing the specific edge you see.",
        [
            "Choose one nearby object.",
            "Follow its outer edge slowly with your eyes.",
            "Draw one continuous contour, then add two interior edges.",
        ],
        [
            ("Choose", 2, "Place a simple object beside the page."),
            ("Observe", 10, "Draw its contour while looking mostly at the object."),
            ("Notice", 3, "Write down one edge that surprised you."),
        ],
        "contour",
        "Use an object with a simpler silhouette and draw only its outer edge.",
    ),
    lesson(
        "comparative-measurement-001",
        "Comparative Measurement",
        "proportion",
        4,
        "Compare heights, widths, and alignments before drawing details.",
        "Proportion comes from relationships: one part can be twice another, or one landmark can align vertically with another.",
        "A few early comparisons prevent a drawing from drifting as details accumulate.",
        "Measuring each part in isolation instead of comparing it with a shared unit.",
        [
            "Choose a mug, bottle, or book.",
            "Use its width as one unit.",
            "Mark the overall height, width, and three landmarks before outlining.",
        ],
        [
            ("Measure", 4, "Compare the subject's height and width."),
            ("Place", 8, "Mark landmarks, then connect them with a light contour."),
            ("Check", 3, "Recheck the first ratio and note the difference."),
        ],
        "measure",
        "Use a rectangular object and compare only overall height to width.",
    ),
    lesson(
        "negative-space-001",
        "Negative-Space Observation",
        "observation",
        5,
        "Draw the empty shapes around and inside a subject.",
        "Negative space is the visible shape of the background. It provides a fresh set of boundaries when the subject feels too familiar.",
        "Drawing the space around an object can reveal proportion errors that object labels hide.",
        "Naming the subject's parts instead of treating each gap as a flat abstract shape.",
        [
            "Choose a chair, handle, or plant with visible gaps.",
            "Frame one empty shape with your fingers.",
            "Draw three surrounding spaces before adding the object edges.",
        ],
        [
            ("Frame", 3, "Find three clear background shapes."),
            ("Draw", 9, "Copy those empty shapes as flat silhouettes."),
            ("Reveal", 3, "Add the shared object edges and compare."),
        ],
        "negative-space",
        "Use the handle opening of a mug as one large negative shape.",
    ),
    lesson(
        "simplify-object-001",
        "Simplify an Everyday Object",
        "observation",
        6,
        "Reduce one object to a few large shapes before drawing its details.",
        "Complex subjects become manageable when you first identify their largest silhouette and two or three interior shapes.",
        "Simplification keeps attention on proportion and structure instead of decoration.",
        "Starting with small labels, texture, or seams before the large silhouette works.",
        [
            "Pick an object with two or three main parts.",
            "Sketch its largest shapes lightly.",
            "Refine only the overlaps that explain how the parts connect.",
        ],
        [
            ("Reduce", 3, "Name the two or three largest shapes."),
            ("Build", 9, "Place those shapes and refine their overlaps."),
            ("Edit", 3, "Remove or ignore details that do not clarify the form."),
        ],
        "simplify",
        "Use a spoon or key and limit the study to two large shapes.",
    ),
    lesson(
        "boxes-cylinders-001",
        "Boxes & Cylinders",
        "form_construction",
        7,
        "Turn flat shapes into boxes and cylinders that feel solid.",
        "A form has volume. Overlaps, converging edges, and ellipses show how its surfaces turn through space.",
        "Boxes and cylinders can construct a huge range of everyday subjects.",
        "Drawing each edge independently so corners and ellipses do not agree in space.",
        [
            "Orbit the reference and choose a view.",
            "Draw three boxes with visible sides.",
            "Add cylinders whose ellipses share one axis.",
        ],
        [
            ("Explore", 3, "Rotate the reference and notice which faces are visible."),
            ("Construct", 9, "Draw boxes and cylinders from two chosen views."),
            ("Check", 3, "Trace matching edge families with one color or pressure."),
        ],
        "forms",
        "Keep the reference near eye level and draw one box plus one cylinder.",
        reference_mode="3d",
        three_d_config={"shape": "box-cylinder", "controls": ["orbit", "reset", "edges"]},
    ),
    lesson(
        "perspective-rotation-001",
        "Perspective & Rotation",
        "perspective",
        8,
        "Observe how a box changes as it turns above and below eye level.",
        "Parallel edges in space appear to converge. Their direction changes predictably as a form rotates relative to your eye level.",
        "Perspective lets constructed objects share one believable space.",
        "Forcing every receding edge toward a visible page point instead of comparing its direction.",
        [
            "Set the 3D box above, at, and below eye level.",
            "Draw one quick box for each view.",
            "Extend receding edges lightly to inspect their families.",
        ],
        [
            ("Observe", 3, "Rotate the box and identify three edge families."),
            ("Rotate", 9, "Draw three views with different heights or turns."),
            ("Inspect", 3, "Extend edge families and notice their convergence."),
        ],
        "perspective",
        "Use one stationary box and draw only the three visible faces.",
        reference_mode="3d",
        three_d_config={"shape": "box", "controls": ["orbit", "reset", "edges", "grid"]},
    ),
    lesson(
        "constructed-object-001",
        "Construct a Household Object",
        "form_construction",
        9,
        "Build a familiar object by combining simple forms.",
        "Construction drawing treats a subject as connected volumes: a mug can be a cylinder, an attached loop, and a few turning edges.",
        "Thinking in volumes helps you invent, rotate, and correct objects instead of copying outlines.",
        "Adding the final contour before the underlying forms agree in size and orientation.",
        [
            "Choose a mug, lamp, or small appliance.",
            "Name its box, cylinder, and connector forms.",
            "Draw through the hidden forms lightly, then emphasize the visible contour.",
        ],
        [
            ("Decompose", 3, "Identify the subject's two or three main forms."),
            ("Construct", 9, "Build and connect the forms, including hidden edges."),
            ("Clarify", 3, "Darken only the contour needed to explain the object."),
        ],
        "construction",
        "Use a mug and omit the handle until the main cylinder feels solid.",
        reference_mode="3d",
        three_d_config={"shape": "box-cylinder", "controls": ["orbit", "reset", "edges"]},
    ),
    lesson(
        "light-value-001",
        "Light, Shadow & Five Values",
        "value",
        10,
        "Organize light and shadow into five clear value groups.",
        "Value describes relative lightness. Grouping many subtle changes into a few steps makes light direction and form easier to read.",
        "Clear value groups give flat shapes volume and make focal areas legible.",
        "Polishing smooth shading before deciding which planes belong to light or shadow.",
        [
            "Make a five-step scale from paper white to your darkest mark.",
            "Move the 3D light and choose one clear setup.",
            "Shade the form using only those five values.",
        ],
        [
            ("Scale", 4, "Build five distinct value boxes."),
            (
                "Study",
                8,
                "Group the lit form into light, halftone, core shadow, reflected light, and cast shadow.",
            ),
            ("Squint", 3, "Check whether the two largest value groups remain clear."),
        ],
        "values",
        "Use only three values: paper, middle, and darkest dark.",
        reference_mode="3d",
        three_d_config={"shape": "sphere", "controls": ["orbit", "light", "reset"]},
    ),
    lesson(
        "composition-cropping-001",
        "Composition & Cropping",
        "composition",
        11,
        "Explore several arrangements before committing to one drawing.",
        "A thumbnail is a tiny, fast plan for the placement of large shapes and values. Cropping changes emphasis before details begin.",
        "Small composition decisions determine where the eye enters, rests, and moves through a drawing.",
        "Making one large detailed attempt before comparing alternative placements.",
        [
            "Frame a simple arrangement with your hands.",
            "Draw six small rectangular thumbnails.",
            "Change crop, scale, and empty space in each; circle the clearest.",
        ],
        [
            ("Frame", 2, "Choose a simple object arrangement."),
            ("Vary", 10, "Make six thumbnails with different crops and placements."),
            ("Choose", 3, "Circle one and explain what it emphasizes."),
        ],
        "composition",
        "Make four thumbnails using only one dark shape and the paper white.",
    ),
    lesson(
        "capstone-observation-001",
        "Capstone Observation",
        "observation",
        12,
        "Bring proportion, construction, line, and value together in one small study.",
        "A finished practice study is a sequence of decisions: frame, measure, simplify, construct, clarify, and reflect.",
        "Combining the path's tools reveals which habits already feel natural and which deserve another pass.",
        "Trying to demonstrate every technique equally instead of choosing what best explains the subject.",
        [
            "Choose one everyday object in clear light.",
            "Frame and measure before drawing.",
            "Construct large forms, clarify the contour, then add only the most useful value group.",
        ],
        [
            ("Plan", 3, "Frame, measure, and place the largest shapes."),
            ("Draw", 9, "Construct the subject and add one clear light-shadow division."),
            ("Reflect", 3, "Name one decision you would repeat and one you would change."),
        ],
        "capstone",
        "Choose a single simple object and use only contour plus one shadow shape.",
    ),
]


async def seed() -> None:
    async with session_factory() as db:
        statement = insert(Exercise).values(SEED_EXERCISES)
        update_fields = {
            key: getattr(statement.excluded, key) for key in SEED_EXERCISES[0] if key != "slug"
        }
        await db.execute(
            statement.on_conflict_do_update(index_elements=["slug"], set_=update_fields)
        )
        learner_statement = insert(LearnerProfile).values(
            slug="local-learner", display_name="Artist", weekly_target=3
        )
        await db.execute(learner_statement.on_conflict_do_nothing(index_elements=["slug"]))
        library_statement = insert(LibraryExercise).values(LIBRARY_EXERCISES)
        library_updates = {
            key: getattr(library_statement.excluded, key)
            for key in LIBRARY_EXERCISES[0]
            if key != "slug"
        }
        await db.execute(
            library_statement.on_conflict_do_update(index_elements=["slug"], set_=library_updates)
        )
        await db.commit()


if __name__ == "__main__":
    asyncio.run(seed())
