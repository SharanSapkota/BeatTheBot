import type { GameDetail, GameEvent } from "@voita_kone/shared_types";
import { Card } from "../../components/card";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { format_event_time, format_period_name } from "../../lib/format";
import type { GamePicks } from "../../lib/picks";
import { POINTS } from "../../lib/points";
import { team_mark } from "../../lib/team_colors";
import { during_copy } from "./copy";
import styles from "./event_list.module.css";

const PUCK_DROP_COLOR = "var(--color_fans_track)";

interface EventRow {
  id: string;
  time: string;
  dot: string;
  strong: string;
  text: string;
  /** "You +5" or "missed" for goals the user had a next-goal pick on. */
  result: { text: string; is_win: boolean } | null;
}

function player_name(event: GameEvent): string {
  return event.player ? `${event.player.first_name} ${event.player.last_name}` : "";
}

function next_goal_result(
  game: GameDetail,
  goal: GameEvent,
  goal_index: number,
  picks: GamePicks,
): EventRow["result"] {
  const pick = picks.next_goal_picks.find((candidate) => candidate.goal_index === goal_index);
  if (!pick) {
    return null;
  }
  const side = goal.team_id === game.home_team.id ? "home" : "away";
  return pick.choice === side
    ? { text: during_copy.you_points(POINTS.next_goal), is_win: true }
    : { text: during_copy.missed, is_win: false };
}

const START_TEXT = {
  hockey: during_copy.puck_drop,
  football: during_copy.kick_off,
  basketball: during_copy.tip_off,
} as const;

/** Events newest first, ending with puck drop (kick-off, tip-off). */
export function build_event_rows(game: GameDetail, picks: GamePicks): EventRow[] {
  let goal_index = 0;
  const rows: EventRow[] = game.events.map((event) => {
    const is_home = event.team_id === game.home_team.id;
    const team = is_home ? game.home_team : game.away_team;
    const dot = team_mark(team.name, is_home ? "home" : "away").fill;
    const time = format_event_time(event.period, event.game_time_seconds, game.sport);
    if (event.event_type === "goal") {
      const result = event.period < 5 ? next_goal_result(game, event, goal_index, picks) : null;
      goal_index += event.period < 5 ? 1 : 0;
      return {
        id: event.id,
        time,
        dot,
        strong: during_copy.goal(team.name),
        text: player_name(event),
        result,
      };
    }
    if (event.event_type === "penalty") {
      const minutes = event.penalty_minutes
        ? ` · ${during_copy.penalty_minutes(event.penalty_minutes)}`
        : "";
      return {
        id: event.id,
        time,
        dot,
        strong: during_copy.penalty(team.name),
        text: `${player_name(event)}${minutes}`,
        result: null,
      };
    }
    return {
      id: event.id,
      time,
      dot: PUCK_DROP_COLOR,
      strong: "",
      text: during_copy.period_end(format_period_name(event.period, game.sport)),
      result: null,
    };
  });
  const puck_drop: EventRow = {
    id: "puck_drop",
    time: format_event_time(1, 0, game.sport),
    dot: PUCK_DROP_COLOR,
    strong: "",
    text: START_TEXT[game.sport],
    result: null,
  };
  // Puck drop is the oldest event, so it ends the newest-first list.
  return [puck_drop, ...rows].reverse();
}

export function EventList({ game, picks }: { game: GameDetail; picks: GamePicks }) {
  return (
    <Card gap={4} labelled_by="events_title">
      <div className={styles.title}>
        <KalevaSectionTitle
          id="events_title"
          title={during_copy.events_title}
          mobile_variant="card"
        />
      </div>
      <ol className={styles.list}>
        {build_event_rows(game, picks).map((row) => (
          <li key={row.id} className={styles.row}>
            <span className={styles.time}>{row.time}</span>
            <span className={styles.dot} style={{ background: row.dot }} aria-hidden="true" />
            <span className={styles.text}>
              {row.strong && <b>{row.strong}</b>}
              {row.strong && row.text && " · "}
              {row.text}
            </span>
            {row.result && (
              <span className={row.result.is_win ? styles.win : styles.missed}>
                {row.result.text}
              </span>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
