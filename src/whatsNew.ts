/**
 * "What's new since you last looked."
 *
 * The host owns the watermark — where it is stored, and whether this reader
 * should be prompted at all. This package owns only the comparison, because
 * the storage answer differs per product (a user column, a cookie, local
 * storage) and none of them is this package's business.
 *
 * The shape is deliberately a pure function plus a decision object, so a host
 * can render the prompt however it likes — a dialog, a banner, a dot on a menu
 * item — without this package having an opinion about its own UI.
 */
import type { PublicRelease } from "./types";

/** How a reader is identified for what's-new purposes. */
export interface WhatsNewWatermark {
  /**
   * The last release the reader has already seen, as a version string, or the
   * time they last looked. Version is preferred: a clock comparison is one
   * timezone bug away from either spamming or silently skipping a release.
   */
  lastSeenVersion?: string;
  /** Fallback when no version was recorded — e.g. an account created mid-week. */
  lastSeenAt?: Date;
}

export interface WhatsNewOptions {
  /**
   * Cap on how many releases a single prompt describes. A reader returning
   * after a month does not want forty versions; they want the recent ones and
   * a link to the rest. Defaults to 5. Pass `Infinity` to disable.
   */
  limit?: number;
}

export interface WhatsNew {
  /** Releases the reader has not seen, newest first, capped by `limit`. */
  releases: PublicRelease[];
  /** True when there is something worth showing. */
  hasNews: boolean;
  /**
   * How many unseen releases there were before `limit` was applied, so a host
   * can say "and 12 more" honestly rather than implying it showed everything.
   */
  totalUnseen: number;
  /**
   * The version to store once the reader has acknowledged the prompt. Undefined
   * when there is nothing new — writing a watermark then would be a no-op at
   * best and, if the list were empty for the wrong reason, would silently skip
   * whatever the reader never saw.
   */
  acknowledgeVersion?: string;
}

/**
 * Which published releases a reader has not seen yet.
 *
 * `releases` must already be public (see `publicReleases`) and newest first —
 * this function does not filter by audience, and passing raw internal releases
 * here would put chore commits in a customer's face. That is enforced by the
 * type: {@link PublicRelease} cannot carry provenance.
 *
 * A reader with NO watermark at all is treated as having seen everything, not
 * as having seen nothing. Someone who has just signed up should not be greeted
 * by a modal listing the last five deploys; the watermark is set on their first
 * visit and the prompt starts working from their second.
 */
export function whatsNew(
  releases: readonly PublicRelease[],
  watermark: WhatsNewWatermark | undefined,
  options: WhatsNewOptions = {},
): WhatsNew {
  const limit = options.limit ?? 5;
  const newest = releases[0];

  if (!watermark || (!watermark.lastSeenVersion && !watermark.lastSeenAt)) {
    return {
      releases: [],
      hasNews: false,
      totalUnseen: 0,
      // Still offer a version to store: this is the "first visit" case, and
      // recording it now is what makes the SECOND visit meaningful.
      ...(newest ? { acknowledgeVersion: newest.version } : {}),
    };
  }

  let unseen: PublicRelease[];
  if (watermark.lastSeenVersion) {
    const index = releases.findIndex((r) => r.version === watermark.lastSeenVersion);
    // A watermark naming a version we cannot find — rolled back, renamed, or
    // aged out of the list — must not be read as "everything is new". Fall back
    // to the timestamp if there is one, and otherwise show nothing rather than
    // everything: a spurious forty-release modal is a worse failure than a
    // missed prompt.
    if (index >= 0) unseen = releases.slice(0, index);
    else if (watermark.lastSeenAt) unseen = sinceTime(releases, watermark.lastSeenAt);
    else unseen = [];
  } else {
    unseen = sinceTime(releases, watermark.lastSeenAt as Date);
  }

  return {
    releases: unseen.slice(0, limit),
    hasNews: unseen.length > 0,
    totalUnseen: unseen.length,
    ...(newest ? { acknowledgeVersion: newest.version } : {}),
  };
}

function sinceTime(releases: readonly PublicRelease[], since: Date): PublicRelease[] {
  return releases.filter((r) => r.publishedAt.getTime() > since.getTime());
}
