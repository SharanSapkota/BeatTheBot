import { Navigate, createBrowserRouter, useLocation } from "react-router";
import { AdminPage } from "../features/admin/admin_page";
import { EditorPage } from "../features/editor/editor_page";
import { ElectionPage } from "../features/elections/election_page";
import { ElectionsPage } from "../features/elections/elections_page";
import { GamePage } from "../features/game/game_page";
import { GameDayPage } from "../features/game_day/game_day_page";
import { LeadersPage } from "../features/leaderboard/leaders_page";
import { CreateRoomPage } from "../features/rooms/create_room_page";
import { JoinLinkPage } from "../features/rooms/join_link_page";
import { RoomPage } from "../features/rooms/room_page";
import { RoomsPage } from "../features/rooms/rooms_page";
import { SPORT_IDS, read_last_sport } from "../lib/sports";
import { AppShell } from "./app_shell";

/** Old links keep working: the query string (e.g. ?demo=1) is kept. */
function RedirectTo({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

/** /games opens the sport tab used last on this device (hockey the first time). */
function GamesRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/games/${read_last_sport()}${search}`} replace />;
}

export const routes = [
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <RedirectTo to="/games" /> },
      { path: "/games", element: <GamesRedirect /> },
      // Static sport segments rank above /games/:game_id.
      ...SPORT_IDS.map((sport) => ({
        path: `/games/${sport}`,
        element: <GameDayPage key={sport} sport={sport} />,
      })),
      { path: "/games/:game_id", element: <GamePage /> },
      { path: "/elections", element: <ElectionsPage /> },
      { path: "/elections/:election_id", element: <ElectionPage /> },
      { path: "/rooms", element: <RoomsPage /> },
      { path: "/rooms/new", element: <CreateRoomPage /> },
      { path: "/rooms/join/:key", element: <JoinLinkPage /> },
      { path: "/rooms/:room_id", element: <RoomPage /> },
      { path: "/leaders", element: <LeadersPage /> },
      { path: "/leaderboard", element: <RedirectTo to="/leaders" /> },
      { path: "/editor", element: <EditorPage /> },
      { path: "/admin", element: <AdminPage /> },
    ],
  },
];

export function create_router() {
  return createBrowserRouter(routes);
}
