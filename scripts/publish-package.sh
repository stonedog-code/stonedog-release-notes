#!/usr/bin/env bash
# Copyright (C) 2026 StoneDogCode L.L.C.
# SPDX-License-Identifier: Apache-2.0
#
# Publish @stonedogcode/release-notes to npm, end to end.
#
#   npm run publish:stonedog-release-notes
#
# Run it from a terminal, interactively. npm prompts for the 2FA one-time
# password itself (account `stonedogcode`) and the browser login flow needs a
# human — neither works unattended, which is why this is a script you run
# rather than a step in CI.
#
# Modelled on @stonedogcode/style's and @stonedogcode/howto's scripts of the
# same name, and it keeps their central lesson: a publish that prints no error
# can still have published nothing, or the wrong thing. So this reads the
# tarball before publishing and installs from the registry afterwards, because
# "the registry lists it" and "a user can install it" are different claims and
# the second is the last to start answering yes.
#
# ## The traps specific to THIS package
#
# 0. **It depends on no design system, unlike style/howto.** There is no Panda
#    `styled-system/` to regenerate and no `include` glob for a consumer to
#    configure. Do not copy those steps back in from the sibling scripts; they
#    would fail on a directory that never exists here.
#
# 1. It ships TypeScript SOURCE, so everything under `src/` is compiled by the
#    CONSUMER's tsconfig. Two consequences the checks below enforce:
#
#    - a test file in the tarball is compiled at the consumer's build and
#      imports jest globals that are not dependencies;
#    - anything reachable from an entry point imposes that entry point's
#      requirements on every consumer. See trap 3.
#
# 2. It has THREE entry points (`.`, `./react`, `./node`). A tarball missing any
#    one installs fine and fails at the consumer's first import.
#
# 3. **The main entry must not reach a `.tsx`.** This is the one that already
#    happened. `src/index.ts` re-exported the components, and because the
#    package ships source, that forced EVERY consumer to set `jsx` and resolve
#    React types — including a Node script that renders nothing:
#
#        error TS6142: Module './components/ReleaseNotes' was resolved to
#        '…/components/ReleaseNotes.tsx', but '--jsx' is not set.
#
#    Components live at `./react` for exactly this reason. A re-export added
#    back into `src/index.ts` would undo it silently: everything still builds
#    here, where the root tsconfig sets `jsx` for the component tests.
#
# 4. `react` is a peer ONLY. Listed as a dependency too, npm installs a second
#    React into the package, and two Reacts in one tree fail with "Invalid hook
#    call" pointing at the consumer's component rather than at this manifest.
set -euo pipefail

PACKAGE_NAME="@stonedogcode/release-notes"
# Sanity floor for the tarball. Comfortably under the real count (16) so
# ordinary growth does not trip it, far above what a `files`-misconfigured
# package would produce (3: package.json, README, LICENSE).
MIN_FILES=12
# Every path `exports` names.
REQUIRED_PATHS=("src/index.ts" "src/react/index.ts" "src/node/index.ts")

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

