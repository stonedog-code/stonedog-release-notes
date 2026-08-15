/**
 * Deciding what a customer may read, and scrubbing what reaches them.
 *
 * Two separate jobs, and conflating them is how hopperguard shipped 129 public
 * release rows naming internal Linear issue ids (NEH-744):
 *
 *   1. WHICH entries a customer sees — a policy question, answered from the
 *      conventional-commit type unless the host says otherwise.
 *   2. WHAT TEXT those entries carry — a scrubbing question, and the answer is
 *      never "the commit subject verbatim". A conventional-commit subject is
 *      written by a maintainer mid-debugging, so internal detail is exactly
 *      what is in their head at the time.
 *
 * Getting (1) right and skipping (2) is what happened: only `chore`/`ci`/`test`
 * were hidden, and every surviving `fix:` line went out with its issue id
 * attached.
 */
import type {
  EntryAudience,
  PublicRelease,
  PublicReleaseEntry,
  Release,
  ReleaseEntry,
} from "./types";

/**
 * Types hidden from customers by default.
 *
 * These describe work on the codebase rather than changes to the product, so
 * they are noise at best. `docs` is deliberately NOT here — a documentation
 * change is often exactly what a user wants to hear about — and `refactor` is
 * deliberately NOT here either, because the host may reasonably want to say
 * "we reworked how this page loads". Override with `internalTypes` if you
 * disagree; the point is that the default is stated rather than assumed.
 */
export const DEFAULT_INTERNAL_TYPES: readonly string[] = ["chore", "ci", "test", "style", "build"];

/**
 * Prefixes that look exactly like a tracker key and are not one.
 *
 * `ISO-8601`, `UTF-8`, `RFC-2119` and `NEH-473` are the same shape, and no
 * regex can tell them apart — this list is the difference between "Supports
 * ISO-8601 dates" surviving and becoming "Supports dates". Found by the
 * scrubber's own test on its first run, which is the reason that test asserts
 * BOTH directions: a stripper that over-matches makes every leak assertion
 * pass against mangled text, and the file count still looks healthy.
 *
 * It is necessarily incomplete, which is why {@link VisibilityPolicy.trackerPrefixes}
 * exists and why the README tells hosts to set it. A host that names its own
 * keys gets exact behaviour and needs none of this guesswork.
 */
export const NON_TRACKER_PREFIXES: readonly string[] = [
  "ISO", "UTF", "RFC", "ASCII", "SHA", "MD", "AES", "RSA", "HTTP", "HTTPS",
  "IPV", "UTC", "GMT", "WCAG", "HIPAA", "SOC", "PCI", "GDPR", "COVID", "ES",
  "ECMA", "IEEE", "ANSI", "USB", "PDF", "MP", "H", "A", "B", "C",
];

/**
 * A tracker id: `NEH-473`, `PROJ-1`, `ABC-12345`, optionally bracketed.
 *
 * Anchored to word boundaries so it cannot eat part of a real word, and applied
 * to the whole string rather than only the end — these appear mid-sentence as
 * often as they trail.
 *
 * Scrubbing is a floor, not a guarantee. It cannot know that "the Bark sidecar"
 * is an internal service name, or that "delete the Guide widget, which nothing
 * renders" reads to a customer as an admission rather than an improvement. That
 * is why `summary` exists and why everything here prefers it: scrubbing makes
 * maintainer text *safer*, never *good*.
 */
