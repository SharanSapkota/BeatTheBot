import type { ReactNode } from "react";
import { class_names } from "../lib/class_names";
import styles from "./status_pill.module.css";

export type StatusTone = "upcoming" | "live" | "final" | "on_dark" | "on_dark_warning";

interface StatusPillProps {
  tone: StatusTone;
  /** "large" is the header size (12 px, more padding). */
  size?: "small" | "large";
  /** A white dot before the text (LIVE in the game header). */
  dot?: boolean;
  children: ReactNode;
}

export function StatusPill({ tone, size = "small", dot = false, children }: StatusPillProps) {
  return (
    <span className={class_names(styles.pill, styles[tone], styles[size])}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}
