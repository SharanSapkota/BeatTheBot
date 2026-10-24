import type { GameDetail } from "@voita_kone/shared_types";
import { FooterNote } from "../../components/footer_note";
import { PageMain } from "../../components/page_main";
import { Skeleton } from "../../components/skeleton";
import { useGamePicks } from "../../lib/picks";
import { live_points } from "../../lib/points";
import { useAiPrediction } from "../game/api";
import { useGamePoints } from "../game/use_game_points";
import { useFanPoll, useWinChance } from "./api";
import { during_copy } from "./copy";
import { EventList } from "./event_list";
import { FanPoll } from "./fan_poll";
import { LiveScoreHeader } from "./live_score_header";
import { NextGoalPick } from "./next_goal_pick";
import { PeriodGoalPick } from "./period_goal_pick";
import { WinChanceChart } from "./win_chance_chart";

/** Screen 3: live picks, live AI win chance and game events (refreshes every 15 s). */
export function DuringGameScreen({ game }: { game: GameDetail }) {
  const [picks, update] = useGamePicks(game.id);
  const points = useGamePoints(game);
  const prediction = useAiPrediction(game);
  const win_chance = useWinChance(game, prediction.data);
  const fan_poll = useFanPoll(game);
  const goal_count = game.events.filter(
    (event) => event.event_type === "goal" && event.period < 5,
  ).length;

  return (
    <>
      <LiveScoreHeader game={game} live_points={live_points(points)} />
      <PageMain>
        <NextGoalPick game={game} goal_count={goal_count} picks={picks} update={update} />
        <PeriodGoalPick current_period={game.period} picks={picks} update={update} />
        {win_chance.data ? (
          <WinChanceChart game={game} win_chance={win_chance.data} />
        ) : (
          <Skeleton card_heights={[200]} />
        )}
        <EventList game={game} picks={picks} />
        {fan_poll.data && <FanPoll poll={fan_poll.data} />}
        <FooterNote text={during_copy.footer} />
      </PageMain>
    </>
  );
}
