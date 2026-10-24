# 0003: The LLM writes, code calculates

**Status:** accepted · 2026-10-23

**Context:** The brief says nothing may be published as data-driven fact unless it is true. LLMs can invent numbers.

**Decision:** All numbers (odds, stats, scores) come from `prediction_model` and Liiga data. The LLM only writes text from a fact sheet, and `check_claims` verifies every claim before review or publishing.

**Consequences:** Reliability we can test and prove. Text is a bit less creative. Green content uses templates, not the LLM.
