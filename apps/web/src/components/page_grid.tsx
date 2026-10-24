import type { CSSProperties, ReactNode } from "react";
import styles from "./page_grid.module.css";

interface PageGridProps {
  /** Content: AI preview, data says, live chart, events, AI summary, highlight, ranking. */
  main: ReactNode;
  /** The user's actions and results: picks, live picks, points, quiz, rank. */
  sidebar: ReactNode;
  sidebar_label?: string;
}

/**
 * Desktop (from 900 px): main column + 380 px sidebar. Mobile: one column of cards,
 * in the order given by each GridItem's `mobile_order` (main and sidebar items mix).
 */
export function PageGrid({ main, sidebar, sidebar_label }: PageGridProps) {
  return (
    <div className={styles.grid}>
      <div className={styles.main}>{main}</div>
      <aside className={styles.sidebar} aria-label={sidebar_label}>
        {sidebar}
      </aside>
    </div>
  );
}

type OrderStyle = CSSProperties & { "--mobile_order": number };

/** One block of the grid; `mobile_order` places it in the single mobile column. */
export function GridItem({
  mobile_order,
  children,
}: {
  mobile_order: number;
  children: ReactNode;
}) {
  const style: OrderStyle = { "--mobile_order": mobile_order };
  return (
    <div className={styles.item} style={style}>
      {children}
    </div>
  );
}
