from dataclasses import dataclass
from io import BytesIO
from typing import Any

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener  # type: ignore[import-untyped]

register_heif_opener()

SUPPORTED_CLAIMED_TYPES = {
    "",
    "application/octet-stream",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}
SUPPORTED_DETECTED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heif", "image/mpo"}
HEIF_TYPES = {"image/heic", "image/heif"}
JPEG_TYPES = {"image/jpeg", "image/mpo"}


class InvalidImageError(ValueError):
    pass


@dataclass(frozen=True)
class ValidatedImage:
    content: bytes
    content_type: str
    width: int
    height: int
    rgb: np.ndarray[Any, np.dtype[np.uint8]]


def validate_image(content: bytes, claimed_content_type: str, max_pixels: int) -> ValidatedImage:
    if claimed_content_type not in SUPPORTED_CLAIMED_TYPES:
        raise InvalidImageError("Only JPEG, PNG, WebP, and HEIC/HEIF images are supported.")
    try:
        with Image.open(BytesIO(content)) as source:
            source.verify()
        with Image.open(BytesIO(content)) as source:
            detected_type = Image.MIME.get(source.format or "")
            if detected_type not in SUPPORTED_DETECTED_TYPES:
                raise InvalidImageError(
                    "The file signature is not a supported JPEG, PNG, WebP, or HEIC/HEIF image."
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
                raise InvalidImageError("The file contents do not match the declared image type.")
            source = ImageOps.exif_transpose(source)
            width, height = source.size
            if width * height > max_pixels:
                raise InvalidImageError("The image dimensions are too large to process safely.")
            rgba = source.convert("RGBA")
            background = Image.new("RGBA", rgba.size, "white")
            flattened = Image.alpha_composite(background, rgba).convert("RGB")
            rgb = np.asarray(flattened)
            if detected_type in HEIF_TYPES or detected_type == "image/mpo":
                normalized = BytesIO()
                flattened.save(normalized, format="JPEG", quality=92, optimize=True)
                content = normalized.getvalue()
                detected_type = "image/jpeg"
    except (UnidentifiedImageError, OSError) as error:
        raise InvalidImageError("The uploaded file is not a readable image.") from error
    return ValidatedImage(content, detected_type, width, height, rgb)
