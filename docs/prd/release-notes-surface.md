# PRD — A shared release-notes surface

## Summary

Applications ship changes and then have to tell their users what changed. That is
a small feature with a large number of ways to get it subtly wrong, and it keeps
getting re-solved per application — so four products end up with four answers to
"what does a customer read", each wrong in a way only that product notices.

`@stonedogcode/release-notes` is the shared half: given a list of releases, it
decides what a customer may read, groups it the way a reader expects, works out
what is new since they last looked, and gives them a way to say something is
wrong.

It does **not** decide what shipped. That half cannot be shared, and the reason
is the central design decision of this package — see Non-goals.

## Why this exists

Both halves of the motivation are real defects on the one product that had a
release-notes page, found on the same day (2026-08-15):

- **NEH-743** — the page had shown nothing for a week. Its version attribution
  read `package.json` history, and a deploy-process change (NEH-77) stopped
  committing version bumps. 178 changes piled into a bucket dated three weeks
  earlier, and nothing failed: the page rendered, it was simply wrong.
- **NEH-744** — the same page was showing every signed-in resident, family
  member and facility staffer the raw commit subject of each change. **129 rows
  named an internal issue tracker id**, and every row with a PR number rendered
  a link into a private repository. The filtering existed; it ran in the
  component while the API served whole objects to anything that opened devtools.

Neither is exotic. Both are the kind of thing a second product would reinvent,
because both look correct until someone reads the output carefully.

## Goals

- **A customer never receives internal detail** — not in the markup, and not in
  the payload behind it. Enforced by types, not by discipline.
- **One decision about what "public" means**, so four products cannot drift into
  four answers.
- **Dates that match what the page says.** A release published at 23:30Z appears
  under the day the reader is shown, in their zone.
- **A prompt on login that is never worse than no prompt** — no forty-release
  modal, no greeting a brand-new account with a changelog.
- **Usable by a product with no database**, no React, or neither.
- **The host keeps its pipeline.** Adopting this must not require changing how a
  product decides what shipped.

## Non-goals

- **Deciding what shipped, or when.** This is the important one. The four
  products disagree fundamentally and always will:

  | | how it knows what shipped |
  |---|---|
  | hopperguard | deploy-tag annotations, which are the record |
  | rozcards | `package.json`, which the deploy gates on |
  | optimafilings | its own deploy pipeline |
  | stonedogcode | a static site with no database at all |

  A package owning that needs a mode per host — four pipelines instead of none,
  each wrong in a way only its own product could notice. So the host hands over
  `Release` objects and everything downstream is shared.

- **Storage.** No schema, no migrations, no opinion about where releases live.
- **A design system.** See Technical notes.
- **Writing the copy.** The package can remove an issue id from a sentence. It
  cannot make a sentence written for a maintainer fit for a customer, and it
  does not pretend to — see "Summaries", below.
- **Deciding when a reader has "seen" a release.** The host owns the watermark.

## Users and use cases

| Reader | Wants |
|---|---|
| A customer on the release-notes page | To know what changed, in their own vocabulary, without engineering detail |
| A customer who has been away | A short answer to "what did I miss", not the whole history |
| A customer who hit a bug | To report it, without hunting for where |
| An operator or admin | The full picture, provenance included — a different view, not this one |
| A developer adopting the package | To keep their existing pipeline and get the presentation for free |

## Functional requirements

### 1. Public and internal are different types

`Release` / `ReleaseEntry` carry commit shas, PR numbers, authors and raw
subjects. `PublicRelease` / `PublicReleaseEntry` **have no fields for any of
that** — absent, not omitted, so code that tries to render a PR number does not
compile.

`publicReleases()` converts, and is meant to run on the **server**. The payload
is what a customer's devtools shows them; filtering during render hides text
from the page and from nobody at all. That was the exact shape of NEH-744.

It drops, in order: releases that have not shipped, internal entries, and
releases left with nothing to say. That last rule matters more than it looks — a
deploy of pure `chore` commits is frequent, and a dated heading with nothing
under it tells a customer nothing while implying something was withheld.

### 2. Two separate decisions about what a customer sees

Conflating these is what caused NEH-744.

**Which entries** — from the conventional-commit type. `chore`, `ci`, `test`,
`style`, `build` are internal by default; an explicit `audience` on an entry
overrules the type in either direction.

**What text** — never the subject verbatim. Tracker ids, PR markers and bare
URLs are stripped.

`trackerPrefixes` is host-configured and hosts should set it. `ISO-8601`,
`UTF-8` and `NEH-473` are character-for-character the same shape, and no pattern
separates them: given the host's keys the strip is exact, and without them the
package guesses using a denylist of technical standards. **An over-eager
stripper is the worse failure**, because every leak assertion still passes
against mangled text while product copy is silently corrupted. The test suite
asserts both directions for that reason, and caught exactly this on its first
run by turning "Supports ISO-8601 dates" into "Supports dates".

### 3. Summaries, because scrubbing is a floor and not an answer

