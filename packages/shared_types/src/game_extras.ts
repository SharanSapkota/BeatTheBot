import { z } from "zod";
import { api_success_schema } from "./api_response";

// Contracts for features whose API is built in a later step (highlights, step 7). The web app shows sample data
// with these shapes until then, so swapping in the real endpoint changes nothing else.

/** GET /games/:game_id/highlight (step 7): chosen and published by a Kaleva editor. */
export const highlight_schema = z.object({
  title: z.string(),
  caption: z.string(),
  video_url: z.string().nullable(),
  duration_seconds: z.number().int(),
  clip_credit: z.string(),
  published_at: z.iso.datetime(),
});

export const highlight_response_schema = api_success_schema(highlight_schema.nullable());

export type Highlight = z.infer<typeof highlight_schema>;

/**
 * GET /admin/highlights/upload_status (role editor or admin): whether the highlight form may take
 * a video file. When not, it takes video URLs only and shows `reason`.
 */
export const highlight_upload_status_schema = z.object({
  file_uploads: z.boolean(),
  reason: z.string().nullable(),
});

export const highlight_upload_status_response_schema = api_success_schema(
  highlight_upload_status_schema,
);

export type HighlightUploadStatus = z.infer<typeof highlight_upload_status_schema>;
