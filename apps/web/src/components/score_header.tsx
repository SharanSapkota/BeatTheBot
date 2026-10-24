import type { GameSummary } from "@voita_kone/shared_types";
import type { ReactNode } from "react";
import { format_score } from "../lib/format";
import { TeamBadge } from "./team_badge";
import styles from "./score_header.module.css";

interface ScoreHeaderProps {
  game: GameSummary;
  top_bar: ReactNode;
  children?: ReactNode;
}

/** Navy header with both teams and the big score (During and After screens). */
export function ScoreHeader({ game, top_bar, children }: ScoreHeaderProps) {
  const score = format_score(game.home_goals ?? 0, game.away_goals ?? 0);
  return (
    <header className={styles.header}>
      {top_bar}
      <div className={styles.teams}>
        <div className={styles.team}>
          <TeamBadge team={game.home_team} size="score" />
          <span className={styles.name}>{game.home_team.name}</span>
        </div>
        <span
          className={styles.score}
          aria-label={`${game.home_team.name} ${score} ${game.away_team.name}`}
        >
          {score}
        </span>
        <div className={styles.team}>
          <TeamBadge team={game.away_team} size="score" />
          <span className={styles.name}>{game.away_team.name}</span>
        </div>
      </div>
      {children}
    </header>
  );
}
