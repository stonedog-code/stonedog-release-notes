/**
 * Grouping releases by the day they shipped.
 *
 * Several deploys a day is normal, and a flat list of twelve versions dated
 * "15 August" four times over reads as noise. Grouping by day and then by
 * version within the day is what makes the page scannable.
 *
 * THE TIMEZONE TRAP, which this module exists to solve exactly once.
 *
 * A page renders each date with something like `toLocaleDateString()` — the
 * runtime's LOCAL zone. Deriving the grouping key any other way (the obvious
 * `toISOString().slice(0, 10)` is UTC) makes a release published at 23:30Z
 * render "August 14" inside a group headed "August 15". On a developer's
 * machine west of UTC the two agree and everything looks right; production runs
 * UTC, where they do not.
 *
 * So the key is built from local date parts — the same ones the formatter
 * reads. Ported from hopperguard's `group-by-day.ts` (NEH-103), where this had
 * already reached production once as a day-shifted heading.
 */

/** The minimum a release needs in order to be grouped. */
export interface DatedRelease {
  version: string;
  publishedAt: Date;
}

export interface ReleaseDayGroup<T extends DatedRelease> {
  /** Sortable local-day key, `YYYY-MM-DD`. Stable enough for a React key. */
  dayKey: string;
  /** A Date inside that day, for the caller to format however it likes. */
  date: Date;
  /** Newest version first. */
  releases: T[];
}

/** `YYYY-MM-DD` in the LOCAL zone. Not `toISOString()` — see the note above. */
export function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Compare two version strings numerically, newest first — so `0.9.0` sorts
 * below `0.10.0` rather than above it, which a string compare gets backwards.
 * Non-numeric segments fall back to a string compare so nothing is dropped.
 */
export function compareVersionsDesc(a: string, b: string): number {
  const parts = (v: string) => v.split(".").map((p) => Number.parseInt(p, 10));
  const av = parts(a);
  const bv = parts(b);
  for (let i = 0; i < Math.max(av.length, bv.length); i++) {
    const x = av[i];
    const y = bv[i];
    if (Number.isNaN(x) || Number.isNaN(y) || x === undefined || y === undefined) {
      return b.localeCompare(a);
    }
    if (x !== y) return y - x;
  }
  return 0;
}

/**
 * Group releases into days, newest day first, newest version first within each.
 *
 * A release carrying an unparseable date is kept in a trailing `unknown` group
 * rather than dropped. A note that silently vanishes because of a bad timestamp
 * is worse than one filed under an odd heading — the first looks like nothing
 * shipped, which is precisely the failure that is hardest to notice.
 */
export function groupReleasesByDay<T extends DatedRelease>(
  releases: readonly T[],
): ReleaseDayGroup<T>[] {
  const groups = new Map<string, ReleaseDayGroup<T>>();
  const undated: T[] = [];

  for (const release of releases) {
    const date = release.publishedAt;
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      undated.push(release);
      continue;
    }
    const dayKey = localDayKey(date);
    const existing = groups.get(dayKey);
    if (existing) existing.releases.push(release);
    else groups.set(dayKey, { dayKey, date, releases: [release] });
  }

  const ordered = [...groups.values()]
    .sort((a, b) => (a.dayKey < b.dayKey ? 1 : a.dayKey > b.dayKey ? -1 : 0))
    .map((group) => ({
      ...group,
      releases: [...group.releases].sort((a, b) => compareVersionsDesc(a.version, b.version)),
    }));

  if (undated.length > 0) {
    ordered.push({ dayKey: "unknown", date: new Date(NaN), releases: undated });
  }

  return ordered;
}
