import type { GameDay, GameSummary, Sport } from "@voita_kone/shared_types";
import { useEffect, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
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
import {
  format_date_label,
  format_day_label,
  format_relative_day,
  helsinki_date_of,
  is_local_date_text,
} from "../../lib/format";
import { remember_sport } from "../../lib/sports";
import { useUserSummary } from "../account/api";
import { useGameDay, useGameDayOn, useGamesOverview } from "./api";
import { game_day_copy } from "./copy";
import { DaySwitcher } from "./day_switcher";
import { FeaturedGameCard } from "./featured_game_card";
import { GameRow } from "./game_row";
import { FansMini } from "./fans_mini";
import { SportTabs } from "./sport_tabs";
import { TimeJumpBar } from "./time_jump_bar";
import styles from "./game_day_page.module.css";

/** A day's games: the shown day, plus (on today) the latest results and the next games. */
interface HubData {
  date: string;
  games: readonly GameSummary[];
  latest_results: {
    date: string;
    games: GameSummary[];
    summary_lines: Record<string, string>;
  } | null;
  coming_up: { date: string; games: GameSummary[] } | null;
}

function NoDemoGames({ sport }: { sport: Sport }) {
  const navigate = useNavigate();
  return (
    <EmptyState
      title={game_day_copy.empty_title(shared_copy.sport_names[sport])}
      text={game_day_copy.empty_text}
      action={
        <PrimaryButton on_click={() => void navigate(`/games/${sport}?demo=1&moment=before`)}>
          {game_day_copy.show_demo}
        </PrimaryButton>
      }
    />
  );
}

/** "No games today. Next games: Tue 27 Oct" */
function EmptyDay({ data, today }: { data: HubData; today: string }) {
  if (data.date !== today) {
    return <EmptyState title={game_day_copy.no_games_on(format_date_label(data.date))} />;
  }
  return (
    <EmptyState
      title={game_day_copy.no_games_today}
      text={
        data.coming_up
          ? game_day_copy.next_games(format_date_label(data.coming_up.date))
          : game_day_copy.no_next_games
      }
    />
  );
}

function DayTitle({ data, today, sport }: { data: HubData; today: string; sport: Sport }) {
  const league = data.games[0]?.league.name ?? shared_copy.sport_names[sport];
  return (
    <KalevaSectionTitle
      title={
        data.date === today
          ? game_day_copy.title
          : game_day_copy.day_title(format_relative_day(data.date, today))
      }
      meta={`${format_date_label(data.date)} · ${game_day_copy.game_count(data.games.length, league)}`}
      meta_mobile_only
    />
  );
}

function GameList({
  games,
  summary_lines = {},
}: {
  games: readonly GameSummary[];
  summary_lines?: Record<string, string>;
}) {
  return (
    <Card padding="list" gap={0}>
      {games.map((game) => (
        <GameRow key={game.id} game={game} summary_line={summary_lines[game.id]} />
      ))}
    </Card>
  );
}

/** LATEST RESULTS / COMING UP with the day in the meta line. */
function DaySection({
  title,
  day,
  today,
}: {
  title: string;
  day: { date: string; games: readonly GameSummary[]; summary_lines?: Record<string, string> };
  today: string;
}) {
  const id = `${title.toLowerCase().replace(/\s+/g, "_")}_title`;
  return (
    <section aria-labelledby={id} className={styles.section}>
      <KalevaSectionTitle id={id} title={title} meta={format_relative_day(day.date, today)} />
      <GameList games={day.games} summary_lines={day.summary_lines} />
    </section>
  );
}

/** The hero: the day's featured game; on an empty today the next big game (featured first). */
function hero_of(data: HubData, today: string): { game: GameSummary; kicker?: string } | null {
  const featured = data.games.find((game) => game.featured) ?? data.games[0];
  if (featured) {
    return { game: featured };
  }
  if (data.date !== today || !data.coming_up) {
    return null;
  }
  const next = data.coming_up.games.find((game) => game.featured) ?? data.coming_up.games[0];
  return next ? { game: next, kicker: game_day_copy.next_big_game } : null;
}

/**
 * Mobile: day title, the hero (or the empty-day text), the day's other games, latest results,
 * coming up, this week. Desktop: the hero in the main column; the lists in the sidebar.
 */
function HubGrid({ data, today, sport }: { data: HubData; today: string; sport: Sport }) {
  const hero = hero_of(data, today);
  const others = data.games.filter((game) => game !== hero?.game);
  const coming_up = data.coming_up && {
    ...data.coming_up,
    games: data.coming_up.games.filter((game) => game !== hero?.game),
  };
  return (
    <PageGrid
      main={
        <GridItem mobile_order={2}>
          {data.games.length === 0 && <EmptyDay data={data} today={today} />}
          {hero && <FeaturedGameCard game={hero.game} kicker={hero.kicker} />}
        </GridItem>
      }
      sidebar={
        <>
          <GridItem mobile_order={1}>
            <DayTitle data={data} today={today} sport={sport} />
          </GridItem>
          {others.length > 0 && (
            <GridItem mobile_order={3}>
              <GameList games={others} />
            </GridItem>
          )}
          {data.latest_results && (
            <GridItem mobile_order={4}>
              <DaySection
                title={game_day_copy.latest_results}
                day={data.latest_results}
                today={today}
              />
            </GridItem>
          )}
          {coming_up && coming_up.games.length > 0 && (
            <GridItem mobile_order={5}>
              <DaySection title={game_day_copy.coming_up} day={coming_up} today={today} />
            </GridItem>
          )}
          <GridItem mobile_order={6}>
            <FansMini />
          </GridItem>
        </>
      }
    />
  );
}

/** The demo replay (?demo=1): the replayed day at the chosen moment, as before. */
function DemoHub({ sport, game_day }: { sport: Sport; game_day: GameDay }) {
  const featured = game_day.games.find((game) => game.featured) ?? game_day.games[0];
  const others = game_day.games.filter((game) => game !== featured);
  return (
    <PageGrid
      main={
        <GridItem mobile_order={2}>
          {featured ? <FeaturedGameCard game={featured} /> : <NoDemoGames sport={sport} />}
        </GridItem>
      }
      sidebar={
        <>
          <GridItem mobile_order={1}>
            <KalevaSectionTitle
              title={game_day_copy.title}
              meta={`${format_day_label(`${game_day.date}T12:00:00Z`)} · ${game_day_copy.game_count(
                game_day.games.length,
                game_day.games[0]?.league.name ?? shared_copy.sport_names[sport],
              )}`}
              meta_mobile_only
            />
          </GridItem>
          {others.length > 0 && (
            <GridItem mobile_order={3}>
              <GameList games={others} />
            </GridItem>
          )}
          <GridItem mobile_order={4}>
            <FansMini />
          </GridItem>
        </>
      }
    />
  );
}

function Loading({ is_error, on_retry }: { is_error: boolean; on_retry: () => void }): ReactNode {
  return is_error ? <ErrorState on_retry={on_retry} /> : <Skeleton card_heights={[56, 330, 300]} />;
}

/** Today (overview) or any other day (the day switcher) in real mode. */
function RealHub({ sport }: { sport: Sport }) {
  const [params, set_params] = useSearchParams();
  const today = helsinki_date_of(new Date());
  const asked = params.get("date");
  const date = asked !== null && is_local_date_text(asked) ? asked : today;
  const overview = useGamesOverview(sport, today, date === today);
  const other_day = useGameDayOn(sport, date, date !== today);
  const query = date === today ? overview : other_day;

  let data: HubData | undefined;
  if (date === today && overview.data) {
    data = {
      date: overview.data.date,
      games: overview.data.today,
      latest_results: overview.data.latest_results,
      coming_up: overview.data.coming_up,
    };
  } else if (date !== today && other_day.data) {
    data = { date, games: other_day.data.games, latest_results: null, coming_up: null };
  }

  const change_day = (next: string) => {
    set_params(next === today ? {} : { date: next });
  };

  return (
    <>
      <DaySwitcher date={date} today={today} on_change={change_day} />
      {data ? (
        <HubGrid data={data} today={today} sport={sport} />
      ) : (
        <Loading is_error={query.isError} on_retry={() => void query.refetch()} />
      )}
    </>
  );
}

function DemoHubLoader({ sport }: { sport: Sport }) {
  const game_day = useGameDay(sport);
  return game_day.data ? (
    <DemoHub sport={sport} game_day={game_day.data} />
  ) : (
    <Loading is_error={game_day.isError} on_retry={() => void game_day.refetch()} />
  );
}

/**
 * Screen 1 (/games/:sport, tabs Hockey · Football · Basketball): never empty. Today's games,
 * LATEST RESULTS and COMING UP, and a day switcher to browse any day (Helsinki time).
 * Tapping a game opens Before, During or After by its state.
 */
export function GameDayPage({ sport }: { sport: Sport }) {
  const { is_demo } = useDemoMode();
  const user = useUserSummary();
  useEffect(() => remember_sport(sport), [sport]);

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
      <SportTabs selected={sport} />
      <PageMain>
        {is_demo ? <DemoHubLoader sport={sport} /> : <RealHub sport={sport} />}
        <FooterNote text={shared_copy.footer_sample} />
      </PageMain>
      <BottomNav />
    </>
  );
}
