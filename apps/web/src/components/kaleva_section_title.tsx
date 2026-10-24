import type { ReactNode } from "react";
import { class_names } from "../lib/class_names";
import styles from "./kaleva_section_title.module.css";

interface KalevaSectionTitleProps {
  title: ReactNode;
  /** Gray uppercase line below the title (e.g. "Sat 24 Oct · 5 games · Liiga"). */
  meta?: ReactNode;
  /** Show the meta line on the phone layout only (the desktop sidebar has no room for it). */
  meta_mobile_only?: boolean;
  /** Points badge or note after the orange bar. */
  right?: ReactNode;
  level?: "h1" | "h2";
  /**
   * "kaleva": the Kaleva title on both layouts (TODAY'S GAMES on mobile).
   * "card": a plain card title on mobile, the Kaleva title from 900 px.
   */
  mobile_variant?: "kaleva" | "card";
  id?: string;
}

/** Kaleva-style section title: uppercase condensed title + an orange bar filling the row. */
export function KalevaSectionTitle({
  title,
  meta,
  meta_mobile_only = false,
  right,
  level = "h2",
  mobile_variant = "kaleva",
  id,
}: KalevaSectionTitleProps) {
  const Heading = level;
  return (
    <div className={class_names(styles.block, styles[mobile_variant])}>
      <div className={styles.row}>
        <Heading id={id} className={styles.title}>
          {title}
        </Heading>
        <span className={styles.bar} aria-hidden="true" />
        {right}
      </div>
      {meta && (
        <span className={class_names(styles.meta, meta_mobile_only && styles.mobile_only)}>
          {meta}
        </span>
      )}
    </div>
  );
}
