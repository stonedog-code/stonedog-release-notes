/**
 * The release-notes surface, as markup.
 *
 * THIS DEPENDS ON NO DESIGN SYSTEM, and that is a decision rather than an
 * omission. The four applications this serves style themselves differently —
 * hopperguard through Panda and its own `Styled*` wrappers, the marketing sites
 * otherwise — and a component library that imported one of those would be
 * unusable by the other three. So: semantic HTML, a stable class on every
 * element to style against, and a `components` map for a host that would rather
 * substitute its own primitives entirely.
 *
 * What IS shared is the part worth sharing and easy to get wrong: which
 * releases a customer may see, how they are grouped by day, which section an
 * entry belongs in, and the fact that provenance cannot reach the markup
 * because {@link PublicRelease} has no field for it.
 */
import * as React from "react";
import { groupReleasesByDay } from "../group";
import { groupBySection, type GroupBySectionOptions } from "../sections";
import { supportAction } from "../support";
import type { PublicRelease, PublicReleaseEntry, SupportChannel } from "../types";

/**
 * Primitives a host may substitute. Every one defaults to a plain element with
 * the class it is given, so overriding is opt-in and partial.
 */
export interface ReleaseNotesComponents {
  Root?: React.ElementType;
  DayHeading?: React.ElementType;
  Release?: React.ElementType;
  VersionHeading?: React.ElementType;
  Summary?: React.ElementType;
  SectionHeading?: React.ElementType;
  List?: React.ElementType;
  Item?: React.ElementType;
  Empty?: React.ElementType;
  SupportLink?: React.ElementType;
}

export interface ReleaseNotesProps extends GroupBySectionOptions {
  /**
   * Releases a customer may read — the output of `publicReleases()`.
   *
   * The type is the guard: `PublicRelease` has no field for a PR number, a
   * commit sha or an author, so this component cannot render one even by
   * mistake. Pass raw internal releases and it will not compile.
   */
  releases: readonly PublicRelease[];
  /** How a date is written. Defaults to the runtime's long local format. */
  formatDate?: (date: Date) => string;
  /** Where a reader reports a problem. Omitted renders no call to action. */
  support?: SupportChannel;
  /** Shown when there is nothing to read. */
  emptyMessage?: string;
  components?: ReleaseNotesComponents;
  /** Prefix for every generated class name. Defaults to `release-notes`. */
  classPrefix?: string;
}

/**
 * The runtime's own long date, in the LOCAL zone — the same zone
 * `groupReleasesByDay` builds its key from. Overriding this with a formatter in
 * a different zone reintroduces exactly the mismatch that grouping solves: a
 * release rendered under a heading naming a different day.
 */
const defaultFormatDate = (date: Date): string =>
  date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

export function ReleaseNotes({
  releases,
  formatDate = defaultFormatDate,
  support,
  emptyMessage = "No release notes yet.",
  components = {},
  classPrefix = "release-notes",
  ...sectionOptions
}: ReleaseNotesProps): React.ReactElement {
  const {
    Root = "div",
    DayHeading = "h2",
    Release = "section",
    VersionHeading = "h3",
    Summary = "p",
    SectionHeading = "h4",
    List = "ul",
    Item = "li",
    Empty = "p",
    SupportLink = "a",
  } = components;

  const cls = (name: string) => `${classPrefix}__${name}`;
  // NO HOOKS in this component, deliberately. Grouping a handful of releases is
  // cheap, and a `useMemo` here would make it a client component in the Next.js
  // App Router — every host would need "use client" on a page that renders
  // static text. `WhatsNew` does use hooks and is a client component by nature;
  // this one should render anywhere, including straight to a string on a
  // server with no hook dispatcher at all.
  const days = groupReleasesByDay(releases);

  if (days.length === 0) {
    return (
      <Root className={classPrefix}>
        <Empty className={cls("empty")}>{emptyMessage}</Empty>
      </Root>
    );
  }

  return (
    <Root className={classPrefix}>
      {days.map((day) => (
        <div key={day.dayKey} className={cls("day")}>
          <DayHeading className={cls("day-heading")}>
            {day.dayKey === "unknown" ? "Undated" : formatDate(day.date)}
          </DayHeading>

          {day.releases.map((release) => (
            <Release key={release.version} className={cls("release")}>
              <VersionHeading className={cls("version")}>{release.version}</VersionHeading>

              {/* A written summary is the point; the entry list is the fallback.
                  A commit subject is maintainer prose no scrub makes fit for a
                  customer, so where somebody has written a sentence it leads. */}
              {release.summary ? (
                <Summary className={cls("summary")}>{release.summary}</Summary>
              ) : null}

              {groupBySection(release.entries, sectionOptions).map((section) => (
                <div key={section.id} className={`${cls("section")} ${cls(`section--${section.id}`)}`}>
                  <SectionHeading className={cls("section-heading")}>{section.label}</SectionHeading>
                  <List className={cls("list")}>
                    {section.entries.map((entry, index) => (
                      <Item key={`${entry.type}-${index}`} className={cls("item")}>
                        <EntryText entry={entry} className={cls("scope")} />
                      </Item>
                    ))}
                  </List>
                </div>
              ))}

              <ReleaseSupport
                support={support}
                version={release.version}
                className={cls("support")}
                SupportLink={SupportLink}
              />
            </Release>
          ))}
        </div>
      ))}
    </Root>
  );
}

function EntryText({
  entry,
  className,
}: {
  entry: PublicReleaseEntry;
  className: string;
}): React.ReactElement {
  return (
    <>
      {/* Marked inline rather than pulled into a section of its own: a breaking
          change belongs beside its own description, and a "Breaking" heading at
          the top makes every release carrying one read like an incident. */}
      {entry.breaking ? <strong className={`${className}--breaking`}>Breaking: </strong> : null}
      {entry.scope ? <strong className={className}>{entry.scope}: </strong> : null}
      {entry.text}
    </>
  );
}

function ReleaseSupport({
  support,
  version,
  className,
  SupportLink,
}: {
  support?: SupportChannel;
  version: string;
  className: string;
  SupportLink: React.ElementType;
}): React.ReactElement | null {
  const action = supportAction(support, { version });
  // No channel configured renders nothing at all. An invitation to report a
  // problem that goes nowhere is worse than no invitation: the reader spends
  // the effort and hears back from no one.
  if (!action) return null;
  return (
    <SupportLink className={className} href={action.href}>
      {action.label}
    </SupportLink>
  );
}
