import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { COLOR_FAMILIES, EMILY_LEX_PAINTS, MIXING_EXAMPLES } from "./color-mixing-examples";
import { LEMON_LESSON } from "./lesson-model";
import { StyleStudioApp } from "./style-lab";

function response(payload: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

const catalog = {
  schema_version: "color-mix-catalog.v1",
  version: 1,
  palette: {
    id: "emily-lex-18",
    name: "Emily Lex · 18 colors",
    paints: EMILY_LEX_PAINTS.map(([name, color]) => ({ name, color })),
  },
  families: COLOR_FAMILIES,
  recipes: MIXING_EXAMPLES,
  guidance_status: "illustrative",
  guidance_note: "Authored starting points; test them with your materials.",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("consolidated application", () => {
  it("makes starting a painting dominant when the studio is empty", async () => {
    vi.stubGlobal("fetch", vi.fn(() => response([])));
    render(<MemoryRouter initialEntries={["/"]}><StyleStudioApp /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "No painting sessions yet." })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Start painting" }).length).toBeGreaterThanOrEqual(2);
  });

  it("surfaces the active painting session and its durable URL", async () => {
    const lesson = { ...structuredClone(LEMON_LESSON), id: "current-session", title: "Quiet lemons", is_demo: false, saved_at: null };
    vi.stubGlobal("fetch", vi.fn(() => response([lesson])));
    render(<MemoryRouter initialEntries={["/"]}><StyleStudioApp /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Quiet lemons" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open session" })).toHaveAttribute("href", "/sessions/current-session/edit");
  });

  it("keeps the start action available when session loading fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    render(<MemoryRouter initialEntries={["/"]}><StyleStudioApp /></MemoryRouter>);

    expect(await screen.findByRole("alert")).toHaveTextContent("couldn’t load");
    expect(screen.getAllByRole("link", { name: "Start painting" }).length).toBeGreaterThan(0);
  });

  it("restores or permanently deletes discarded sessions from a dedicated view", async () => {
    const discarded = [
      { ...structuredClone(LEMON_LESSON), id: "discarded-one", title: "First discarded session" },
      { ...structuredClone(LEMON_LESSON), id: "discarded-two", title: "Second discarded session" },
    ];
    const actions: string[] = [];
    vi.stubGlobal("fetch", vi.fn((input, init) => {
      const url = String(input);
      if (url.endsWith("?state=all")) return response([]);
      if (url.endsWith("?state=discarded")) return response(discarded);
      if (url.endsWith("/discarded-one/restore") && init?.method === "POST") { actions.push("restore"); return response(discarded[0]); }
      if (url.endsWith("/discarded-two/permanent") && init?.method === "DELETE") { actions.push("purge"); return Promise.resolve(new Response(null, { status: 204 })); }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    }));
    render(<MemoryRouter initialEntries={["/sessions"]}><StyleStudioApp /></MemoryRouter>);

    fireEvent.click(await screen.findByRole("button", { name: "Discarded" }));
    expect(await screen.findByRole("heading", { name: "First discarded session" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Restore" })[0]);
    await waitFor(() => expect(actions).toContain("restore"));
    fireEvent.click(screen.getByRole("button", { name: "Delete forever" }));
    expect(await screen.findByText(/cannot be undone/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(actions).toContain("purge"));
  });

  it("loads authored mixtures and saves a learner trial", async () => {
    let savedBody: Record<string, unknown> | undefined;
    vi.stubGlobal("fetch", vi.fn((input, init) => {
      const url = String(input);
      if (url.endsWith("/catalog")) return response(catalog);
      if (url.endsWith("/trials") && !init?.method) return response([]);
      if (url.endsWith("/trials") && init?.method === "POST") {
        savedBody = JSON.parse(String(init.body));
        return response({
          id: "trial-1",
          recipe: MIXING_EXAMPLES.find((recipe) => recipe.id === "olive-green"),
          catalog_version: 1,
          adjustments: savedBody!.adjustments,
          notes: savedBody!.notes,
          revision: 1,
          created_at: "2026-09-18T12:00:00Z",
          updated_at: "2026-09-18T12:00:00Z",
        }, 201);
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    }));
    render(<MemoryRouter initialEntries={["/color-mixing"]}><StyleStudioApp /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Olive green" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Too brown" }));
    fireEvent.change(screen.getByLabelText("Notes for next time"), { target: { value: "Dried warmer on cotton paper." } });
    fireEvent.click(screen.getByRole("button", { name: "Save color trial" }));

    await waitFor(() => expect(savedBody).toBeDefined());
    expect(savedBody).toMatchObject({ recipe_id: "olive-green", catalog_version: 1, notes: "Dried warmer on cotton paper." });
    expect(screen.getByText("Color trial saved.")).toBeInTheDocument();
  });
});
