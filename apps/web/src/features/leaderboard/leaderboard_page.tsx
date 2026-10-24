import type { LeaderboardPeriod } from "@voita_kone/shared_types";
import { useState } from "react";
import { AppHeader } from "../../components/app_header";
import { BottomNav } from "../../components/bottom_nav";
import { ErrorState } from "../../components/error_state";
import { FooterNote } from "../../components/footer_note";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { GridItem, PageGrid } from "../../components/page_grid";
import { PageMain } from "../../components/page_main";
import { Skeleton } from "../../components/skeleton";
import { useUserSummary } from "../account/api";
import { useLeaderboard } from "./api";
import { leaderboard_copy } from "./copy";
import { HumansVsMachine } from "./humans_vs_machine";
import { PeriodTabs } from "./period_tabs";
import { PrizeCard } from "./prize_card";
import { RankingList } from "./ranking_list";
import styles from "./leaderboard_page.module.css";

/**
 * Screen 5: You vs AI vs all fans, sponsor prize and ranking.
 * Desktop: the ranking in the main column; humans vs the machine and the prize in the sidebar.
 */
export function LeaderboardPage() {
  const [period, set_period] = useState<LeaderboardPeriod>("week");
  const leaderboard = useLeaderboard(period);
  const user = useUserSummary();

  return (
    <>
      <AppHeader total_points={user.data?.total_points} on_mobile="hidden" />
      <div className={styles.header}>
        <h1 className={styles.title}>{leaderboard_copy.title}</h1>
        <PeriodTabs period={period} on_change={set_period} />
      </div>
      <PageMain>
        {leaderboard.isPending && <Skeleton card_heights={[180, 110, 330]} />}
        {leaderboard.isError && <ErrorState on_retry={() => void leaderboard.refetch()} />}
        {leaderboard.data && (
          <PageGrid
            main={
              <GridItem mobile_order={3}>
                <div className="desktop_only">
                  <KalevaSectionTitle title={leaderboard_copy.ranking_title(period)} />
                </div>
                <RankingList leaderboard={leaderboard.data} />
              </GridItem>
            }
            sidebar={
              <>
                <GridItem mobile_order={1}>
                  <HumansVsMachine leaderboard={leaderboard.data} />
                </GridItem>
                <GridItem mobile_order={2}>
                  <PrizeCard leaderboard={leaderboard.data} />
                </GridItem>
              </>
            }
          />
        )}
        <FooterNote text={leaderboard_copy.footer} />
      </PageMain>
      <BottomNav />
    </>
  );
}
