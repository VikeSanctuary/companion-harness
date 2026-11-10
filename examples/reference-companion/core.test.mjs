import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initialize, wake, validateCandidate, saveCandidate, activeMemories, correctMemory, endSession, retrieve } from './core.mjs';

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
