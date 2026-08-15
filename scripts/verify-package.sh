#!/usr/bin/env bash
#
# Prove the PACKAGE works, not just the checkout.
#
# Everything the test suite does runs against source files sitting in this
# repository, where `files`, the `exports` map and the tarball contents are
# invisible. Those are exactly what breaks at publish time — after review, when
# the version is already burned and cannot be reused.
#
# So: pack it, install the tarball into a throwaway project, and use it the way
# a consumer would.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$ROOT"
TARBALL="$WORK/$(basename "$(npm pack --pack-destination "$WORK" | tail -1)")"
echo "packed: $(basename "$TARBALL")"

# No test file may reach a consumer: they are parsed by the consumer's Panda
# build and import test globals that are not dependencies.
if tar -tzf "$TARBALL" | grep -q "__tests__"; then
  echo "FAIL: the tarball contains test files" >&2
  tar -tzf "$TARBALL" | grep "__tests__" >&2
  exit 1
fi

mkdir -p "$WORK/consumer/src"
cd "$WORK/consumer"

cat > package.json <<'JSON'
{ "name": "consumer-check", "private": true, "type": "module", "version": "1.0.0" }
JSON

cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ESNext", "module": "ESNext", "moduleResolution": "bundler",
    "strict": true, "noEmit": true, "skipLibCheck": true,
    "lib": ["dom", "esnext"], "types": ["node"]
  },
  "include": ["src"]
}
JSON

# @types/node is an OPTIONAL peer, needed only to type-check the ./node subpath.
npm install --silent "$TARBALL" typescript@5 @types/node@22 >/dev/null

# Use it exactly as a consumer does — through the published `exports` map, not
# a relative path into src/.
cat > src/check.ts <<'TS'
import { publicReleases, whatsNew, supportAction } from "@stonedogcode/release-notes";
import type { Release } from "@stonedogcode/release-notes";

const releases: Release[] = [
  {
    version: "1.0.0",
    publishedAt: new Date("2026-08-15T10:00:00Z"),
    entries: [
      { type: "feat", subject: "add the Downloads page (NEH-1)" },
      { type: "chore", subject: "bump deps" },
    ],
  },
];

const shown = publicReleases(releases, { trackerPrefixes: ["NEH"] });
if (shown.length !== 1) throw new Error(`expected 1 release, got ${shown.length}`);
if (shown[0].entries.length !== 1) throw new Error("the chore entry was not hidden");
if (shown[0].entries[0].text !== "add the Downloads page") {
  throw new Error(`tracker id survived: ${shown[0].entries[0].text}`);
}
// The public shape must not carry provenance at all.
if ("prNumber" in shown[0].entries[0]) throw new Error("provenance reached the public shape");

const news = whatsNew(shown, { lastSeenVersion: "0.9.0" });
if (news.acknowledgeVersion !== "1.0.0") throw new Error("watermark not offered");

const action = supportAction({ kind: "email", address: "hi@example.com", subject: "Issue with {version}" }, { version: "1.0.0" });
if (!action?.href.includes("1.0.0")) throw new Error("version not substituted into the subject");

console.log("consumer check OK");
TS

# The `node` subpath is a SEPARATE exports entry, so it can be broken while the
# main one works — a missing entry, or a file left out of `files`. Exercise it
# the way a static site would: a real markdown release on disk.
mkdir -p releases
cat > releases/1.2.0.md <<'MD'
---
version: 1.2.0
publishedAt: 2026-08-15T15:11:41Z
summary: Collections got faster.
---

- feat(collections): add an item from the browser (#42)
- chore: bump deps
- Tidied the sign-in screen.
MD

cat > src/check-node.ts <<'TS'
import { readReleasesFromDir } from "@stonedogcode/release-notes/node";
import { publicReleases } from "@stonedogcode/release-notes";

const releases = readReleasesFromDir("releases");
if (releases.length !== 1) throw new Error(`expected 1 release, got ${releases.length}`);
if (releases[0].entries.length !== 3) throw new Error("bullets were not all read");

const shown = publicReleases(releases);
if (shown.length !== 1) throw new Error("the release did not survive the public view");
// chore is internal; the feat and the hand-written sentence are not.
if (shown[0].entries.length !== 2) {
  throw new Error(`expected 2 public entries, got ${shown[0].entries.length}`);
}
if (JSON.stringify(shown).includes("42")) throw new Error("the PR number reached the public shape");

console.log("node subpath check OK");
TS

npx tsc --noEmit
npx tsx src/check.ts 2>/dev/null || node --experimental-strip-types src/check.ts
npx tsx src/check-node.ts 2>/dev/null || node --experimental-strip-types src/check-node.ts
