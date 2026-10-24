import { useId, useState, type FormEvent } from "react";
import { class_names } from "../lib/class_names";
import { shared_copy } from "./copy";
import styles from "./label_note.module.css";

interface LabelNoteProps {
  /** e.g. "Written with AI from Liiga data · checked by Kaleva". */
  text: string;
  /** "inline": the link follows the text; "stacked": the link on its own line. */
  layout?: "inline" | "stacked";
  /** Sends a report with the reader's reason; without it the link only says thanks. */
  on_report?: (reason: string) => Promise<void>;
}

const MIN_REASON_LENGTH = 3;

/** The label every AI item carries, with "Report an error" (editorial rule 4). */
export function LabelNote({ text, layout = "inline", on_report }: LabelNoteProps) {
  const [state, set_state] = useState<"idle" | "asking" | "sending" | "sent" | "failed">("idle");
  const [reason, set_reason] = useState("");
  const reason_id = useId();

  const open = () => set_state(on_report ? "asking" : "sent");
  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!on_report || reason.trim().length < MIN_REASON_LENGTH) {
      return;
    }
    set_state("sending");
    try {
      await on_report(reason.trim());
      set_state("sent");
    } catch {
      set_state("failed");
    }
  };

  const report = (
    <button type="button" className={styles.report} onClick={open}>
      {shared_copy.report_error}
    </button>
  );
  return (
    <div className={class_names(styles.note, styles[layout])}>
      {layout === "inline" ? (
        <span className={styles.text}>
          {text} {state === "idle" && report}
        </span>
      ) : (
        <>
          <span className={styles.text}>{text}</span>
          {state === "idle" && report}
        </>
      )}
      {(state === "asking" || state === "sending" || state === "failed") && (
        <form className={styles.form} onSubmit={(event) => void send(event)}>
          <label htmlFor={reason_id} className={styles.form_label}>
            {shared_copy.report_reason_label}
          </label>
          <textarea
            id={reason_id}
            className={styles.reason}
            value={reason}
            maxLength={500}
            rows={3}
            onChange={(event) => set_reason(event.target.value)}
          />
          {state === "failed" && (
            <span className={styles.failed} role="alert">
              {shared_copy.report_failed}
            </span>
          )}
          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.send}
              disabled={state === "sending" || reason.trim().length < MIN_REASON_LENGTH}
            >
              {shared_copy.report_send}
            </button>
            <button type="button" className={styles.report} onClick={() => set_state("idle")}>
              {shared_copy.report_cancel}
            </button>
          </div>
        </form>
      )}
      {state === "sent" && (
        <span className={styles.thanks} role="status">
          {shared_copy.report_thanks}
        </span>
      )}
    </div>
  );
}
