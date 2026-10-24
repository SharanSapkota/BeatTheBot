import type { FanPoll as FanPollData } from "@voita_kone/shared_types";
import { Card } from "../../components/card";
import { SectionTitle } from "../../components/section_title";
import { format_percent } from "../../lib/format";
import { during_copy } from "./copy";
import styles from "./fan_poll.module.css";

/** What all fans think (gray), no points. */
export function FanPoll({ poll }: { poll: FanPollData }) {
  return (
    <Card gap={10}>
      <SectionTitle
        title={during_copy.fan_poll_title}
        right={<span className={styles.no_points}>{during_copy.no_points}</span>}
      />
      <div className={styles.rows}>
        {poll.options.map((option) => (
          <div key={option.label} className={styles.row}>
            <span className={styles.label}>{option.label}</span>
            <span className={styles.track} aria-hidden="true">
              <span className={styles.fill} style={{ width: format_percent(option.share) }} />
            </span>
            <span className={styles.value}>{format_percent(option.share)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
