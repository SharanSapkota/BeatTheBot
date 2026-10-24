import { MARGIN_BANDS, SPORT_IDS } from "@voita_kone/scoring";
import { z } from "zod";
import { api_success_schema } from "./api_response";

// Sport categories (step 8). The list itself lives in @voita_kone/scoring (`SPORTS`), with each
// sport's picks, so adding a sport is one config entry there.

export const sport_schema = z.enum(SPORT_IDS);
/** Leaderboard filter: every sport, or one. */
export const sport_filter_schema = z.enum(["all", ...SPORT_IDS]);
export const margin_band_schema = z.enum(MARGIN_BANDS);

export const league_summary_schema = z.object({
  id: z.uuid(),
  name: z.string(),
  sport: sport_schema,
  /** ISO 3166-1 alpha-2, e.g. "FI". */
  country: z.string(),
});

/** GET /sports: every sport with its game count for the day (Helsinki), in config order. */
export const sport_count_schema = z.object({
  sport: sport_schema,
  game_count: z.number().int().min(0),
  live_count: z.number().int().min(0),
});

export const sports_day_schema = z.object({
  date: z.iso.date(),
  sports: z.array(sport_count_schema),
});

export const sports_day_response_schema = api_success_schema(sports_day_schema);

export type Sport = z.infer<typeof sport_schema>;
export type SportFilter = z.infer<typeof sport_filter_schema>;
export type MarginBandValue = z.infer<typeof margin_band_schema>;
export type LeagueSummary = z.infer<typeof league_summary_schema>;
export type SportCount = z.infer<typeof sport_count_schema>;
export type SportsDay = z.infer<typeof sports_day_schema>;
