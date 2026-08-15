"use client";

/**
 * "Here's what changed since you were last here."
 *
 * Renders nothing when there is nothing to say — including for a reader with no
 * watermark, who is new rather than behind. See whatsNew() for why that is not
 * the same as having seen nothing.
 *
 * `"use client"` because it genuinely needs hooks: it fires a callback once the
 * reader has been shown something. `ReleaseNotes` deliberately takes no hooks
 * and needs no such marker — a page rendering static release text should not
 * become a client component.
 *
 * The host owns dismissal and the watermark. This component calls back with the
 * version to store and does not decide when, because "when" differs: a modal
 * stores on close, a banner on click, and a page that simply shows the list may
 * store on render.
 */
import * as React from "react";
import { whatsNew, type WhatsNewOptions, type WhatsNewWatermark } from "../whatsNew";
import { ReleaseNotes, type ReleaseNotesComponents } from "./ReleaseNotes";
import type { PublicRelease, SupportChannel } from "../types";

export interface WhatsNewProps extends WhatsNewOptions {
  /** Public releases, newest first — the output of `publicReleases()`. */
  releases: readonly PublicRelease[];
  /** Where this reader had got to. Undefined for someone brand new. */
  watermark?: WhatsNewWatermark;
  /**
   * Called with the version to record once the reader has seen this. Fires
   * only when there IS something to show, so a host cannot advance a watermark
   * past releases nobody was shown.
   */
  onAcknowledge?: (version: string) => void;
  /** Heading above the list. */
  title?: string;
  /**
   * Rendered when more releases are unseen than are shown, so a host can say
   * "and 12 more" honestly rather than implying it showed everything.
   */
  renderMore?: (hidden: number) => React.ReactNode;
  support?: SupportChannel;
  components?: ReleaseNotesComponents & { Root?: React.ElementType; Title?: React.ElementType };
  classPrefix?: string;
}

export function WhatsNew({
  releases,
  watermark,
  onAcknowledge,
  title = "What's new",
  renderMore,
  support,
  components = {},
  classPrefix = "whats-new",
  ...options
}: WhatsNewProps): React.ReactElement | null {
  const news = React.useMemo(
    () => whatsNew(releases, watermark, options),
    // `options` is spread from props, so a fresh object each render — depend on
    // the value that actually changes rather than on its identity.
    [releases, watermark, options],
  );

  const { Root = "div", Title = "h2", ...listComponents } = components;

  React.useEffect(() => {
    // Only when something was shown. Acknowledging on an empty prompt would
    // advance the watermark past releases the reader never saw — which is how
    // a what's-new feature silently stops working and looks like it is fine.
    if (news.hasNews && news.acknowledgeVersion) onAcknowledge?.(news.acknowledgeVersion);
  }, [news.hasNews, news.acknowledgeVersion, onAcknowledge]);

  if (!news.hasNews) return null;

  const hidden = news.totalUnseen - news.releases.length;

  return (
    <Root className={classPrefix}>
      <Title className={`${classPrefix}__title`}>{title}</Title>
      <ReleaseNotes
        releases={news.releases}
        support={support}
        components={listComponents}
        classPrefix={`${classPrefix}__notes`}
      />
      {hidden > 0 && renderMore ? renderMore(hidden) : null}
    </Root>
  );
}
