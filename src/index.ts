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
  type WhatsNewOptions,
  type WhatsNewResult,
  type WhatsNewWatermark,
} from "./whatsNew";
export { supportAction } from "./support";
export {
  DEFAULT_SECTIONS,
  groupBySection,
  OTHER_SECTION,
  type EntrySection,
  type GroupBySectionOptions,
  type SectionDef,
} from "./sections";
export {
  parseConventionalSubject,
  parseEntryLine,
  type ParsedSubject,
  type ParseEntryOptions,
} from "./entry";
export type {
  EntryAudience,
  PublicRelease,
  PublicReleaseEntry,
  Release,
  ReleaseEntry,
  SupportAction,
  SupportChannel,
} from "./types";

// The React components are NOT re-exported here. They live at
// `@stonedogcode/release-notes/react`, because this package ships TypeScript
// source: a `.tsx` reachable from this entry point would force every consumer
// — including one that renders nothing — to configure `jsx` and resolve React
// types. Same reasoning as the `./node` split.
