import { useQuery } from "@tanstack/react-query";
import {
  api_success_schema,
  game_stories_response_schema,
  type GameStories,
  type GameSummary,
  type Story,
  type StoryType,
} from "@voita_kone/shared_types";
import { z } from "zod";
import { api_get, api_request } from "../../lib/api_client";
import { useDemoMode } from "../../lib/demo_mode";

/**
 * The published AI preview or AI summary, or null ("coming soon": not written yet or waiting
 * for an editor). One request per game (GET /games/:id/stories → { preview, summary }), shared
 * by both cards. Demo replays: the preview before the end, the summary at the end.
 */
export function useStory(game: GameSummary, story_type: StoryType, enabled = true) {
  const { is_demo, moment } = useDemoMode();
  return useQuery({
    queryKey: ["stories", game.id, is_demo ? moment : "real"],
    enabled,
    queryFn: async (): Promise<GameStories> => {
      const path = is_demo
        ? `/demo/games/${game.id}/stories?moment=${moment}`
        : `/games/${game.id}/stories`;
      return (await api_get(path, game_stories_response_schema)).data;
    },
    select: (stories): Story | null => stories[story_type],
  });
}

const report_response_schema = api_success_schema(z.object({ received: z.literal(true) }));

/** "Report an error": the story goes back to an editor (it stays on screen for this reader). */
export async function report_story(story_id: string, reason: string): Promise<void> {
  await api_request("POST", `/stories/${story_id}/reports`, report_response_schema, { reason });
}
