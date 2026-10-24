import type { GameDetail, PlayerSummary } from "@voita_kone/shared_types";
import { GameTopBar } from "../../components/game_top_bar";
import { FooterNote } from "../../components/footer_note";
import { PageMain } from "../../components/page_main";
import { ScoreHeader } from "../../components/score_header";
import { Skeleton } from "../../components/skeleton";
import { StatusPill } from "../../components/status_pill";
import { useGamePicks } from "../../lib/picks";
import { useTeamPlayers } from "../game/api";
import { useGamePoints } from "../game/use_game_points";
import { useHighlight, useResultQuiz, useWhatItMeans, vote_options_for } from "./api";
import { after_copy } from "./copy";
import { GoalTimeline } from "./goal_timeline";
import { HighlightCard } from "./highlight_card";
import { PlayerVote } from "./player_vote";
import { PointsBreakdown, build_breakdown_lines } from "./points_breakdown";
import { ResultBanner } from "./result_banner";
import { ResultQuiz } from "./result_quiz";
import { WhatItMeansCard } from "./what_it_means_card";

/** Screen 4: result, highlight, points, "what it means", quiz and vote. */
export function AfterGameScreen({ game }: { game: GameDetail }) {
  const [picks, update] = useGamePicks(game.id);
  const points = useGamePoints(game);
  const highlight = useHighlight(game);
  const story = useWhatItMeans(game);
  const quiz = useResultQuiz(game);
  const home_players = useTeamPlayers(game.home_team.id);
  const away_players = useTeamPlayers(game.away_team.id);

  const players: PlayerSummary[] = [...(home_players.data ?? []), ...(away_players.data ?? [])];
  const player_name = (player_id: string) => {
    const player = players.find((candidate) => candidate.id === player_id);
    return player ? `${player.first_name} ${player.last_name}` : after_copy.unknown_player;
  };

  return (
    <>
      <ScoreHeader
        game={game}
        top_bar={
          <GameTopBar
            status={
              <StatusPill tone="on_dark" size="large">
                {after_copy.final}
              </StatusPill>
            }
          />
        }
      />
      <PageMain>
        {highlight.isPending ? (
          <Skeleton card_heights={[330]} />
        ) : (
          <HighlightCard highlight={highlight.data ?? null} />
        )}
        <ResultBanner your_points={points.total} ai_points={points.ai_total} />
        <PointsBreakdown
          lines={build_breakdown_lines(game, picks, points, player_name)}
          total={points.total}
        />
        {story.data && <WhatItMeansCard story={story.data} />}
        <GoalTimeline game={game} />
        {quiz.data && <ResultQuiz quiz={quiz.data} picks={picks} update={update} />}
        <PlayerVote options={vote_options_for(game)} picks={picks} update={update} />
        <FooterNote text={after_copy.footer} />
      </PageMain>
    </>
  );
}
