import type { CSSProperties } from "react";
import { Link } from "react-router";
import { useDemoMode } from "../../lib/demo_mode";
import { format_percent } from "../../lib/format";
import { useLeaderboard } from "../leaderboard/api";
import { game_day_copy } from "./copy";
import styles from "./humans_vs_ai_mini.module.css";

/** This week's correct-pick rate: you (orange), Kaleva AI (blue), all fans (gray). */
export function HumansVsAiMini() {
  const { link_to } = useDemoMode();
  const leaderboard = useLeaderboard("week").data;
  if (!leaderboard) {
    return null;
  }
  const rows = [
    { label: game_day_copy.you, share: leaderboard.accuracy.you, color: "var(--color_you)" },
    { label: game_day_copy.ai, share: leaderboard.accuracy.ai, color: "var(--color_ai)" },
    { label: game_day_copy.fans, share: leaderboard.accuracy.fans, color: "var(--color_fans)" },
  ];
  return (
    <Link to={link_to("/leaderboard")} className={styles.card}>
      <div className={styles.top}>
        <h2 className={styles.title}>{game_day_copy.mini_title}</h2>
        <span className={styles.link}>{game_day_copy.mini_link}</span>
      </div>
      <div className={styles.rows}>
        {rows.map((row) => {
          const fill: CSSProperties = { width: format_percent(row.share), background: row.color };
          return (
            <div key={row.label} className={styles.row}>
              <span className={styles.label}>{row.label}</span>
              <span className={styles.track} aria-hidden="true">
                <span className={styles.fill} style={fill} />
              </span>
              <span className={styles.value}>{format_percent(row.share)}</span>
            </div>
          );
        })}
      </div>
    </Link>
  );
}
