import {
  ai_prediction_response_schema,
  game_detail_response_schema,
} from "@voita_kone/shared_types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock_api } from "../test_helpers/mock_api";
import { ApiError, api_get, get_or_sample } from "./api_client";

function stub_fetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status }))),
  );
}

const SAMPLE = {
  data: {
    game_id: "g1",
    predicted_winner_team_id: "t1",
    home_win_probability: 0.62,
    predicted_home_goals: 2,
    predicted_away_goals: 1,
    predicted_scorer_id: null,
    reasons: [],
    stakes: [],
    crowd: { home_pick_share: 0.71, total_picks: 3812 },
    label_text: "sample",
  },
};

describe("get_or_sample", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to sample data when the endpoint is not built yet (404 NOT_FOUND), warning once", async () => {
    mock_api({});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const first = await get_or_sample(
      "/games/g1/ai_prediction",
      ai_prediction_response_schema,
      "test_label",
      () => SAMPLE,
    );
    const second = await get_or_sample(
      "/games/g1/ai_prediction",
      ai_prediction_response_schema,
      "test_label",
      () => SAMPLE,
    );

    expect(first).toEqual(SAMPLE);
    expect(second).toEqual(SAMPLE);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("uses the real endpoint as soon as it exists", async () => {
    const real = { ...SAMPLE.data, home_win_probability: 0.55 };
    mock_api({ "/games/g1/ai_prediction": real });

    const response = await get_or_sample(
      "/games/g1/ai_prediction",
      ai_prediction_response_schema,
      "real_label",
      () => SAMPLE,
    );

    expect(response.data.home_win_probability).toBe(0.55);
  });

  it("does not hide real errors such as GAME_NOT_FOUND", async () => {
    stub_fetch(404, { error: { code: "GAME_NOT_FOUND", message: "Game g1 not found" } });

    await expect(
      get_or_sample(
        "/games/g1/ai_prediction",
        ai_prediction_response_schema,
        "error_label",
        () => SAMPLE,
      ),
    ).rejects.toMatchObject({ code: "GAME_NOT_FOUND", http_status: 404 });
  });
});

describe("api_get", () => {
  it("maps { error } to a typed ApiError", async () => {
    stub_fetch(400, { error: { code: "INVALID_DATE", message: "bad date" } });

    const error: unknown = await api_get("/game_days/x", game_detail_response_schema).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "INVALID_DATE", http_status: 400, message: "bad date" });
  });

  it("reports a network failure as NETWORK_ERROR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    );

    await expect(api_get("/health", game_detail_response_schema)).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });
});