const ANY_TRACKER_ID = /\s*[([]?\b([A-Z][A-Z0-9]{0,9})-\d+\b[)\]]?/g;
const PR_MARKER = /\s*\(#\d+\)/g;
/** Bare URLs — an internal wiki or repository link has no place in customer copy. */
const URL = /\s*<?https?:\/\/\S+>?/g;

export interface VisibilityPolicy {
  /** Types hidden from customers. Defaults to {@link DEFAULT_INTERNAL_TYPES}. */
  internalTypes?: readonly string[];
  /**
   * The issue-tracker keys this host uses — `["NEH"]`, `["PROJ", "OPS"]`.
   *
   * **Set this.** Given it, only those keys are stripped and nothing else can
   * be caught by accident. Omitted, the scrubber falls back to matching the
   * generic shape minus {@link NON_TRACKER_PREFIXES}, which catches the common
   * case but is guessing — and a guess that is too eager quietly mangles
   * product copy, while one that is too shy leaks an id.
   */
  trackerPrefixes?: readonly string[];
}

export interface ScrubOptions {
  trackerPrefixes?: readonly string[];
}

/**
 * Where a single entry may be shown.
 *
 * An explicit `audience` on the entry always wins — that is a human decision
 * about this specific change, and a type-based rule has no business overruling
 * it in either direction.
 */
export function audienceOf(entry: ReleaseEntry, policy: VisibilityPolicy = {}): EntryAudience {
  if (entry.audience) return entry.audience;
  const internal = policy.internalTypes ?? DEFAULT_INTERNAL_TYPES;
  return internal.includes(entry.type) ? "internal" : "public";
}

/**
 * Strip tracker ids, PR markers and URLs from a line of text.
 *
 * Exported because it is worth testing directly and worth reusing: a host
 * migrating existing rows needs exactly this function, and a second
 * implementation would drift from this one.
 */
export function scrubInternalReferences(text: string, options: ScrubOptions = {}): string {
  const stripped = text
    .replace(PR_MARKER, "")
    .replace(URL, "")
    .replace(ANY_TRACKER_ID, (match, prefix: string) => {
      // With explicit keys, strip only those: exact, and nothing else can be
      // caught by accident.
      if (options.trackerPrefixes) {
        return options.trackerPrefixes.includes(prefix) ? "" : match;
      }
      // Guessing. Keep anything that is a known technical standard.
      return NON_TRACKER_PREFIXES.includes(prefix) ? match : "";
    });

  return stripped
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

/**
 * The customer-facing text for an entry: its `summary` when someone wrote one,
 * otherwise its subject with internal references removed.
 *
 * Returns undefined when nothing survives — a subject that was ONLY a tracker
 * id leaves an empty line, and an empty bullet is worse than no bullet.
 */
export function publicTextOf(entry: ReleaseEntry, policy: VisibilityPolicy = {}): string | undefined {
  const source = entry.summary?.trim() || entry.subject;
  const scrubbed = scrubInternalReferences(source ?? "", policy);
  return scrubbed.length > 0 ? scrubbed : undefined;
}

/** One entry, reduced to what a customer may see. */
export function toPublicEntry(
  entry: ReleaseEntry,
  policy: VisibilityPolicy = {},
): PublicReleaseEntry | undefined {
  if (audienceOf(entry, policy) === "internal") return undefined;
  const text = publicTextOf(entry, policy);
  if (!text) return undefined;
  return {
    type: entry.type,
    ...(entry.scope ? { scope: entry.scope } : {}),
    text,
    ...(entry.breaking ? { breaking: true } : {}),
  };
}

/**
 * Every release a customer may read, newest first.
 *
 * Drops, in order:
 *   - releases that have not shipped (no `publishedAt`) — the release currently
 *     deploying must not appear before it is live and verified;
 *   - internal entries;
 *   - releases left with nothing to say.
 *
 * That last rule matters more than it looks. A deploy carrying only `chore`
 * commits is a real and frequent event, and rendering it as a dated heading
 * with no content underneath tells a customer nothing while implying something
 * was withheld.
 */
export function publicReleases(
  releases: readonly Release[],
  policy: VisibilityPolicy = {},
): PublicRelease[] {
  const out: PublicRelease[] = [];

  for (const release of releases) {
    if (!release.publishedAt) continue;

    const entries = release.entries
      .map((entry) => toPublicEntry(entry, policy))
      .filter((entry): entry is PublicReleaseEntry => entry !== undefined);

    const summary = release.summary?.trim()
      ? scrubInternalReferences(release.summary, policy)
      : undefined;

    if (entries.length === 0 && !summary) continue;

    out.push({
      version: release.version,
      publishedAt: release.publishedAt,
      ...(summary ? { summary } : {}),
      entries,
    });
  }

  return out.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}
