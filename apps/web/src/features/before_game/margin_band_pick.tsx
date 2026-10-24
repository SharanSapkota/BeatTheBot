import { MARGIN_BANDS, type MarginBand } from "@voita_kone/scoring";
import { Card } from "../../components/card";
import { ChoiceButtons } from "../../components/choice_buttons";
import { PointsBadge } from "../../components/points_badge";
import { SectionTitle } from "../../components/section_title";
import { with_prematch_change } from "../../lib/picks";
import { before_copy } from "./copy";
import type { PickProps } from "./winner_pick";
import styles from "./exact_score_pick.module.css";

function is_margin_band(value: string): value is MarginBand {
  return (MARGIN_BANDS as readonly string[]).includes(value);
}

/** Basketball: the winner's margin in points, 1–5 / 6–10 / 11+. */
export function MarginBandPick({ picks, update, disabled, number, points }: PickProps) {
  return (
    <Card>
      <SectionTitle
        title={before_copy.numbered(number, before_copy.pick_titles.margin_band)}
        size={16}
        right={<PointsBadge text={`+${String(points)}`} />}
      />
      <p className={styles.note}>{before_copy.margin_hint}</p>
      <ChoiceButtons
        label={before_copy.margin_group}
        choices={MARGIN_BANDS.map((band) => ({ id: band, label: before_copy.margin_bands[band] }))}
        selected_id={picks.margin_band}
        on_select={(band) => {
          if (is_margin_band(band)) {
            update((current) => with_prematch_change(current, { margin_band: band }));
          }
        }}
        size="medium"
        disabled={disabled}
      />
    </Card>
  );
}
