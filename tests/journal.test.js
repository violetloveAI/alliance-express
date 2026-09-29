import test from 'node:test';
import assert from 'node:assert/strict';
import { getJournalPages, memory, birthdayState } from './journal-fixture.js';
import { createInitialState, move, MEMORY_TILES, tileKey } from '../src/exploration.js';

test('collection only lists discovered places and unlocks by a visit',()=>{
 let state=createInitialState();
 let pages=getJournalPages(state);
 assert.deepEqual(pages.filter(p=>p.unlocked).map(p=>p.tile.id),['school']);
 assert.equal(pages.find(p=>p.tile.id==='canteen').unlocked,false);
 assert.ok(pages.length<MEMORY_TILES.length);
 state=move(state,memory('canteen'));
 pages=getJournalPages(state);
 assert.equal(pages.find(p=>p.tile.id==='canteen').unlocked,true);
 assert.equal(pages.find(p=>p.tile.id==='dorm').unlocked,false);
});
test('step 25 permits every page but leaves unread illustrations sealed',()=>{
 const state=birthdayState();
 const before=structuredClone(state);
 const pages=getJournalPages(state);
 assert.equal(pages.length,33);
 assert.equal(pages.length,MEMORY_TILES.length);
 assert.ok(pages.every(p=>p.unlocked));
 assert.deepEqual(pages.filter(p=>p.revealed).map(p=>p.tile.id),['school','canteen']);
 assert.equal(getJournalPages(state,'eggs').length,14);
 assert.equal(getJournalPages(state,'memories').length,19);
 assert.deepEqual(state,before);
 assert.deepEqual(state.visited,['school','canteen'].map(id=>tileKey(memory(id))));
});

test('a manually revealed page stays open, without changing travel history',()=>{
 const state=birthdayState();
 const before=structuredClone(state);
 const pages=getJournalPages(state,'all',['dorm']);
 assert.equal(pages.find(p=>p.tile.id==='dorm').revealed,true);
 assert.equal(pages.find(p=>p.tile.id==='foshan').revealed,false);
 assert.deepEqual(state,before);
 const all=getJournalPages(state,'all',MEMORY_TILES.map(tile=>tile.id));
 assert.ok(all.every(p=>p.revealed));
});

test('read markers cannot unseal an ineligible early page and new books start sealed',()=>{
 const state=createInitialState();
 assert.equal(getJournalPages(state,'all',['canteen']).find(p=>p.tile.id==='canteen').revealed,false);
 assert.equal(getJournalPages(state).find(p=>p.tile.id==='canteen').revealed,false);
});
