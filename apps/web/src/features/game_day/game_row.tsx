import type { GameSummary } from "@voita_kone/shared_types";
import { Link } from "react-router";
import { ChevronRightIcon } from "../../components/icons/chevron_right_icon";
import { StatusPill } from "../../components/status_pill";
import { TeamBadge } from "../../components/team_badge";
import { useDemoMode } from "../../lib/demo_mode";
import { format_percent } from "../../lib/format";
import { useAiPrediction } from "../game/api";
import { center_text, game_status } from "./game_status";
import { game_day_copy } from "./copy";
import styles from "./game_row.module.css";

function AiLine({ game }: { game: GameSummary }) {
  const prediction = useAiPrediction(game).data;
  if (game.state === "live") {
    return game_day_copy.row_live;
  }
  if (game.state === "final") {
    return game_day_copy.row_final;
  }
  if (!prediction) {
    return "…";
  }
  const home_favoured = prediction.predicted_winner_team_id === game.home_team.id;
  const team = home_favoured ? game.home_team : game.away_team;
  const share = home_favoured
    ? prediction.home_win_probability
    : 1 - prediction.home_win_probability;
  return game_day_copy.row_ai(team.name, format_percent(share));
}

/** One of the other games of the day. */
export function GameRow({ game }: { game: GameSummary }) {
  const { link_to } = useDemoMode();
  const status = game_status(game, false);
  return (
    <Link
      to={link_to(`/games/${game.id}`)}
      className={styles.row}
      aria-label={`${game_day_copy.open_game(game.home_team.name, game.away_team.name)}, ${status.label}, ${center_text(game)}`}
    >
      <div className={styles.teams}>
        {[game.home_team, game.away_team].map((team) => (
          <div key={team.id} className={styles.team}>
            <TeamBadge team={team} size="row" />
            <span className={styles.team_name}>{team.name}</span>
          </div>
        ))}
      </div>
      <div className={styles.side}>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
        <span className={styles.center}>{center_text(game)}</span>
        <span className={styles.ai_line}>
          <AiLine game={game} />
        </span>
      </div>
      <span className={styles.chevron}>
        <ChevronRightIcon />
      </span>
    </Link>
  );
}
