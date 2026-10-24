import type { Leaderboard, LeaderboardPeriod, UserSummary } from "@voita_kone/shared_types";

const PRIZE = {
  title: "Top 3: [Sponsor] gift card [€ value]",
  note: "Winners by points. Checked by the sports desk before prizes.",
};

// TODO(step 4): replace with GET /api/v1/leaderboard?period=week|season.
export function build_sample_leaderboard(period: LeaderboardPeriod): Leaderboard {
  if (period === "season") {
    return {
      period,
      accuracy: { you: 0.59, ai: 0.62, fans: 0.55 },
      fans_beat_ai_weeks: 4,
      compared_weeks: 9,
      game_count: 145,
      prize: { title: "Season top 10: [Sponsor] season tickets", note: PRIZE.note },
      rows: [
        { rank: 1, kind: "user", display_name: "TappaJani", points: 1688, movement: null },
        { rank: 2, kind: "user", display_name: "MikaK_Oulu", points: 1640, movement: null },
        { rank: 3, kind: "user", display_name: "HockeyHannah", points: 1602, movement: null },
        { rank: 5, kind: "ai", display_name: "Kaleva AI", points: 1574, movement: null },
        { rank: 311, kind: "you", display_name: "You", points: 1240, movement: 12 },
      ],
    };
  }
  return {
    period,
    accuracy: { you: 0.64, ai: 0.61, fans: 0.58 },
    fans_beat_ai_weeks: 3,
    compared_weeks: 5,
    game_count: 32,
    prize: PRIZE,
    rows: [
      { rank: 1, kind: "user", display_name: "MikaK_Oulu", points: 212, movement: null },
      { rank: 2, kind: "user", display_name: "sanna.l", points: 205, movement: null },
      { rank: 3, kind: "user", display_name: "TappaJani", points: 198, movement: null },
      { rank: 7, kind: "ai", display_name: "Kaleva AI", points: 176, movement: null },
      { rank: 142, kind: "you", display_name: "You", points: 121, movement: 38 },
    ],
  };
}

// TODO(step 4): replace with GET /api/v1/me.
export function build_sample_user_summary(): UserSummary {
  return { display_name: "You", total_points: 1240 };
}
