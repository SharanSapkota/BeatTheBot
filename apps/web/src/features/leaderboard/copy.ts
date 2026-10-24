import type { LeaderboardPeriod } from "@voita_kone/shared_types";

// Leaderboard text from docs/design/source/Leaderboard.dc.html.
export const leaderboard_copy = {
  title: "Leaderboard",
  period_group: "Period",
  periods: [
    { id: "week", label: "This week" },
    { id: "season", label: "Season" },
  ] satisfies { id: LeaderboardPeriod; label: string }[],
  humans_title: "Humans vs the machine",
  you: "You",
  ai: "Kaleva AI",
  fans: "All fans",
  fans_beat_ai: (weeks: number, of_weeks: number) =>
    `${String(weeks)} of the last ${String(of_weeks)} weeks`,
  summary_before: "Fans beat the AI in ",
  summary_after: (games: number, period: LeaderboardPeriod) =>
    `. Correct winner picks, ${String(games)} games ${period === "week" ? "this week" : "this season"}.`,
  prize_kicker: (period: LeaderboardPeriod) =>
    period === "week" ? "THIS WEEK'S PRIZE" : "SEASON PRIZE",
  sponsor_logo_line_1: "sponsor",
  sponsor_logo_line_2: "logo",
  ranking_label: "Ranking",
  you_initials: "YOU",
  movement: (places: number, period: LeaderboardPeriod) =>
    `up ${String(places)} places ${period === "week" ? "this week" : "this season"}`,
  points_label: (points: string) => `${points} points`,
  rank_label: (rank: number) => `Rank ${String(rank)}`,
  footer: "Concept demo · sample data",
} as const;
