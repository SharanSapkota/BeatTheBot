import type { GameDay } from "@voita_kone/shared_types";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { AppHeader } from "../../components/app_header";
import { BottomNav } from "../../components/bottom_nav";
import { Card } from "../../components/card";
import { shared_copy } from "../../components/copy";
import { EmptyState } from "../../components/empty_state";
import { ErrorState } from "../../components/error_state";
import { FooterNote } from "../../components/footer_note";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { GridItem, PageGrid } from "../../components/page_grid";
import { PageMain } from "../../components/page_main";
import { PrimaryButton } from "../../components/primary_button";
import { Skeleton } from "../../components/skeleton";
import { useDemoMode } from "../../lib/demo_mode";
import { format_day_label } from "../../lib/format";
import { useUserSummary } from "../account/api";
import { useGameDay } from "./api";
import { game_day_copy } from "./copy";
import { FeaturedGameCard } from "./featured_game_card";
import { GameRow } from "./game_row";
import { HumansVsAiMini } from "./humans_vs_ai_mini";
import { TimeJumpBar } from "./time_jump_bar";
import styles from "./game_day_page.module.css";

function NoGames() {
  const navigate = useNavigate();
  return (
    <EmptyState
      title={game_day_copy.empty_title}
      text={game_day_copy.empty_text}
      action={
        <PrimaryButton on_click={() => void navigate("/?demo=1&moment=before")}>
          {game_day_copy.show_demo}
        </PrimaryButton>
      }
    />
  );
}

function TodaysGamesTitle({ game_day }: { game_day: GameDay }) {
  // The day is a Helsinki calendar date; noon UTC keeps it on the same day when formatted.
  const day_label = format_day_label(`${game_day.date}T12:00:00Z`);
  return (
    <KalevaSectionTitle
      title={game_day_copy.title}
      meta={`${day_label} · ${game_day_copy.game_count(game_day.games.length)}`}
      meta_mobile_only
    />
  );
}

/**
 * Mobile: TODAY'S GAMES, the featured card, the other games, this week.
 * Desktop: the featured hero in the main column; the games list and this week in the sidebar.
 */
function HubGrid({ game_day, main_state }: { game_day?: GameDay; main_state: ReactNode }) {
  const featured = game_day?.games.find((game) => game.featured) ?? game_day?.games[0];
  const others = game_day?.games.filter((game) => game !== featured) ?? [];
  let main = main_state;
  if (game_day) {
    main = featured ? <FeaturedGameCard game={featured} /> : <NoGames />;
  }

  return (
    <PageGrid
      main={<GridItem mobile_order={2}>{main}</GridItem>}
      sidebar={
        <>
          {game_day && (
            <GridItem mobile_order={1}>
              <TodaysGamesTitle game_day={game_day} />
            </GridItem>
          )}
          {others.length > 0 && (
            <GridItem mobile_order={3}>
              <Card padding="list" gap={0}>
                {others.map((game) => (
                  <GameRow key={game.id} game={game} />
                ))}
              </Card>
            </GridItem>
          )}
          <GridItem mobile_order={4}>
            <HumansVsAiMini />
          </GridItem>
        </>
      }
    />
  );
}

/** Screen 1: today's games. Tapping a game opens Before, During or After by its state. */
export function GameDayPage() {
  const { is_demo } = useDemoMode();
  const game_day = useGameDay();
  const user = useUserSummary();

  return (
    <>
      <AppHeader total_points={user.data?.total_points} />
      <div className={styles.intro}>
        <div className={styles.intro_text}>
          <h1 className={styles.page_title}>{game_day_copy.page_title}</h1>
          <p className={styles.intro_line}>{game_day_copy.intro}</p>
        </div>
        {is_demo && <TimeJumpBar />}
      </div>
      <PageMain>
        <HubGrid
          game_day={game_day.data}
          main_state={
            <>
              {game_day.isPending && <Skeleton card_heights={[56, 330, 300]} />}
              {game_day.isError && <ErrorState on_retry={() => void game_day.refetch()} />}
            </>
          }
        />
        <FooterNote text={shared_copy.footer_sample} />
      </PageMain>
      <BottomNav />
    </>
  );
}
