import { parseConventionalSubject, parseEntryLine } from "../entry";

describe("parseConventionalSubject", () => {
  it("reads type, scope, subject and the breaking marker", () => {
    expect(parseConventionalSubject("feat(collections)!: drop the legacy importer")).toEqual({
      type: "feat",
      scope: "collections",
      subject: "drop the legacy importer",
      breaking: true,
    });
  });

  it("omits an absent scope rather than emitting undefined", () => {
    expect(parseConventionalSubject("fix: stop the flicker")).toEqual({
      type: "fix",
      subject: "stop the flicker",
      breaking: false,
    });
  });

  it("strips the squash-merge PR marker from the subject", () => {
    expect(parseConventionalSubject("fix(notes): tell the user when a save fails (#875)")?.subject).toBe(
      "tell the user when a save fails",
    );
  });

  it("rejects a capitalised type rather than accepting it as a new one", () => {
    // `Feat` and `feat` look identical in a diff and would classify
    // differently in the visibility policy. Better to not match at all.
    expect(parseConventionalSubject("Feat: add a thing")).toBeNull();
  });

  it("returns null for a plain sentence", () => {
    expect(parseConventionalSubject("We tidied up the sign-in screen.")).toBeNull();
  });

  it("does not mistake a colon in ordinary prose for a type", () => {
    expect(parseConventionalSubject("Note: this changes nothing")).toBeNull();
  });
});

describe("parseEntryLine", () => {
  it("keeps a hand-written sentence instead of dropping it", () => {
    // The deliberate difference from the git-walking scripts: there, a
    // non-conforming subject is noise; here it is the best kind of entry, and
    // discarding it would lose exactly the copy a human took trouble over.
    expect(parseEntryLine("We tidied up the sign-in screen.")).toEqual({
      type: "other",
      subject: "We tidied up the sign-in screen.",
    });
  });

  it("takes the host's fallback type when given one", () => {
    expect(parseEntryLine("Something happened", { defaultType: "feat" }).type).toBe("feat");
  });

  it("captures the PR number as provenance rather than leaving it in the text", () => {
    // Provenance belongs in the internal shape. The public shape has no field
    // for it, so this is where it stops being part of the sentence.
    expect(parseEntryLine("fix(notes): tell the user when a save fails (#875)")).toEqual({
      type: "fix",
      scope: "notes",
      subject: "tell the user when a save fails",
      prNumber: 875,
    });
  });

  it("captures the PR number off a non-conventional line too", () => {
    expect(parseEntryLine("Tidied the sign-in screen (#12)")).toEqual({
      type: "other",
      subject: "Tidied the sign-in screen",
      prNumber: 12,
    });
  });

  it("omits breaking rather than emitting false", () => {
    expect(parseEntryLine("fix: a thing")).not.toHaveProperty("breaking");
    expect(parseEntryLine("fix!: a thing").breaking).toBe(true);
  });
});
