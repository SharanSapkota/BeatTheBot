import { describe, expect, it } from "vitest";
import { find_unknown_fact_ids, strip_fact_ids } from "./fact_ids";
import { SHEET } from "./test_sheet";

describe("fact ids", () => {
  const text = "Kärpät beat Ilves 3–1 [f1]. Laine scored twice [f2, f4].\nNext: Jukurit [f7] [f9].";

  it("finds cited ids that are not in the sheet", () => {
    expect(find_unknown_fact_ids(text, SHEET)).toEqual(["f9"]);
  });

  it("removes the ids before publishing", () => {
    expect(strip_fact_ids(text)).toBe("Kärpät beat Ilves 3–1. Laine scored twice.\nNext: Jukurit.");
  });
});
