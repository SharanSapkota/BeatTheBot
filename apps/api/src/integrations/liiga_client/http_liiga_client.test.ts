import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../common/app_error";
import { HttpLiigaClient } from "./http_liiga_client";

const BASE_URL = "https://liiga.example/stats";

function json_response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function create_client(api_key: string, response: Response | Error) {
  const fetch_fn = vi.fn<typeof fetch>(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  const client = new HttpLiigaClient({ base_url: `${BASE_URL}/`, api_key, fetch_fn });
  return { client, fetch_fn };
}

function first_call(fetch_fn: ReturnType<typeof vi.fn<typeof fetch>>) {
  const [url, init] = fetch_fn.mock.calls[0] ?? [];
  return { url: String(url), headers: (init?.headers ?? {}) as Record<string, string> };
}

describe("HttpLiigaClient", () => {
  it("builds the URL with season and serie", async () => {
    const { client, fetch_fn } = create_client("", json_response({ games: [] }));

    await client.get_games(2027);

    expect(first_call(fetch_fn).url).toBe(`${BASE_URL}/api/v1/games?season=2027&serie=runkosarja`);
  });

  it("sends the API key header only when a key is set", async () => {
    const with_key = create_client("secret", json_response({ season: 2027 }));
    const without_key = create_client("", json_response({ season: 2027 }));

    await with_key.client.get_tournament();
    await without_key.client.get_tournament();

    expect(first_call(with_key.fetch_fn).headers["x-api-key"]).toBe("secret");
    expect(first_call(without_key.fetch_fn).headers).not.toHaveProperty("x-api-key");
  });

  it("returns the parsed list", async () => {
    const team = { id: "55786244:hpk", nameAbbreviation: "HPK" };
    const { client } = create_client("", json_response({ teams: [team], extra: true }));

    await expect(client.get_teams(2027)).resolves.toEqual([team]);
  });

  it("throws LIIGA_API_ERROR on a non-2xx answer", async () => {
    const { client } = create_client("", json_response({}, 500));

    await expect(client.get_tournament()).rejects.toMatchObject({
      code: "LIIGA_API_ERROR",
      http_status: 502,
    });
  });

  it("throws LIIGA_API_INVALID_RESPONSE on an unexpected shape", async () => {
    const { client } = create_client("", json_response({ teams: "nope" }));

    await expect(client.get_teams(2027)).rejects.toMatchObject({
      code: "LIIGA_API_INVALID_RESPONSE",
    });
  });

  it("throws LIIGA_API_UNAVAILABLE when the request fails, without the key in the message", async () => {
    const { client } = create_client("secret", new Error("getaddrinfo ENOTFOUND"));

    const error: unknown = await client.get_tournament().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: "LIIGA_API_UNAVAILABLE", http_status: 503 });
    expect((error as AppError).message).not.toContain("secret");
  });
});
