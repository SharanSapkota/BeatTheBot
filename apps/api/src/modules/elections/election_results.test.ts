import { describe, expect, it } from "vitest";
import { build_shares, results_hidden_reason } from "./election_results";

describe("results_hidden_reason", () => {
  it("hides the results until the user has picked while the poll is open", () => {
    expect(
      results_hidden_reason({ has_picked: false, is_poll_closed: false, total_picks: 50 }),
    ).toBe("pick_first");
  });

  it("shows the results after a pick with at least 20 picks", () => {
    expect(
      results_hidden_reason({ has_picked: true, is_poll_closed: false, total_picks: 20 }),
    ).toBeNull();
  });

  it("hides the results below 20 picks, even after a pick", () => {
    expect(
      results_hidden_reason({ has_picked: true, is_poll_closed: false, total_picks: 19 }),
    ).toBe("not_enough_picks");
  });

  it("shows the results to everyone once the poll closed", () => {
    expect(
      results_hidden_reason({ has_picked: false, is_poll_closed: true, total_picks: 30 }),
    ).toBeNull();
    expect(results_hidden_reason({ has_picked: false, is_poll_closed: true, total_picks: 5 })).toBe(
      "not_enough_picks",
    );
  });
});

describe("build_shares", () => {
  it("keeps the given order and fills candidates without picks with 0", () => {
    const shares = build_shares(
      ["c", "a", "b"],
      new Map([
        ["a", 3],
        ["b", 1],
      ]),
    );
    expect(shares).toEqual([
      { candidate_id: "c", picks: 0, share: 0 },
      { candidate_id: "a", picks: 3, share: 0.75 },
      { candidate_id: "b", picks: 1, share: 0.25 },
    ]);
  });

  it("gives 0 shares without picks", () => {
    expect(build_shares(["a"], new Map())).toEqual([{ candidate_id: "a", picks: 0, share: 0 }]);
  });
});
