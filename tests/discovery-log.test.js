import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiscoveryLog } from '../src/discovery-log.js';
import { createInitialState, move, getVillageVisits, MEMORY_TILES } from '../src/exploration.js';
import { walkTo, memoryTile, villageTile } from './helpers/exploration.js';

test('new memories light both book dots, opening one only clears that book',()=>{
 const log=createDiscoveryLog(),start=createInitialState(),next=move(start,memoryTile('canteen'));
 assert.deepEqual(log.getUnread(),{journal:false,timeline:false});
 log.advance(start,next);
 assert.deepEqual(log.getUnread(),{journal:true,timeline:true});
 log.acknowledge('journal');
 assert.deepEqual(log.getUnread(),{journal:false,timeline:true});
 log.acknowledge('timeline');
 log.advance(next,move(next,{q:0,r:0}));
 assert.deepEqual(log.getUnread(),{journal:false,timeline:false});
});

test('ordinary passing turns do not repeatedly nag the player',()=>{
 const log=createDiscoveryLog(),start=createInitialState(),next=move(start,{q:0,r:1});
 log.advance(start,next);
 assert.deepEqual(log.getUnread(),{journal:false,timeline:false});
});

test('a village then revealing its gift creates a same-turn event without a fake move',()=>{
 const state=walkTo(createInitialState(),villageTile('village-meadow').id);
 const log=createDiscoveryLog();
 const id=getVillageVisits(state).at(-1).unlockedIds[0];
 const memory=memoryTile(id),before=structuredClone(state);
 assert.equal(log.reveal(state,memory,{inJournal:true}),true);
 assert.deepEqual(log.getDiscoveries(),[{id:`reveal:${id}`,step:state.steps,memoryId:id}]);
 assert.deepEqual(log.getUnread(),{journal:false,timeline:true});
 assert.equal(log.reveal(state,memory),false);
 assert.deepEqual(state,before);
});

test('unavailable or physically visited memories cannot fabricate extra entries',()=>{
 const log=createDiscoveryLog(),state=createInitialState();
 assert.equal(log.reveal(state,memoryTile('school')),false);
 assert.equal(log.reveal(state,memoryTile('love')),false);
 assert.equal(log.reveal(state,{id:'unknown'}),false);
 assert.deepEqual(log.getDiscoveries(),[]);
});

test('birthday unlock, manual reveal and reset keep notifications independent',()=>{
 const log=createDiscoveryLog();let state=createInitialState();
 for(let step=1;step<=24;step++)state=move(state,{q:step%2,r:0});
 const next=move(state,{q:1,r:0});log.advance(state,next);
 assert.deepEqual(log.getUnread(),{journal:true,timeline:true});
 log.acknowledge('journal');log.acknowledge('timeline');
 const tile=MEMORY_TILES.find(tile=>tile.id==='love');
 log.reveal(next,tile,{inJournal:true});
 assert.deepEqual(log.getUnread(),{journal:false,timeline:true});
 log.reset();assert.deepEqual(log.getDiscoveries(),[]);
 assert.deepEqual(log.getUnread(),{journal:false,timeline:false});
});
