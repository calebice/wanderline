import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";

import { FEELING_FIRST_GALLERY } from "./emotion-study-catalog";
import {
  STYLE_GUIDE_ENTRIES,
  STYLE_GUIDE_SLUGS,
  STYLE_REFERENCE_SUBJECTS,
} from "./style-catalog";
import { StyleStudioApp } from "./style-lab";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StyleStudioApp />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function publicAssetPath(src: string) {
  return resolve(process.cwd(), "public", src.replace(/^\//, ""));
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("Sites-native Style Studio", () => {
  it("ships six subjects with all 30 style combinations", () => {
    expect(STYLE_REFERENCE_SUBJECTS).toHaveLength(6);
    expect(STYLE_GUIDE_ENTRIES).toHaveLength(5);
    for (const subject of STYLE_REFERENCE_SUBJECTS) {
      expect(subject.variants).toHaveLength(5);
      expect(subject.variants.map((variant) => variant.style)).toEqual([...STYLE_GUIDE_SLUGS]);
      for (const variant of subject.variants) {
        expect(variant.label).toBeTruthy();
        expect(variant.treatment).toBeTruthy();
        expect(variant.thumbnail.alt.length).toBeGreaterThan(30);
        expect(variant.reference.alt.length).toBeGreaterThan(30);
      }
    }
  });

  it("ships every referenced production image as a compact WebP", () => {
    const assets = new Map<string, { alt: string }>();
    for (const subject of STYLE_REFERENCE_SUBJECTS) {
      assets.set(subject.selectorImage.src, subject.selectorImage);
      for (const variant of subject.variants) {
        assets.set(variant.thumbnail.src, variant.thumbnail);
        assets.set(variant.reference.src, variant.reference);
      }
    }
    for (const entry of STYLE_GUIDE_ENTRIES) {
      for (const asset of [entry.learnerReference, entry.process]) assets.set(asset.src, asset);
    }
    for (const asset of [FEELING_FIRST_GALLERY.thumbnail, ...FEELING_FIRST_GALLERY.interpretations.map((item) => item.artwork)]) {
      assets.set(asset.src, asset);
    }

    for (const [src, asset] of assets) {
      const path = publicAssetPath(src);
      const contents = readFileSync(path);
      expect(contents.subarray(0, 4).toString(), src).toBe("RIFF");
      expect(contents.subarray(8, 12).toString(), src).toBe("WEBP");
      expect(statSync(path).size, src).toBeLessThan(2_000_000);
      expect(asset.alt.length).toBeGreaterThan(30);
    }
  });

  it("restores comparison state and updates its bookmarkable URL", () => {
    renderPath("/?subject=bouquet&style=watercolor");
    expect(screen.getByRole("button", { name: /Bouquets & vessels/ })).toHaveAttribute("aria-pressed", "true");
    const styles = screen.getByRole("group", { name: /Choose a drawing language/ });
    expect(within(styles).getByRole("button", { name: /Watercolor/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByAltText(/Luminous transparent watercolor/)).toBeInTheDocument();

    fireEvent.click(within(styles).getByRole("button", { name: /Cartoon/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("?subject=bouquet&style=cartoon");
    expect(screen.getByAltText(/Playful high-angle cartoon illustration/)).toBeInTheDocument();
  });

  it("turns each reference into an actionable study and supports a value check", () => {
    renderPath("/?subject=greenhouse&style=watercolor");
    expect(screen.getByRole("heading", { name: "Turn looking into drawing." })).toBeInTheDocument();
    expect(screen.getByText(/Reserve the brightest light/)).toBeInTheDocument();

    const valueButton = screen.getByRole("button", { name: "Value check" });
    fireEvent.click(valueButton);
    expect(valueButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByAltText(/Transparent watercolor of a warm glass greenhouse/)).toHaveClass("is-value-view");

    const styles = screen.getByRole("group", { name: /Choose a drawing language/ });
    fireEvent.click(within(styles).getByRole("button", { name: /Architectural drawing/ }));
    expect(screen.getByText(/Set the horizon or projection axes/)).toBeInTheDocument();
  });

  it("teaches watercolor as four persistent visual stages", () => {
    const view = renderPath("/?view=watercolor-lesson");
    expect(screen.getByRole("heading", { name: "Understand the water.", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText("Dry paper").length).toBeGreaterThan(0);
    expect(screen.getByAltText(/Light graphite outline/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next stage →" }));
    expect(screen.getByRole("heading", { name: "Make one luminous first wash." })).toBeInTheDocument();
    expect(screen.getByText(/More water makes a lighter/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reference photo" }));
    expect(screen.getByAltText(/Single yellow lemon/)).toBeInTheDocument();

    view.unmount();
    renderPath("/?view=watercolor-lesson");
    expect(screen.getByRole("heading", { name: "Make one luminous first wash." })).toBeInTheDocument();
  });

  it("ships compact lemon lesson imagery", () => {
    for (const file of ["reference.jpg", "process.jpg"]) {
      const path = resolve(process.cwd(), "public", "watercolor-lesson", "lemon", file);
      const contents = readFileSync(path);
      expect(contents.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
      expect(statSync(path).size).toBeLessThan(1_000_000);
    }
  });

  it("uses explicit defaults for invalid comparison values", () => {
    renderPath("/?subject=missing&style=missing");
    expect(screen.getByRole("button", { name: /Japanese seaside town/ })).toHaveAttribute("aria-pressed", "true");
    const styles = screen.getByRole("group", { name: /Choose a drawing language/ });
    expect(within(styles).getByRole("button", { name: /^Realism/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("restores all five long-form guides and cycles previous and next", () => {
    for (const [index, entry] of STYLE_GUIDE_ENTRIES.entries()) {
      const view = renderPath(`/?view=guide&style=${entry.slug}`);
      expect(screen.getByRole("heading", { name: entry.label, level: 1 })).toBeInTheDocument();
      expect(screen.getByText(`STYLE ${String(index + 1).padStart(2, "0")} OF 05`)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "From blank page to finish." })).toBeInTheDocument();
      view.unmount();
    }

    renderPath("/?view=guide&style=watercolor");
    expect(screen.getByRole("link", { name: /Anime environment/ })).toHaveAttribute("href", "/?view=guide&style=anime-environment");
  });

  it("normalizes an invalid guide to the first teaching guide", async () => {
    renderPath("/?view=guide&style=unknown");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Realism", level: 1 })).toBeInTheDocument());
    expect(screen.getByTestId("location")).toHaveTextContent("?view=guide&style=realism");
  });

  it("restores Feeling First and keeps all five labeled states keyboard-accessible", () => {
    renderPath("/?view=feeling-first&emotion=joy");
    expect(screen.getByRole("heading", { name: "Feeling First", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Joy" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByAltText(/healthy upright tree/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(4);

    fireEvent.click(screen.getByRole("button", { name: "Heaviness" }));
    expect(screen.getByTestId("location")).toHaveTextContent("?view=feeling-first&emotion=heaviness");
    expect(screen.getByAltText(/bend toward the glowing rim/)).toBeInTheDocument();
  });

  it("provides an accessible fallback without breaking the studio", () => {
    renderPath("/?view=guide&style=realism");
    fireEvent.error(screen.getByAltText(/Detailed colored-pencil view/));
    expect(screen.getByRole("img", { name: /Detailed colored-pencil view/ })).toBeInTheDocument();
    expect(screen.getByText("Reference image unavailable")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Comparison studio/ })).toBeInTheDocument();
  });

  it("makes no API request while changing the comparison", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderPath("/");
    const styles = screen.getByRole("group", { name: /Choose a drawing language/ });
    fireEvent.click(within(styles).getByRole("button", { name: /Watercolor/ }));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
