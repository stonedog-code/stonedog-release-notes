import {
  audienceOf,
  DEFAULT_INTERNAL_TYPES,
  publicReleases,
  publicTextOf,
  scrubInternalReferences,
  toPublicEntry,
} from "../visibility";
import type { Release, ReleaseEntry } from "../types";

const entry = (over: Partial<ReleaseEntry> = {}): ReleaseEntry => ({
  type: "fix",
  subject: "stop the widget flickering",
  ...over,
});

describe("audienceOf", () => {
  it("hides the types that describe work on the codebase", () => {
    for (const type of DEFAULT_INTERNAL_TYPES) {
      expect(audienceOf(entry({ type }))).toBe("internal");
    }
  });

  it("shows feat, fix, perf, docs and refactor by default", () => {
    for (const type of ["feat", "fix", "perf", "docs", "refactor"]) {
      expect(audienceOf(entry({ type }))).toBe("public");
    }
  });

  it("keeps an unknown type rather than hiding it", () => {
    // A prefix nobody anticipated should surface as "Other", not vanish. A
    // release note that disappears because of a typo in a commit message is
    // indistinguishable from one nobody wrote.
    expect(audienceOf(entry({ type: "revert" }))).toBe("public");
  });

  it("lets an explicit audience overrule the type, in both directions", () => {
    expect(audienceOf(entry({ type: "feat", audience: "internal" }))).toBe("internal");
    expect(audienceOf(entry({ type: "chore", audience: "public" }))).toBe("public");
  });

  it("takes the host's own internal list when given one", () => {
    expect(audienceOf(entry({ type: "docs" }), { internalTypes: ["docs"] })).toBe("internal");
    expect(audienceOf(entry({ type: "chore" }), { internalTypes: ["docs"] })).toBe("public");
  });
});

describe("scrubInternalReferences (NEH-744)", () => {
  // These are REAL strings that were live on hopperguard's /release-notes to
  // every signed-in resident and family member. 129 rows named an issue id.
  it.each([
    [
      "derive the menu item too, and trace the articles for every route (NEH-473)",
      "derive the menu item too, and trace the articles for every route",
    ],
    ["make the ENCRYPTION_KEY placeholder bootable (NEH-688)", "make the ENCRYPTION_KEY placeholder bootable"],
    ["add the Vitals article (NEH-99)", "add the Vitals article"],
    [
      "stop refetching the configuration bootstrap already has (NEH-312)",
      "stop refetching the configuration bootstrap already has",
    ],
  ])("removes the tracker id from %j", (input, expected) => {
    expect(scrubInternalReferences(input)).toBe(expected);
  });

  it("removes an id that appears mid-sentence, not only trailing", () => {
    expect(scrubInternalReferences("NEH-12 broke the splash, so we reverted it")).toBe(
      "broke the splash, so we reverted it",
    );
  });

  it("removes the PR marker and bare URLs", () => {
    expect(scrubInternalReferences("give the widget a scroll region (#876)")).toBe(
      "give the widget a scroll region",
    );
    expect(
      scrubInternalReferences("see https://github.com/ElderLink-Solutions/hopper-web/pull/882"),
    ).toBe("see");
  });

  it("leaves ordinary product text alone", () => {
    // The scrubber must not eat capitals that merely look like a tracker id.
    // `ISO-8601` is character-for-character the same shape as `NEH-473`, and
    // this assertion is why NON_TRACKER_PREFIXES exists — the first run of this
    // test turned "Supports ISO-8601 dates" into "Supports dates".
    for (const text of [
      "Hopper Bark now retries a failed upload",
      "Fixed the A-1 sort order on the dashboard",
      "Supports ISO-8601 dates",
      "Now uses UTF-8 throughout",
      "Follows RFC-2119 keywords",
    ]) {
      expect(scrubInternalReferences(text)).toBe(text);
    }
  });

  it("is exact when the host names its own tracker keys", () => {
    const policy = { trackerPrefixes: ["NEH"] };
    expect(scrubInternalReferences("add the Vitals article (NEH-99)", policy)).toBe(
      "add the Vitals article",
    );
    // A key this host does not use is left alone — it is somebody's product
    // name, not an id, and guessing otherwise is what mangles copy.
    expect(scrubInternalReferences("Supports the ACME-2 adapter", policy)).toBe(
      "Supports the ACME-2 adapter",
    );
    // Including standards, without needing the denylist at all.
    expect(scrubInternalReferences("Supports ISO-8601 dates", policy)).toBe(
      "Supports ISO-8601 dates",
    );
  });

  it("strips an unknown key when the host has NOT named its own", () => {
    // The guessing path: catches the common case out of the box. This is the
    // asymmetry it is tuned for — leaking an id is worse than losing a word.
    expect(scrubInternalReferences("fixed the importer (ACME-2)")).toBe("fixed the importer");
  });

  it("self-test: the stripper does not silently reduce everything to nothing", () => {
    // If the pattern ever over-matches, every leak assertion above passes
    // against empty strings while the test count still looks healthy. Assert
    // the other direction explicitly (hopperguard's CLAUDE.md, "Self-test the
    // stripper").
    const text = "Themes now load correctly when your account is still signing in.";
    expect(scrubInternalReferences(text)).toBe(text);
    expect(scrubInternalReferences(text).length).toBeGreaterThan(20);
  });

  it("tidies the whitespace and punctuation a removal leaves behind", () => {
    expect(scrubInternalReferences("fixed the thing (NEH-1) , finally")).toBe(
      "fixed the thing, finally",
    );
  });
});

