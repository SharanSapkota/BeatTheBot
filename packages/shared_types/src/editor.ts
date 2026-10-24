import { z } from "zod";
import { api_success_schema } from "./api_response";
import { story_type_schema, traffic_light_schema } from "./stories";

// /admin → Stories (role editor or admin): the story queue with each claim marked, and actions.

export const claim_status_schema = z.enum(["verified", "not_found", "wrong"]);

export const editor_claim_schema = z.object({
  claim: z.string(),
  type: z.string(),
  status: claim_status_schema,
  fact_ids: z.array(z.string()),
  reason: z.string().nullable(),
});

export const editor_fact_schema = z.object({
  fact_id: z.string(),
  type: z.string(),
  value: z.record(z.string(), z.unknown()),
  source: z.string(),
});

/** GET /admin/stories: stories waiting for an editor (🟡 and 🔴). */
export const editor_story_schema = z.object({
  id: z.uuid(),
  game_id: z.uuid(),
  game: z.string(),
  start_time: z.iso.datetime(),
  story_type: story_type_schema,
  headline: z.string(),
  body: z.string(),
  traffic_light: traffic_light_schema,
  reasons: z.array(z.string()),
  source: z.enum(["llm", "template"]),
  claims: z.array(editor_claim_schema),
  facts: z.array(editor_fact_schema),
  reports: z.array(z.object({ reason: z.string(), created_at: z.iso.datetime() })),
  /** True when it had been published before (an edit then shows a correction note). */
  was_published: z.boolean(),
  created_at: z.iso.datetime(),
});

/** GET /admin/stories?status=yellow|red (both when left out). */
export const editor_queue_query_schema = z.object({
  status: z.enum(["yellow", "red"]).optional(),
});

/** PUT /admin/stories/:id (edit → fact check again → approve) */
export const editor_edit_request_schema = z.object({
  body: z.string().trim().min(10).max(2000),
  /** What was wrong (shown in the correction note when the story had been published). */
  note: z.string().trim().max(300).optional(),
});

/** POST /admin/stories/:id/reject */
export const editor_reject_request_schema = z.object({
  note: z.string().trim().max(300).optional(),
});

export const editor_action_result_schema = z.object({
  id: z.uuid(),
  status: z.enum(["published", "corrected", "rejected"]),
  label_text: z.string().nullable(),
});

export const editor_stories_response_schema = api_success_schema(z.array(editor_story_schema));
export const editor_action_response_schema = api_success_schema(editor_action_result_schema);

export type ClaimStatus = z.infer<typeof claim_status_schema>;
export type EditorClaim = z.infer<typeof editor_claim_schema>;
export type EditorFact = z.infer<typeof editor_fact_schema>;
export type EditorStory = z.infer<typeof editor_story_schema>;
export type EditorEditRequest = z.infer<typeof editor_edit_request_schema>;
export type EditorActionResult = z.infer<typeof editor_action_result_schema>;
