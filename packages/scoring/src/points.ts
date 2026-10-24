// Points rules from docs/product.md → Games and scoring. Pure, shared by the API and the web app.

export const POINTS = {
  winner: 10,
  exact_score: 25,
  scorer: 15,
  beat_ai: 5,
  next_goal: 5,
  period_goal: 3,
  quiz_each: 2,
  vote: 1,
} as const;
