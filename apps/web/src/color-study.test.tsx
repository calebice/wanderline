import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { ColorStudy } from "./color-study";
import { pigmentMix, washColor, STUDY_COLORS } from "./color-study-model";
import { COLOR_SOURCES, comparisonsFor } from "./color-study-catalog";
afterEach(cleanup);
const renderStudy=()=>render(<MemoryRouter><ColorStudy /></MemoryRouter>);
describe("Watercolor comparison palette",()=>{
  it("curates five traceable partners for all twelve hues",()=>{
    for(const hue of STUDY_COLORS){
      const entries=comparisonsFor(hue.id);
      expect(entries.map(p=>p.kind)).toEqual(["Related","Related","Contrast","Contrast","Neutralizing"]);
      expect(new Set(entries.map(p=>p.name)).size).toBe(5);
      for(const entry of entries) expect(COLOR_SOURCES[entry.source-1].url).toMatch(/^https:/);
    }
  });
  it("preserves endpoints and dilutes both paints with the same wash strength",()=>{
    const a=STUDY_COLORS[8].rgb,b=STUDY_COLORS[2].rgb;
    for(let w=0;w<4;w++){
      expect(pigmentMix(a,b,0,w)).toBe(`rgb(${washColor(a,w).join(",")})`);
      expect(pigmentMix(a,b,1,w)).toBe(`rgb(${washColor(b,w).join(",")})`);
    }
    const green=pigmentMix([0,33,133],[252,210,0],.5,3).match(/\d+/g)!.map(Number);
    expect(green[1]).toBeGreaterThan(green[0]);
    expect(green[1]).toBeGreaterThan(green[2]);
  });
  it("shows 48 selectable wheel washes and all five comparisons",()=>{
    renderStudy();
    expect(document.querySelectorAll(".wc-wheel path[role=button]")).toHaveLength(48);
    expect(screen.getAllByRole("slider")).toHaveLength(5);
    expect(screen.getByRole("heading",{name:"Five ways with blue"})).toBeInTheDocument();
  });
  it("selects hue and wash by keyboard, pins ratios, and updates the source",async()=>{
    const user=userEvent.setup();renderStudy();
    screen.getByRole("button",{name:"Green, pale wash"}).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading",{name:"Five ways with green"})).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Pale"})).toHaveAttribute("aria-pressed","true");
    await user.click(screen.getByRole("button",{name:"Pin Green and Anthraquinoid Red at 75:25"}));
    expect(screen.getByRole("status")).toHaveTextContent("75% Green / 25% Anthraquinoid Red");
    await user.click(screen.getByText("Try on paper"));
    await user.click(screen.getByRole("link",{name:"Source 5"}));
    expect(document.querySelector(".wc-sources")).toHaveAttribute("open");
    fireEvent.change(screen.getByRole("slider",{name:"Inspect Green and Anthraquinoid Red ratio"}),{target:{value:"80"}});
    expect(screen.getByRole("status")).toHaveTextContent("20% Green / 80% Anthraquinoid Red");
    await user.click(screen.getByRole("button",{name:"Rich"}));
    expect(screen.getByRole("status")).toHaveTextContent("20% Green / 80% Anthraquinoid Red");
    await user.click(screen.getByRole("button",{name:"Blue, medium wash"}));
    expect(screen.getByRole("status")).toHaveTextContent("50% Blue / 50% Azure");
  });
});
