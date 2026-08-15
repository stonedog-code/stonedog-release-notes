/**
 * Grouping a release's entries into the sections a reader recognises.
 *
 * "New features", "Fixes", "Improvements" — not `feat`, `fix`, `perf`. The
 * conventional-commit type is a maintainer's vocabulary; a customer reading a
 * release note has never agreed to learn it.
 *
 * Pure and separate from the components on purpose: a host that writes its own
 * markup still wants this mapping, and two copies of it would drift into two
 * different answers about where a `refactor` belongs.
 */
import type { PublicReleaseEntry } from "./types";

export interface SectionDef {
  /** Stable id, for a React key or a CSS hook. */
  id: string;
  /** What the reader sees. */
  label: string;
  /** Conventional-commit types filed under it. */
  types: readonly string[];
}

/**
 * The default arrangement, in the order a reader wants it: what is new, then
 * what is fixed, then what got better, then everything else.
 *
 * `docs` sits under "Improvements" rather than a section of its own — a
 * customer does not distinguish "we documented it" from "we improved it", and a
 * section holding one item most releases is noise.
 *
 * Types NOT listed here fall into "Other" rather than being dropped. That
 * includes `other`, which is what a hand-written sentence gets, so plain prose
 * lands somewhere sensible without the host configuring anything.
 */
export const DEFAULT_SECTIONS: readonly SectionDef[] = [
  { id: "features", label: "New features", types: ["feat"] },
  { id: "fixes", label: "Fixes", types: ["fix", "bug"] },
  { id: "improvements", label: "Improvements", types: ["perf", "refactor", "docs"] },
];

/** The section holding anything the definitions do not claim. */
export const OTHER_SECTION: SectionDef = { id: "other", label: "Other changes", types: [] };

export interface EntrySection {
  id: string;
  label: string;
  entries: PublicReleaseEntry[];
}

export interface GroupBySectionOptions {
  sections?: readonly SectionDef[];
  /**
   * Label for the catch-all. Defaults to "Other changes"; pass `null` to drop
   * unclaimed entries instead of showing them — a host that has enumerated
   * every type it emits may prefer silence to a bucket.
   */
  otherLabel?: string | null;
}

/**
 * Arrange entries into sections, in the definitions' order, dropping any
 * section that ends up empty.
 *
 * Breaking changes are NOT separated out here. They are marked per entry, so a
 * host can render the marker inline where the reader is already looking —
 * pulling them into their own section at the top makes every release with one
 * read like an incident, and buries the change away from its own context.
 */
export function groupBySection(
  entries: readonly PublicReleaseEntry[],
  options: GroupBySectionOptions = {},
): EntrySection[] {
  const sections = options.sections ?? DEFAULT_SECTIONS;
  const otherLabel = options.otherLabel === undefined ? OTHER_SECTION.label : options.otherLabel;

  const byId = new Map<string, PublicReleaseEntry[]>();
  const other: PublicReleaseEntry[] = [];

  for (const entry of entries) {
    const section = sections.find((candidate) => candidate.types.includes(entry.type));
    if (!section) {
      other.push(entry);
      continue;
    }
    const bucket = byId.get(section.id);
    if (bucket) bucket.push(entry);
    else byId.set(section.id, [entry]);
  }

  const out: EntrySection[] = [];
  for (const section of sections) {
    const found = byId.get(section.id);
    if (found?.length) out.push({ id: section.id, label: section.label, entries: found });
  }
  if (other.length > 0 && otherLabel !== null) {
    out.push({ id: OTHER_SECTION.id, label: otherLabel, entries: other });
  }
  return out;
}
