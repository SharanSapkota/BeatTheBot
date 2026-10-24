import type { LeaderboardPeriod, SportFilter } from "@voita_kone/shared_types";
import { useState } from "react";
import { AppHeader } from "../../components/app_header";
import { BottomNav } from "../../components/bottom_nav";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty_state";
import { ErrorState } from "../../components/error_state";
import { FooterNote } from "../../components/footer_note";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { GridItem, PageGrid } from "../../components/page_grid";
import { PageMain } from "../../components/page_main";
import { Skeleton } from "../../components/skeleton";
import { useUserSummary } from "../account/api";
import { useElectionLeaderboard, useLeaderboard } from "./api";
import { BOARD_SPORT, leaderboard_copy, type LeadersBoard } from "./copy";
import { YouVsFans } from "./you_vs_fans";
import { PeriodTabs } from "./period_tabs";
import { PrizeCard } from "./prize_card";
import { RankingList } from "./ranking_list";
import { SegmentTabs } from "../../components/segment_tabs";
import styles from "./leaders_page.module.css";

/**
 * Screen 5: fans vs fans: the ranking of real users, you vs all fans, and the sponsor prize.
 * Desktop: the ranking in the main column; you vs all fans and the prize in the sidebar.
 */
function GamesBoard({ period, sport }: { period: LeaderboardPeriod; sport: SportFilter }) {
  const leaderboard = useLeaderboard(period, sport);
  if (leaderboard.isPending) {
    return <Skeleton card_heights={[180, 110, 330]} />;
  }
  if (leaderboard.isError) {
    return <ErrorState on_retry={() => void leaderboard.refetch()} />;
  }
  return (
    <PageGrid
      main={
        <GridItem mobile_order={3}>
          <div className="desktop_only">
            <KalevaSectionTitle title={leaderboard_copy.ranking_title(period)} />
          </div>
          <RankingList rows={leaderboard.data.rows} period={period} />
        </GridItem>
      }
      sidebar={
        <>
          <GridItem mobile_order={1}>
            <YouVsFans leaderboard={leaderboard.data} />
          </GridItem>
          <GridItem mobile_order={2}>
            <PrizeCard leaderboard={leaderboard.data} />
          </GridItem>
        </>
      }
    />
  );
}

/** Election points: a separate leaderboard, 20 points per correct prediction, no prizes. */
function ElectionsBoard() {
  const leaderboard = useElectionLeaderboard();
  if (leaderboard.isPending) {
    return <Skeleton card_heights={[110, 330]} />;
  }
  if (leaderboard.isError) {
    return <ErrorState on_retry={() => void leaderboard.refetch()} />;
  }
  const { rows, points_per_correct, elections_count } = leaderboard.data;
  return (
    <PageGrid
      main={
        <GridItem mobile_order={2}>
          <div className="desktop_only">
            <KalevaSectionTitle title={leaderboard_copy.elections_ranking_title} />
          </div>
          {rows.length === 0 ? (
            <EmptyState
              title={leaderboard_copy.elections_empty_title}
              text={leaderboard_copy.elections_empty_text}
            />
          ) : (
            <RankingList rows={rows} period={null} />
          )}
        </GridItem>
      }
      sidebar={
        <GridItem mobile_order={1}>
          <Card>
            <KalevaSectionTitle
              title={leaderboard_copy.elections_points_title}
              mobile_variant="card"
            />
            <p>{leaderboard_copy.elections_points_text(points_per_correct)}</p>
            <p>{leaderboard_copy.elections_count(elections_count)}</p>
            <p>
              <strong>{leaderboard_copy.elections_no_prizes}</strong>
            </p>
          </Card>
        </GridItem>
      }
    />
  );
}

/** /leaders: tabs Games (every sport), Hockey, Football, Basketball (week / season) and Elections. */
export function LeadersPage() {
  const [board, set_board] = useState<LeadersBoard>("games");
  const [period, set_period] = useState<LeaderboardPeriod>("week");
  const user = useUserSummary();

  return (
    <>
      <AppHeader total_points={user.data?.total_points} on_mobile="hidden" />
      <div className={styles.header}>
        <h1 className={styles.title}>{leaderboard_copy.title}</h1>
        <SegmentTabs
          label={leaderboard_copy.board_group}
          tabs={leaderboard_copy.boards}
          selected={board}
          on_change={set_board}
        />
        {board !== "elections" && <PeriodTabs period={period} on_change={set_period} />}
      </div>
      <PageMain>
        {board === "elections" ? (
          <ElectionsBoard />
        ) : (
          <GamesBoard period={period} sport={BOARD_SPORT[board]} />
        )}
        <FooterNote text={leaderboard_copy.footer} />
      </PageMain>
      <BottomNav />
    </>
  );
}
