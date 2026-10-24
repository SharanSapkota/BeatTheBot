// Team marks for dots and timeline circles, as CSS colors from tokens.css. Kärpät and Ilves use
// their design colors; other teams get dark (home) or gray (away) so the two sides stay apart.

export interface TeamMark {
  fill: string;
  stroke: string | null;
}

export function team_mark(team_name: string, side: "home" | "away"): TeamMark {
  if (team_name === "Kärpät") {
    return { fill: "var(--team_karpat_bg)", stroke: "var(--team_karpat_fg)" };
  }
  if (team_name === "Ilves") {
    return { fill: "var(--team_ilves_bg)", stroke: null };
  }
  return side === "home"
    ? { fill: "var(--team_other_home)", stroke: null }
    : { fill: "var(--team_other_away)", stroke: null };
}
