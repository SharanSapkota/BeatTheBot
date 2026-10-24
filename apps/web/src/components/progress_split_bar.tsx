import type { CSSProperties } from "react";
import styles from "./progress_split_bar.module.css";

interface ProgressSplitBarProps {
  /** Share of the left part, 0..1. */
  left_share: number;
  left_color: string;
  right_color: string;
  height: number;
  left_label?: string;
  right_label?: string;
  /** Labels in 600 weight (AI pick) or 400 (fans). */
  bold_labels?: boolean;
}

/** Two-part bar (AI pick, fans' split) with optional labels below. */
export function ProgressSplitBar({
  left_share,
  left_color,
  right_color,
  height,
  left_label,
  right_label,
  bold_labels = false,
}: ProgressSplitBarProps) {
  const left_percent = `${String(Math.round(left_share * 100))}%`;
  const bar_style: CSSProperties = { height: `${String(height)}px` };
  return (
    <div className={styles.wrapper}>
      <div className={styles.bar} style={bar_style} aria-hidden="true">
        <span style={{ width: left_percent, background: left_color }} />
        <span style={{ flexGrow: 1, background: right_color }} />
      </div>
      {left_label !== undefined && (
        <div className={bold_labels ? styles.labels_bold : styles.labels}>
          <span>{left_label}</span>
          <span>{right_label}</span>
        </div>
      )}
    </div>
  );
}
