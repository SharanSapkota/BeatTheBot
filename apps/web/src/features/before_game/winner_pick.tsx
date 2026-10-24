import type { GameSummary } from "@voita_kone/shared_types";
import { Card } from "../../components/card";
import { ChoiceButtons } from "../../components/choice_buttons";
import { PointsBadge } from "../../components/points_badge";
import { SectionTitle } from "../../components/section_title";
import { DRAW_PICK, with_prematch_change, type GamePicks } from "../../lib/picks";
import { before_copy } from "./copy";

export interface PickProps {
  game: GameSummary;
  picks: GamePicks;
  update: (change: (picks: GamePicks) => GamePicks) => void;
  disabled: boolean;
  /** The pick's number on the screen ("1 · Who wins?") and its points. */
  number: number;
  points: number;
}

/** Hockey and basketball: one of the two teams. Football (`with_draw`): 1 X 2. */
export function WinnerPick({
  game,
  picks,
  update,
  disabled,
  number,
  points,
  with_draw = false,
}: PickProps & { with_draw?: boolean }) {
  const home = { id: game.home_team.id, label: game.home_team.name };
  const away = { id: game.away_team.id, label: game.away_team.name };
  const title = with_draw ? before_copy.pick_titles.outcome_1x2 : before_copy.pick_titles.winner;
  return (
    <Card>
      <SectionTitle
        title={before_copy.numbered(number, title)}
        size={16}
        right={<PointsBadge text={`+${String(points)}`} />}
      />
      <ChoiceButtons
        label={with_draw ? before_copy.outcome_group : before_copy.winner_group}
        choices={
          with_draw ? [home, { id: DRAW_PICK, label: before_copy.draw }, away] : [home, away]
        }
        selected_id={picks.winner_team_id}
        on_select={(team_id) =>
          update((current) => with_prematch_change(current, { winner_team_id: team_id }))
        }
        disabled={disabled}
      />
    </Card>
  );
}
