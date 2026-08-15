/**
 * @stonedogcode/release-notes — a release-notes surface for applications.
 *
 * The host answers what shipped and when. This package owns everything after:
 * what a customer may read, how it is grouped, what is new since they last
 * looked, and how they report a problem.
 */

export {
  audienceOf,
  DEFAULT_INTERNAL_TYPES,
  publicReleases,
  publicTextOf,
  scrubInternalReferences,
  toPublicEntry,
  type VisibilityPolicy,
} from "./visibility";
export {
  compareVersionsDesc,
  groupReleasesByDay,
  localDayKey,
  type DatedRelease,
  type ReleaseDayGroup,
} from "./group";
export {
  whatsNew,
  type WhatsNew,
  type WhatsNewOptions,
  type WhatsNewWatermark,
} from "./whatsNew";
export { supportAction } from "./support";
export type {
  EntryAudience,
  PublicRelease,
  PublicReleaseEntry,
  Release,
  ReleaseEntry,
  SupportAction,
  SupportChannel,
} from "./types";
