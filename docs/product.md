# Product — Voita kone (Beat the AI)

## Problem
- Results apps (e.g. Flashscore) show scores but not **what they mean**.
- Fans want quick, personal, fun sports content.
- Kaleva Media needs more **digital subscribers** and new **ad inventory**.

## Solution
A Liiga prediction game embedded in Kaleva sports pages. Fans compete against Kaleva's AI. Every game comes with useful insights about what's at stake.

## Target users
| User | Need |
|---|---|
| Liiga fan (main) | Fun, bragging rights, understand their team's situation |
| Casual reader | Quick "what does this mean" summary |
| Bettor-minded fan | Data-driven insight (no real-money betting) |
| Kaleva editor | Fast review of AI content |
| Sponsor | Brand visibility with engaged, logged-in fans |

## User flow
1. **Before the game**: the prediction card shows the AI pick (%), 3 reasons, what's at stake, and the crowd split. The fan picks the winner and top scorer.
2. **After the game**: the result card shows the score, points earned, the "what it means" story, a clip or animated recap, and AI vs Humans.
3. **Weekly / monthly**: leaderboard, and sponsor prizes for the top skilled players.

## Features
| MVP (hackathon) | Later |
|---|---|
| Prediction card + picks | Private leagues (friends, workplaces) |
| AI pick with reasons + stakes | Daily AI audio brief per team |
| Result card + "what it means" story | Clip pipeline with real footage |
| Scoring + leaderboard (AI vs Humans vs Crowd) | Lower divisions and juniors |
| Live picks, result quiz, daily games | Other sports (football, floorball, pesäpallo) |
| Email OTP sign-in, remembered in browser | Kaleva Media SSO |
| Admin: review queue + game highlight | More languages |
| Languages: fi, sv, en | |
| Widget + Chrome extension demo | |

## Games and scoring
Big points for game picks, small points for daily games, so skill on real games always matters most.

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
| Daily (small, max 15/day) | Question of the day | 2 |
| | Brain calculator (mental math with real standings) | 3 |
| | Liiga quiz, 5 questions | 1 each |
| | Higher or lower, 5 rounds | 1 each |
| | 7-day streak bonus | +10 |

All quiz and calculator questions are built from the fact sheet and pass the fact checker before going live.
UI design: Design canvas "Voita kone — UI design" (13 screens, incl. sign-in, language and admin).

## Sign-in (email + one-time code)
- Anyone can read AI picks and stories without signing in.
- The first time a fan **locks in a pick or votes**, they enter their email and get a 6-digit code (no password).
- After verifying, the browser remembers them for 90 days. Points and full history stay with the email for good, so the same email on any device shows everything.
- "I have a Kaleva Media account" option for subscribers (production: Kaleva SSO, so subscriber status is known).
- Marketing emails are opt-in (unchecked by default).

## Highlight of the game (added by Kaleva staff)
- After the final horn, an editor opens the admin, picks the moment from the game events, uploads the clip, writes the headline and caption, confirms rights, and publishes.
- The clip time is checked against the event time; the caption goes through the fact checker.
- Shown at the top of the After screen: "Chosen by Kaleva sports desk".

## Languages
- Launch: **Suomi, Svenska, English** (Oulu's international residents and students, Finland's two official languages).
- The language button is in the header; the choice is saved in the browser and on the account.
- AI stories are generated in each language from the same fact sheet and checked per language. Highlight captions: editor writes one, AI drafts the others, an editor approves each.
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
1. Real kaleva.fi article with the widget (via extension)
2. Make a pick
3. Result card from a past game
4. Leaderboard: AI vs Humans
5. Reliability slide (test results)
6. Business slide
