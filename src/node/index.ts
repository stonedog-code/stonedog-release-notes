/**
 * Reading releases from files on disk.
 *
 * The `node` subpath exists for hosts with no database. stonedogcode is a
 * static site; optimafilings and rozcards have databases but may still prefer
 * hand-written notes to anything derived from commits. For all of them a
 * release is a markdown file, checked in, reviewed like any other change.
 *
 * Kept out of the main entry point on purpose: importing this pulls in `fs`,
 * which breaks a browser bundle. The split is the same one `@stonedogcode/howto`
 * makes for the same reason.
 *
 * ```markdown
 * ---
 * version: 1.2.0
 * publishedAt: 2026-08-15T15:11:41Z
 * summary: Collections got faster, and the importer understands barcodes.
 * ---
 *
 * - feat(collections): add an item from the browser, with or without a barcode
 * - fix(notes): tell you when a note fails to save
 * - Tidied up the wording on the sign-in screen.
 * ```
 *
 * The last line has no `type:` prefix and is kept anyway — see entry.ts. A
 * sentence a human wrote is the best kind of release note, and dropping it for
 * failing a grammar meant for commit subjects would be exactly backwards.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { parseEntryLine, type ParseEntryOptions } from "../entry";
import type { Release, ReleaseEntry } from "../types";

/** Thrown with the offending file named — a silent skip hides a typo forever. */
export class ReleaseFileError extends Error {
  constructor(
    message: string,
    readonly file: string,
  ) {
    super(`${file}: ${message}`);
    this.name = "ReleaseFileError";
  }
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Split `---\n…\n---` off the front. Returns the whole text as body if absent. */
export function splitFrontmatter(source: string): { meta: string | null; body: string } {
  const match = source.match(FRONTMATTER);
  if (!match) return { meta: null, body: source };
  return { meta: match[1], body: source.slice(match[0].length) };
}

/**
 * Bullet lines in the body. `-`, `*` and `+` are all markdown list markers, and
 * a release note written by hand will use whichever the author is used to.
 */
const BULLET = /^\s*[-*+]\s+(.*)$/;

/** Parse one release file's text. */
export function parseReleaseFile(
  source: string,
  file: string,
  options: ParseEntryOptions = {},
): Release {
  const { meta, body } = splitFrontmatter(source);
  if (!meta) throw new ReleaseFileError("no frontmatter block", file);

  let front: Record<string, unknown>;
  try {
    front = (parseYaml(meta) ?? {}) as Record<string, unknown>;
  } catch (error) {
    throw new ReleaseFileError(
      `frontmatter is not valid YAML — ${(error as Error).message}`,
      file,
    );
  }

  const version = front.version;
  if (typeof version !== "string" && typeof version !== "number") {
    // Refused rather than defaulted. A release with no version cannot be
    // ordered, deduplicated, or used as a what's-new watermark, and inventing
    // one puts a wrong answer where a missing one would have been obvious.
    throw new ReleaseFileError("frontmatter has no `version`", file);
  }

  let publishedAt: Date | null = null;
  if (front.publishedAt !== undefined && front.publishedAt !== null) {
    const parsed =
      front.publishedAt instanceof Date ? front.publishedAt : new Date(String(front.publishedAt));
    if (Number.isNaN(parsed.getTime())) {
      throw new ReleaseFileError(`\`publishedAt\` is not a date: ${front.publishedAt}`, file);
    }
    publishedAt = parsed;
  }

  const entries: ReleaseEntry[] = [];
  for (const line of body.split(/\r?\n/)) {
    const bullet = line.match(BULLET);
    if (!bullet) continue;
    const text = bullet[1].trim();
    if (text) entries.push(parseEntryLine(text, options));
  }

  const summary = typeof front.summary === "string" ? front.summary.trim() : undefined;

  return {
    version: String(version),
    publishedAt,
    ...(summary ? { summary } : {}),
    entries,
  };
}

export interface ReadReleasesOptions extends ParseEntryOptions {
  /** File extensions to read. Defaults to `.md`. */
  extensions?: readonly string[];
}

/**
 * Every release file in a directory.
 *
 * Not sorted here: ordering is `publicReleases`' job, and it sorts by date
 * rather than by filename precisely so a file named `1.9.0.md` cannot end up
 * above `1.10.0.md`.
 *
 * The directory is read shallowly. A release is one file; nesting would imply a
 * grouping this package does not model.
 */
export function readReleasesFromDir(dir: string, options: ReadReleasesOptions = {}): Release[] {
  const extensions = options.extensions ?? [".md"];
  const files = readdirSync(dir).filter((name) =>
    extensions.some((extension) => name.endsWith(extension)),
  );

  return files.map((name) =>
    parseReleaseFile(readFileSync(join(dir, name), "utf-8"), name, options),
  );
}
