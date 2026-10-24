import type { Story } from "@voita_kone/shared_types";
import { Card } from "../../components/card";
import { LabelNote } from "../../components/label_note";
import { after_copy } from "./copy";
import styles from "./what_it_means_card.module.css";

/** The AI-written, fact-checked "what it means" story with its label. */
export function WhatItMeansCard({ story }: { story: Story }) {
  return (
    <Card labelled_by="what_it_means_title">
      <span className={styles.kicker}>{after_copy.what_it_means}</span>
      <h2 id="what_it_means_title" className={styles.headline}>
        {story.headline}
      </h2>
      <p className={styles.body}>{story.body}</p>
      <LabelNote text={story.label_text} layout="stacked" />
    </Card>
  );
}

/** Before an editor has approved the story: say it is being checked, show no text. */
export function WhatItMeansPendingCard() {
  return (
    <Card labelled_by="what_it_means_pending_title">
      <span className={styles.kicker}>{after_copy.what_it_means}</span>
      <h2 id="what_it_means_pending_title" className={styles.headline}>
        {after_copy.story_pending_title}
      </h2>
      <p className={styles.pending}>{after_copy.story_pending_text}</p>
    </Card>
  );
}
