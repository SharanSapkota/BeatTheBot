import type { AiPrediction, GameDetail, GameSummary } from "@voita_kone/shared_types";
import { Link } from "react-router";
import { AiChip } from "../../components/ai_chip";
import { StatusPill } from "../../components/status_pill";
import { TeamBadge } from "../../components/team_badge";
import { useDemoMode } from "../../lib/demo_mode";
import { format_percent } from "../../lib/format";
import { useGamePicks } from "../../lib/picks";
import { POINTS, possible_points, winner_team_id } from "../../lib/points";
import { useWinChance } from "../during_game/api";
import { to_ai_pick, useAiPrediction, useGameDetail } from "../game/api";
import { useGamePoints } from "../game/use_game_points";
import { center_text, game_status } from "./game_status";
import { game_day_copy } from "./copy";
import { HeroCaption } from "./hero_caption";
import styles from "./featured_game_card.module.css";

const MAX_PREMATCH_POINTS = POINTS.winner + POINTS.exact_score + POINTS.scorer + POINTS.beat_ai;

function ai_pick_text(game: GameSummary, prediction: AiPrediction | null | undefined): string {
  if (prediction === undefined) {
    return "…";
  }
  if (prediction === null) {
    return game_day_copy.ai_pick_pending;
  }
  const home_is_pick = prediction.predicted_winner_team_id === game.home_team.id;
  const winner = home_is_pick ? game.home_team : game.away_team;
  const share = home_is_pick ? prediction.home_win_probability : prediction.away_win_probability;
  return game_day_copy.ai_pick(winner.name, format_percent(share));
}

function UpcomingLines({ game }: { game: GameSummary }) {
  const prediction = useAiPrediction(game).data;
  const [picks] = useGamePicks(game.id);
  return (
    <>
      <AiChip text={ai_pick_text(game, prediction)} variant="hero" />
      <span className={styles.your_line}>
        {picks.locked_at
          ? game_day_copy.picks_saved(possible_points(picks, to_ai_pick(prediction)))
          : game_day_copy.picks_not_made(MAX_PREMATCH_POINTS)}
      </span>
    </>
  );
}

function LiveAiChip({ game }: { game: GameDetail }) {
  const prediction = useAiPrediction(game).data;
  const win_chance = useWinChance(game, prediction).data;
  const home_share = win_chance?.points.at(-1)?.home_win_probability;
  let text = "…";
  if (prediction === null) {
    text = game_day_copy.ai_no_pick;
  } else if (home_share !== undefined) {
    text = game_day_copy.ai_now(game.home_team.name, format_percent(home_share));
  }
  return <AiChip text={text} variant="hero" />;
}

function FinalLines({ game }: { game: GameDetail }) {
  const prediction = useAiPrediction(game).data;
  const points = useGamePoints(game);
  const picked_team =
    prediction?.predicted_winner_team_id === game.away_team.id ? game.away_team : game.home_team;
  const ai_right = picked_team.id === winner_team_id(game);
  let ai_line: string = prediction === null ? game_day_copy.ai_no_pick : "…";
  if (prediction) {
    ai_line = ai_right
      ? game_day_copy.ai_was_right(picked_team.name)
      : game_day_copy.ai_was_wrong(picked_team.name);
  }
  let your_line: string = game_day_copy.no_picks_made;
  if (points.total > 0 || points.winner !== null) {
    if (points.total > points.ai_total) {
      your_line = game_day_copy.you_beat_ai(points.total);
    } else if (points.total < points.ai_total) {
      your_line = game_day_copy.ai_beat_you(points.total);
    } else {
      your_line = game_day_copy.tied_with_ai(points.total);
    }
  }
  return (
    <>
      <AiChip text={ai_line} variant="hero" />
      <span className={styles.your_line}>{your_line}</span>
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
  return (
    <>
      <LiveAiChip game={detail} />
      <span className={styles.your_line}>{game_day_copy.live_pick_open}</span>
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
  const [picks] = useGamePicks(game.id);
  const status = game_status(game, true);

  return (
    <div className={styles.featured}>
      <Link to={link_to(`/games/${game.id}`)} className={styles.card}>
        <div className={styles.top}>
          <span className={styles.kicker}>{game_day_copy.your_team}</span>
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
