import type { LeaderboardPeriod } from "@voita_kone/shared_types";
import { useState } from "react";
import { BottomNav } from "../../components/bottom_nav";
import { ErrorState } from "../../components/error_state";
import { FooterNote } from "../../components/footer_note";
import { PageMain } from "../../components/page_main";
import { Skeleton } from "../../components/skeleton";
import { useLeaderboard } from "./api";
import { leaderboard_copy } from "./copy";
import { HumansVsMachine } from "./humans_vs_machine";
import { PeriodTabs } from "./period_tabs";
import { PrizeCard } from "./prize_card";
import { RankingList } from "./ranking_list";
import styles from "./leaderboard_page.module.css";

/** Screen 5: You vs AI vs all fans, sponsor prize and ranking. */
export function LeaderboardPage() {
  const [period, set_period] = useState<LeaderboardPeriod>("week");
  const leaderboard = useLeaderboard(period);

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>{leaderboard_copy.title}</h1>
        <PeriodTabs period={period} on_change={set_period} />
      </header>
      <PageMain>
        {leaderboard.isPending && <Skeleton card_heights={[180, 110, 330]} />}
        {leaderboard.isError && <ErrorState on_retry={() => void leaderboard.refetch()} />}
        {leaderboard.data && (
          <>
            <HumansVsMachine leaderboard={leaderboard.data} />
            <PrizeCard leaderboard={leaderboard.data} />
            <RankingList leaderboard={leaderboard.data} />
          </>
        )}
        <FooterNote text={leaderboard_copy.footer} />
      </PageMain>
      <BottomNav />
    </>
  );
}
