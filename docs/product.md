# Product — Voita kone (Beat the AI)

## Hackathon MVP scope
- We ship a **Progressive Web App first** (`apps/web`). Later the **same app** is embedded on kaleva.fi, and accounts are connected (see `architecture.md` → Accounts).
- **5 screens only:**
  1. **Game day hub:** today's games. Tapping a game opens the screen for its state: upcoming → Before, live → During, final → After. Bottom nav: **Games**, **Leaders**.
  2. **Before the game:** AI pick + reasons + stakes. The user picks winner, exact score and scorer, then taps **"Lock in my picks"**.
  3. **During the game:** next-goal pick, goal-in-period pick, live AI win chance, game events.
  4. **After the game:** result, highlight (added by a Kaleva editor), points breakdown, "what it means" story, result quiz, player vote.
  5. **Leaderboard:** You vs AI vs all fans, weekly/season ranking, sponsor prize slot.
- **Data:** real Liiga data first; demo data only to fill gaps (`data_source = 'liiga_api' | 'demo'`).
- **Sign-in:** none to browse. On the first "Lock in my picks" the app asks for a display name and creates a device account (`POST /auth/device`).
- **LATER (do not build unless asked):** daily games, email OTP, languages (sv, en), private leagues, full admin app, web push.

## Problem
- Results apps (e.g. Flashscore) show scores but not **what they mean**.
- Fans want quick, personal, fun sports content.
- Kaleva Media needs more **digital subscribers** and new **ad inventory**.

## Solution
A Liiga prediction game, shipped as a PWA and later embedded in Kaleva sports pages. Fans compete against Kaleva's AI. Every game comes with useful insights about what's at stake.

## Target users
| User | Need |
|---|---|
| Liiga fan (main) | Fun, bragging rights, understand their team's situation |
| Casual reader | Quick "what does this mean" summary |
| Bettor-minded fan | Data-driven insight (no real-money betting) |
| Kaleva editor | Fast review of AI content |
| Sponsor | Brand visibility with engaged, logged-in fans |

## User flow
1. **Game day hub**: today's games with their state; tap one to open it.
2. **Before the game**: the AI pick (%), 3 reasons, what's at stake, and the crowd split. The fan picks winner, exact score and scorer, and locks in.
3. **During the game**: next-goal and goal-in-period picks, live AI win chance, game events.
4. **After the game**: the score, the editor's highlight, points breakdown, the "what it means" story, result quiz and player vote.
5. **Weekly / season**: leaderboard (You vs AI vs all fans), and sponsor prizes for the top skilled players.

## Features
| MVP (hackathon) | Later |
|---|---|
| PWA: installable, offline banner, update toast | Web push ("Game starts in 30 min", "Next-goal pick open") |
| Game day hub | Daily games (max 15 pts/day) |
| Before: AI pick + reasons + stakes, user picks | Email OTP sign-in |
| During: next goal, goal in period, live AI win chance | Kaleva Media SSO + account linking |
| After: result, highlight, points, story, quiz, vote | Languages sv, en (and more) |
| Leaderboard (You vs AI vs all fans) + sponsor slot | Private leagues (friends, workplaces) |
| Device sign-in (name on first lock-in) | Full admin app (review queue, corrections UI) |
| Minimal editor form: highlight + story approval | Clip pipeline, daily AI audio brief, other sports |
| Embed on kaleva.fi via demo extension (step 10) | Lower divisions and juniors |

## Games and scoring
Big points before the game, medium during, small after, so skill on real games matters most. (Daily games are LATER.)

| Phase | Game | Points |
|---|---|---|
| Before (big) | Correct winner | 10 |
| | Exact score after 60 min | 25 |
| | Your scorer scores | 15 |
| | Right when the AI was wrong | +5 |
| During (medium) | Next goal (new pick after each goal, closes 2 min game time later) | 5 |
| | Goal in a period: yes/no (locks at period start) | 3 |
| | Fan poll: best player so far | 0 |
| After (small) | Result quiz, 3 questions from the "what it means" facts | 2 each |
| | Vote player of the game | 1 |

All quiz questions are built from the fact sheet and pass the fact checker before going live.
UI design: Design canvas "Voita kone — UI design". The MVP builds only the 5 screens above (390px phone first).

## Sign-in (MVP: device account)
- Anyone can browse games, AI picks and stories without signing in.
- The first time a fan **locks in a pick or votes**, the app asks for a display name only. `POST /auth/device` creates the user and returns a session token, stored in the browser (90 days).
- Later the fan can **connect a Kaleva Media account**; points and history move with them (see `architecture.md` → Accounts).
- LATER: email + 6-digit code as a cross-device option; marketing emails opt-in (unchecked by default).

## Highlight of the game (added by Kaleva staff)
- After the final horn, an editor opens the minimal editor form, picks the moment from the game events, uploads the clip, writes the headline and caption, confirms rights, and publishes.
- The clip time is checked against the event time; the caption goes through the fact checker.
- Shown at the top of the After screen: "Chosen by Kaleva sports desk".

## Languages (LATER)
- MVP: Finnish UI only. UI strings still live in locale files so more languages are easy to add.
- Later: **Suomi, Svenska, English** (Oulu's international residents and students, Finland's two official languages). AI stories generated per language from the same fact sheet and checked per language; highlight captions drafted by AI and approved per language by an editor.
- New languages (e.g. Eesti, Русский, Українська, العربية) only when an editor who speaks them can review.

## Business model
1. **Subscriptions (freemium)**: free to play. Subscribers get deeper insights, full stats, private leagues and history.
2. **Sponsors**: prize sponsors, one sponsor per team page (17 slots), sponsored workplace leagues.
3. **Better ads**: logged-in fans with known team interest.

## Why us, not Flashscore
They tell you *what* happened. We tell you *what it means*, whether you beat the AI, and what to watch next.

## Hard rules
- Free to play. Prizes by **skill**, not lottery.
- No betting-company sponsors (Finnish law from July 2027: their newspaper ads can't be interactive).
- All AI content labelled. Humans keep editorial control (see `editorial_rules.md`).

## Success metrics
- Weekly active predictors, return rate per game day
- Free → subscriber conversion from game users
- Published error rate (target: 0) and editor review time per item

## Demo script (5 min)
1. PWA on a phone: game day hub, install to home screen
2. Before: make picks and lock in
3. During and After screens from real games
4. The same app embedded on a kaleva.fi article (via demo extension)
5. Leaderboard: You vs AI vs all fans
6. Reliability slide (test results)
7. Business slide
