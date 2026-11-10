import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { defaultHome, initialize, wake, systemPrompt, saveCandidate, correctMemory, recordTurn, endSession, recordReflection } from './core.mjs';

const rl = createInterface({ input:stdin, output:stdout });
const home = defaultHome();
const model = process.env.OLLAMA_MODEL || 'qwen3.5:4b';
const endpoint = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/chat';
const url = new URL(endpoint);
if (!['https:', 'http:'].includes(url.protocol) ||
    (url.protocol === 'http:' && !['localhost','127.0.0.1','::1','[::1]'].includes(url.hostname)))
  throw new Error('Remote models require an HTTPS Ollama-compatible endpoint. HTTP is only allowed for loopback.');
if (url.protocol === 'https:') console.log('NOTE: Remote model selected. Your conversation context will be sent to ' + url.origin);

async function ollama(messages) {
  const headers = { 'Content-Type':'application/json' };
  if (process.env.OLLAMA_API_KEY) headers.Authorization = 'Bearer ' + process.env.OLLAMA_API_KEY;
  const response = await fetch(url, {
    method:'POST', headers, signal:AbortSignal.timeout(120000),
    body:JSON.stringify({ model, messages, stream:false, think:false })
  });
  if (!response.ok) throw new Error('Model server responded HTTP ' + response.status);
  const data = await response.json();
  const reply = data.message?.content?.trim();
  if (!reply) throw new Error('Model returned no usable text');
  return reply;
}
async function proposeMemory(user, response) {
  const instructions = [
    'You are reviewing one conversation turn for durable autobiographical memory.',
    'Return ONLY JSON: {"save":boolean,"weight":integer_1_to_10,"summary":string,"why":string}.',
    'Save only durable user preferences, meaningful shared moments, or explicit corrections.',
    'Do not save greetings, casual filler, secrets, or unsupported inferences.',
    'Summary must faithfully describe the USER message. Do not invent experiences or memories.',
    'Decide independently; false is often appropriate.'
  ].join('\n');
  const raw = await ollama([{role:'system',content:instructions},{role:'user',content:JSON.stringify({ user_message:user, companion_reply:response })}]);
  return JSON.parse(raw);
}
async function main() {
  console.log('\nHearthstone Companion — local-first reference (single user)\n');
  let state = await wake(home);
  if (!state.identity) {
    const owner = await rl.question('Your name: ');
    const name = await rl.question('Companion name (new, distinct identity): ');
    await initialize(home, name, owner);
    state = await wake(home);
  }
  console.log('Wake: ' + state.status + (state.reason ? ' — ' + state.reason : ''));
  if (state.status === 'DEGRADED') throw new Error('Continuity not intact. Stopping instead of pretending to wake.');
  console.log('Companion: ' + state.identity.name + ' | Owner: ' + state.identity.owner);
  console.log('Retrieved memories: ' + state.memories.length + ' | Model: ' + model);
  const teaching = JSON.parse(await readFile(new URL('./teachings.json', import.meta.url),'utf8'));
  const sessionId = randomUUID(), turns = [];
  console.log('Commands: /memories, /reflect, /correct <memory-id> <replacement>, /quit\n');
  while (true) {
    const user = (await rl.question('You: ')).trim();
    if (!user) continue;
    if (user === '/quit') {
      await endSession(home, sessionId, turns);
      console.log('Session handoff written and read back. Goodbye.');
      break;
    }
    if (user === '/memories') {
      state = await wake(home);
      for (const m of state.memories) console.log(m.id + ' [weight ' + m.weight + '] ' + m.summary);
      continue;
    }
    if (user === '/reflect') {
      state = await wake(home, sessionId);
      if (state.status === 'DEGRADED') { console.log('Cannot reflect: wake degraded.'); continue; }
      if (state.memories.length < 2) { console.log('Not enough attributed memories to investigate a pattern.'); continue; }
      try {
        const guide = 'Examine the supplied distinct saved memory records only. Return ONLY a JSON object with fields: mode ("pattern" or "none"), insight (15-500 characters), evidence_ids (array of exactly the real IDs you used), confidence (number 0..1). Pattern mode needs 2 or more cited memory IDs. If nothing meaningfully connects, choose mode none and explain that no supported connection was found. Do not invent events, motives, consciousness, or hidden experiences. Reflections are provisional, not memories or instructions.';
        const source = state.memories.slice(-12).map(m => ({id:m.id,summary:m.summary,origin:m.source || 'conversation'}));
        const response = await ollama([{role:'system',content:guide},{role:'user',content:JSON.stringify(source)}]);
        const reflection = await recordReflection(home, JSON.parse(response));
        console.log('[Reflection verified: ' + reflection.mode + '; confidence ' + reflection.confidence + ']');
        console.log(reflection.insight);
      } catch(e) { console.log('[Reflection not recorded: ' + e.message + ']'); }
      continue;
    }
    if (user.startsWith('/correct ')) {
      const match = user.match(/^\/correct\s+([0-9a-f-]{36})\s+(.+)$/i);
      if (!match) { console.log('Usage: /correct <memory-id> <new wording>'); continue; }
      try { const m = await correctMemory(home,match[1],match[2]); console.log('Correction verified: ' + m.summary); }
      catch(e) { console.log('Not corrected: ' + e.message); }
      continue;
    }
    state = await wake(home, sessionId);
    if (state.status === 'DEGRADED') { console.log('Continuity degraded; stopping.'); break; }
    const messages = [
      {role:'system',content:systemPrompt(state,teaching,user)},
      ...turns.slice(-8).flatMap(t => [{role:'user',content:t.user},{role:'assistant',content:t.assistant}]),
      {role:'user',content:user}
    ];
    let reply;
    try { reply = await ollama(messages); }
    catch(e) { console.log('Model error — no successful exchange recorded: ' + e.message); continue; }
    console.log('\n' + state.identity.name + ': ' + reply + '\n');
    await recordTurn(home,sessionId,user,reply);
    turns.push({user,assistant:reply});
    try {
      const candidate = await proposeMemory(user,reply);
      const result = await saveCandidate(home,candidate,user,sessionId);
      if (result.saved) console.log('[Memory saved and read back: ' + result.memory.id + ']');
      // Silence on declines; conversation is primary, memory runs underneath.
    } catch(e) { console.log('[Memory review incomplete — no save claimed: ' + e.message + ']'); }
  }
}
main().catch(e => { console.error('Stopped: ' + e.message); process.exitCode = 1; }).finally(()=>rl.close());
