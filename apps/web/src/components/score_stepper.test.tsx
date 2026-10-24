import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ScoreStepper } from "./score_stepper";

function Stepper({ start }: { start: number }) {
  const [value, set_value] = useState(start);
  return <ScoreStepper team_name="Kärpät" value={value} on_change={set_value} />;
}

describe("ScoreStepper", () => {
  it("stays between 0 and 9", () => {
    render(<Stepper start={8} />);
    const more = screen.getByRole("button", { name: "Kärpät one goal more" });
    const less = screen.getByRole("button", { name: "Kärpät one goal less" });

    fireEvent.click(more);
    expect(screen.getByLabelText("Kärpät goals")).toHaveTextContent("9");
    expect(more).toBeDisabled();

    for (let step = 0; step < 12; step += 1) {
      fireEvent.click(less);
    }
    expect(screen.getByLabelText("Kärpät goals")).toHaveTextContent("0");
    expect(less).toBeDisabled();
  });
});
