# Design reference: Voita kone PWA, Kaleva theme

The app uses Kaleva's look (colors and type sampled from kaleva.fi). Two layouts:
- **Mobile (< 900 px):** the phone screens `01`–`05`. App-like: dark header, cards, bottom nav.
- **Desktop (≥ 900 px):** Kaleva website style `10`–`11`. White page, big uppercase titles, section titles with an orange bar, main column + sidebar, thin gray dividers, gray uppercase category labels.

- `screens/`: renders of every screen and state. Mobile images are 2× (780 px image = 390 px CSS); desktop images are 1× at 1440 px.
- `source/`: the exact design source (HTML with inline styles) for exact colors, sizes, spacing and copy. Ignore the design tool's template syntax (`<x-dc>`, `<sc-for>`, `<sc-if>`, `{{ }}`, `class Component`).

| Screen | Mobile | Desktop |
|---|---|---|
| Game day hub (Before / Live / Final moments) | `01_hub_before.png`, `01_hub_live.png`, `01_hub_final.png` (`Main.dc.html`) | `10_desktop_hub.png` (`DesktopHub.dc.html`) |
| Before the game (+ picks saved) | `02_before_game.png`, `02_before_game_locked.png` (`Before.dc.html`) | `11_desktop_before_game.png` (`DesktopGame.dc.html`) |
| During the game | `03_during_game.png` (`Live.dc.html`) | follow the desktop rules below |
| After the game | `04_after_game.png` (`After.dc.html`) | follow the desktop rules below |
| Leaderboard | `05_leaderboard.png` (`Leaderboard.dc.html`) | follow the desktop rules below |

## Kaleva theme tokens

| Token | Value | Use |
|---|---|---|
| `--color_ink` | `#000000` | Headlines, main text (Kaleva uses pure black) |
| `--color_dark` | `#111111` | Dark headers, hero panels, dark cards |
| `--color_dark_2` | `#2B2B2B` | Pills on dark, thumbnails |
| `--color_dark_line` | `#4D4D4D` | Lines on dark |
| `--color_page` | `#F3F3F3` | Mobile page background, Kaleva gray panel |
| `--color_card` | `#FFFFFF` | Cards, desktop page background |
| `--color_line` | `#D9D9D9` | Dividers, card borders (Kaleva divider) |
| `--color_text_soft` | `#3A3A3A` | Secondary text |
| `--color_label` | `#767676` | Category labels (uppercase, bold), meta text (Kaleva gray) |
| `--color_on_dark_soft` | `#BDBDBD` / `#DDDDDD` | Secondary text on dark |
| `--color_brand` (Kaleva orange) | `#F09247` | Section bars, primary buttons (DARK text on it), "You" bars, points on dark |
| `--color_brand_text` | `#B4530F` | Orange TEXT on white (points like +10). Never put orange #F09247 text on white (too low contrast). |
| `--color_brand_tint` | `#FFF4EC` / `#FEF3EA` | Selected row background |
| `--color_tag` | `#757575` | Category tag background with white uppercase text ("HOCKEY · LIIGA") |
| `--color_ai` | `#1D5FD1` | Kaleva AI (bars, AI pick label, links in cards) |
| `--color_ai_tint` | `#E8F0FC` | AI chip |
| `--color_fans` | `#8C8C8C` | All fans |
| `--color_live` | `#C8102E` | LIVE pill (white text) |
| `--color_good` / tint | `#15803D` / `#EAF6EE` | Correct, win |
| `--color_bad` / tint | `#B42318` / `#FDECEC` | Wrong, loss |
| Team Kärpät | bg `#111111`, ring/text `#FFD200` | Badge |
| Team Ilves | bg `#0F6B3A`, text `#FFFFFF` | Badge |
| Other teams | bg `#D9D9D9` (on light) or `#F3F3F3` (on dark), dark text | Neutral badge with short code |

Meaning stays the same everywhere: **You = orange, AI = blue, all fans = gray.**
Primary buttons: orange `#F09247` background with **dark `#111111` text**.

## Type (Kaleva style)

- **Barlow Condensed** 700/800: big titles in UPPERCASE ("BEAT THE AI", "TODAY'S GAMES", "KALEVA AI'S PICK"), scores, points, numbers.
- **Barlow Semi Condensed** 300–700: everything else. Headlines in lists and cards 700. The intro line under a page title is 300 (light), like kaleva.fi.
- Self-host both with `@fontsource` (offline PWA). If Kaleva provides its own font files later, only the font tokens change.
- Desktop sizes (px): page title 72 · section title 30 uppercase · hero team names 34–48 · list headline 22 · intro 26 light · body 20–21 · meta 17 · category label 15 bold uppercase gray · small print 14.
- Mobile sizes (px): as in the mobile sources (56 big score · 26 section title uppercase · 17 card titles · 14–16 body · 12–13 labels).

## Kaleva section title (use on both layouts)

Title in Barlow Condensed 800 uppercase, followed on the same line by an orange bar that fills the rest of the width (8 px high on desktop, 6 px on mobile). Optional gray uppercase meta line below.

## Desktop rules (≥ 900 px)

- White page, content max-width 1320 px, side padding 24 px. Header: wordmark left, nav center (GAMES / LEADERS in Barlow Condensed with a 4 px orange underline on the active item), points pill right. Thin `#D9D9D9` bottom border.
- Page title centered (72 px uppercase) + light intro line, like kaleva.fi.
- Layout: main column (about 2/3) + sidebar (about 1/3, min 380 px), 40–48 px gap. Sidebar sections use the Kaleva section title.
- Lists like kaleva.fi: square dark thumbnail (team badges) + bold headline + line of detail + gray uppercase category label, separated by 1 px `#D9D9D9` lines.
- Hero: big dark panel (`#111111`) with the game, then a gray `#F3F3F3` panel with a gray category tag and a bold headline (like kaleva.fi's big image + caption box).
- Game screens: dark full-width game header band; the main column holds the content (AI pick, stakes, live chart, events, story, highlight); the sidebar holds the user's actions (YOUR PICKS, LIVE PICKS, YOUR POINTS + quiz, or the user's rank).
  - During the game: main = score band + AI win-chance chart + events; sidebar = LIVE PICKS (next goal, period goal) + fan poll.
  - After the game: main = highlight (large) + WHAT IT MEANS story + goal timeline; sidebar = YOU vs AI result + POINTS breakdown + result quiz + player vote.
  - Leaderboard: main = ranking table; sidebar = HUMANS VS THE MACHINE + THIS WEEK'S PRIZE.
- Corners are square or 4 px on desktop (Kaleva style). Mobile keeps the rounded cards from the mobile screens.

## Accessibility

Real buttons and links, `aria-pressed` on choices, labels on icon buttons, minimum 44 px touch targets, visible focus ring, text contrast at least 4.5:1 (that is why orange text on white uses `#B4530F` and orange buttons use dark text).
