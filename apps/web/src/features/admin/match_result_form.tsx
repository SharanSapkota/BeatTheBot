import type { AdminMatch, AdminMatchResultRequest, PlayerSummary } from "@voita_kone/shared_types";
import { useState, type FormEvent } from "react";
import { useTeamPlayers } from "../game/api";
import { admin_copy } from "./copy";
import styles from "./admin_form.module.css";

const MAX_MINUTE = 130;

interface GoalRow {
  team_id: string;
  player_id: string;
  minute: string;
}

function player_name(player: PlayerSummary): string {
  return `${player.first_name} ${player.last_name}`;
}

/** Football: one goal (team, scorer or unknown, minute). */
function GoalFields({
  match,
  goal,
  index,
  on_change,
  on_remove,
}: {
  match: AdminMatch;
  goal: GoalRow;
  index: number;
  on_change: (goal: GoalRow) => void;
  on_remove: () => void;
}) {
  const players = useTeamPlayers(goal.team_id).data ?? [];
  const label = admin_copy.goal_label(index);
  return (
    <fieldset className={styles.grid}>
      <legend>{label}</legend>
      <label className={styles.field}>
        {admin_copy.field_goal_team}
        <select
          value={goal.team_id}
          onChange={(event) => on_change({ ...goal, team_id: event.target.value, player_id: "" })}
        >
          {[match.home_team, match.away_team].map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        {admin_copy.field_scorer}
        <select
          value={goal.player_id}
          onChange={(event) => on_change({ ...goal, player_id: event.target.value })}
        >
          <option value="">{admin_copy.unknown_scorer}</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player_name(player)}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        {admin_copy.field_minute}
        <input
          type="number"
          min={1}
          max={MAX_MINUTE}
          required
          value={goal.minute}
          onChange={(event) => on_change({ ...goal, minute: event.target.value })}
        />
      </label>
      <div className={styles.buttons}>
        <button type="button" className={styles.danger} onClick={on_remove}>
          {admin_copy.remove_goal}
        </button>
      </div>
    </fieldset>
  );
}

/** Basketball: the top scorer from both rosters. */
function TopScorerSelect({
  match,
  value,
  on_change,
}: {
  match: AdminMatch;
  value: string;
  on_change: (player_id: string) => void;
}) {
  const home = useTeamPlayers(match.home_team.id).data ?? [];
  const away = useTeamPlayers(match.away_team.id).data ?? [];
  return (
    <label className={styles.field}>
      {admin_copy.field_top_scorer}
      <select value={value} onChange={(event) => on_change(event.target.value)}>
        <option value="">{admin_copy.no_top_scorer}</option>
        {[
          { team: match.home_team, players: home },
          { team: match.away_team, players: away },
        ].map(({ team, players }) => (
          <optgroup key={team.id} label={team.name}>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player_name(player)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/** The final score; football adds the goals, basketball the top scorer. The API checks it. */
export function MatchResultForm({
  match,
  is_saving,
  on_save,
}: {
  match: AdminMatch;
  is_saving: boolean;
  on_save: (body: AdminMatchResultRequest) => Promise<void>;
}) {
  const is_football = match.sport === "football";
  const [home_goals, set_home_goals] = useState(String(match.home_goals ?? 0));
  const [away_goals, set_away_goals] = useState(String(match.away_goals ?? 0));
  const [ended_in, set_ended_in] = useState<"regulation" | "overtime">(
    match.ended_in === "overtime" ? "overtime" : "regulation",
  );
  const [goals, set_goals] = useState<GoalRow[]>(() =>
    match.goals.map((goal) => ({
      team_id: goal.team_id,
      player_id: goal.player?.id ?? "",
      minute: String(goal.minute),
    })),
  );
  const [top_scorer, set_top_scorer] = useState(match.top_scorer?.id ?? "");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const scores = { home_goals: Number(home_goals), away_goals: Number(away_goals) };
    void on_save(
      is_football
        ? {
            ...scores,
            goals: goals.map((goal) => ({
              team_id: goal.team_id,
              player_id: goal.player_id === "" ? null : goal.player_id,
              minute: Number(goal.minute),
            })),
          }
        : { ...scores, ended_in, top_scorer_player_id: top_scorer === "" ? null : top_scorer },
    );
  };

  const score_input = (label: string, value: string, set: (value: string) => void) => (
    <label className={styles.field}>
      {label}
      <input
        type="number"
        min={0}
        max={300}
        required
        value={value}
        onChange={(event) => set(event.target.value)}
      />
    </label>
  );

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.grid}>
        {score_input(admin_copy.field_home_score(match.home_team.name), home_goals, set_home_goals)}
        {score_input(admin_copy.field_away_score(match.away_team.name), away_goals, set_away_goals)}
        {!is_football && (
          <label className={styles.field}>
            {admin_copy.field_ended_in}
            <select
              value={ended_in}
              onChange={(event) =>
                set_ended_in(event.target.value === "overtime" ? "overtime" : "regulation")
              }
            >
              {(["regulation", "overtime"] as const).map((id) => (
                <option key={id} value={id}>
                  {admin_copy.ended_in[id]}
                </option>
              ))}
            </select>
          </label>
        )}
        {!is_football && (
          <TopScorerSelect match={match} value={top_scorer} on_change={set_top_scorer} />
        )}
      </div>
      {is_football && (
        <>
          <p className={styles.hint}>
            <strong>{admin_copy.goals_title}</strong> {admin_copy.goals_hint}
          </p>
          {goals.map((goal, index) => (
            <GoalFields
              // Goals have no id; the row index is their identity while editing.
              key={index}
              match={match}
              goal={goal}
              index={index + 1}
              on_change={(changed) =>
                set_goals((current) => current.map((row, at) => (at === index ? changed : row)))
              }
              on_remove={() => set_goals((current) => current.filter((_, at) => at !== index))}
            />
          ))}
          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() =>
                set_goals((current) => [
                  ...current,
                  { team_id: match.home_team.id, player_id: "", minute: "" },
                ])
              }
            >
              {admin_copy.add_goal}
            </button>
          </div>
        </>
      )}
      <div className={styles.buttons}>
        <button type="submit" className={styles.button} disabled={is_saving}>
          {admin_copy.save_match_result}
        </button>
      </div>
    </form>
  );
}