say()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mREFUSING: %s\033[0m\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Publish from a clean, current `main`.
# ---------------------------------------------------------------------------
say "Checking the working tree"
BRANCH="$(git branch --show-current)"
[ -n "$BRANCH" ] || fail "this checkout is in detached HEAD. Run: git checkout main && git pull"
[ "$BRANCH" = "main" ] || fail "on branch '$BRANCH'. Publish from main, never a feature branch."
[ -z "$(git status --porcelain | grep -v '^??')" ] || fail "the working tree has uncommitted changes."

git fetch --quiet origin
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  BEHIND="$(git rev-list --count HEAD..origin/main)"
  fail "HEAD is not origin/main ($BEHIND commit(s) behind). A checkout one commit behind publishes a tarball missing the very thing you are publishing for, and it looks like a success. Run: git pull"
fi
echo "  clean, on main, at $(git rev-parse --short HEAD)"

# ---------------------------------------------------------------------------
# 2. Authenticate.
#
# A 404 from `npm publish` means AUTH far more often than a missing package —
# npm answers 404 rather than 403 so it cannot leak whether a name exists. `npm
# whoami` turns that confusing failure into a clear one, and is the only thing
# that reveals an `_authToken` that is present but expired.
# ---------------------------------------------------------------------------
say "Checking npm authentication"
if ! NPM_USER="$(npm whoami 2>/dev/null)"; then
  echo "  not logged in — starting the browser login flow"
  npm login
  NPM_USER="$(npm whoami)"
fi
echo "  authenticated as $NPM_USER"

if npm view "$PACKAGE_NAME" version >/dev/null 2>&1; then
  npm owner ls "$PACKAGE_NAME" 2>/dev/null | grep -q "^$NPM_USER " \
    || fail "'$NPM_USER' is not an owner of $PACKAGE_NAME, so publishing will fail with a misleading 404."
  echo "  $NPM_USER is an owner of $PACKAGE_NAME"
else
  echo "  $PACKAGE_NAME does not exist yet — this is the first publish, which creates it"
fi

# ---------------------------------------------------------------------------
# 3. A version may be published at most once, ever.
# ---------------------------------------------------------------------------
VERSION="$(node -p "require('./package.json').version")"
say "Preparing $PACKAGE_NAME@$VERSION"

if npm view "$PACKAGE_NAME@$VERSION" version >/dev/null 2>&1; then
  fail "$PACKAGE_NAME@$VERSION is already published. A version can never be reused — bump it (npm run version:bump:patch), land that, then re-run."
fi

# ---------------------------------------------------------------------------
# 3b. Install exactly what the lockfile says, before anything reads
#     node_modules.
#
# Every check above is about GIT. None looks at node_modules, and the two
# diverge exactly when a manifest change has just been pulled — which is
# precisely when someone is about to publish.
#
# `npm ci` rather than `npm install`, for two reasons: it installs exactly the
# lockfile, and it FAILS when the lockfile and manifest disagree. That
# disagreement is itself a reason not to publish — `npm install` would quietly
# reconcile it and ship a tarball built against a lockfile nobody committed.
# ---------------------------------------------------------------------------
say "Installing dependencies from the lockfile"
[ -f package-lock.json ] || fail "there is no package-lock.json, so there is nothing to install reproducibly from."
npm ci
echo "  node_modules now matches package-lock.json"

# ---------------------------------------------------------------------------
# 4. The gate, then the package check.
#
# Both, and in this order. The gate proves the SOURCE is good; verify:package
# proves what a CONSUMER receives is good. Publishing is irreversible on a
# version number, so neither is assumed from a green PR — this checkout may
# carry commits that merged after the last CI run.
# ---------------------------------------------------------------------------
say "Running the gate"
npm run gate

# `gate` already runs verify:package, but run it again rather than reasoning
# about that: it is seconds, and the cost of being wrong is a burned version.
say "Verifying the package as a consumer receives it"
npm run verify:package

# ---------------------------------------------------------------------------
# 5. Read the tarball before trusting it.
# ---------------------------------------------------------------------------
say "Verifying the tarball"
PACK_OUTPUT="$(npm pack --dry-run 2>&1)"
FILE_COUNT="$(printf '%s' "$PACK_OUTPUT" | sed -n 's/.*total files:[[:space:]]*\([0-9]*\).*/\1/p' | tail -1)"

[ -n "$FILE_COUNT" ] || fail "could not read a file count from npm pack."
[ "$FILE_COUNT" -ge "$MIN_FILES" ] \
  || fail "the tarball has only $FILE_COUNT files (expected >= $MIN_FILES). Publishing this would ship a near-empty package on a version number that can never be reused."

printf '%s' "$PACK_OUTPUT" | grep -q '__tests__' \
  && fail "the tarball contains test files. This package ships TypeScript source, so they would be compiled by every consumer's tsconfig, and they import jest globals that are not dependencies."

for path in "${REQUIRED_PATHS[@]}"; do
  printf '%s' "$PACK_OUTPUT" | grep -q "$path" \
    || fail "'$path' is not in the tarball, but package.json's \"exports\" names it. Every consumer import of that entry point would fail."
done

printf '%s' "$PACK_OUTPUT" | grep -q 'README.md' \
  || fail "no README.md in the tarball — npmjs.com would show 'This package does not have a README'."
printf '%s' "$PACK_OUTPUT" | grep -q 'LICENSE' \
  || fail "no LICENSE in the tarball. This package is Apache-2.0 and the licence text ships with it."

# Trap 3, enforced. The main entry point must stay free of JSX, or every
# consumer inherits a `jsx` requirement it has no use for.
grep -qE 'from "\./(components|react)' src/index.ts \
  && fail "src/index.ts re-exports the React layer. Because this package ships TypeScript SOURCE, that forces EVERY consumer to set \`jsx\` and resolve React types — including one that renders nothing. Components belong at the ./react subpath. This builds fine here, where the root tsconfig sets jsx for the component tests, so nothing else would catch it."

node -e '
  const d = require("./package.json");
  const deps = Object.keys(d.dependencies || {});
  for (const p of ["react", "react-dom"]) {
    if (deps.includes(p)) {
      console.error(`REFUSING: ${p} is a dependency as well as a peer. npm installs a second React into this package, and two Reacts in one tree fail with "Invalid hook call".`);
      process.exit(1);
    }
  }
  for (const p of ["react", "@types/node"]) {
    if (!(d.peerDependencies || {})[p]) {
      console.error(`REFUSING: ${p} is not declared as a peer dependency. It is needed to type-check one of the subpaths, and a consumer would hit a resolution error this package could have declared.`);
      process.exit(1);
    }
    if (!(d.peerDependenciesMeta || {})[p]?.optional) {
      console.error(`REFUSING: peer ${p} is not marked optional. A consumer using only the pure core needs neither React nor node types, and npm would warn on every install.`);
      process.exit(1);
    }
  }
'

echo "  $FILE_COUNT files; entry points, README and LICENSE present; no tests; main entry is JSX-free; react and @types/node are optional peers"

say "Tarball contents — read this before confirming"
printf '%s\n' "$PACK_OUTPUT" | sed -n 's/^npm notice[[:space:]]*[0-9.]*[kMG]*B*[[:space:]]*\(src\/.*\)/  \1/p' | sort
echo "  ($FILE_COUNT files total)"

# ---------------------------------------------------------------------------
# 6. Publish. npm prompts for the OTP here.
# ---------------------------------------------------------------------------
say "Publishing $PACKAGE_NAME@$VERSION — npm will ask for your 2FA code"
npm publish --access public

# ---------------------------------------------------------------------------
# 7. PROVE IT. The registry is eventually consistent for a few seconds, so this
#    polls rather than asserting once, and ends with a real install.
# ---------------------------------------------------------------------------
say "Verifying it is actually installable"
PROBE_DIR="$(mktemp -d)"
trap 'rm -rf "$PROBE_DIR"' EXIT

for attempt in $(seq 1 20); do
  if npm view "$PACKAGE_NAME@$VERSION" version >/dev/null 2>&1; then break; fi
  [ "$attempt" -lt 20 ] || fail "$PACKAGE_NAME@$VERSION is still not on the registry after publishing. The publish did NOT succeed, whatever it printed."
  sleep 3
done

printf '{"name":"probe","version":"1.0.0"}' > "$PROBE_DIR/package.json"
(cd "$PROBE_DIR" && npm install --silent "$PACKAGE_NAME@$VERSION" >/dev/null 2>&1) \
  || fail "$PACKAGE_NAME@$VERSION resolves but cannot be installed."

INSTALLED="$(node -p "require('$PROBE_DIR/node_modules/$PACKAGE_NAME/package.json').version")"
[ "$INSTALLED" = "$VERSION" ] || fail "installed $INSTALLED but published $VERSION."

for path in "${REQUIRED_PATHS[@]}"; do
  [ -f "$PROBE_DIR/node_modules/$PACKAGE_NAME/$path" ] \
    || fail "$path is missing from the INSTALLED package, though it was in the tarball."
done

printf '\n\033[32m✓ %s@%s is published and installable.\033[0m\n' "$PACKAGE_NAME" "$VERSION"
echo "  https://www.npmjs.com/package/$PACKAGE_NAME"
printf '\n\033[1mNext:\033[0m consumers add the dependency. Nothing else is needed — this package\n'
printf '  depends on no design system, so there is no Panda `include` glob to configure.\n'
printf '  A consumer importing ./react needs `jsx` in its tsconfig; one importing ./node\n'
printf '  needs @types/node. The main entry point needs neither.\n'
