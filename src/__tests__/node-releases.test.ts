import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseReleaseFile,
  readReleasesFromDir,
  ReleaseFileError,
  splitFrontmatter,
} from "../node/index";

const FILE = `---
version: 1.2.0
publishedAt: 2026-08-15T15:11:41Z
summary: Collections got faster, and the importer understands barcodes.
---

- feat(collections): add an item from the browser, with or without a barcode
- fix(notes): tell you when a note fails to save (#875)
- Tidied up the wording on the sign-in screen.
`;

describe("splitFrontmatter", () => {
  it("splits the block off the front", () => {
    const { meta, body } = splitFrontmatter("---\nversion: 1\n---\nhello\n");
    expect(meta).toBe("version: 1");
    expect(body.trim()).toBe("hello");
  });

  it("treats a file with no frontmatter as all body", () => {
    expect(splitFrontmatter("just text").meta).toBeNull();
  });

  it("does not mistake a horizontal rule further down for the closing fence", () => {
    const { body } = splitFrontmatter("---\nversion: 1\n---\nintro\n\n---\n\nmore\n");
    expect(body).toContain("intro");
    expect(body).toContain("more");
  });
});

describe("parseReleaseFile", () => {
  it("reads the frontmatter and the bullets", () => {
    const release = parseReleaseFile(FILE, "1.2.0.md");
    expect(release.version).toBe("1.2.0");
    expect(release.publishedAt?.toISOString()).toBe("2026-08-15T15:11:41.000Z");
    expect(release.summary).toBe("Collections got faster, and the importer understands barcodes.");
    expect(release.entries).toHaveLength(3);
    expect(release.entries[0]).toMatchObject({ type: "feat", scope: "collections" });
    expect(release.entries[1]).toMatchObject({ type: "fix", prNumber: 875 });
    // The hand-written line survives.
    expect(release.entries[2]).toMatchObject({
      type: "other",
      subject: "Tidied up the wording on the sign-in screen.",
    });
  });

  it("accepts every markdown list marker", () => {
    const release = parseReleaseFile("---\nversion: 1\n---\n- a\n* b\n+ c\n", "x.md");
    expect(release.entries.map((e) => e.subject)).toEqual(["a", "b", "c"]);
  });

  it("ignores prose that is not a bullet", () => {
    const release = parseReleaseFile(
      "---\nversion: 1\n---\nSome intro prose.\n\n- an entry\n",
      "x.md",
    );
    expect(release.entries.map((e) => e.subject)).toEqual(["an entry"]);
  });

  it("treats a version-only release with no date as unpublished", () => {
    // Which keeps it off the public page until someone dates it — the same
    // rule the deploy-driven hosts follow.
    expect(parseReleaseFile("---\nversion: 1\n---\n- a\n", "x.md").publishedAt).toBeNull();
  });

  it("reads a numeric version without turning it into a number", () => {
    // `version: 1.2` is a YAML float. Stringifying at the boundary keeps
    // "1.20" from silently becoming "1.2".
    expect(parseReleaseFile("---\nversion: 2026.08\n---\n", "x.md").version).toBe("2026.08");
  });

  it.each([
    ["no frontmatter block", "no frontmatter at all\n"],
    ["frontmatter has no `version`", "---\nsummary: hi\n---\n"],
    ["`publishedAt` is not a date", "---\nversion: 1\npublishedAt: soonish\n---\n"],
  ])("refuses %j, naming the file", (message, source) => {
    // Refused, not defaulted. A release that silently gets today's date or a
    // made-up version puts a wrong answer where a missing one would have been
    // obvious on the first read.
    expect(() => parseReleaseFile(source, "broken.md")).toThrow(ReleaseFileError);
    expect(() => parseReleaseFile(source, "broken.md")).toThrow(/broken\.md/);
    // Substring match, not a regex built from the message — the messages carry
    // backticks, and escaping them into a pattern is how an assertion ends up
    // testing a string neither side ever produces.
    expect(() => parseReleaseFile(source, "broken.md")).toThrow(message);
  });

  it("names the file when the YAML itself is malformed", () => {
    expect(() => parseReleaseFile("---\nversion: [1\n---\n", "bad.md")).toThrow(/bad\.md/);
  });
});

describe("readReleasesFromDir", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "release-notes-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads every markdown file and ignores anything else", () => {
    writeFileSync(join(dir, "1.2.0.md"), FILE);
    writeFileSync(join(dir, "1.10.0.md"), "---\nversion: 1.10.0\n---\n- a\n");
    writeFileSync(join(dir, "README.txt"), "not a release");
    mkdirSync(join(dir, "drafts"));

    const releases = readReleasesFromDir(dir);
    expect(releases.map((r) => r.version).sort()).toEqual(["1.10.0", "1.2.0"]);
  });

  it("does not sort by filename", () => {
    // Ordering is publicReleases' job, by date — precisely so `1.9.0.md`
    // cannot end up above `1.10.0.md`.
    writeFileSync(join(dir, "1.9.0.md"), "---\nversion: 1.9.0\n---\n- a\n");
    writeFileSync(join(dir, "1.10.0.md"), "---\nversion: 1.10.0\n---\n- a\n");
    expect(readReleasesFromDir(dir)).toHaveLength(2);
  });

  it("lets one broken file fail the read rather than quietly skipping it", () => {
    writeFileSync(join(dir, "good.md"), "---\nversion: 1\n---\n- a\n");
    writeFileSync(join(dir, "bad.md"), "no frontmatter\n");
    expect(() => readReleasesFromDir(dir)).toThrow(/bad\.md/);
  });
});
