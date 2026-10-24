import type { GameDetail } from "@voita_kone/shared_types";
import { useEffect } from "react";
import { FooterNote } from "../../components/footer_note";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { GridItem, PageGrid } from "../../components/page_grid";
import { PageMain } from "../../components/page_main";
import { Skeleton } from "../../components/skeleton";
import { prefill_score, useGamePicks } from "../../lib/picks";
import { possible_points } from "../../lib/points";
import { useNow } from "../../lib/use_now";
import { NameDialog } from "../account/name_dialog";
import { to_ai_pick, useAiPrediction } from "../game/api";
import { AiPickCard, AiPickPendingCard } from "./ai_pick_card";
import { BeforeHeader } from "./before_header";
import { before_copy } from "./copy";
import { ExactScorePick } from "./exact_score_pick";
import { PossiblePointsFooter } from "./possible_points_footer";
import { ScorerPick } from "./scorer_pick";
import { StakesCard } from "./stakes_card";
import { useLockIn } from "./use_lock_in";
import { WinnerPick } from "./winner_pick";

/** Screen 2: the AI's pick and the user's picks, locked at puck drop. Desktop: picks in the sidebar. */
export function BeforeGameScreen({ game }: { game: GameDetail }) {
  const now = useNow();
  const prediction = useAiPrediction(game);
  const [picks, update] = useGamePicks(game.id);
  const is_past_start = now.getTime() >= new Date(game.start_time).getTime();
  const pick_props = { game, picks, update, disabled: is_past_start };
  const predicted = prediction.data;
  const lock = useLockIn({ game, picks, update });

  // The exact-score stepper starts at the AI's predicted score.
  useEffect(() => {
    if (predicted && !is_past_start) {
      prefill_score(game.id, predicted.predicted_home_goals, predicted.predicted_away_goals);
    }
  }, [game.id, predicted, is_past_start]);

  return (
    <>
      <BeforeHeader game={game} now={now} />
      <PageMain>
        <PageGrid
          main={
            <GridItem mobile_order={1}>
              {predicted && (
                <>
                  <AiPickCard game={game} prediction={predicted} />
                  <StakesCard game={game} prediction={predicted} />
                </>
              )}
              {predicted === null && <AiPickPendingCard />}
              {predicted === undefined && <Skeleton card_heights={[360, 200]} />}
            </GridItem>
          }
          sidebar_label={before_copy.your_picks}
          sidebar={
            <GridItem mobile_order={2}>
              <div className="desktop_only">
                <KalevaSectionTitle title={before_copy.your_picks} />
              </div>
              <WinnerPick {...pick_props} />
              <ExactScorePick {...pick_props} />
              <ScorerPick {...pick_props} ai_scorer_id={predicted?.predicted_scorer?.id ?? null} />
              <PossiblePointsFooter
                possible_points={possible_points(picks, to_ai_pick(predicted))}
                start_time={game.start_time}
                has_winner={picks.winner_team_id !== null}
                is_saved={picks.locked_at !== null}
                is_past_start={is_past_start}
                is_saving={lock.is_saving}
                error_text={lock.error_text}
                on_lock_in={lock.lock_in}
              />
            </GridItem>
          }
        />
        <FooterNote text={before_copy.footer} />
      </PageMain>
      {lock.is_asking_name && (
        <NameDialog on_submit={lock.submit_name} on_cancel={lock.cancel_name} />
      )}
    </>
  );
}
