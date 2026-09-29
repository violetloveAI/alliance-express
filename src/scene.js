import { GRID_RADIUS, TILE_SIZE, hexPosition, getAvailableMoves, getVisibleKeys, canInspectMemory, tileKey, getTile, isInside } from './exploration.js';
import { LANDMARK_IDS } from './landmarks.js';
import { createGameScenery } from './game-scenery.js';
import { CAMPUS_LANDMARK_IDS, createCampusLandmark } from './campus-landmarks.js';
import { mapAsset } from './map-assets.js';
import { SceneAssetQueue, sceneImages } from './scene-assets.js';
// Vite loads the scene styles in the browser; the scene remains directly testable in Node.
if (import.meta.env) import('./movement.css');
const NS = 'http://www.w3.org/2000/svg';
const asset = (name) => `${import.meta.env?.BASE_URL??'./'}assets/${name.replace(/\.png$/, ".webp")}`;
const E = (tag, attrs={}, text) => {
 const n=document.createElementNS(NS,tag);
 for(const [key,value] of Object.entries(attrs)) {
  // Also covers the shared campus creator without changing its full-size art
  // outside this scene. Never assign even a temporary eager SVG href.
  if(tag==='image'&&key==='href')n.setAttribute('data-src',mapAsset(String(value).split('assets/').at(-1),import.meta.env?.BASE_URL??'./'));
  else n.setAttribute(key,value);
 }
 if(text!==undefined)n.textContent=text;return n;
};
const pointString = (x,y,r=TILE_SIZE-4) => Array.from({length:6},(_,i)=>{const a=(60*i+30)*Math.PI/180;return `${x+Math.cos(a)*r},${y+Math.sin(a)*r*.7}`;}).join(' ');
const BASE_ISLAND = [];
for(let r=-GRID_RADIUS;r<=GRID_RADIUS;r++)for(let q=-GRID_RADIUS;q<=GRID_RADIUS;q++)if(isInside(q,r))BASE_ISLAND.push({q,r});
function islandTiles(state){
 const positions=new Map(BASE_ISLAND.map(p=>[tileKey(p),p]));
 if(state?.steps===24)for(const p of getAvailableMoves(state))positions.set(tileKey(p),p);
 if(state?.birthdayAt)positions.set(tileKey(state.birthdayAt),state.birthdayAt);
 return [...positions.values()];
}
const vertexKey=p=>`${Math.round(p.x*1e6)},${Math.round(p.y*1e6)}`;
const xy=p=>`${+p.x.toFixed(3)} ${+p.y.toFixed(3)}`;
export function buildIslandOutline(state){
 // Shared full-size hex edges cancel, leaving only the connected island coast.
 const positions=islandTiles(state),edges=new Map();
 for(const p of positions){
  const center=hexPosition(p.q,p.r);
  const vertices=Array.from({length:6},(_,i)=>{const angle=(60*i+30)*Math.PI/180;return{x:center.x+Math.cos(angle)*TILE_SIZE,y:center.y+Math.sin(angle)*TILE_SIZE*.7};});
  for(let i=0;i<6;i++){
   const a=vertices[i],b=vertices[(i+1)%6],key=[vertexKey(a),vertexKey(b)].sort().join('|');
   if(edges.has(key))edges.delete(key);else edges.set(key,{a,b});
  }
 }
 const remaining=[...edges.values()],byStart=new Map(remaining.map(edge=>[vertexKey(edge.a),edge]));
 const points=[];let edge=remaining[0];
 do{points.push(edge.a);edge=byStart.get(vertexKey(edge.b));}while(edge&&vertexKey(edge.a)!==vertexKey(points[0])&&points.length<=remaining.length);
 const corners=points.map((point,index)=>{
  const previous=points[(index+points.length-1)%points.length],next=points[(index+1)%points.length];
  const inset=toward=>{const length=Math.hypot(toward.x-point.x,toward.y-point.y),ratio=Math.min(30,length*.3)/length;return{x:point.x+(toward.x-point.x)*ratio,y:point.y+(toward.y-point.y)*ratio};};
  return{point,entry:inset(previous),exit:inset(next)};
 });
 const path=`M${xy(corners[0].entry)} ${corners.map((corner,index)=>`Q${xy(corner.point)} ${xy(corner.exit)} L${xy(corners[(index+1)%corners.length].entry)}`).join(' ')} Z`;
 return{keys:positions.map(tileKey),points,path};
}
function art(file,x,y,w,h,cls=''){ return E('image',{href:asset(file),x,y,width:w,height:h,'aria-hidden':'true',preserveAspectRatio:'xMidYMax meet',class:cls}); }
function sprite(index,x,y,w=205,h=170,file='discovery-props.png'){return art(file.replace(/\.(png|webp)$/,`-${index}.webp`),x,y,w,h,'prop-art');}
function label(x,y,text,small=false){const g=E('g',{'aria-hidden':'true',class:'world-label'});const w=Math.max(110,[...text].reduce((n,c)=>n+(c.charCodeAt(0)<128?(small?6:8):(small?13:17)),0)+34);g.append(E('rect',{x:x-w/2,y:y-23,width:w,height:34,rx:17,fill:'#faf5df',stroke:'#b7be99','stroke-width':1.5}),E('text',{x,y,'text-anchor':'middle',class:small?'tile-caption small':'tile-caption'},text));return g;}
const modelFor = (tile) => {
 const {id,asset:file}=tile;
 if(tile.isVillage)return {type:'image',file:'village-camp-v9.webp',width:242,height:202};
 if(CAMPUS_LANDMARK_IDS.includes(id))return {type:'campus',id};
 if(tile.heroPortraits?.length)return {type:'heroes',portraits:tile.heroPortraits,id};
 if(LANDMARK_IDS.includes(id))return {type:'sprite',index:LANDMARK_IDS.indexOf(id),sheet:'new-hobby-props.webp'};
 const hobbies={alliance:0,supply:1,badminton:2,zhangzhou:3,fuzhou:4,foshan:4,dorm:5};
 if(id in hobbies)return {type:'sprite',index:hobbies[id],sheet:'hobby-landmarks.png'};
 if(id==='canteen')return {type:'sprite',index:3};
 if(file==='school.webp') return {type:'image',file,width:290,height:207};
 if(file==='metro-station.png') return {type:'image',file,width:270,height:180};
 if(file==='reunion-table.png') return {type:'image',file,width:242,height:220};
 if(/game|dorm|room/.test(id)) return {type:'sprite',index:2};
 if(/walk|night/.test(id)) return {type:'sprite',index:4};
 if(/food|meal|canteen|dining/.test(id)) return {type:'sprite',index:3};
 if(/foshan|fuzhou|zhangzhou|travel/.test(id)) return {type:'sprite',index:1};
 if(file && !/board-landscape|birthday/.test(file)) return {type:'image',file,width:230,height:180};
 return {type:'sprite',index:0};
};
export class ExplorationScene {
 constructor(container,{onMove,onInspect,onPan=()=>{},onZoom=()=>{},onLocked=()=>{},onVillage=()=>{}}){
  this.container=container;this.onMove=onMove;this.onInspect=onInspect;this.onPan=onPan;this.onZoom=onZoom;this.onLocked=onLocked;
  this.onVillage=onVillage;
  this.assetQueue=new SceneAssetQueue();this.assetsActivated=false;
  this.reduced=matchMedia('(prefers-reduced-motion: reduce)');this.tiles=new Map();this.animation=null;this.state=null;this.moving=false;this.following=true;this.camera={x:0,y:0};this.vehiclePosition={x:0,y:0};this.isOverview=false;this.discoveryModels=new Set();
  this.svg=E('svg',{class:'exploration-map',viewBox:'-600 -400 1200 800',role:'group','aria-label':'自由探索地图，选择相邻六边格移动，可拖动查看'});
  const defs=E('defs');const fog=E('linearGradient',{id:'tile-fog',x1:0,y1:0,x2:0,y2:1});fog.append(E('stop',{offset:'0%','stop-color':'#eef0d6'}),E('stop',{offset:'100%','stop-color':'#d6dfb6'}));
  const blur=E('filter',{id:'fog-soft-edge',x:'-10%',y:'-10%',width:'120%',height:'120%'});blur.append(E('feGaussianBlur',{stdDeviation:8}));
  const mask=E('mask',{id:'fog-mask',maskUnits:'userSpaceOnUse',x:-2200,y:-1700,width:4400,height:3400});mask.append(E('rect',{x:-2200,y:-1700,width:4400,height:3400,fill:'white'}));this.fogHoles=E('g',{fill:'black',filter:'url(#fog-soft-edge)'});mask.append(this.fogHoles);defs.append(fog,blur,mask);this.svg.append(defs);
  this.world=E('g',{class:'persistent-world','data-world-id':'watersheep-free-map'});
  this.installIsland(defs);
  this.tileLayer=E('g',{class:'tile-layer'});this.railLayer=E('g',{class:'rail-layer','aria-hidden':'true'});this.modelLayer=E('g',{class:'model-layer'});this.markerLayer=E('g',{class:'marker-layer'});this.labelLayer=E('g',{class:'memory-label-layer'});
  this.fogLayer=E('rect',{x:-2200,y:-1700,width:4400,height:3400,fill:'#e3e8c7',mask:'url(#fog-mask)','clip-path':'url(#island-clip)',class:'world-fog','pointer-events':'none'});this.world.append(this.tileLayer,this.fogLayer,this.railLayer,this.modelLayer,this.markerLayer);this.svg.append(this.world);container.append(this.svg);
  const positions=[];
  for(let r=-GRID_RADIUS;r<=GRID_RADIUS;r++)for(let q=-GRID_RADIUS;q<=GRID_RADIUS;q++)if(isInside(q,r))positions.push({q,r,...hexPosition(q,r)});
  positions.sort((a,b)=>a.y-b.y || a.x-b.x);
  for(const p of positions){
   const key=tileKey(p),tile=getTile(p),g=E('g',{'data-key':key,class:'hex-tile'});
   const face=E('polygon',{points:pointString(p.x,p.y),fill:'url(#tile-fog)',class:'tile-face'});g.append(face);
   const border=E('polygon',{points:pointString(p.x,p.y),class:'tile-outline'});g.append(border);
   this.tileLayer.append(g);
   const model=E('g',{class:'tile-model',transform:`translate(${p.x} ${p.y})`,'data-model-key':key,'data-revealed':'false'});
   // Keep map coordinates on the outer group; only this inner artwork may move.
   const modelArt=E('g',{class:'tile-model-art'});model.append(modelArt);
   let memoryButton=null;if(tile.isMemory||tile.isVillage){const m=modelFor(tile);modelArt.append(E('ellipse',{cx:0,cy:16,rx:82,ry:20,fill:'#33442e',opacity:.12}));
    if(m.type==='campus'){
     modelArt.append(createCampusLandmark(m.id,E));
    }else if(m.type==='heroes'){
     const gallery=E('g',{class:'hero-map-landmark','data-game':m.id});
     const scenery=createGameScenery(m.id);
     for(const [key,value]of Object.entries({x:-155,y:-186,width:310,height:222}))scenery.setAttribute(key,value);
     gallery.append(scenery);
     m.portraits.forEach((portrait,index)=>gallery.append(art(portrait.file,index===0?-113:-5,-113,118,146,'hero-map-portrait')));
     modelArt.append(gallery);
    }else modelArt.append(m.type==='image'?art(m.file,-m.width/2,-m.height+24,m.width,m.height,'landmark'):sprite(m.index,-108,-154,216,184,m.sheet));
    memoryButton=E('g',{transform:`translate(${p.x} ${p.y})`,role:'button',tabindex:-1,'aria-label':`重看回忆：${tile.title}`,'data-memory':key,class:'memory-map-button'});memoryButton.append(label(0,40,tile.title,true));memoryButton.style.visibility='hidden';this.labelLayer.append(memoryButton);
   }
   const discoveryParts=tile.isMemory||tile.isVillage?[modelArt,...this.installDiscoveryArt(model)]:[];
   this.modelLayer.append(model);
   this.tiles.set(key,{...p,tile,g,model,modelArt,discoveryParts,face,memoryButton});
  }
  this.cake=E('g',{class:'cake-landmark','data-cake':'hidden','aria-hidden':'true'});this.cake.append(E('ellipse',{cx:0,cy:22,rx:130,ry:32,fill:'#756329',opacity:.16}),art('cake.png',-210,-310,420,350,'birthday-cake'));this.world.append(this.cake,this.markerLayer);
  this.train=E('g',{class:'rider-train','data-player':'water-sheep'});this.trainEntrance=E('g',{class:'train-entrance'});this.train.append(this.trainEntrance);this.trainEntrance.append(E('ellipse',{cx:-4,cy:42,rx:106,ry:23,fill:'#465a36',opacity:.2}));
  this.trainFacing=E('g',{class:'train-facing'});
  this.trainBody=E('g',{class:'train-body'});this.trainBody.append(art('rider-train.png',-125,-125,250,185,'rider-art'));
  // Subtle rotating spokes sit over the illustrated wheels, inside their own mounts.
  for(const [x,y,r]of [[-98,36,10],[-51,38,10],[10,39,9],[34,39,9],[58,40,9]]){
   const mount=E('g',{transform:`translate(${x} ${y})`,'aria-hidden':'true'}),wheel=E('g',{class:'train-wheel'});
   wheel.append(E('circle',{r,fill:'none',stroke:'#d9bd7f','stroke-width':1}),E('path',{d:`M${-r} 0H${r}M0 ${-r}V${r}`,fill:'none',stroke:'#d9bd7f','stroke-width':1}));mount.append(wheel);this.trainBody.append(mount);
  }
  const particles=E('g',{class:'train-particles','aria-hidden':'true','pointer-events':'none'});
  particles.append(E('circle',{cx:87,cy:-35,r:8,fill:'#fff7df',class:'train-departure'}));
  for(let i=0;i<3;i++)particles.append(E('circle',{cx:87,cy:-35,r:4+i%2,fill:'#fff7df',class:`train-steam particle-${i}`}));
  for(let i=0;i<2;i++)particles.append(E('circle',{cx:-104+i*10,cy:44,r:2.5,fill:'#e9d8ac',class:`train-dust particle-${i}`}));
  this.trainFacing.append(this.trainBody,particles);this.trainEntrance.append(this.trainFacing);
  this.arrivalLayer=E('g',{class:'arrival-feedback','aria-hidden':'true','pointer-events':'none'});
  this.trainEntrance.append(label(0,79,'Water Sheep  ×  Violet',true));this.world.append(this.arrivalLayer,this.train,this.labelLayer);
  this.installEvents();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);this.resize();
 }
 async prepareAssets(state=this.state,{onProgress}={}){
  this.assetsActivated=true;
  const roots=[this.landSurface,this.train];
  if(state)for(const key of getVisibleKeys(state))roots.push(this.tiles.get(key)?.modelArt);
  if(state?.birthdayAt)roots.push(this.cake);
  const groups=new Map();
  for(const image of roots.flatMap(sceneImages)){
   const url=image.getAttribute('data-src');
   if(!groups.has(url))groups.set(url,[]);
   groups.get(url).push(image);
  }
  const result={completed:0,total:groups.size,failed:0};
  onProgress?.({...result});
  await Promise.all([...groups].map(async([url,images])=>{
   const success=await this.assetQueue.load(url);
   for(const image of images){if(success){image.setAttribute('href',url);image.style.display='';}else image.style.display='none';}
   result.completed+=1;if(!success)result.failed+=1;
   onProgress?.({...result});
  }));
  return result;
 }
 installDiscoveryArt(model){
  const effects=E('g',{class:'memory-discovery-effects','aria-hidden':'true','pointer-events':'none'}),parts=[];
  const ring=E('ellipse',{cx:0,cy:18,rx:102,ry:29,fill:'none',stroke:'#f7ce75','stroke-width':3,class:'discovery-halo'});effects.append(ring);parts.push(ring);
  for(const [x,y,size]of [[-83,-79,8],[93,-102,6],[53,-162,5]]){
   const mount=E('g',{transform:`translate(${x} ${y})`}),spark=E('path',{d:`M0 ${-size}Q0 0 ${size} 0Q0 0 0 ${size}Q0 0 ${-size} 0Q0 0 0 ${-size}Z`,fill:'#ffe1a1',stroke:'#ae8149','stroke-width':.8,class:'discovery-spark'});
   mount.append(spark);effects.append(mount);parts.push(spark);
  }
  const badgeMount=E('g',{transform:'translate(59 -130)'}),badge=E('g',{class:'discovery-badge'});
  badge.append(E('rect',{x:-29,y:-13,width:58,height:25,rx:12,fill:'#fff0bf',stroke:'#b88d51','stroke-width':1.2}),E('text',{x:0,y:4,'text-anchor':'middle',class:'discovery-badge-text'},'NEW'));
  badgeMount.append(badge);effects.append(badgeMount);parts.push(badge);model.append(effects);return parts;
 }
 installIsland(defs){
  const sea=E('radialGradient',{id:'island-sea',gradientUnits:'userSpaceOnUse',fx:0,fy:0,cx:0,cy:0,r:3100});
  sea.append(E('stop',{offset:'0%','stop-color':'#a4decd'}),E('stop',{offset:'58%','stop-color':'#79c4c5'}),E('stop',{offset:'100%','stop-color':'#56a6b7'}));
  const grass=E('linearGradient',{id:'island-grass',x1:0,y1:0,x2:.2,y2:1});grass.append(E('stop',{offset:'0%','stop-color':'#d2df92'}),E('stop',{offset:'100%','stop-color':'#a4c17a'}));
  const ripples=E('pattern',{id:'ocean-ripples',width:300,height:210,patternUnits:'userSpaceOnUse'});
  ripples.append(E('path',{d:'M18 64q22 8 44 0M188 164q15 6 31 0',fill:'none',stroke:'#d4f1e3','stroke-width':3,'stroke-linecap':'round',opacity:.32}));
  const meadow=E('pattern',{id:'meadow-speckles',width:210,height:175,patternUnits:'userSpaceOnUse'});
  meadow.append(E('ellipse',{cx:40,cy:70,rx:30,ry:12,fill:'#e3eaa8',opacity:.22}),E('path',{d:'M135 125l-4 -7m4 7l4 -9',fill:'none',stroke:'#8faf6d','stroke-width':2,'stroke-linecap':'round',opacity:.25}));
  const clip=E('clipPath',{id:'island-clip',clipPathUnits:'userSpaceOnUse'});this.islandClip=E('path');clip.append(this.islandClip);defs.append(sea,grass,ripples,meadow,clip);
  const ocean=E('g',{class:'island-ocean','aria-hidden':'true','pointer-events':'none'});
  ocean.append(E('rect',{x:-100000,y:-100000,width:200000,height:200000,fill:'url(#island-sea)'}),E('rect',{x:-100000,y:-100000,width:200000,height:200000,fill:'url(#ocean-ripples)'}));
  this.shoreLayer=E('g',{class:'island-shore','aria-hidden':'true','pointer-events':'none'});this.shorePaths=[];
  const coast=attrs=>{const node=E('path',{'stroke-linejoin':'round','stroke-linecap':'round',...attrs});this.shorePaths.push(node);this.shoreLayer.append(node);};
  coast({fill:'none',stroke:'#aadfd0','stroke-width':146,opacity:.65});
  coast({fill:'#3d8885',stroke:'#3d8885','stroke-width':65,opacity:.15,transform:'translate(0 43)'});
  coast({fill:'none',stroke:'#e5f5de','stroke-width':5,'stroke-dasharray':'48 38 16 47',transform:'translate(0 26) scale(1.045)'});
  coast({fill:'#b18b58',stroke:'#b18b58','stroke-width':44,transform:'translate(0 28)'});
  coast({fill:'#d5af70',stroke:'#d5af70','stroke-width':43,transform:'translate(0 15)'});
  coast({fill:'#ecd99d',stroke:'#ecd99d','stroke-width':43});
  this.landSurface=E('g',{class:'island-land','clip-path':'url(#island-clip)','aria-hidden':'true','pointer-events':'none'});
  this.landSurface.append(E('rect',{x:-2100,y:-1500,width:4200,height:3000,fill:'url(#island-grass)'}),E('rect',{x:-2100,y:-1500,width:4200,height:3000,fill:'url(#meadow-speckles)'}));
  // The scene element factory stages the lightweight WebP without requesting it.
  const texture=E('image',{href:`${import.meta.env?.BASE_URL??'./'}assets/terrain/flat-meadow-g.png`,x:-1770,y:-1180,width:3540,height:2360,'aria-hidden':'true',preserveAspectRatio:'xMidYMax meet',class:'flat-meadow-terrain'});
  texture.addEventListener('error',()=>{texture.style.display='none';});this.landSurface.append(texture);
  this.world.append(ocean,this.shoreLayer,this.landSurface);this.paintIsland(null);
 }
 paintIsland(state){
  const signature=islandTiles(state).map(tileKey).join('|');if(signature===this.islandSignature)return;
  const {path}=buildIslandOutline(state);this.islandSignature=signature;
  this.islandClip.setAttribute('d',path);for(const node of this.shorePaths)node.setAttribute('d',path);
 }
 resize(){
  this.cameraTween?.cancel();this.cancelGesture?.();
  const scale=this.normalWidth&&this.viewWidth?this.normalWidth/this.viewWidth:1;
  const restoredScale=this.normalWidth&&this.overviewRestoreWidth?this.normalWidth/this.overviewRestoreWidth:1;
  const {width,height}=this.container.getBoundingClientRect();
  this.ratio=Math.max(height,1)/Math.max(width,1);
  this.normalWidth=width<700?680:Math.min(1720,Math.max(1050,width*1.1));
  if(this.isOverview)this.overviewRestoreWidth=this.normalWidth/restoredScale;
  this.setViewWidth(this.isOverview?this.overviewWidth:this.normalWidth/scale);
  if(this.following)this.centerOnPlayer(false);else this.paintCamera();
 }
 get overviewWidth(){return Math.max(3600,2500/this.ratio);}
 get zoomPercent(){return Math.round(this.normalWidth/this.viewWidth*100);}
 setViewWidth(width){this.viewWidth=Math.max(440,Math.min(this.overviewWidth,width));this.viewHeight=this.viewWidth*this.ratio;this.onZoom(this.zoomPercent);}
 overview(){
  if(this.moving)return;
  this.cameraTween?.cancel();this.cancelGesture?.();
  if(!this.isOverview)this.overviewRestoreWidth=this.viewWidth;
  this.isOverview=true;this.following=false;this.onPan(true);this.camera={x:0,y:0};
  this.setViewWidth(this.overviewWidth);this.paintCamera();
 }
 leaveOverview(){if(this.isOverview){this.isOverview=false;this.setViewWidth(this.overviewRestoreWidth??this.normalWidth);}}
 clientPoint(anchor){
  const rect=this.container.getBoundingClientRect();
  return {x:anchor?.clientX!==undefined?anchor.clientX-(rect.left??0):anchor?.x??rect.width/2,
   y:anchor?.clientY!==undefined?anchor.clientY-(rect.top??0):anchor?.y??rect.height/2,
   width:Math.max(rect.width,1),height:Math.max(rect.height,1)};
 }
 worldAtClient(anchor){const p=this.clientPoint(anchor);return{x:this.camera.x+(p.x/p.width-.5)*this.viewWidth,y:this.camera.y+(p.y/p.height-.5)*this.viewHeight};}
 zoomBy(factor,anchor){
  if(this.moving||!Number.isFinite(factor)||factor<=0)return this.zoomPercent;
  this.cameraTween?.cancel();this.cancelGesture?.();
  const world=this.worldAtClient(anchor),point=this.clientPoint(anchor);
  this.isOverview=false;this.following=false;this.onPan(true);this.setViewWidth(this.viewWidth/factor);
  this.camera={x:world.x-(point.x/point.width-.5)*this.viewWidth,y:world.y-(point.y/point.height-.5)*this.viewHeight};
  this.paintCamera();return this.zoomPercent;
 }
 zoomIn(){return this.zoomBy(1.25);}
 zoomOut(){return this.zoomBy(.8);}
 clampCamera(c){const w=this.viewWidth,h=this.viewHeight;return{x:w>=4000?0:Math.max(-2000+w/2,Math.min(2000-w/2,c.x)),y:h>=3100?0:Math.max(-1550+h/2,Math.min(1550-h/2,c.y))};}
 paintCamera(){this.camera=this.clampCamera(this.camera);this.svg.setAttribute('viewBox',`${this.camera.x-this.viewWidth/2} ${this.camera.y-this.viewHeight/2} ${this.viewWidth} ${this.viewHeight}`);}
 desiredCamera(p){const atCake=!this.moving&&this.state?.birthdayAt&&tileKey(this.state.position)===tileKey(this.state.birthdayAt);return this.clampCamera({x:p.x+this.viewWidth*.05,y:p.y+(atCake?-120:this.viewHeight*.08)});}
 centerOnPlayer(animate=true){this.cameraTween?.cancel();this.cancelGesture?.();this.leaveOverview();this.following=true;this.onPan(false);const to=this.desiredCamera(this.vehiclePosition);if(!animate || this.moving || this.reduced.matches){this.camera=to;this.paintCamera();return;}const from={...this.camera};this.cameraTween=this.tween(280,t=>{this.camera={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};this.paintCamera();});}
 tween(duration,update){let frame,start,cancelled=false,finish;const promise=new Promise(resolve=>{finish=resolve;const tick=(time)=>{if(cancelled){resolve();return;}start??=time;const p=Math.min(1,(time-start)/duration);const eased=1-(1-p)**3;update(eased);if(p<1)frame=requestAnimationFrame(tick);else resolve();};frame=requestAnimationFrame(tick);});return{promise,cancel(){cancelled=true;cancelAnimationFrame(frame);finish();}};}
 paintTrain(p,from){this.vehiclePosition=p;this.train.setAttribute('transform',`translate(${p.x} ${p.y+30})`);if(from && Math.abs(p.x-from.x)>1)this.trainFacing.setAttribute('transform',p.x<from.x?'scale(-1 1)':'scale(1 1)');this.train.setAttribute('data-q',this.state?.position.q??0);this.train.setAttribute('data-r',this.state?.position.r??0);if(this.following){this.camera=this.desiredCamera(p);this.paintCamera();}}
 revealState(state){
  this.paintIsland(state);
  const visited=new Set(state.visited),visible=new Set(getVisibleKeys(state));
  const required=new Set([...visible,...getAvailableMoves(state).map(tileKey)]);for(const [key,t]of this.tiles)if(t.extra&&!required.has(key)){t.g.remove();t.model.remove();this.tiles.delete(key);}
  const all=Boolean(state.birthdayAt);this.fogHoles.replaceChildren();this.fogLayer.style.opacity=all?'0':'1';
  const clearFog=new Set([...visible,...(state.steps===24?getAvailableMoves(state).map(tileKey):[])]);
  for(const key of clearFog){let t=this.tiles.get(key);if(!t){const [q,r]=key.split(',').map(Number);t=this.addExtraTile({q,r});}if(t)this.fogHoles.append(E('polygon',{points:pointString(t.x,t.y,TILE_SIZE+6)}));}
  for(const [key,t]of this.tiles){
   const seen=visible.has(key),unlocked=t.tile.isMemory?canInspectMemory(state,t.tile):visited.has(key);t.model.dataset.revealed=String(seen);
   t.g.classList.toggle('visited',visited.has(key));t.g.classList.toggle('seen',seen);t.g.classList.toggle('current',key===tileKey(state.position));
   if(t.memoryButton){
    t.memoryButton.style.visibility=seen?'visible':'hidden';t.memoryButton.setAttribute('tabindex',seen?'0':'-1');
    t.memoryButton.setAttribute('data-locked',String(!unlocked));
    t.memoryButton.setAttribute('data-visited',String(visited.has(key)));
    t.memoryButton.setAttribute('aria-label',unlocked?`重看回忆：${t.tile.title}`:`${t.tile.title}，未到访，请先乘车到达`);
    t.memoryButton.replaceChildren(label(0,40,visited.has(key)?`✓ ${t.tile.title} · 已到访`:`${unlocked?'✧':'🔒'} ${t.tile.title} · 未到访`,true));
    if(t.tile.isVillage){
     t.memoryButton.setAttribute('data-locked','false');
     t.memoryButton.setAttribute('aria-label',`村庄：${t.tile.title}${visited.has(key)?'，查看收到的礼物':'，首次到访有礼物'}`);
     t.memoryButton.replaceChildren(label(0,40,`${visited.has(key)?'✓':'✧'} ${t.tile.title} · ${visited.has(key)?'已来过':'有礼物'}`,true));
    }
    t.memoryButton.setAttribute('transform',`translate(${t.x} ${t.y-(key===tileKey(state.position)?183:0)})`);
   }
  }
  if(state.birthdayAt){const p=hexPosition(state.birthdayAt.q,state.birthdayAt.r);this.cake.setAttribute('transform',`translate(${p.x} ${p.y-48})`);this.cake.dataset.cake='revealed';}else this.cake.dataset.cake='hidden';
  if(this.assetsActivated)void this.prepareAssets(state);
 }
 addExtraTile(p){const key=tileKey(p);if(this.tiles.has(key))return this.tiles.get(key);const at=hexPosition(p.q,p.r),g=E('g',{'data-key':key,class:'hex-tile seen extra-tile'}),face=E('polygon',{points:pointString(at.x,at.y),class:'tile-face'});g.append(face,E('polygon',{points:pointString(at.x,at.y),class:'tile-outline'}));this.tileLayer.append(g);const model=E('g',{'data-model-key':key,'data-revealed':'false',class:'tile-model'});this.modelLayer.append(model);const t={...p,...at,tile:getTile(p),g,model,face,extra:true};this.tiles.set(key,t);return t;}
 paintRails(state){this.railLayer.replaceChildren();const edges=new Set();for(let i=1;i<state.trail.length;i++){const a=state.trail[i-1],b=state.trail[i];const key=[tileKey(a),tileKey(b)].sort().join('|');if(edges.has(key))continue;edges.add(key);const A=hexPosition(a.q,a.r),B=hexPosition(b.q,b.r);const ax=A.x,ay=A.y+30,bx=B.x,by=B.y+30,angle=Math.atan2(by-ay,bx-ax)*180/Math.PI,len=Math.hypot(bx-ax,by-ay);const g=E('g',{transform:`translate(${ax} ${ay}) rotate(${angle})`});for(let t=0;t<len;t+=22)g.append(E('rect',{x:t,y:-12,width:8,height:24,rx:2,fill:'#735039'}));g.append(E('path',{d:`M0 -7H${len}M0 7H${len}`,fill:'none',stroke:'#3d3027','stroke-width':3.8}));this.railLayer.append(g);}}
 paintTargets(){this.markerLayer.replaceChildren();for(const t of this.tiles.values()){t.g.removeAttribute('role');t.g.removeAttribute('tabindex');t.g.removeAttribute('aria-label');t.g.classList.remove('reachable');}if(!this.state||this.moving)return;
 for(const p of getAvailableMoves(this.state)){const key=tileKey(p),t=this.tiles.get(key)||this.addExtraTile(p),visited=this.state.visited.includes(key);t.g.classList.add('reachable');t.g.setAttribute('role','button');t.g.setAttribute('tabindex','0');t.g.setAttribute('aria-label',`移动到地块 ${p.q},${p.r}${visited?'，已探索':'，未探索'}`);const g=E('g',{transform:`translate(${t.x} ${t.y+80})`,'pointer-events':'none',class:'move-marker'});if(this.state.steps===24){g.classList.add('gift-marker');g.append(E('circle',{r:31,fill:'#fff2d5',stroke:'#c29860','stroke-width':2}),E('path',{d:'M-16 -7h32v9h-32zM-12 2v18h24V2M0 -7v27M0 -7C-16 -7-18 -22-9 -21S0 -7 0 -7C16 -7 18 -22 9 -21S0 -7 0 -7',fill:'none',stroke:'#b17c43','stroke-width':2.5,'stroke-linecap':'round','stroke-linejoin':'round'}));t.g.setAttribute('aria-label',`打开礼物，移动到地块 ${p.q},${p.r}`);}else g.append(E('circle',{r:23,fill:'#fcf6dd',stroke:'#748456','stroke-width':2.2}),E('path',{d:'M-8 0H8M2 -6l6 6-6 6',transform:`rotate(${Math.atan2(t.y-this.vehiclePosition.y,t.x-this.vehiclePosition.x)*180/Math.PI})`,fill:'none',stroke:'#526d3f','stroke-width':2.5,'stroke-linecap':'round','stroke-linejoin':'round'}));this.markerLayer.append(g);}
 }
 clearMovementFeedback(){
  clearTimeout(this.feedbackTimer);this.feedbackTimer=null;
  this.arrivalLayer.replaceChildren();this.train?.classList.remove('settling');
  for(const model of this.discoveryModels)model.classList.remove('memory-discovered');
  this.discoveryModels.clear();
  for(const tile of this.tiles.values())for(const part of tile.discoveryParts??[])part.style.animationDelay='';
 }
 finishFeedbackAfter(duration){
  clearTimeout(this.feedbackTimer);
  this.feedbackTimer=setTimeout(()=>this.clearMovementFeedback(),duration);
  this.feedbackTimer.unref?.();
 }
 clearArrival(){this.svg.classList.remove('arriving');this.train.classList.remove('entering');}
 showArrivalFeedback(position,previouslyVisible,state){
  if(this.reduced.matches)return;
  this.train.classList.add('settling');
  this.arrivalLayer.setAttribute('transform',`translate(${position.x} ${position.y+30})`);
  this.arrivalLayer.replaceChildren(E('ellipse',{cx:0,cy:9,rx:99,ry:28,fill:'none',stroke:'#fff2c9','stroke-width':3,class:'arrival-ring'}));
  let discoveryCount=0;
  // The birthday reveals the whole island; its celebration owns that reveal.
  if(!state.birthdayAt)for(const key of getVisibleKeys(state)){
   const tile=this.tiles.get(key);
   if(!previouslyVisible.has(key)&&(tile?.tile.isMemory||tile?.tile.isVillage)){
    const delay=discoveryCount++*60;
    for(const part of tile.discoveryParts??[])part.style.animationDelay=`${delay}ms`;
    tile.model.classList.add('memory-discovered');this.discoveryModels.add(tile.model);
   }
  }
  this.finishFeedbackAfter(discoveryCount?740+(discoveryCount-1)*60:300);
 }
 // Resolves on completion or cancellation. The reveal is presentational: it never
 // advances the trail, consumes a step, or rediscovers an already visible memory.
 async playArrival(){
  if(!this.state)return this.state;
  const token=this.travelToken=(this.travelToken??0)+1,state=this.state;
  this.animation?.cancel();this.animation=null;this.cameraTween?.cancel();this.cancelGesture?.();this.clearMovementFeedback();this.clearArrival();
  this.trainFacing.setAttribute('transform','scale(1 1)');this.train.classList.remove('moving');this.leaveOverview();this.following=true;this.onPan(false);
  this.paintTrain(hexPosition(state.position.q,state.position.r));
  if(this.reduced.matches){this.moving=false;this.paintTargets();return state;}
  this.moving=true;this.paintTargets();this.svg.classList.add('arriving');this.train.classList.add('entering');
  let finish,timer;const promise=new Promise(resolve=>{finish=resolve;timer=setTimeout(resolve,900);});
  this.animation={promise,cancel(){clearTimeout(timer);finish();}};
  await promise;
  if(token!==this.travelToken)return this.state;
  this.animation=null;this.clearArrival();this.moving=false;this.paintTargets();
  this.showArrivalFeedback(this.vehiclePosition,new Set(getVisibleKeys(state)),state);return state;
 }
 setState(state){this.travelToken=(this.travelToken??0)+1;this.animation?.cancel();this.animation=null;this.cameraTween?.cancel();this.cancelGesture?.();this.clearMovementFeedback();this.clearArrival();this.leaveOverview();this.following=true;for(const [key,t]of this.tiles)if(t.extra){t.g.remove();t.model.remove();this.tiles.delete(key);}this.state=state;this.moving=false;this.train.classList.remove('moving');this.trainFacing.setAttribute('transform','scale(1 1)');this.revealState(state);this.paintRails(state);this.paintTrain(hexPosition(state.position.q,state.position.r));this.paintTargets();}
 async travel(state){this.animation?.cancel();this.cameraTween?.cancel();this.cancelGesture?.();this.clearMovementFeedback();this.clearArrival();const previouslyVisible=new Set(this.state?getVisibleKeys(this.state):[]);const token=this.travelToken=(this.travelToken??0)+1;this.leaveOverview();const from={...this.vehiclePosition};this.state=state;if(this.assetsActivated)void this.prepareAssets(state);const to=hexPosition(state.position.q,state.position.r);this.moving=true;this.following=true;this.onPan(false);this.paintTargets();this.paintRails(state);this.train.classList.add('moving');const duration=this.reduced.matches?0:state.steps<=10?380:480;
 if(duration){this.animation=this.tween(duration,t=>this.paintTrain({x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},from));await this.animation.promise;}else this.paintTrain(to,from);
 if(token!==this.travelToken)return this.state;
 this.animation=null;this.moving=false;this.train.classList.remove('moving');this.revealState(state);this.paintTargets();this.showArrivalFeedback(to,previouslyVisible,state);if(state.birthdayAt&&tileKey(state.position)===tileKey(state.birthdayAt))this.centerOnPlayer();return state;
 }
 flyTo(p){if(this.moving)return;this.cameraTween?.cancel();this.cancelGesture?.();this.leaveOverview();const at=hexPosition(p.q,p.r);this.following=false;this.onPan(true);const from={...this.camera},to=this.desiredCamera(at);if(this.reduced.matches){this.camera=to;this.paintCamera();return;}this.cameraTween=this.tween(280,t=>{this.camera={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};this.paintCamera();});}
 inspectMemory(key){
  const position=this.tiles.get(key),tile=position&&getTile(position);
  if(!this.state||!tile||!getVisibleKeys(this.state).includes(key))return;
  if(tile.isVillage){this.onVillage(tile);return;}
  if(!tile.isMemory)return;
  if(canInspectMemory(this.state,tile))this.onInspect(tile);
  else this.onLocked({q:tile.q,r:tile.r,title:tile.title});
 }
 installEvents(){
  const pointers=new Map();let gesture=null,suppressTap=false;
  const release=(id)=>{if(this.svg.hasPointerCapture(id))this.svg.releasePointerCapture(id);};
  this.cancelGesture=()=>{const ids=[...pointers.keys()];pointers.clear();gesture=null;suppressTap=false;this.svg.classList.remove('dragging');for(const id of ids)release(id);};
  const startPinch=()=>{
   const [a,b]=[...pointers.values()];const middle={clientX:(a.x+b.x)/2,clientY:(a.y+b.y)/2};
   gesture={kind:'pinch',distance:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)),width:this.viewWidth,world:this.worldAtClient(middle)};
   suppressTap=true;this.isOverview=false;this.following=false;this.onPan(true);this.svg.classList.add('dragging');
  };
  this.svg.addEventListener('pointerdown',e=>{
   if(e.button!==0||this.moving)return;
   this.cameraTween?.cancel();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});this.svg.setPointerCapture(e.pointerId);
   if(pointers.size>=2){startPinch();return;}
   suppressTap=false;gesture={kind:'pan',x:e.clientX,y:e.clientY,camera:{...this.camera},key:e.target.closest('[data-key]')?.dataset.key,memory:e.target.closest('[data-memory]')?.dataset.memory,dragged:false};
  });
  this.svg.addEventListener('pointermove',e=>{
   if(!pointers.has(e.pointerId)||!gesture)return;
   pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(pointers.size>=2){
    const [a,b]=[...pointers.values()],distance=Math.max(1,Math.hypot(b.x-a.x,b.y-a.y));
    const point=this.clientPoint({clientX:(a.x+b.x)/2,clientY:(a.y+b.y)/2});
    this.setViewWidth(gesture.width*gesture.distance/distance);
    this.camera={x:gesture.world.x-(point.x/point.width-.5)*this.viewWidth,y:gesture.world.y-(point.y/point.height-.5)*this.viewHeight};this.paintCamera();return;
   }
   const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
   if(Math.hypot(dx,dy)>7){gesture.dragged=true;this.following=false;this.isOverview=false;this.onPan(true);this.svg.classList.add('dragging');}
   if(gesture.dragged){const point=this.clientPoint();this.camera={x:gesture.camera.x-dx*this.viewWidth/point.width,y:gesture.camera.y-dy*this.viewHeight/point.height};this.paintCamera();}
  });
  const finish=(e,cancel=false)=>{
   if(!pointers.has(e.pointerId))return;
   const completed=gesture;pointers.delete(e.pointerId);release(e.pointerId);if(cancel)suppressTap=true;
   if(pointers.size>=2){startPinch();return;}
   if(pointers.size===1){const p=[...pointers.values()][0];gesture={kind:'pan',x:p.x,y:p.y,camera:{...this.camera},dragged:true};suppressTap=true;return;}
   gesture=null;this.svg.classList.remove('dragging');
   if(cancel||suppressTap||completed?.dragged||this.moving||!this.state)return;
   if(completed?.memory){this.inspectMemory(completed.memory);return;}
   if(completed?.key){const t=this.tiles.get(completed.key);if(t&&getAvailableMoves(this.state).some(p=>tileKey(p)===completed.key))this.onMove({q:t.q,r:t.r});}
  };
  this.svg.addEventListener('pointerup',e=>finish(e));this.svg.addEventListener('pointercancel',e=>finish(e,true));this.svg.addEventListener('lostpointercapture',e=>finish(e,true));
  this.svg.addEventListener('wheel',e=>{e.preventDefault();const point=this.clientPoint();const unit=e.deltaMode===1?16:e.deltaMode===2?point.height:1;const delta=Math.max(-600,Math.min(600,e.deltaY*unit));this.zoomBy(Math.exp(-delta*.002),e);},{passive:false});
  this.svg.addEventListener('keydown',e=>{
   if(this.moving||!this.state||(e.key!=='Enter'&&e.key!==' '))return;
   const key=e.target.closest('[data-key]')?.dataset.key,memory=e.target.closest('[data-memory]')?.dataset.memory;
   if(memory){e.preventDefault();this.inspectMemory(memory);}
   else if(key&&getAvailableMoves(this.state).some(p=>tileKey(p)===key)){e.preventDefault();const t=this.tiles.get(key);if(t)this.onMove({q:t.q,r:t.r});}
  });
 }
}
