import { describe, expect, it } from "vitest";
import { order_candidates, order_seed } from "./candidate_order";

const CANDIDATES = ["a", "b", "c", "d", "e"];
const ELECTION_ID = "e0000000-0000-4000-8000-000000000001";

function user_id(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

describe("order_candidates", () => {
  it("keeps every candidate exactly once", () => {
    const ordered = order_candidates(CANDIDATES, order_seed(user_id(1), ELECTION_ID));
    expect([...ordered].sort()).toEqual(CANDIDATES);
  });

  it("gives a user the same order every time", () => {
    const seed = order_seed(user_id(1), ELECTION_ID);
    expect(order_candidates(CANDIDATES, seed)).toEqual(order_candidates(CANDIDATES, seed));
  });

  it("gives different users different orders", () => {
    const orders = new Set(
      Array.from({ length: 20 }, (_, index) =>
        order_candidates(CANDIDATES, order_seed(user_id(index), ELECTION_ID)).join(""),
      ),
    );
    expect(orders.size).toBeGreaterThan(10);
  });

  it("puts every candidate first for some users (no fixed top spot)", () => {
    const firsts = new Set(
      Array.from(
        { length: 200 },
        (_, index) => order_candidates(CANDIDATES, order_seed(user_id(index), ELECTION_ID))[0],
      ),
    );
    expect([...firsts].sort()).toEqual(CANDIDATES);
  });

  it("orders one user's elections independently", () => {
    const other_election = "e0000000-0000-4000-8000-000000000002";
    const orders = new Set(
      Array.from({ length: 10 }, (_, index) =>
        order_candidates(
          CANDIDATES,
          order_seed(user_id(index), index % 2 === 0 ? ELECTION_ID : other_election),
        ).join(""),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("uses a new random seed for each anonymous visit", () => {
    expect(order_seed(null, ELECTION_ID)).not.toBe(order_seed(null, ELECTION_ID));
  });

  it("does not change the input list", () => {
    const input = [...CANDIDATES];
    order_candidates(input, "seed");
    expect(input).toEqual(CANDIDATES);
  });
});
