import type { ReactNode } from "react";
import { useDemoMode } from "../lib/demo_mode";
import { BackLink } from "./back_link";
import { DemoBadge } from "./demo_badge";
import styles from "./game_top_bar.module.css";

/** Top of every game screen: back link and status; in demo mode a "Demo replay" badge below. */
export function GameTopBar({ status }: { status: ReactNode }) {
  const { is_demo } = useDemoMode();
  return (
    <div className={styles.top}>
      <div className={styles.bar}>
        <BackLink />
        {status}
      </div>
      {is_demo && (
        <div className={styles.demo_row}>
          <DemoBadge />
        </div>
      )}
    </div>
  );
}
