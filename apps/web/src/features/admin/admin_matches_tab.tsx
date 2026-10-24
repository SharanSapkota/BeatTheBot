import type { AdminLeague, AdminMatch, AdminMatchInput } from "@voita_kone/shared_types";
import { useState, type FormEvent } from "react";
import { Card } from "../../components/card";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { ApiError } from "../../lib/api_client";
import { format_clock_time, format_day_label } from "../../lib/format";
import { useNow } from "../../lib/use_now";
import {
  useAdminLeagues,
  useAdminMatchAction,
  useAdminMatches,
  type AdminMatchAction,
} from "./api";
import { admin_copy } from "./copy";
import { from_local_input, to_local_input } from "./local_time";
import { MatchResultForm } from "./match_result_form";
import form_styles from "./admin_form.module.css";
import styles from "./admin_page.module.css";

const HOUR_MS = 60 * 60 * 1000;

type Run = (change: AdminMatchAction, ok_text: string) => Promise<boolean>;

interface MatchFormValues {
  league_id: string;
  home_team_id: string;
  away_team_id: string;
  start_time: string;
}

function empty_values(leagues: readonly AdminLeague[]): MatchFormValues {
  return {
    league_id: leagues[0]?.id ?? "",
    home_team_id: "",
    away_team_id: "",
    start_time: to_local_input(new Date(Date.now() + 2 * HOUR_MS).toISOString()),
  };
}

/** "Add a match": league, home, away and start time. The API checks the teams again. */
function MatchForm({
  leagues,
  is_saving,
  on_save,
}: {
  leagues: readonly AdminLeague[];
  is_saving: boolean;
  on_save: (body: AdminMatchInput) => Promise<boolean>;
}) {
  const [values, set_values] = useState(() => empty_values(leagues));
  const league = leagues.find((candidate) => candidate.id === values.league_id);
  const teams = league?.teams ?? [];
  const set = (change: Partial<MatchFormValues>) =>
    set_values((current) => ({ ...current, ...change }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const saved = await on_save({ ...values, start_time: from_local_input(values.start_time) });
    if (saved) {
      set({ home_team_id: "", away_team_id: "" });
    }
  };

  const team_select = (key: "home_team_id" | "away_team_id", label: string) => (
    <label className={form_styles.field}>
      {label}
      <select value={values[key]} required onChange={(event) => set({ [key]: event.target.value })}>
        <option value="">{admin_copy.pick_team}</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <form className={form_styles.form} onSubmit={(event) => void submit(event)}>
      <div className={form_styles.grid}>
        <label className={form_styles.field}>
          {admin_copy.field_league}
          <select
            value={values.league_id}
            required
            onChange={(event) =>
              set({ league_id: event.target.value, home_team_id: "", away_team_id: "" })
            }
          >
            {leagues.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label className={form_styles.field}>
          {admin_copy.field_start}
          <input
            type="datetime-local"
            value={values.start_time}
            required
            onChange={(event) => set({ start_time: event.target.value })}
          />
        </label>
        {team_select("home_team_id", admin_copy.field_home)}
        {team_select("away_team_id", admin_copy.field_away)}
      </div>
      <div className={form_styles.buttons}>
        <button type="submit" className={form_styles.button} disabled={is_saving}>
          {admin_copy.create_match}
        </button>
      </div>
    </form>
  );
}

function MatchItem({ match, is_saving, run }: { match: AdminMatch; is_saving: boolean; run: Run }) {
  const [is_open, set_is_open] = useState(false);
  const now = useNow();
  const has_started = now.getTime() >= new Date(match.start_time).getTime();
  const can_delete = match.state === "upcoming" && match.pick_count === 0;
  const time = `${format_day_label(match.start_time)} ${format_clock_time(match.start_time)}`;
  const result_button =
    match.state === "final" ? admin_copy.correct_result : admin_copy.enter_result;

  return (
    <li className={styles.match}>
      <div className={styles.match_head}>
        <span className={styles.item_title}>
          {admin_copy.match_title(match.home_team.name, match.away_team.name)}
          {match.state === "final" &&
            ` ${String(match.home_goals ?? 0)}–${String(match.away_goals ?? 0)}`}
        </span>
        <span className={styles.item_meta}>
          {admin_copy.match_meta(
            match.league.name,
            time,
            admin_copy.match_states[match.state],
            match.pick_count,
          )}
          {match.data_source === "demo" && ` · ${admin_copy.sample_data}`}
        </span>
      </div>
      <div className={form_styles.buttons}>
        {has_started && (
          <button
            type="button"
            className={form_styles.secondary}
            aria-expanded={is_open}
            onClick={() => set_is_open((current) => !current)}
          >
            {is_open ? admin_copy.hide_result : result_button}
          </button>
        )}
        {can_delete && (
          <button
            type="button"
            className={form_styles.danger}
            disabled={is_saving}
            onClick={() =>
              void run({ kind: "delete", match_id: match.id }, admin_copy.match_deleted)
            }
          >
            {admin_copy.delete_match}
          </button>
        )}
      </div>
      {is_open && (
        <MatchResultForm
          match={match}
          is_saving={is_saving}
          on_save={async (body) => {
            const saved = await run(
              { kind: "result", match_id: match.id, body },
              admin_copy.match_result_saved,
            );
            if (saved) {
              set_is_open(false);
            }
          }}
        />
      )}
    </li>
  );
}

/** Admin tab "Matches": add football and basketball matches, then enter their results. */
export function AdminMatchesTab() {
  const leagues = useAdminLeagues(true);
  const matches = useAdminMatches(true);
  const action = useAdminMatchAction();
  const [message, set_message] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const run: Run = async (change, ok_text) => {
    set_message(null);
    try {
      await action.mutateAsync(change);
      set_message({ kind: "ok", text: ok_text });
      return true;
    } catch (error) {
      set_message({
        kind: "error",
        text: error instanceof ApiError ? error.message : admin_copy.error_generic,
      });
      return false;
    }
  };

  return (
    <div className={styles.detail}>
      {message && (
        <p
          className={message.kind === "ok" ? styles.status : form_styles.error}
          role={message.kind === "ok" ? "status" : "alert"}
        >
          {message.text}
        </p>
      )}
      <Card>
        <KalevaSectionTitle title={admin_copy.matches_title} meta={admin_copy.matches_hint} />
        {leagues.data && (
          <MatchForm
            leagues={leagues.data}
            is_saving={action.isPending}
            on_save={(body) => run({ kind: "create", body }, admin_copy.match_created)}
          />
        )}
      </Card>
      <Card>
        <KalevaSectionTitle title={admin_copy.matches_list} />
        {matches.data?.length === 0 && <p>{admin_copy.no_matches}</p>}
        <ul className={styles.matches} aria-label={admin_copy.matches_list}>
          {matches.data?.map((match) => (
            <MatchItem key={match.id} match={match} is_saving={action.isPending} run={run} />
          ))}
        </ul>
      </Card>
    </div>
  );
}
