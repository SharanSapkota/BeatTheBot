import type { GameDetail } from "@voita_kone/shared_types";
import type { PickKind } from "@voita_kone/scoring";
import type { ReactNode } from "react";
import { FooterNote } from "../../components/footer_note";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { GridItem, PageGrid } from "../../components/page_grid";
import { PageMain } from "../../components/page_main";
import { AiStoryCard } from "../../components/ai_story_card";
import { Skeleton } from "../../components/skeleton";
import { useGamePicks } from "../../lib/picks";
import { possible_points } from "../../lib/points";
import { config_of } from "../../lib/sports";
import { useNow } from "../../lib/use_now";
import { NameDialog } from "../account/name_dialog";
import { useCrowd, useDataSays } from "../game/api";
import { report_story, useStory } from "../game/stories_api";
import { BeforeHeader } from "./before_header";
import { before_copy } from "./copy";
import { ExactScorePick } from "./exact_score_pick";
import { FansSoFarCard } from "./fans_so_far_card";
import { MarginBandPick } from "./margin_band_pick";
import { PossiblePointsFooter } from "./possible_points_footer";
import { ScorerPick } from "./scorer_pick";
import { DataSaysCard } from "./data_says_card";
import { useLockIn } from "./use_lock_in";
import { WinnerPick, type PickProps } from "./winner_pick";

/** One card per pick of the sport (`SPORTS[sport].picks`), in that order. */
function pick_card(kind: PickKind, props: PickProps): ReactNode {
  switch (kind) {
    case "winner":
      return <WinnerPick key={kind} {...props} />;
    case "outcome_1x2":
      return <WinnerPick key={kind} {...props} with_draw />;
    case "exact_score":
      return <ExactScorePick key={kind} {...props} />;
    case "scorer":
      return <ScorerPick key={kind} {...props} />;
    case "margin_band":
      return <MarginBandPick key={kind} {...props} />;
    case "top_scorer":
      return <ScorerPick key={kind} {...props} kind="top_scorer" />;
  }
}

/**
 * Every sport: the AI preview. Hockey: also "Data says". Other sports: how the fans have picked
 * so far (no model numbers).
 */
function GuideCards({ game }: { game: GameDetail }) {
  const has_model = config_of(game.sport).has_model;
  const data_says = useDataSays(has_model ? game : undefined);
  const preview = useStory(game, "preview");
  const preview_card = (
    <AiStoryCard story_type="preview" story={preview.data} on_report={report_story} />
  );
  if (!has_model) {
    return (
      <>
        {preview_card}
        <FansSoFarCard game={game} />
      </>
    );
  }
  return (
    <>
      {preview_card}
      {data_says.isPending ? (
        <Skeleton card_heights={[240]} />
      ) : (
        <DataSaysCard game={game} data_says={data_says.data ?? null} />
      )}
    </>
  );
}

/**
 * Screen 2: the guide (AI preview and "Data says" for hockey) and the user's picks for the
 * game's sport, locked at puck drop / kick-off. Desktop: picks in the sidebar.
 */
export function BeforeGameScreen({ game }: { game: GameDetail }) {
  const now = useNow();
  const crowd = useCrowd(game.id);
  const [picks, update] = useGamePicks(game);
  const is_past_start = now.getTime() >= new Date(game.start_time).getTime();
  const lock = useLockIn({ game, picks, update });
  const cards = config_of(game.sport).picks.map((pick, index) =>
    pick_card(pick.kind, {
      game,
      picks,
      update,
      disabled: is_past_start,
      number: index + 1,
      points: pick.points,
    }),
  );

  return (
    <>
      <BeforeHeader game={game} now={now} />
      <PageMain>
        <PageGrid
          main={
            <GridItem mobile_order={1}>
              <GuideCards game={game} />
            </GridItem>
          }
          sidebar_label={before_copy.your_picks}
          sidebar={
            <GridItem mobile_order={2}>
              <div className="desktop_only">
                <KalevaSectionTitle title={before_copy.your_picks} />
              </div>
              {cards}
              <PossiblePointsFooter
                possible_points={possible_points(picks, game, crowd.data ?? null)}
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
