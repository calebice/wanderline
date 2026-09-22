import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { COLOR_FAMILIES, EMILY_LEX_PAINTS, MIXING_EXAMPLES } from "./color-mixing-examples";
import { StyleStudioApp } from "./style-lab";

function response(payload: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } }));
}

const catalog = {
  schema_version: "color-mix-catalog.v1",
  version: 1,
  palette: { id: "emily-lex-18", name: "Emily Lex · 18 colors", paints: EMILY_LEX_PAINTS.map(([name, color]) => ({ name, color })) },
  families: COLOR_FAMILIES,
  recipes: MIXING_EXAMPLES,
  guidance_status: "illustrative",
  guidance_note: "Test with your materials.",
};

const swatch = {
  id: "swatch-1",
  schema_version: "color-swatch.v1",
  source_type: "single_paint",
  palette_id: "emily-lex-18",
  catalog_version: 1,
  family: null,
  name: "Lemon Yellow on cotton",
  source_snapshot: { type: "single_paint", paint: { name: "Lemon Yellow", color: "#f0cf45" } },
  ingredients: [{ paint: "Lemon Yellow", parts: 1 }],
  paper: { brand: "Arches", product: "Cold press", weight_texture: "140 lb" },
  capture: { card_brand: "Calibrite", card_model: "Color card", lighting: "indirect_daylight", other_lighting: "", card_visible: true },
  appearance: { value: "light", temperature: "warm", chroma: "vivid" },
  traits: { transparency: "transparent", granulation: "none", lifting: "lifts_some", water_notes: "", drying_notes: "" },
  comparison: { value: "same", temperature: "same", chroma: "same", close: true },
  notes: "Clear and bright.",
  tested_on: "2026-09-20",
  image_url: "/api/v1/color-mixing/swatches/swatch-1/image",
  image_width: 180,
  image_height: 120,
  revision: 1,
  created_at: "2026-09-20T12:00:00Z",
  updated_at: "2026-09-20T12:00:00Z",
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("personal Color Library", () => {
  it("shows paint-set coverage and a filterable swatch gallery", async () => {
    vi.stubGlobal("fetch", vi.fn((input) => {
      const url = String(input);
      if (url.endsWith("/catalog")) return response(catalog);
      if (url.endsWith("/swatches")) return response([swatch]);
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    }));
    render(<MemoryRouter initialEntries={["/color-mixing/library"]}><StyleStudioApp /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Color Library" })).toBeInTheDocument();
    expect(screen.getByText("1 of 18 paints recorded")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lemon Yellow: recorded" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lemon Yellow on cotton" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "custom_mix" } });
    expect(screen.getByRole("heading", { name: "No swatches match these filters." })).toBeInTheDocument();
  });

  it("captures a required card-backed single-paint swatch and opens its detail", async () => {
    let posted: FormData | null = null;
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() });
    vi.stubGlobal("fetch", vi.fn((input, init) => {
      const url = String(input);
      if (url.endsWith("/catalog")) return response(catalog);
      if (url.endsWith("/swatches") && init?.method === "POST") { posted = init.body as FormData; return response(swatch, 201); }
      if (url.endsWith("/swatches/swatch-1")) return response(swatch);
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    }));
    render(<MemoryRouter initialEntries={["/color-mixing/library/new?kind=single_paint&paint=Lemon%20Yellow"]}><StyleStudioApp /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Add a physical swatch" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Swatch name"), { target: { value: "Lemon Yellow on cotton" } });
    fireEvent.change(screen.getByLabelText("Paper brand"), { target: { value: "Arches" } });
    fireEvent.change(screen.getByLabelText("Paper product"), { target: { value: "Cold press" } });
    fireEvent.change(screen.getByLabelText("Reference-card brand"), { target: { value: "Calibrite" } });
    fireEvent.change(screen.getByLabelText("Reference-card model"), { target: { value: "Color card" } });
    await userEvent.upload(screen.getByLabelText("Dry swatch photo"), new File(["swatch"], "swatch.png", { type: "image/png" }));
    fireEvent.submit(screen.getByRole("button", { name: "Save physical swatch" }).closest("form")!);

    await waitFor(() => expect(posted).not.toBeNull());
    expect(JSON.parse(String(posted!.get("metadata")))).toMatchObject({ source_type: "single_paint", ingredients: [{ paint: "Lemon Yellow", parts: 1 }] });
    expect(await screen.findByRole("heading", { name: "Lemon Yellow on cotton" })).toBeInTheDocument();
    expect(screen.getByText("Illustrative screen target")).toBeInTheDocument();
  });
});
