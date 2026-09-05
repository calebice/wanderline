from dataclasses import dataclass
from io import BytesIO
from typing import Any

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener  # type: ignore[import-untyped]

register_heif_opener()

SUPPORTED_CLAIMED_TYPES = {
    "",
    "application/octet-stream",
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/heif",
}
SUPPORTED_DETECTED_TYPES = {"image/jpeg", "image/png", "image/heif", "image/mpo"}
HEIF_TYPES = {"image/heic", "image/heif"}
JPEG_TYPES = {"image/jpeg", "image/mpo"}


class InvalidSketchError(ValueError):
    pass


@dataclass(frozen=True)
class ValidatedSketch:
    content: bytes
    content_type: str
    width: int
    height: int
    grayscale: np.ndarray[Any, np.dtype[np.uint8]]
    rgb: np.ndarray[Any, np.dtype[np.uint8]]


@dataclass(frozen=True)
class LocalAnalysisResult:
    summary: str
    strengths: list[str]
    improvements: list[str]
    metrics: dict[str, Any]
    confidence: float


@dataclass(frozen=True)
class LocalDecompositionResult:
    summary: str
    decomposition: dict[str, Any]
    confidence: float


def validate_sketch(content: bytes, claimed_content_type: str, max_pixels: int) -> ValidatedSketch:
    if claimed_content_type not in SUPPORTED_CLAIMED_TYPES:
        raise InvalidSketchError("Only JPEG, PNG, and HEIC/HEIF sketches are supported.")
    try:
        with Image.open(BytesIO(content)) as source:
            source.verify()
        with Image.open(BytesIO(content)) as source:
            detected_type = Image.MIME.get(source.format or "")
            if detected_type not in SUPPORTED_DETECTED_TYPES:
                raise InvalidSketchError(
                    "The file signature is not a supported JPEG, PNG, or HEIC/HEIF image."
                )
            generic_claim = claimed_content_type in {"", "application/octet-stream"}
            matching_family = (
                claimed_content_type in HEIF_TYPES
                and detected_type in HEIF_TYPES
                or claimed_content_type == "image/jpeg"
                and detected_type in JPEG_TYPES
            )
            mislabeled_apple_export = (
                claimed_content_type == "image/jpeg" and detected_type in HEIF_TYPES
            )
            if (
                detected_type != claimed_content_type
                and not generic_claim
                and not matching_family
                and not mislabeled_apple_export
            ):
                raise InvalidSketchError("The file contents do not match the declared image type.")
            source = ImageOps.exif_transpose(source)
            width, height = source.size
            if width * height > max_pixels:
                raise InvalidSketchError("The image dimensions are too large to analyze safely.")
            rgba = source.convert("RGBA")
            background = Image.new("RGBA", rgba.size, "white")
            flattened = Image.alpha_composite(background, rgba).convert("RGB")
            rgb = np.asarray(flattened)
            grayscale = np.asarray(flattened.convert("L"))
            if detected_type in HEIF_TYPES or detected_type == "image/mpo":
                normalized = BytesIO()
                flattened.save(normalized, format="JPEG", quality=92, optimize=True)
                content = normalized.getvalue()
                detected_type = "image/jpeg"
    except (UnidentifiedImageError, OSError) as error:
        raise InvalidSketchError("The uploaded file is not a readable image.") from error
    return ValidatedSketch(content, detected_type, width, height, grayscale, rgb)


