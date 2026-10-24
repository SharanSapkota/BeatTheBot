import type { GameDetail } from "@voita_kone/shared_types";
import { Card } from "../../components/card";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { class_names } from "../../lib/class_names";
import { format_compact_score, format_period } from "../../lib/format";
import { DRAW_PICK, type GamePicks } from "../../lib/picks";
import { before_copy } from "../before_game/copy";
import type { GamePoints } from "../../lib/points";
import { after_copy } from "./copy";
import styles from "./points_breakdown.module.css";

export interface BreakdownLine {
  id: string;
  label: string;
  phase: string;
  points: number;
}

/** One line per pick the user made, in the order of the game. */
export function build_breakdown_lines(
  game: GameDetail,
  picks: GamePicks,
  points: GamePoints,
  player_name: (player_id: string) => string,
): BreakdownLine[] {
  const lines: BreakdownLine[] = [];
  const add = (id: string, label: string, phase: string, value: number | null) => {
    if (value !== null) {
      lines.push({ id, label, phase, points: value });
    }
  };
  const team_name =
    picks.winner_team_id === game.home_team.id ? game.home_team.name : game.away_team.name;
  const winner_line =
    picks.winner_team_id === DRAW_PICK ? after_copy.line_draw : after_copy.line_winner(team_name);

  add("winner", winner_line, after_copy.before_game, points.winner);
  add(
    "exact_score",
    after_copy.line_score(format_compact_score(picks.home_goals, picks.away_goals)),
    after_copy.before_game,
    points.exact_score,
  );
  if (picks.margin_band !== null) {
    add(
      "margin_band",
      after_copy.line_margin(before_copy.margin_bands[picks.margin_band]),
      after_copy.before_game,
      points.margin_band,
    );
  }
  if (picks.scorer_id !== null) {
    add(
      "scorer",
      after_copy.line_scorer(player_name(picks.scorer_id)),
      after_copy.before_game,
      points.scorer,
    );
    add(
      "top_scorer",
      after_copy.line_top_scorer(player_name(picks.scorer_id)),
      after_copy.before_game,
      points.top_scorer,
    );
  }
  add("bold_call", after_copy.line_bold_call, after_copy.before_game, points.bold_call);
  if (points.next_goal.decided > 0) {
    add(
      "next_goal",
      after_copy.line_next_goal(points.next_goal.correct),
      after_copy.during_game,
      points.next_goal.points,
    );
  }
  if (picks.period_goal) {
    add(
      "period_goal",
      after_copy.line_period_goal(
        format_period(picks.period_goal.period),
        picks.period_goal.answer,
      ),
      after_copy.during_game,
      points.period_goal,
    );
  }
  if (points.quiz.answered > 0) {
    add(
      "quiz",
      after_copy.line_quiz(points.quiz.correct),
      after_copy.after_game,
      points.quiz.points,
    );
  }
  add("vote", after_copy.line_vote, after_copy.after_game, points.vote);
  return lines;
}

interface PointsBreakdownProps {
  lines: readonly BreakdownLine[];
  total: number;
}

export function PointsBreakdown({ lines, total }: PointsBreakdownProps) {
  return (
    <Card gap={0} labelled_by="your_points_title">
      <div className={styles.title}>
        <KalevaSectionTitle
          id="your_points_title"
          title={after_copy.your_points}
          mobile_variant="card"
        />
      </div>
      {lines.length === 0 && <p className={styles.empty}>{after_copy.no_picks}</p>}
      {lines.map((line) => (
        <div key={line.id} className={styles.line}>
          <span className={styles.texts}>
            <span className={styles.label}>{line.label}</span>
            <span className={styles.phase}>{line.phase}</span>
          </span>
          <span className={class_names(styles.value, line.points > 0 && styles.value_won)}>
            {line.points > 0 ? `+${String(line.points)}` : "0"}
          </span>
        </div>
      ))}
      <div className={styles.total}>
        <span className={styles.total_label}>{after_copy.total}</span>
        <span className={styles.total_value}>+{total}</span>
      </div>
    </Card>
  );
}
