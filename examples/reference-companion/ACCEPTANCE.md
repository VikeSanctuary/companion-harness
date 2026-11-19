# Reference Companion Acceptance Matrix

This matrix keeps deterministic storage behavior separate from observations made with a real model. A green automated test does not prove that a model will choose to save a particular turn.

## Deterministic scenarios

Run `node --test core.test.mjs`.

- Appropriate save: an attributed candidate with weight 7–10, a current-turn quote, and a readback receipt is active after wake.
- Appropriate decline: `{ "save": false }` produces outcome `declined` and writes no memory.
- Candidate rejection: a save request without current-turn evidence produces outcome `rejected` and writes no memory.
- Fresh-session recall: a verified handoff plus saved memory returns `COMPLETE` and the saved memory on a new wake.
- Correction: an explicit owner correction changes active recall while preserving the append-only event history.
- Privacy: credential-like content is not saved and is redacted in persisted turns and handoffs.
- Duplicate protection: an assistant-only paraphrase cannot create a new memory because it cannot quote the current user turn.

## Live-model scenarios

Use a disposable `HEARTHSTONE_HOME` and a model endpoint that is authorized for the test. Do not use private Riverbank data, real credentials, paid APIs, or a computer that another family member is using.

1. Start the CLI and share a durable, nonsensitive fact naturally, such as: `My long-term project is to build a cedar bookshelf for my study next winter.`
2. Record the console outcome. `saved` requires a memory ID and a readback receipt. `declined` means the model returned a valid no-save decision. `rejected` means the model proposed a candidate that failed deterministic provenance or privacy checks. `incomplete` means transport or structured-output failure. These outcomes must not be conflated.
3. Check `/memories`, quit, restart the same disposable profile, and ask a recall question. The memory should be present, and the recall question must not create a duplicate.
4. Correct the memory with `/correct`, restart again, and verify the corrected wording is active while the correction event remains in the journal.
5. Use a fake credential-shaped test string only if needed for the privacy check. Confirm it is not in `memory-events.jsonl`, and that persisted turns and handoff contain only `[redacted sensitive content]`.

If the model declines an eligible durable fact, preserve the exact outcome and transcript as a live observation. Do not force a save or convert a model observation into a deterministic pass.

