/**
 * The release model.
 *
 * A release is something that shipped, on a date, containing changes. That is
 * all this package assumes — deliberately, because the four applications it
 * serves disagree about everything else. hopperguard derives its version from
 * deploy-tag annotations; rozcards reads `package.json` and gates the deploy on
 * it; stonedogcode is a static site with no database at all. A package that
 * tried to own "which release shipped this commit" would need a mode per host,
 * which is four pipelines instead of none.
 *
 * So the host answers *what shipped and when*. This package owns everything
 * after: what a customer is allowed to read, how it is grouped, what is new
 * since they last looked, and how they report a problem.
 */

/** A single change within a release, as the host knows it internally. */
export interface ReleaseEntry {
  /**
   * Conventional-commit type — `feat`, `fix`, `perf`, `docs`, `chore`, … Used
   * to classify and to group. Unknown types are kept, not dropped: a release
   * note that silently vanishes because someone invented a prefix is worse than
   * one filed under "Other".
   */
  type: string;
  /** Optional conventional-commit scope: the `api` in `feat(api): …`. */
  scope?: string;
  /**
   * The change, in the host's own words. This is INTERNAL text — usually a
   * commit subject, written for a maintainer. It is never shown to a customer
   * as-is; see {@link PublicReleaseEntry}.
   */
  subject: string;
  /** Customer-facing wording, when someone has written it. Preferred over `subject`. */
  summary?: string;
  /** True for a breaking change (`feat(api)!: …`). */
  breaking?: boolean;
  /**
   * Force this entry's audience, overriding whatever the visibility policy
   * would decide from `type`. `"internal"` hides a change that is technically a
   * `feat` but means nothing to a customer; `"public"` surfaces a `chore` that
   * does.
   */
  audience?: EntryAudience;

  /* --- Internal-only provenance. None of this reaches a customer. --- */

  /** Pull-request number, for the internal view. */
  prNumber?: number;
  /** Commit sha, for the internal view. Also the natural dedupe key. */
  commitSha?: string;
  /** Who merged it, for the internal view. */
  author?: string;
  /** When the change landed. Distinct from when its release shipped. */
  mergedAt?: Date;
}

/** Where an entry may be shown. */
export type EntryAudience = "public" | "internal";

/** A release, as the host knows it. */
export interface Release {
  /** Version identifier — `0.890.0`, `2026.08.15`, whatever the host uses. */
  version: string;
  /**
   * When this release reached users. `null`/undefined means it has not shipped,
   * and an unshipped release is never public — see `publicReleases`.
   *
   * Take this from whatever records a *deploy*, not from when the work was
   * merged. Those differ by however long the change waited, and dating a
   * release by its newest commit is how hopperguard's notes ended up three
   * weeks stale (NEH-743).
   */
  publishedAt?: Date | null;
  /** A human-written summary of the whole release. Preferred over listing entries. */
  summary?: string;
  /** The changes in this release. */
  entries: ReleaseEntry[];
}

/**
 * A release as a customer may see it.
 *
 * This is a DIFFERENT TYPE, not a flag on the one above, and that is the whole
 * point. hopperguard shipped 129 release rows naming internal issue ids
 * (`…for every route (NEH-473)`) and linking into a private repository, to
 * every signed-in resident and family member (NEH-744). The filtering existed;
 * it was applied in the component, while the API kept serving the full objects
 * to anything that opened devtools.
 *
 * Making the public shape structurally incapable of holding provenance means
 * the mistake cannot be made by forgetting — `prNumber` is not omitted here, it
 * does not exist, so code that tries to render it does not compile.
 */
export interface PublicReleaseEntry {
  type: string;
  scope?: string;
  /** Customer-facing text, already scrubbed of tracker ids. */
  text: string;
  breaking?: boolean;
}

/** A release as a customer may see it. */
export interface PublicRelease {
  version: string;
  /** Always present: an unpublished release never becomes a PublicRelease. */
  publishedAt: Date;
  summary?: string;
  entries: PublicReleaseEntry[];
}

/**
 * How a reader reports a problem with a release.
 *
 * Configurable because the products answer it differently and always will:
 * hopperguard has an in-app `/feedback` route, while the marketing sites have
 * a mailbox and no authenticated surface to route anyone to.
 */
export type SupportChannel =
  | {
      kind: "link";
      /** Where to send them — usually an in-app route. */
      href: string;
      /** Call to action. Defaults to "Tell us about a problem". */
      label?: string;
    }
  | {
      kind: "email";
      address: string;
      label?: string;
      /**
       * Subject line. `{version}` is substituted with the release the reader
       * was looking at, so the mail arrives already saying which one.
       */
      subject?: string;
    };

/** A resolved support call-to-action, ready to render. */
export interface SupportAction {
  href: string;
  label: string;
}
