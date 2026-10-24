import type { Leaderboard, LeaderboardRow } from "@voita_kone/shared_types";
import { Fragment } from "react";
import { RobotIcon } from "../../components/icons/robot_icon";
import { class_names } from "../../lib/class_names";
import { format_number, initials_of } from "../../lib/format";
import { leaderboard_copy } from "./copy";
import styles from "./ranking_list.module.css";

function Avatar({ row }: { row: LeaderboardRow }) {
  if (row.kind === "ai") {
    return (
      <span className={class_names(styles.avatar, styles.avatar_ai)}>
        <RobotIcon />
      </span>
    );
  }
  if (row.kind === "you") {
    return (
      <span className={class_names(styles.avatar, styles.avatar_you)}>
        {leaderboard_copy.you_initials}
      </span>
    );
  }
  return <span className={styles.avatar}>{initials_of(row.display_name)}</span>;
}

/** Top players, the Kaleva AI row (blue) and the "You" row (orange) highlighted. */
export function RankingList({ leaderboard }: { leaderboard: Leaderboard }) {
  const rows = [...leaderboard.rows].sort((first, second) => first.rank - second.rank);
  return (
    <section className={styles.card} aria-label={leaderboard_copy.ranking_label}>
      <ol className={styles.list}>
        {rows.map((row, index) => {
          const previous = rows[index - 1];
          const has_gap =
            row.kind === "you" && previous !== undefined && row.rank - previous.rank > 1;
          return (
            <Fragment key={`${row.kind}_${String(row.rank)}`}>
              {has_gap && (
                <li className={styles.gap} aria-hidden="true">
                  · · ·
                </li>
              )}
              <li
                className={class_names(
                  styles.row,
                  row.kind === "ai" && styles.row_ai,
                  row.kind === "you" && styles.row_you,
                )}
              >
                <span
                  className={class_names(styles.rank, row.rank === 1 && styles.rank_first)}
                  aria-label={leaderboard_copy.rank_label(row.rank)}
                >
                  {row.rank}
                </span>
                <Avatar row={row} />
                <span className={styles.name_column}>
                  <span className={styles.name}>{row.display_name}</span>
                  {row.kind === "you" && row.movement !== null && row.movement > 0 && (
                    <span className={styles.movement}>
                      {leaderboard_copy.movement(row.movement, leaderboard.period)}
                    </span>
                  )}
                </span>
                <span
                  className={styles.points}
                  aria-label={leaderboard_copy.points_label(format_number(row.points))}
                >
                  {format_number(row.points)}
                </span>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </section>
  );
}
