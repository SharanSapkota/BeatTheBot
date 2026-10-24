import type { CSSProperties, ReactNode } from "react";
import { class_names } from "../lib/class_names";
import styles from "./card.module.css";

interface CardProps {
  /** A 4 px colored top border: AI blue or "you" orange. */
  accent?: "ai" | "you";
  tone?: "white" | "navy" | "orange";
  /** "list" = card with rows that have their own padding. */
  padding?: "normal" | "list" | "none";
  gap?: number;
  class_name?: string;
  labelled_by?: string;
  children: ReactNode;
}

export function Card({
  accent,
  tone = "white",
  padding = "normal",
  gap = 12,
  class_name,
  labelled_by,
  children,
}: CardProps) {
  const style: CSSProperties = { gap: `${String(gap)}px` };
  return (
    <section
      aria-labelledby={labelled_by}
      className={class_names(
        styles.card,
        styles[tone],
        styles[`padding_${padding}`],
        accent && styles[`accent_${accent}`],
        class_name,
      )}
      style={style}
    >
      {children}
    </section>
  );
}
