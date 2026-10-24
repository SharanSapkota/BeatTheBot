import type { GameDay } from "@voita_kone/shared_types";
import { useNavigate } from "react-router";
import { AppHeader } from "../../components/app_header";
import { BottomNav } from "../../components/bottom_nav";
import { Card } from "../../components/card";
import { shared_copy } from "../../components/copy";
import { EmptyState } from "../../components/empty_state";
import { ErrorState } from "../../components/error_state";
import { FooterNote } from "../../components/footer_note";
import { PageMain } from "../../components/page_main";
import { PrimaryButton } from "../../components/primary_button";
import { Skeleton } from "../../components/skeleton";
import { useDemoMode } from "../../lib/demo_mode";
import { format_day_label } from "../../lib/format";
import { useUserSummary } from "../leaderboard/api";
import { useGameDay } from "./api";
import { game_day_copy } from "./copy";
import { FeaturedGameCard } from "./featured_game_card";
import { GameRow } from "./game_row";
import { HumansVsAiMini } from "./humans_vs_ai_mini";
import { TimeJumpBar } from "./time_jump_bar";
import styles from "./game_day_page.module.css";

function GameList({ game_day }: { game_day: GameDay }) {
  const navigate = useNavigate();
  const featured = game_day.games.find((game) => game.featured) ?? game_day.games[0];
  const others = game_day.games.filter((game) => game !== featured);
  // The day is a Helsinki calendar date; noon UTC keeps it on the same day when formatted.
  const day_label = format_day_label(`${game_day.date}T12:00:00Z`);

  return (
    <>
      <div className={styles.title_row}>
        <h1 className={styles.title}>{game_day_copy.title}</h1>
        <span className={styles.meta}>
          {day_label} · {game_day_copy.game_count(game_day.games.length)}
        </span>
      </div>
      {featured ? (
        <>
          <FeaturedGameCard game={featured} />
          {others.length > 0 && (
            <Card padding="list" gap={0}>
              {others.map((game) => (
                <GameRow key={game.id} game={game} />
              ))}
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title={game_day_copy.empty_title}
          text={game_day_copy.empty_text}
          action={
            <PrimaryButton on_click={() => void navigate("/?demo=1&moment=before")}>
              {game_day_copy.show_demo}
            </PrimaryButton>
          }
        />
      )}
    </>
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
      {is_demo && <TimeJumpBar />}
      <PageMain>
        {game_day.isPending && <Skeleton card_heights={[56, 330, 300]} />}
        {game_day.isError && <ErrorState on_retry={() => void game_day.refetch()} />}
        {game_day.data && <GameList game_day={game_day.data} />}
        <HumansVsAiMini />
        <FooterNote text={shared_copy.footer_sample} />
      </PageMain>
      <BottomNav />
    </>
  );
}
