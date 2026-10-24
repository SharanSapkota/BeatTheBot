import {
  admin_leagues_response_schema,
  admin_match_response_schema,
  admin_matches_response_schema,
  api_error_schema,
  auth_result_response_schema,
  leaderboard_response_schema,
  user_predictions_response_schema,
  type AdminLeague,
} from "@voita_kone/shared_types";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KORISLIIGA_LEAGUE_ID, LIIGA_LEAGUE_ID, VEIKKAUSLIIGA_LEAGUE_ID } from "../../db/leagues";
import { TEST_NOW, create_test_app } from "../../test_helpers/create_test_app";
import { seed_fixture_database } from "../../test_helpers/seed_fixture_database";
import { create_test_database, reset_test_database } from "../../test_helpers/test_database";

// /admin → Matches: football and basketball matches entered by an admin, then their results.
const db = create_test_database();
const app = create_test_app({ db, now: TEST_NOW });
// The result tests need a clock after kick-off.
let now = TEST_NOW;
const later_app = () => create_test_app({ db, now });

let admin: string;
let fan: string;
let football: AdminLeague;
let basketball: AdminLeague;

function error_code(body: unknown): string {
  return api_error_schema.parse(body).error.code;
}

async function sign_in(display_name: string): Promise<{ header: string; id: string }> {
  const response = await request(app).post("/api/v1/auth/device").send({ display_name });
  const { token, user } = auth_result_response_schema.parse(response.body).data;
  return { header: `Bearer ${token}`, id: user.id };
}

function team_id(league: AdminLeague, name: string): string {
  const team = league.teams.find((candidate) => candidate.name === name);
  if (!team) {
    throw new Error(`No team ${name}`);
  }
  return team.id;
}

async function first_player(team: string): Promise<string> {
  const row = await db
    .selectFrom("players")
    .select("id")
    .where("team_id", "=", team)
    .orderBy("jersey_number", "desc")
    .executeTakeFirstOrThrow();
  return row.id;
}

