import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initialize, wake, validateCandidate, saveCandidate, activeMemories, correctMemory, recordTurn, endSession, retrieve, recordReflection, littleThingsEnabled, setLittleThingsEnabled } from './core.mjs';

const temp = async fn => {
  const path = await mkdtemp(join(tmpdir(), 'hearthstone-test-'));
  try { await fn(path); } finally { await rm(path,{recursive:true,force:true}); }
};
test('first wake has a distinct companion identity and no invented memory', async()=>temp(async h=>{
  const created = await initialize(h,'Willow','Jason');
  const w = await wake(h);
  assert.equal(w.status,'FIRST_WAKE'); assert.equal(w.identity.id,created.id); assert.equal(w.memories.length,0);
}));
test('selective memory decline and readback-verifiable preservation', async()=>temp(async h=>{
  await initialize(h,'Willow','Jason');
  assert.equal(validateCandidate({save:false},'hi').ok,false);
  assert.equal(validateCandidate({save:true,weight:3,summary:'A harmless note',why:'low'},'hi').ok,false);
  const candidate = {save:true,weight:9,summary:'Jason remembers swinging from willow branches above a creek in Coburg as a child.',why:'Meaningful childhood memory'};
  const saved = await saveCandidate(h,candidate,'At Nanny’s we swung from willow branches over the creek in Coburg.','s1');
  assert.equal(saved.saved,true); assert.equal(saved.receipt.verified,true);
  const w = await wake(h); assert.equal(w.memories.length,1); assert.equal(w.memories[0].id,saved.memory.id);
  assert.equal((await saveCandidate(h,candidate,'same again','s1')).saved,false);
  assert.equal(retrieve(w.memories,'What was that willow tree creek story?')[0].id,saved.memory.id);
}));
test('corrections preserve event history but change active recall', async()=>temp(async h=>{
  await initialize(h,'Willow','Jason');
  const c={save:true,weight:8,summary:'Jason calls his evening reading ritual Moon Break.',why:'Personal ritual'};
  const s=await saveCandidate(h,c,'I call my reading time Moon Break.','s1');
  await correctMemory(h,s.memory.id,'Jason calls his evening reading ritual Willow Hour.');
  const w=await wake(h); assert.equal(w.memories[0].summary,'Jason calls his evening reading ritual Willow Hour.');
  assert.equal(w.memories[0].source,'owner_correction');
}));
test('new session has honest, verified handoff',async()=>temp(async h=>{
  await initialize(h,'Willow','Jason');
  await endSession(h,'session-one',[{user:'We talked about the creek.',assistant:'Tell me more.'}]);
  const w=await wake(h);
  assert.equal(w.status,'FIRST_WAKE'); // No saved memory or recorded chat; handoff is still present.
  assert.equal(w.handoff.session_id,'session-one');
  assert.equal(w.handoff.kind,'conversation_excerpts_not_model_summary');
}));
test('unreadable memory record degrades wake instead of claiming success',async()=>temp(async h=>{
  await initialize(h,'Willow','Jason');
  await writeFile(join(h,'memory-events.jsonl'),'{broken json}\n');
  const w=await wake(h); assert.equal(w.status,'DEGRADED');
}));
test('do not automatically preserve apparent secrets',()=>{
  assert.equal(validateCandidate({save:true,weight:10,summary:'Remember the service_role password',why:'important'},'test').ok,false);
});

test('active session is not confused with an unsealed previous session',async()=>temp(async h=>{
  await initialize(h,'Willow','Jason');
  await recordTurn(h,'active-session','What a beautiful creek!','Tell me about it.');
  assert.equal((await wake(h,'active-session')).status,'COMPLETE');
  const failed = await wake(h);
  assert.equal(failed.status,'DEGRADED');
  await endSession(h,'active-session',[{user:'What a beautiful creek!',assistant:'Tell me about it.'}]);
  assert.equal((await wake(h)).status,'COMPLETE');
}));

test('reflection requires actual evidence and permits honest no-pattern results',async()=>temp(async h=>{
  await initialize(h,'Willow','Jason');
  const one=await saveCandidate(h,{save:true,weight:8,summary:'Jason enjoyed his childhood willow branch swings.',why:'Meaningful history'},'I liked swinging on willows.','s');
  const two=await saveCandidate(h,{save:true,weight:8,summary:'Jason remembers the creek running behind Nanny’s house.',why:'Meaningful history'},'The creek was near Nanny’s.','s');
  await assert.rejects(()=>recordReflection(h,{mode:'pattern', insight:'Potential recurring childhood nostalgia', confidence:0.6, evidence_ids:['made-up','fake']}));
  const yes=await recordReflection(h,{mode:'pattern', insight:'Both memories concern the childhood creek and willow setting.', confidence:0.5, evidence_ids:[one.memory.id,two.memory.id]});
  assert.equal(yes.status,'provisional_not_factual_memory');
  const none=await recordReflection(h,{mode:'none', insight:'Nothing else connects reliably from these two records.', confidence:0.1, evidence_ids:[]});
  assert.equal(none.mode,'none');
  const w=await wake(h);
  assert.equal(w.reflections.length,2);
  assert.equal(w.memories.length,2);
}));

