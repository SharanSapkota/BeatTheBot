# Content Generation (LLM)

The LLM is a **writer, not a calculator**. It only turns a fact sheet into readable text. The AI is a guide, not a player: it never makes a pick.

## Story types (MVP)
| Type | When | Fact sheet (`kind`) | Shape | Traffic light |
|---|---|---|---|---|
| `preview` (AI PREVIEW) | Before the game (also for past games, so demo replays have one) | `preview` | Exactly 3 bullet lines `- …`, 60–90 words; the app adds a "Last meetings" list from the `head_to_head` facts | 🟢 if every claim verified, else 🟡 / 🔴 |
| `summary` (AI SUMMARY) | When the game is final | `summary` | One paragraph, 60–90 words | 🟢 if every claim verified, else 🟡 / 🔴 |
| Score / standings / "Data says" lines | Any time | – | Fixed templates, no LLM | 🟢 |

Old `what_it_means` stories are now `summary`. `ai_pick_reasons` and `recap` are gone.

## Prompt rules (system prompt)
1. 60–90 words, simple English, a friendly neutral sports reporter.
2. Use **only** facts from the fact sheet. No other number, name, date or claim.
3. **Never tip or predict a winner.** Probabilities only as "Data says … %".
4. Every sentence ends with its fact ids, e.g. `[f3]`. (Ids are removed before publishing and used by the checker.)
5. Preview = exactly 3 bullet lines starting with `- `. Summary = one paragraph.
6. Neutral tone. No mocking, no blame on individual players, no speculation about injuries or private life.
7. If facts are missing, write less. Never fill gaps.

## Generation flow
```
fact_sheet → prompt → LLM → classify_claims + find_tips + find_escalation_words → traffic light → publish / editor queue
                        │            └─ failed claims → retry with the failed claims listed (max 2)
                        └─ no key / network / 5xx / timeout → template text → same checks → 🟢 (source: template)
```
- Retry up to 2 times, listing the failed claims in the prompt.
- Empty or unusable output, or the wrong length, is an LLM error → 🔴.
- Ids are stripped before publishing.

## Template fallback
- Used when `LLM_API_KEY` is not set or the LLM call fails (network / 5xx / timeout).
- Built by code from the **same fact sheet**, and still run through the fact checker.
- Traffic light 🟢, `stories.source = 'template'`, label **"Automatic preview from Liiga data"** / **"Automatic summary from Liiga data"**.

## Settings
- Provider: Anthropic Messages API via `fetch` when `LLM_API_KEY` is set; model from `LLM_MODEL` (default `claude-sonnet-5-5`). No key → no LLM (templates only).
- Low temperature (≈0.2) for repeatable output.
- Store `source` (`llm` | `template`), `prompt_version`, `model_name` and the raw output with each story (audit trail).
- The `llm_client` interface makes the provider swappable and mockable in tests.

## Escalation words (→ red)
`find_escalation_words`: injury, discipline, minors, legal (court, police, arrest, lawsuit), personal (illness, family, private life, divorce, pregnancy). `find_tips`: "will win", "should beat", "favourite", "expect … to", "our tip", "bet", ….

## Not allowed
- Tips or predictions of a winner.
- Generating quotes. Quotes only come from humans (coach Q&A, later) and are always 🔴.
- Synthetic images or video of real people.
