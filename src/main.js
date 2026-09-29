import './style.css';
import './responsive.css';
import './paper-theme.css';
import './journal.css';
import './hero-portraits.css';
import './prologue.css';
import './journey-opening.css';
import './step-counter.css';
import './timeline.css';
import './image-preview.css';
import './image-preview-triggers.css';
import './tooltips.css';
import './village.css';
import './journey-tools.css';
import './discovery-ui.css';
import { createMemoryArt } from './memory-art.js';
import { createInitialState, move, getTile, MEMORY_TILES, tileKey, getVisibleKeys, canInspectMemory, getArrivalMemory, getNeighbors, getVillageArrival, getVillageVisits } from './exploration.js';
import { ExplorationScene } from './scene.js';
import { getBuildingPhotoStatus } from './photo-access.js';
import { createJournal } from './journal.js';
import { JourneyAudio } from './audio.js';
import { SELECTED_SOUNDS } from './audio-selections.js';
import { createOnboarding } from './onboarding.js';
import { createTimeline } from './timeline.js';
import { createImagePreview } from './image-preview.js';
import { installTooltips } from './tooltips.js';
import { createVillageDialog } from './village-dialog.js';
import { createDiscoveryLog } from './discovery-log.js';
import { createLoadingScreen, dismissLoadingScreen } from './loading-screen.js';

