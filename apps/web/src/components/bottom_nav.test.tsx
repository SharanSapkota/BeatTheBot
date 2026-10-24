import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render_at } from "../test_helpers/render_app";
import { BottomNav } from "./bottom_nav";

describe("BottomNav", () => {
  it("has the 4 main menus and marks the current one", () => {
    render_at(<BottomNav />, { url: "/elections/abc", path: "/elections/:id" });
    const nav = screen.getByRole("navigation", { name: "Main sections" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Games",
      "Elections",
      "Rooms",
      "Leaders",
    ]);
    expect(within(nav).getByRole("link", { name: "Elections" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps demo mode in the links", () => {
    render_at(<BottomNav />, { url: "/games?demo=1&moment=live", path: "/games" });
    expect(screen.getByRole("link", { name: "Leaders" })).toHaveAttribute(
      "href",
      "/leaders?demo=1&moment=live",
    );
  });
});
