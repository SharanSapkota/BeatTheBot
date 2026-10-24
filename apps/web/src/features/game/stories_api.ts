import { useQuery } from "@tanstack/react-query";
import {
  api_success_schema,
  story_response_schema,
  type GameSummary,
  type Story,
  type StoryType,
} from "@voita_kone/shared_types";
import { z } from "zod";
import { api_get, api_request } from "../../lib/api_client";
import { useDemoMode } from "../../lib/demo_mode";

/**
 * The published AI preview or AI summary, or null ("coming soon": not written yet or waiting
 * for an editor). Demo replays: the replayed game's preview before the end, summary at the end.
 * Only Liiga games have AI stories (`enabled` false for other sports).
 */
export function useStory(game: GameSummary, story_type: StoryType, enabled = true) {
  const { is_demo, moment } = useDemoMode();
  return useQuery({
    queryKey: ["story", game.id, story_type, is_demo ? moment : "real"],
    enabled,
    queryFn: async (): Promise<Story | null> => {
      const path = is_demo
        ? `/demo/games/${game.id}/stories?type=${story_type}&moment=${moment}`
        : `/games/${game.id}/stories?type=${story_type}`;
      return (await api_get(path, story_response_schema)).data;
    },
  });
}

const report_response_schema = api_success_schema(z.object({ received: z.literal(true) }));

/** "Report an error": the story goes back to an editor (it stays on screen for this reader). */
export async function report_story(story_id: string, reason: string): Promise<void> {
  await api_request("POST", `/stories/${story_id}/reports`, report_response_schema, { reason });
}
