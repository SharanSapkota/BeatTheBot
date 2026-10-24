import type { Transaction } from "kysely";
import type { DB } from "../database_types";
import type { Database } from "../kysely";
import { insert_demo_election } from "./demo_election";
import { insert_demo_room } from "./demo_room";
import { insert_sample_sports } from "./demo_sports";
import {
  build_demo_predictions,
  build_demo_users,
  type DemoUser,
  type PredictionTarget,
} from "./demo_users";

const PREDICTION_LEAD_TIME_MS = 3 * 60 * 60 * 1000;
const DEMO = "demo";

export interface SeedOptions {
  now: Date;
  editor_email: string;
}

export interface SeedSummary {
  user_count: number;
  prediction_count: number;
  /** Picks in the demo election (made by the demo voters). */
  election_pick_count: number;
  /** Answers in the demo room (made by its 8 demo members). */
  room_answer_count: number;
  /** Sample football and basketball games and the demo users' picks on them. */
  sample_game_count: number;
  sample_pick_count: number;
}

/** Demo games and all users are recreated on every seed. Liiga rows are never touched. */
async function delete_previous_demo_data(trx: Transaction<DB>): Promise<void> {
  // Cascades to their events, predictions and editorial rows.
  await trx.deleteFrom("games").where("data_source", "=", DEMO).execute();
  await trx.deleteFrom("game_events").where("data_source", "=", DEMO).execute();
  // Cascades to candidates, picks and results.
  await trx.deleteFrom("elections").where("is_demo", "=", true).execute();
  // Cascades to members, questions, answers and reactions.
  await trx.deleteFrom("rooms").where("is_demo", "=", true).execute();
  // Cascades to identities, sessions, predictions, answers and election picks.
  await trx.deleteFrom("users").execute();
}

/** The demo users pick real Liiga games, so the Liiga sync must have run first. */
async function ensure_liiga_synced(trx: Transaction<DB>): Promise<void> {
  const team = await trx
    .selectFrom("teams")
    .select("id")
    .where("sport", "=", "hockey")
    .limit(1)
    .executeTakeFirst();
  if (!team) {
    throw new Error(
      "No teams in the database. Run the Liiga sync first: pnpm --filter api sync:liiga",
    );
  }
}

/** Each demo user gets a 'device' identity, like a fan who signed in on the PWA. */
async function insert_users(trx: Transaction<DB>, users: readonly DemoUser[]) {
  const user_ids = new Map<string, string>();
  for (const { device_id, ...user } of users) {
    const { id } = await trx
      .insertInto("users")
      .values(user)
      .returning("id")
      .executeTakeFirstOrThrow();
    await trx
      .insertInto("auth_identities")
      .values({ user_id: id, provider: "device", provider_subject: device_id })
      .execute();
    user_ids.set(device_id, id);
  }
  return user_ids;
}

async function first_scorer(trx: Transaction<DB>, game_id: string, team_id: string) {
  const goal = await trx
    .selectFrom("game_events")
    .select("player_id")
    .where("game_id", "=", game_id)
    .where("team_id", "=", team_id)
    .where("event_type", "=", "goal")
    .where("player_id", "is not", null)
    .orderBy("game_time_seconds")
    .limit(1)
    .executeTakeFirst();
  return goal?.player_id ?? null;
}

/** The most recent finished Liiga game (hockey has real data only, no demo games). */
async function find_prediction_target(
  trx: Transaction<DB>,
): Promise<(PredictionTarget & { start_time: Date }) | null> {
  const game = await trx
    .selectFrom("games")
    .select(["id", "home_team_id", "away_team_id", "home_goals", "away_goals", "start_time"])
    .where("status", "=", "final")
    .where("sport", "=", "hockey")
    .orderBy("start_time", "desc")
    .limit(1)
    .executeTakeFirst();
  if (!game || game.home_goals === null || game.away_goals === null) {
    return null;
  }
  return {
    game_id: game.id,
    home_team_id: game.home_team_id,
    away_team_id: game.away_team_id,
    home_goals: game.home_goals,
    away_goals: game.away_goals,
    home_scorer_id: await first_scorer(trx, game.id, game.home_team_id),
    away_scorer_id: await first_scorer(trx, game.id, game.away_team_id),
    start_time: game.start_time,
  };
}

async function insert_predictions(trx: Transaction<DB>, user_ids: ReadonlyMap<string, string>) {
  const target = await find_prediction_target(trx);
  if (!target) {
    return 0;
  }
  // Picks lock at puck drop, so they were made before the game.
  const created_at = new Date(target.start_time.getTime() - PREDICTION_LEAD_TIME_MS);
  const rows = build_demo_predictions(target).flatMap(({ device_id, ...prediction }) => {
    const user_id = user_ids.get(device_id);
    return user_id ? [{ ...prediction, user_id, created_at }] : [];
  });
  if (rows.length > 0) {
    await trx.insertInto("user_predictions").values(rows).execute();
  }
  return rows.length;
}

/**
 * Recreates the demo users (with picks on the latest Liiga final), the demo election, the demo
 * room and the sample football and basketball fixtures.
 * Run the Liiga sync first. Runs in one transaction, so a failed seed changes nothing.
 */
export async function seed_demo_data(db: Database, options: SeedOptions): Promise<SeedSummary> {
  return db.transaction().execute(async (trx) => {
    await delete_previous_demo_data(trx);
    await ensure_liiga_synced(trx);
    const users = build_demo_users(options.editor_email);
    const user_ids = await insert_users(trx, users);
    const prediction_count = await insert_predictions(trx, user_ids);
    const election_pick_count = await insert_demo_election(trx, options.now);
    const room_answer_count = await insert_demo_room(trx, options.now);
    const samples = await insert_sample_sports(trx, options.now, user_ids);
    return {
      user_count: users.length,
      prediction_count,
      election_pick_count,
      room_answer_count,
      sample_game_count: samples.game_count,
      sample_pick_count: samples.pick_count,
    };
  });
}
