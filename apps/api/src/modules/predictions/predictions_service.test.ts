import type { PredictionRequest } from "@voita_kone/shared_types";
import { describe, expect, it } from "vitest";
import type {
  PickableGameRow,
  PredictionRow,
  PredictionValues,
  PredictionsRepository,
} from "./predictions_repository";
import { PredictionsService } from "./predictions_service";

const NOW = new Date("2026-10-24T12:00:00.000Z");
const USER_ID = "11111111-1111-4111-8111-111111111111";
const GAME: PickableGameRow = {
  id: "22222222-2222-4222-8222-222222222222",
  start_time: new Date("2026-10-24T15:00:00.000Z"),
  home_team_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  away_team_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
};
const HOME_PLAYER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_TEAM_PLAYER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const PICK: PredictionRequest = {
  predicted_winner_team_id: GAME.home_team_id,
  predicted_home_goals: 3,
  predicted_away_goals: 2,
  predicted_scorer_id: HOME_PLAYER,
};

class FakePredictionsRepository implements PredictionsRepository {
  rows = new Map<string, PredictionRow>();

  find_game(game_id: string): Promise<PickableGameRow | undefined> {
    return Promise.resolve(game_id === GAME.id ? GAME : undefined);
  }

  find_player_team_id(player_id: string): Promise<string | null | undefined> {
    const teams: Record<string, string> = {
      [HOME_PLAYER]: GAME.home_team_id,
      [OTHER_TEAM_PLAYER]: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    };
    return Promise.resolve(teams[player_id]);
  }

  find_prediction(user_id: string, game_id: string): Promise<PredictionRow | undefined> {
    return Promise.resolve(this.rows.get(`${user_id}:${game_id}`));
  }

  insert_prediction(
    user_id: string,
    game_id: string,
    values: PredictionValues,
  ): Promise<PredictionRow | undefined> {
    const key = `${user_id}:${game_id}`;
    if (this.rows.has(key)) {
      return Promise.resolve(undefined);
    }
    const row = { ...values, game_id, points_awarded: null, created_at: NOW, updated_at: NOW };
    this.rows.set(key, row);
    return Promise.resolve(row);
  }

  update_prediction(
    user_id: string,
    game_id: string,
    values: PredictionValues,
  ): Promise<PredictionRow | undefined> {
    const key = `${user_id}:${game_id}`;
    const current = this.rows.get(key);
    if (!current) {
      return Promise.resolve(undefined);
    }
    const row = { ...current, ...values };
    this.rows.set(key, row);
    return Promise.resolve(row);
  }

  list_predictions(): Promise<PredictionRow[]> {
    return Promise.resolve([...this.rows.values()]);
  }
}

function create_service(now: Date = NOW) {
  return new PredictionsService(new FakePredictionsRepository(), () => now);
}

describe("PredictionsService.create", () => {
  it("saves the pick before puck drop", async () => {
    const prediction = await create_service().create(USER_ID, GAME.id, PICK);

    expect(prediction).toMatchObject({ game_id: GAME.id, ...PICK, points_awarded: null });
  });

  it("returns 409 PREDICTION_EXISTS for a second pick on the same game", async () => {
    const service = create_service();
    await service.create(USER_ID, GAME.id, PICK);

    await expect(service.create(USER_ID, GAME.id, PICK)).rejects.toMatchObject({
      code: "PREDICTION_EXISTS",
      http_status: 409,
    });
  });

  it("returns 409 PREDICTION_LOCKED at and after puck drop", async () => {
    await expect(
      create_service(GAME.start_time).create(USER_ID, GAME.id, PICK),
    ).rejects.toMatchObject({ code: "PREDICTION_LOCKED", http_status: 409 });
  });

  it("returns 404 GAME_NOT_FOUND for an unknown game", async () => {
    await expect(
      create_service().create(USER_ID, "99999999-9999-4999-8999-999999999999", PICK),
    ).rejects.toMatchObject({ code: "GAME_NOT_FOUND", http_status: 404 });
  });

  it("returns 400 INVALID_PICK for a winner or scorer from another team", async () => {
    const service = create_service();
    const invalid = { code: "INVALID_PICK", http_status: 400 };

    await expect(
      service.create(USER_ID, GAME.id, { ...PICK, predicted_winner_team_id: HOME_PLAYER }),
    ).rejects.toMatchObject(invalid);
    await expect(
      service.create(USER_ID, GAME.id, { ...PICK, predicted_scorer_id: OTHER_TEAM_PLAYER }),
    ).rejects.toMatchObject(invalid);
    await expect(
      service.create(USER_ID, GAME.id, { ...PICK, predicted_scorer_id: GAME.id }),
    ).rejects.toMatchObject(invalid);
  });

  it("accepts a pick without a scorer", async () => {
    const prediction = await create_service().create(USER_ID, GAME.id, {
      ...PICK,
      predicted_scorer_id: null,
    });

    expect(prediction.predicted_scorer_id).toBeNull();
  });
});

describe("PredictionsService.update", () => {
  it("changes an existing pick, or returns 404 PREDICTION_NOT_FOUND", async () => {
    const service = create_service();

    await expect(service.update(USER_ID, GAME.id, PICK)).rejects.toMatchObject({
      code: "PREDICTION_NOT_FOUND",
      http_status: 404,
    });
    await service.create(USER_ID, GAME.id, PICK);
    const updated = await service.update(USER_ID, GAME.id, { ...PICK, predicted_home_goals: 5 });
    expect(updated.predicted_home_goals).toBe(5);
  });
});
