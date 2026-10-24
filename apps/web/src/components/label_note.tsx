import { useState } from "react";
import { class_names } from "../lib/class_names";
import { shared_copy } from "./copy";
import styles from "./label_note.module.css";

interface LabelNoteProps {
  /** e.g. "AI-written from Liiga data. Checked by Kaleva sports desk, 21:47." */
  text: string;
  /** "inline": the link follows the text; "stacked": the link on its own line. */
  layout?: "inline" | "stacked";
}

/** The label every AI item carries, with "Report an error" (editorial rule 4). */
export function LabelNote({ text, layout = "inline" }: LabelNoteProps) {
  const [is_reported, set_is_reported] = useState(false);
  const report = (
    <button type="button" className={styles.report} onClick={() => set_is_reported(true)}>
      {shared_copy.report_error}
    </button>
  );
  return (
    <div className={class_names(styles.note, styles[layout])}>
      {layout === "inline" ? (
        <span className={styles.text}>
          {text} {report}
        </span>
      ) : (
        <>
          <span className={styles.text}>{text}</span>
          {report}
        </>
      )}
      {is_reported && (
        <span className={styles.thanks} role="status">
          {shared_copy.report_thanks}
        </span>
      )}
    </div>
  );
}
