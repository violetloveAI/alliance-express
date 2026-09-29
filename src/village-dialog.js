import { MEMORY_TILES } from './exploration.js';

export function createVillageDialog({asset, openDialog, onRead, onLocate}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'village-dialog';
  dialog.setAttribute('aria-labelledby', 'village-title');
  dialog.innerHTML = `<button class="dialog-close" aria-label="收好村庄的礼物">×</button><p class="eyebrow">A LITTLE KINDNESS ALONG THE WAY</p><div class="village-art"><img data-src="${asset('village-camp-v9.webp')}" alt="篝火旁的温暖小村庄"/></div><span class="village-ribbon">来自村庄的小礼物</span><h2 id="village-title"></h2><p class="village-reward-copy"></p><div class="village-gifts"></div><p class="village-footnote">每个村庄只送一次礼物。只是路过，也有人为你留了份温暖。</p><button class="primary-button village-continue">收好礼物，继续走 →</button>`;
  document.body.append(dialog);
  const close = () => dialog.close();
  dialog.querySelector('.dialog-close').addEventListener('click', close);
  dialog.querySelector('.village-continue').addEventListener('click', close);
  let backdrop = false, opener;
  dialog.addEventListener('pointerdown',e=>{backdrop=e.target===dialog;});
  dialog.addEventListener('click',e=>{if(backdrop&&e.target===dialog)close();backdrop=false;});
  dialog.addEventListener('close',()=>{if(opener?.isConnected)opener.focus({preventScroll:true});});
  return {
    open(reward) {
      if(!reward)return;
      dialog.querySelector('h2').textContent = reward.title;
      dialog.querySelector('.village-reward-copy').textContent = reward.description;
      const gifts = dialog.querySelector('.village-gifts'); gifts.replaceChildren();
      for(const id of reward.unlockedIds) {
        const tile = MEMORY_TILES.find(memory=>memory.id===id); if(!tile)continue;
        const row = document.createElement('div'); row.className='village-gift';
        const read = document.createElement('button'); read.textContent=`✧ 翻开：${tile.title}`;
        read.addEventListener('click',()=>{close();onRead(tile);});
        const locate = document.createElement('button'); locate.textContent='在地图上找它 ↗';
        locate.setAttribute('aria-label',`在地图上找：${tile.title}`);
        locate.addEventListener('click',()=>{close();onLocate(tile);});
        row.append(read,locate);gifts.append(row);
      }
      opener=document.activeElement;openDialog(dialog,'discovery');
    },
    close,
  };
}
