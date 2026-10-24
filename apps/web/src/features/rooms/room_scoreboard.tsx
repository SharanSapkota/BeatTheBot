import type { RoomLeaderboardPeriod } from "@voita_kone/shared_types";
import { useState } from "react";
import { Card } from "../../components/card";
import { ErrorState } from "../../components/error_state";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { SegmentTabs } from "../../components/segment_tabs";
import { Skeleton } from "../../components/skeleton";
import { class_names } from "../../lib/class_names";
import { format_optional_percent, initials_of } from "../../lib/format";
import { useRoomLeaderboard } from "./api";
import { rooms_copy } from "./copy";
import styles from "./room_scoreboard.module.css";

/** The room's own ranking (every member), this week or all time; "you" highlighted. */
export function RoomScoreboard({ room_id }: { room_id: string }) {
  const [period, set_period] = useState<RoomLeaderboardPeriod>("week");
  const board = useRoomLeaderboard(room_id, period, true);
  return (
    <Card labelled_by="room_scoreboard_title">
      <KalevaSectionTitle
        id="room_scoreboard_title"
        title={rooms_copy.scoreboard_title}
        mobile_variant="card"
      />
      <SegmentTabs
        label={rooms_copy.periods_label}
        tabs={rooms_copy.periods}
        selected={period}
        on_change={set_period}
      />
      {board.isPending && <Skeleton card_heights={[200]} />}
      {board.isError && <ErrorState on_retry={() => void board.refetch()} />}
      {board.data && (
        <ol className={styles.list} aria-label={rooms_copy.scoreboard_title}>
          {board.data.rows.map((row) => (
            <li
              key={`${row.display_name}_${String(row.rank)}_${row.kind}`}
              className={class_names(styles.row, row.kind === "you" && styles.row_you)}
            >
              <span className={styles.rank} aria-label={rooms_copy.rank_label(row.rank)}>
                {row.rank}
              </span>
              <span className={class_names(styles.avatar, row.kind === "you" && styles.avatar_you)}>
                {row.kind === "you" ? rooms_copy.you_initials : initials_of(row.display_name)}
              </span>
              <span className={styles.name_column}>
                <span className={styles.name}>{row.display_name}</span>
                <span className={styles.meta}>
                  {rooms_copy.board_meta(row.answers, format_optional_percent(row.correct_share))}
                </span>
              </span>
              <span className={styles.points}>{rooms_copy.points(row.points)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
