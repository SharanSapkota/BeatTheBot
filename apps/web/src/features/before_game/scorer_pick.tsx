import type { PlayerSummary } from "@voita_kone/shared_types";
import { Card } from "../../components/card";
import { PointsBadge } from "../../components/points_badge";
import { SectionTitle } from "../../components/section_title";
import { class_names } from "../../lib/class_names";
import { with_prematch_change } from "../../lib/picks";
import { useTeamPlayers } from "../game/api";
import { before_copy } from "./copy";
import type { PickProps } from "./winner_pick";
import styles from "./scorer_pick.module.css";

/** Hockey and football: each team's 2 most in-form scorers. Basketball: the whole (short) roster. */
const PLAYERS_PER_TEAM = 2;
const BASKETBALL_PLAYERS_PER_TEAM = 8;

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

/** "In form": the player(s) with the most goals in the team's last 5 games (at least 1). */
export function in_form_ids(players: readonly PlayerSummary[]): Set<string> {
  const best = Math.max(0, ...players.map((player) => player.goals_last_5));
  return new Set(
    best > 0
      ? players.filter((player) => player.goals_last_5 === best).map((player) => player.id)
      : [],
  );
}

function player_meta({ player, team_name }: ScorerOption, is_top_scorer: boolean): string {
  if (is_top_scorer) {
    return team_name;
  }
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
  count: number,
): ScorerOption[] {
  return top_scorers(players, count).map((player) => ({ player, team_name }));
}

/**
 * Hockey and football: a player who scores ("In form" = most goals in the team's last 5 games).
 * Basketball (`kind` top_scorer): the player with the most points.
 */
export function ScorerPick({
  game,
  picks,
  update,
  disabled,
  number,
  points,
  kind = "scorer",
}: PickProps & { kind?: "scorer" | "top_scorer" }) {
  const is_top_scorer = kind === "top_scorer";
  const count = is_top_scorer ? BASKETBALL_PLAYERS_PER_TEAM : PLAYERS_PER_TEAM;
  const home_players = useTeamPlayers(game.home_team.id);
  const away_players = useTeamPlayers(game.away_team.id);
  const options: ScorerOption[] = [
    ...team_options(home_players.data ?? [], game.home_team.name, count),
    ...team_options(away_players.data ?? [], game.away_team.name, count),
  ];
  const is_loading = home_players.isPending || away_players.isPending;
  const in_form = is_top_scorer
    ? new Set<string>()
    : new Set([...in_form_ids(home_players.data ?? []), ...in_form_ids(away_players.data ?? [])]);

  return (
    <Card gap={10}>
      <SectionTitle
        title={before_copy.numbered(number, before_copy.pick_titles[kind])}
        size={16}
        right={<PointsBadge text={`+${String(points)}`} />}
      />
      <p className={styles.hint}>{before_copy.scorer_hint[game.sport]}</p>
      {is_loading && <div className={styles.placeholder} aria-hidden="true" />}
      {!is_loading && options.length === 0 && (
        <p className={styles.hint}>{before_copy.scorer_unavailable}</p>
      )}
      <div
        role="group"
        aria-label={is_top_scorer ? before_copy.top_scorer_group : before_copy.scorer_group}
        className={styles.list}
      >
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
                <span className={styles.meta}>{player_meta(option, is_top_scorer)}</span>
              </span>
              {in_form.has(option.player.id) && (
                <span className={styles.form_tag}>{before_copy.in_form_tag}</span>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
