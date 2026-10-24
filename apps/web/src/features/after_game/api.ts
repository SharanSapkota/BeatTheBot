import { useQuery } from "@tanstack/react-query";
import {
  highlight_response_schema,
  type GameDetail,
  type Highlight,
} from "@voita_kone/shared_types";
import { get_or_sample } from "../../lib/api_client";
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
