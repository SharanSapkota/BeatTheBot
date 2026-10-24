// Team marks for dots and timeline circles. Kärpät and Ilves use their design colors;
// other teams get navy (home) or slate (away) so the two sides stay apart.

export interface TeamMark {
  fill: string;
  stroke: string | null;
}

export function team_mark(team_name: string, side: "home" | "away"): TeamMark {
  if (team_name === "Kärpät") {
    return { fill: "#111111", stroke: "#FFD200" };
  }
  if (team_name === "Ilves") {
    return { fill: "#0F6B3A", stroke: null };
  }
  return side === "home" ? { fill: "#0E1B2C", stroke: null } : { fill: "#9AA7B5", stroke: null };
}