class LocalShapeDecompositionProvider:
    """Deterministically approximates a clear subject with drawable geometry."""

    name = "local_cv_shapes"
    algorithm_version = "local_cv_shapes_v2"
    max_analysis_edge = 1600

    def analyze(self, image: ValidatedSketch) -> LocalDecompositionResult:
        rgb = _resize_for_decomposition(image.rgb, self.max_analysis_edge)
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        height, width = gray.shape
        pixel_count = height * width
        contrast_low, contrast_high = np.percentile(gray, [5, 95])
        contrast = float((contrast_high - contrast_low) / 255)

        blurred = cv2.GaussianBlur(rgb, (5, 5), 0)
        quantized = np.asarray(
            Image.fromarray(blurred)
            .quantize(
                colors=14,
                method=Image.Quantize.MEDIANCUT,
            )
            .convert("RGB")
        )
        colors, labels = np.unique(quantized.reshape(-1, 3), axis=0, return_inverse=True)
        labels = labels.reshape(height, width)
        border_labels = np.concatenate((labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]))
        background_label = int(np.bincount(border_labels).argmax())

        kernel_size = max(3, round(min(height, width) / 180) | 1)
        kernel = np.ones((kernel_size, kernel_size), np.uint8)
        foreground = (labels != background_label).astype(np.uint8) * 255
        foreground = cv2.morphologyEx(foreground, cv2.MORPH_CLOSE, kernel)
        foreground = cv2.morphologyEx(foreground, cv2.MORPH_OPEN, kernel)

        edges = cv2.Canny(cv2.cvtColor(blurred, cv2.COLOR_RGB2GRAY), 45, 135)
        edge_kernel = np.ones((3, 3), np.uint8)
        closed_edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, edge_kernel, iterations=2)
        closed_edges = cv2.dilate(closed_edges, edge_kernel, iterations=1)

        minimum_area = max(24.0, pixel_count * 0.0015)
        maximum_area = pixel_count * 0.96
        contour_sources: list[tuple[np.ndarray[Any, Any], str]] = []
        for color_index in range(len(colors)):
            if color_index == background_label:
                continue
            mask = (labels == color_index).astype(np.uint8) * 255
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
            contour_sources.append((mask, "color_region"))

        raw_contour_count = 0
        candidates: list[dict[str, Any]] = []
        for mask, source in contour_sources:
            found, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            raw_contour_count += len(found)
            for contour in found:
                area = float(abs(cv2.contourArea(contour)))
                if not minimum_area <= area <= maximum_area:
                    continue
                candidate = _fit_decomposition_shape(
                    contour=contour,
                    rgb=rgb,
                    width=width,
                    height=height,
                    source=source,
                )
                if candidate is not None:
                    candidates.append(candidate)

        # Filled edge bands and a union of every non-background color are useful for finding a
        # last-resort silhouette, but they are poor decomposition parts. Only consult them when
        # color segmentation found no stable region; otherwise they create scene-sized ellipses
        # and spiky polygons that obscure the actual drawable masses.
        if not candidates:
            for mask, source in ((foreground, "silhouette"), (closed_edges, "edge_fallback")):
                found, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                raw_contour_count += len(found)
                for contour in found:
                    area = float(abs(cv2.contourArea(contour)))
                    if not minimum_area <= area <= maximum_area:
                        continue
                    candidate = _fit_decomposition_shape(
                        contour=contour,
                        rgb=rgb,
                        width=width,
                        height=height,
                        source=source,
                    )
                    if candidate is not None:
                        candidates.append(candidate)

        base_shapes = _deduplicate_decomposition_shapes(candidates, width, height)[:20]
        aggregate_shapes = _build_ellipse_cluster_shapes(base_shapes, width, height)
        shapes = (aggregate_shapes + base_shapes)[:20]
        for index, shape in enumerate(shapes):
            shape["id"] = f"shape-{index + 1}"
            shape["z_index"] = index

        warnings: list[str] = []
        foreground_share = float(np.count_nonzero(foreground) / pixel_count)
        edge_density = float(np.count_nonzero(edges) / pixel_count)
        if contrast < 0.12:
            warnings.append("The image has low contrast, so its boundaries may be incomplete.")
        if foreground_share < 0.025 or foreground_share > 0.9:
            warnings.append(
                "A single foreground subject could not be separated confidently from the background."
            )
        if raw_contour_count > 160 or edge_density > 0.18:
            warnings.append(
                "Fine texture or visual clutter produced many competing edges; smaller details were suppressed."
            )
        if not shapes:
            warnings.append(
                "No stable drawable region was found. Try a clearer subject with stronger separation."
            )

        base_ids = [str(shape["id"]) for shape in shapes if shape["_origin"] != "aggregate"]
        simple_ids: list[str] = []
        blocked_base_ids: set[str] = set()
        for shape in shapes:
            if shape["_origin"] != "aggregate":
                continue
            simple_ids.append(str(shape["id"]))
            blocked_base_ids.update(
                base_ids[index]
                for index in shape.get("_aggregate_member_positions", [])
                if index < len(base_ids)
            )
        simple_ids.extend(
            shape_id
            for shape_id in base_ids
            if shape_id not in blocked_base_ids and shape_id not in simple_ids
        )
        levels = {
            "simple": simple_ids[:5],
            "medium": base_ids[:10],
            "detailed": base_ids[:20],
        }
        drawing_steps = [
            {
                "order": index + 1,
                "shape_id": shape["id"],
                "instruction": (
                    f"Place the {str(shape['kind']).replace('_', ' ')} mass"
                    + (" first." if index == 0 else ".")
                ),
            }
            for index, shape in enumerate(shapes[:10])
        ]
        construction_hints = _build_construction_hints(
            [shape for shape in shapes if shape["_origin"] != "aggregate"]
        )
        confidence = (
            float(
                np.mean(
                    [
                        float(shape["confidence"])
                        for shape in shapes
                        if str(shape["id"]) in levels["simple"]
                    ]
                )
            )
            if levels["simple"]
            else 0.0
        )
        for shape in shapes:
            shape.pop("_bounds", None)
            shape.pop("_area", None)
            shape.pop("_origin", None)
            shape.pop("_aggregate_member_positions", None)
        summary = (
            "This local geometric study reduces visible regions to large drawable shapes. "
            "Labels describe geometry only, not recognized objects or parts."
        )
        return LocalDecompositionResult(
            summary=summary,
            decomposition={
                "algorithm_version": self.algorithm_version,
                "analysis_dimensions": {"width": width, "height": height},
                "shapes": shapes,
                "construction_hints": construction_hints,
                "levels": levels,
                "drawing_steps": drawing_steps,
                "warnings": warnings,
                "limitations": (
                    "Classical computer vision fits visible boundaries. It does not identify the "
                    "subject, understand object parts, or recover true three-dimensional structure."
                ),
            },
            confidence=round(confidence, 4),
        )


def _resize_for_decomposition(
    rgb: np.ndarray[Any, np.dtype[np.uint8]], max_edge: int
) -> np.ndarray[Any, np.dtype[np.uint8]]:
    height, width = rgb.shape[:2]
    longest = max(height, width)
    if longest <= max_edge:
        return rgb.copy()
    scale = max_edge / longest
    return np.asarray(
        cv2.resize(
            rgb,
            (max(1, round(width * scale)), max(1, round(height * scale))),
            interpolation=cv2.INTER_AREA,
        ),
        dtype=np.uint8,
    )


