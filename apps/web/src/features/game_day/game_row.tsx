import type { Crowd, GameSummary } from "@voita_kone/shared_types";
import { Link } from "react-router";
import { shared_copy } from "../../components/copy";
import { ChevronRightIcon } from "../../components/icons/chevron_right_icon";
import { SampleBadge } from "../../components/sample_badge";
import { StatusPill } from "../../components/status_pill";
import { TeamBadge } from "../../components/team_badge";
import { useDemoMode } from "../../lib/demo_mode";
import { format_percent } from "../../lib/format";
import { useCrowd } from "../game/api";
import { center_text, game_status } from "./game_status";
import { game_day_copy } from "./copy";
import styles from "./game_row.module.css";

/**
 * "Fans: 62% Kärpät" (the outcome most fans picked; "Fans: 40% draw" in football), or
 * "Be the first to pick". A tie goes to the home team.
 */
export function crowd_line(game: GameSummary, crowd: Crowd | null | undefined): string {
  if (crowd === undefined) {
    return "…";
  }
  if (crowd === null) {
    return game_day_copy.fans_none;
  }
  const share = (picks: number) => format_percent(picks / crowd.total_picks);
  if (crowd.draw_picks > Math.max(crowd.home_picks, crowd.away_picks)) {
    return game_day_copy.fans_draw(share(crowd.draw_picks));
  }
  const home_ahead = crowd.home_picks >= crowd.away_picks;
  const team = home_ahead ? game.home_team : game.away_team;
  return game_day_copy.fans_split(
    team.name,
    share(home_ahead ? crowd.home_picks : crowd.away_picks),
  );
}

/** "Hockey · Liiga" */
export function category_of(game: GameSummary): string {
  return game_day_copy.category_tag(shared_copy.sport_names[game.sport], game.league.name);
}

function useRowLine(game: GameSummary): string {
  const crowd = useCrowd(game.id).data;
  if (game.state === "live") {
    return game_day_copy.row_live;
  }
  if (game.state === "final") {
    return game_day_copy.row_final;
  }
  return crowd_line(game, crowd);
}

/**
 * One of the other games of the day. Mobile: both teams, status and fans line. Desktop: a
 * kaleva.fi list item (dark thumbnail with the badges, headline, fans line, category label).
 */
export function GameRow({ game }: { game: GameSummary }) {
  const { link_to } = useDemoMode();
  const status = game_status(game, false);
  const center = center_text(game);
  const headline_time = game.state === "upcoming" ? status.label : center;
  const ai_line = useRowLine(game);

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
          {game.data_source === "demo" && <SampleBadge />}
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
          <span className={styles.detail}>{ai_line}</span>
          <span className={styles.category}>
            {category_of(game)}
            {game.data_source === "demo" && <SampleBadge />}
          </span>
        </span>
      </span>
    </Link>
  );
}
