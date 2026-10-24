import type { TeamSummary } from "@voita_kone/shared_types";
import { class_names } from "../lib/class_names";
import { team_code } from "../lib/team_code";
import styles from "./team_badge.module.css";

export type TeamBadgeSize = "row" | "header" | "score" | "featured";

/** Team colors from the design; other teams get the neutral badge with their short code. */
function team_tone(team_name: string): string | undefined {
  if (team_name === "Kärpät") {
    return styles.karpat;
  }
  if (team_name === "Ilves") {
    return styles.ilves;
  }
  return styles.neutral;
}

interface TeamBadgeProps {
  team: Pick<TeamSummary, "name" | "short_name">;
  /** row 28 px, header 44 px, score 48 px, featured 52 px. */
  size: TeamBadgeSize;
}

export function TeamBadge({ team, size }: TeamBadgeProps) {
  return (
    <span
      className={class_names(styles.badge, styles[size], team_tone(team.name))}
      aria-hidden="true"
    >
      {team_code(team)}
    </span>
  );
}
