import type { EditorStory } from "@voita_kone/shared_types";
import { useState } from "react";
import { EmptyState } from "../../components/empty_state";
import { ErrorState } from "../../components/error_state";
import { SegmentTabs } from "../../components/segment_tabs";
import { Skeleton } from "../../components/skeleton";
import { useEditorQueue, type QueueFilter } from "./api";
import { editor_copy } from "./copy";
import { StoryQueue } from "./story_queue";
import { StoryReview } from "./story_review";
import styles from "./stories_tab.module.css";

/** The selected story, or the first one when nothing (or a story that left the queue) is selected. */
function pick_selected(
  stories: EditorStory[],
  selected_id: string | null,
): EditorStory | undefined {
  return stories.find((story) => story.id === selected_id) ?? stories[0];
}

/**
 * /admin → Stories (role editor or admin): the 🟡 / 🔴 queue, each story's text next to its fact
 * sheet with every claim marked; approve, edit + approve (checked again) or reject.
 */
export function StoriesTab() {
  const [filter, set_filter] = useState<QueueFilter>("all");
  const queue = useEditorQueue(true, filter);
  const [selected_id, set_selected_id] = useState<string | null>(null);
  const [status_message, set_status_message] = useState<string | null>(null);
  const stories = queue.data ?? [];
  const selected = pick_selected(stories, selected_id);

  return (
    <div className={styles.tab}>
      <div className={styles.filters}>
        <SegmentTabs
          label={editor_copy.filter_label}
          tabs={editor_copy.filters}
          selected={filter}
          on_change={(next) => {
            set_filter(next);
            set_selected_id(null);
          }}
        />
      </div>
      {status_message && (
        <p className={styles.status} role="status">
          {status_message}
        </p>
      )}
      {queue.isPending && <Skeleton card_heights={[120, 320]} />}
      {queue.isError && <ErrorState on_retry={() => void queue.refetch()} />}
      {queue.data && stories.length === 0 && (
        <EmptyState title={editor_copy.queue_empty_title} text={editor_copy.queue_empty_text} />
      )}
      {queue.data && stories.length > 0 && (
        <div className={styles.layout}>
          <StoryQueue
            stories={stories}
            selected_id={selected?.id}
            on_select={(story_id) => {
              set_selected_id(story_id);
              set_status_message(null);
            }}
          />
          {selected ? (
            <StoryReview
              key={selected.id}
              story={selected}
              on_done={(message) => {
                set_status_message(message);
                set_selected_id(null);
              }}
            />
          ) : (
            <p>{editor_copy.select_story}</p>
          )}
        </div>
      )}
    </div>
  );
}
