import { z } from "zod";
import { api_success_schema } from "./api_response";

// AI-written stories (step 5). Only published stories reach readers.

export const story_type_schema = z.enum(["what_it_means"]);

/** GET /games/:game_id/stories?type=what_it_means → the published story, or null. */
export const story_schema = z.object({
  id: z.uuid(),
  headline: z.string(),
  body: z.string(),
  /** e.g. "AI-written from Liiga data. Checked by Kaleva sports desk, 21:47." */
  label_text: z.string(),
});

export const story_response_schema = api_success_schema(story_schema.nullable());

export type StoryType = z.infer<typeof story_type_schema>;
export type Story = z.infer<typeof story_schema>;
