import { createBrowserRouter } from "react-router";
import { GamePage } from "../features/game/game_page";
import { GameDayPage } from "../features/game_day/game_day_page";
import { LeaderboardPage } from "../features/leaderboard/leaderboard_page";
import { AppShell } from "./app_shell";

export const routes = [
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <GameDayPage /> },
      { path: "/games/:game_id", element: <GamePage /> },
      { path: "/leaderboard", element: <LeaderboardPage /> },
    ],
  },
];

export function create_router() {
  return createBrowserRouter(routes);
}
