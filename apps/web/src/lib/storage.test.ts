import { describe, expect, it } from "vitest";
import { z } from "zod";
import { read_session_token } from "./session";
import { read_stored } from "./storage";

describe("legacy storage keys", () => {
  it("moves the old voita_kone_session token once, so the user stays signed in", () => {
    window.localStorage.setItem("voita_kone_session", JSON.stringify("old-token"));

    expect(read_session_token()).toBe("old-token");
    expect(window.localStorage.getItem("voita_kaleva_session")).toBe(JSON.stringify("old-token"));
    expect(window.localStorage.getItem("voita_kone_session")).toBeNull();
  });

  it("keeps a newer value when both keys exist", () => {
    window.localStorage.setItem("voita_kone_picks_g1", JSON.stringify("old"));
    window.localStorage.setItem("voita_kaleva_picks_g1", JSON.stringify("new"));

    expect(read_stored("picks_g1", z.string())).toBe("new");
    expect(window.localStorage.getItem("voita_kone_picks_g1")).toBeNull();
  });
});
