import { z } from "zod";
import { api_success_schema } from "./api_response";

// AI preview (before the game) and AI summary (after the game). Only published stories reach
// readers; every one is labelled and can be reported.

export const story_type_schema = z.enum(["preview", "summary"]);
export const traffic_light_schema = z.enum(["green", "yellow", "red"]);

export const last_meeting_schema = z.object({
  date: z.iso.date(),
  home_team: z.string(),
  away_team: z.string(),
  home_goals: z.number().int().min(0),
  away_goals: z.number().int().min(0),
});

/** GET /games/:game_id/stories?type=preview|summary → the published story, or null. */
export const story_schema = z.object({
  id: z.uuid(),
  story_type: story_type_schema,
  headline: z.string(),
  body: z.string(),
  /** Preview: the 3 bullet lines (without "- "). Summary: empty. */
  bullets: z.array(z.string()),
  /** Preview: the "Why it matters" line (without the prefix). Summary: null. */
  why_it_matters: z.string().nullable(),
  /** "Written with AI from Liiga data · checked by Kaleva", or "Automatic … from Liiga data". */
  label_text: z.string(),
  /** llm = written with AI; template = the automatic text (no LLM available). */
  source: z.enum(["llm", "template"]),
  /** Preview: the teams' last meetings, newest first (from the fact sheet). */
  last_meetings: z.array(last_meeting_schema),
  /** Set when an editor changed the story after it was published. */
  correction: z.object({ corrected_at: z.iso.datetime(), note: z.string() }).nullable(),
  published_at: z.iso.datetime(),
});

/** POST /stories/:story_id/reports */
export const story_report_request_schema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const story_response_schema = api_success_schema(story_schema.nullable());

/** GET /games/:game_id/stories: the published preview and summary (null when not published). */
export const game_stories_schema = z.object({
  preview: story_schema.nullable(),
  summary: story_schema.nullable(),
});
export const game_stories_response_schema = api_success_schema(game_stories_schema);

export type StoryType = z.infer<typeof story_type_schema>;
export type TrafficLightValue = z.infer<typeof traffic_light_schema>;
export type LastMeeting = z.infer<typeof last_meeting_schema>;
export type Story = z.infer<typeof story_schema>;
export type GameStories = z.infer<typeof game_stories_schema>;
export type StoryReportRequest = z.infer<typeof story_report_request_schema>;