def _fit_decomposition_shape(
    *,
    contour: np.ndarray[Any, Any],
    rgb: np.ndarray[Any, np.dtype[np.uint8]],
    width: int,
    height: int,
    source: str,
) -> dict[str, Any] | None:
    area = float(abs(cv2.contourArea(contour)))
    perimeter = float(cv2.arcLength(contour, True))
    if perimeter <= 0 or area <= 0:
        return None
    contour_mask = np.zeros((height, width), np.uint8)
    cv2.drawContours(contour_mask, [contour], -1, 255, thickness=-1)
    approximated = cv2.approxPolyDP(contour, 0.025 * perimeter, True)
    while len(approximated) > 16:
        approximated = cv2.approxPolyDP(contour, 0.04 * perimeter, True)
        break

    fit_candidates: list[tuple[str, dict[str, Any], float, float]] = []
    points = approximated[:, 0, :]
    if len(points) == 3:
        geometry = {"type": "polygon", "points": _normalized_points(points, width, height)}
        fit_candidates.append(("triangle", geometry, _geometry_iou(contour_mask, geometry), 0.01))
    if len(points) == 4:
        geometry = {"type": "polygon", "points": _normalized_points(points, width, height)}
        kind = "rectangle" if _is_axis_aligned_rectangle(points) else "quadrilateral"
        fit_candidates.append((kind, geometry, _geometry_iou(contour_mask, geometry), 0.015))

    x, y, rect_width, rect_height = cv2.boundingRect(contour)
    rect_geometry = {
        "type": "rect",
        "x": _normalized_value(x / width),
        "y": _normalized_value(y / height),
        "width": _normalized_value(rect_width / width),
        "height": _normalized_value(rect_height / height),
    }
    fit_candidates.append(
        ("rectangle", rect_geometry, _geometry_iou(contour_mask, rect_geometry), 0.025)
    )

    rotated = cv2.minAreaRect(contour)
    box_points = cv2.boxPoints(rotated)
    rotated_geometry = {
        "type": "rotated_rect",
        "cx": _normalized_value(rotated[0][0] / width),
        "cy": _normalized_value(rotated[0][1] / height),
        "width": _normalized_value(rotated[1][0] / width),
        "height": _normalized_value(rotated[1][1] / height),
        "rotation": round(float(rotated[2]), 2),
        "points": _normalized_points(box_points, width, height),
    }
    fit_candidates.append(
        (
            "rotated_rectangle",
            rotated_geometry,
            _geometry_iou(contour_mask, rotated_geometry),
            0.025,
        )
    )

    if len(contour) >= 5:
        ellipse = cv2.fitEllipse(contour)
        major = max(ellipse[1])
        minor = min(ellipse[1])
        ellipse_geometry = {
            "type": "ellipse",
            "cx": _normalized_value(ellipse[0][0] / width),
            "cy": _normalized_value(ellipse[0][1] / height),
            "rx": _normalized_value(ellipse[1][0] / (2 * width)),
            "ry": _normalized_value(ellipse[1][1] / (2 * height)),
            "rotation": round(float(ellipse[2]), 2),
        }
        ellipse_kind = "circle" if major and minor / major >= 0.9 else "ellipse"
        fit_candidates.append(
            (
                ellipse_kind,
                ellipse_geometry,
                _geometry_iou(contour_mask, ellipse_geometry),
                0.02,
            )
        )

    best_kind, best_geometry, best_iou, _penalty = max(
        fit_candidates,
        key=lambda item: item[2] - item[3],
    )
    hull_area = float(cv2.contourArea(cv2.convexHull(contour)))
    solidity = area / hull_area if hull_area else 0.0
    fit_area_share = area / (width * height)
    fit_bounds_share = rect_width * rect_height / (width * height)
    fit_max_span = max(rect_width / width, rect_height / height)
    if best_kind in {"circle", "ellipse"}:
        fitted_threshold = (
            0.68
            if solidity >= 0.84
            and fit_area_share <= 0.18
            and fit_bounds_share <= 0.3
            and fit_max_span <= 0.55
            else 0.79
        )
    elif best_kind in {"triangle", "rectangle", "quadrilateral"}:
        fitted_threshold = 0.71
    else:
        fitted_threshold = 0.74
    if best_iou < fitted_threshold:
        best_kind = "polygon"
        best_geometry = {
            "type": "polygon",
            "points": _normalized_points(approximated[:, 0, :], width, height),
        }
        best_iou = _geometry_iou(contour_mask, best_geometry)
        fit_source = "fallback"
    else:
        fit_source = "fitted"

    pixels = rgb[contour_mask > 0]
    median = np.median(pixels, axis=0) if len(pixels) else np.array([190, 190, 185])
    color = "#" + "".join(f"{int(channel):02x}" for channel in median)
    bx, by, bw, bh = cv2.boundingRect(contour)
    area_share = area / (width * height)
    source_weight = 0.78 if source == "edge_fallback" else 0.9 if source == "silhouette" else 0.96
    confidence = max(0.2, min(0.98, best_iou * source_weight))
    bounds_share = (bw * bh) / (width * height)
    extent_score = min(1.0, np.sqrt((area_share + bounds_share * 0.12) / 0.2))
    elongation = max(bw / max(1, bh), bh / max(1, bw))
    long_structure_bonus = (
        0.14
        if elongation >= 4 and max(bw / width, bh / height) >= 0.28 and area_share < 0.08
        else 0.0
    )
    importance = min(
        1.0,
        float(extent_score) * 0.58
        + confidence * 0.34
        + (0.08 if fit_source == "fitted" else 0.0)
        + long_structure_bonus,
    )
    return {
        "id": "",
        "kind": best_kind,
        "geometry": best_geometry,
        "color": color,
        "importance": round(importance, 4),
        "confidence": round(confidence, 4),
        "z_index": 0,
        "source": fit_source,
        "_origin": source,
        "_bounds": (bx, by, bw, bh),
        "_area": area,
    }


