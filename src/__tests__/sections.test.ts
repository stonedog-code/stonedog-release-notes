import { DEFAULT_SECTIONS, groupBySection } from "../sections";
import type { PublicReleaseEntry } from "../types";

const entry = (type: string, text = "something"): PublicReleaseEntry => ({ type, text });

describe("groupBySection", () => {
  it("uses a reader's vocabulary, not a maintainer's", () => {
    // The whole point: "New features", not "feat".
    expect(DEFAULT_SECTIONS.map((s) => s.label)).toEqual([
      "New features",
      "Fixes",
      "Improvements",
    ]);
  });

  it("files entries under their section, in the definitions' order", () => {
    const sections = groupBySection([entry("fix"), entry("feat"), entry("perf")]);
    expect(sections.map((s) => s.label)).toEqual(["New features", "Fixes", "Improvements"]);
  });

  it("treats bug as an alias of fix", () => {
    const [section] = groupBySection([entry("bug")]);
    expect(section.label).toBe("Fixes");
  });

  it("puts docs under Improvements rather than a section of its own", () => {
    // A customer does not distinguish "we documented it" from "we improved
    // it", and a section holding one item most releases is noise.
    const [section] = groupBySection([entry("docs")]);
    expect(section.label).toBe("Improvements");
  });

  it("drops a section that ends up empty", () => {
    expect(groupBySection([entry("feat")]).map((s) => s.id)).toEqual(["features"]);
  });

  it("keeps an unrecognised type instead of dropping it", () => {
    // Including `other`, which is what a hand-written sentence gets — so plain
    // prose lands somewhere sensible with no host configuration.
    const sections = groupBySection([entry("other", "We tidied the sign-in screen.")]);
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe("Other changes");
    expect(sections[0].entries[0].text).toBe("We tidied the sign-in screen.");
  });

  it("puts Other last, after everything claimed", () => {
    const sections = groupBySection([entry("revert"), entry("feat")]);
    expect(sections.map((s) => s.id)).toEqual(["features", "other"]);
  });

  it("lets a host drop unclaimed entries instead of bucketing them", () => {
    expect(groupBySection([entry("revert")], { otherLabel: null })).toEqual([]);
  });

  it("takes the host's own section definitions", () => {
    const sections = groupBySection([entry("feat"), entry("chore")], {
      sections: [{ id: "all", label: "Everything", types: ["feat", "chore"] }],
    });
    expect(sections).toHaveLength(1);
    expect(sections[0].entries).toHaveLength(2);
  });

  it("returns nothing for nothing", () => {
    expect(groupBySection([])).toEqual([]);
  });
});
