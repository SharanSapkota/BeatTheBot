import { z } from "zod";
import { api_success_schema } from "./api_response";

// Contracts for features whose API is built in later steps. The web app shows sample data
// with these shapes until then, so swapping in the real endpoint changes nothing else.

/** GET /games/:game_id/ai_prediction (step 3). Numbers come from the prediction model. */
export const ai_prediction_schema = z.object({
  game_id: z.string(),
  predicted_winner_team_id: z.string(),
  home_win_probability: z.number().min(0).max(1),
  predicted_home_goals: z.number().int().min(0),
  predicted_away_goals: z.number().int().min(0),
  predicted_scorer_id: z.string().nullable(),
  reasons: z.array(z.object({ fact_id: z.string(), text: z.string() })),
  stakes: z.array(
    z.object({
      team_id: z.string(),
      kind: z.enum(["relegation", "top_4", "playoffs"]),
      if_win: z.number().min(0).max(1),
      if_loss: z.number().min(0).max(1),
    }),
  ),
  crowd: z.object({ home_pick_share: z.number().min(0).max(1), total_picks: z.number().int() }),
  label_text: z.string(),
});

/** GET /games/:game_id/win_chance (step 3): home win chance after each goal. */
export const win_chance_schema = z.object({
  points: z.array(z.object({ label: z.string(), home_win_probability: z.number().min(0).max(1) })),
  updated_at: z.iso.datetime(),
});

/** GET /games/:game_id/highlight (step 7): chosen and published by a Kaleva editor. */
export const highlight_schema = z.object({
  title: z.string(),
  caption: z.string(),
  video_url: z.string().nullable(),
  duration_seconds: z.number().int(),
  clip_credit: z.string(),
  published_at: z.iso.datetime(),
});

/** GET /games/:game_id/stories?type=what_it_means (step 5): AI-written, editor-checked. */
export const story_schema = z.object({
  id: z.string(),
  headline: z.string(),
  body: z.string(),
  label_text: z.string(),
});

/** GET /games/:game_id/questions?phase=after (step 6). */
export const quiz_question_schema = z.object({
  id: z.string(),
  prompt: z.string(),
  options: z.array(z.string()),
  correct_option: z.string(),
  explanation_right: z.string(),
  explanation_wrong: z.string(),
});

export const result_quiz_schema = z.object({
  points_each: z.number().int(),
  questions: z.array(quiz_question_schema),
});

/** GET /games/:game_id/questions?phase=live (step 6): fan poll, no points. */
export const fan_poll_schema = z.object({
  question: z.string(),
  options: z.array(z.object({ label: z.string(), share: z.number().min(0).max(1) })),
});

/** GET /me (step 4). */
export const user_summary_schema = z.object({
  display_name: z.string(),
  total_points: z.number().int(),
});

export const leaderboard_period_schema = z.enum(["week", "season"]);

/** GET /leaderboard?period=week|season (step 4). Accuracy = share of correct winner picks. */
export const leaderboard_schema = z.object({
  period: leaderboard_period_schema,
  accuracy: z.object({
    you: z.number().min(0).max(1),
    ai: z.number().min(0).max(1),
    fans: z.number().min(0).max(1),
  }),
  fans_beat_ai_weeks: z.number().int(),
  compared_weeks: z.number().int(),
  game_count: z.number().int(),
  prize: z.object({ title: z.string(), note: z.string() }),
  rows: z.array(
    z.object({
      rank: z.number().int().min(1),
      kind: z.enum(["user", "ai", "you"]),
      display_name: z.string(),
      points: z.number().int(),
      /** Places gained this period; only for the "you" row. */
      movement: z.number().int().nullable(),
    }),
  ),
});

export const ai_prediction_response_schema = api_success_schema(ai_prediction_schema);
export const win_chance_response_schema = api_success_schema(win_chance_schema);
export const highlight_response_schema = api_success_schema(highlight_schema.nullable());
export const story_response_schema = api_success_schema(story_schema.nullable());
export const result_quiz_response_schema = api_success_schema(result_quiz_schema);
export const fan_poll_response_schema = api_success_schema(fan_poll_schema);
export const user_summary_response_schema = api_success_schema(user_summary_schema);
export const leaderboard_response_schema = api_success_schema(leaderboard_schema);

export type AiPrediction = z.infer<typeof ai_prediction_schema>;
export type WinChance = z.infer<typeof win_chance_schema>;
export type Highlight = z.infer<typeof highlight_schema>;
export type Story = z.infer<typeof story_schema>;
export type QuizQuestion = z.infer<typeof quiz_question_schema>;
export type ResultQuiz = z.infer<typeof result_quiz_schema>;
export type FanPoll = z.infer<typeof fan_poll_schema>;
export type UserSummary = z.infer<typeof user_summary_schema>;
export type LeaderboardPeriod = z.infer<typeof leaderboard_period_schema>;
export type Leaderboard = z.infer<typeof leaderboard_schema>;
export type LeaderboardRow = Leaderboard["rows"][number];
