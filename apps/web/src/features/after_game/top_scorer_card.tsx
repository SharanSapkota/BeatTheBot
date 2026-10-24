import type { GameDetail } from "@voita_kone/shared_types";
import { Card } from "../../components/card";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { after_copy } from "./copy";

/** Basketball has no goal list: the game's top scorer (entered with the result). */
export function TopScorerCard({ game }: { game: GameDetail }) {
  const player = game.top_scorer;
  return (
    <Card labelled_by="top_scorer_title">
      <KalevaSectionTitle
        id="top_scorer_title"
        mobile_variant="card"
        title={after_copy.top_scorer_title}
      />
      <p>
        {player ? (
          <strong>
            {player.first_name} {player.last_name}
          </strong>
        ) : (
          after_copy.top_scorer_missing
        )}
      </p>
    </Card>
  );
}
