import type { Highlight } from "@voita_kone/shared_types";
import { useState } from "react";
import { Card } from "../../components/card";
import { PlayIcon } from "../../components/icons/play_icon";
import { format_clock_time, format_duration } from "../../lib/format";
import { after_copy } from "./copy";
import styles from "./highlight_card.module.css";

/** The editor-chosen highlight at the top of the After screen. */
export function HighlightCard({ highlight }: { highlight: Highlight | null }) {
  const [status, set_status] = useState<string | null>(null);

  if (!highlight) {
    return (
      <Card gap={6}>
        <h2 className={styles.missing_title}>{after_copy.highlight_missing_title}</h2>
        <p className={styles.missing}>{after_copy.highlight_missing}</p>
      </Card>
    );
  }

  const play = () => {
    if (highlight.video_url) {
      window.open(highlight.video_url, "_blank", "noopener");
    } else {
      set_status(after_copy.no_video_yet);
    }
  };

  const share = async () => {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      await navigator.share({ title: highlight.title, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    set_status(after_copy.link_copied);
  };

  return (
    <Card tone="dark" padding="none" gap={0} labelled_by="highlight_title">
      <div className={styles.video}>
        <span className={styles.tag}>{after_copy.highlight_tag}</span>
        <span className={styles.placeholder}>{after_copy.video_placeholder}</span>
        <span className={styles.duration}>{format_duration(highlight.duration_seconds)}</span>
        <button
          type="button"
          className={styles.play}
          aria-label={after_copy.play(highlight.duration_seconds)}
          onClick={play}
        >
          <PlayIcon />
        </button>
      </div>
      <div className={styles.body}>
        <h2 id="highlight_title" className={styles.title}>
          {highlight.title}
        </h2>
        <p className={styles.caption}>{highlight.caption}</p>
        <div className={styles.meta_row}>
          <span className={styles.meta}>
            {after_copy.chosen_by(format_clock_time(highlight.published_at), highlight.clip_credit)}
          </span>
          <button type="button" className={styles.share} onClick={() => void share()}>
            {after_copy.share}
          </button>
        </div>
        {status && (
          <p className={styles.status} role="status">
            {status}
          </p>
        )}
      </div>
    </Card>
  );
}
