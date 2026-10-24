import { describe, expect, it } from "vitest";
import { find_escalation_words, find_strong_words } from "./escalation";

describe("escalation words", () => {
  it("finds injury, discipline and minor words in English and Finnish", () => {
    expect(find_escalation_words("Laine was injured in the 2nd period.")).toEqual(["injur"]);
    expect(find_escalation_words("Mäkelä sai ottelurangaistuksen.")).toEqual(["ottelurangaist"]);
    expect(find_escalation_words("A calm win.")).toEqual([]);
  });

  it("flags strong opinion words that the checker can't test", () => {
    expect(find_strong_words("A dominant win ends the crisis.")).toEqual(["dominant", "crisis"]);
    expect(find_strong_words("Kärpät beat Ilves.")).toEqual([]);
  });
});
