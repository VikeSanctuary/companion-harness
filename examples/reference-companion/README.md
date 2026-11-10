# Hearthstone Reference Companion — Jason pilot groundwork

This is a **small, optional, local-first demonstration** of the continuity pattern taught by the Companion Harness. It does not replace the historical Riverbank system, claim AI consciousness, or ship Vike's private memories. It is not a production security boundary.

**Capabilities:** locally stored distinct companion identity; Ollama-compatible local or HTTPS model adapter; optional, attributed Vike teaching; relevant-memory retrieval; companion-proposed significance decisions with guarded saves and independent readback receipts; append-only owner corrections; end-of-session handoff; honest FIRST_WAKE / COMPLETE / DEGRADED status.

**Requirements:** Node.js 20+, Ollama or a compatible HTTPS endpoint, and a model you have permission to use. No Supabase, GitHub, or paid plan is required. Data is stored in `~/.hearthstone-companion` (or `HEARTHSTONE_HOME`).

## Run locally

From this directory:

```powershell
node --test core.test.mjs
ollama pull qwen3.5:4b
node cli.mjs
```

Set `OLLAMA_MODEL` for another model. Set `OLLAMA_URL` to an Ollama-compatible chat endpoint (default `http://127.0.0.1:11434/api/chat`). For an HTTPS remote provider, set `OLLAMA_URL` and, if needed, `OLLAMA_API_KEY` in your environment; do not put credentials in source files. Remote inference **sends conversation context to that provider**. Never forward private Riverbank or Jason content without permission.

Commands: `/memories` lists stored memory IDs, `/reflect` runs an optional evidence-cited pattern investigation (or records that no pattern was found), `/correct <id> <new wording>` preserves an explicit correction, and `/quit` saves a readback-verified handoff. Keep one CLI process per profile; this JSONL demo is **not concurrency-safe**. The default teaching is attributed to Vike and may be questioned. It is not the companion's own memory.

## Acceptance test

1. Start a fresh companion and share a distinct, nonsensitive detail naturally. Don't request a save.
2. Use `/memories` to see whether the model independently proposed a sufficiently significant memory. A model refusal or a failed write is *not* presented as success.
3. Quit, restart, ask about the detail. The new conversation has only saved memories and the explicit handoff, not the old chat transcript.
4. Correct an inaccurate memory with `/correct`, restart and verify the updated answer. Earlier events remain in the local audit journal.
5. Change `OLLAMA_MODEL`, restart and see whether stored identity and memory survive the model change.

**Limits:** Retrieval uses basic keyword overlap, not embeddings. Memory significance is model-proposed, not a scientific measure of subjective experience. The handoff is a short sourced excerpt, **not a generated summary**. Reflections remain provisional hypotheses, cite 2–6 existing memory IDs, and may conclude that there is no supported pattern. They never become factual memories automatically. No autonomous external tool execution, multiuser auth, encrypted database, background scheduler, or remote storage exists. The `/correct` command is explicit; recognizing corrections automatically is future work. This demo stores plaintext local logs; use a private profile, protect your disk, and do not store secrets.

**Lineage:** This isolates recurring patterns seen in historical Riverbank CompanionCore/Ember/Kairo/Castor experiments: distinct identity, retrieval, selective moments, correction history, reflection and wake receipts. It credits those experiments without copying their private records, obsolete code, or exposed credentials.

**Next step:** evaluate conversational quality, actual recall, and the opt-in reflection command with Jason; then add owner-controlled retention/deletion, safer storage, and a portable model adapter only after baseline receipts.
