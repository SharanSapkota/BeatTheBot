import { useQuery } from "@tanstack/react-query";
import {
  highlight_response_schema,
  result_quiz_response_schema,
  story_response_schema,
  type GameDetail,
  type Highlight,
  type ResultQuiz,
  type Story,
} from "@voita_kone/shared_types";
import { get_or_sample } from "../../lib/api_client";
import {
  build_sample_highlight,
  build_sample_quiz,
  build_sample_story,
  build_sample_vote_options,
} from "../../mocks/after_game";

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

/** "What it means" story, AI-written and fact-checked. Sample until step 5. */
export function useWhatItMeans(game: GameDetail) {
  return useQuery({
    queryKey: ["what_it_means", game.id],
    queryFn: async (): Promise<Story | null> => {
      const response = await get_or_sample(
        `/games/${game.id}/stories?type=what_it_means`,
        story_response_schema,
        "GET /games/:game_id/stories",
        () => ({ data: build_sample_story(game) }),
      );
      return response.data;
    },
  });
}

/** Result quiz (3 questions from the story's facts). Sample until step 6. */
export function useResultQuiz(game: GameDetail) {
  return useQuery({
    queryKey: ["result_quiz", game.id],
    queryFn: async (): Promise<ResultQuiz> => {
      const response = await get_or_sample(
        `/games/${game.id}/questions?phase=after`,
        result_quiz_response_schema,
        "GET /games/:game_id/questions?phase=after",
        () => ({ data: build_sample_quiz(game) }),
      );
      return response.data;
    },
  });
}

/** Player-of-the-game options. Comes with the questions endpoint in step 6. */
export function vote_options_for(game: GameDetail): string[] {
  return build_sample_vote_options(game);
}