These survive every pattern in the package and are still unfit for a customer:

> *"delete the Guide widget, which nothing renders"* — reads as an admission
> *"stop a failed permission lookup serving an unvalidated theme"* — reads, on a
> HIPAA product, as a security incident report

So `Release.summary` and `ReleaseEntry.summary` exist and **win wherever
present**. A release-level summary is preferred over any list of entries: one
honest sentence beats twelve commit messages. The components render it above the
sections.

The package provides the shape. Authoring is the host's, and is tracked
separately (NEH-771).

### 4. Grouping by day, in the reader's zone

Several deploys a day is normal, and twelve versions all dated "15 August" reads
as noise. Releases group by day, newest first, newest version within the day —
compared numerically, so `0.10.0` sorts above `0.9.0`.

The day key is built from **local** date parts, because the page formats dates
locally. A UTC key files a 23:30Z release under the following day — agreeing
with itself on a developer's machine west of UTC and disagreeing in production.
That reached production once already (NEH-103).

A release with an unusable date is kept in a trailing group rather than dropped.
A note that vanishes silently looks exactly like nothing having shipped, which
is the hardest failure to notice.

### 5. What's new since you last looked

`whatsNew()` compares public releases against a host-stored watermark and
returns what is unseen, capped, plus the true total so a host can honestly say
"and 12 more".

Two behaviours, both chosen so a prompt is never worse than none:

- **A reader with no watermark sees nothing**, and gets a version to store.
  Greeting a new account with the last five deploys is the wrong first
  impression and is not news to them; their second visit is when it works.
- **A watermark naming an unknown version shows nothing, not everything.**
  Rolled back, renamed, aged out — reading it as "seen nothing" produces a
  forty-release modal, a far worse failure than a missed prompt.

### 6. A way to report a problem

A discriminated union, because the products differ and always will: hopperguard
routes to an in-app `/feedback` where the reader is already signed in; the
marketing sites have a mailbox and nowhere to route anyone. `{version}` in an
email subject is substituted, because it is the most useful thing a report can
carry and the thing a reader is least likely to include.

No channel configured renders nothing. An invitation that goes nowhere is worse
than no invitation: the reader spends the effort and hears back from no one.

## Technical notes

### No design system, deliberately

The components import no styling library. The four products style themselves
differently — hopperguard through Panda and its own `Styled*` wrappers, the
marketing sites otherwise — and a component library importing one of those is
unusable by the other three.

So: semantic HTML, a stable class on every element, and a `components` override
map for partial or total substitution. A consequence worth stating, because the
sibling packages differ: **there is no Panda `include` glob to configure.**

`ReleaseNotes` takes **no hooks**, so it renders on a server — a page of static
release text should not need `"use client"`. `WhatsNew` does, and carries the
marker itself.

### Three entry points, because shipping source has consequences

| import | needs |
|---|---|
| `@stonedogcode/release-notes` | nothing |
| `.../react` | React, and `jsx` in the consumer's tsconfig |
| `.../node` | `@types/node`; imports `fs` |

The package ships TypeScript **source**, so anything reachable from an entry
point is compiled by the *consumer's* tsconfig. A `.tsx` in the main entry
forces a Node script that renders nothing to configure `jsx` and resolve React
types; an `fs` import breaks a browser bundle. Both peers are optional, and
`scripts/publish-package.sh` refuses a publish where the main entry re-exports
the React layer — that regression is invisible in this repo, where the root
tsconfig sets `jsx` for the component tests.

### Verification

`verify:package` packs the tarball, installs it into a throwaway project, and
type-checks and executes all three entry points as a consumer. It has caught
three things no unit test could: test files shipping to consumers, the main
entry forcing `jsx` on everyone, and an undeclared `@types/node` peer.

## Rollout

1. **Core** — visibility, grouping, what's-new, support channel. *(shipped, #1)*
2. **File reader and entry parsing** — the `node` subpath. *(shipped, #2)*
3. **Components.** *(shipped, #3)*
4. **Publish tooling.** *(shipped, #4, #5; `0.1.0` published 2026-08-15)*
5. **First consumer** — hopperguard delegates its NEH-744 scrubber here.
   *(hopper-web#906, blocked on a paired root lockfile + gitlink change)*
6. **Second consumer** — whichever of rozcards, optimafilings or stonedogcode
   next needs a release-notes page. Until one adopts it, the "shared" claim is
   untested: a package with one consumer is a refactor, not an abstraction.

## Open questions

- **Does the entry list belong on a customer-facing page at all**, once
  summaries exist? Option (a) on NEH-771 is to show only `feat` publicly. The
  package supports either; the products have not decided.
- **Should `whatsNew` own dismissal state?** Today the host stores the
  watermark, which is right for a database-backed product and awkward for a
  static site that only has `localStorage`.
- **Is a fifth section warranted for security fixes?** Naming them helps a
  reader judge urgency and tells an attacker where to look. Currently they fall
  under Fixes, which is a deliberate non-decision rather than an answer.