def _normalized_points(
    points: np.ndarray[Any, np.dtype[Any]], width: int, height: int
) -> list[dict[str, float]]:
    return [
        {
            "x": _normalized_value(float(point[0]) / width),
            "y": _normalized_value(float(point[1]) / height),
        }
        for point in points
    ]


def _normalized_value(value: float) -> float:
    return round(max(0.0, min(1.0, value)), 5)


def _geometry_iou(target: np.ndarray[Any, np.dtype[np.uint8]], geometry: dict[str, Any]) -> float:
    height, width = target.shape
    candidate = np.zeros_like(target)
    geometry_type = geometry["type"]
    if geometry_type == "rect":
        x1 = round(float(geometry["x"]) * width)
        y1 = round(float(geometry["y"]) * height)
        x2 = round((float(geometry["x"]) + float(geometry["width"])) * width)
        y2 = round((float(geometry["y"]) + float(geometry["height"])) * height)
        cv2.rectangle(candidate, (x1, y1), (x2, y2), 255, -1)
    elif geometry_type == "ellipse":
        center = (round(float(geometry["cx"]) * width), round(float(geometry["cy"]) * height))
        axes = (
            max(1, round(float(geometry["rx"]) * width)),
            max(1, round(float(geometry["ry"]) * height)),
        )
        cv2.ellipse(candidate, center, axes, float(geometry["rotation"]), 0, 360, 255, -1)
    else:
        points = np.array(
            [
                [round(float(point["x"]) * width), round(float(point["y"]) * height)]
                for point in geometry["points"]
            ],
            dtype=np.int32,
        )
        cv2.fillPoly(candidate, [points], 255)
    intersection = int(np.count_nonzero((target > 0) & (candidate > 0)))
    union = int(np.count_nonzero((target > 0) | (candidate > 0)))
    return float(intersection / union) if union else 0.0


def _is_axis_aligned_rectangle(points: np.ndarray[Any, np.dtype[Any]]) -> bool:
    edges = np.roll(points, -1, axis=0) - points
    angles = np.degrees(np.arctan2(edges[:, 1], edges[:, 0])) % 90
    return bool(np.all((angles < 8) | (angles > 82)))


def _build_ellipse_cluster_shapes(
    shapes: list[dict[str, Any]], width: int, height: int
) -> list[dict[str, Any]]:
    eligible = [
        index
        for index, shape in enumerate(shapes)
        if shape["kind"] in {"circle", "ellipse"}
        and float(shape["_area"]) / (width * height) >= 0.004
    ]
    neighbors: dict[int, set[int]] = {index: set() for index in eligible}
    padding = max(2, round(min(width, height) * 0.012))
    for position, first_index in enumerate(eligible):
        for second_index in eligible[position + 1 :]:
            if _expanded_bounds_overlap(
                shapes[first_index]["_bounds"], shapes[second_index]["_bounds"], padding
            ):
                neighbors[first_index].add(second_index)
                neighbors[second_index].add(first_index)

    clusters: list[list[int]] = []
    unseen = set(eligible)
    while unseen:
        start = unseen.pop()
        component = [start]
        pending = [start]
        while pending:
            current = pending.pop()
            connected = neighbors[current] & unseen
            unseen.difference_update(connected)
            pending.extend(connected)
            component.extend(connected)
        if len(component) >= 3:
            clusters.append(sorted(component))

    aggregates: list[dict[str, Any]] = []
    for component in clusters[:2]:
        members = [shapes[index] for index in component]
        x1 = min(int(shape["_bounds"][0]) for shape in members)
        y1 = min(int(shape["_bounds"][1]) for shape in members)
        x2 = max(int(shape["_bounds"][0] + shape["_bounds"][2]) for shape in members)
        y2 = max(int(shape["_bounds"][1] + shape["_bounds"][3]) for shape in members)
        cluster_width = x2 - x1
        cluster_height = y2 - y1
        if cluster_width / width > 0.68 or cluster_height / height > 0.68:
            continue
        member_colors = np.array(
            [
                [int(str(shape["color"])[offset : offset + 2], 16) for offset in (1, 3, 5)]
                for shape in members
            ]
        )
        median_color = np.median(member_colors, axis=0)
        geometry = {
            "type": "ellipse",
            "cx": _normalized_value((x1 + cluster_width / 2) / width),
            "cy": _normalized_value((y1 + cluster_height / 2) / height),
            "rx": _normalized_value(cluster_width / (2 * width)),
            "ry": _normalized_value(cluster_height / (2 * height)),
            "rotation": 0.0,
        }
        aspect_ratio = min(cluster_width, cluster_height) / max(cluster_width, cluster_height)
        confidence = float(np.mean([float(shape["confidence"]) for shape in members])) * 0.76
        aggregates.append(
            {
                "id": "",
                "kind": "circle" if aspect_ratio >= 0.9 else "ellipse",
                "geometry": geometry,
                "color": "#" + "".join(f"{int(channel):02x}" for channel in median_color),
                "importance": round(
                    min(1.0, max(float(shape["importance"]) for shape in members) + 0.16),
                    4,
                ),
                "confidence": round(max(0.45, min(0.82, confidence)), 4),
                "z_index": 0,
                "source": "fallback",
                "_origin": "aggregate",
                "_bounds": (x1, y1, cluster_width, cluster_height),
                "_area": float(np.pi * cluster_width * cluster_height / 4),
                "_aggregate_member_positions": component,
            }
        )
    return aggregates


