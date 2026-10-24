import type { GameDetail } from "@voita_kone/shared_types";
import { FooterNote } from "../../components/footer_note";
import { PageMain } from "../../components/page_main";
import { Skeleton } from "../../components/skeleton";
import { useGamePicks } from "../../lib/picks";
import { possible_points } from "../../lib/points";
import { useNow } from "../../lib/use_now";
import { to_ai_pick, useAiPrediction } from "../game/api";
import { AiPickCard } from "./ai_pick_card";
import { BeforeHeader } from "./before_header";
import { before_copy } from "./copy";
import { ExactScorePick } from "./exact_score_pick";
import { PossiblePointsFooter } from "./possible_points_footer";
import { ScorerPick } from "./scorer_pick";
import { StakesCard } from "./stakes_card";
import { WinnerPick } from "./winner_pick";

/** Screen 2: the AI's pick and the user's picks, locked at puck drop. */
export function BeforeGameScreen({ game }: { game: GameDetail }) {
  const now = useNow();
  const prediction = useAiPrediction(game);
  const [picks, update] = useGamePicks(game.id);
  const is_past_start = now.getTime() >= new Date(game.start_time).getTime();
  const pick_props = { game, picks, update, disabled: is_past_start };

  return (
    <>
      <BeforeHeader game={game} now={now} />
      <PageMain>
        {prediction.data ? (
          <>
            <AiPickCard game={game} prediction={prediction.data} />
            <StakesCard game={game} prediction={prediction.data} />
          </>
        ) : (
          <Skeleton card_heights={[360, 200]} />
        )}
        <WinnerPick {...pick_props} />
        <ExactScorePick {...pick_props} />
        <ScorerPick {...pick_props} ai_scorer_id={prediction.data?.predicted_scorer_id ?? null} />
        <PossiblePointsFooter
          possible_points={possible_points(picks, to_ai_pick(prediction.data))}
          start_time={game.start_time}
          has_winner={picks.winner_team_id !== null}
          is_saved={picks.locked_at !== null}
          is_past_start={is_past_start}
          on_lock_in={() =>
            update((current) => ({ ...current, locked_at: new Date().toISOString() }))
          }
        />
        <FooterNote text={before_copy.footer} />
      </PageMain>
    </>
  );
}
