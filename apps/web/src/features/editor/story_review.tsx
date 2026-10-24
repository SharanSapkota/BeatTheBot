import type { ClaimStatus, EditorStory } from "@voita_kone/shared_types";
import { format_clock_time, format_day_label } from "../../lib/format";
import { class_names } from "../../lib/class_names";
import { cited_fact_ids, format_fact_value, split_by_claims } from "./claim_segments";
import { editor_copy } from "./copy";
import { StoryActions } from "./story_actions";
import { TrafficLightChip } from "./traffic_light_chip";
import styles from "./story_review.module.css";

const CLAIM_STATUSES: ClaimStatus[] = ["verified", "not_found", "wrong"];

interface StoryReviewProps {
  story: EditorStory;
  on_done: (message: string) => void;
}

function ClaimLegend() {
  return (
    <ul className={styles.legend} aria-label={editor_copy.legend_label}>
      {CLAIM_STATUSES.map((status) => (
        <li key={status}>
          <span className={class_names(styles.claim, styles[status])}>
            {editor_copy.claim_status[status]}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** One story: the AI text with claims marked, the fact sheet, and the editor actions. */
export function StoryReview({ story, on_done }: StoryReviewProps) {
  const { segments } = split_by_claims(story.body, story.claims);
  const cited = cited_fact_ids(story.claims);
  const heading_id = `review_${story.id}`;

  return (
    <section className={styles.review} aria-labelledby={heading_id}>
      <header className={styles.header}>
        <span className={styles.kicker}>
          {editor_copy.queue_item_name(story.game, story.story_type)}
        </span>
        <h2 id={heading_id} className={styles.headline}>
          {story.headline}
        </h2>
        <div className={styles.flags}>
          <TrafficLightChip traffic_light={story.traffic_light} />
          {story.reasons.map((reason) => (
            <span key={reason} className={styles.reason}>
              {reason}
            </span>
          ))}
        </div>
        {story.was_published && <p className={styles.note}>{editor_copy.was_published}</p>}
        {story.reports.length > 0 && (
          <div className={styles.reports}>
            <h3 className={styles.small_title}>{editor_copy.reports_title}</h3>
            <ul>
              {story.reports.map((report) => (
                <li key={`${report.created_at}_${report.reason}`}>
                  <span className={styles.meta}>
                    {format_day_label(report.created_at)} {format_clock_time(report.created_at)}
                  </span>{" "}
                  {report.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>

      <div className={styles.columns}>
        <div className={styles.ai_panel}>
          <div className={styles.panel_head}>
            <h3 className={styles.small_title}>{editor_copy.ai_text_title}</h3>
            <span className={styles.meta}>{editor_copy.ai_label}</span>
          </div>
          <ClaimLegend />
          <p className={styles.body} data-testid="story_body">
            {segments.map((segment, index) =>
              segment.kind === "text" ? (
                <span key={index}>{segment.text}</span>
              ) : (
                <mark
                  key={index}
                  className={class_names(styles.claim, styles[segment.claim.status])}
                  data-status={segment.claim.status}
                  title={segment.claim.reason ?? editor_copy.claim_status[segment.claim.status]}
                >
                  {segment.text}
                  <span className="visually_hidden">
                    {` (${editor_copy.claim_status[segment.claim.status]})`}
                  </span>
                </mark>
              ),
            )}
          </p>
          <h3 className={styles.small_title}>{editor_copy.claims_title}</h3>
          <ul className={styles.claims}>
            {story.claims.map((claim, index) => (
              <li key={`${String(index)}_${claim.claim}`} className={styles.claim_row}>
                <span className={class_names(styles.status_tag, styles[`tag_${claim.status}`])}>
                  {editor_copy.claim_status[claim.status]}
                </span>
                <span className={styles.claim_text}>{claim.claim}</span>
                <span className={styles.meta}>
                  {claim.type} · {editor_copy.cites(claim.fact_ids)}
                </span>
                {claim.reason && <span className={styles.claim_reason}>{claim.reason}</span>}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.facts_panel}>
          <h3 className={styles.small_title}>{editor_copy.facts_title}</h3>
          {story.facts.length === 0 && <p>{editor_copy.no_facts}</p>}
          <ul className={styles.facts}>
            {story.facts.map((fact) => {
              const is_cited = cited.has(fact.fact_id);
              return (
                <li
                  key={fact.fact_id}
                  className={class_names(styles.fact, is_cited && styles.fact_cited)}
                  data-cited={is_cited ? "true" : undefined}
                >
                  <span className={styles.fact_head}>
                    <code className={styles.fact_id}>{fact.fact_id}</code>
                    <span className={styles.meta}>{fact.type}</span>
                    {is_cited && <span className={styles.cited_tag}>{editor_copy.fact_cited}</span>}
                  </span>
                  <span className={styles.fact_value}>{format_fact_value(fact.value)}</span>
                  <span className={styles.meta}>{editor_copy.fact_source(fact.source)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <StoryActions story={story} on_done={on_done} />
    </section>
  );
}