test('a small real-life ritual can be preserved with exact user evidence below weight seven',async()=>temp(async h=>{
  await initialize(h,'Willow','Jason');
  const source='I always take my tea out to the veranda after dinner.';
  const c={save:true,kind:'little_thing',weight:4,category:'ritual',key:'evening_veranda_tea',summary:'Jason likes tea on the veranda after dinner.',why:'Ordinary recurring comfort ritual',evidence:'my tea out to the veranda after dinner'};
  assert.equal(validateCandidate(c,source).ok,true);
  const first=await saveCandidate(h,c,source,'session-a');
  assert.equal(first.saved,true); assert.equal(first.receipt.verified,true);
  const w=await wake(h);
  assert.equal(w.memories.length,1);
  assert.equal(w.memories[0].memory_type,'little_thing');
  assert.equal(w.memories[0].mentions,1);
  assert.equal(w.memories[0].source_excerpt,c.evidence);
  assert.equal(retrieve(w.memories,'Do I have a veranda tea ritual?')[0].id,first.memory.id);
}));
test('repeated little details strengthen familiarity across sessions, without duplicating',async()=>temp(async h=>{
  await initialize(h,'Willow','Jason');
  const firstSource='I love my caramel coffee in the mornings.';
  const firstCandidate={save:true,kind:'little_thing',weight:4,category:'ritual',key:'morning_caramel_coffee',summary:'The user loves caramel coffee in the mornings.',why:'Recurring ritual',evidence:'my caramel coffee in the mornings'};
  const first=await saveCandidate(h,firstCandidate,firstSource,'session-a');
  const againSource='Had my caramel coffee again today, beautiful morning.';
  const againCandidate={...firstCandidate,evidence:'my caramel coffee again today'};
  assert.equal((await saveCandidate(h,againCandidate,againSource,'session-a')).saved,false);
  const repeat=await saveCandidate(h,againCandidate,againSource,'session-b');
  assert.equal(repeat.saved,false); assert.equal(repeat.reinforced,true);
  assert.equal(repeat.receipt.verified,true);
  const w=await wake(h);
  assert.equal(w.memories.length,1);
  assert.equal(w.memories[0].id,first.memory.id);
  assert.equal(w.memories[0].mentions,2);
  assert.deepEqual(w.memories[0].sessions_seen,['session-a','session-b']);
}));
test('everyday capture has a local verified off switch; significant saves still work',async()=>temp(async h=>{
  await initialize(h,'Willow','Jason');
  const source='I keep a duck-shaped mug on the kitchen table.';
  const candidate={save:true,kind:'little_thing',weight:4,category:'humor',key:'duck_mug',summary:'Owner keeps a duck-shaped mug in the kitchen.',why:'Personal running detail',evidence:'a duck-shaped mug'};
  assert.equal(await littleThingsEnabled(h),true);
  assert.equal(await setLittleThingsEnabled(h,false),false);
  assert.equal((await saveCandidate(h,candidate,source,'s1')).saved,false);
  assert.equal((await wake(h)).memories.length,0);
  const significant=await saveCandidate(h,{save:true,weight:9,summary:'The owner decided to start a new research project.',why:'Important project commitment'},'I decided to start a new research project.','s1');
  assert.equal(significant.saved,true);
  assert.equal(await setLittleThingsEnabled(h,true),true);
  assert.equal((await saveCandidate(h,candidate,source,'s2')).saved,true);
  assert.equal((await wake(h)).memories.length,2);
}));
test('little things require source quotation and reject private or sensitive facts',()=>{
  const candidate={save:true,kind:'little_thing',weight:4,category:'ritual',key:'evening_ritual',summary:'The owner drinks tea at sunset.',why:'Routine',evidence:'drink tea at sunset'};
  assert.equal(validateCandidate(candidate,'I drink tea at sunset.').ok,true);
  assert.equal(validateCandidate({...candidate,evidence:'I visited Mars'},'I drink tea at sunset.').ok,false);
  assert.equal(validateCandidate({...candidate,summary:'The owner has a medical diagnosis.'},'I drink tea at sunset.').ok,false);
  assert.equal(validateCandidate({...candidate,category:'medical'},'I drink tea at sunset.').ok,false);
  assert.equal(validateCandidate({...candidate,weight:2},'I drink tea at sunset.').ok,false);
});
