import type { EditorStory } from "@voita_kone/shared_types";
import { useState } from "react";
import { AppHeader } from "../../components/app_header";
import { EmptyState } from "../../components/empty_state";
import { ErrorState } from "../../components/error_state";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { PageMain } from "../../components/page_main";
import { Skeleton } from "../../components/skeleton";
import { ApiError } from "../../lib/api_client";
import { useSessionToken } from "../../lib/session";
import { useUserSummary } from "../account/api";
import { useEditorQueue } from "./api";
import { editor_copy } from "./copy";
import { EditorsOnly } from "./editors_only";
import { StoryQueue } from "./story_queue";
import { StoryReview } from "./story_review";
import styles from "./editor_page.module.css";

function is_forbidden(error: unknown): boolean {
  return error instanceof ApiError && (error.http_status === 401 || error.http_status === 403);
}

/** The selected story, or the first one when nothing (or a story that left the queue) is selected. */
function pick_selected(
  stories: EditorStory[],
  selected_id: string | null,
): EditorStory | undefined {
  return stories.find((story) => story.id === selected_id) ?? stories[0];
}

/** /editor: the minimal editor page (step 7). Approve, edit or reject AI stories in review. */
export function EditorPage() {
  const token = useSessionToken();
  const user = useUserSummary();
  const is_editor = user.data?.role === "editor" || user.data?.role === "admin";
  const queue = useEditorQueue(is_editor);
  const [selected_id, set_selected_id] = useState<string | null>(null);
  const [status_message, set_status_message] = useState<string | null>(null);

  const header = <AppHeader total_points={user.data?.total_points} />;
  const title = <KalevaSectionTitle title={editor_copy.title} meta={editor_copy.meta} level="h1" />;

  if (token !== null && user.isPending) {
    return (
      <>
        {header}
        <PageMain>
          <Skeleton card_heights={[120, 320]} />
        </PageMain>
      </>
    );
  }
  if (user.isError && !is_forbidden(user.error)) {
    return (
      <>
        {header}
        <PageMain>
          <ErrorState on_retry={() => void user.refetch()} />
        </PageMain>
      </>
    );
  }
  if (token === null || !is_editor || is_forbidden(queue.error)) {
    return (
      <>
        {header}
        <PageMain>
          <EditorsOnly user_id={token === null ? undefined : user.data?.id} />
        </PageMain>
      </>
    );
  }

  const stories = queue.data ?? [];
  const selected = pick_selected(stories, selected_id);

  return (
    <>
      {header}
      <PageMain>
        {title}
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
      </PageMain>
    </>
  );
}
