# Content Generation (LLM)

The LLM is a **writer, not a calculator**. It only turns a fact sheet into readable text.

## Story types (MVP)
| Type | When | Length | Traffic light |
|---|---|---|---|
| `ai_pick_reasons` | Before game | 3 bullets | 🟡 |
| `what_it_means` | After final horn | 60–100 words | 🟡 |
| `recap` (text for animated recap) | After final horn | 3–5 lines | 🟡 |
| Score / standings / odds lines | Any time | Template, no LLM | 🟢 |

Green content uses **fixed templates**, not the LLM.

## Prompt rules (system prompt)
1. Use **only** facts from the fact sheet given below. Do not add any other numbers, names, dates or events.
2. Every sentence that states a fact ends with its fact ids, e.g. `[f3]`. (Ids are removed before publishing and used by the checker.)
3. Predictions are probabilities, never certainties ("62 % chance", not "will win").
4. Neutral tone. No mocking, no blame on individual players, no speculation about injuries or private life.
5. Write in Finnish (`fi`) or English (`en`) as requested. Short sentences.
6. If facts are missing, write less. Never fill gaps.

## Generation flow
```
fact_sheet → prompt → LLM → strip ids → check_claims → pass? → traffic light → queue/publish
                                              └─ fail → retry (max 2) → red
```

## Settings
- Low temperature (≈0.2) for repeatable output.
- Store `prompt_version`, `model_name` and the raw output with each story (audit trail).
- The `llm_client` interface makes the provider swappable and mockable in tests.

## Escalation words (→ red)
Injury words (`loukkaantui`, `injury`, `injured`), discipline (`ottelurangaistus`, `match penalty`, `fight`), anything about minors.

## Not allowed
- Generating quotes. Quotes only come from humans (coach Q&A, later) and are always 🔴.
- Synthetic images or video of real people.
