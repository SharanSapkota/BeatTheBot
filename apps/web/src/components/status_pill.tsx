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
  /** Upcoming / final pills sit on the dark desktop hero: dark pill, white text from 900 px. */
  dark_on_desktop?: boolean;
  children: ReactNode;
}

export function StatusPill({
  tone,
  size = "small",
  dot = false,
  dark_on_desktop = false,
  children,
}: StatusPillProps) {
  return (
    <span
      className={class_names(
        styles.pill,
        styles[tone],
        styles[size],
        dark_on_desktop && tone !== "live" && styles.dark_on_desktop,
      )}
    >
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}
