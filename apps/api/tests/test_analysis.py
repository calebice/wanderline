from io import BytesIO
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import numpy as np
import pytest
from fastapi import UploadFile
from PIL import Image, ImageDraw
from pillow_heif import register_heif_opener
from starlette.datastructures import Headers

from app.analysis import (
    InvalidSketchError,
    LocalCvAnalysisProvider,
    LocalShapeDecompositionProvider,
    validate_sketch,
)
from app.config import Settings
from app.models import Analysis, Sketch
from app.services import SketchAnalysisService


def sketch_bytes() -> bytes:
    image = Image.new("RGB", (240, 180), "white")
    drawing = ImageDraw.Draw(image)
    drawing.rectangle((45, 35, 195, 145), outline="black", width=4)
    drawing.line((45, 35, 195, 145), fill="black", width=3)
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def heif_sketch_bytes() -> bytes:
    register_heif_opener()
    image = Image.new("RGB", (120, 90), "white")
    ImageDraw.Draw(image).line((10, 10, 110, 80), fill="black", width=3)
    output = BytesIO()
    image.save(output, format="HEIF")
    return output.getvalue()


def house_reference_bytes() -> bytes:
    image = Image.new("RGB", (600, 500), "#f4f0e8")
    drawing = ImageDraw.Draw(image)
    drawing.rectangle((170, 220, 430, 430), fill="#bf765e", outline="#30302b", width=8)
    drawing.polygon(
        [(140, 225), (300, 80), (460, 225)],
        fill="#617b69",
        outline="#30302b",
    )
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def flower_masses_reference_bytes() -> bytes:
    image = Image.new("RGB", (640, 520), "#d8d6c8")
    drawing = ImageDraw.Draw(image)
    drawing.polygon([(305, 500), (292, 500), (310, 210), (324, 210)], fill="#3f5547")
    drawing.ellipse((210, 155, 345, 285), fill="#d9674f")
    drawing.ellipse((285, 100, 425, 250), fill="#e57a58")
    drawing.ellipse((335, 165, 490, 300), fill="#ca5746")
    drawing.ellipse((245, 205, 380, 325), fill="#ed8660")
    drawing.ellipse((285, 355, 405, 405), fill="#788f75")
    drawing.ellipse((170, 390, 290, 440), fill="#607b64")
    drawing.ellipse((305, 205, 355, 255), fill="#2e332c")
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def test_validates_signature_and_analyzes_stroke_signals() -> None:
    validated = validate_sketch(sketch_bytes(), "image/png", max_pixels=1_000_000)
    result = LocalCvAnalysisProvider().analyze(validated)

    assert validated.width == 240
    assert validated.height == 180
    assert result.metrics["edge_density"] > 0
    assert result.metrics["stroke_fragmentation"] >= 0
    assert result.metrics["dominant_line_angles"]
    assert 0 <= result.metrics["left_right_balance"] <= 1
    assert 0 <= result.metrics["mirror_similarity"] <= 1
    assert result.metrics["annotations"]
    assert {annotation["id"] for annotation in result.metrics["annotations"]} >= {
        "drawing-footprint",
        "visual-center",
    }
    assert len(result.metrics["value_histogram"]) == 10
    assert result.strengths
    assert result.improvements
    assert "not an objective grade" in result.summary


def test_builds_subject_aware_coaching_without_claiming_part_detection() -> None:
    validated = validate_sketch(sketch_bytes(), "image/png", max_pixels=1_000_000)
    profile = (
        LocalCvAnalysisProvider()
        .analyze(validated, "Acoustic guitar viewed head-on")
        .metrics["coaching_profile"]
    )

    assert profile["calculation_version"] == "local_cv_coaching_v1"
    assert profile["target"]["label"] == "Acoustic guitar viewed head-on"
    assert {score["id"] for score in profile["scores"]} >= {
        "penmanship",
        "line-confidence",
        "value-development",
        "subject-structure",
    }
    assert [area["priority"] for area in profile["focus_areas"]] == [1, 2, 3]
    assert {check["label"] for check in profile["subject_checks"]} >= {
        "Centerline",
        "Major proportions",
        "Repeated spacing",
    }
    assert "does not semantically locate" in profile["limitations"]


def test_rejects_mime_type_that_does_not_match_signature() -> None:
    with pytest.raises(InvalidSketchError, match="do not match"):
        validate_sketch(sketch_bytes(), "image/jpeg", max_pixels=1_000_000)


def test_accepts_mislabeled_apple_heif_export_and_normalizes_to_jpeg() -> None:
    validated = validate_sketch(heif_sketch_bytes(), "image/jpeg", max_pixels=1_000_000)

    assert validated.content_type == "image/jpeg"
    assert validated.content.startswith(b"\xff\xd8\xff")
    assert (validated.width, validated.height) == (120, 90)


@pytest.mark.parametrize(
    ("filename", "claimed_type"),
    [
        ("IMG_3838.HEIC", "image/heic"),
        ("IMG_3838.jpg", "image/jpeg"),
        ("guitar.heic", "image/heic"),
    ],
)
def test_real_airdropped_iphone_exports_are_normalized(filename: str, claimed_type: str) -> None:
    photo = Path(__file__).parents[3] / "docs" / "photos" / filename
    if not photo.exists():
        pytest.skip("Repository photo fixtures are not mounted in this environment.")

    validated = validate_sketch(photo.read_bytes(), claimed_type, max_pixels=24_000_000)

    assert validated.content_type == "image/jpeg"
    assert validated.content.startswith(b"\xff\xd8\xff")
    assert (validated.width, validated.height) == (3024, 4032)
    metrics = LocalCvAnalysisProvider().analyze(validated).metrics
    assert 0.4 < metrics["bounding_box_occupancy"] < 0.85
    assert metrics["stroke_fragmentation"] < 5


