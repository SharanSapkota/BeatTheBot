import type { LeaderboardPeriod, SportFilter } from "@voita_kone/shared_types";

/** Games (every sport), one sport, or the separate election board. */
export type LeadersBoard = "games" | "hockey" | "football" | "basketball" | "elections";

/** The leaderboard filter of a games board. */
export const BOARD_SPORT: Record<Exclude<LeadersBoard, "elections">, SportFilter> = {
  games: "all",
  hockey: "hockey",
  football: "football",
  basketball: "basketball",
};

// Leaderboard text from docs/design/source/Leaderboard.dc.html.
export const leaderboard_copy = {
  title: "Leaderboard",
  board_group: "Leaderboard",
  boards: [
    { id: "games", label: "Games" },
    { id: "hockey", label: "Hockey" },
    { id: "football", label: "Football" },
    { id: "basketball", label: "Basketball" },
    { id: "elections", label: "Elections" },
  ] satisfies { id: LeadersBoard; label: string }[],
  period_group: "Period",
  periods: [
    { id: "week", label: "This week" },
    { id: "season", label: "Season" },
  ] satisfies { id: LeaderboardPeriod; label: string }[],
  you_vs_fans_title: "You vs all fans",
  you: "You",
  fans: "All fans",
  summary: (games: number, period: LeaderboardPeriod) =>
    `Correct winner picks, ${String(games)} finished ${games === 1 ? "game" : "games"} ${period === "week" ? "this week" : "this season"}.`,
  prize_kicker: (period: LeaderboardPeriod) =>
    period === "week" ? "THIS WEEK'S PRIZE" : "SEASON PRIZE",
  sponsor_logo_line_1: "sponsor",
  sponsor_logo_line_2: "logo",
  ranking_label: "Ranking",
  ranking_title: (period: LeaderboardPeriod) =>
    period === "week" ? "Ranking · this week" : "Ranking · season",
  you_initials: "YOU",
  movement: (places: number, period: LeaderboardPeriod) =>
    `up ${String(places)} places ${period === "week" ? "this week" : "this season"}`,
  points_label: (points: string) => `${points} points`,
  rank_label: (rank: number) => `Rank ${String(rank)}`,
  elections_ranking_title: "Ranking · elections",
  elections_points_title: "Election points",
  elections_points_text: (points: number) =>
    `A correct prediction of who gets the most votes is worth ${String(points)} points. Election points are separate from game points.`,
  elections_count: (count: number) =>
    `${String(count)} ${count === 1 ? "election" : "elections"} with a result so far.`,
  elections_no_prizes: "No prizes for election picks.",
  elections_empty_title: "No election results yet",
  elections_empty_text: "Points come in when the result of an election is entered.",
  footer: "Concept demo · free to play, prizes by points, no real money",
} as const;
