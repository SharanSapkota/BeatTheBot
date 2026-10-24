import type { GameSummary } from "@voita_kone/shared_types";
import { Card } from "../../components/card";
import { ChoiceButtons } from "../../components/choice_buttons";
import { PointsBadge } from "../../components/points_badge";
import { SectionTitle } from "../../components/section_title";
import { with_prematch_change, type GamePicks } from "../../lib/picks";
import { POINTS } from "../../lib/points";
import { before_copy } from "./copy";

export interface PickProps {
  game: GameSummary;
  picks: GamePicks;
  update: (change: (picks: GamePicks) => GamePicks) => void;
  disabled: boolean;
}

export function WinnerPick({ game, picks, update, disabled }: PickProps) {
  return (
    <Card>
      <SectionTitle
        title={before_copy.winner_title}
        size={16}
        right={<PointsBadge text={`+${String(POINTS.winner)}`} />}
      />
      <ChoiceButtons
        label={before_copy.winner_group}
        choices={[
          { id: game.home_team.id, label: game.home_team.name },
          { id: game.away_team.id, label: game.away_team.name },
        ]}
        selected_id={picks.winner_team_id}
        on_select={(team_id) =>
          update((current) => with_prematch_change(current, { winner_team_id: team_id }))
        }
        disabled={disabled}
      />
    </Card>
  );
}