def _expanded_bounds_overlap(
    first: tuple[int, int, int, int], second: tuple[int, int, int, int], padding: int
) -> bool:
    ax, ay, aw, ah = first
    bx, by, bw, bh = second
    return not (
        ax + aw + padding < bx
        or bx + bw + padding < ax
        or ay + ah + padding < by
        or by + bh + padding < ay
    )


def _deduplicate_decomposition_shapes(
    candidates: list[dict[str, Any]], width: int, height: int
) -> list[dict[str, Any]]:
    ordered = sorted(
        candidates,
        key=lambda item: (float(item["importance"]), float(item["confidence"])),
        reverse=True,
    )
    kept: list[dict[str, Any]] = []
    for candidate in ordered:
        if any(_is_duplicate_candidate(candidate, item) for item in kept):
            continue
        if float(candidate["_area"]) / (width * height) < 0.002:
            continue
        kept.append(candidate)
        if len(kept) >= 20:
            break
    kept.sort(key=lambda item: (float(item["importance"]), float(item["_area"])), reverse=True)
    return kept


def _is_duplicate_candidate(first: dict[str, Any], second: dict[str, Any]) -> bool:
    bounds_iou = _bounds_iou(first["_bounds"], second["_bounds"])
    area_ratio = min(float(first["_area"]), float(second["_area"])) / max(
        float(first["_area"]), float(second["_area"])
    )
    return bounds_iou > 0.72 and area_ratio > 0.58


def _bounds_iou(first: tuple[int, int, int, int], second: tuple[int, int, int, int]) -> float:
    ax, ay, aw, ah = first
    bx, by, bw, bh = second
    intersection_width = max(0, min(ax + aw, bx + bw) - max(ax, bx))
    intersection_height = max(0, min(ay + ah, by + bh) - max(ay, by))
    intersection = intersection_width * intersection_height
    union = aw * ah + bw * bh - intersection
    return float(intersection / union) if union else 0.0


