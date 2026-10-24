import type { GameSummary } from "@voita_kone/shared_types";
import { GameTopBar } from "../../components/game_top_bar";
import { StatusPill } from "../../components/status_pill";
import { TeamBadge } from "../../components/team_badge";
import { format_clock_time, format_countdown } from "../../lib/format";
import { before_copy } from "./copy";
import styles from "./before_header.module.css";

interface BeforeHeaderProps {
  game: GameSummary;
  now: Date;
}

export function BeforeHeader({ game, now }: BeforeHeaderProps) {
  const until_start_ms = new Date(game.start_time).getTime() - now.getTime();
  const pill_text =
    until_start_ms > 0
      ? before_copy.lock_in(format_countdown(until_start_ms))
      : before_copy.locked_pill;

  return (
    <header className={styles.header}>
      <GameTopBar
        game={game}
        status={
          <StatusPill tone="on_dark_warning" size="large">
            <span role="timer">{pill_text}</span>
          </StatusPill>
        }
      />
      <div className={styles.teams}>
        <div className={styles.team}>
          <TeamBadge team={game.home_team} size="header" />
          <span className={styles.name}>{game.home_team.name}</span>
        </div>
        <span className={styles.time}>{format_clock_time(game.start_time)}</span>
        <div className={styles.team}>
          <span className={styles.name}>{game.away_team.name}</span>
          <TeamBadge team={game.away_team} size="header" />
        </div>
      </div>
    </header>
  );
}
