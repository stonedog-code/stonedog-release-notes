/**
 * Turning a line of text into a release entry.
 *
 * Every host that derives release notes from git ends up writing this, because
 * the Conventional Commits grammar is what a PR title already follows. Having
 * it here means the parse and the audience rules that key off `type` cannot
 * drift apart — the classification in visibility.ts is only as good as the
 * `type` this produces.
 *
 * A line that is NOT conventional is kept, not dropped. That is a deliberate
 * difference from the git-walking scripts this replaces: those scan a commit
 * log, where a non-conforming subject really is noise. This also serves
 * hand-written release notes, where a plain sentence is the *best* kind of
 * entry — and silently discarding one because it lacks a `feat:` prefix would
 * lose exactly the copy a human took the trouble to write.
 */
import type { ReleaseEntry } from "./types";

export interface ParsedSubject {
  type: string;
  scope?: string;
  subject: string;
  breaking: boolean;
}

/**
 * `type(scope)!: subject`.
 *
 * Lowercase type only — `Feat: x` is a typo, not a type, and accepting it means
 * `Feat` and `feat` classify differently in the visibility policy while looking
 * identical in a diff. The scope is anything but a closing paren.
 */
const CONVENTIONAL =
  /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s*(?<subject>.+)$/;

/** GitHub's squash-merge marker, which is provenance rather than content. */
const PR_MARKER = /\s*\(#(\d+)\)\s*$/;

/**
 * Parse a Conventional Commits subject, or null when the line is not one.
 *
 * Null rather than a guess: a caller that wants a fallback can say so, and one
 * that needs to know whether the grammar was followed can ask.
 */
export function parseConventionalSubject(line: string): ParsedSubject | null {
  const match = line.trim().match(CONVENTIONAL);
  if (!match?.groups) return null;
  const { type, scope, breaking, subject } = match.groups;
  return {
    type,
    ...(scope ? { scope } : {}),
    subject: subject.replace(PR_MARKER, "").trim(),
    breaking: Boolean(breaking),
  };
}

export interface ParseEntryOptions {
  /**
   * Type given to a line that does not follow the grammar. Defaults to
   * `"other"`, which every visibility policy treats as public — a sentence
   * somebody wrote by hand is meant to be read.
   */
  defaultType?: string;
}

/**
 * A line of release-note text as a {@link ReleaseEntry}.
 *
 * The PR number is captured into `prNumber` rather than left in the subject.
 * It is provenance: useful internally, and never shown to a customer — the
 * public shape has no field for it.
 */
export function parseEntryLine(line: string, options: ParseEntryOptions = {}): ReleaseEntry {
  const text = line.trim();
  const prNumber = Number.parseInt(text.match(PR_MARKER)?.[1] ?? "", 10);
  const parsed = parseConventionalSubject(text);

  const base: ReleaseEntry = parsed
    ? {
        type: parsed.type,
        ...(parsed.scope ? { scope: parsed.scope } : {}),
        subject: parsed.subject,
        ...(parsed.breaking ? { breaking: true } : {}),
      }
    : { type: options.defaultType ?? "other", subject: text.replace(PR_MARKER, "").trim() };

  return Number.isNaN(prNumber) ? base : { ...base, prNumber };
}