def _build_construction_hints(shapes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    hints: list[dict[str, Any]] = []
    for shape in shapes:
        geometry = shape["geometry"]
        if shape["kind"] == "circle" and float(shape["confidence"]) >= 0.78:
            cx = float(geometry["cx"])
            cy = float(geometry["cy"])
            rx = float(geometry["rx"])
            ry = float(geometry["ry"])
            hints.append(
                {
                    "id": f"hint-{len(hints) + 1}",
                    "kind": "sphere_like",
                    "member_shape_ids": [shape["id"]],
                    "confidence": round(float(shape["confidence"]) * 0.88, 4),
                    "guides": [
                        {
                            "type": "ellipse",
                            "cx": cx,
                            "cy": cy,
                            "rx": rx,
                            "ry": round(ry * 0.28, 5),
                            "rotation": 0.0,
                        },
                        {
                            "type": "line",
                            "x1": cx,
                            "y1": max(0.0, cy - ry),
                            "x2": cx,
                            "y2": min(1.0, cy + ry),
                        },
                    ],
                }
            )
        if len(hints) >= 6:
            break
    return hints


class LocalCvAnalysisProvider:
    name = "local_cv"

    def analyze(
        self,
        sketch: ValidatedSketch,
        subject_context: str | None = None,
    ) -> LocalAnalysisResult:
        gray = sketch.grayscale
        pixel_count = gray.size
        contrast_low, contrast_high = np.percentile(gray, [5, 95])
        contrast_range = float((contrast_high - contrast_low) / 255)
        edges = cv2.Canny(gray, 60, 160)
        edge_density = float(np.count_nonzero(edges) / pixel_count)

        density_window = max(15, min(gray.shape) // 50)
        local_edge_density = cv2.blur(
            (edges > 0).astype(np.float32),
            (density_window, density_window),
        )
        ink_points = cv2.findNonZero((local_edge_density > 0.025).astype(np.uint8))
        if ink_points is None:
            occupancy = 0.0
            footprint = {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0}
            visual_center = {"x": 0.5, "y": 0.5}
        else:
            ink_x, ink_y, ink_width, ink_height = cv2.boundingRect(ink_points)
            occupancy = float((ink_width * ink_height) / pixel_count)
            footprint = {
                "x": round(ink_x / gray.shape[1], 4),
                "y": round(ink_y / gray.shape[0], 4),
                "width": round(ink_width / gray.shape[1], 4),
                "height": round(ink_height / gray.shape[0], 4),
            }
            mean_x, mean_y = np.mean(ink_points[:, 0, :], axis=0)
            visual_center = {
                "x": round(float(mean_x / gray.shape[1]), 4),
                "y": round(float(mean_y / gray.shape[0]), 4),
            }

        center_offset = float(
            np.hypot(visual_center["x"] - 0.5, visual_center["y"] - 0.5) / np.hypot(0.5, 0.5)
        )
        left_edges = int(np.count_nonzero(edges[:, : gray.shape[1] // 2]))
        right_edges = int(np.count_nonzero(edges[:, gray.shape[1] // 2 :]))
        top_edges = int(np.count_nonzero(edges[: gray.shape[0] // 2, :]))
        bottom_edges = int(np.count_nonzero(edges[gray.shape[0] // 2 :, :]))
        left_right_balance = _balance_ratio(left_edges, right_edges)
        top_bottom_balance = _balance_ratio(top_edges, bottom_edges)

        edge_cells = np.array(
            [
                [np.count_nonzero(cell) for cell in np.array_split(row, 3, axis=1)]
                for row in np.array_split(edges, 3, axis=0)
            ]
        )
        hotspot_row, hotspot_column = np.unravel_index(np.argmax(edge_cells), edge_cells.shape)
        edge_hotspot = {
            "x": round(float(hotspot_column / 3), 4),
            "y": round(float(hotspot_row / 3), 4),
            "width": round(1 / 3, 4),
            "height": round(1 / 3, 4),
        }

        signal = (local_edge_density > 0.025).astype(np.uint8)
        left_signal = signal[:, : signal.shape[1] // 2]
        right_signal = np.asarray(
            cv2.flip(signal[:, signal.shape[1] - left_signal.shape[1] :], 1),
            dtype=np.uint8,
        )
        overlap = int(np.count_nonzero(left_signal & right_signal))
        union = int(np.count_nonzero(left_signal | right_signal))
        mirror_similarity = float(overlap / union) if union else 0.0

        component_count, _, component_stats, _ = cv2.connectedComponentsWithStats(
            (edges > 0).astype(np.uint8), connectivity=8
        )
        minimum_component_area = max(4, pixel_count // 100_000)
        meaningful_components = (
            int(np.count_nonzero(component_stats[1:, cv2.CC_STAT_AREA] >= minimum_component_area))
            if component_count > 1
            else 0
        )
        fragmentation = float(meaningful_components / max(1, np.count_nonzero(edges) / 1000))

        lines = cv2.HoughLinesP(
            edges,
            rho=1,
            theta=np.pi / 180,
            threshold=max(15, min(gray.shape) // 15),
            minLineLength=max(10, min(gray.shape) // 20),
            maxLineGap=max(3, min(gray.shape) // 100),
        )
        angles: list[float] = []
        line_lengths: list[float] = []
        if lines is not None:
            for x1, y1, x2, y2 in lines[:, 0]:
                angle = float(np.degrees(np.arctan2(y2 - y1, x2 - x1)) % 180)
                angles.append(round(angle, 1))
                line_lengths.append(float(np.hypot(x2 - x1, y2 - y1)))
        dominant_angles = _dominant_angle_bins(angles)
        dominant_direction_share = _dominant_direction_share(angles, line_lengths)
        histogram, _ = np.histogram(gray, bins=10, range=(0, 256))
        value_histogram = [round(float(value / pixel_count), 4) for value in histogram]

        strengths: list[str] = []
        improvements: list[str] = []
        if 0.015 <= edge_density <= 0.16:
            strengths.append("Your marks create a readable amount of visual structure.")
        elif edge_density < 0.015:
            improvements.append(
                "The marks are quite sparse; consider a second pass focused on the major contours."
            )
        else:
            improvements.append(
                "The page has many overlapping edges; try fewer, more deliberate strokes."
            )
        if fragmentation < 3:
            strengths.append(
                "Detected edges are relatively connected rather than heavily fragmented."
            )
        else:
            improvements.append(
                "Many short edge fragments were detected. Ghost longer paths before committing a stroke."
            )
        if 0.28 <= occupancy <= 0.85:
            strengths.append("The drawing uses a balanced portion of the page.")
        elif occupancy < 0.28:
            improvements.append(
                "The drawing occupies a small area. Try planning a larger bounding shape first."
            )
        else:
            improvements.append(
                "The drawing reaches most page edges. Leave a little more breathing room around the subject."
            )
        if center_offset <= 0.12:
            strengths.append("The visual weight sits close to the center of the page.")
        elif center_offset > 0.3:
            improvements.append(
                "The visual weight pulls strongly to one side. Check whether that supports your intended composition."
            )
        if left_right_balance < 0.45:
            improvements.append(
                "One side carries much more detected detail. Compare the major widths before refining small marks."
            )
        if contrast_range < 0.3:
            improvements.append(
                "The value range is narrow. If value is part of the exercise, compare the lightest and darkest areas."
            )
        if not strengths:
            strengths.append(
                "The sketch provides enough visible evidence to plan a focused next pass."
            )
        if not improvements:
            improvements.append(
                "For the next pass, redraw one contour with a single planned, confident stroke."
            )

        summary = (
            "This local check measures visible edges, value range, page use, and approximate mark "
            "fragmentation. These are practice signals—not an objective grade of drawing quality."
        )
        metrics = {
            "dimensions": {"width": sketch.width, "height": sketch.height},
            "contrast_range": round(contrast_range, 4),
            "edge_density": round(edge_density, 4),
            "stroke_fragmentation": round(fragmentation, 4),
            "bounding_box_occupancy": round(occupancy, 4),
            "dominant_line_angles": dominant_angles,
            "dominant_direction_share": round(dominant_direction_share, 4),
            "value_histogram": value_histogram,
            "visual_center": visual_center,
            "center_offset": round(center_offset, 4),
            "left_right_balance": round(left_right_balance, 4),
            "top_bottom_balance": round(top_bottom_balance, 4),
            "mirror_similarity": round(mirror_similarity, 4),
            "annotations": _build_annotations(
                footprint,
                visual_center,
                edge_hotspot,
                dominant_angles[0] if dominant_angles else None,
            ),
            "coaching_profile": _build_coaching_profile(
                subject_context=subject_context,
                fragmentation=fragmentation,
                edge_density=edge_density,
                contrast_range=contrast_range,
                occupancy=occupancy,
                center_offset=center_offset,
                left_right_balance=left_right_balance,
                top_bottom_balance=top_bottom_balance,
                mirror_similarity=mirror_similarity,
                dominant_direction_share=dominant_direction_share,
            ),
        }
        return LocalAnalysisResult(summary, strengths, improvements, metrics, confidence=0.68)


def _dominant_angle_bins(angles: list[float]) -> list[float]:
    if not angles:
        return []
    histogram, edges = np.histogram(angles, bins=12, range=(0, 180))
    strongest = np.argsort(histogram)[::-1][:3]
    return [
        round(float((edges[index] + edges[index + 1]) / 2), 1)
        for index in strongest
        if histogram[index] > 0
    ]


def _balance_ratio(first: int, second: int) -> float:
    larger = max(first, second)
    return float(min(first, second) / larger) if larger else 1.0


def _dominant_direction_share(angles: list[float], lengths: list[float]) -> float:
    if not angles or not lengths:
        return 0.0
    bins = np.linspace(0, 180, 13)
    weighted, _ = np.histogram(angles, bins=bins, weights=lengths)
    return float(np.max(weighted) / max(np.sum(weighted), 1))


def _build_annotations(
    footprint: dict[str, float],
    visual_center: dict[str, float],
    hotspot: dict[str, float],
    dominant_angle: float | None,
) -> list[dict[str, Any]]:
    annotations: list[dict[str, Any]] = []
    if footprint["width"] > 0:
        annotations.append(
            {
                "id": "drawing-footprint",
                "label": "Drawing footprint",
                "detail": "The outer area containing sustained edge activity.",
                "tone": "positive",
                "geometry": {"type": "rect", **footprint},
            }
        )
        annotations.append(
            {
                "id": "visual-center",
                "label": "Visual center",
                "detail": "The average location of sustained mark activity.",
                "tone": "info",
                "geometry": {"type": "point", **visual_center},
            }
        )
        annotations.append(
            {
                "id": "edge-hotspot",
                "label": "Most active area",
                "detail": "This third of the page contains the highest edge concentration.",
                "tone": "practice",
                "geometry": {"type": "rect", **hotspot},
            }
        )
    if dominant_angle is not None:
        radians = np.radians(dominant_angle)
        half_length = 0.3
        delta_x = float(np.cos(radians) * half_length)
        delta_y = float(np.sin(radians) * half_length)
        annotations.append(
            {
                "id": "dominant-direction",
                "label": "Dominant direction",
                "detail": f"Repeated straight segments cluster near {dominant_angle:.1f}°.",
                "tone": "info",
                "geometry": {
                    "type": "line",
                    "x1": round(max(0.0, 0.5 - delta_x), 4),
                    "y1": round(max(0.0, 0.5 - delta_y), 4),
                    "x2": round(min(1.0, 0.5 + delta_x), 4),
                    "y2": round(min(1.0, 0.5 + delta_y), 4),
                },
            }
        )
    return annotations


def _score(value: float) -> int:
    return round(max(0.0, min(100.0, value)))


def _build_coaching_profile(
    *,
    subject_context: str | None,
    fragmentation: float,
    edge_density: float,
    contrast_range: float,
    occupancy: float,
    center_offset: float,
    left_right_balance: float,
    top_bottom_balance: float,
    mirror_similarity: float,
    dominant_direction_share: float,
) -> dict[str, Any]:
    subject = (subject_context or "").strip()
    normalized_subject = subject.casefold()
    is_guitar = "guitar" in normalized_subject
    is_frontal = any(
        phrase in normalized_subject
        for phrase in ("head-on", "head on", "front view", "front-facing", "straight on")
    )

    line_confidence = _score(94 - min(fragmentation, 7) * 8 - max(0.0, edge_density - 0.08) * 260)
    mark_economy = _score(96 - min(fragmentation, 7) * 9 - max(0.0, edge_density - 0.1) * 300)
    contour_continuity = _score(96 - min(fragmentation, 8) * 10)
    penmanship = _score((line_confidence + mark_economy + contour_continuity) / 3)
    value_development = _score(32 + contrast_range * 112)
    composition = _score(
        92
        - abs(occupancy - 0.58) * 70
        - center_offset * 45
        + (left_right_balance - 0.5) * 12
        + (top_bottom_balance - 0.5) * 6
    )
    structure = _score(left_right_balance * 42 + mirror_similarity * 38 + (1 - center_offset) * 20)

    scores: list[dict[str, Any]] = [
        {
            "id": "penmanship",
            "label": "Penmanship",
            "score": penmanship,
            "confidence": 0.62,
            "evidence": (
                f"Fragmentation {fragmentation:.1f}; edge density {edge_density * 100:.1f}%."
            ),
            "meaning": "Estimated cleanliness, continuity, and economy of visible marks.",
        },
        {
            "id": "line-confidence",
            "label": "Line confidence",
            "score": line_confidence,
            "confidence": 0.64,
            "evidence": f"Contour continuity estimate {contour_continuity}/100.",
            "meaning": "Higher values suggest longer connected marks with fewer corrective fragments.",
        },
        {
            "id": "value-development",
            "label": "Value development",
            "score": value_development,
            "confidence": 0.7,
            "evidence": f"Measured value range {contrast_range * 100:.0f}%.",
            "meaning": "How broadly the photo uses light-to-dark values—not shading correctness.",
        },
        {
            "id": "composition",
            "label": "Composition",
            "score": composition,
            "confidence": 0.66,
            "evidence": (
                f"Page use {occupancy * 100:.0f}%; center offset {center_offset * 100:.0f}%."
            ),
            "meaning": "Estimated page use and distribution of visual weight.",
        },
    ]
    if subject and is_frontal:
        scores.append(
            {
                "id": "subject-structure",
                "label": "Frontal structure",
                "score": structure,
                "confidence": 0.48,
                "evidence": (
                    f"Side balance {left_right_balance * 100:.0f}%; "
                    f"mirror similarity {mirror_similarity * 100:.0f}%."
                ),
                "meaning": (
                    "A whole-image alignment estimate for the declared frontal subject; "
                    "it does not locate individual parts."
                ),
            }
        )

    style_signals: list[dict[str, str]] = []
    style_signals.append(
        {
            "label": "Contour-led" if edge_density < 0.06 else "Dense mark-making",
            "basis": (
                "Most of the image remains open around a relatively small edge signal."
                if edge_density < 0.06
                else "Detected edges occupy a comparatively large share of the image."
            ),
        }
    )
    style_signals.append(
        {
            "label": "Light-value study" if contrast_range < 0.42 else "Broad-value study",
            "basis": (
                "The drawing stays mostly within a restrained light-to-mid value range."
                if contrast_range < 0.42
                else "The drawing uses a broad separation between light and dark values."
            ),
        }
    )
    if dominant_direction_share >= 0.45:
        style_signals.append(
            {
                "label": "Directionally structured",
                "basis": (
                    f"{dominant_direction_share * 100:.0f}% of detected straight-line length "
                    "falls in the strongest direction family."
                ),
            }
        )

    focus_candidates: list[dict[str, Any]] = [
        {
            "id": "linework",
            "label": "Linework",
            "score": penmanship,
            "rationale": (
                "Some contour segments appear as multiple corrections rather than one planned mark."
                if penmanship < 78
                else "The linework is relatively connected; the next gain is intentional line weight."
            ),
            "action": (
                "Ghost the outer contour, then draw each major curve once before adding selective weight."
            ),
            "annotation_id": "drawing-footprint",
        },
        {
            "id": "shading",
            "label": "Shading",
            "score": value_development,
            "rationale": "The measured value range leaves room for clearer light, midtone, and shadow groups.",
            "action": "Plan three value families first; reserve the darkest accents for focal overlaps.",
            "annotation_id": "edge-hotspot",
        },
        {
            "id": "composition",
            "label": "Composition",
            "score": composition,
            "rationale": "Page use and visual-weight placement determine how comfortably the subject reads.",
            "action": "Block the full silhouette and center of mass before committing interior details.",
            "annotation_id": "visual-center",
        },
    ]
    if subject and is_frontal:
        focus_candidates.append(
            {
                "id": "subject-structure",
                "label": f"{subject} structure",
                "score": structure,
                "rationale": (
                    "The whole-image mirror signal suggests checking paired landmarks around a centerline."
                ),
                "action": (
                    "Draw a centerline first, then compare matching landmarks side to side before shading."
                ),
                "annotation_id": "visual-center",
            }
        )
    focus_candidates.sort(key=lambda item: int(item["score"]))
    focus_areas = [
        {**item, "priority": index + 1} for index, item in enumerate(focus_candidates[:3])
    ]

    subject_checks: list[dict[str, str]] = []
    if is_guitar:
        subject_checks = [
            {
                "label": "Centerline",
                "prompt": "Compare the headstock, neck, sound hole, and bridge along one shared axis.",
            },
            {
                "label": "Major proportions",
                "prompt": "Compare headstock, neck, upper bout, waist, and lower bout before details.",
            },
            {
                "label": "Repeated spacing",
                "prompt": "Check the rhythm of frets, strings, and tuning machines as grouped intervals.",
            },
            {
                "label": "Paired silhouette",
                "prompt": "For a head-on study, compare the body curves on both sides of the centerline.",
            },
        ]

    return {
        "calculation_version": "local_cv_coaching_v1",
        "target": {
            "label": subject or "Subject not specified",
            "source": "user_declared" if subject else "none",
            "is_frontal": is_frontal,
        },
        "scores": scores,
        "style_signals": style_signals,
        "focus_areas": focus_areas,
        "subject_checks": subject_checks,
        "limitations": (
            "Scores estimate visible mark patterns. Local analysis uses your declared target as "
            "rubric context but does not semantically locate or verify individual subject parts."
        ),
    }
