import { execFileSync } from "node:child_process";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// The whole demo flow: hub -> Before -> lock picks -> Live -> Final -> Leaderboard, once per
// project (mobile 390 x 844, desktop 1440 x 900). The demo replays a real finished game, so it
// works at any time of day. Screenshots go to e2e/screenshots/<project>/.

async function save_screenshot(page: Page, name: string): Promise<void> {
  // Let fonts and the timeline animation settle so screenshots are comparable.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  const project = test.info().project.name;
  await page.screenshot({ path: `e2e/screenshots/${project}/${name}.png`, fullPage: true });
}

async function open_hub(page: Page, moment: "before" | "live" | "final"): Promise<void> {
  await page.goto(`/?demo=1&moment=${moment}`);
  await expect(page.getByRole("heading", { name: "Today's games" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Before · 16:00/ })).toBeVisible();
}

function featured_card(page: Page) {
  return page.getByRole("link").filter({ hasText: "YOUR TEAM'S GAME" });
}

async function horizontal_overflow(page: Page): Promise<number> {
  await page.waitForLoadState("networkidle");
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
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
  await expect(featured_card(page)).toContainText(/Fans: \d+% .+|Be the first to pick/);
  await save_screenshot(page, "01_hub_before");

  // 2. Before the game: the AI preview, "Data says" and "In form"; never an AI pick.
  await featured_card(page).click();
  await expect(page).toHaveURL(/\/games\/.+demo=1&moment=before/);
  await expect(page.getByText("AI PREVIEW")).toBeVisible();
  await expect(page.getByText("Last meetings")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Data says" })).toBeVisible();
  await expect(page.getByText("In form").first()).toBeVisible();
  await expect(page.getByText(/AI pick|AI's pick/)).toHaveCount(0);
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
  await expect(page.getByText("AI SUMMARY")).toBeVisible();
  await expect(
    page.getByText(
      /Written with AI from Liiga data · checked by Kaleva|Automatic summary from Liiga data/,
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Report an error" }).first()).toBeVisible();
  const quiz_options = page.getByRole("group", { name: "Answer options" }).getByRole("button");
  await quiz_options.first().click();
  await expect(page.getByRole("status").filter({ hasText: /Correct|Not this time/ })).toBeVisible();
  await page
    .getByRole("group", { name: "Vote for the player of the game" })
    .getByRole("button")
    .first()
    .click();
  await save_screenshot(page, "04_after_game");

  // 5. Leaderboard. The back link reads "Game day" on mobile, "Today's games" on desktop.
  await page.getByRole("link", { name: /^(Game day|Today's games)$/ }).click();
  await page
    .getByRole("navigation", { name: "Main sections" })
    .getByRole("link", { name: "Leaders" })
    .click();
  await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
  await expect(page.getByText("You vs all fans")).toBeVisible();
  await expect(page.getByText("Kaleva AI")).toHaveCount(0);
  await save_screenshot(page, "05_leaderboard");
});

test("no horizontal scroll at 360, 900 and 1440 px on any screen", async ({ page }) => {
  // The widths are set here, so one project is enough.
  test.skip(test.info().project.name !== "mobile", "runs once, in the mobile project");
  for (const width of [360, 900, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    for (const moment of ["before", "live", "final"] as const) {
      await open_hub(page, moment);
      expect(
        await horizontal_overflow(page),
        `hub ${moment} at ${String(width)}`,
      ).toBeLessThanOrEqual(0);
      await featured_card(page).click();
      expect(
        await horizontal_overflow(page),
        `game screen ${moment} at ${String(width)}`,
      ).toBeLessThanOrEqual(0);
    }
    for (const path of ["/leaders?demo=1", "/elections", "/rooms"]) {
      await page.goto(path);
      expect(await horizontal_overflow(page), `${path} at ${String(width)}`).toBeLessThanOrEqual(0);
    }
    await page.goto("/elections");
    await page
      .getByRole("link", { name: /Demo election/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: /Who will get the most votes/ })).toBeVisible();
    expect(await horizontal_overflow(page), `election at ${String(width)}`).toBeLessThanOrEqual(0);
  }
});

test("first lock-in on a real game asks for a name and saves the pick", async ({
  page,
  request,
}) => {
  const response = await request.get("http://localhost:3000/api/v1/games?state=upcoming");
  const body = (await response.json()) as { data: { id: string; start_time: string }[] };
  const game = body.data.find((candidate) => new Date(candidate.start_time) > new Date());
  test.skip(game === undefined, "no upcoming real game in the next days");

  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(`/games/${game?.id ?? ""}`);
  await page.getByRole("group", { name: "Pick the winner" }).getByRole("button").first().click();
  await page.getByRole("button", { name: "Lock in my picks" }).click();

  const dialog = page.getByRole("dialog", { name: "What should we call you?" });
  await expect(dialog).toBeVisible();
  await save_screenshot(page, "06_name_dialog");
  await dialog.getByLabel("Display name").fill(`e2e ${test.info().project.name}`);
  await dialog.getByRole("button", { name: "Save and lock in" }).click();

  await expect(page.getByText(/Picks saved · edit until \d\d:\d\d/)).toBeVisible();
  // The pick comes back from the server after clearing it on this device.
  await page.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("voita_kaleva_picks_")) {
        window.localStorage.removeItem(key);
      }
    }
  });
  await page.reload();
  await expect(page.getByText(/Picks saved · edit until/)).toBeVisible();

  // Clean up: the test user and its pick are deleted again (GDPR delete).
  const token = await page.evaluate(() => window.localStorage.getItem("voita_kaleva_session"));
  const deleted = await request.delete("http://localhost:3000/api/v1/me", {
    headers: { Authorization: `Bearer ${JSON.parse(token ?? '""') as string}` },
  });
  expect(deleted.status()).toBe(204);
});

const API = "http://localhost:3000/api/v1";

async function featured_final_game(request: APIRequestContext) {
  const day = await request.get(`${API}/demo/game_day?moment=final`);
  const body = (await day.json()) as {
    data: {
      games: {
        id: string;
        featured: boolean;
        home_team: { name: string };
        away_team: { name: string };
      }[];
    };
  };
  return body.data.games.find((game) => game.featured);
}

test("an editor approves a yellow story and it appears on the After screen", async ({
  page,
  request,
}) => {
  // The editor page is desktop first: run it once, in the desktop project.
  test.skip(test.info().project.name !== "desktop", "runs once, in the desktop project");
  const game = await featured_final_game(request);
  const story_response = await request.get(`${API}/games/${game?.id ?? ""}/stories?type=summary`);
  const story = ((await story_response.json()) as { data: { id: string; body: string } | null })
    .data;
  test.skip(game === undefined || story === null, "the demo game has no published summary yet");

  // A reader report sends the summary back to yellow: it is hidden until an editor decides.
  const report = await request.post(`${API}/stories/${story?.id ?? ""}/reports`, {
    data: { reason: "e2e: please check the scorers" },
  });
  expect(report.status()).toBe(201);

  // A fresh device user, made an editor with the script.
  const signed_in = await request.post(`${API}/auth/device`, {
    data: { display_name: "e2e editor" },
  });
  const { data: auth } = (await signed_in.json()) as {
    data: { token: string; user: { id: string } };
  };
  execFileSync(
    "pnpm",
    ["--filter", "@voita_kone/api", "make:editor", "--", "--user_id", auth.user.id],
    {
      cwd: "../..",
      stdio: "ignore",
    },
  );

  await page.goto("/");
  await page.evaluate((token) => {
    window.localStorage.clear();
    window.localStorage.setItem("voita_kaleva_session", JSON.stringify(token));
  }, auth.token);
  await page.goto("/editor");
  const name = `${game?.home_team.name ?? ""} vs ${game?.away_team.name ?? ""} · summary`;
  await page.getByRole("button", { name }).first().click();
  await expect(page.getByText("e2e: please check the scorers").first()).toBeVisible();
  await save_screenshot(page, "07_editor");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByRole("status").first()).toBeVisible();

  await page.goto(`/games/${game?.id ?? ""}?demo=1&moment=final`);
  await expect(page.getByText("AI SUMMARY")).toBeVisible();
  await expect(page.getByText(story?.body.slice(0, 40) ?? "", { exact: false })).toBeVisible();

  // Clean up the e2e editor (GDPR delete).
  const deleted = await request.delete(`${API}/me`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  expect(deleted.status()).toBe(204);
});

// Step 7: 4 main menus, elections and the admin page.

test("bottom nav (mobile) and header (desktop) have the 4 main menus", async ({ page }) => {
  await page.goto("/games?demo=1&moment=before");
  // The other layout's nav is hidden with CSS, so only the visible one is found.
  const nav = page.getByRole("navigation", { name: "Main sections" });
  await expect(nav.getByRole("link")).toHaveText(["Games", "Elections", "Rooms", "Leaders"]);
  await expect(nav.getByRole("link", { name: "Games" })).toHaveAttribute("aria-current", "page");
  for (const link of await nav.getByRole("link").all()) {
    expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await nav.getByRole("link", { name: "Rooms" }).click();
  await expect(page.getByRole("heading", { name: "Join with a key" })).toBeVisible();
  await save_screenshot(page, "08_rooms");
  // Old links keep working.
  await page.goto("/leaderboard");
  await expect(page).toHaveURL(/\/leaders$/);
  await page.getByRole("tab", { name: "Elections" }).click();
  await expect(page.getByText("No prizes for election picks.")).toBeVisible();
  await save_screenshot(page, "12_leaders_elections");
});

test("elections: open the demo election, set a name, pick, see the result bars", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page
    .getByRole("navigation", { name: "Main sections" })
    .getByRole("link", { name: "Elections" })
    .click();
  await expect(page).toHaveURL(/\/elections$/);
  await expect(page.getByRole("button", { name: "Oulu" })).toHaveAttribute("aria-pressed", "true");
  const card = page.getByRole("link", { name: /Demo election/ }).first();
  await expect(card).toContainText("Demo");
  await save_screenshot(page, "09_elections_list");

  await card.click();
  await expect(
    page.getByRole("heading", { name: "Who will get the most votes in Oulu?" }),
  ).toBeVisible();
  await expect(
    page.getByText("Make your prediction to see what other users picked."),
  ).toBeVisible();
  await save_screenshot(page, "10_election_before_pick");

  const candidates = page.getByRole("list", { name: "Candidates, in random order" });
  await candidates
    .getByRole("button", { name: /^Pick / })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "What should we call you?" });
  await dialog.getByLabel("Display name").fill(`e2e voter ${test.info().project.name}`);
  await dialog.getByRole("button", { name: "Save and pick" }).click();

  await expect(candidates.getByRole("button", { pressed: true })).toHaveCount(1);
  await expect(candidates.getByLabel(/of picks \(\d+\)/)).toHaveCount(5);
  await expect(
    page.getByText("Not a scientific poll. Shows only the picks of Voita Kaleva users."),
  ).toBeVisible();
  await save_screenshot(page, "11_election_picked");

  // Clean up: the test user and its election pick are deleted again (GDPR delete).
  const token = await page.evaluate(() => window.localStorage.getItem("voita_kaleva_session"));
  const deleted = await request.delete(`${API}/me`, {
    headers: { Authorization: `Bearer ${JSON.parse(token ?? '""') as string}` },
  });
  expect(deleted.status()).toBe(204);
});

test("an admin creates an election with 2 candidates, publishes it, and users see it", async ({
  page,
  request,
}) => {
  const signed_in = await request.post(`${API}/auth/device`, {
    data: { display_name: "e2e admin" },
  });
  const { data: auth } = (await signed_in.json()) as {
    data: { token: string; user: { id: string } };
  };
  execFileSync(
    "pnpm",
    ["--filter", "@voita_kone/api", "make:admin", "--", "--user_id", auth.user.id],
    { cwd: "../..", stdio: "ignore" },
  );
  await page.goto("/");
  await page.evaluate((token) => {
    window.localStorage.clear();
    window.localStorage.setItem("voita_kaleva_session", JSON.stringify(token));
  }, auth.token);

  const title = `E2E election ${test.info().project.name}`;
  await page.goto("/admin");
  await page.getByRole("button", { name: "New election" }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Area name").fill("E2E Testila");
  // Demo, so the cleanup below removes it again.
  await page.getByLabel("Demo election (shows a Demo badge)").check();
  await page.getByRole("button", { name: "Create election" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");

  // Fictional candidates only.
  for (const [index, name] of ["Testi Ehdokas", "Malli Henkilö"].entries()) {
    const form = page.getByRole("form", { name: "Add candidate" });
    await form.getByLabel("Full name").fill(name);
    await form.getByLabel(/Short bio/).fill("Fictional e2e candidate.");
    await form.getByRole("button", { name: "Add candidate" }).click();
    await expect(page.getByRole("form", { name: /^Candidate \d$/ })).toHaveCount(index + 1);
  }
  await expect(page.getByRole("form", { name: /^Candidate \d$/ })).toHaveCount(2);

  await page.getByRole("button", { name: "Preview user view" }).click();
  const preview = page.getByRole("region", { name: "Preview user view" });
  await expect(
    preview.getByRole("heading", { name: "Who will get the most votes in E2E Testila?" }),
  ).toBeVisible();
  await expect(preview.getByRole("button", { name: /^Pick / })).toHaveCount(2);
  await save_screenshot(page, "13_admin_preview");

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("button", { name: "Close predictions" })).toBeVisible();

  await page.goto("/elections");
  await page.getByRole("button", { name: "E2E Testila" }).click();
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();

  // Clean up: demo elections are recreated (only the seeded demo election stays), admin deleted.
  execFileSync("pnpm", ["--filter", "@voita_kone/api", "elections:seed_demo"], {
    cwd: "../..",
    stdio: "ignore",
  });
  const deleted = await request.delete(`${API}/me`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  expect(deleted.status()).toBe(204);
});
