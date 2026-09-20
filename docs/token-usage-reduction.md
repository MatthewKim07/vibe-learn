# Token / Credit Usage Reduction

**Status: planned, not started.** Roadmap only — nothing in this doc is implemented yet.

## Why

VibeLearn's help levels (strict/guided/assist/full — see `src/ai/promptBuilder.ts`) currently only change *instructions* in the system prompt ("reply in 1-4 sentences", "don't show code"). Nothing actually caps or reduces token usage — every request still sends the same unbounded conversation history, the same optional context blocks (workspace/session/profile), and no `max_tokens` limit, regardless of mode. The model is *asked* to be terse; it isn't *forced* to be.

Goal: make the app measurably cheaper to run, with real before/after numbers, without hurting teaching quality. Three tiers, in order — each one only starts once the previous is shipped and shown to work.

## Tier 1 — Usage display + sliding-window history cap

The cheap, obviously-correct baseline. No behavior change to the AI itself beyond capping context size.

- **Surface real usage data that already exists and is thrown away.**
  - `src/ai/openaiClient.ts` — OpenAI's response includes a `usage` object (`prompt_tokens`, `completion_tokens`, `total_tokens`). `complete()` currently discards everything but the message text.
  - `src/ai/ollamaClient.ts` — Ollama's response includes `prompt_eval_count` / `eval_count`. Also discarded.
  - Plan: extend `AIClient.complete()` to return usage alongside the text, store it (per session, maybe per help level), and show it somewhere in the UI (settings panel or a small stat near the input).
- **Cap conversation history sent per request.** `buildMessages()` in `src/ai/promptBuilder.ts` currently spreads the *entire* `history` array into every request, unfiltered, forever. Change to a sliding window (e.g. last 8-10 messages) so a long session doesn't keep re-billing tokens for turns from 20 messages ago.

**Success criteria before moving to Tier 2:** usage numbers are visible and trustworthy, and we can show a measurable drop in average prompt tokens per request on a long test conversation after adding the history cap.

## Tier 2 — Rolling summarization

The "smart pruning" version — actually distinguish low-value tangents from durable context instead of just truncating by position.

- Every ~10 messages, fire one small LLM call that collapses the aging chunk of history into a short summary (e.g. "user was debugging a null-pointer in X, resolved by Y") and replace those raw messages with the summary going forward.
- Known pattern (rolling/recursive summarization), used in most production chat agents — legitimate to describe as such.
- **Tradeoff:** costs one extra small call periodically, so net token savings only show up over longer conversations. Needs to be measured against Tier 1's baseline, not assumed.

**Success criteria before moving to Tier 3:** measured net token reduction over realistic multi-turn sessions (summarization overhead included), with no loss of context the user actually needed later in conversation.

## Tier 3 — Embeddings / RAG-style retrieval

The "insane" version, only attempted if Tier 2 clearly works and there's appetite for more engineering.

- Embed each past exchange; each turn, retrieve only the top-K most semantically relevant past exchanges instead of linear/summarized history.
- Needs a vector store and an embeddings call per turn — real engineering lift, and the embeddings call itself isn't free, so it needs to be net-positive against Tiers 1-2 to be worth it.

## Open questions to resolve during Tier 1

- Where in the UI should usage stats live — settings panel, bottom bar, or a dedicated view?
- Per-message usage, per-session cumulative, or both?
- Does the history window size need to vary by help level (e.g. strict mode needs less back-context than full mode)?
