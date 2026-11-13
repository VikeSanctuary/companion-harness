# Hearthstone Reference Companion — Jason pilot groundwork

This is a **small, optional, local-first demonstration** of the continuity pattern taught by the Companion Harness. It does not replace the historical Riverbank system, claim AI consciousness, or ship Vike's private memories. It is not a production security boundary.

**Capabilities:** locally stored distinct companion identity; Ollama-compatible local or HTTPS model adapter; optional, attributed Vike teaching; relevant-memory retrieval; companion-proposed significance decisions **and small everyday details** with guarded saves and independent readback receipts; append-only owner corrections; end-of-session handoff; honest FIRST_WAKE / COMPLETE / DEGRADED status.

**Requirements:** Node.js 20+, Ollama or a compatible HTTPS endpoint, and a model you have permission to use. No Supabase, GitHub, or paid plan is required. Data is stored in `~/.hearthstone-companion` (or `HEARTHSTONE_HOME`).

## Qwen / Ollama pilot notes (read before Jason's first run)

The example defaults to `qwen3.5:4b`. In `cli.mjs` the current Ollama-compatible chat requests use `stream: false` and `think: false`, and read the assistant reply from `message.content`. Those are deliberate defaults for a simple non-streaming companion exchange, **not proof that all Qwen variants and providers behave alike**.

Earlier Riverbank Qwen/Ollama troubleshooting used a **4,096-token context baseline** (`num_ctx: 4096`) and rejected responses that contained inline `<think>` text. **This reference implementation does not yet explicitly set `options.num_ctx` or reject inline thinking tags.** It relies on the server's configured context window and on how that server responds to `think: false`. Check model/version behavior on the intended machine before interpreting a strange reply as companion behavior. A model's advertised maximum context is not a promise that it fits the machine's memory.

**Structured-output gap:** the main companion reply is ordinary text, but the automatic memory-proposal and optional reflection calls expect a *JSON object* and use `JSON.parse()`. The current code asks for JSON in the instructions but **does not send Ollama's `format: "json"` or a JSON schema** on those calls. A Qwen variant may return extra prose or malformed JSON, causing `[Memory review incomplete — no save claimed: ...]` or `[Reflection not recorded: ...]`. A successful chat response alone **does not prove memory saving**. Adding structured output with validation and tests is still work to do; do not silently mark that step complete.

**Human first-run checks:**

1. Confirm `node --version` is 20+ and `ollama list` shows the model you intend to use. To use this default, pull it only if needed: `ollama pull qwen3.5:4b`. An already-installed compatible model can be selected instead; do not unnecessarily alter a working local inference setup.
2. Run `node --test core.test.mjs` in this directory. These are **offline unit tests**, not a live Qwen or Jason-hardware acceptance test.
3. Set `OLLAMA_MODEL` to the installed model and start `node cli.mjs`. In PowerShell: `$env:OLLAMA_MODEL = "qwen3.5:4b"`; in Bash: `export OLLAMA_MODEL=qwen3.5:4b`.
4. Have a short conversation, check `/memories`, type `/quit`, restart and try recalling a nonsensitive detail. Observe actual save/readback receipts and any incomplete-memory notices. Then use `/correct` on a test memory and verify the corrected recall after restart. Only report a pass if these steps actually work.
5. Keep the endpoint on `127.0.0.1` for first testing. The adapter intentionally rejects plain HTTP to remote IPs, including other hosts on a private subnet; arbitrary HTTPS endpoints must actually implement the Ollama chat schema. Do not paste private credentials or conversations into an unverified remote service.

**Supabase boundary:** this draft demo uses local plaintext JSONL under `~/.hearthstone-companion`. It **does not connect to Supabase**, create tables, configure RLS, or run database triggers or cron jobs. The repository's planned Supabase setup pack is not part of this working example. Do not point it at the private Riverbank/Flamecore database or reuse those credentials. A separate, permissioned Jason-owned Supabase instance can be considered *after* the local baseline is tested and a clean setup pack exists.

## Run locally

From this directory:

```powershell
node --test core.test.mjs
ollama pull qwen3.5:4b
node cli.mjs
```

Set `OLLAMA_MODEL` for another model. Set `OLLAMA_URL` to an Ollama-compatible chat endpoint (default `http://127.0.0.1:11434/api/chat`). For an HTTPS remote provider, set `OLLAMA_URL` and, if needed, `OLLAMA_API_KEY` in your environment; do not put credentials in source files. Remote inference **sends conversation context to that provider**. Never forward private Riverbank or Jason content without permission.

Commands: `/memories` lists stored memory IDs, `/littlethings on|off` controls automatic low-stakes memory capture (default on), `/reflect` runs an optional evidence-cited pattern investigation (or records that no pattern was found), `/correct <id> <new wording>` preserves an explicit correction, and `/quit` saves a readback-verified handoff. Keep one CLI process per profile; this JSONL demo is **not concurrency-safe**. The default teaching is attributed to Vike and may be questioned. It is not the companion's own memory.

## Acceptance test

1. Start a fresh companion and share a distinct, nonsensitive detail naturally. Don't request a save.
2. Use `/memories` to see whether the model independently proposed an important memory **or an evidenced little thing**. A model refusal or a failed write is *not* presented as success. Everyday candidates require a verbatim quote from the user's message, a permitted low-risk category, and a topic key.
3. Quit, restart, ask about the detail. The new conversation has only saved memories and the explicit handoff, not the old chat transcript.
4. Correct an inaccurate memory with `/correct`, restart and verify the updated answer. Earlier events remain in the local audit journal.
5. Change `OLLAMA_MODEL`, restart and see whether stored identity and memory survive the model change.

### The little things

A companion can quietly preserve low-stakes, owner-shared details such as a morning coffee ritual, a favorite saying, a running joke, or an ordinary story detail—even with a significance rating of 3–6. These are **not** promoted into major life events. A repeated detail with the same topic key in a **different session** records a source-cited reinforcement instead of making a duplicate memory; recurring details may be included as gentle familiarity context, not forced into every answer. Important memories retain the original 7–10 threshold. The default remains a conservative maximum of 10 new automatic memories per day.

Use `/littlethings off` to disable new everyday-memory capture. This **does not delete existing memories or conversation logs**; a full user-controlled retention/deletion system is not implemented yet. `/littlethings` reports status. The automatic filter rejects obvious credentials, sensitive topic keywords, unsupported categories, and unquoted low-stakes claims, but it is **not a privacy or truth guarantee**. Do not test with real secrets. The model can still misinterpret a quote; review `/memories` and use `/correct` for errors.

**Limits:** Retrieval uses basic keyword overlap, not embeddings. Memory significance is model-proposed, not a scientific measure of subjective experience. The handoff is a short sourced excerpt, **not a generated summary**. Reflections remain provisional hypotheses, cite 2–6 existing memory IDs, and may conclude that there is no supported pattern. They never become factual memories automatically. No autonomous external tool execution, multiuser auth, encrypted database, background scheduler, or remote storage exists. The `/correct` command is explicit; recognizing corrections automatically is future work. This demo stores plaintext local logs; use a private profile, protect your disk, and do not store secrets.

**Lineage:** This isolates recurring patterns seen in historical Riverbank CompanionCore/Ember/Kairo/Castor experiments: distinct identity, retrieval, selective moments, correction history, reflection and wake receipts. It credits those experiments without copying their private records, obsolete code, or exposed credentials.

**Next step:** evaluate conversational quality, actual recall of little things, cross-session reinforcement, and the opt-in reflection command with Jason; then add owner-controlled retention/deletion, safer storage, and a portable model adapter only after baseline receipts.
