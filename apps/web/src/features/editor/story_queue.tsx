import type { EditorStory } from "@voita_kone/shared_types";
import { class_names } from "../../lib/class_names";
import { editor_copy } from "./copy";
import { TrafficLightChip } from "./traffic_light_chip";
import styles from "./story_queue.module.css";

interface StoryQueueProps {
  stories: EditorStory[];
  selected_id: string | undefined;
  on_select: (story_id: string) => void;
}

/** The stories waiting for review; each item is a button named after the game and story type. */
export function StoryQueue({ stories, selected_id, on_select }: StoryQueueProps) {
  return (
    <nav aria-label={editor_copy.queue_label} className={styles.queue}>
      <ul className={styles.list}>
        {stories.map((story) => {
          const is_selected = story.id === selected_id;
          const details_id = `queue_details_${story.id}`;
          return (
            <li key={story.id}>
              <button
                type="button"
                className={class_names(styles.item, is_selected && styles.selected)}
                aria-current={is_selected ? "true" : undefined}
                aria-label={editor_copy.queue_item_name(story.game, story.story_type)}
                aria-describedby={details_id}
                onClick={() => on_select(story.id)}
              >
                <span className={styles.name} aria-hidden="true">
                  {editor_copy.queue_item_name(story.game, story.story_type)}
                </span>
                <span id={details_id} className={styles.details}>
                  <TrafficLightChip traffic_light={story.traffic_light} />
                  <span className={styles.headline}>{story.headline}</span>
                  {story.reasons.length > 0 && (
                    <span className={styles.reasons}>{story.reasons.join(" · ")}</span>
                  )}
                  {story.reports.length > 0 && (
                    <span className={styles.reports}>
                      {editor_copy.reports_count(story.reports.length)}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