describe("publicTextOf", () => {
  it("prefers a human-written summary over the commit subject", () => {
    expect(
      publicTextOf(
        entry({
          subject: "stop a failed permission lookup serving an unvalidated theme",
          summary: "Themes now load correctly when your account is still signing in.",
        }),
      ),
    ).toBe("Themes now load correctly when your account is still signing in.");
  });

  it("returns undefined when nothing survives the scrub", () => {
    // An empty bullet is worse than no bullet.
    expect(publicTextOf(entry({ subject: "NEH-473" }))).toBeUndefined();
  });
});

describe("toPublicEntry", () => {
  it("cannot carry provenance to a customer", () => {
    const result = toPublicEntry(
      entry({ prNumber: 882, commitSha: "eb458ca9", author: "jesse", subject: "fix it (NEH-1)" }),
    );
    // The point of PublicReleaseEntry being a separate type: these fields do
    // not exist on it, so a component cannot render what it cannot reach.
    expect(result).toEqual({ type: "fix", text: "fix it" });
    expect(Object.keys(result!)).not.toContain("prNumber");
    expect(Object.keys(result!)).not.toContain("commitSha");
  });

  it("drops an internal entry entirely", () => {
    expect(toPublicEntry(entry({ type: "chore" }))).toBeUndefined();
  });
});

describe("publicReleases", () => {
  const shipped = (over: Partial<Release> = {}): Release => ({
    version: "1.0.0",
    publishedAt: new Date("2026-08-15T12:00:00Z"),
    entries: [entry()],
    ...over,
  });

  it("never shows a release that has not shipped", () => {
    // The release currently deploying must not appear before it is live and
    // verified — the deploy tag and the release note make the same claim.
    expect(publicReleases([shipped({ publishedAt: null })])).toEqual([]);
    expect(publicReleases([shipped({ publishedAt: undefined })])).toEqual([]);
  });

  it("drops a release left with nothing to say", () => {
    // A deploy carrying only chore commits is frequent and real. Rendering it
    // as a dated heading with nothing under it implies something was withheld.
    expect(publicReleases([shipped({ entries: [entry({ type: "chore" })] })])).toEqual([]);
  });

  it("keeps a release that has only a summary", () => {
    const out = publicReleases([
      shipped({ entries: [entry({ type: "chore" })], summary: "Housekeeping and speed." }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].summary).toBe("Housekeeping and speed.");
    expect(out[0].entries).toEqual([]);
  });

  it("scrubs the release summary too", () => {
    const out = publicReleases([shipped({ summary: "Collections import is fixed (NEH-65)." })]);
    expect(out[0].summary).toBe("Collections import is fixed.");
  });

  it("returns newest first regardless of input order", () => {
    const out = publicReleases([
      shipped({ version: "1.0.0", publishedAt: new Date("2026-08-10T00:00:00Z") }),
      shipped({ version: "1.2.0", publishedAt: new Date("2026-08-15T00:00:00Z") }),
      shipped({ version: "1.1.0", publishedAt: new Date("2026-08-12T00:00:00Z") }),
    ]);
    expect(out.map((r) => r.version)).toEqual(["1.2.0", "1.1.0", "1.0.0"]);
  });
});
