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

/** "AI: Tappara 57%" (mobile) or "AI's pick: Tappara 57%" (desktop list). */
function useAiLine(game: GameSummary, is_long: boolean): string {
  const prediction = useAiPrediction(game).data;
  if (game.state === "live") {
    return game_day_copy.row_live;
  }
  if (game.state === "final") {
    return game_day_copy.row_final;
  }
  if (prediction === undefined) {
    return "…";
  }
  if (prediction === null) {
    return game_day_copy.row_ai_pending;
  }
  const home_favoured = prediction.predicted_winner_team_id === game.home_team.id;
  const team = home_favoured ? game.home_team : game.away_team;
  const share = home_favoured ? prediction.home_win_probability : prediction.away_win_probability;
  return (is_long ? game_day_copy.row_ai_long : game_day_copy.row_ai)(
    team.name,
    format_percent(share),
  );
}

/**
 * One of the other games of the day. Mobile: both teams, status and AI line. Desktop: a
 * kaleva.fi list item (dark thumbnail with the badges, headline, AI line, category label).
 */
export function GameRow({ game }: { game: GameSummary }) {
  const { link_to } = useDemoMode();
  const status = game_status(game, false);
  const center = center_text(game);
  const headline_time = game.state === "upcoming" ? status.label : center;
  const ai_line = useAiLine(game, false);
  const ai_line_long = useAiLine(game, true);

  return (
    <Link
      to={link_to(`/games/${game.id}`)}
      className={styles.row}
      aria-label={`${game_day_copy.open_game(game.home_team.name, game.away_team.name)}, ${status.label}, ${center}`}
    >
      <span className={styles.compact}>
        <span className={styles.teams}>
          {[game.home_team, game.away_team].map((team) => (
            <span key={team.id} className={styles.team}>
              <TeamBadge team={team} size="row" />
              <span className={styles.team_name}>{team.name}</span>
            </span>
          ))}
        </span>
        <span className={styles.side}>
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
          <span className={styles.center}>{center}</span>
          <span className={styles.ai_line}>{ai_line}</span>
        </span>
        <span className={styles.chevron}>
          <ChevronRightIcon />
        </span>
      </span>
      <span className={styles.media}>
        <span className={styles.thumb}>
          <TeamBadge team={game.home_team} size="thumb" />
          <TeamBadge team={game.away_team} size="thumb" />
        </span>
        <span className={styles.texts}>
          <span className={styles.headline}>
            {game_day_copy.row_headline(game.home_team.name, game.away_team.name, headline_time)}
          </span>
          <span className={styles.detail}>{ai_line_long}</span>
          <span className={styles.category}>{game_day_copy.category}</span>
        </span>
      </span>
    </Link>
  );
}