def test_rejects_oversized_pixel_dimensions() -> None:
    with pytest.raises(InvalidSketchError, match="dimensions are too large"):
        validate_sketch(sketch_bytes(), "image/png", max_pixels=100)


def test_blank_page_is_handled_without_division_errors() -> None:
    image = Image.new("L", (100, 100), "white")
    output = BytesIO()
    image.save(output, format="PNG")
    validated = validate_sketch(output.getvalue(), "image/png", max_pixels=100_000)
    result = LocalCvAnalysisProvider().analyze(validated)

    assert np.isfinite(result.metrics["stroke_fragmentation"])
    assert result.metrics["bounding_box_occupancy"] == 0


def test_decomposes_house_into_rectangle_and_triangle_without_semantic_labels() -> None:
    validated = validate_sketch(house_reference_bytes(), "image/png", max_pixels=1_000_000)
    result = LocalShapeDecompositionProvider().analyze(validated)
    decomposition = result.decomposition
    kinds = {shape["kind"] for shape in decomposition["shapes"]}

    assert decomposition["algorithm_version"] == "local_cv_shapes_v2"
    assert {"rectangle", "triangle"} <= kinds
    assert len(decomposition["levels"]["simple"]) <= 5
    assert len(decomposition["levels"]["medium"]) <= 10
    assert len(decomposition["levels"]["detailed"]) <= 20
    assert "roof" not in str(decomposition).casefold()
    assert "wall" not in str(decomposition).casefold()
    assert 0 < result.confidence <= 1


def test_block_in_groups_overlapping_round_masses_without_losing_long_structure() -> None:
    validated = validate_sketch(flower_masses_reference_bytes(), "image/png", max_pixels=1_000_000)
    decomposition = LocalShapeDecompositionProvider().analyze(validated).decomposition
    by_id = {shape["id"]: shape for shape in decomposition["shapes"]}
    block_in = [by_id[shape_id] for shape_id in decomposition["levels"]["simple"]]
    construction = [by_id[shape_id] for shape_id in decomposition["levels"]["medium"]]

    assert len(block_in) <= 5
    assert any(
        shape["kind"] in {"circle", "ellipse"}
        and shape["geometry"]["rx"] > 0.12
        and shape["geometry"]["ry"] > 0.1
        for shape in block_in
    )
    assert any(
        shape["geometry"]["type"] == "rotated_rect"
        and max(shape["geometry"]["width"], shape["geometry"]["height"])
        / min(shape["geometry"]["width"], shape["geometry"]["height"])
        > 4
        for shape in block_in
    )
    assert len(construction) > len(block_in)
    assert set(decomposition["levels"]["simple"]) != set(decomposition["levels"]["medium"])


def test_decomposition_warns_instead_of_inventing_shapes_for_blank_image() -> None:
    image = Image.new("RGB", (240, 180), "white")
    output = BytesIO()
    image.save(output, format="PNG")
    validated = validate_sketch(output.getvalue(), "image/png", max_pixels=100_000)
    decomposition = LocalShapeDecompositionProvider().analyze(validated).decomposition

    assert decomposition["shapes"] == []
    assert decomposition["warnings"]


def test_decomposition_geometry_is_normalized_and_deterministic() -> None:
    validated = validate_sketch(house_reference_bytes(), "image/png", max_pixels=1_000_000)
    provider = LocalShapeDecompositionProvider()
    first = provider.analyze(validated).decomposition
    second = provider.analyze(validated).decomposition

    assert first == second
    for shape in first["shapes"]:
        geometry = shape["geometry"]
        if "points" in geometry:
            assert all(
                0 <= point["x"] <= 1 and 0 <= point["y"] <= 1 for point in geometry["points"]
            )


def test_real_photo_decomposition_clamps_partial_fits_to_image_bounds() -> None:
    photo = Path(__file__).parents[3] / "docs" / "photos" / "IMG_3838.jpg"
    if not photo.exists():
        pytest.skip("Repository photo fixtures are not mounted in this environment.")
    validated = validate_sketch(photo.read_bytes(), "image/jpeg", max_pixels=24_000_000)
    shapes = LocalShapeDecompositionProvider().analyze(validated).decomposition["shapes"]

    assert shapes
    for shape in shapes:
        geometry = shape["geometry"]
        coordinate_values = [
            value for key, value in geometry.items() if key not in {"type", "rotation", "points"}
        ]
        assert all(0 <= value <= 1 for value in coordinate_values)
        assert all(
            0 <= coordinate <= 1
            for point in geometry.get("points", [])
            for coordinate in point.values()
        )


@pytest.mark.asyncio
async def test_service_flushes_sketch_before_persisting_analysis() -> None:
    storage = MagicMock()
    database = MagicMock()
    database.flush = AsyncMock()
    database.commit = AsyncMock()
    database.refresh = AsyncMock()
    upload = UploadFile(
        BytesIO(sketch_bytes()),
        filename="study.png",
        headers=Headers({"content-type": "image/png"}),
    )

    created = await SketchAnalysisService(Settings(), storage, database).create(upload, "A box")

    first_persisted = database.add.call_args_list[0].args[0]
    second_persisted = database.add.call_args_list[1].args[0]
    assert isinstance(first_persisted, Sketch)
    assert isinstance(second_persisted, Analysis)
    database.flush.assert_awaited_once_with()
    assert second_persisted.sketch_id == first_persisted.id
    storage.put.assert_called_once()
    assert created.sketch.actual_subject == "A box"
    assert created.analysis.metrics["coaching_profile"]["target"]["label"] == "A box"
