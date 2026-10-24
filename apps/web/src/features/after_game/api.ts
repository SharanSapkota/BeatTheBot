import { useQuery } from "@tanstack/react-query";
import {
  highlight_response_schema,
  story_response_schema,
  type GameDetail,
  type Highlight,
  type Story,
} from "@voita_kone/shared_types";
import { api_get, get_or_sample } from "../../lib/api_client";
import { useDemoMode } from "../../lib/demo_mode";
import { build_sample_highlight } from "../../mocks/after_game";

/** Highlight of the game, chosen by a Kaleva editor. Sample until step 7. */
export function useHighlight(game: GameDetail) {
  return useQuery({
    queryKey: ["highlight", game.id],
    queryFn: async (): Promise<Highlight | null> => {
      const response = await get_or_sample(
        `/games/${game.id}/highlight`,
        highlight_response_schema,
        "GET /games/:game_id/highlight",
        () => ({ data: build_sample_highlight(game) }),
      );
      return response.data;
    },
  });
}

/**
 * "What it means" story, AI-written and fact-checked. Null until an editor has approved it.
 * In demo mode: the replayed real game's story, shown at the final moment.
 */
export function useWhatItMeans(game: GameDetail) {
  const { is_demo, moment } = useDemoMode();
  return useQuery({
    queryKey: ["what_it_means", game.id, is_demo ? moment : "real"],
    queryFn: async (): Promise<Story | null> => {
      const path = is_demo
        ? `/demo/games/${game.id}/stories?type=what_it_means&moment=${moment}`
        : `/games/${game.id}/stories?type=what_it_means`;
      const response = await api_get(path, story_response_schema);
      return response.data;
    },
  });
}
