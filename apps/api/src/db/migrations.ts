// Every migration, in order. Listed here (not read from the folder) so they also run from the
// tsup bundle. A new migration file must be added here too (migrations.test.ts checks it).
import type { Migration } from "kysely/migration";
import * as m_0001_sports_data from "./migrations/0001_sports_data";
import * as m_0002_model_output from "./migrations/0002_model_output";
import * as m_0003_users_and_auth from "./migrations/0003_users_and_auth";
import * as m_0004_games_and_points from "./migrations/0004_games_and_points";
import * as m_0005_editorial from "./migrations/0005_editorial";
import * as m_0006_game_live_state from "./migrations/0006_game_live_state";
import * as m_0007_model_details from "./migrations/0007_model_details";
import * as m_0008_story_audit from "./migrations/0008_story_audit";
import * as m_0009_questions from "./migrations/0009_questions";
import * as m_0010_fans_vs_fans from "./migrations/0010_fans_vs_fans";
import * as m_0011_elections from "./migrations/0011_elections";
import * as m_0012_sport_categories from "./migrations/0012_sport_categories";
import * as m_0013_rooms from "./migrations/0013_rooms";
import * as m_0014_story_input_hash from "./migrations/0014_story_input_hash";

export const migrations: Record<string, Migration> = {
  "0001_sports_data": m_0001_sports_data,
  "0002_model_output": m_0002_model_output,
  "0003_users_and_auth": m_0003_users_and_auth,
  "0004_games_and_points": m_0004_games_and_points,
  "0005_editorial": m_0005_editorial,
  "0006_game_live_state": m_0006_game_live_state,
  "0007_model_details": m_0007_model_details,
  "0008_story_audit": m_0008_story_audit,
  "0009_questions": m_0009_questions,
  "0010_fans_vs_fans": m_0010_fans_vs_fans,
  "0011_elections": m_0011_elections,
  "0012_sport_categories": m_0012_sport_categories,
  "0013_rooms": m_0013_rooms,
  "0014_story_input_hash": m_0014_story_input_hash,
};
