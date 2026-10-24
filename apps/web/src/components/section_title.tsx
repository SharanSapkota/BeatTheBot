import type { ReactNode } from "react";
import { class_names } from "../lib/class_names";
import styles from "./section_title.module.css";

interface SectionTitleProps {
  title: ReactNode;
  /** Card titles are 17 px; the Before screen uses 16 px. */
  size?: 16 | 17;
  /** Points badge, link or note on the right. */
  right?: ReactNode;
  align?: "baseline" | "center";
  id?: string;
}

export function SectionTitle({
  title,
  size = 17,
  right,
  align = "baseline",
  id,
}: SectionTitleProps) {
  return (
    <div className={class_names(styles.row, styles[align])}>
      <h2 id={id} className={size === 16 ? styles.title_16 : styles.title_17}>
        {title}
      </h2>
      {right}
    </div>
  );
}
