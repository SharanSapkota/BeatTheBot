import type { GameSummary, WinChance, WinChancePoint } from "@voita_kone/shared_types";
import { Card } from "../../components/card";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { format_clock_time, format_compact_score, format_percent } from "../../lib/format";
import { during_copy } from "./copy";
import styles from "./win_chance_chart.module.css";

// Chart geometry from the design (viewBox 340 x 110): 50% sits at y = 55,
// one percentage point is 1.08 px, the line ends at x = 230 with the current value.
const WIDTH = 340;
const HEIGHT = 110;
const MIDDLE_Y = 55;
const PIXELS_PER_SHARE = 108;
const END_X = 230;
const MIN_LABEL_SPACING = 34;
/** "Start" is about this wide at 11 px; the first goal label starts after it. */
const START_LABEL_WIDTH = 34;

export function share_to_y(share: number): number {
  return Math.max(8, Math.min(92, MIDDLE_Y - (share - 0.5) * PIXELS_PER_SHARE));
}

/** Step chart: flat between goals, a jump at each goal. */
export function step_points(shares: readonly number[]): string {
  const step_width = END_X / Math.max(1, shares.length);
  const points: string[] = [];
  shares.forEach((share, index) => {
    const y = share_to_y(share).toFixed(1);
    const x = (index * step_width).toFixed(1);
    if (index > 0) {
      points.push(`${x},${share_to_y(shares[index - 1] ?? share).toFixed(1)}`);
    }
    points.push(`${x},${y}`);
  });
  points.push(`${String(END_X)},${share_to_y(shares.at(-1) ?? 0.5).toFixed(1)}`);
  return points.join(" ");
}

/** Axis label: "Start", the score after a goal, "End". "Now" has no axis label (the dot does). */
export function point_label(point: WinChancePoint): string {
  if (point.kind === "start") {
    return during_copy.win_chance_start;
  }
  if (point.kind === "goal") {
    return format_compact_score(point.home_goals, point.away_goals);
  }
  return point.kind === "end" ? during_copy.win_chance_end : "";
}

function summary_label(point: WinChancePoint): string {
  return point.kind === "now" ? during_copy.win_chance_now : point_label(point);
}

interface WinChanceChartProps {
  game: GameSummary;
  win_chance: WinChance;
}

/** "Data says": the live home-win chance, updated after each goal (inline SVG). */
export function WinChanceChart({ game, win_chance }: WinChanceChartProps) {
  const shares = win_chance.points.map((point) => point.home_win_probability);
  const current = shares.at(-1) ?? 0.5;
  const step_width = END_X / Math.max(1, shares.length);
  const show_all_labels = step_width >= MIN_LABEL_SPACING;
  const summary = win_chance.points
    .map((point) => `${summary_label(point)} ${format_percent(point.home_win_probability)}`)
    .join(", ");

  return (
    <Card>
      <KalevaSectionTitle
        mobile_variant="card"
        title={during_copy.win_chance_title}
        right={<span className={styles.updates}>{during_copy.win_chance_updates}</span>}
      />
      <svg
        className={styles.chart}
        width="100%"
        preserveAspectRatio="xMinYMid meet"
        height={HEIGHT}
        viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
        role="img"
        aria-label={during_copy.win_chance_label(`${game.home_team.name}: ${summary}`)}
      >
        <line
          x1="0"
          y1={MIDDLE_Y}
          x2={WIDTH}
          y2={MIDDLE_Y}
          className={styles.mid_line}
          strokeDasharray="4 4"
        />
        <polyline
          points={step_points(shares)}
          fill="none"
          className={styles.line}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx={END_X} cy={share_to_y(current)} r="5" className={styles.dot} />
        {win_chance.points.map((point, index) => {
          const label = point_label(point);
          const is_recent = index >= win_chance.points.length - 2;
          if (label === "" || (!show_all_labels && index !== 0 && !is_recent)) {
            return null;
          }
          const x = index === 0 ? 0 : Math.max(START_LABEL_WIDTH, index * step_width - 14);
          return (
            <text
              key={`${point.kind}_${String(index)}`}
              x={x.toFixed(1)}
              y="100"
              fontSize="11"
              className={styles.axis_label}
            >
              {label}
            </text>
          );
        })}
        <text
          x={END_X + 6}
          y={share_to_y(current) - 4}
          fontSize="13"
          fontWeight="700"
          className={styles.value_label}
        >
          {`${game.home_team.name} ${format_percent(current)}`}
        </text>
        <text x="300" y="68" fontSize="10" className={styles.axis_label}>
          50%
        </text>
      </svg>
      <p className={styles.source}>
        {during_copy.win_chance_source(format_clock_time(win_chance.updated_at))}
      </p>
    </Card>
  );
}
