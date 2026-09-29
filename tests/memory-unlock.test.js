import test from 'node:test';
import assert from 'node:assert/strict';
import * as expedition from '../src/exploration.js';

const at = (q,r) => ({q,r});
function birthdayState(){let s=expedition.createInitialState();for(let n=1;n<=25;n++)s=expedition.move(s,at(0,n%2?-1:-2));return s;}

test('seeing a building reveals its presence without unlocking its memory',()=>{
 const s=expedition.createInitialState();
 assert.ok(expedition.getVisibleKeys(s).includes('1,0'));
 assert.equal(typeof expedition.canInspectMemory,'function');
 assert.equal(expedition.canInspectMemory(s,at(1,0)),false);
 assert.equal(expedition.canInspectMemory(s,at(0,0)),true);
});
test('arrival unlocks a special memory and emits it only on the first visit',()=>{
 const s=expedition.createInitialState(),next=expedition.move(s,at(1,0));
 assert.equal(typeof expedition.getArrivalMemory,'function');
 assert.equal(expedition.getArrivalMemory(s,next)?.id,'canteen');
 assert.equal(expedition.canInspectMemory(next,at(1,0)),true);
 const returned=expedition.move(next,at(0,0)),again=expedition.move(returned,at(1,0));
 assert.equal(expedition.getArrivalMemory(next,returned),null);
 assert.equal(expedition.getArrivalMemory(returned,again),null);
});
test('ordinary scenery, invalid moves, and browsing do not emit a memory',()=>{
 const s=expedition.move(expedition.createInitialState(),at(1,0));
 assert.equal(typeof expedition.getArrivalMemory,'function');
 assert.equal(expedition.getArrivalMemory(s,s),null);
 const next=expedition.move(s,at(1,-1));
 assert.equal(next.steps,s.steps+1);
 assert.equal(expedition.getTile(at(1,-1)).isMemory,false);
 assert.equal(expedition.getArrivalMemory(s,next),null);
 assert.equal(expedition.getArrivalMemory(s,expedition.move(s,at(5,0))),null);
 assert.equal(expedition.canInspectMemory(next,at(1,-1)),false);
});
test('the birthday unlocks every memory while preserving physical visits and first-arrival popups',()=>{
 const s=birthdayState();
 assert.equal(typeof expedition.canInspectMemory,'function');
 assert.equal(expedition.getVisibleKeys(s).length,91);
 const snapshot=structuredClone(s);
 for(const tile of expedition.MEMORY_TILES) assert.equal(expedition.canInspectMemory(s,tile),true,tile.id);
 assert.deepEqual(s,snapshot);
 assert.deepEqual(s.visited,['0,0','0,-1','0,-2']);
 assert.equal(s.trail.length,26);
 assert.equal(expedition.canInspectMemory(s,at(0,1)),false);
 const back=expedition.move(s,at(0,0)),visited=expedition.move(back,at(1,0));
 assert.equal(expedition.getArrivalMemory(back,visited)?.id,'canteen');
 assert.equal(expedition.canInspectMemory(visited,at(1,0)),true);
});
test('a first arrival on the birthday step is retained for the memory popup after the greeting',()=>{
 let s=expedition.createInitialState();for(let n=1;n<=24;n++)s=expedition.move(s,at(n%2?-1:0,0));
 const next=expedition.move(s,at(1,0));
 assert.equal(typeof expedition.getArrivalMemory,'function');
 assert.equal(next.steps,25);
 assert.equal(expedition.getArrivalMemory(s,next)?.id,'canteen');
 assert.equal(expedition.canInspectMemory(next,at(1,0)),true);
});
test('existing saves preserve earned memories without unlocking merely visible buildings',()=>{
 const s=expedition.move(expedition.createInitialState(),at(0,-1));
 const restored=expedition.restoreState(expedition.serializeState(s));
 assert.equal(typeof expedition.canInspectMemory,'function');
 assert.equal(expedition.canInspectMemory(restored,at(0,-1)),true);
 assert.equal(expedition.canInspectMemory(restored,at(1,0)),false);
 assert.equal(expedition.canInspectMemory(null,at(1,0)),false);
});

test('step 24 keeps an unvisited memory locked and a valid restored step 25 opens it',()=>{
 let state=expedition.createInitialState();
 for(let n=1;n<=24;n++)state=expedition.move(state,at(n%2?-1:0,0));
 assert.equal(expedition.canInspectMemory(state,at(1,0)),false);
 const finished=expedition.move(state,at(-1,0));
 const restored=expedition.restoreState(expedition.serializeState(finished));
 assert.equal(expedition.canInspectMemory(restored,at(1,0)),true);
 assert.deepEqual(restored.visited,finished.visited);
 assert.deepEqual(restored.trail,finished.trail);
});

test('an invented step count cannot open the collection without a valid traversal',()=>{
 for(const state of [null,{}, {steps:25}, {...expedition.createInitialState(),steps:25}]){
  for(const tile of expedition.MEMORY_TILES) assert.equal(expedition.canInspectMemory(state,tile),false);
 }
});
