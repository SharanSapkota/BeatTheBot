import type { GameDetail, PlayerSummary } from "@voita_kone/shared_types";
import { GameTopBar } from "../../components/game_top_bar";
import { FooterNote } from "../../components/footer_note";
import { GridItem, PageGrid } from "../../components/page_grid";
import { PageMain } from "../../components/page_main";
import { ScoreHeader } from "../../components/score_header";
import { Skeleton } from "../../components/skeleton";
import { StatusPill } from "../../components/status_pill";
import { useGamePicks } from "../../lib/picks";
import { useTeamPlayers } from "../game/api";
import { useGamePoints } from "../game/use_game_points";
import { find_question, useAnswerQuestion, useQuestions } from "../game/questions_api";
import { account_copy } from "../account/copy";
import { NameDialog } from "../account/name_dialog";
import { InlineError } from "../../components/inline_error";
import { useDemoMode } from "../../lib/demo_mode";
import { useHighlight, useWhatItMeans } from "./api";
import { after_copy } from "./copy";
import { GoalTimeline } from "./goal_timeline";
import { HighlightCard } from "./highlight_card";
import { PlayerVote } from "./player_vote";
import { PointsBreakdown, build_breakdown_lines } from "./points_breakdown";
import { ResultBanner } from "./result_banner";
import { ResultQuiz } from "./result_quiz";
import { WhatItMeansCard, WhatItMeansPendingCard } from "./what_it_means_card";

/**
 * Screen 4: result, highlight, points, "what it means", quiz and vote.
 * Desktop: highlight, story and timeline in the main column; result, points, quiz, vote in the sidebar.
 */
export function AfterGameScreen({ game }: { game: GameDetail }) {
  const [picks] = useGamePicks(game.id);
  const { is_demo } = useDemoMode();
  const points = useGamePoints(game);
  const highlight = useHighlight(game);
  const story = useWhatItMeans(game);
  const questions = useQuestions(game, "after");
  const answering = useAnswerQuestion(game);
  const quiz = (questions.data ?? []).filter(
    (question) => question.question_type === "result_quiz",
  );
  const vote = find_question(questions.data, "player_vote");
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
        <PageGrid
          main={
            <>
              <GridItem mobile_order={1}>
                {highlight.isPending ? (
                  <Skeleton card_heights={[330]} />
                ) : (
                  <HighlightCard highlight={highlight.data ?? null} />
                )}
              </GridItem>
              <GridItem mobile_order={3}>
                {story.data && <WhatItMeansCard story={story.data} />}
                {story.data === null && <WhatItMeansPendingCard />}
                <GoalTimeline game={game} />
              </GridItem>
            </>
          }
          sidebar_label={after_copy.your_result}
          sidebar={
            <>
              <GridItem mobile_order={2}>
                <ResultBanner your_points={points.total} ai_points={points.ai_total} />
                <PointsBreakdown
                  lines={build_breakdown_lines(game, picks, points, player_name)}
                  total={points.total}
                />
              </GridItem>
              <GridItem mobile_order={4}>
                {quiz.length > 0 && (
                  <ResultQuiz questions={quiz} picks={picks} on_answer={answering.answer} />
                )}
                {vote && (
                  <PlayerVote
                    question={vote}
                    picks={picks}
                    is_saved={!is_demo}
                    on_answer={(option_id) => answering.answer(vote, option_id)}
                  />
                )}
                {answering.error_text && <InlineError text={answering.error_text} />}
              </GridItem>
            </>
          }
        />
        <FooterNote text={after_copy.footer} />
      </PageMain>
      {answering.is_asking_name && (
        <NameDialog
          on_submit={answering.submit_name}
          on_cancel={answering.cancel_name}
          submit_text={account_copy.submit_answer}
        />
      )}
    </>
  );
}
