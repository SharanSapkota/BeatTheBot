import { expect, test, type Page } from "@playwright/test";

// The whole demo flow on a 390 x 844 phone: hub -> Before -> lock picks -> Live -> Final
// -> Leaderboard. The demo replays a real finished game, so it works at any time of day.

const SCREENSHOT_DIR = "e2e/screenshots";

async function save_screenshot(page: Page, name: string): Promise<void> {
  // Let fonts and the timeline animation settle so screenshots are comparable.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: true });
}

async function open_hub(page: Page, moment: "before" | "live" | "final"): Promise<void> {
  await page.goto(`/?demo=1&moment=${moment}`);
  await expect(page.getByRole("heading", { name: "Today's games" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Before · 16:00/ })).toBeVisible();
}

function featured_card(page: Page) {
  return page.getByRole("link").filter({ hasText: "YOUR TEAM'S GAME" });
}

test.describe.configure({ mode: "serial" });

test("demo flow: hub, before, live, final, leaderboard", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());

  // 1. Hub before the games.
  await open_hub(page, "before");
  await expect(page.getByRole("button", { name: "Before · 16:00" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("Demo replay")).toBeVisible();
  await expect(featured_card(page)).toContainText("Make your picks");
  await expect(featured_card(page)).toContainText(/AI's pick: .+ win · \d+%/);
  await save_screenshot(page, "01_hub_before");

  // 2. Before the game: the AI pick card.
  await featured_card(page).click();
  await expect(page).toHaveURL(/\/games\/.+demo=1&moment=before/);
  await expect(page.getByText("KALEVA AI'S PICK")).toBeVisible();
  await expect(page.getByText("Why the AI thinks so")).toBeVisible();
  await expect(page.getByRole("timer")).toContainText(/Picks lock in \d\d:\d\d:\d\d/);
  await save_screenshot(page, "02_before_game");

  // Lock in picks: winner, score, scorer.
  const winner_group = page.getByRole("group", { name: "Pick the winner" });
  await winner_group.getByRole("button").first().click();
  await expect(winner_group.getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: /one goal less/ })
    .first()
    .click();
  const scorers = page.getByRole("group", { name: "Pick a goal scorer" }).getByRole("button");
  await scorers.first().click();
  await page.getByRole("button", { name: "Lock in my picks" }).click();
  await expect(page.getByText(/Picks saved · edit until \d\d:\d\d/)).toBeVisible();
  await save_screenshot(page, "02_before_game_locked");

  // The saved state survives a reload (localStorage).
  await page.reload();
  await expect(page.getByText(/Picks saved · edit until/)).toBeVisible();

  // 3. Live.
  await open_hub(page, "live");
  await expect(featured_card(page)).toContainText("Make live picks");
  await save_screenshot(page, "01_hub_live");
  await featured_card(page).click();
  await expect(page.getByRole("heading", { name: "Who scores the next goal?" })).toBeVisible();
  await expect(page.getByText(/LIVE · 2nd period \d\d:\d\d/)).toBeVisible();
  await page
    .getByRole("group", { name: "Pick who scores the next goal" })
    .getByRole("button")
    .first()
    .click();
  await page
    .getByRole("group", { name: "Pick yes or no" })
    .getByRole("button", { name: "Yes" })
    .click();
  await expect(page.getByRole("heading", { name: "Game events" })).toBeVisible();
  await save_screenshot(page, "03_during_game");

  // 4. Final.
  await open_hub(page, "final");
  await expect(featured_card(page)).toContainText("See result and highlight");
  await save_screenshot(page, "01_hub_final");
  await featured_card(page).click();
  await expect(page.getByText("TONIGHT'S RESULT")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your points" })).toBeVisible();
  await expect(page.getByText("WHAT IT MEANS")).toBeVisible();
  const quiz_options = page.getByRole("group", { name: "Answer options" }).getByRole("button");
  await quiz_options.first().click();
  await expect(page.getByRole("status").filter({ hasText: /Correct|Not this time/ })).toBeVisible();
  await page
    .getByRole("group", { name: "Vote for the player of the game" })
    .getByRole("button")
    .first()
    .click();
  await save_screenshot(page, "04_after_game");

  // 5. Leaderboard.
  await page.getByRole("link", { name: "Game day" }).click();
  await page
    .getByRole("navigation", { name: "Main sections" })
    .getByRole("link", { name: "Leaders" })
    .click();
  await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
  await expect(page.getByText("Humans vs the machine")).toBeVisible();
  await expect(page.getByText("Kaleva AI").last()).toBeVisible();
  await save_screenshot(page, "05_leaderboard");
});

test("no horizontal scroll at 360 px on any screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  for (const moment of ["before", "live", "final"] as const) {
    await open_hub(page, moment);
    await featured_card(page).click();
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `game screen at ${moment}`).toBeLessThanOrEqual(0);
  }
  await page.goto("/leaderboard?demo=1");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
