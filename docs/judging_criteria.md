# Judging Criteria → Our Answer

Use this as the checklist for the pitch. Every criterion must have a demo moment or slide.

| Kaleva criterion | Our answer | Proof in demo |
|---|---|---|
| **Originality and boldness** | A game where fans compete against the newsroom's AI, plus "what's at stake" insights no results app gives | Live widget on kaleva.fi, AI vs Humans scoreboard |
| **Value to the audience** | Fun every game day + understand what results mean for your team | Prediction card with reasons + stakes |
| **Commercial potential** | Freemium subscriptions, prize + team sponsors (17 slots), workplace leagues, logged-in ad targeting | Business slide |
| **Quality and reliability of AI content** | Numbers from code, fact checker, traffic light, labels, corrections | Reliability slide: golden set + planted errors (50/50) |
| **Feasibility and demo quality** | Working prototype, one-line embed, offline seed data | Full 5-min flow |

## Brief questions we must answer
| Question from the brief | Our answer | Doc |
|---|---|---|
| How is AI content labelled? | Label on every item + "Report an error" | `editorial_rules.md` §4 |
| Where does a human review it, where not? | Traffic light: green auto, yellow one-tap, red full review | `editorial_rules.md` §1 |
| How do you prevent fabricated facts? | Fact sheet + `check_claims` + LLM never calculates | `fact_checker.md` |
| How do you test reliability? | Golden set, planted errors, back-test, spot checks | `reliability_testing.md` |
| New angle for bettors? | Free prediction game with data insights, two-way interaction, no real money | `product.md` |
| Why not Flashscore? | Meaning, fun and community, not just scores | `product.md` |
| How does it grow subscriptions? | Free game → paid deeper insights, private leagues, history | `product.md` |
| Does it scale to lower divisions? | Same pipeline, any league with structured data | `product.md` (Later) |
| Personal / two-way? | Picks, live picks, quizzes, votes; history saved to the fan's email | `product.md` |
| International readers? | fi, sv, en at launch; languages added only with a reviewing editor | `editorial_rules.md` §10 |
| Where do humans add value? | Editors choose and publish the highlight of the game | `editorial_rules.md` §9 |
| AI slop? | Short, fact-based, labelled, human-approved; game creates value, not volume | `content_generation.md` |
