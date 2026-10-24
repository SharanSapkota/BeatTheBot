import {
  DEFAULT_SPORT,
  SPORTS,
  SPORT_IDS,
  is_sport_id,
  type SportConfig,
} from "@voita_kone/scoring";
import type { Sport } from "@voita_kone/shared_types";
import { z } from "zod";
import { read_stored, write_stored } from "./storage";

// Sport categories (step 8). The Games menu shows one sport per tab: /games/:sport. The last
// tab is remembered on this device, so /games opens it again.

export { SPORT_IDS };

const LAST_SPORT_KEY = "last_sport";
const sport_schema = z.enum(SPORT_IDS);

/** The sport in a URL segment, or null when the segment is not a sport (e.g. a game id). */
export function parse_sport(value: string | undefined): Sport | null {
  return value !== undefined && is_sport_id(value) ? value : null;
}

export function read_last_sport(): Sport {
  return read_stored(LAST_SPORT_KEY, sport_schema) ?? DEFAULT_SPORT;
}

export function remember_sport(sport: Sport): void {
  write_stored(LAST_SPORT_KEY, sport);
}

export function config_of(sport: Sport): SportConfig {
  return SPORTS[sport];
}
