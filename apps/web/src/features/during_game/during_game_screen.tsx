import type { GameDetail, Question } from "@voita_kone/shared_types";
import { FooterNote } from "../../components/footer_note";
import { InlineError } from "../../components/inline_error";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { GridItem, PageGrid } from "../../components/page_grid";
import { PageMain } from "../../components/page_main";
import { Skeleton } from "../../components/skeleton";
import { useDemoMode } from "../../lib/demo_mode";
import { useGamePicks } from "../../lib/picks";
import { live_points } from "../../lib/points";
import { config_of } from "../../lib/sports";
import { account_copy } from "../account/copy";
import { NameDialog } from "../account/name_dialog";
import { useDataSays } from "../game/api";
import { find_question, useAnswerQuestion, useQuestions } from "../game/questions_api";
import { useGamePoints } from "../game/use_game_points";
import { useWinChance } from "./api";
import { during_copy } from "./copy";
import { EventList } from "./event_list";
import { FanPoll } from "./fan_poll";
import { LiveScoreHeader } from "./live_score_header";
import { NextGoalPick } from "./next_goal_pick";
import { PERIOD_GOAL_PERIOD, PeriodGoalPick } from "./period_goal_pick";
import { WinChanceChart } from "./win_chance_chart";

/**
 * Screen 3: live picks, the "Data says" live win chance (hockey) and game events (refreshes
 * every 15 s). The live picks are the sport's (`SPORTS[sport].live_questions`).
 * Desktop: chart and events in the main column, live picks and the fan poll in the sidebar.
 */
export function DuringGameScreen({ game }: { game: GameDetail }) {
  const [picks, update] = useGamePicks(game);
  const points = useGamePoints(game);
  const config = config_of(game.sport);
  const data_says = useDataSays(config.has_model ? game : undefined);
  const win_chance = useWinChance(game, data_says.data);
  const { is_demo } = useDemoMode();
  const questions = useQuestions(game, "live");
  const answering = useAnswerQuestion(game);
  const goal_count = game.events.filter(
    (event) => event.event_type === "goal" && event.period < 5,
  ).length;
  const next_goal = find_question(questions.data, "next_goal", goal_count);
  const period_goal = find_question(questions.data, "period_goal", PERIOD_GOAL_PERIOD);
  const fan_poll = find_question(questions.data, "poll");
  const answer = (question: Question | undefined, value: string) => {
    if (question) {
      answering.answer(question, value);
    }
  };

  return (
    <>
      <LiveScoreHeader game={game} live_points={live_points(points)} />
      <PageMain>
        <PageGrid
          main={
            <GridItem mobile_order={2}>
              {config.has_model &&
                (win_chance.data ? (
                  <WinChanceChart game={game} win_chance={win_chance.data} />
                ) : (
                  <Skeleton card_heights={[200]} />
                ))}
              <EventList game={game} picks={picks} />
            </GridItem>
          }
          sidebar_label={during_copy.live_picks}
          sidebar={
            <>
              <GridItem mobile_order={1}>
                <div className="desktop_only">
                  <KalevaSectionTitle title={during_copy.live_picks} />
                </div>
                {config.live_questions.includes("next_goal") && (
                  <NextGoalPick
                    game={game}
                    goal_count={goal_count}
                    picks={picks}
                    update={update}
                    question={next_goal}
                    is_saved={!is_demo}
                    on_answer={(choice) => answer(next_goal, choice)}
                  />
                )}
                {config.live_questions.includes("period_goal") && (
                  <PeriodGoalPick
                    current_period={game.period}
                    picks={picks}
                    question={period_goal}
                    is_saved={!is_demo}
                    on_answer={(value) => answer(period_goal, value)}
                  />
                )}
                {answering.error_text && <InlineError text={answering.error_text} />}
              </GridItem>
              {fan_poll && (
                <GridItem mobile_order={3}>
                  <FanPoll
                    question={fan_poll}
                    answer={picks.poll_answer}
                    is_saved={!is_demo}
                    on_answer={(option_id) => answer(fan_poll, option_id)}
                  />
                </GridItem>
              )}
            </>
          }
        />
        <FooterNote text={during_copy.footer} />
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