const asset = name => `${import.meta.env.BASE_URL}assets/${name.replace(/\.png$/, ".webp")}`;
const icons = {
 album:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 3-3 4 4"/>',
 sound:'<path d="m11 4-6 5H2v6h3l6 5zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
 muted:'<path d="m11 4-6 5H2v6h3l6 5zM16 9l5 6m0-6-5 6"/>',
 compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6z"/>',
 map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zm6-2v16m6-14v16"/>',
 journal:'<path d="M5 3h13a2 2 0 0 1 2 2v16H5a3 3 0 0 1 0-6h15M5 3a3 3 0 0 0-3 3v12m6-11h8m-8 4h5"/>',
 timeline:'<path d="M3 5h18v14H3zM3 10h18M7 3v4m5-4v4m5-4v4M6 14h3m3 0h2m3 0h1M6 17h6"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 3h.01"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 gift:'<path d="M3 9h18v4H3zm2 4v8h14v-8M12 9v12m0-12C7 9 5 7 6 5s5-1 6 4c1-5 5-6 6-4s-1 4-6 4Z"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
let state=createInitialState();
const discoveryLog=createDiscoveryLog();
let busy=false,gameStarted=false,celebrationTimer=null,toastTimer=null,birthdayRevealPending=false,pendingBirthdayMemory=null,pendingBirthdayVillage=null;
let journeyPresentation=0;
let scenePrepared=false;
let coverReady=false;
const audio=new JourneyAudio({musicUrl:`${import.meta.env.BASE_URL}audio/carefree.mp3`,sounds:SELECTED_SOUNDS});
document.querySelector('#app').innerHTML=`
 <div class="game-shell">
  <header class="topbar">
   <div class="brand"><span class="brand-monogram" aria-hidden="true">✿</span><div><h1 aria-label="同盟漫游记"><span class="painted-title" aria-hidden="true"><i>同</i><i>盟</i><i>漫</i><i>游</i><i>记</i></span></h1><p>WATER SHEEP & VIOLET</p></div></div>
   <nav class="top-actions" aria-label="游戏工具">
    <button class="tool-button" id="journal-button" aria-label="打开回忆册">${icon('journal')}<span>收藏册</span><span class="unread-dot" aria-hidden="true" hidden></span></button>
    <button class="tool-button" id="timeline-button" aria-label="打开本局年表">${icon('timeline')}<span>年表</span><span class="unread-dot" aria-hidden="true" hidden></span></button>
    <button class="icon-button" id="sound-button" aria-label="开启声音" aria-pressed="false">${icon('muted')}</button>
    <button class="icon-button help-button" id="help-button" aria-label="玩法说明">${icon('help')}</button>
   </nav>
  </header>
  <main class="game-frame">
   <section class="world-viewport" aria-label="回忆地图">
    <div id="scene"></div>
    <div class="journey-arrival" aria-hidden="true"><span>同盟列车 · 第一站</span><strong>老队友，我们到啦。</strong><small>这次，往心情指的方向走。</small></div>
    <div class="map-heading"><p class="eyebrow">A LITTLE WORLD OF US</p><h2 id="map-title">老队友，随便走走。</h2><p id="map-subtitle">回忆藏在雾里。选一格，出发。</p></div>
    <div class="map-stats"><span class="status-dot"></span><span id="map-discoveries"></span></div>
    <div class="map-zoom" role="group" aria-label="地图缩放"><button id="zoom-out" aria-label="缩小地图">−</button><output id="zoom-level" aria-label="地图缩放比例">100%</output><button id="zoom-in" aria-label="放大地图">+</button></div><div class="map-tools"><button id="overview-button" class="map-tool" aria-label="查看整张地图">${icon('map')}<span>看地图</span></button><button id="center-button" class="map-tool" aria-label="回到列车">${icon('compass')}<span>找列车</span></button></div>
    <div class="map-bottom-note"><span id="map-hint">点亮着的相邻格移动 · 拖动地图环顾四周</span><span class="map-coordinate" id="map-coordinate"></span></div>
    <div class="discovery-toast" id="toast" role="status" aria-live="polite"></div>
   </section>
   <section class="travel-dock" aria-label="当前探索状态">
    <div class="step-counter"><span class="eyebrow" id="step-label">漫游步数</span><div class="step-counter__value"><strong id="step-count">0</strong><span class="step-counter__unit">步</span></div></div>
    <div class="current-memory"><div class="memory-heading"><span class="memory-tag" id="memory-tag">老队友已就位</span></div><h3 id="memory-title"></h3><p id="memory-description"></p></div>
    <div class="dock-actions"><button class="primary-button" id="memory-button">${icon('journal')}<span>翻开这段回忆</span>${icon('arrow')}</button><p id="dock-hint">没有规定路线，跟着心情走。</p></div>
   </section>
  </main>
  <footer class="page-footer"><span>两位老队友 · 一张共同地图</span><span id="footer-message">下一顿饭，也一起。</span><div class="footer-tools"><button id="cover-button" class="text-button">回到封面</button></div></footer>
 </div>
 <dialog id="memory-dialog" class="memory-dialog" aria-labelledby="memory-dialog-title"><button class="dialog-close" data-close aria-label="关闭回忆">×</button><div class="memory-art"><img id="memory-dialog-art" alt=""/></div><div class="memory-dialog-copy"><p class="eyebrow" id="memory-dialog-badge">OUR LITTLE ARCHIVE</p><h2 id="memory-dialog-title"></h2><p id="memory-dialog-date" class="memory-date" hidden></p><p id="memory-dialog-description"></p><button id="memory-photos" class="primary-button">${icon('album')}翻翻我们的照片 ${icon('arrow')}</button><button class="text-button" data-close>收好，继续走</button></div></dialog>
 <dialog id="journal-dialog" class="journal-dialog" aria-labelledby="journal-title"><button class="dialog-close" data-close aria-label="关闭回忆册">×</button><header class="journal-header"><div><p class="eyebrow">WATER SHEEP & VIOLET</p><h2 id="journal-title">我们的小小<span>收藏册</span></h2><p class="dialog-intro" id="journal-intro"></p></div><div class="journal-stamp"><span>插画收集</span><strong id="journal-count"></strong><span>慢慢贴，慢慢逛</span></div></header><div class="journal-tabs" role="group" aria-label="收藏分类"><button data-journal-filter="all" aria-pressed="true">全部小故事</button><button data-journal-filter="memories" aria-pressed="false">我们的回忆</button><button data-journal-filter="eggs" aria-pressed="false">兴趣小彩蛋</button></div><div id="journal-list" class="journal-list"></div><p id="journal-bottom-note" class="journal-bottom-note"></p></dialog>
 <dialog id="help-dialog" class="small-dialog" aria-labelledby="help-title"><button class="dialog-close" data-close aria-label="关闭玩法说明">×</button><p class="eyebrow">TAKE YOUR TIME</p><h2 id="help-title">随便走走，就很好。</h2><ol class="help-list"><li><strong>选一个方向。</strong><span>点击列车旁发亮的六边格，一格算一步。走过的地方也可以再去。</span></li><li><strong>慢慢发现。</strong><span>近处的雾散开，就能看见建筑。第一次开车到达时，会自动翻开回忆或彩蛋。</span></li><li><strong>把回忆收好。</strong><span>到过的地方，随时点名字重看。照片也放在收藏册的「照片」页签中。走满 25 步，整张地图开放；收藏册里的未读页仍装在信封里，可以逐个揭晓，也可以一键全部揭开。用 + / −、滚轮或双指缩放，拖动看远处；这些都不计步。</span></li><li><strong>去村庄做客。</strong><span>地图藏着 5 个小村庄。首次经过会收到礼物：随机解锁一两处回忆、拨开周围第二圈迷雾，或发现通向回忆的小径。每个村庄只送一次，不额外计步。</span></li><li><strong>翻翻本局年表。</strong><span>上方的年表按钮会留下每一回合的足迹。同一回合可以有好几个片段，比如到访村庄后再打开一段回忆。左右滑动就能回看，新内容会用小红点提醒。小按钮悬停或长按，会出现玩法小纸条。</span></li></ol><p class="help-note">键盘也能玩：Tab 选择相邻格，Enter 出发。每次进入都会开启一段新的漫游，不保留上次进度。</p><p class="help-note">音乐：<a href="https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400037" target="_blank" rel="noopener">“Carefree” — Kevin MacLeod (incompetech.com)</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a> · 原曲单曲循环</p><p class="help-note">排铃音效：<a href="https://freesound.org/s/78206/" target="_blank" rel="noopener">bar chimes ascending — joedeshon</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>。<a href="${import.meta.env.BASE_URL}audio/licenses/ATTRIBUTION.txt" target="_blank" rel="noopener">全部音频来源与授权</a></p><button class="primary-button" data-close>知道了，出发 ${icon('arrow')}</button></dialog>
 <dialog id="birthday-dialog" class="birthday-dialog" aria-labelledby="birthday-title"><button class="dialog-close" data-close aria-label="收好祝福，继续探索">×</button><div class="birthday-art"><img data-src="${asset('birthday-station.png')}" alt="Water Sheep 和 Violet 在生日车站一起庆祝"/><span>10 / 03</span></div><div class="birthday-copy"><p class="eyebrow">TO MY ALWAYS-ALLY</p><h2 id="birthday-title">25 岁，生日快乐。<br><em>Water Sheep.</em></h2><p>有些回合，我们一起打游戏。<br>更多时候，我们只是一起吃了顿饭，<br>再慢慢走上一小段。</p><p>从学校食堂，到后来每次「出来吃饭」，<br>能一直和你做朋友，是件很好的事。</p><p class="birthday-wish">愿你新的一岁，开开心心，<br>有想去的地方，也有随时能约的老队友。</p><span class="signature">一直和你同盟的 Violet<br><time class="birthday-date" datetime="2026-10">2026年10月</time></span><button id="birthday-continue" class="primary-button">整张地图，都是我们的 ${icon('arrow')}</button><p class="birthday-footnote">所有照片都能看了。收藏册里没拆过的信封，留给你慢慢揭晓。</p></div></dialog>`;
const $=selector=>document.querySelector(selector);
const imagePreview=createImagePreview();
const previewArt=(source,options)=>imagePreview.open(source,options);
const scene=new ExplorationScene($('#scene'),{
 onMove:go,
 onInspect:tile=>{if(!busy&&gameStarted)showMemory(tile);},
 onLocked:tile=>{if(!busy&&gameStarted)toast(`「${tile.title}」已经看见，开车到这一格就能翻开。`);},
 onVillage:tile=>{if(busy||!gameStarted)return;const visit=getVillageVisits(state).find(v=>v.villageId===tile.id);if(visit)villageDialog.open(visit);else toast(`「${tile.title}」等你来做客。首次开车到达，就能收到村庄的小礼物。`);},
 onPan:detached=>$('#center-button').classList.toggle('attention',detached),
 onZoom:percent=>{$('#zoom-level').textContent=`${percent}%`;},
});
const onboarding=createOnboarding({
 onStart:()=>{
  resetJourney();audio.start().then(updateSoundButton);updateSoundButton();
  const presentation=journeyPresentation;
  scenePrepared=false;
  scene.prepareAssets(state).then(()=>{if(presentation===journeyPresentation)scenePrepared=true;})
   .catch(()=>{scenePrepared=false;});
  onboarding.showPrologue();
 },
 onTutorialComplete:async()=>{
  const presentation=++journeyPresentation;
  busy=true;gameStarted=false;render();
  if(!scenePrepared){
   const loader=createLoadingScreen();loader.show('悄悄铺好最后一段路，就可以出发啦。');
   try{
    await scene.prepareAssets(state,{onProgress:({completed,total})=>loader.update(total?1+Math.floor(completed/total*99):100)});
    if(presentation!==journeyPresentation)return;
    await loader.finish();
    if(presentation!==journeyPresentation)return;
    scenePrepared=true;
   }catch(error){console.warn('Map could not be prepared:',error);loader.error();return;}
   if(presentation!==journeyPresentation)return;
  }
  $('.game-shell').classList.add('journey-arriving');
  audio.play('ui-confirm');
  await scene.playArrival();
  if(presentation!==journeyPresentation)return;
  $('.game-shell').classList.remove('journey-arriving');
  busy=false;gameStarted=true;render();
 },
});
const journal=createJournal({dialog:$('#journal-dialog'),getState:()=>state,asset,openDialog,onRead:tile=>showMemory(tile,{fromJournal:true}),onLocate:tile=>scene.flyTo(tile),onBirthday:()=>{scene.flyTo(state.birthdayAt);openDialog($('#birthday-dialog'),'memory-open');},getPhotoStatus:getBuildingPhotoStatus,
 onReveal:tile=>{discoveryLog.reveal(state,tile,{inJournal:true});renderBookBadges();},
 onOpen:()=>{discoveryLog.acknowledge('journal');renderBookBadges();},onPhotoChange:()=>audio.play('page-turn'),onPreview:previewArt});
const timeline=createTimeline({getState:()=>state,getDiscoveries:()=>discoveryLog.getDiscoveries(),asset,openDialog,onRead:showMemory,onLocate:tile=>scene.flyTo(tile),onOpen:()=>{discoveryLog.acknowledge('timeline');renderBookBadges();},onPreview:previewArt});
const villageDialog=createVillageDialog({asset,openDialog,onRead:showMemory,onLocate:tile=>scene.flyTo(tile)});
function resetJourney(){
 dismissLoadingScreen();
 journeyPresentation++;$('.game-shell').classList.remove('journey-arriving');
 onboarding.hide();
 imagePreview.close({restoreFocus:false});
 clearTimeout(celebrationTimer);clearTimeout(toastTimer);birthdayRevealPending=false;pendingBirthdayMemory=null;pendingBirthdayVillage=null;
 audio.stopEffects();$('#toast').classList.remove('visible');
 state=createInitialState();busy=false;gameStarted=false;discoveryLog.reset();journal.close();journal.reset();timeline.close();villageDialog.close();
 for(const dialog of document.querySelectorAll('dialog[open]:not(.onboarding)'))dialog.close();
 scene.setState(state);scene.centerOnPlayer(false);render();
}
function render(){
 renderBookBadges();
 const tile=getTile(state.position),done=Boolean(state.birthdayAt),eve=state.steps===24,birthdayHere=done&&tileKey(state.position)===tileKey(state.birthdayAt);
 $('#step-count').textContent=String(state.steps);
 $('.step-counter').dataset.milestone=String(state.steps===25||(state.steps===24&&!busy));
 $('#step-label').textContent=done?'继续漫游':'漫游步数';
 $('#map-discoveries').textContent=done?'整张地图已展开':`已探照 ${getVisibleKeys(state).length} 格`;
 $('#map-coordinate').textContent=`${state.position.q >= 0?'+':''}${state.position.q} · ${state.position.r>=0?'+':''}${state.position.r}`;
 $('#map-title').textContent=eve?'下一步，有份礼物。':done?'好风景，都在这里。':'老队友，随便走走。';
 $('#map-subtitle').textContent=eve?'选哪个方向都可以。':done?'地图全貌已展开，没拆过的小故事等你揭晓。':'回忆藏在雾里。选一格，出发。';
 $('#memory-tag').textContent=eve?'礼物已就位':done&&tileKey(state.position)===tileKey(state.birthdayAt)?'生日快乐！':tile.isVillage?'村庄的小礼物':tile.isMemory?(tile.kind==='easter-egg'?'这一格的彩蛋':'这一格的回忆'):'沿途的风景';
 $('#memory-title').textContent=eve?'不用猜，往哪走都对。':birthdayHere?'25 岁，生日快乐。':tile.title;
 $('#memory-description').textContent=eve?'下一格，留给你。':birthdayHere?'给 Water Sheep 留了一个大蛋糕，和一整张装着回忆的地图。':tile.isVillage?(getVillageVisits(state).find(v=>v.villageId===tile.id)?.description??tile.description):tile.description;
 $('#memory-button').disabled=busy||(!tile.isMemory&&!tile.isVillage&&!done);$('#memory-button span').textContent=birthdayHere?'再读一次生日祝福':tile.isVillage?'看看村庄的礼物':tile.isMemory?(tile.kind==='easter-egg'?'看看这个彩蛋':'翻开这段回忆'):done?'看看全部回忆':'去下一格看看';
 $('#dock-hint').textContent=busy?'列车正在靠站…':eve?'挑一个礼物格，出发。':done?`地图里有 ${MEMORY_TILES.length} 处发现，慢慢看。`:getNeighbors(state.position).length<6?'已经来到岸边，沿着陆地继续走吧。':'没有规定路线，跟着心情走。';
 $('#map-hint').textContent=busy?'老队友，坐稳啦。':eve?'点任意相邻礼物格，拆开惊喜':done?'点地点名字翻回忆 · 也可以继续开车':'点相邻格开车 · 滚轮 / 双指缩放';
 $('#overview-button').disabled=busy;$('#center-button').disabled=busy;
 $('#footer-message').textContent=done?'下一顿饭，也一起。':'THE ALLIANCE CONTINUES';
 $('#cover-button').disabled=busy;
 for(const id of ['journal-button','timeline-button','help-button','zoom-in','zoom-out'])$(`#${id}`).disabled=busy;
}
function renderBookBadges(){
 const unread=discoveryLog.getUnread();
 for(const book of ['journal','timeline']){
  const button=$(`#${book}-button`);
  button.querySelector('.unread-dot').hidden=!unread[book];
  button.setAttribute('data-unread',String(unread[book]));
  button.setAttribute('aria-description',unread[book]?'有新收录的内容，打开看看。':'已经查看过本次新增内容。');
 }
}
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2900);}
async function go(destination){
 if(busy||!gameStarted||document.querySelector('dialog[open]'))return;
 const next=move(state,destination);if(next===state)return;
 const arrival=getArrivalMemory(state,next);
 const villageArrival=getVillageArrival(state,next);
 discoveryLog.advance(state,next);
 state=next;busy=true;render();audio.play(state.steps===25?'gift-open':'move');
 await scene.travel(state);busy=false;render();
 if(state.steps===25){
  pendingBirthdayMemory=arrival;pendingBirthdayVillage=villageArrival;birthdayRevealPending=true;toast('25 岁，生日快乐！整张地图已为你打开。');busy=true;render();
  celebrationTimer=setTimeout(()=>{busy=false;render();journal.close();openDialog($('#birthday-dialog'),'birthday');},1300);
 }else if(state.steps===24){
  $('#toast').classList.remove('visible');audio.play('gift-ready');
  if(arrival)showMemory(arrival,{firstVisit:true,silent:true});
  else if(villageArrival)villageDialog.open(villageArrival);
 }else if(arrival){showMemory(arrival,{firstVisit:true});}
 else if(villageArrival){villageDialog.open(villageArrival);}
 else if(getNeighbors(state.position).length<6){toast('到小岛岸边啦，沿着草地换个方向继续走。');}
}
const openers=new WeakMap();
function openDialog(dialog,cue){if(!dialog.open){
 for(const image of dialog.querySelectorAll('img[data-src]')){image.src=image.dataset.src;delete image.dataset.src;}
 openers.set(dialog,document.activeElement);dialog.showModal();if(cue)audio.play(cue);
}}
for(const dialog of document.querySelectorAll('dialog:not(.photo-album):not(.onboarding):not(.timeline-dialog):not(.village-dialog):not(.image-preview)')){
 dialog.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
 let backdrop=false;dialog.addEventListener('pointerdown',event=>{backdrop=event.target===dialog;});dialog.addEventListener('click',event=>{if(backdrop&&event.target===dialog)dialog.close();backdrop=false;});
 dialog.addEventListener('close',()=>{const opener=openers.get(dialog);if(opener?.isConnected)opener.focus({preventScroll:true});});
}
const memoryArtwork=$('#memory-dialog .memory-art');
memoryArtwork.classList.add('image-preview-trigger');
memoryArtwork.setAttribute('role','button');
memoryArtwork.setAttribute('tabindex','0');
memoryArtwork.title='点击放大，再次点击图片退出';
function previewMemory(){
 if($('#memory-dialog').open)previewArt(memoryArtwork.firstElementChild,{label:$('#memory-dialog-title').textContent,trigger:memoryArtwork});
}
memoryArtwork.addEventListener('click',previewMemory);
memoryArtwork.addEventListener('keydown',event=>{
 if(event.key!=='Enter'&&event.key!==' ')return;
 event.preventDefault();event.stopPropagation();previewMemory();
});
function showMemory(tile,{firstVisit=false,silent=false,fromJournal=false}={}){
 if(!tile?.isMemory||!canInspectMemory(state,tile))return;
 discoveryLog.reveal(state,tile,{inJournal:fromJournal});renderBookBadges();
 journal.remember(tile);
 $('#memory-dialog-title').textContent=tile.title;$('#memory-dialog-description').textContent=tile.description;
 $('#memory-dialog-date').hidden=!tile.dateLabel;$('#memory-dialog-date').textContent=tile.dateLabel??'';
 $('#memory-dialog-badge').textContent=tile.kind==='easter-egg'?(firstVisit?'新发现 · 兴趣彩蛋':'收集的小彩蛋'):(firstVisit?'新收录 · 我们的回忆':'OUR LITTLE ARCHIVE');
 const artwork=createMemoryArt(tile,asset);artwork.id='memory-dialog-art';
 $('#memory-dialog .memory-art').replaceChildren(artwork);
 memoryArtwork.setAttribute('aria-label',`放大插画：${tile.title}`);
 $('#memory-dialog').classList.toggle('hero-memory-dialog',Boolean(tile.heroPortraits));
 const photos=getBuildingPhotoStatus(state,tile.id);
 $('#memory-photos').hidden=photos.total===0;
 $('#memory-photos').innerHTML=icon('album')+`翻翻这里的照片 · ${photos.unlocked} 张`+icon('arrow');
 $('#memory-photos').onclick=()=>{$('#memory-dialog').close();journal.open({tab:'photos',buildingId:tile.id});audio.play('page-turn');};
 openDialog($('#memory-dialog'),silent?null:firstVisit?'discovery':'memory-open');
}
function showJournal(){if(!$('#journal-dialog').open){journal.open();audio.play('memory-open');}}

