import { describe, expect, it } from "vitest";
import { find_api_base_url_problem } from "./build_env";

describe("find_api_base_url_problem", () => {
  it("accepts an https API URL and a local http one", () => {
    expect(find_api_base_url_problem("https://voita-api.onrender.com/api/v1")).toBeNull();
    expect(find_api_base_url_problem("http://localhost:3000/api/v1")).toBeNull();
  });

  it("fails when the URL is missing or empty", () => {
    expect(find_api_base_url_problem(undefined)).toMatch(/not set/);
    expect(find_api_base_url_problem("  ")).toMatch(/not set/);
  });

  it("fails for an invalid URL or plain http to a remote host", () => {
    expect(find_api_base_url_problem("voita-api.onrender.com")).toMatch(/not a valid URL/);
    expect(find_api_base_url_problem("http://voita-api.onrender.com/api/v1")).toMatch(/https/);
  });
});
