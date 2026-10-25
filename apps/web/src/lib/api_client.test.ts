import {
  data_says_response_schema,
  game_detail_response_schema,
  health_response_schema,
} from "@voita_kone/shared_types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock_api } from "../test_helpers/mock_api";
import { ApiError, api_get, get_or_sample } from "./api_client";
import { read_session_token, save_session_token } from "./session";

function stub_fetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status }))),
  );
}

const SAMPLE = {
  data: {
    game_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    home_win_probability: 0.62,
    away_win_probability: 0.38,
    overtime_probability: 0.17,
    stakes: [],
    crowd: {
      total_picks: 100,
      home_picks: 71,
      away_picks: 29,
      draw_picks: 0,
      home_pick_share: 0.71,
    },
    label_text: "sample",
    model_version: "sample",
    calculated_at: "2026-10-24T13:05:00.000Z",
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
      "/games/g1/data_says",
      data_says_response_schema,
      "test_label",
      () => SAMPLE,
    );
    const second = await get_or_sample(
      "/games/g1/data_says",
      data_says_response_schema,
      "test_label",
      () => SAMPLE,
    );

    expect(first).toEqual(SAMPLE);
    expect(second).toEqual(SAMPLE);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("uses the real endpoint as soon as it exists", async () => {
    const real = { ...SAMPLE.data, home_win_probability: 0.55 };
    mock_api({ "/games/g1/data_says": real });

    const response = await get_or_sample(
      "/games/g1/data_says",
      data_says_response_schema,
      "real_label",
      () => SAMPLE,
    );

    expect(response.data.home_win_probability).toBe(0.55);
  });

  it("falls back to sample data when the endpoint fails (5xx or network)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    stub_fetch(500, { error: { code: "INTERNAL_ERROR", message: "boom" } });

    const response = await get_or_sample(
      "/games/g1/data_says",
      data_says_response_schema,
      "failing_label",
      () => SAMPLE,
    );

    expect(response).toEqual(SAMPLE);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("failed"));
  });

  it("passes on known answers such as PREDICTION_NOT_READY", async () => {
    stub_fetch(404, { error: { code: "PREDICTION_NOT_READY", message: "not yet" } });

    await expect(
      get_or_sample(
        "/games/g1/data_says",
        data_says_response_schema,
        "not_ready_label",
        () => SAMPLE,
      ),
    ).rejects.toMatchObject({ code: "PREDICTION_NOT_READY" });
  });

  it("does not hide real errors such as GAME_NOT_FOUND", async () => {
    stub_fetch(404, { error: { code: "GAME_NOT_FOUND", message: "Game g1 not found" } });

    await expect(
      get_or_sample("/games/g1/data_says", data_says_response_schema, "error_label", () => SAMPLE),
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

describe("api_request with a session", () => {
  it("sends the token as a Bearer header", async () => {
    save_session_token("abc");
    const api = mock_api({
      "/health": { status: "ok", database: "ok", time: "2026-10-24T12:00:00.000Z" },
    });

    await api_get("/health", health_response_schema);

    expect(api.requests[0]?.authorization).toBe("Bearer abc");
  });

  it("clears a token the server rejects and tries a GET once more without it", async () => {
    save_session_token("expired");
    const fetch_mock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const has_token = new Headers(init?.headers).has("authorization");
      return Promise.resolve(
        new Response(
          JSON.stringify(
            has_token
              ? { error: { code: "UNAUTHORIZED", message: "Sign in to do this" } }
              : { data: { status: "ok", database: "ok", time: "2026-10-24T12:00:00.000Z" } },
          ),
          { status: has_token ? 401 : 200 },
        ),
      );
    });
    vi.stubGlobal("fetch", fetch_mock);

    const response = await api_get("/health", health_response_schema);

    expect(response.data.status).toBe("ok");
    expect(fetch_mock).toHaveBeenCalledTimes(2);
    expect(read_session_token()).toBeNull();
  });
});
