import { useParams } from "react-router";
import { ErrorState } from "../../components/error_state";
import { GameTopBar } from "../../components/game_top_bar";
import { PageMain } from "../../components/page_main";
import { Skeleton } from "../../components/skeleton";
import { ApiError } from "../../lib/api_client";
import { AfterGameScreen } from "../after_game/after_game_screen";
import { BeforeGameScreen } from "../before_game/before_game_screen";
import { DuringGameScreen } from "../during_game/during_game_screen";
import { useGameDetail } from "./api";
import { game_copy } from "./copy";
import styles from "./game_page.module.css";

/** /games/:game_id shows Before, During or After from the game's state. */
export function GamePage() {
  const { game_id = "" } = useParams();
  const game = useGameDetail(game_id);

  if (game.data) {
    if (game.data.state === "upcoming") {
      return <BeforeGameScreen game={game.data} />;
    }
    if (game.data.state === "live") {
      return <DuringGameScreen game={game.data} />;
    }
    return <AfterGameScreen game={game.data} />;
  }

  const is_not_found = game.error instanceof ApiError && game.error.http_status === 404;
  return (
    <>
      <header className={styles.header}>
        <GameTopBar status={null} />
      </header>
      <PageMain>
        {game.isPending && <Skeleton card_heights={[320, 220, 180]} />}
        {game.isError && (
          <ErrorState
            on_retry={() => void game.refetch()}
            text={is_not_found ? game_copy.not_found : undefined}
          />
        )}
      </PageMain>
    </>
  );
}
