# Token / Credit Usage Reduction

**Status: Tier 1 shipped.** Tiers 2 and 3 are still just plan, not implemented.

## Why

VibeLearn's help levels (strict/guided/assist/full — see `src/ai/promptBuilder.ts`) currently only change *instructions* in the system prompt ("reply in 1-4 sentences", "don't show code"). Nothing actually caps or reduces token usage — every request still sends the same unbounded conversation history, the same optional context blocks (workspace/session/profile), and no `max_tokens` limit, regardless of mode. The model is *asked* to be terse; it isn't *forced* to be.

Goal: make the app measurably cheaper to run, with real before/after numbers, without hurting teaching quality. Three tiers, in order — each one only starts once the previous is shipped and shown to work.

## Tier 1 — Usage display + sliding-window history cap ✅ shipped

The cheap, obviously-correct baseline. No behavior change to the AI itself beyond capping context size.

- **Usage data is now surfaced instead of thrown away.**
  - `AIClient.complete()` (`src/ai/types.ts`) returns `{ content, usage }` instead of a bare string.
  - `src/ai/openaiClient.ts` extracts OpenAI's `usage` object (`prompt_tokens`, `completion_tokens`, `total_tokens`).
  - `src/ai/ollamaClient.ts` extracts `prompt_eval_count` / `eval_count`.
  - `ChatViewProvider` (`src/chatViewProvider.ts`) accumulates a running session total (`recordUsage()`) and posts it to the webview, shown live in the bottom bar next to the mode selector (`#meta-usage`, e.g. "1.2k tok").
  - Scope: cumulative per-session total only (resets on webview reload) — not per-message, not persisted. Good enough to see the effect of the history cap below; per-message/persistent breakdown is still open (see below).
- **Conversation history sent per request is now capped.** `buildMessages()` in `src/ai/promptBuilder.ts` slices to the most recent `MAX_HISTORY_MESSAGES` (10) turns instead of sending the entire unbounded `history` array every request.

**Success criteria before moving to Tier 2:** usage numbers are visible and trustworthy, and we can show a measurable drop in average prompt tokens per request on a long test conversation after adding the history cap. Usage display is live; the actual before/after measurement on a long conversation is still open — do that before starting Tier 2.

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

## Open questions

- ~~Where in the UI should usage stats live?~~ Resolved: bottom bar, next to the mode selector.
- Per-message usage, not just cumulative — still open. Right now only a running session total is shown; no breakdown per reply.
- Usage isn't persisted — resets when the webview reloads. Worth keeping around (e.g. in `globalState`) for a real before/after measurement.
- Does the history window size need to vary by help level (e.g. strict mode needs less back-context than full mode)? Currently a flat 10 for all levels.
