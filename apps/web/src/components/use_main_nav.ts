import { useLocation } from "react-router";
import { useDemoMode } from "../lib/demo_mode";
import { shared_copy } from "./copy";

export interface MainNavItem {
  to: string;
  label: string;
  is_active: boolean;
}

/** Games and Leaders, for the bottom nav (mobile) and the header nav (desktop). Keeps demo mode. */
export function useMainNav(): MainNavItem[] {
  const { pathname } = useLocation();
  const { link_to } = useDemoMode();
  const is_leaders = pathname.startsWith("/leaderboard");
  return [
    { to: link_to("/"), label: shared_copy.nav_games, is_active: !is_leaders },
    { to: link_to("/leaderboard"), label: shared_copy.nav_leaders, is_active: is_leaders },
  ];
}
