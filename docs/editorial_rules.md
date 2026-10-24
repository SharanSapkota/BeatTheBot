# Editorial Rules

Based on the Finnish Journalist's Guidelines (JSN) and EU AI Act Art. 50. **Humans keep editorial control.**

## 1. Traffic light
| Level | Content | Human role | Publish |
|---|---|---|---|
| 🟢 Green | Scores, standings, schedule, AI win %, leaderboard | Daily spot-check (10% sample) | Automatically |
| 🟡 Yellow | "What it means" stories, AI pick reasons, clips/recaps | One-tap approve / edit / reject | After approval (target < 10 min) |
| 🔴 Red | Injuries, penalties/fights/discipline, quotes, minors, prize winners, anything negative about a named person | Full review and edit | After full review |

**Automatic escalation to red** when text or data contains: injury words, match penalties, game misconduct, player age < 18, or a checker failure after 2 retries.

## 2. Earn trust
A content type moves from yellow to green only after **200 approved items in a row with zero edits to facts**. One published fact error sends it back to yellow. Changes are logged in `docs/decisions/`.

## 3. Fact rules
- Numbers come from code (`prediction_model`, Liiga data). **The LLM never calculates.**
- The LLM may only use facts from the fact sheet.
- `check_claims` must pass: every number, player name, team name, date and score must match the fact sheet.
- No speculation presented as fact. Predictions are always phrased as probabilities.

## 4. Labels
| Content | Label (FI / EN) |
|---|---|
| Green | "Automaattinen, Liigan datasta klo 21.47" / "Automatic, from Liiga data, 21:47" |
| Yellow/Red story | "Tekoälyn kirjoittama Liigan datasta. Tarkistanut Kalevan urheilutoimitus klo 21.47." / "AI-written from Liiga data. Checked by Kaleva sports desk, 21:47." |
| AI pick | "Tekoälyn veikkaus, laskettu ottelutilastoista" / "AI's pick, calculated from game statistics" |
| Video | On-screen tag "AI-edited" + "AI voice" in description |

Every item has a **"Report an error"** button.

## 5. Corrections (JSN 35)
1. A reader reports, or an editor finds, an error.
2. The editor fixes it. The item is updated in **every channel** (widget, site, notifications, video description).
3. A correction note is shown: what was wrong, and when and how it was fixed.
4. The error is logged in `error_reports` for the reliability stats.

## 6. Video rules
- Only **real** footage, cut and captioned by AI. No synthetic footage of real people.
- No cloned voices of real players, coaches or commentators. AI voice is labelled.
- Automatic checks: clip time matches the event time, scorer name matches the data, score on screen matches the final score.
- Always at least yellow. Injuries or fights make it red.
- Use footage only with Kaleva/rights-holder permission. Otherwise use an animated recap from data.

## 7. Minors and fairness
- No negative framing of individual minors. No betting-related content near junior content.
- Respect human dignity (JSN 23–24). No mocking players.

## 8. Game, prizes and sponsors
- Free to play, no purchase needed. Winners by **points (skill)**.
- Editor verifies top players before prizes (fake accounts, bots).
- No gambling-operator sponsors. Sponsor content is clearly separated from editorial (JSN 16–17).
- User-written text (league names, comments) is moderated, and users can report it (JSN annex L1–L4).

## 9. Game highlight (human-chosen)
- Chosen, written and published only by a Kaleva editor. The AI never picks or publishes a highlight.
- Real footage only, with a rights confirmation and clip credit before publishing.
- Automatic checks: clip time matches the chosen event (±10 s); caption passes `check_claims`.
- Injuries or fights in the clip need a second editor.
- Label: "Chosen by Kaleva sports desk · [time] · Clip: [credit]".

## 10. Languages
- Launch languages: Suomi, Svenska, English. A language is added only when an editor who speaks it can review content.
- AI stories are generated per language from the same fact sheet; each language version passes `check_claims` and the traffic light on its own.
- AI translations of highlight captions are drafts until an editor approves that language.
- Labels are shown in the reader's language.

## 11. Personal data
- Email is used only for sign-in, points history and contacting prize winners. Never shown publicly (display names only).
- Marketing emails only with opt-in (unchecked by default). Users can delete their account (`DELETE /me`).
- Login codes and session tokens are stored hashed.
