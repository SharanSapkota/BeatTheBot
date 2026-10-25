# Product — Voita Kaleva (fans vs fans)

The UI says **"Voita Kaleva"**; code and package names still say `voita_kone`.

## Hackathon MVP scope
- We ship a **Progressive Web App first** (`apps/web`). Later the **same app** is embedded on kaleva.fi, and accounts are connected (see `architecture.md` → Accounts).
- The game is **fans vs fans**. The AI is **not a player**, it is a guide: an **AI preview** before the game and an **AI summary** after it. Model numbers are shown only as neutral **"Data says"** info.
- **4 main menus: Games · Elections · Rooms · Leaders.** Mobile: bottom nav with icons + labels (44 px targets). Desktop (≥ 900 px): the same items in the Kaleva header with the orange underline. Routes `/games`, `/elections`, `/elections/:id`, `/rooms`, `/leaders`; old links (`/`, `/leaderboard`) redirect.
- **Games (5 screens):**
  1. **Game day hub** (`/games`): today's games, each with the fans' split ("Fans: 62% Kärpät", or "Be the first to pick"). Tapping a game opens the screen for its state: upcoming → Before, live → During, final → After.
  2. **Before the game:** AI preview (3 bullets + "Last meetings") and "Data says" (win chance + what's at stake). The user picks winner, exact score and scorer (top recent scorers tagged **"In form"**), then taps **"Lock in my picks"**.
  3. **During the game:** next-goal pick, goal-in-period pick, "Data says: win chance" chart, game events.
  4. **After the game:** result, highlight (added by a Kaleva editor), points breakdown, AI summary, result quiz, player vote.
  5. **Leaderboard** (Leaders → tab **Games**): fans only, your accuracy vs all fans, weekly/season ranking, sponsor prize slot.
- **Sports** (step 8): the Games menu has tabs **Hockey · Football · Basketball**. Hockey is real Liiga data; football and basketball matches are entered by a Kaleva admin until an API is available. Each sport has its own picks (see Games and scoring).
- **Elections** (step 7, see below): predict who gets the most votes; see all users' picks after picking; separate election leaderboard (Leaders → tab **Elections**).
- **Rooms** (step 9, see below): a private room with a join key, a new question every interval, the room's own scoreboard and emoji reactions.
- **Admin page** (`/admin`, desktop first, role `admin`): first tab **Elections** (create, candidates, preview, publish, close, enter the result).
- **Editor page** (`/editor`, desktop first): queue of AI stories to review; approve, edit + approve, or reject.
- **Data:** real Liiga data first; demo data only to fill gaps (`data_source = 'liiga_api' | 'demo'`).
- **Sign-in:** none to browse. On the first "Lock in my picks" the app asks for a display name and creates a device account (`POST /auth/device`).
- **LATER (do not build unless asked):** daily games, email OTP, languages (sv, en), private leagues beyond rooms (step 9), full admin app, web push.

## Problem
- Results apps (e.g. Flashscore) show scores but not **what they mean**.
- Fans want quick, personal, fun sports content.
- Kaleva Media needs more **digital subscribers** and new **ad inventory**.

## Solution
A Liiga prediction game, shipped as a PWA and later embedded in Kaleva sports pages. Fans compete against other fans. Kaleva's AI is the guide: a short preview before every game, a short summary after it, both written only from checked Liiga data.

## Target users
| User | Need |
|---|---|
| Liiga fan (main) | Fun, bragging rights over other fans, understand their team's situation |
| Casual reader | Quick preview and summary |
| Bettor-minded fan | Data-driven insight (no real-money betting) |
| Kaleva editor | Fast review of AI content |
| Sponsor | Brand visibility with engaged, logged-in fans |

## User flow
1. **Game day hub**: today's games with their state and the fans' split; tap one to open it.
2. **Before the game**: the AI preview (form, history, what's at stake) with "Last meetings", and "Data says" (win chance, stakes). The fan picks winner, exact score and scorer, and locks in.
3. **During the game**: next-goal and goal-in-period picks, "Data says: win chance", game events.
4. **After the game**: the score, the editor's highlight, points breakdown, the AI summary, result quiz and player vote.
5. **Weekly / season**: leaderboard of fans, and sponsor prizes for the top skilled players.

## Features
| MVP (hackathon) | Later |
|---|---|
| PWA: installable, offline banner, update toast | Web push ("Game starts in 30 min", "Next-goal pick open") |
| Game day hub with the fans' split | Daily games (max 15 pts/day) |
| Before: AI preview + "Data says" + user picks | Email OTP sign-in |
| During: next goal, goal in period, "Data says: win chance" | Kaleva Media SSO + account linking |
| After: result, highlight, points, AI summary, quiz, vote | Languages sv, en (and more) |
| Leaderboard (fans only) + sponsor slot | Private leagues beyond rooms |
| Device sign-in (name on first lock-in) | Full admin app |
| Editor page: story queue, approve / edit / reject, reader reports | Clip pipeline, daily AI audio brief |
| Elections (7): predict the most-voted candidate, picks results, election leaderboard, admin page | Lower divisions and juniors |
| Roadmap: sport categories (8), rooms (9), AI preview + summary finish (10), share + referral (11), highlights editor (12), PWA features (13), embed on kaleva.fi (14) | |

## Games and scoring
Big points before the game, medium during, small after, so skill on real games matters most. (Daily games are LATER.)

| Phase | Game | Points |
|---|---|---|
| Before (big) | Correct winner | 10 |
| | Exact score after 60 min | 25 |
| | Your scorer scores | 15 |
| | **Bold call**: your winner is right AND fewer than 30% of fans picked that winner (crowd share at puck drop; needs at least 20 picks, otherwise no bonus) | +5 |
| During (medium) | Next goal (new pick after each goal, closes 2 min game time later) | 5 |
| | Goal in a period: yes/no (locks at period start) | 3 |
| | Fan poll: best player so far | 0 |
| After (small) | Result quiz, 3 questions from the summary facts | 2 each |
| | Vote player of the game | 1 |

**Other sports (step 8):** football: home / draw / away 10 (a draw is a pick too), exact score after 90 min 25, scorer 15; live next goal and fan poll; quiz and vote after. Basketball: winner 10, winning margin band (1–5 / 6–10 / 11+ points) 15, top scorer 15; live fan poll; vote after. The bold call (+5) works in every sport. "Data says" and the AI preview / summary are hockey only (real Liiga data).

All quiz questions are built from the fact sheet and pass the fact checker before going live.
UI design: Design canvas "Voita kone — UI design". The MVP builds only the 5 screens above (390px phone first).

## Sign-in (MVP: device account)
- Anyone can browse games, AI previews, summaries and "Data says" without signing in.
- The first time a fan **locks in a pick or votes**, the app asks for a display name only. `POST /auth/device` creates the user and returns a session token, stored in the browser (90 days).
- Later the fan can **connect a Kaleva Media account**; points and history move with them (see `architecture.md` → Accounts).
- LATER: email + 6-digit code as a cross-device option; marketing emails opt-in (unchecked by default).

## Elections (step 7)
A prediction game about elections (parliamentary, municipal, presidential, county, other). An admin adds the election and its candidates; fans predict who will get the **most votes** in the area. No AI anywhere in elections.

- **List** (`/elections`): published elections, upcoming first; filter chips by area (default "Oulu" when there is one). Card: title, area, date, days left, status; a "Demo" badge on demo elections.
- **Election page** (`/elections/:id`): the question ("Who will get the most votes in Oulu?"), candidate cards (name, party or group, number, photo or initials, short bio written by the admin) and a pick button. The pick can be changed until the poll closes. After picking (or once the poll has closed) the user sees the share of picks per candidate as bars, but only from 20 picks on ("Results show after 20 picks").
- Every result carries the label **"Not a scientific poll. Shows only the picks of Voita Kaleva users."**
- The first pick asks for a display name (the same dialog as the first lock-in).
- **Points:** correct prediction = **20 points**, on a separate **election leaderboard** (Leaders → Elections). Not added to the games points. **No prizes** for election picks.

**Fairness rules** (details in `architecture.md` → Elections):
- We ask for a **prediction** ("Who will get the most votes?"), never "Who will you vote for?". No personal vote intention is stored.
- Candidate order is random per user (stable for a signed-in user, new per visit for anonymous users).
- Every candidate gets the same card design: no party colours, no AI-written text.
- Deleting a user deletes their election picks.
- Demo data uses only fictional candidates. Real politicians' names never appear in seed or test data.

## Rooms (step 9)
One person in a group (a club, friends, a workplace) creates a room and shares the key; others join with it. Inside the room a new question appears regularly, members answer, the room has its own scoreboard, and members react with emojis.

- **Rooms menu** (`/rooms`): "My rooms" (name, topic, members, my rank), **Create a room**, **Join with a key** (6 big boxes, upper case).
- **Create** (`/rooms/new`): name (3–40), topic (Hockey, Football, Basketball, All sports), question speed (1 min, 5 min, 15 min, 1 hour) → success screen with the key in big letters, **Copy**, **Share** (the phone's share sheet, else copy the link) and a **QR code** of the join link `/rooms/join/<key>`. The first create or join asks for a display name (the same dialog as the first lock-in).
- **Room page** (`/rooms/:id`): header (name, members, key + Share), tabs **Question · Scoreboard · Members**. Question: the current question with a countdown and answer buttons → "Waiting for the reveal" + how many answered → at the next question the reveal (bars per option, right/wrong, points, who got it right) with an emoji row (🔥 😂 😮 👏 😡) under every revealed question; the last 5 below. Scoreboard: ranking, you highlighted, this week / all time. Members: the owner removes members, makes a new key or closes the room; members can leave. Desktop: question (and members) in the main column, scoreboard in the sidebar.
- **Points:** trivia right = 3, opinion = 1 for answering. Room points are only for the room; they never count on the Leaders page.
- **Questions:** from a checked question bank now (simple, well-known facts; opinion questions when a fact isn't certain; no politics or elections). LLM-written questions later.
- **Limits:** rooms are private (members only), max 100 members, max 10 active rooms per owner, join tries limited per IP.
- **Demo:** "Kärpät fans Oulu", key `DEMO26`, a new question every minute, 8 demo members with a full scoreboard.

## Highlight of the game (added by Kaleva staff, step 12)
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
They tell you *what* happened. We tell you *what it means*, how you did against other fans, and what to watch next, with AI text that is checked against the data before anyone sees it.

## Hard rules
- Free to play. Prizes by **skill**, not lottery.
- No betting-company sponsors (Finnish law from July 2027: their newspaper ads can't be interactive).
- The AI never tips or predicts a winner; probabilities appear only as "Data says … %".
- All AI content labelled. Humans keep editorial control (see `editorial_rules.md`).

## Success metrics
- Weekly active predictors, return rate per game day
- Free → subscriber conversion from game users
- Published error rate (target: 0) and editor review time per item

## Demo script (5 min)
1. PWA on a phone: game day hub with the fans' split, install to home screen
2. Before: AI preview + "Data says", make picks and lock in
3. During and After screens from real games (AI summary, quiz, vote)
4. Editor page: a story in the queue, claims marked against the fact sheet, approve
5. Elections: open the demo election, pick a candidate, see all users' picks ("Not a scientific poll")
6. Rooms: join the demo room with `DEMO26`, answer, see the reveal and the room scoreboard; create a room and show its QR code
7. The same app embedded on a kaleva.fi article (via demo extension)
8. Leaders: you vs all fans, bold calls; the election leaderboard
9. Reliability slide (test results)
10. Business slide
