import type { ComponentType } from "react";
import { useLocation } from "react-router";
import { useDemoMode } from "../lib/demo_mode";
import { shared_copy } from "./copy";
import { ElectionsIcon } from "./icons/elections_icon";
import { GamesIcon } from "./icons/games_icon";
import type { IconProps } from "./icons/icon_props";
import { LeadersIcon } from "./icons/leaders_icon";
import { RoomsIcon } from "./icons/rooms_icon";

export interface MainNavItem {
  to: string;
  label: string;
  icon: ComponentType<IconProps>;
  is_active: boolean;
}

const SECTIONS = [
  { path: "/games", label: shared_copy.nav_games, icon: GamesIcon },
  { path: "/elections", label: shared_copy.nav_elections, icon: ElectionsIcon },
  { path: "/rooms", label: shared_copy.nav_rooms, icon: RoomsIcon },
  { path: "/leaders", label: shared_copy.nav_leaders, icon: LeadersIcon },
] as const;

/**
 * Games · Elections · Rooms · Leaders, for the bottom nav (mobile) and the header nav
 * (desktop). Keeps demo mode. Staff pages (/editor, /admin) have no active item.
 */
export function useMainNav(): MainNavItem[] {
  const { pathname } = useLocation();
  const { link_to } = useDemoMode();
  return SECTIONS.map((section) => ({
    to: link_to(section.path),
    label: section.label,
    icon: section.icon,
    is_active: pathname === section.path || pathname.startsWith(`${section.path}/`),
  }));
}
