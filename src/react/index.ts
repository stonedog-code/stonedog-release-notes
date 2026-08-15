/**
 * The React layer.
 *
 * A SEPARATE subpath, for the same reason `./node` is one: importing it costs
 * the consumer something the pure core does not. Because this package ships
 * TypeScript source, a `.tsx` file in the main entry point forces every
 * consumer's tsconfig to set `jsx` and resolve React types — including a Node
 * script that only wants `publicReleases()` and renders nothing.
 *
 * Found by scripts/verify-package.sh, which type-checks the tarball as an
 * installed consumer would:
 *
 *   error TS6142: Module './components/ReleaseNotes' was resolved to
 *   '…/components/ReleaseNotes.tsx', but '--jsx' is not set.
 *
 * Invisible from inside this repo, where the root tsconfig sets `jsx` for the
 * component tests.
 *
 * These components depend on NO design system — semantic HTML, stable class
 * names, and a `components` override map. See components/ReleaseNotes.tsx.
 */
export {
  ReleaseNotes,
  type ReleaseNotesComponents,
  type ReleaseNotesProps,
} from "../components/ReleaseNotes";
export { WhatsNew, type WhatsNewProps } from "../components/WhatsNew";
