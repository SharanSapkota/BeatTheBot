# Editorial Rules

Based on the Finnish Journalist's Guidelines (JSN) and EU AI Act Art. 50. **Humans keep editorial control.**

## 1. Traffic light
| Level | Content | Human role | Publish |
|---|---|---|---|
| 🟢 Green | Scores, standings, schedule, "Data says" win chance and stakes, leaderboard. AI preview / AI summary (LLM or template) where **every claim is verified**, no tip, no sensitive topic | Daily spot-check (10% sample) | Automatically |
| 🟡 Yellow | AI text with any claim `not_found` in the fact sheet; story types not in the auto-publish list (`preview`, `summary`); clips/recaps; any story a reader reported | One-tap approve / edit / reject | After approval (target < 10 min) |
| 🔴 Red | Any `wrong` claim; a tip or prediction of a winner; injuries, penalties/fights/discipline, minors, legal (court, police, arrest, lawsuit), personal topics (illness, family, private life, divorce, pregnancy); quotes; prize winners; anything negative about a named person; LLM errors (empty / unusable output, wrong length) | Full review and edit | After full review, never automatically |

The reasons for each story's light are stored in `stories.check_result.traffic_light_reasons` and shown to the editor.

**Automatic escalation to red** when text or data contains: injury words, match penalties, game misconduct, player age < 18, legal or personal topics, a tip on the winner, or a `wrong` claim after 2 retries.

**Reader reports:** a report sends a published story back to 🟡 `in_review`. It is hidden until an editor approves it again.

## 2. Earn trust
AI preview and AI summary auto-publish as green **only** when the fact checker verifies every claim; anything else goes to an editor. Other content types move from yellow to green only after **200 approved items in a row with zero edits to facts**. One published fact error sends a type back to yellow. Changes are logged in `docs/decisions/`.

## 3. Fact rules
- Numbers come from code (`prediction_model`, Liiga data). **The LLM never calculates.**
- The LLM may only use facts from the fact sheet.
- `classify_claims` marks every number, %, score, date, time, ordinal, weekday, team and player name as `verified`, `not_found` or `wrong` against the fact sheet. An unknown person-like name counts as an invented player (`wrong`).
- No speculation presented as fact. The AI never tips or predicts a winner; probabilities only as "Data says … %".
- The AI is not a player: no AI pick, no AI score, no AI scorer.

## 4. Labels
| Content | Label (EN) |
|---|---|
| AI preview / AI summary written by the LLM | "Written with AI from Liiga data · checked by Kaleva" (after editor approval: with the time) |
| Template text (no LLM) | "Automatic preview from Liiga data" / "Automatic summary from Liiga data" |
| Model numbers | "Data says · calculated from Liiga data HH:MM" |
| Corrected story | "Corrected HH:MM: …" (the correction note) |
| Video | On-screen tag "AI-edited" + "AI voice" in description |

Every AI item has a **"Report an error"** button (with a reason form). Nothing published yet → "Preview coming soon" / "Summary coming soon" (never sample text).

## 5. Corrections (JSN 35)
1. A reader reports (story goes back to 🟡 `in_review`, hidden), or an editor finds, an error.
2. The editor fixes it on the `/editor` page. The fact checker re-runs; a `wrong` claim blocks publishing. The item is updated in **every channel** (widget, site, notifications, video description).
3. If the story was published before, it becomes `corrected` and shows a correction note with the time ("Corrected HH:MM: …"), also stored in `corrections`.
4. The report is logged in `error_reports` for the reliability stats; every editor action and report is logged in `audit_log` (who, what, target, when, details).

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
