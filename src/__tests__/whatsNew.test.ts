import { whatsNew } from "../whatsNew";
import type { PublicRelease } from "../types";

/** Newest first, as `publicReleases` returns them. */
const RELEASES: PublicRelease[] = [
  { version: "1.4.0", publishedAt: new Date("2026-08-15T10:00:00Z"), entries: [] },
  { version: "1.3.0", publishedAt: new Date("2026-08-14T10:00:00Z"), entries: [] },
  { version: "1.2.0", publishedAt: new Date("2026-08-13T10:00:00Z"), entries: [] },
  { version: "1.1.0", publishedAt: new Date("2026-08-12T10:00:00Z"), entries: [] },
  { version: "1.0.0", publishedAt: new Date("2026-08-11T10:00:00Z"), entries: [] },
];

describe("whatsNew", () => {
  it("returns what shipped after the reader's last seen version", () => {
    const result = whatsNew(RELEASES, { lastSeenVersion: "1.2.0" });
    expect(result.releases.map((r) => r.version)).toEqual(["1.4.0", "1.3.0"]);
    expect(result.hasNews).toBe(true);
    expect(result.totalUnseen).toBe(2);
  });

  it("says there is nothing new when the reader is current", () => {
    const result = whatsNew(RELEASES, { lastSeenVersion: "1.4.0" });
    expect(result.hasNews).toBe(false);
    expect(result.releases).toEqual([]);
  });

  it("shows a brand-new reader nothing, but records where they came in", () => {
    // Greeting someone who just signed up with a modal listing the last five
    // deploys is the wrong first impression, and it is not "news" to them.
    // The watermark is set now so their SECOND visit is meaningful.
    const result = whatsNew(RELEASES, undefined);
    expect(result.hasNews).toBe(false);
    expect(result.releases).toEqual([]);
    expect(result.acknowledgeVersion).toBe("1.4.0");
  });

  it("caps the prompt but reports the true total", () => {
    const result = whatsNew(RELEASES, { lastSeenVersion: "1.0.0" }, { limit: 2 });
    expect(result.releases.map((r) => r.version)).toEqual(["1.4.0", "1.3.0"]);
    // So a host can honestly say "and 2 more" rather than implying it showed
    // everything.
    expect(result.totalUnseen).toBe(4);
  });

  it("shows nothing rather than everything when the watermark names an unknown version", () => {
    // Rolled back, renamed, or aged out of the list. Reading that as "the
    // reader has seen nothing" produces a forty-release modal, which is a far
    // worse failure than a missed prompt.
    const result = whatsNew(RELEASES, { lastSeenVersion: "0.9.0-gone" });
    expect(result.hasNews).toBe(false);
    expect(result.totalUnseen).toBe(0);
  });

  it("falls back to the timestamp when the version is unknown but a time was recorded", () => {
    const result = whatsNew(RELEASES, {
      lastSeenVersion: "0.9.0-gone",
      lastSeenAt: new Date("2026-08-13T12:00:00Z"),
    });
    expect(result.releases.map((r) => r.version)).toEqual(["1.4.0", "1.3.0"]);
  });

  it("uses the timestamp when that is all the host recorded", () => {
    const result = whatsNew(RELEASES, { lastSeenAt: new Date("2026-08-14T00:00:00Z") });
    expect(result.releases.map((r) => r.version)).toEqual(["1.4.0", "1.3.0"]);
  });

  it("always offers the newest version to acknowledge", () => {
    // Storing this is what advances the watermark; it must be the newest
    // release the reader was shown the existence of, not the newest they read.
    expect(whatsNew(RELEASES, { lastSeenVersion: "1.2.0" }).acknowledgeVersion).toBe("1.4.0");
    expect(whatsNew(RELEASES, { lastSeenVersion: "1.4.0" }).acknowledgeVersion).toBe("1.4.0");
  });

  it("copes with an empty release list", () => {
    const result = whatsNew([], { lastSeenVersion: "1.0.0" });
    expect(result.hasNews).toBe(false);
    expect(result.acknowledgeVersion).toBeUndefined();
  });
});
