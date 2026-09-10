export type InkBounds = { x: number; y: number; width: number; height: number };

export function inkBounds(data: Uint8ClampedArray, width: number, height: number): InkBounds | null {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (data[i + 3] > 30 && Math.min(data[i], data[i + 1], data[i + 2]) < 245) {
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  return right < left ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

export function tracingSize(bounds: InkBounds, inches: number, paper: "A4" | "Letter") {
  const landscape = bounds.width > bounds.height;
  const [short, long] = paper === "A4" ? [210, 297] : [215.9, 279.4];
  const availableWidth = (landscape ? long : short) - 24;
  const availableHeight = (landscape ? short : long) - 24;
  // 2% padding on each side is included in fitting, but not in the reported subject size.
  const longest = Math.max(bounds.width, bounds.height);
  const padding = Math.ceil(longest * .02);
  const scale = Math.min(inches * 25.4 / longest, availableWidth / (bounds.width + padding * 2), availableHeight / (bounds.height + padding * 2));
  return { landscape, padding, widthMM: (bounds.width + padding * 2) * scale, heightMM: (bounds.height + padding * 2) * scale, actualInches: longest * scale / 25.4 };
}
