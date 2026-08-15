# @stonedogcode/release-notes

A release-notes surface for applications.

**The host answers what shipped and when. This package owns everything after** —
what a customer is allowed to read, how it is grouped, what is new since they
last looked, and how they report a problem.

```bash
npm install @stonedogcode/release-notes
```

## Why the host keeps the pipeline

The tempting design is for a package like this to own the whole thing: read the
git history, work out which release shipped which commit, store it, render it.
It does not, because the four applications this serves disagree about that part
and always will.

| | how it knows what shipped |
|---|---|
| hopperguard | deploy-tag annotations (`prod-web-*`), which are the record |
| rozcards | `package.json`, which the deploy gates on |
| optimafilings | its own deploy pipeline |
| stonedogcode | a static site with no database at all |

A package that owned version attribution would need a mode for each of those —
four pipelines instead of none — and each mode would be wrong in a way only that
product could notice. So the host hands over a list of `Release` objects, and
everything downstream is shared.

## The shape

```ts
import { publicReleases, groupReleasesByDay, whatsNew, supportAction } from "@stonedogcode/release-notes";

const policy = { trackerPrefixes: ["NEH"] };

// 1. Reduce to what a customer may read. Unshipped releases, internal entries
//    and empty releases all disappear here.
const shown = publicReleases(releasesFromYourDatabase, policy);

// 2. Group for display: by day, newest first, newest version within the day.
const days = groupReleasesByDay(shown);

// 3. Optionally prompt on login.
const news = whatsNew(shown, { lastSeenVersion: user.lastSeenRelease });
if (news.hasNews) { /* show news.releases, then store news.acknowledgeVersion */ }

// 4. Give them a way to say something is wrong.
const support = supportAction({ kind: "link", href: "/feedback" }, { version: shown[0]?.version });
```

## Public and internal are different TYPES, not a flag

`Release`/`ReleaseEntry` is what you know internally: commit shas, PR numbers,
authors, raw commit subjects. `PublicRelease`/`PublicReleaseEntry` is what a
customer may see, and it **has no fields for any of that**. Not omitted —
absent, so code that tries to render a PR number does not compile.

That is deliberate, and it is the lesson from a real incident. hopperguard's
`/release-notes` served 129 rows naming internal issue ids (`…for every route
(NEH-473)`) and linking into a private repository, to every signed-in resident
and family member. The filtering existed — it ran in the component, while the
API kept serving the full objects to anything that opened devtools.

So: convert with `publicReleases()` **on the server**, and send the result. The
payload is what a customer's devtools sees; hiding a field in JSX hides nothing.

## What a customer sees

Two separate decisions, and conflating them is what caused the incident above.

**Which entries.** Answered from the conventional-commit type.
`chore`, `ci`, `test`, `style` and `build` are internal by default; `feat`,
`fix`, `perf`, `docs` and `refactor` are not. Override the list with
`internalTypes`, or set `audience: "public" | "internal"` on a single entry when
the type is not the point.

**What text.** Never the commit subject verbatim. A conventional-commit subject
is written by a maintainer mid-debugging, so internal detail is exactly what is
in their head:

> `fix(dashboard): delete the Guide widget, which nothing renders`
> `fix(theme): stop a failed permission lookup serving an unvalidated theme`

Both were live on a HIPAA product. The second reads as a security incident
report. Scrubbing cannot fix that — only writing for the reader can, which is
what `summary` is for:

```ts
{
  type: "fix",
  subject: "stop a failed permission lookup serving an unvalidated theme",
  summary: "Themes now load correctly while your account is still signing in.",
}
```

`summary` wins whenever it is present, on an entry and on a release. Prefer a
release-level `summary` over any list of entries: one honest sentence beats
twelve commit messages.

### Set `trackerPrefixes`

```ts
publicReleases(releases, { trackerPrefixes: ["NEH"] });
```

`ISO-8601`, `UTF-8`, `RFC-2119` and `NEH-473` are the same shape, and no pattern
can tell them apart. Given your keys, only those are stripped. Without them the
scrubber guesses — generic shape minus a denylist of technical standards
(`NON_TRACKER_PREFIXES`) — which catches the common case but will occasionally
be wrong in one direction or the other.

## What's new on login

`whatsNew()` compares a list of public releases against a watermark. **The host
stores the watermark** — a user column, a cookie, local storage — because that
choice is not this package's business.

Two behaviours worth knowing, both chosen so a prompt is never worse than no
prompt:

- **A brand-new reader sees nothing**, and gets an `acknowledgeVersion` to
  store. Greeting somebody who just signed up with a modal listing the last five
  deploys is the wrong first impression, and it is not news to them. Their
  second visit is when it starts working.
- **A watermark naming a version that no longer exists** (rolled back, renamed,
  aged out) shows nothing rather than everything. Reading it as "seen nothing"
  produces a forty-release modal, which is a far worse failure than a missed
  prompt.

## Reporting a problem

Configurable because the products differ. hopperguard routes to an in-app
`/feedback` page where the reader is already signed in; the marketing sites have
a mailbox and nowhere to route anyone to.

```ts
supportAction({ kind: "link", href: "/feedback" });
supportAction({ kind: "email", address: "hello@rozcard.com", subject: "Issue with {version}" }, { version: "1.2.0" });
```

`{version}` is substituted with the release the reader was looking at — the most
useful thing a report about a release can carry, and the thing a reader is least
likely to include unprompted. With no channel configured you get `undefined` and
should render nothing: an invitation to report a problem that goes nowhere is
worse than no invitation.

## Dates

`groupReleasesByDay()` builds its day key from **local** date parts, because the
page renders dates with `toLocaleDateString()`. Deriving the key from
`toISOString()` instead puts a release published at 23:30Z under a heading
naming the following day — which agrees with itself on a developer's machine
west of UTC and disagrees in production, where the runtime is UTC.

Take `publishedAt` from whatever records a **deploy**, not from when the work
was merged. Those differ by however long the change waited, and dating a release
by its newest commit is how one product's notes ended up three weeks stale.

## Licence

Apache-2.0. See `LICENSE` and `NOTICE`.
