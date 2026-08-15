/**
 * "Something looks wrong" — resolving the host's support channel into a link.
 *
 * Configurable because the products genuinely differ and always will.
 * hopperguard routes to an in-app `/feedback` page, where the reader is already
 * signed in and the report arrives with their account attached. The marketing
 * sites have a mailbox and no authenticated surface to route anyone to. Baking
 * either choice into the package would make it wrong for the other three.
 */
import type { SupportAction, SupportChannel } from "./types";

const DEFAULT_LABEL = "Tell us about a problem";

/**
 * Turn a configured channel into an href and a label.
 *
 * `{version}` in an email subject is substituted with the release the reader
 * was looking at, so the mail arrives already saying which one — the single
 * most useful thing a bug report about a release can carry, and the one thing
 * a reader is least likely to include.
 *
 * Returns undefined when no channel is configured. A host that has not set one
 * gets no call-to-action, rather than a dead link: an invitation to report a
 * problem that goes nowhere is worse than no invitation.
 */
export function supportAction(
  channel: SupportChannel | undefined,
  context: { version?: string } = {},
): SupportAction | undefined {
  if (!channel) return undefined;

  if (channel.kind === "link") {
    if (!channel.href) return undefined;
    return { href: channel.href, label: channel.label ?? DEFAULT_LABEL };
  }

  if (!channel.address) return undefined;
  const subject = channel.subject
    ? channel.subject.replaceAll("{version}", context.version ?? "")
    : undefined;
  const query = subject ? `?subject=${encodeURIComponent(subject.trim())}` : "";
  return {
    href: `mailto:${channel.address}${query}`,
    label: channel.label ?? DEFAULT_LABEL,
  };
}
