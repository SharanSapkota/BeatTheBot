import type { GameDetail } from "@voita_kone/shared_types";
import { SPORTS } from "@voita_kone/scoring";
import { Card } from "../../components/card";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { format_compact_score, format_game_time, format_period } from "../../lib/format";
import { team_mark } from "../../lib/team_colors";
import { after_copy } from "./copy";
import styles from "./goal_timeline.module.css";

// Geometry from the design (viewBox 340 x 96): the game runs from x = 10 to x = 330.
const LEFT_X = 10;
const RIGHT_X = 330;
const LINE_Y = 48;
const OVERTIME_SECONDS = 5 * 60;

export function time_to_x(game_time_seconds: number, game_length_seconds: number): number {
  return (
    LEFT_X +
    (Math.min(game_time_seconds, game_length_seconds) / game_length_seconds) * (RIGHT_X - LEFT_X)
  );
}

const LABEL_Y = 24;
const RAISED_LABEL_Y = 11;
/** A score label is about 24 px wide; closer labels go on the raised row. */
const MIN_LABEL_GAP = 28;

/** The y of each score label, so labels of goals close together don't overlap. */
export function score_label_rows(goal_xs: readonly number[]): number[] {
  const last_x_by_row = new Map<number, number>();
  return goal_xs.map((x) => {
    const row =
      x - (last_x_by_row.get(LABEL_Y) ?? -Infinity) >= MIN_LABEL_GAP ? LABEL_Y : RAISED_LABEL_Y;
    last_x_by_row.set(row, x);
    return row;
  });
}

/** Goals on a line through the game, each with the score after it (animated in order). */
export function GoalTimeline({ game }: { game: GameDetail }) {
  const { regulation_periods, period_seconds } = SPORTS[game.sport];
  const regulation_seconds = regulation_periods * period_seconds;
  const goals = game.events.filter((event) => event.event_type === "goal" && event.period < 5);
  const length = goals.some((goal) => goal.game_time_seconds > regulation_seconds)
    ? regulation_seconds + OVERTIME_SECONDS
    : regulation_seconds;
  // A tick between periods (hockey 20:00 and 40:00, football half time).
  const period_ticks = Array.from(
    { length: regulation_periods - 1 },
    (_, index) => (index + 1) * period_seconds,
  ).map((seconds) => time_to_x(seconds, length));
  const label_rows = score_label_rows(
    goals.map((goal) => time_to_x(goal.game_time_seconds, length)),
  );
  const description = goals
    .map((goal) => {
      const team = goal.team_id === game.home_team.id ? game.home_team.name : game.away_team.name;
      return `${team} ${format_game_time(goal.game_time_seconds)}`;
    })
    .join(", ");

  return (
    <Card>
      <KalevaSectionTitle
        mobile_variant="card"
        title={after_copy.timeline_title}
        right={<span className={styles.note}>{after_copy.timeline_note}</span>}
      />
      <svg
        className={styles.chart}
        width="100%"
        preserveAspectRatio="xMinYMid meet"
        height="96"
        viewBox="0 0 340 96"
        role="img"
        aria-label={after_copy.timeline_label(description)}
      >
        <line
          x1={LEFT_X}
          y1={LINE_Y}
          x2={RIGHT_X}
          y2={LINE_Y}
          className={styles.track}
          strokeWidth="4"
          strokeLinecap="round"
        />
        {period_ticks.map((x) => (
          <line key={x} x1={x} y1="38" x2={x} y2="58" className={styles.tick} strokeWidth="2" />
        ))}
        {goals.map((goal, index) => {
          const is_home = goal.team_id === game.home_team.id;
          const team = is_home ? game.home_team : game.away_team;
          const mark = team_mark(team.name, is_home ? "home" : "away");
          const x = time_to_x(goal.game_time_seconds, length);
          const score = goal.score_after;
          return (
            <g
              key={goal.id}
              className={styles.goal}
              style={{ animationDelay: `${String(index * 0.35)}s` }}
            >
              <circle
                cx={x}
                cy={LINE_Y}
                r="9"
                style={{ fill: mark.fill, stroke: mark.stroke ?? "none" }}
                strokeWidth="2"
              />
              {score && (
                <text
                  x={x - 12}
                  y={label_rows[index] ?? LABEL_Y}
                  fontSize="11"
                  className={styles.score_label}
                >
                  {format_compact_score(score.home, score.away)}
                </text>
              )}
            </g>
          );
        })}
        {Array.from({ length: regulation_periods }, (_, index) => (
          <text
            key={index}
            x={10 + (index * 290) / Math.max(1, regulation_periods - 1)}
            y="86"
            fontSize="11"
            className={styles.axis_label}
          >
            {format_period(index + 1, game.sport)}
          </text>
        ))}
      </svg>
      <p className={styles.caption}>{after_copy.timeline_caption}</p>
    </Card>
  );
}