/** An admin match in 2 hours (the test clock is 12:00 UTC). */
async function create_match(league: AdminLeague, home: string, away: string) {
  const response = await request(app)
    .post("/api/v1/admin/matches")
    .set("Authorization", admin)
    .send({
      league_id: league.id,
      home_team_id: team_id(league, home),
      away_team_id: team_id(league, away),
      start_time: new Date(TEST_NOW.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    });
  expect(response.status).toBe(201);
  return admin_match_response_schema.parse(response.body).data;
}

beforeAll(async () => {
  await seed_fixture_database(db);
  const admin_user = await sign_in("Admin");
  await db.updateTable("users").set({ role: "admin" }).where("id", "=", admin_user.id).execute();
  admin = admin_user.header;
  fan = (await sign_in("Football fan")).header;
  const leagues = admin_leagues_response_schema.parse(
    (await request(app).get("/api/v1/admin/leagues").set("Authorization", admin)).body,
  ).data;
  football = leagues.find((league) => league.id === VEIKKAUSLIIGA_LEAGUE_ID) as AdminLeague;
  basketball = leagues.find((league) => league.id === KORISLIIGA_LEAGUE_ID) as AdminLeague;
});

afterAll(async () => {
  await reset_test_database(db);
  await db.destroy();
});

describe("admin matches: access", () => {
  it.each([
    ["GET", "/api/v1/admin/leagues"],
    ["GET", "/api/v1/admin/matches"],
    ["POST", "/api/v1/admin/matches"],
  ])("%s %s: 401 signed out, 403 for a fan", async (method, path) => {
    const call = (auth?: string) => {
      const pending = method === "GET" ? request(app).get(path) : request(app).post(path).send({});
      return auth ? pending.set("Authorization", auth) : pending;
    };

    expect((await call()).status).toBe(401);
    const forbidden = await call(fan);
    expect(forbidden.status).toBe(403);
    expect(error_code(forbidden.body)).toBe("FORBIDDEN");
  });
});

describe("admin matches: leagues and matches", () => {
  it("lists the football and basketball leagues with their teams, not Liiga", () => {
    expect(football.sport).toBe("football");
    expect(basketball.sport).toBe("basketball");
    expect(football.teams.map((team) => team.name)).toContain("AC Oulu");
    expect([football.id, basketball.id]).not.toContain(LIIGA_LEAGUE_ID);
  });

  it("creates a match (admin data, season from the date) and writes audit_log", async () => {
    const match = await create_match(football, "AC Oulu", "KuPS");

    expect(match).toMatchObject({
      sport: "football",
      state: "upcoming",
      data_source: "admin",
      season: "2026",
      pick_count: 0,
      league: { id: VEIKKAUSLIIGA_LEAGUE_ID, name: "Veikkausliiga" },
    });
    const audit = await db
      .selectFrom("audit_log")
      .select(["action", "target_type"])
      .where("target_id", "=", match.id)
      .execute();
    expect(audit).toEqual([{ action: "match.create", target_type: "match" }]);
  });

  it("rejects a team from another league, the same team twice and a Liiga league", async () => {
    const base = {
      league_id: football.id,
      home_team_id: team_id(football, "HJK"),
      away_team_id: team_id(basketball, "Kouvot"),
      start_time: TEST_NOW.toISOString(),
    };
    const send = (body: object) =>
      request(app).post("/api/v1/admin/matches").set("Authorization", admin).send(body);

    const other_league = await send(base);
    const same_team = await send({ ...base, away_team_id: base.home_team_id });
    const liiga = await send({ ...base, league_id: LIIGA_LEAGUE_ID });

    expect([other_league.status, error_code(other_league.body)]).toEqual([400, "INVALID_MATCH"]);
    expect([same_team.status, error_code(same_team.body)]).toEqual([400, "VALIDATION_ERROR"]);
    expect([liiga.status, error_code(liiga.body)]).toEqual([400, "INVALID_MATCH"]);
  });

  it("lists matches per sport and never Liiga games", async () => {
    const matches = admin_matches_response_schema.parse(
      (await request(app).get("/api/v1/admin/matches?sport=basketball").set("Authorization", admin))
        .body,
    ).data;
    const all = admin_matches_response_schema.parse(
      (await request(app).get("/api/v1/admin/matches").set("Authorization", admin)).body,
    ).data;

    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((match) => match.sport === "basketball")).toBe(true);
    expect(all.some((match) => match.sport === "hockey")).toBe(false);
  });

  it("can't edit or delete a Liiga game", async () => {
    const liiga_game = await db
      .selectFrom("games")
      .select("id")
      .where("data_source", "=", "liiga_api")
      .executeTakeFirstOrThrow();

    const removed = await request(app)
      .delete(`/api/v1/admin/matches/${liiga_game.id}`)
      .set("Authorization", admin);

    expect([removed.status, error_code(removed.body)]).toEqual([404, "MATCH_NOT_FOUND"]);
  });
});