$('#memory-button').addEventListener('click',()=>{const tile=getTile(state.position);if(state.birthdayAt&&tileKey(state.position)===tileKey(state.birthdayAt))openDialog($('#birthday-dialog'),'memory-open');else if(tile.isMemory)showMemory(tile);else if(tile.isVillage)villageDialog.open(getVillageVisits(state).find(v=>v.villageId===tile.id));else if(state.birthdayAt)showJournal();});
$('#journal-button').addEventListener('click',showJournal);
$('#timeline-button').addEventListener('click',()=>{timeline.open();audio.play('memory-open');});
$('#help-button').addEventListener('click',()=>openDialog($('#help-dialog')));
$('#zoom-in').addEventListener('click',()=>scene.zoomIn());$('#zoom-out').addEventListener('click',()=>scene.zoomOut());
$('#cover-button').addEventListener('click',()=>{gameStarted=false;audio.stopEffects();onboarding.showStart();});
$('#center-button').addEventListener('click',()=>scene.centerOnPlayer());$('#overview-button').addEventListener('click',()=>scene.overview());
function updateSoundButton(){const button=$('#sound-button');button.innerHTML=icon(audio.enabled?'sound':'muted');button.setAttribute('aria-label',audio.enabled?'关闭声音':'开启声音');button.setAttribute('aria-pressed',String(audio.enabled));}
$('#sound-button').addEventListener('click',async()=>{if(audio.enabled)audio.disable();else if(await audio.enable())audio.play('ui-confirm');updateSoundButton();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)audio.suspend();else audio.resume().then(updateSoundButton);updateSoundButton();});
window.addEventListener('pagehide',()=>audio.suspend());
$('#birthday-continue').addEventListener('click',()=>$('#birthday-dialog').close());
$('#birthday-dialog').addEventListener('close',()=>{
 if(!gameStarted)return;
 scene.overview();
 if(birthdayRevealPending){birthdayRevealPending=false;audio.play('world-reveal');}else audio.stopEffects();
 const memory=pendingBirthdayMemory;pendingBirthdayMemory=null;
 const village=pendingBirthdayVillage;pendingBirthdayVillage=null;
 if(memory)requestAnimationFrame(()=>{if(gameStarted&&state.steps===25&&!document.querySelector('dialog[open]')&&canInspectMemory(state,memory))showMemory(memory,{firstVisit:true,silent:true});});
 else if(village)requestAnimationFrame(()=>{if(gameStarted&&state.steps===25&&!document.querySelector('dialog[open]'))villageDialog.open(village);});
});
installTooltips(document,[
 {selector:'#journal-button',title:'小小收藏册',description:'收好回忆、彩蛋和照片。切到「照片」页签就能翻相册；红点表示有新收录。'},
 {selector:'#timeline-button',title:'本局年表',description:'从左到右翻阅这一局的每个回合，看看列车把故事写到了哪里。'},
 {selector:'#sound-button',title:'音乐与声音',description:()=>audio.enabled?'点击关闭背景音乐和音效。':'点击开启背景音乐和音效，陪你慢慢走。'},
 {selector:'#help-button',title:'玩法小纸条',description:'查看移动、迷雾、村庄礼物和收藏册的玩法。'},
 {selector:'#zoom-out',title:'缩小地图',description:'看得更远一点。缩放和拖动都不会增加回合。'},
 {selector:'#zoom-in',title:'放大地图',description:'靠近看看小建筑和列车，也可以滚轮或双指缩放。'},
 {selector:'#overview-button',title:'地图全览',description:'拉远查看整座小岛；还没探索的地方依然有雾。'},
 {selector:'#center-button',title:'找到小列车',description:'把视线移回 Water Sheep 的列车，继续选择相邻地块。'},
 {selector:'[data-album-control="previous"]',title:'上一张照片',description:'翻回这一叠照片的前一张，不会增加步数。'},
 {selector:'[data-album-control="next"]',title:'下一张照片',description:'看看这一叠里的下一张，也可以点旁边的小照片挑选。'},
]);
window.addEventListener('pageshow',event=>{if(event.persisted&&coverReady){resetJourney();onboarding.showStart();if(!document.hidden)audio.resume().then(updateSoundButton);}});
scene.setState(state);render();
export function showCover(){coverReady=true;onboarding.showStart();}
