import { game_state_schema, sport_schema } from "@voita_kone/shared_types";
import { DEFAULT_SPORT } from "@voita_kone/scoring";
import { z } from "zod";

// Request validation. Dates stay strings here; the service checks them (INVALID_DATE).

export const game_day_params_schema = z.object({ date: z.string() });

export const game_params_schema = z.object({ game_id: z.string() });

/** Existing endpoints default to hockey. */
export const sport_query_schema = z.object({ sport: sport_schema.default(DEFAULT_SPORT) });

export const sports_query_schema = z.object({ date: z.string().default("today") });

export const game_list_query_schema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  team_id: z.uuid().optional(),
  state: game_state_schema.optional(),
  sport: sport_schema.default(DEFAULT_SPORT),
});
