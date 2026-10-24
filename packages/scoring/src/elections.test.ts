import { describe, expect, it } from "vitest";
import { ELECTION_POINTS, score_election_pick } from "./elections";

describe("score_election_pick", () => {
  it("gives 20 points for the winner", () => {
    expect(ELECTION_POINTS).toBe(20);
    expect(score_election_pick("aino", "aino")).toBe(20);
  });

  it("gives 0 points for any other candidate", () => {
    expect(score_election_pick("veikko", "aino")).toBe(0);
  });

  it("gives the same points when scored again", () => {
    const first = score_election_pick("aino", "aino");
    expect(score_election_pick("aino", "aino")).toBe(first);
  });
});
