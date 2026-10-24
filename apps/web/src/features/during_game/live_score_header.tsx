import type { GameSummary } from "@voita_kone/shared_types";
import { GameTopBar } from "../../components/game_top_bar";
import { ScoreHeader } from "../../components/score_header";
import { StatusPill } from "../../components/status_pill";
import { format_period, format_period_clock } from "../../lib/format";
import { during_copy } from "./copy";
import styles from "./live_score_header.module.css";

function live_status(game: GameSummary): string {
  if (game.period === null || game.game_clock_seconds === null) {
    return during_copy.live;
  }
  return during_copy.live_status(
    format_period(game.period),
    format_period_clock(game.game_clock_seconds, game.period),
  );
}

export function LiveScoreHeader({ game, live_points }: { game: GameSummary; live_points: number }) {
  return (
    <ScoreHeader
      game={game}
      top_bar={
        <GameTopBar
          status={
            <StatusPill tone="live" size="large" dot>
              {live_status(game)}
            </StatusPill>
          }
        />
      }
    >
      <div className={styles.points}>
        <span className={styles.label}>{during_copy.live_points}</span>
        <span className={styles.value}>+{live_points}</span>
      </div>
    </ScoreHeader>
  );
}
