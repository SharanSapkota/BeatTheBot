import { execFileSync } from "node:child_process";
import { expect, test, type Browser, type Page } from "@playwright/test";

// Rooms (step 9), once per project (mobile 390 x 844, desktop 1440 x 900): user A creates a room
// and copies the key; user B (a second browser context) joins with it; both answer; the reveal
// shows; B reacts 🔥; the scoreboard shows both. Instead of waiting a whole minute, the dev-only
// script rooms:advance_slot moves the room one slot ahead (a fake clock for this room).
// Screenshots go to e2e/screenshots/<project>/.

const API = "http://localhost:3000/api/v1";

async function save_screenshot(page: Page, name: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  const project = test.info().project.name;
  await page.screenshot({ path: `e2e/screenshots/${project}/${name}.png`, fullPage: true });
}

async function new_user_page(browser: Browser, page: Page): Promise<Page> {
  const context = await browser.newContext({
    baseURL: "http://localhost:5173",
    viewport: page.viewportSize(),
    deviceScaleFactor: test.info().project.name === "mobile" ? 2 : 1,
    locale: "en-GB",
    timezoneId: "Europe/Helsinki",
  });
  return context.newPage();
}

async function set_name(page: Page, button: string, name: string): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "What should we call you?" });
  await dialog.getByLabel("Display name").fill(name);
  await dialog.getByRole("button", { name: button }).click();
}

async function delete_account(page: Page): Promise<void> {
  const token = await page.evaluate(() => window.localStorage.getItem("voita_kaleva_session"));
  const response = await page.request.delete(`${API}/me`, {
    headers: { Authorization: `Bearer ${JSON.parse(token ?? '""') as string}` },
  });
  expect(response.status()).toBe(204);
}

/** Mobile shows one tab at a time; desktop shows the scoreboard in the sidebar. */
async function open_tab(page: Page, name: "Question" | "Scoreboard" | "Members"): Promise<void> {
  if (test.info().project.name === "mobile") {
    await page.getByRole("tab", { name }).click();
  }
}

test("rooms: create, join with the key, answer, reveal, react, scoreboard", async ({
  page,
  browser,
  context,
}) => {
  const project = test.info().project.name;
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  // A creates a room.
  await page.goto("/rooms");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Create a room" }).click();
  await expect(page).toHaveURL(/\/rooms\/new$/);
  await page.getByLabel(/Room name/).fill(`e2e room ${project}`);
  await page
    .getByRole("group", { name: "New question every" })
    .getByRole("button", { name: "1 min" })
    .click();
  await page.getByRole("button", { name: "Create the room" }).click();
  await set_name(page, "Save and create", `e2e owner ${project}`);

  await expect(page.getByRole("heading", { name: "Your room is ready" })).toBeVisible();
  const key = (await page.getByTestId("join_key").textContent()) ?? "";
  expect(key).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  await expect(page.getByRole("img", { name: "QR code of the join link" })).toBeVisible();
  await page.getByRole("button", { name: "Copy key" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(key);
  await save_screenshot(page, "30_room_created");

  await page.getByRole("button", { name: "Open the room" }).click();
  await expect(page).toHaveURL(/\/rooms\/[0-9a-f-]{36}$/);
  const room_id = page.url().split("/").pop() ?? "";

  // B joins with the key in a second browser.
  const other = await new_user_page(browser, page);
  await other.goto("/rooms");
  await other.getByLabel("Key character 1 of 6").fill(key.toLowerCase());
  await other.getByRole("button", { name: "Join" }).click();
  await set_name(other, "Save and join", `e2e fan ${project}`);
  await expect(other).toHaveURL(new RegExp(`/rooms/${room_id}$`));
  await expect(other.getByText("2 members").first()).toBeVisible();

  // Both answer the open question.
  const question_text = (await page.getByTestId("room_prompt").textContent()) ?? "";
  expect(question_text.length).toBeGreaterThan(0);
  for (const user_page of [page, other]) {
    await expect(user_page.getByRole("timer")).toContainText(/Reveal in \d:\d\d/);
    await user_page.getByRole("group", { name: "Your answer" }).getByRole("button").first().click();
    await expect(user_page.getByText("Waiting for the reveal")).toBeVisible();
  }
  await expect(page.getByText("2 of 2 answered")).toBeVisible({ timeout: 10_000 });
  await save_screenshot(page, "31_room_waiting");

  // The slot ends (fake clock): the reveal shows within one poll (5 s).
  execFileSync(
    "pnpm",
    ["--filter", "@voita_kone/api", "rooms:advance_slot", "--", "--room_id", room_id],
    { cwd: "../..", stdio: "ignore" },
  );
  const revealed = other.getByRole("article", { name: question_text });
  await expect(revealed).toBeVisible({ timeout: 15_000 });
  await expect(revealed.getByText("2 answers", { exact: false })).toBeVisible();
  await expect(
    revealed.getByText(/Right! \+3 pts|Wrong this time|\+1 pt for answering/),
  ).toBeVisible();

  // B reacts 🔥.
  await revealed.getByRole("button", { name: /React 🔥/ }).click();
  await expect(revealed.getByRole("button", { name: "React 🔥 (1)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await save_screenshot(other, "32_room_revealed");

  // The scoreboard lists both, B highlighted.
  await open_tab(other, "Scoreboard");
  const board = other.getByRole("list", { name: "Scoreboard" });
  await expect(board.getByText(`e2e owner ${project}`)).toBeVisible();
  await expect(board.getByText(`e2e fan ${project}`)).toBeVisible();
  await expect(board.getByText("YOU")).toBeVisible();
  await save_screenshot(other, "33_room_scoreboard");

  // A sees the reaction too.
  await expect(
    page
      .getByRole("article", { name: question_text })
      .getByRole("button", { name: "React 🔥 (1)" }),
  ).toBeVisible({ timeout: 10_000 });

  // No horizontal scroll on the room page.
  const overflow = await other.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // Clean up: deleting both users removes their room, answers and reactions (GDPR delete).
  await delete_account(other);
  await delete_account(page);
  await other.context().close();
});

test("rooms: the demo room DEMO26 has a full scoreboard", async ({ page }) => {
  await page.goto("/rooms/join/DEMO26");
  await set_name(page, "Save and join", `e2e demo ${test.info().project.name}`);
  await expect(page.getByRole("heading", { name: "Kärpät fans Oulu" })).toBeVisible();
  await open_tab(page, "Scoreboard");
  await page.getByRole("tab", { name: "All time" }).click();
  const board = page.getByRole("list", { name: "Scoreboard" });
  await expect(board.getByRole("listitem")).toHaveCount(9);
  await expect(board.getByText("Kärppä-Kalle")).toBeVisible();
  await save_screenshot(page, "34_demo_room");
  await delete_account(page);
});
