import type { EditorStory } from "@voita_kone/shared_types";
import { useId, useState } from "react";
import { InlineError } from "../../components/inline_error";
import { ApiError } from "../../lib/api_client";
import { useEditorAction, type EditorAction } from "./api";
import { editor_copy } from "./copy";
import styles from "./story_actions.module.css";

type Mode = "choose" | "edit" | "reject";

interface StoryActionsProps {
  story: EditorStory;
  on_done: (message: string) => void;
}

/** The fact checker's 422 answer, which lists the problems in its message. */
function check_failed_message(error: unknown): string | null {
  if (error instanceof ApiError && (error.code === "CHECK_FAILED" || error.http_status === 422)) {
    return error.message;
  }
  return null;
}

function optional_note(note: string): string | undefined {
  const trimmed = note.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Approve, edit and approve (fact checker re-runs), or reject the story. */
export function StoryActions({ story, on_done }: StoryActionsProps) {
  const [mode, set_mode] = useState<Mode>("choose");
  const [body, set_body] = useState(story.body);
  const [note, set_note] = useState("");
  const action = useEditorAction();
  const field_id = useId();

  const run = (request: EditorAction) => {
    action.mutate(request, {
      onSuccess: (result) => on_done(editor_copy.action_done(story.headline, result.status)),
    });
  };

  const switch_mode = (next: Mode) => {
    action.reset();
    set_note("");
    set_mode(next);
  };

  const checker_message = mode === "edit" ? check_failed_message(action.error) : null;
  const other_error = action.isError && checker_message === null ? action.error : null;

  return (
    <div className={styles.actions}>
      {mode === "choose" && (
        <div className={styles.row}>
          <button
            type="button"
            className={styles.approve}
            disabled={action.isPending}
            onClick={() => run({ kind: "approve", story_id: story.id })}
          >
            {editor_copy.approve}
          </button>
          <button
            type="button"
            className={styles.secondary}
            disabled={action.isPending}
            onClick={() => switch_mode("edit")}
          >
            {editor_copy.edit_and_approve}
          </button>
          <button
            type="button"
            className={styles.danger}
            disabled={action.isPending}
            onClick={() => switch_mode("reject")}
          >
            {editor_copy.reject}
          </button>
        </div>
      )}

      {mode === "edit" && (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            run({ kind: "edit", story_id: story.id, body, note: optional_note(note) });
          }}
        >
          <label className={styles.label} htmlFor={`${field_id}_body`}>
            {editor_copy.body_label}
          </label>
          <textarea
            id={`${field_id}_body`}
            className={styles.textarea}
            rows={8}
            value={body}
            onChange={(event) => set_body(event.target.value)}
          />
          <label className={styles.label} htmlFor={`${field_id}_note`}>
            {editor_copy.edit_note_label}
          </label>
          <input
            id={`${field_id}_note`}
            className={styles.input}
            maxLength={300}
            value={note}
            onChange={(event) => set_note(event.target.value)}
          />
          {checker_message !== null && (
            <div className={styles.checker} role="alert">
              <strong>{editor_copy.check_failed}</strong> {checker_message}
            </div>
          )}
          <div className={styles.row}>
            <button type="submit" className={styles.approve} disabled={action.isPending}>
              {editor_copy.save_and_approve}
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => switch_mode("choose")}
            >
              {editor_copy.cancel}
            </button>
          </div>
        </form>
      )}

      {mode === "reject" && (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            run({ kind: "reject", story_id: story.id, note: optional_note(note) });
          }}
        >
          <label className={styles.label} htmlFor={`${field_id}_reject`}>
            {editor_copy.reject_note_label}
          </label>
          <input
            id={`${field_id}_reject`}
            className={styles.input}
            maxLength={300}
            value={note}
            onChange={(event) => set_note(event.target.value)}
          />
          <div className={styles.row}>
            <button type="submit" className={styles.danger} disabled={action.isPending}>
              {editor_copy.reject}
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => switch_mode("choose")}
            >
              {editor_copy.cancel}
            </button>
          </div>
        </form>
      )}

      {action.isPending && (
        <p className={styles.working} role="status">
          {editor_copy.working}
        </p>
      )}
      {other_error && <InlineError text={editor_copy.action_failed(other_error.message)} />}
    </div>
  );
}
