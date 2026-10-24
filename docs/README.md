# Design reference: Voita kone PWA (5 screens)

> **Superseded:** the app now uses the Kaleva theme and a desktop layout. The current tokens, fonts and layout rules are in `docs/design/README.md`. The navy tokens and Inter below are the old theme.

The UI must match these designs. Phone first (390 px wide), centered on desktop.

- `screens/`: full-length renders of every screen and state (2× pixel density, so 780 px wide image = 390 px CSS).
- `source/`: the exact design source (HTML with inline styles). Use it for exact colors, sizes, spacing, radii and copy. Ignore the `<x-dc>`, `<sc-for>`, `<sc-if>`, `{{ }}` and `class Component` parts: they are the design tool's template syntax, not app code.

| Screen | Image | Source |
|---|---|---|
| 1 Game day hub (Before / Live / Final moments) | `01_hub_before.png`, `01_hub_live.png`, `01_hub_final.png` | `Main.dc.html` |
| 2 Before the game (+ picks saved state) | `02_before_game.png`, `02_before_game_locked.png` | `Before.dc.html` |
| 3 During the game | `03_during_game.png` | `Live.dc.html` |
| 4 After the game | `04_after_game.png` | `After.dc.html` |
| 5 Leaderboard | `05_leaderboard.png` | `Leaderboard.dc.html` |

## Tokens

| Token | Value | Use |
|---|---|---|
| `--color_navy` | `#0E1B2C` | Headers, dark cards, main text |
| `--color_navy_2` | `#1C2E45` | Header pills, time-jump bar |
| `--color_navy_line` | `#3A4E66` | Lines on dark |
| `--color_page` | `#EEF2F6` | Page background |
| `--color_card` | `#FFFFFF` | Cards |
| `--color_line` | `#DCE3EA` | Card borders |
| `--color_line_soft` | `#EEF2F6` | Row dividers |
| `--color_text_soft` | `#3E4C5C` | Secondary text |
| `--color_text_muted` | `#5B6B7E` | Labels, small text |
| `--color_on_dark_soft` | `#B8C4D2` / `#D5DEE8` | Secondary text on navy |
| `--color_you` (orange) | `#C2410C` | You, primary buttons, points |
| `--color_you_tint` | `#FFF4EC` | Selected row background |
| `--color_you_light` | `#FFB37A` | Points text on navy |
| `--color_ai` (blue) | `#1D5FD1` | Kaleva AI, links |
| `--color_ai_tint` | `#E8F0FC` | AI pick chip |
| `--color_fans` (gray) | `#6B7785` | All fans |
| `--color_live` | `#C8102E` | LIVE pill |
| `--color_good` / tint | `#15803D` / `#EAF6EE` | Correct, win |
| `--color_bad` / tint | `#B42318` / `#FDECEC` | Wrong, loss |
| Team Kärpät | bg `#111111`, ring/text `#FFD200` | Badge |
| Team Ilves | bg `#0F6B3A`, text `#FFFFFF` | Badge |
| Other teams | bg `#DCE3EA`, text navy | Neutral badge with short code |

Color meaning is the same everywhere: **You = orange, AI = blue, all fans = gray.**

**Fonts:** `Barlow Condensed` 600/700/800 (titles, scores, points, numbers) and `Inter` 400/500/600/700 (everything else). Self-host them with `@fontsource` so the PWA works offline.

**Type sizes (px):** 56 big score · 44 stepper digits · 34 points · 26–32 screen titles · 22 team names on headers · 19 story headline · 17 card titles · 15–16 body · 14 rows · 13 meta · 12 labels · 11 small print.

**Shape:** cards radius 16, padding 16, 1 px border `#DCE3EA`; buttons and inputs radius 12, minimum height 44 (choice buttons 52–56); pills radius 999; page padding 16, gap between cards 16. Accent cards have a 4 px top border (AI blue for the AI pick, orange for live picks). The featured game card has a 2 px orange border.

**Icons:** simple 2 px stroke line icons (robot for the AI, check, chevrons, play). No emoji.

**Accessibility:** real buttons and links, `aria-pressed` on choice buttons, labels on icon buttons, minimum 44 px touch targets, text contrast at least 4.5:1.
