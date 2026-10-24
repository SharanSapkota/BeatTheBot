import type { CSSProperties } from "react";
import { Link } from "react-router";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { useDemoMode } from "../../lib/demo_mode";
import { format_optional_percent, format_percent } from "../../lib/format";
import { useLeaderboard } from "../leaderboard/api";
import { game_day_copy } from "./copy";
import styles from "./fans_mini.module.css";

/** This week's correct-winner rate: you (orange) vs all fans (gray). */
export function FansMini() {
  const { link_to } = useDemoMode();
  const leaderboard = useLeaderboard("week").data;
  if (!leaderboard) {
    return null;
  }
  const rows = [
    {
      label: game_day_copy.you,
      share: leaderboard.summary.you_accuracy,
      color: "var(--color_brand)",
    },
    {
      label: game_day_copy.fans,
      share: leaderboard.summary.fans_accuracy,
      color: "var(--color_fans)",
    },
  ];
  return (
    <Link to={link_to("/leaders")} className={styles.card}>
      <KalevaSectionTitle
        mobile_variant="card"
        title={
          <>
            <span className="mobile_only">{game_day_copy.mini_title}</span>
            <span className="desktop_only">{game_day_copy.mini_title_desktop}</span>
          </>
        }
        right={<span className={styles.link}>{game_day_copy.mini_link}</span>}
      />
      <div className={styles.rows}>
        {rows.map((row) => {
          const fill: CSSProperties = {
            width: format_percent(row.share ?? 0),
            background: row.color,
          };
          return (
            <div key={row.label} className={styles.row}>
              <span className={styles.label}>{row.label}</span>
              <span className={styles.track} aria-hidden="true">
                <span className={styles.fill} style={fill} />
              </span>
              <span className={styles.value}>{format_optional_percent(row.share)}</span>
            </div>
          );
        })}
      </div>
      <span className={styles.full_link}>{game_day_copy.mini_full_link}</span>
    </Link>
  );
}
