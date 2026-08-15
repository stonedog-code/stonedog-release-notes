import { compareVersionsDesc, groupReleasesByDay, localDayKey } from "../group";

const at = (iso: string, version: string) => ({ version, publishedAt: new Date(iso) });

describe("localDayKey", () => {
  it("reads LOCAL date parts, matching what a date formatter shows", () => {
    // The trap this module exists for: `toISOString().slice(0,10)` is UTC,
    // while the page renders with toLocaleDateString(). Where the two disagree
    // a release renders under a heading naming a different day.
    const d = new Date(2026, 7, 15, 23, 30); // 15 Aug, local, whatever the zone
    expect(localDayKey(d)).toBe("2026-08-15");
  });

  it("zero-pads so the key sorts lexicographically", () => {
    expect(localDayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("agrees with the formatter for a late-evening release", () => {
    // The actual regression, stated as the invariant rather than a fixed
    // string: whatever zone the runtime is in, the key and the rendered date
    // must name the same day.
    const d = new Date(2026, 6, 29, 23, 30);
    expect(localDayKey(d)).toBe(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  });
});

describe("compareVersionsDesc", () => {
  it("compares numerically, so 0.10.0 is newer than 0.9.0", () => {
    // A string compare gets this exactly backwards.
    expect(compareVersionsDesc("0.10.0", "0.9.0")).toBeLessThan(0);
    expect([..."0.9.0 0.10.0 0.2.0".split(" ")].sort(compareVersionsDesc)).toEqual([
      "0.10.0",
      "0.9.0",
      "0.2.0",
    ]);
  });

  it("falls back to a string compare rather than dropping a non-numeric version", () => {
    expect(() => compareVersionsDesc("2026.08.15", "next")).not.toThrow();
  });
});

describe("groupReleasesByDay", () => {
  it("groups by day, newest day first and newest version within the day", () => {
    const groups = groupReleasesByDay([
      at("2026-08-14T12:00:00", "1.1.0"),
      at("2026-08-15T09:00:00", "1.2.0"),
      at("2026-08-15T17:00:00", "1.10.0"),
    ]);
    expect(groups.map((g) => g.dayKey)).toEqual(["2026-08-15", "2026-08-14"]);
    expect(groups[0].releases.map((r) => r.version)).toEqual(["1.10.0", "1.2.0"]);
  });

  it("keeps a release with an unusable date instead of dropping it", () => {
    // A note that silently vanishes because of a bad timestamp looks exactly
    // like nothing having shipped — the hardest failure to notice.
    const groups = groupReleasesByDay([
      at("2026-08-15T09:00:00", "1.2.0"),
      { version: "bad", publishedAt: new Date("not a date") },
    ]);
    expect(groups.at(-1)?.dayKey).toBe("unknown");
    expect(groups.at(-1)?.releases.map((r) => r.version)).toEqual(["bad"]);
  });

  it("returns nothing for nothing", () => {
    expect(groupReleasesByDay([])).toEqual([]);
  });
});
