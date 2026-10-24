import type { Story, StoryType } from "@voita_kone/shared_types";
import { format_clock_time, format_compact_score, format_day_label } from "../lib/format";
import { Card } from "./card";
import { shared_copy } from "./copy";
import { RobotIcon } from "./icons/robot_icon";
import { LabelNote } from "./label_note";
import { Skeleton } from "./skeleton";
import styles from "./ai_story_card.module.css";

interface AiStoryCardProps {
  story_type: StoryType;
  /** undefined = loading, null = not published yet ("coming soon", never sample text). */
  story: Story | null | undefined;
  on_report: (story_id: string, reason: string) => Promise<void>;
}

/**
 * The AI preview (3 bullets + last meetings) or the AI summary, on the light AI blue tint, with
 * its label, "Report an error" and a correction note when an editor changed it after publishing.
 */
export function AiStoryCard({ story_type, story, on_report }: AiStoryCardProps) {
  const title_id = `ai_${story_type}_title`;
  if (story === undefined) {
    return <Skeleton card_heights={[220]} />;
  }
  const kicker = story_type === "preview" ? shared_copy.ai_preview : shared_copy.ai_summary;
  return (
    <Card tone="ai_tint" gap={12} labelled_by={title_id}>
      <div className={styles.head}>
        <span className={styles.icon}>
          <RobotIcon size={18} />
        </span>
        <div className={styles.titles}>
          <span className={styles.kicker}>{kicker}</span>
          <h2 id={title_id} className={styles.title}>
            {story ? story.headline : shared_copy.coming_soon(story_type)}
          </h2>
        </div>
      </div>
      {story === null && (
        <p className={styles.pending}>{shared_copy.coming_soon_text(story_type)}</p>
      )}
      {story && story.bullets.length > 0 && (
        <ul className={styles.bullets}>
          {story.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      )}
      {story && story.bullets.length === 0 && <p className={styles.body}>{story.body}</p>}
      {story && story.last_meetings.length > 0 && (
        <div className={styles.meetings}>
          <h3 className={styles.meetings_title}>{shared_copy.last_meetings}</h3>
          <ul className={styles.meeting_list}>
            {story.last_meetings.map((meeting) => (
              <li key={`${meeting.date}_${meeting.home_team}`} className={styles.meeting}>
                <span className={styles.meeting_date}>
                  {format_day_label(`${meeting.date}T12:00:00Z`)}
                </span>
                <span>
                  {meeting.home_team} {format_compact_score(meeting.home_goals, meeting.away_goals)}{" "}
                  {meeting.away_team}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {story?.correction && (
        <p className={styles.correction}>
          {shared_copy.corrected(
            format_clock_time(story.correction.corrected_at),
            story.correction.note,
          )}
        </p>
      )}
      {story && (
        <LabelNote
          text={story.label_text}
          layout="stacked"
          on_report={(reason) => on_report(story.id, reason)}
        />
      )}
    </Card>
  );
}