describe("admin matches: results score the picks", () => {
  it("scores a football draw pick after the admin enters a 1–1 result", async () => {
    const match = await create_match(football, "HJK", "SJK");
    const hjk = team_id(football, "HJK");
    const sjk = team_id(football, "SJK");
    const scorer = await first_player(sjk);
    // The fan picks a 1–1 draw with an SJK scorer before kick-off.
    const pick = await request(app)
      .post(`/api/v1/games/${match.id}/predictions`)
      .set("Authorization", fan)
      .send({
        predicted_winner_team_id: null,
        predicted_home_goals: 1,
        predicted_away_goals: 1,
        predicted_scorer_id: scorer,
      });
    expect(pick.status).toBe(201);

    const too_early = await request(app)
      .post(`/api/v1/admin/matches/${match.id}/result`)
      .set("Authorization", admin)
      .send({ home_goals: 1, away_goals: 1 });
    expect([too_early.status, error_code(too_early.body)]).toEqual([409, "MATCH_NOT_STARTED"]);

    now = new Date(TEST_NOW.getTime() + 4 * 60 * 60 * 1000);
    const wrong_goals = await request(later_app())
      .post(`/api/v1/admin/matches/${match.id}/result`)
      .set("Authorization", admin)
      .send({
        home_goals: 1,
        away_goals: 1,
        goals: [{ team_id: hjk, player_id: null, minute: 10 }],
      });
    expect([wrong_goals.status, error_code(wrong_goals.body)]).toEqual([400, "INVALID_RESULT"]);

    const result = await request(later_app())
      .post(`/api/v1/admin/matches/${match.id}/result`)
      .set("Authorization", admin)
      .send({
        home_goals: 1,
        away_goals: 1,
        goals: [
          { team_id: sjk, player_id: scorer, minute: 30 },
          { team_id: hjk, player_id: null, minute: 85 },
        ],
      });

    expect(result.status).toBe(200);
    const saved = admin_match_response_schema.parse(result.body).data;
    expect(saved).toMatchObject({ state: "final", home_goals: 1, away_goals: 1, pick_count: 1 });
    expect(saved.goals.map((goal) => goal.minute)).toEqual([30, 85]);
    const mine = user_predictions_response_schema.parse(
      (
        await request(later_app())
          .get(`/api/v1/me/predictions?game_id=${match.id}`)
          .set("Authorization", fan)
      ).body,
    ).data;
    // Draw 10 + exact score 25 + scorer 15 (one pick: no bold call below 20 picks).
    expect(mine[0]?.points_awarded).toBe(50);
    const football_board = leaderboard_response_schema.parse(
      (
        await request(later_app())
          .get("/api/v1/leaderboard?period=season&sport=football")
          .set("Authorization", fan)
      ).body,
    ).data;
    expect(football_board.rows.find((row) => row.kind === "you")?.points).toBe(50);
  });

  it("re-scores when the admin corrects a basketball result", async () => {
    now = TEST_NOW;
    const match = await create_match(basketball, "Kouvot", "Kataja Basket");
    const kouvot = team_id(basketball, "Kouvot");
    const top_scorer = await first_player(kouvot);
    await request(app)
      .post(`/api/v1/games/${match.id}/predictions`)
      .set("Authorization", fan)
      .send({
        predicted_winner_team_id: kouvot,
        predicted_home_goals: null,
        predicted_away_goals: null,
        predicted_scorer_id: top_scorer,
        predicted_margin_band: "1_5",
      })
      .expect(201);
    now = new Date(TEST_NOW.getTime() + 4 * 60 * 60 * 1000);
    const enter = (body: object) =>
      request(later_app())
        .post(`/api/v1/admin/matches/${match.id}/result`)
        .set("Authorization", admin)
        .send(body);

    const draw = await enter({ home_goals: 80, away_goals: 80 });
    await enter({ home_goals: 90, away_goals: 70, top_scorer_player_id: top_scorer }).expect(200);
    const first_points = await points_of(match.id);
    await enter({ home_goals: 84, away_goals: 81, top_scorer_player_id: top_scorer }).expect(200);

    expect([draw.status, error_code(draw.body)]).toEqual([400, "INVALID_RESULT"]);
    // 90–70: winner 10 + top scorer 15 (band 11+, not 1–5). Corrected 84–81: + band 15.
    expect(first_points).toBe(25);
    expect(await points_of(match.id)).toBe(40);
    const audit = await db
      .selectFrom("audit_log")
      .select("action")
      .where("target_id", "=", match.id)
      .where("action", "=", "match.result")
      .execute();
    expect(audit).toHaveLength(2);
  });

  it("refuses to delete a match with picks", async () => {
    now = TEST_NOW;
    const match = await create_match(football, "VPS", "FC Lahti");
    await request(app)
      .post(`/api/v1/games/${match.id}/predictions`)
      .set("Authorization", fan)
      .send({
        predicted_winner_team_id: team_id(football, "VPS"),
        predicted_home_goals: 2,
        predicted_away_goals: 0,
        predicted_scorer_id: null,
      })
      .expect(201);

    const removed = await request(app)
      .delete(`/api/v1/admin/matches/${match.id}`)
      .set("Authorization", admin);

    expect([removed.status, error_code(removed.body)]).toEqual([409, "MATCH_HAS_PICKS"]);
  });
});

async function points_of(game_id: string): Promise<number | null> {
  const row = await db
    .selectFrom("user_predictions")
    .select("points_awarded")
    .where("game_id", "=", game_id)
    .executeTakeFirstOrThrow();
  return row.points_awarded;
}
