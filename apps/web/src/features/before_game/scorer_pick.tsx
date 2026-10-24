import type { PlayerSummary } from "@voita_kone/shared_types";
import { Card } from "../../components/card";
import { PointsBadge } from "../../components/points_badge";
import { SectionTitle } from "../../components/section_title";
import { class_names } from "../../lib/class_names";
import { with_prematch_change } from "../../lib/picks";
import { POINTS } from "../../lib/points";
import { useTeamPlayers } from "../game/api";
import { before_copy } from "./copy";
import type { PickProps } from "./winner_pick";
import styles from "./scorer_pick.module.css";

const PLAYERS_PER_TEAM = 2;

interface ScorerOption {
  player: PlayerSummary;
  team_name: string;
}

/** Each team's most in-form scorers: goals in the last 5 games, then season goals. */
export function top_scorers(players: readonly PlayerSummary[], count: number): PlayerSummary[] {
  return players
    .filter((player) => player.position !== "goalie")
    .sort(
      (first, second) =>
        second.goals_last_5 - first.goals_last_5 ||
        second.season_goals - first.season_goals ||
        first.last_name.localeCompare(second.last_name, "fi"),
    )
    .slice(0, count);
}

/** Keeps the AI's scorer in the list: it takes the last place of its team if needed. */
export function with_ai_scorer(
  top: readonly PlayerSummary[],
  players: readonly PlayerSummary[],
  ai_scorer_id: string | null,
): PlayerSummary[] {
  const ai_scorer = players.find((player) => player.id === ai_scorer_id);
  if (!ai_scorer || top.some((player) => player.id === ai_scorer.id)) {
    return [...top];
  }
  return [...top.slice(0, -1), ai_scorer];
}

function player_meta({ player, team_name }: ScorerOption): string {
  return player.goals_last_5 > 0
    ? before_copy.goals_last_5(team_name, player.goals_last_5)
    : before_copy.goals_season(team_name, player.season_goals);
}

function player_label(player: PlayerSummary): string {
  const jersey = player.jersey_number === null ? "" : ` #${String(player.jersey_number)}`;
  return `${player.first_name} ${player.last_name}${jersey}`;
}

function team_options(
  players: readonly PlayerSummary[],
  team_name: string,
  ai_scorer_id: string | null,
): ScorerOption[] {
  return with_ai_scorer(top_scorers(players, PLAYERS_PER_TEAM), players, ai_scorer_id).map(
    (player) => ({ player, team_name }),
  );
}

interface ScorerPickProps extends PickProps {
  ai_scorer_id: string | null;
}

export function ScorerPick({ game, picks, update, disabled, ai_scorer_id }: ScorerPickProps) {
  const home_players = useTeamPlayers(game.home_team.id);
  const away_players = useTeamPlayers(game.away_team.id);
  const options: ScorerOption[] = [
    ...team_options(home_players.data ?? [], game.home_team.name, ai_scorer_id),
    ...team_options(away_players.data ?? [], game.away_team.name, ai_scorer_id),
  ];
  const is_loading = home_players.isPending || away_players.isPending;

  return (
    <Card gap={10}>
      <SectionTitle
        title={before_copy.scorer_title}
        size={16}
        right={<PointsBadge text={`+${String(POINTS.scorer)}`} />}
      />
      <p className={styles.hint}>{before_copy.scorer_hint}</p>
      {is_loading && <div className={styles.placeholder} aria-hidden="true" />}
      {!is_loading && options.length === 0 && (
        <p className={styles.hint}>{before_copy.scorer_unavailable}</p>
      )}
      <div role="group" aria-label={before_copy.scorer_group} className={styles.list}>
        {options.map((option) => {
          const is_selected = option.player.id === picks.scorer_id;
          return (
            <button
              key={option.player.id}
              type="button"
              aria-pressed={is_selected}
              disabled={disabled}
              className={class_names(styles.row, is_selected && styles.selected)}
              onClick={() =>
                update((current) => with_prematch_change(current, { scorer_id: option.player.id }))
              }
            >
              <span className={styles.texts}>
                <span className={styles.name}>{player_label(option.player)}</span>
                <span className={styles.meta}>{player_meta(option)}</span>
              </span>
              {option.player.id === ai_scorer_id && (
                <span className={styles.ai_tag}>{before_copy.ai_pick_tag}</span>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
