import type { GameDetail, GameSummary } from "@voita_kone/shared_types";
import { max_pick_points } from "@voita_kone/scoring";
import { Link } from "react-router";
import { AiChip } from "../../components/ai_chip";
import { SampleBadge } from "../../components/sample_badge";
import { StatusPill } from "../../components/status_pill";
import { TeamBadge } from "../../components/team_badge";
import { useDemoMode } from "../../lib/demo_mode";
import { format_percent } from "../../lib/format";
import { useGamePicks } from "../../lib/picks";
import { possible_points, winner_team_id } from "../../lib/points";
import { config_of } from "../../lib/sports";
import { useWinChance } from "../during_game/api";
import { useCrowd, useDataSays, useGameDetail } from "../game/api";
import { useGamePoints } from "../game/use_game_points";
import { center_text, game_status } from "./game_status";
import { game_day_copy } from "./copy";
import { crowd_line } from "./game_row";
import { HeroCaption } from "./hero_caption";
import styles from "./featured_game_card.module.css";

function UpcomingLines({ game }: { game: GameSummary }) {
  const crowd = useCrowd(game.id).data;
  const [picks] = useGamePicks(game);
  return (
    <>
      <AiChip text={crowd_line(game, crowd)} variant="hero" tone="fans" />
      <span className={styles.your_line}>
        {picks.locked_at
          ? game_day_copy.picks_saved(possible_points(picks, game, crowd ?? null))
          : game_day_copy.picks_not_made(max_pick_points(game.sport))}
      </span>
    </>
  );
}

function LiveDataChip({ game }: { game: GameDetail }) {
  const data_says = useDataSays(game).data;
  const win_chance = useWinChance(game, data_says).data;
  const home_share = win_chance?.points.at(-1)?.home_win_probability;
  let text = "…";
  if (data_says === null) {
    text = game_day_copy.data_not_ready;
  } else if (home_share !== undefined) {
    text = game_day_copy.data_now(game.home_team.name, format_percent(home_share));
  }
  return <AiChip text={text} variant="hero" />;
}

function FinalLines({ game }: { game: GameDetail }) {
  const crowd = useCrowd(game.id).data;
  const points = useGamePoints(game);
  const winner_id = winner_team_id(game);
  let crowd_text = "…";
  if (crowd === null) {
    crowd_text = game_day_copy.fans_no_picks;
  } else if (crowd && winner_id === null) {
    crowd_text = game_day_copy.fans_picked_draw(
      format_percent(crowd.draw_picks / crowd.total_picks),
    );
  } else if (crowd) {
    const winner = winner_id === game.away_team.id ? game.away_team : game.home_team;
    const picks = winner.id === game.home_team.id ? crowd.home_picks : crowd.away_picks;
    crowd_text = game_day_copy.fans_picked_winner(
      format_percent(picks / crowd.total_picks),
      winner.name,
    );
  }
  const made_picks = points.total > 0 || points.winner !== null;
  return (
    <>
      <AiChip text={crowd_text} variant="hero" tone="fans" />
      <span className={styles.your_line}>
        {made_picks ? game_day_copy.your_points(points.total) : game_day_copy.no_picks_made}
      </span>
    </>
  );
}

/** Live and final lines need the game's events, so they load the detail. */
function DetailLines({ game }: { game: GameSummary }) {
  const detail = useGameDetail(game.id).data;
  if (!detail) {
    return (
      <>
        <AiChip text="…" variant="hero" />
        <span className={styles.your_line}>&nbsp;</span>
      </>
    );
  }
  if (detail.state === "final") {
    return <FinalLines game={detail} />;
  }
  const config = config_of(detail.sport);
  return (
    <>
      {config.has_model ? (
        <LiveDataChip game={detail} />
      ) : (
        <AiChip text={game_day_copy.row_live} variant="hero" tone="fans" />
      )}
      <span className={styles.your_line}>
        {config.live_questions.includes("next_goal")
          ? game_day_copy.live_pick_open
          : game_day_copy.live_poll_open}
      </span>
    </>
  );
}

function button_text(game: GameSummary, has_saved_picks: boolean): string {
  if (game.state === "live") {
    return game_day_copy.button_live;
  }
  if (game.state === "final") {
    return game_day_copy.button_final;
  }
  return has_saved_picks ? game_day_copy.button_before_saved : game_day_copy.button_before;
}

/**
 * The user's team's game. Mobile: a card with a 2 px orange border. Desktop: Kaleva's hero, a
 * dark panel and a gray caption box with the stakes. The card (panel) is the link.
 */
export function FeaturedGameCard({ game }: { game: GameSummary }) {
  const { link_to } = useDemoMode();
  const [picks] = useGamePicks(game);
  const status = game_status(game, true);

  return (
    <div className={styles.featured}>
      <Link to={link_to(`/games/${game.id}`)} className={styles.card}>
        <div className={styles.top}>
          <span className={styles.kicker}>
            {game.featured ? game_day_copy.your_team : game_day_copy.top_game}
            {game.data_source === "demo" && <SampleBadge />}
          </span>
          <StatusPill tone={status.tone} dark_on_desktop>
            {status.label}
          </StatusPill>
        </div>
        <div className={styles.teams}>
          <div className={styles.team}>
            <TeamBadge team={game.home_team} size="featured" />
            <span className={styles.team_name}>{game.home_team.name}</span>
          </div>
          <span className={styles.center}>{center_text(game)}</span>
          <div className={styles.team}>
            <TeamBadge team={game.away_team} size="featured" />
            <span className={styles.team_name}>{game.away_team.name}</span>
          </div>
        </div>
        <div className={styles.bottom}>
          <div className={styles.lines}>
            {game.state === "upcoming" ? (
              <UpcomingLines game={game} />
            ) : (
              <DetailLines game={game} />
            )}
          </div>
          <span className={styles.button}>{button_text(game, picks.locked_at !== null)}</span>
        </div>
      </Link>
      <HeroCaption game={game} />
    </div>
  );
}
