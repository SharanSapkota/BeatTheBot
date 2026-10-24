import type { ReactNode } from "react";
import styles from "./page_main.module.css";

/** Page content column: 16 px padding, 16 px between cards. */
export function PageMain({ children }: { children: ReactNode }) {
  return <main className={styles.main}>{children}</main>;
}
