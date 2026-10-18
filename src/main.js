import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {earthLayer,meshLayer,borderLayer,populationLayer,emptyRouteLayers} from './layers.js';
import {loadConnections} from './routes.js';
import {NewsLayer,fetchNews,NEWS_COLORS,NEWS_LABELS} from './news.js';
import {CrossBorderGlobe,showCrossBorderDetails} from './cross-border-globe.js';
import {llToXYZ} from './geo.js';
const $=id=>document.getElementById(id);const stage=$('globe'),status=$('status'),error=$('error');const prefersReduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const settings={rotate:!prefersReduced.matches,reduce:prefersReduced.matches,flicker:!prefersReduced.matches,quality:'auto',routesMotion:!prefersReduced.matches};
const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(40,1,.1,70);camera.position.set(0,0,3.55);const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;stage.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=1.68;controls.maxDistance=6.4;controls.enablePan=false;controls.autoRotate=settings.rotate;controls.autoRotateSpeed=.38;controls.enableZoom=true;const globe=new THREE.Group();scene.add(globe);const sun=new THREE.DirectionalLight(0x89f3ea,1.2);sun.position.set(4,3,5);scene.add(sun);scene.add(new THREE.AmbientLight(0x2e6272,.6));
const layers={earth:earthLayer(),mesh:meshLayer(),borders:null,population:null,...emptyRouteLayers()};globe.add(layers.earth,layers.mesh,layers.news,layers.air,layers.sea);
let pop=null,features=[],frame=0,last=performance.now();
const news=new NewsLayer(layers.news,camera,renderer.domElement);
const crossBorder=new CrossBorderGlobe(globe);
const crossBorderToggle=document.createElement('input');
crossBorderToggle.type='checkbox';crossBorderToggle.id='crossBorderToggle';crossBorderToggle.setAttribute('aria-label','Show cross-border news connections');
const crossBorderLabel=document.createElement('label');crossBorderLabel.className='switch';
const crossBorderCaption=document.createElement('span');crossBorderCaption.innerHTML='<i class="glyph" style="color:#f3bb75">↔</i> Cross-border news';
const crossBorderHint=document.createElement('small');crossBorderHint.id='crossBorderHint';
crossBorderHint.textContent='Off by default · waiting for headline evidence';
crossBorderCaption.append(crossBorderHint);crossBorderLabel.append(crossBorderCaption,crossBorderToggle);
const newsSwitch=document.getElementById('newsToggle')?.closest('label');
if(newsSwitch)newsSwitch.insertAdjacentElement('afterend',crossBorderLabel);
else document.querySelector('.panel .section')?.append(crossBorderLabel);
crossBorderToggle.addEventListener('change',()=>crossBorder.setVisible(crossBorderToggle.checked));
let newsFeed=null,newsLastUpdated=0,newsPointerDown=null,selectedNews=null;
// Geographic navigation is restricted to locations actually mapped in the RSS feed.
// This avoids suggesting coverage for places with no verified mapped news subject.
const geoNavSection=document.createElement('div');geoNavSection.className='section';
geoNavSection.innerHTML=`<div class="section-name">FIND A PLACE <span class="muted">/ MAPPED NEWS</span></div>
  <label for="geoNavSearch" style="display:block;color:#b7d5df;font-size:11px;line-height:1.5;margin-bottom:9px">Search mapped countries and cities</label>
  <input id="geoNavSearch" type="search" autocomplete="off" placeholder="e.g. New Zealand, Paris…" aria-controls="geoNavResults" aria-expanded="false" style="width:100%;padding:11px;border:1px solid #386276;border-radius:7px;background:#061824;color:#e4fffa;font-size:12px;box-sizing:border-box">
  <div id="geoNavResults" role="listbox" aria-label="Matching mapped locations" style="display:none;margin-top:7px;max-height:245px;overflow:auto;border:1px solid #284e5e;border-radius:8px;background:#092736"></div>
  <p id="geoNavStatus" role="status" aria-live="polite" style="font-size:10px;color:#8fb0be;line-height:1.5;margin:9px 0 0">Loading mapped locations…</p>`;
const panelHead=document.querySelector('.panel-head');
if(panelHead)panelHead.insertAdjacentElement('afterend',geoNavSection);
const geoInput=$('geoNavSearch'),geoResults=$('geoNavResults'),geoStatus=$('geoNavStatus');
let geoEntries=[];let geoFlight=null;
// v2.2E.1: opt-in, feed-grounded geographic discovery. No extra requests or inferred news.
const geoExplore=document.createElement('section');geoExplore.id='geoExplore';geoExplore.setAttribute('aria-label','Explore news around the world');
geoExplore.style.cssText='margin-top:12px;padding:11px;background:#0b2c3b;border:1px solid #31586b;border-radius:9px';
geoExplore.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><strong style="font-size:11px;letter-spacing:.08em;color:#7be2d9">EXPLORE SOMEWHERE</strong><button id="geoExploreMore" type="button" title="Show different places" style="background:#174455;border:1px solid #487e88;border-radius:6px;padding:5px 8px;color:#d8f8f3;cursor:pointer;font:inherit;font-size:11px">↻ Refresh</button></div>
<p style="font-size:10px;color:#b4ced6;line-height:1.5;margin:7px 0 9px">A few places with current mapped reporting.</p>
<div id="geoExploreItems" aria-live="polite" style="display:grid;gap:7px"></div>
<p style="font-size:9px;line-height:1.4;color:#8faeba;margin:8px 0 0">Sampled RSS news · not an importance ranking.</p>`;
geoNavSection.append(geoExplore);
let geoExplorePage=0,geoExploreCandidates=[];
const discoveryHash=s=>{let h=2166136261;for(const ch of s){h=Math.imul(h^ch.charCodeAt(0),16777619);}return h>>>0;};
const geoCategoryName=k=>({community:'Community',society:'Society',politics:'Politics',economy:'Economy',conflict:'Conflict',hazards:'Severe weather & hazards',environment:'Environment',health:'Health',education:'Education',science:'Science',rights:'Rights'})[k]||k;
function dominantGeoCategory(e){
 const ranked=[...e.points].sort((a,b)=>(Number(b.count)||0)-(Number(a.count)||0));return ranked[0]?.category||'';
}
function diverseGeoEntries(entries){
 // Approximate spatial diversity, not continent classification or a news ranking.
 const chosen=[],remaining=[...entries];
 while(remaining.length){
  const take=chosen.length===0?0:remaining.reduce((best,e,i)=>{
   const separation=Math.min(...chosen.slice(-3).map(c=>{const dr=(e.lat-c.lat)*Math.PI/180,dl=(e.lng-c.lng)*Math.PI/180;const t=Math.sin(dr/2)**2+Math.cos(e.lat*Math.PI/180)*Math.cos(c.lat*Math.PI/180)*Math.sin(dl/2)**2;return 2*Math.asin(Math.min(1,Math.sqrt(Math.max(0,t))))}));
   const reused=chosen.slice(-3).some(c=>dominantGeoCategory(c)===dominantGeoCategory(e));const score=separation-(reused?.25:0);return score>best.score?{i,score}:best;
  },{i:0,score:-Infinity}).i;
  chosen.push(remaining.splice(take,1)[0]);
 }
 return chosen;
}
function renderGeoExplore(){
 const box=$('geoExploreItems');box.replaceChildren();
 if(!geoExploreCandidates.length){const p=document.createElement('p');p.style.cssText='margin:0;color:#9bbcc7;font-size:11px';p.textContent='Suggestions will appear when mapped headlines are available.';box.append(p);$('geoExploreMore').disabled=true;return;}
 $('geoExploreMore').disabled=geoExploreCandidates.length<=3;
 const count=Math.min(3,geoExploreCandidates.length);const start=(geoExplorePage*count)%geoExploreCandidates.length;
 for(let i=0;i<count;i++){
  const e=geoExploreCandidates[(start+i)%geoExploreCandidates.length];
  const card=document.createElement('div');card.style.cssText='background:#103745;border:1px solid #315b6a;border-radius:7px;padding:9px';
  const top=document.createElement('div');top.style.cssText='display:flex;justify-content:space-between;gap:6px;align-items:center';
  const name=document.createElement('strong');name.textContent=e.name;name.style.cssText='color:#e4fcf7;font-size:12px';
  const hint=document.createElement('span');hint.textContent=e.count+' articles';hint.style.cssText='font-size:10px;color:#a3c2cb;white-space:nowrap';top.append(name,hint);
  const topic=document.createElement('div');topic.textContent='Coverage: '+geoCategoryName(dominantGeoCategory(e));topic.style.cssText='font-size:10px;color:#9dc7cc;margin:3px 0 7px';
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:7px;flex-wrap:wrap';
  const fly=document.createElement('button');fly.type='button';fly.textContent='Fly to';fly.style.cssText='background:#12505a;border:1px solid #39938f;border-radius:6px;padding:5px 8px;color:#d8fff7;cursor:pointer;font:inherit;font-size:10px';fly.addEventListener('click',()=>{if(historicalObservation)restoreLive();flyToGeo(e);});
  const read=document.createElement('button');read.type='button';read.textContent='Explore news ↗';read.style.cssText='background:#1c4051;border:1px solid #4e7382;border-radius:6px;padding:5px 8px;color:#e3fbfb;cursor:pointer;font:inherit;font-size:10px';read.addEventListener('click',()=>{if(historicalObservation)restoreLive();flyToGeo(e);openPlaceNews(e);});
  actions.append(fly,read);card.append(top,topic,actions);box.append(card);
 }
}
function refreshGeoExplore(){
 const eligible=geoEntries.filter(e=>e.count>=2&&e.points.some(p=>(p.articles||[]).some(a=>/^https:\/\//.test(a.url||''))));
 const date=new Date().toISOString().slice(0,10);
 const order=eligible.sort((a,b)=>discoveryHash(date+'|'+a.name)-discoveryHash(date+'|'+b.name));
 geoExploreCandidates=diverseGeoEntries(order);geoExplorePage=0;renderGeoExplore();
}
// 2.2E.2: A modest, dismissible overlay on the stage, not a WebGL/camera change.
// Numbers describe the current mapped RSS sample; no claims about event severity.
const glance=document.createElement('aside');glance.id='wpGlance';glance.setAttribute('aria-label','News at a glance');
glance.style.cssText='display:none;position:absolute;left:14px;bottom:68px;z-index:7;width:min(270px,calc(100% - 28px));max-height:42%;overflow:auto;border:1px solid #356376;border-radius:10px;padding:11px 13px;box-sizing:border-box;background:rgba(5,27,39,.92);color:#e2f7f6;box-shadow:0 10px 25px #0005;pointer-events:auto;font-size:11px';
glance.innerHTML=`<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><strong style="color:#7be2d9;letter-spacing:.09em;font-size:10px">NEWS AT A GLANCE</strong><button id="wpGlanceHide" aria-label="Hide news at a glance" type="button" style="border:1px solid #416579;border-radius:5px;background:#143746;color:#d7eff1;cursor:pointer;padding:3px 6px">×</button></div><div id="wpGlanceSummary" style="line-height:1.6;color:#a9c8d1;margin-top:7px">Waiting for mapped headlines…</div><div id="wpGlanceTopics" style="display:grid;gap:4px;margin-top:7px"></div><button id="wpGlanceExplore" type="button" style="margin-top:9px;border:1px solid #397b7d;border-radius:6px;background:#14505a;color:#e0fff9;cursor:pointer;padding:7px 9px;font:inherit">Explore a place ↗</button><div role="group" aria-label="News marker legend" style="margin-top:10px;padding-top:9px;border-top:1px solid #2b4d5d"><strong style="color:#86ded5;font-size:10px;letter-spacing:.07em">GLOBE MARKERS</strong><div style="margin-top:5px;color:#b8d0d8">Colour = news category · Size = sampled article coverage</div><div style="display:flex;align-items:center;gap:11px;margin-top:8px;color:#b8d0d8;flex-wrap:wrap"><span><i style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#9ce7da;vertical-align:middle;margin-right:4px"></i>1–2</span><span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#9ce7da;vertical-align:middle;margin-right:4px"></i>3–7</span><span><i style="display:inline-block;width:15px;height:15px;border-radius:50%;background:#9ce7da;vertical-align:middle;margin-right:4px"></i>8+</span></div><div style="color:#91b3be;font-size:9px;margin-top:6px">Hover a marker to highlight it. Larger does not mean more important.</div></div><div style="color:#88aab6;font-size:9px;line-height:1.4;margin-top:7px">RSS sample, not all world news or a measure of event importance.</div>`;
const glanceToggle=document.createElement('button');glanceToggle.type='button';glanceToggle.textContent='◉ News at a glance';glanceToggle.setAttribute('aria-label','Show news at a glance');glanceToggle.style.cssText='display:block;position:absolute;left:14px;bottom:68px;z-index:7;border:1px solid #356376;border-radius:7px;padding:8px 10px;background:#092938;color:#9de5dd;cursor:pointer;pointer-events:auto;font-size:11px';
glance.hidden=true; // Default to the unobstructed globe; visitors can open the summary on demand.
const globeStage=$('stage');if(globeStage){globeStage.append(glance,glanceToggle);}
$('wpGlanceHide').addEventListener('click',()=>{glance.hidden=true;glance.style.display='none';glanceToggle.style.display='block';});
glanceToggle.addEventListener('click',()=>{glance.hidden=false;glance.style.display='block';glanceToggle.style.display='none';});
let glanceSuggested=null;
$('wpGlanceExplore').addEventListener('click',()=>{const e=glanceSuggested||geoExploreCandidates[0];if(!e)return;if(historicalObservation)restoreLive();flyToGeo(e);openPlaceNews(e);});
function renderAtGlance(){
 const points=newsFeed?.points||[];const summary=$('wpGlanceSummary'),topics=$('wpGlanceTopics');topics.replaceChildren();
 if(!points.length){summary.textContent='Mapped news is currently unavailable.';$('wpGlanceExplore').disabled=true;return;}
 const uniquePlaces=new Set(points.map(p=>String(p.name||'').toLocaleLowerCase()).filter(Boolean));
 const categories=new Map();for(const p of points){categories.set(p.category,(categories.get(p.category)||0)+(Number(p.count)||0));}
 summary.textContent=`${uniquePlaces.size} mapped places · ${points.length} geographic/category signals`;
 for(const [key,value] of [...categories].sort((a,b)=>b[1]-a[1]).slice(0,3)){
  const line=document.createElement('div');line.style.cssText='display:flex;justify-content:space-between;gap:10px;color:#c2dce1';
  const label=document.createElement('span');label.textContent=geoCategoryName(key);
  const amount=document.createElement('span');amount.textContent=value+' sampled articles';amount.style.cssText='color:#8ecbc9;white-space:nowrap';line.append(label,amount);topics.append(line);
 }
 glanceSuggested=geoExploreCandidates[0]||null;
 $('wpGlanceExplore').disabled=!glanceSuggested;
 $('wpGlanceExplore').textContent=glanceSuggested?'Explore '+glanceSuggested.name+' ↗':'Explore a place ↗';
}
$('geoExploreMore').addEventListener('click',()=>{geoExplorePage++;renderGeoExplore();});
function buildGeoEntries(){
 const entries=new Map();
 for(const p of newsFeed?.points||[]){
  if(!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lng))||!p.name)continue;
  const key=String(p.name).trim().toLocaleLowerCase();if(!key)continue;
  let e=entries.get(key);
  if(!e){e={name:String(p.name).trim(),lat:Number(p.lat),lng:Number(p.lng),accuracy:p.accuracy||'place',points:[],count:0};entries.set(key,e);}
  e.points.push(p);e.count+=Number(p.count)||0;
 }
 geoEntries=[...entries.values()].sort((a,b)=>a.name.localeCompare(b.name));
 geoStatus.textContent=geoEntries.length+' mapped locations available · locations are news subjects, not verified event sites';
 refreshGeoExplore();
 if(geoInput.value.trim())showGeoMatches();
}
function flyToGeo(e){
 const start=camera.position.clone().normalize();const end=new THREE.Vector3(...llToXYZ(e.lat,e.lng,1)).normalize();
 // Slerp unit vectors, with a stable midpoint for antipodal positions.
 const q=new THREE.Quaternion().setFromUnitVectors(start,end);
 geoFlight={start,rotation:q,started:performance.now(),duration:settings.reduce?0:1250,dist:camera.position.length(),place:e.name};
 settings.rotate=false;$('rotationToggle').checked=false;
 controls.autoRotate=false;controls.target.set(0,0,0);
 geoStatus.textContent='Flying to '+e.name+' · representative geographic location';
}
function showGeoMatches(){
 const term=geoInput.value.trim().toLocaleLowerCase();geoResults.replaceChildren();
 geoInput.setAttribute('aria-expanded',term?'true':'false');
 if(!term){geoResults.style.display='none';return;}
 const matches=geoEntries.filter(e=>e.name.toLocaleLowerCase().includes(term)).sort((a,b)=>(a.name.toLocaleLowerCase().startsWith(term)?-1:0)-(b.name.toLocaleLowerCase().startsWith(term)?-1:0)||a.name.localeCompare(b.name)).slice(0,12);
 geoResults.style.display='block';
 if(!matches.length){const msg=document.createElement('p');msg.textContent='No mapped news location matches. Try a broader name.';msg.style.cssText='padding:9px;color:#aac9d4;font-size:11px';geoResults.append(msg);return;}
 for(const e of matches){
  const item=document.createElement('div');item.setAttribute('role','option');item.style.cssText='padding:9px;border-bottom:1px solid #224452;display:flex;flex-wrap:wrap;align-items:center;gap:6px';
  const title=document.createElement('div');title.style.cssText='flex:1;min-width:115px';
  const strong=document.createElement('strong');strong.textContent=e.name;strong.style.cssText='font-size:12px;color:#e2faf5;display:block';
  const small=document.createElement('small');small.textContent=e.points.length+' category signal(s) · '+e.accuracy;small.style.cssText='font-size:10px;color:#8facbc';title.append(strong,small);
  const fly=document.createElement('button');fly.type='button';fly.textContent='Fly to';fly.style.cssText='padding:6px 8px;border-radius:5px;background:#12505a;border:1px solid #338d8a;color:#dbfff5;font-size:11px';
  fly.addEventListener('click',()=>{flyToGeo(e);geoResults.style.display='none';geoInput.setAttribute('aria-expanded','false');});
  const view=document.createElement('button');view.type='button';view.textContent='News';view.style.cssText='padding:6px 8px;border-radius:5px;background:#153444;border:1px solid #376171;color:#e1f5f9;font-size:11px';
  view.addEventListener('click',()=>{flyToGeo(e);openPlaceNews(e);geoResults.style.display='none';geoInput.setAttribute('aria-expanded','false');});
  item.append(title,fly,view);geoResults.append(item);
 }
}
geoInput.addEventListener('input',showGeoMatches);
geoInput.addEventListener('keydown',e=>{if(e.key==='Escape'){geoInput.value='';showGeoMatches();}else if(e.key==='Enter'){const first=geoEntries.find(x=>x.name.toLocaleLowerCase()===geoInput.value.trim().toLocaleLowerCase())||geoEntries.find(x=>x.name.toLocaleLowerCase().includes(geoInput.value.trim().toLocaleLowerCase()));if(first&&geoInput.value.trim()){flyToGeo(first);geoResults.style.display='none';}}});
renderer.domElement.addEventListener('pointerdown',()=>{geoFlight=null;});
function advanceGeoFlight(now){
 if(!geoFlight)return;
 const f=geoFlight,t=f.duration?Math.min(1,(now-f.started)/f.duration):1;
 const eased=t*t*(3-2*t);const rotation=new THREE.Quaternion().identity().slerp(f.rotation,eased);
 camera.position.copy(f.start).applyQuaternion(rotation).multiplyScalar(f.dist);
 camera.lookAt(0,0,0);
 if(t>=1)geoFlight=null;
}

let historicalObservation=null;
// The compact 2.1A archive keeps at most 45 geographic location/category entries
// per observation. It is NOT a full copy of the live geographic feed.
const historicalDots=new THREE.Group();globe.add(historicalDots);
const historyDotGeometry=new THREE.SphereGeometry(.0075,7,6);
const historyDotMaterial=new THREE.MeshBasicMaterial({color:0xffcd79,transparent:true,opacity:.95,depthTest:true,depthWrite:false});
let historyDotsMesh=null;
function setHistoricalDots(points){
 if(historyDotsMesh){historicalDots.remove(historyDotsMesh);historyDotsMesh.dispose?.();historyDotsMesh=null;}
 if(!points.length)return;
 historyDotsMesh=new THREE.InstancedMesh(historyDotGeometry,historyDotMaterial,points.length);
 const proxy=new THREE.Object3D();
 points.forEach((p,i)=>{const xyz=llToXYZ(p.lat,p.lng,1.035);proxy.position.set(...xyz);proxy.updateMatrix();historyDotsMesh.setMatrixAt(i,proxy.matrix);});
 historyDotsMesh.instanceMatrix.needsUpdate=true;
 historicalDots.add(historyDotsMesh);
}
const historicalBanner=document.createElement('div');
historicalBanner.id='wp-historical-banner';historicalBanner.hidden=true;
historicalBanner.style.cssText='position:absolute;z-index:4;left:50%;top:12px;transform:translateX(-50%);width:max-content;max-width:calc(100% - 24px);display:none;align-items:center;justify-content:center;flex-wrap:wrap;gap:7px 13px;padding:7px 10px;background:#0a2b39ee;border:1px solid #e2b77a;border-radius:9px;color:#fff0d5;font:11px system-ui;box-shadow:0 8px 24px #0009;pointer-events:auto';
const historicalText=document.createElement('span');
const historicalCoverage=document.createElement('small');historicalCoverage.style.cssText='color:#d9b987;font-size:10px';
const liveButton=document.createElement('button');liveButton.type='button';liveButton.textContent='Return to Live';liveButton.style.cssText='padding:6px 10px;border-radius:6px;background:#185264;color:#eafff8;border:1px solid #69c2c0;cursor:pointer';
historicalBanner.append(historicalText,historicalCoverage,liveButton);stage.append(historicalBanner);
function setHistoricalBanner(on,at,visible=0,stored=0,total=0){
 historicalBanner.hidden=!on;historicalBanner.style.display=on?'flex':'none';
 historicalText.textContent=on?'ARCHIVE · '+new Date(at).toLocaleString()+' · geographic subjects':'';
 historicalCoverage.textContent=on?`${visible} plotted / ${stored} stored${total?` · ${total} live-feed signals at collection`:''} · sample capped at 45`:'';
}
function restoreLive(){
 historicalObservation=null;setHistoricalDots([]);setHistoricalBanner(false);
 layers.news.visible=$('newsToggle').checked;
 if(newsFeed)news.setPoints(newsFeed.points);
 updateNews();window.dispatchEvent(new CustomEvent('worldpulse:historical-mode',{detail:{active:false}}));
}
liveButton.addEventListener('click',restoreLive);
window.addEventListener('worldpulse:show-history',event=>{
 const sample=event.detail?.snapshot;const at=sample?.at;
 if(!sample||!Number.isFinite(Date.parse(at)))return;
 const rows=Array.isArray(sample.locations)?sample.locations:[];
 const points=rows.filter(p=>p&&p.lat!==null&&p.lng!==null&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))&&Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lng))<=180&&Number(p.sampled_article_count)>0).map(p=>({lat:Number(p.lat),lng:Number(p.lng),name:String(p.name||'Geographic subject'),category:p.category,count:Number(p.sampled_article_count),accuracy:p.accuracy||'country',articles:[]}));
 historicalObservation={at,points};
 // Gold points are intentionally distinct from live multicolour category markers.
 layers.news.visible=false;setHistoricalDots(points);historicalDots.visible=$('newsToggle').checked;
 setHistoricalBanner(true,at,points.length,rows.length,Number(sample.mapped_signals)||0);
 window.dispatchEvent(new CustomEvent('worldpulse:historical-mode',{detail:{active:true,at,count:points.length,stored:rows.length,feedSignals:Number(sample.mapped_signals)||0}}));
});
window.addEventListener('worldpulse:return-live',restoreLive);

const safeText=v=>typeof v==='string'?v:'';
const browseExtras=()=>Array.isArray(newsFeed?.meta?.unlocated_articles)?newsFeed.meta.unlocated_articles.filter(a=>typeof a.url==='string'&&/^https:\/\//i.test(a.url)&&a.location_status==='unverified'&&news.categories.has(a.category)):[];
const readableDate=value=>{if(!value)return 'Unknown update time';const t=new Date(value);return isNaN(t.getTime())?'Unknown update time':t.toLocaleString();};
function makeFilterUI(){
 const holder=$('newsFilters');holder.replaceChildren();
 for(const [k,label] of Object.entries(NEWS_LABELS)){
  const b=document.createElement('button');b.className='news-filter'+(news.categories.has(k)?' on':'');b.type='button';
  const i=document.createElement('i');i.style.background=NEWS_COLORS[k];b.append(i,document.createTextNode(label));
  b.addEventListener('click',()=>{const on=!b.classList.contains('on');b.classList.toggle('on',on);news.setCategory(k,on);if($('storySearch').value)exploreStories();renderDiscovery();});holder.append(b);
 }
}
async function updateNews(){
 $('newsHint').textContent='Loading mapped headlines…';
 try{
  const d=await fetchNews();newsFeed=d;buildGeoEntries();renderAtGlance();if(!historicalObservation)news.setPoints(d.points);newsLastUpdated=Date.now();
   const crossCount=crossBorder.setLinks(d.meta?.cross_border || d.cross_border);
   crossBorderHint.textContent=crossCount?`${crossCount} headline-supported candidates · select an arc for sources`:'No qualifying bilateral headlines in this refresh';
   crossBorderToggle.disabled=!crossCount;
   crossBorder.setVisible(crossBorderToggle.checked && crossCount>0);
  $('newsHint').textContent=d.points.length.toLocaleString()+' geographic signals · '+(d.meta.status||'snapshot');
  $('newsStats').textContent=d.points.reduce((n,p)=>n+p.count,0).toLocaleString()+' mapped sampled articles · '+(Array.isArray(d.meta.unlocated_articles)?d.meta.unlocated_articles.length+' extra browse-only articles · ':'')+'Updated '+readableDate(d.meta.updated_at)+(d.meta.status==='partial'?' · partial feeds':'')+(d.meta.status==='stale'?' · feed reported stale':'');
  if($('storySearch').value.trim())exploreStories();
  renderDiscovery();
  console.info('WorldPulse news ready',d.points.length,'mapped geographic signals, source:',d.source);
 }catch(e){
  console.warn('WorldPulse news:',e);$('newsHint').textContent='News feed unavailable';
  $('newsStats').textContent='No news snapshot could be loaded. The globe, population and route layers remain available. Check the original WorldPulse news feed or upload a local data/news.json snapshot.';
 }
}
// 2.2B — Location News: an accessible, focused reading workspace.
// Article URLs are deduplicated across category signals for this location.
const placeStyle=document.createElement('style');
placeStyle.textContent=`
.wp-place[hidden]{display:none!important}.wp-place{position:fixed;inset:0;z-index:1100;background:rgba(2,12,20,.82);backdrop-filter:blur(9px);display:flex;align-items:center;justify-content:center;padding:clamp(12px,3vw,35px)}
.wp-place-dialog{display:flex;flex-direction:column;width:min(1040px,100%);max-height:95vh;min-height:0;overflow:hidden;border:1px solid #356775;border-radius:14px;background:#071c29;color:#e5f9fc;box-shadow:0 22px 85px #000b}
.wp-place-head{padding:22px 25px 13px;border-bottom:1px solid #294653;display:flex;align-items:flex-start;gap:18px;justify-content:space-between}
.wp-place-head h2{margin:5px 0 4px;font-size:clamp(22px,3vw,34px);line-height:1.15}.wp-place-head p{margin:0;color:#9dbbc6;font-size:12px;line-height:1.5}
.wp-place-kicker{font-size:10px;letter-spacing:.18em;color:#71e4d5;font-weight:750}.wp-place-button{background:#123847;border:1px solid #376a79;border-radius:7px;color:#d5faf5;padding:9px 12px;cursor:pointer;font-size:12px}
.wp-place-button:hover{background:#20505d}.wp-place-toolbar{display:flex;flex-wrap:wrap;align-items:end;gap:12px;padding:14px 25px;border-bottom:1px solid #294653}
.wp-place-toolbar label{display:grid;gap:6px;font-size:11px;color:#99bdc8;min-width:160px;flex:1}.wp-place-toolbar select{color:#e2fbf6;border:1px solid #386171;background:#0b2c3b;padding:9px 11px;border-radius:6px;width:100%;font-size:12px}
.wp-place-content{overflow-y:auto;padding:18px 25px 25px;min-height:0;overscroll-behavior:contain}.wp-place-meta{font-size:11px;color:#a5c6ce;margin:0 0 16px;line-height:1.6}
.wp-place-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;align-items:stretch}.wp-place-card{background:#0c2a39;border:1px solid #294a5a;border-radius:9px;padding:15px;min-width:0;display:flex;flex-direction:column;gap:9px}
.wp-place-card strong{font-size:14px;line-height:1.43;color:#e9faff;overflow-wrap:anywhere}.wp-place-card small{font-size:11px;color:#9eb9c6;line-height:1.5}.wp-place-card a{font-size:12px;color:#91f0df;text-decoration:none;font-weight:650;margin-top:auto;align-self:flex-start}.wp-place-card a:hover{text-decoration:underline}.wp-place-empty{padding:25px 5px;color:#a4c2cd;font-size:13px}
.wp-place-view{display:flex;flex-direction:column;align-items:flex-start;gap:8px;flex-wrap:wrap;padding:13px 25px 14px;border-bottom:1px solid #294653;background:#0c2837}.wp-place-view-label{font-size:11px;font-weight:700;letter-spacing:.07em;color:#abd0d7}.wp-place-view-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.wp-place-view .wp-place-button{min-height:38px}.wp-place-view button[aria-pressed="true"]{background:#246879;border-color:#78cbd0;color:#fff}.wp-place-group{background:#0c2a39;border:1px solid #294a5a;border-radius:9px;padding:16px;min-width:0;display:flex;flex-direction:column;gap:9px}.wp-place-group-featured{border-color:#3a7580;background:#103343}.wp-place-group strong{font-size:14px;line-height:1.43}.wp-place-group small{font-size:11px;color:#9eb9c6;line-height:1.5}.wp-place-group details{margin-top:auto;border-top:1px solid #244653;padding-top:8px}.wp-place-group summary{cursor:pointer;color:#88e9d9;font-size:12px;font-weight:650}.wp-place-source{display:flex;gap:8px;justify-content:space-between;align-items:baseline;padding:9px 0;border-bottom:1px solid #234452}.wp-place-source a{color:#91f0df;font-size:12px;overflow-wrap:anywhere}.wp-place-source small{white-space:nowrap}.wp-place-single-link{color:#91f0df;font-size:12px;font-weight:650;margin-top:auto}.wp-place-group-note{font-size:11px;color:#8eb5c3;line-height:1.5}.wp-place-group:has(details[open]){grid-column:1/-1}.wp-place-group details[open] summary{margin-bottom:10px}.wp-place-back{display:inline-flex;align-items:center;justify-content:center;gap:6px;align-self:flex-start;background:#246879;border:1px solid #76bfc2;border-radius:7px;color:#fff;font-size:12px;font-weight:750;min-height:38px;padding:9px 14px;margin:5px 0 12px;cursor:pointer}.wp-place-back:hover,.wp-place-back:focus-visible{background:#327d89;outline-offset:3px}.wp-place-group details[open] .wp-place-source{max-width:100%}
.wp-place-group-tools{display:flex;align-items:end;gap:12px;flex-wrap:wrap;padding:5px 0 12px}.wp-place-group-tools label{display:grid;gap:6px;font-size:11px;color:#a5c6ce;flex:1;min-width:180px}.wp-place-group-search{background:#092635;color:#e9fcfc;border:1px solid #42707f;border-radius:6px;padding:10px 12px;width:100%;font:inherit;font-size:12px}.wp-place-group-show{cursor:pointer;background:#163f4e;border:1px solid #3d7280;border-radius:7px;padding:9px 12px;font:inherit;font-size:12px;font-weight:650;color:#b6f5e8}.wp-place-group-show:hover,.wp-place-group-show:focus-visible{background:#225c68}.wp-place-group-results{color:#a5c6ce;font-size:11px;margin-bottom:4px}.wp-place-group-none{color:#b5cad0;font-size:12px;padding:12px 0}.wp-place-group .wp-place-source[hidden],.wp-place-group .wp-place-group-none[hidden]{display:none}
@media(max-width:700px){.wp-place-view{padding:12px 15px}.wp-place-view-actions{width:100%}.wp-place-view-actions .wp-place-button{flex:1}.wp-place{padding:6px;align-items:stretch}.wp-place-dialog{max-height:none;height:100%;border-radius:8px}.wp-place-head{padding:15px}.wp-place-toolbar{padding:12px 15px}.wp-place-content{padding:14px}.wp-place-list{grid-template-columns:minmax(0,1fr)}}`;
document.head.append(placeStyle);
const placeOverlay=document.createElement('div');placeOverlay.className='wp-place';placeOverlay.hidden=true;
placeOverlay.innerHTML=`<section class="wp-place-dialog" role="dialog" aria-modal="true" aria-labelledby="wpPlaceName">
 <header class="wp-place-head"><div><div class="wp-place-kicker">WORLDPULSE / LOCATION NEWS</div><h2 id="wpPlaceName"></h2><p id="wpPlaceSubtitle"></p></div><button id="wpPlaceClose" class="wp-place-button" type="button" aria-label="Close location news">Close ✕</button></header>
 <div class="wp-place-toolbar"><label>Category<select id="wpPlaceCategory"></select></label><label>Publisher<select id="wpPlacePublisher"></select></label><label>Sort articles<select id="wpPlaceOrder"><option value="recent">Newest first</option><option value="oldest">Oldest first</option><option value="publisher">Publisher A–Z</option></select></label><button class="wp-place-button" id="wpPlaceFly" type="button">Fly to on globe ↗</button></div>
 <div class="wp-place-view" role="group" aria-label="Article display mode"><span class="wp-place-view-label">VIEW MODE</span><div class="wp-place-view-actions"><button class="wp-place-button" id="wpPlaceGrouped" aria-pressed="true" type="button">Grouped stories</button><button class="wp-place-button" id="wpPlaceFlat" aria-pressed="false" type="button">All articles</button></div><span class="wp-place-group-note">Related coverage themes · not verified single events</span></div>
 <div class="wp-place-content"><p class="wp-place-meta" id="wpPlaceCount" role="status"></p><div class="wp-place-list" id="wpPlaceArticles"></div></div></section>`;
document.body.append(placeOverlay);
let activePlace=null,placeReturnFocus=null,placeDisplayMode='grouped';
// v2.2D.2: Separate thematic coverage (not necessarily one event) from close-headline matches.
// Small, explicit dictionary: avoid assigning stories to a theme on a single generic word.
const GROUP_STOP=new Set('a an and as at after before by for from in into is it its of on or over the to was were with amid across against about under new latest live news update updates report reports says say more how why what who when where world country city people today yesterday'.split(' '));
function headlineWords(title){return new Set(String(title||'').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').split(/\s+/).filter(w=>w.length>=4&&!GROUP_STOP.has(w)));}
function sameHeadlineStory(a,b){
 const aa=headlineWords(a.title),bb=headlineWords(b.title);if(aa.size<3||bb.size<3)return false;
 const common=[...aa].filter(w=>bb.has(w)).length;
 return common>=3 && common/Math.min(aa.size,bb.size)>=.68 && common/Math.max(aa.size,bb.size)>=.36;
}
const PLACE_THEMES=[
 ['Protests and public demonstrations',/\b(protest(?:s|ers|ing)?|demonstrat(?:ion|ions|ors|ors|ing)|unrest|riot(?:s|ing)?|mass march(?:es)?|student revolt)\b/i],
 ['Elections and voting',/\b(election(?:s)?|referendum|ballot(?:s)?|voting|vote count|polling station)\b/i],
 ['Storms and severe weather',/\b(hurricane|typhoon|cyclone|tornado|tropical storm)\b/i],
 ['Earthquakes and seismic activity',/\b(earthquake(?:s)?|aftershock(?:s)?|seismic tremor(?:s)?)\b/i],
 ['Wildfires and bushfires',/\b(wildfire(?:s)?|bushfire(?:s)?|forest fire(?:s)?)\b/i],
 ['Flooding and flood response',/\b(flood(?:s|ing|waters)?|flash flood(?:s)?)\b/i],
 ['Armed conflict and ceasefires',/\b(airstrike(?:s)?|ceasefire(?:s)?|missile strike(?:s)?|armed clashes|military offensive)\b/i],
 ['Housing and accommodation',/\b(housing crisis|housing shortage|housing protest(?:s)?|rental crisis|rent increase(?:s)?|homelessness)\b/i]
];
function placeTheme(title){for(const [name,rx] of PLACE_THEMES)if(rx.test(title||''))return name;return null;}
function makePlaceGroups(rows){
 // A geographic place is already selected by the visitor; a theme is an editorial
 // browsing aid, never a claim that its articles describe the same incident.
 const themes=new Map();const leftovers=[];
 for(const row of rows){const t=placeTheme(row.title);if(t){if(!themes.has(t))themes.set(t,[]);themes.get(t).push(row);}else leftovers.push(row);}
 const groups=[];
 for(const [name,articles] of themes){if(articles.length>=2)groups.push({rows:articles,label:name,type:'theme'});else leftovers.push(...articles);}
 // Remaining articles may be grouped only when headline wording is close.
 for(const row of leftovers){let found=null;for(const g of groups){if(g.type==='headline'&&g.rows.every(other=>sameHeadlineStory(row,other))){found=g;break;}}
  if(found)found.rows.push(row);else groups.push({rows:[row],label:null,type:'headline'});
 }
 // Sort by substantive coverage first, then the selected sort order within the theme.
 groups.sort((a,b)=>(b.rows.length>1)-(a.rows.length>1)||b.rows.length-a.rows.length);
 return groups;
}
const placeDate=a=>Date.parse(a.published_at||a.date||'')||0;
const placeEntries=e=>{
 const byUrl=new Map();for(const point of e.points||[])for(const article of point.articles||[]){
  if(typeof article.url!=='string'||!/^https?:\/\//i.test(article.url))continue;
  if(!byUrl.has(article.url))byUrl.set(article.url,{...article,categories:new Set()});
  byUrl.get(article.url).categories.add(point.category);
 }return [...byUrl.values()];
};
function setPlaceOptions(select,labels,value){select.replaceChildren();for(const [key,name] of labels){const opt=document.createElement('option');opt.value=key;opt.textContent=name;select.append(opt);}select.value=value;}
function renderPlaceNews(){
 if(!activePlace)return;
 const all=placeEntries(activePlace);const cat=$('wpPlaceCategory').value,pub=$('wpPlacePublisher').value;
 const matches=all.filter(a=>(cat==='all'||a.categories.has(cat))&&(pub==='all'||(a.publisher||'Publisher unspecified')===pub));
 const sort=$('wpPlaceOrder').value;
 matches.sort((a,b)=>sort==='publisher'?(a.publisher||'').localeCompare(b.publisher||'')||placeDate(b)-placeDate(a):sort==='oldest'?placeDate(a)-placeDate(b):placeDate(b)-placeDate(a));
 $('wpPlaceGrouped').setAttribute('aria-pressed',String(placeDisplayMode==='grouped'));
 $('wpPlaceFlat').setAttribute('aria-pressed',String(placeDisplayMode==='flat'));
 const target=$('wpPlaceArticles');target.replaceChildren();
 if(!matches.length){$('wpPlaceCount').textContent=`No matching articles · ${all.length} linked article${all.length===1?'':'s'} available`;const msg=document.createElement('p');msg.className='wp-place-empty';msg.textContent='No linked articles match these filters. Try All categories or All publishers.';target.append(msg);return;}
 if(placeDisplayMode==='flat'){
  $('wpPlaceCount').textContent=`Showing ${matches.length} of ${all.length} distinct linked articles · ${activePlace.points.length} geographic category signals · sampled RSS coverage`;
  for(const a of matches){const card=document.createElement('article');card.className='wp-place-card';const title=document.createElement('strong');title.textContent=a.title||'Untitled article';const desc=document.createElement('small');desc.textContent=[a.publisher||'Publisher unspecified',[...a.categories].map(c=>NEWS_LABELS[c]||c).join(' / '),placeDate(a)?new Date(placeDate(a)).toLocaleString():null].filter(Boolean).join(' · ');const link=document.createElement('a');link.href=a.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Read original article ↗';card.append(title,desc,link);target.append(card);}
  return;
 }
 const groups=makePlaceGroups(matches);
 const combined=groups.filter(g=>g.rows.length>1).length;
 const covered=groups.filter(g=>g.rows.length>1).reduce((n,g)=>n+g.rows.length,0);
 $('wpPlaceCount').textContent=combined?`${groups.length} coverage cards · ${covered} of ${matches.length} articles in ${combined} related-coverage group${combined===1?'':'s'} · topics are not verified single events`:`${matches.length} articles · no confident related-coverage groups in this selection · try All articles`;
 for(const g of groups){const lead=g.rows[0];const pubs=new Set(g.rows.map(a=>a.publisher||'Publisher unspecified'));const card=document.createElement('article');card.className='wp-place-group';if(g.rows.length>1)card.classList.add('wp-place-group-featured');const title=document.createElement('strong');title.textContent=g.type==='theme'&&g.rows.length>1?`Related coverage: ${g.label}`:(lead.title||'Untitled article');const meta=document.createElement('small');meta.textContent=[...lead.categories].map(c=>NEWS_LABELS[c]||c).join(' / ')+' · '+g.rows.length+' article'+(g.rows.length===1?'':'s')+' · '+pubs.size+' publisher label'+(pubs.size===1?'':'s');card.append(title,meta);
  if(g.rows.length===1){const link=document.createElement('a');link.className='wp-place-single-link';link.href=lead.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Read original article ↗';card.append(link);}
  else{const expl=document.createElement('small');expl.textContent=g.type==='theme'?'Articles share a reporting theme; they may describe different events.':'Headlines have closely overlapping wording; independently verify the reporting.';card.append(expl);const details=document.createElement('details');const sum=document.createElement('summary');sum.textContent=`Explore ${g.rows.length} articles · ${pubs.size} publisher labels`;details.append(sum);
   const back=document.createElement('button');back.type='button';back.className='wp-place-back';back.textContent='← Back to grouped stories';back.setAttribute('aria-label','Close this coverage group and return to grouped stories');back.addEventListener('click',()=>{details.open=false;sum.focus();card.scrollIntoView({block:'nearest',behavior:'smooth'});});
   details.append(back);
   // A coverage theme may include many different events. Allow visitors to scan a
   // short selection, search its headlines and reveal the rest without regrouping.
   const groupTools=document.createElement('div');groupTools.className='wp-place-group-tools';
   const searchLabel=document.createElement('label');searchLabel.textContent='Find within this coverage';
   const searchInput=document.createElement('input');searchInput.type='search';searchInput.className='wp-place-group-search';searchInput.placeholder='Search headlines or publishers';searchInput.setAttribute('aria-label','Search headlines and publishers in this group');searchLabel.append(searchInput);
   const more=document.createElement('button');more.type='button';more.className='wp-place-group-show';
   groupTools.append(searchLabel,more);details.append(groupTools);
   const resultInfo=document.createElement('div');resultInfo.className='wp-place-group-results';resultInfo.setAttribute('role','status');details.append(resultInfo);
   const sources=[];
   for(const a of g.rows){const item=document.createElement('div');item.className='wp-place-source';const link=document.createElement('a');link.href=a.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=(a.publisher||'Publisher unspecified')+' — '+(a.title||'Read original');item.append(link);if(placeDate(a)){const time=document.createElement('small');time.textContent=new Date(placeDate(a)).toLocaleDateString();item.append(time);}details.append(item);sources.push({item,searchText:((a.title||'')+' '+(a.publisher||'')).toLocaleLowerCase()});}
   const empty=document.createElement('p');empty.className='wp-place-group-none';empty.textContent='No headlines match this search. Try a broader term.';empty.hidden=true;details.append(empty);
   let showAll=false;const VISIBLE_FIRST=8;
   function updateGroupView(){const query=searchInput.value.trim().toLocaleLowerCase();const found=sources.filter(s=>s.searchText.includes(query));const limit=(query||showAll)?found.length:Math.min(VISIBLE_FIRST,found.length);sources.forEach(s=>{s.item.hidden=true;});found.forEach((s,i)=>{s.item.hidden=i>=limit;});empty.hidden=found.length!==0;resultInfo.textContent=query?`${found.length} of ${sources.length} articles match your search`:`Showing ${limit} of ${sources.length} articles`;more.hidden=!!query||sources.length<=VISIBLE_FIRST;more.textContent=showAll?'Show fewer articles':`Show all ${sources.length} articles`;}
   searchInput.addEventListener('input',updateGroupView);more.addEventListener('click',()=>{showAll=!showAll;updateGroupView();more.focus();});
   details.addEventListener('toggle',()=>{if(details.open)updateGroupView();});updateGroupView();card.append(details);}
  target.append(card);
 }
}
function openPlaceNews(e){
 if(historicalObservation){geoStatus.textContent='Return to Live to browse current location articles.';return;}
 activePlace=e;placeReturnFocus=document.activeElement;
 $('wpPlaceName').textContent=e.name;
 $('wpPlaceSubtitle').textContent=`${e.accuracy==='country'?'Country-level subject':e.accuracy==='region'?'Regional subject':'Mapped geographic subject'} · representative coordinates, not a verified incident location`;
 const all=placeEntries(e);const cats=[...new Set(all.flatMap(a=>[...a.categories]))].sort();const pubs=[...new Set(all.map(a=>a.publisher||'Publisher unspecified'))].sort((a,b)=>a.localeCompare(b));
 setPlaceOptions($('wpPlaceCategory'),[['all','All categories'],...cats.map(c=>[c,NEWS_LABELS[c]||c])],'all');
 setPlaceOptions($('wpPlacePublisher'),[['all','All publishers'],...pubs.map(p=>[p,p])],'all');
 $('wpPlaceOrder').value='recent';placeDisplayMode='grouped';
 placeOverlay.hidden=false;renderPlaceNews();$('wpPlaceClose').focus();
}
function closePlaceNews(){placeOverlay.hidden=true;activePlace=null;placeReturnFocus?.focus?.();}
$('wpPlaceClose').addEventListener('click',closePlaceNews);
$('wpPlaceGrouped').addEventListener('click',()=>{placeDisplayMode='grouped';renderPlaceNews();});
$('wpPlaceFlat').addEventListener('click',()=>{placeDisplayMode='flat';renderPlaceNews();});
placeOverlay.addEventListener('click',e=>{if(e.target===placeOverlay)closePlaceNews();});
for(const id of ['wpPlaceCategory','wpPlacePublisher','wpPlaceOrder'])$(id).addEventListener('change',renderPlaceNews);
$('wpPlaceFly').addEventListener('click',()=>{if(activePlace){flyToGeo(activePlace);closePlaceNews();}});
document.addEventListener('keydown',e=>{if(placeOverlay.hidden)return;if(e.key==='Escape'){e.stopPropagation();closePlaceNews();}else if(e.key==='Tab'){
 const focusables=[...placeOverlay.querySelectorAll('button:not([disabled]),select:not([disabled]),a[href]')];const first=focusables[0],last=focusables.at(-1);
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
}});
function showNews(p){
 if(!historicalObservation && p?.name){const entry=geoEntries.find(e=>e.name.toLocaleLowerCase()===String(p.name).toLocaleLowerCase());if(entry){openPlaceNews(entry);return;}}
 if(historicalObservation){$('newsDrawer').hidden=false;$('newsTitle').textContent=p.name||'Historical geographic subject';$('newsMeta').textContent='Archived sampled reporting · '+historicalObservation.at+' · no article links retained for these map points';$('newsStories').replaceChildren(document.createTextNode('Use Time Explorer to read the archived headline examples. These markers are geographic subjects, not verified event sites.'));return;}
 selectedNews=p;
 settings.rotate=false;$('rotationToggle').checked=false;
 $('newsDrawer').hidden=false;$('newsTitle').textContent=p.name||'Geographic news signals';
 const members=p.members||[p];const count=members.reduce((n,x)=>n+x.count,0);
 const approximate=members.some(x=>x.accuracy==='country');
 $('newsMeta').textContent=count.toLocaleString()+' sampled articles · '+members.length+' mapped signal(s) · '+NEWS_LABELS[p.category]+(approximate?' · Country-level locations are approximate':'');
 const stories=new Map();for(const m of members)for(const a of m.articles||[]){if(typeof a.url==='string'&&/^https?:\/\//i.test(a.url)&&!stories.has(a.url))stories.set(a.url,{...a,place:m.name});}
 const holder=$('newsStories');holder.replaceChildren();
 if(!stories.size){const msg=document.createElement('p');msg.textContent='No source links are included for this signal in the current snapshot.';holder.append(msg);return;}
 let ordered=[...stories.values()];
 if($('storySort').value==='publisher')ordered.sort((a,b)=>safeText(a.publisher).localeCompare(safeText(b.publisher)));
 else ordered.sort((a,b)=>{const t=x=>Date.parse(x.published_at||x.date||'')||0;return t(b)-t(a)});
 for(const a of ordered.slice(0,50)){
  const block=document.createElement('div');block.className='news-story';const link=document.createElement('a');link.href=a.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=a.title||'View source article';block.append(link);
  const meta=document.createElement('small');meta.textContent=[a.publisher,a.place,a.published_at?readableDate(a.published_at):null].filter(Boolean).join(' · ');block.append(meta);holder.append(block);
 }
 if(ordered.length>50){const note=document.createElement('p');note.textContent=`Showing the first 50 of ${ordered.length} linked articles in this selection.`;holder.append(note);}
}
makeFilterUI();news.onSelect=showNews;
function exploreStories(){
 const term=$('storySearch').value.trim().toLocaleLowerCase();const container=$('searchResults');container.replaceChildren();
 if(!term){container.hidden=true;$('searchSummary').textContent='Search stories included in the mapped news feed.';return;}
 if(!newsFeed){container.hidden=false;$('searchSummary').textContent='News feed unavailable; no stories to search.';return;}
 const matches=[];const seen=new Set();
 for(const p of newsFeed.points){if(!news.categories.has(p.category))continue;
  for(const a of p.articles||[]){if(typeof a.url!=='string'||!/^https?:\/\//i.test(a.url))continue;
   const hay=[a.title,a.publisher,p.name,NEWS_LABELS[p.category]].map(safeText).join(' ').toLocaleLowerCase();
   if(!hay.includes(term)||seen.has(a.url))continue;seen.add(a.url);matches.push({story:a,point:p});
  }
 }
 for(const a of browseExtras()){const hay=[a.title,a.publisher,NEWS_LABELS[a.category],'unlocated'].map(safeText).join(' ').toLocaleLowerCase();if(hay.includes(term)&&!seen.has(a.url)){seen.add(a.url);matches.push({story:a,point:null});}}
 matches.sort((a,b)=>(Date.parse(b.story.published_at||'')||0)-(Date.parse(a.story.published_at||'')||0));
 $('searchSummary').textContent=`${matches.length} matching linked ${matches.length===1?'article':'articles'} across mapped and browse-only feed`;
 container.hidden=false;
 if(!matches.length){const p=document.createElement('p');p.textContent='No matching linked stories. Try a broader term or enable more categories.';container.append(p);return;}
 for(const {story,point} of matches.slice(0,40)){
  const item=document.createElement('div');item.className='search-result';
  const title=document.createElement('strong');title.textContent=story.title||'Untitled article';
  const meta=document.createElement('small');meta.textContent=[point?.name||(story.browse_status==='archive'?'Archive · location unverified':'Location unverified'),story.publisher,NEWS_LABELS[point?.category||story.category]].filter(Boolean).join(' · ');
  const inspect=document.createElement('button');inspect.type='button';inspect.textContent='View location';if(point)inspect.addEventListener('click',()=>{showNews({...point,members:[point]});});else inspect.hidden=true;
  const link=document.createElement('a');link.href=story.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=' Open article ↗';link.style.cssText='color:#8be2da;font-size:11px;margin-left:8px';
  item.append(title,meta,inspect,link);container.append(item);
 }
 if(matches.length>40){const p=document.createElement('p');p.textContent='Showing the first 40 matches. Narrow your search for more specific results.';container.append(p);}
}
// Discovery is based on linked articles in the mapped snapshot. Neither article
// mentions nor volume are treated as social-media popularity or event importance.
let discoveryMode='top';
const linkedDiscovery=()=>{
 if(!newsFeed)return [];
 const seen=new Set(),out=[];
 for(const p of newsFeed.points){
  if(!news.categories.has(p.category))continue;
  for(const a of p.articles||[]){
   if(typeof a.url!=='string'||!/^https?:\/\//i.test(a.url)||seen.has(a.url))continue;
   seen.add(a.url);out.push({a,p,title:safeText(a.title)||'Untitled story',time:Date.parse(a.published_at||a.date||'')||0});
  }
 }
 for(const a of browseExtras()){if(seen.has(a.url))continue;seen.add(a.url);out.push({a,p:null,title:safeText(a.title)||'Untitled story',time:Date.parse(a.published_at||'')||0});}
 return out;
};
function renderDiscovery(){
 const list=$('discoverList');if(!list)return;list.replaceChildren();
 const cap=$('discoverCaption');const rows=linkedDiscovery();
 if(!newsFeed){cap.textContent='Waiting for news feed';return;}
 if(!rows.length){cap.textContent='No linked articles in currently selected categories';return;}
 // Group conservatively by normalised headline. Similar but differently
 // worded events remain separate; these are headline groups, not entity-level clustering.
 const norm=t=>t.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
 const groups=new Map();
 for(const row of rows){const key=norm(row.title);if(!key)continue;if(!groups.has(key))groups.set(key,{title:row.title,rows:[],publishers:new Set(),latest:0});const g=groups.get(key);g.rows.push(row);g.publishers.add(safeText(row.a.publisher)||'Unspecified publisher');g.latest=Math.max(g.latest,row.time);}
 const grouped=[...groups.values()];const byTime=(a,b)=>b.latest-a.latest;
 let items=[];
 if(discoveryMode==='latest'){
  items=rows.slice().sort((a,b)=>b.time-a.time).slice(0,16).map(row=>({title:row.title,row,info:[row.a.publisher,NEWS_LABELS[row.p?.category||row.a.category],row.p?.name,row.time?new Date(row.time).toLocaleString():null].filter(Boolean).join(' · ')}));
  cap.textContent='Latest linked articles, including unlocated stories · archive items clearly labelled';
 }else if(discoveryMode==='covered'||discoveryMode==='top'){
  grouped.sort((a,b)=>{
   if(discoveryMode==='covered')return b.publishers.size-a.publishers.size||b.rows.length-a.rows.length||byTime(a,b);
   // Coverage-first but recent; explicit proxy ranking, not importance judgement.
   const score=g=>g.publishers.size*2+Math.log1p(g.rows.length)+Math.max(0,1-(Date.now()-g.latest)/86400000)*2;
   return score(b)-score(a)||byTime(a,b);
  });
  items=grouped.slice(0,16).map(g=>({title:g.title,row:g.rows[0],info:`${g.rows.length} linked article${g.rows.length===1?'':'s'} · ${g.publishers.size} publisher${g.publishers.size===1?'':'s'} · ${g.rows[0].p?.name||'Location unverified'}`}));
  cap.textContent=discoveryMode==='covered'?'Most covered exact-headline groups · linked copies are not social engagement':'Top linked headlines · ranked by publisher count, copies and recency';
 }else{
  // Round-robin coverage by mapped location label so one news hub can't
  // dominate the entire discovery list. Labels are not guaranteed countries.
  const buckets=new Map();for(const row of rows.filter(r=>r.p).sort((a,b)=>b.time-a.time)){const key=norm(row.p?.name||'Unspecified location');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(row);}
  const locations=[...buckets.entries()].sort((a,b)=>(b[1][0]?.time||0)-(a[1][0]?.time||0));
  items=locations.slice(0,16).map(([name,rs])=>({title:rs[0].title,row:rs[0],info:`${rs[0].p?.name||'Mapped location'} · ${rs[0].a.publisher||'Publisher unspecified'} · ${NEWS_LABELS[rs[0].p.category]}`}));
  cap.textContent='Around the world · one recent story per distinct mapped location (not guaranteed country coverage)';
 }
 for(const item of items){const card=document.createElement('article');card.className='discover-card';
  const title=document.createElement('strong');title.textContent=item.title;
  const meta=document.createElement('small');meta.textContent=(item.row.a.browse_status==='archive'?'Archive (24–72h) · ':item.row.p?'':'Location unverified · ')+item.info;
  const actions=document.createElement('div');actions.className='discover-card-actions';
  if(item.row.p){const locate=document.createElement('button');locate.type='button';locate.textContent='View on globe';locate.addEventListener('click',()=>showNews({...item.row.p,members:[item.row.p]}));actions.append(locate);}else{const flag=document.createElement('span');flag.className='browse-unlocated';flag.textContent=item.row.a.browse_status==='archive'?'Archive · location unverified':'Location unverified';actions.append(flag);}
  const link=document.createElement('a');link.href=item.row.a.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Read source ↗';actions.append(link);
  card.append(title,meta,actions);list.append(card);
 }
 if(!items.length){const empty=document.createElement('p');empty.className='discover-empty';empty.textContent='No stories available for this view.';list.append(empty);}
}
document.querySelectorAll('[data-discover]').forEach(button=>button.addEventListener('click',()=>{
 discoveryMode=button.dataset.discover;document.querySelectorAll('[data-discover]').forEach(b=>b.classList.toggle('active',b===button));renderDiscovery();
}));
$('searchStories').addEventListener('click',exploreStories);
$('storySearch').addEventListener('keydown',e=>{if(e.key==='Enter')exploreStories();});
$('clearSearch').addEventListener('click',()=>{$('storySearch').value='';exploreStories();});
$('storySort').addEventListener('change',()=>{if(selectedNews)showNews(selectedNews);});
$('allCategories').addEventListener('click',()=>{for(const k of Object.keys(NEWS_COLORS))news.categories.add(k);makeFilterUI();news.rebuild(true);if($('storySearch').value)exploreStories();renderDiscovery();});
$('noCategories').addEventListener('click',()=>{news.categories.clear();makeFilterUI();news.rebuild(true);if($('storySearch').value)exploreStories();renderDiscovery();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('newsDrawer').hidden=true;});

const newsModeSelect=$('newsDisplayMode');
newsModeSelect.addEventListener('change',e=>{
 news.setMode(e.target.value);
 $('newsModeHint').textContent=({
  balanced:'Most locations separate · light grouping when far out',
  individual:'Every mapped location · overlapping points may remain',
  clustered:'Compact groups · clearer at global scale'
 })[news.mode];
});
news.setMode(newsModeSelect.value);

$('refreshNews').addEventListener('click',updateNews);
$('closeNews').addEventListener('click',()=>{$('newsDrawer').hidden=true;});
renderer.domElement.addEventListener('pointerdown',e=>{newsPointerDown={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('pointerup',e=>{
 if(newsPointerDown&&Math.hypot(newsPointerDown.x-e.clientX,newsPointerDown.y-e.clientY)<6){
  const link=crossBorder.pick(e,camera,renderer.domElement.getBoundingClientRect());
  if(link){settings.rotate=false;$('rotationToggle').checked=false;showCrossBorderDetails(link);}
  else news.pick(e.clientX,e.clientY);
 }
 newsPointerDown=null;
});
// v2.0F.4.2 — safe responsive globe view.
// The previous setViewOffset projection moved the Earth out of the canvas on
// some displays. Never use a projection offset for the default camera.
// Fit against the actual globe stage, not the browser window.
let fittedDistance=3.55;
function fitGlobeView(resetZoom=true){
 const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
 camera.clearViewOffset();
 camera.aspect=w/h;
 // Keep the Earth visible in both portrait and landscape viewport shapes.
 // The radius of the Earth is approximately 1 world unit; connections extend
 // further, so leave room beyond the solid sphere silhouette.
 const wide=w>=680;
 const targetDiameter=Math.max(120,Math.min(h*.70,w*(wide?.46:.78)));
 const halfFov=THREE.MathUtils.degToRad(camera.fov)*.5;
 const desiredRadiusPx=targetDiameter*.5;
 const radius=1.12;
 fittedDistance=Math.max(3.55,Math.min(6.2,Math.sqrt(radius*radius+Math.pow(radius*h/(2*desiredRadiusPx*Math.tan(halfFov)),2))));
 if(resetZoom){
  camera.position.set(0,0,fittedDistance);
  controls.target.set(0,0,0);
  controls.update();
 }
 camera.updateProjectionMatrix();
 renderer.setSize(w,h,true); // Match CSS canvas dimensions to its pixel-ratio-scaled drawing buffer.
}
let previousStageWidth=0,previousStageHeight=0;
function resize(){
 const w=Math.round(stage.clientWidth),h=Math.round(stage.clientHeight);
 if(w<2||h<2)return;
 if(w===previousStageWidth&&h===previousStageHeight)return;
 previousStageWidth=w;previousStageHeight=h;
 fitGlobeView(true);
}
new ResizeObserver(resize).observe(stage);
window.addEventListener('orientationchange',()=>requestAnimationFrame(resize));
resize();
function setError(e){console.error('WorldPulse 2.0B:',e);error.hidden=false;error.textContent='The globe could not finish loading: '+e.message+'. Check network access to the Three.js CDN, and make sure all folders were uploaded.';status.textContent='LOAD ERROR';}
async function load(){try{status.innerHTML='<span class="status-led"></span> LOADING GEOGRAPHY';const response=await fetch('./data/world-borders.geojson');if(!response.ok)throw new Error('Geographic data HTTP '+response.status);const data=await response.json();features=data.features.filter(f=>f.geometry);layers.borders=borderLayer(features);globe.add(layers.borders);$('countryCount').textContent=features.length.toLocaleString();await changePopulation();await changeRoutes();await updateNews();status.innerHTML='<span class="status-led"></span> RENDERER READY';}catch(e){setError(e)}}
async function changePopulation(){if(!features.length)return;const quality=settings.quality==='auto'?(window.innerWidth<700||navigator.hardwareConcurrency<=4?'low':'high'):settings.quality;const next=await populationLayer(features,quality);if(layers.population){globe.remove(layers.population);layers.population.geometry.dispose();layers.population.material.dispose();}layers.population=next.object;globe.add(layers.population);pop=next;pop.material.uniforms.uFlicker.value=settings.flicker?1:0;$('pointCount').textContent=next.count.toLocaleString();$('populationHint').textContent=next.measured?'Measured density · zoom-adaptive':'Land-point preview — not population data';$('datasetNote').textContent=next.measured?('Population raster loaded: '+(next.metadata?.source||'measured relative-density image')+'. '+next.detailCount.toLocaleString()+' additional settlement lights are revealed progressively as you zoom in. Small local sampling reduces false spread in sparsely settled areas. Visualised density is relative, not people-per-dot. '+(next.warning||'')):'Land-only preview: geographic points do not represent population. Upload assets/population-density.png alongside the metadata JSON to enable measured settlement illumination.';}
async function changeRoutes(){
 try{
  const routes=await loadConnections();
  for(const key of ['air','sea']){
   const previous=layers[key];globe.remove(previous);
   layers[key]=routes[key];globe.add(routes[key]);
   layers[key].visible=$(key+'Toggle').checked;
  }
  $('airCount').textContent=layers.air.userData.count.toLocaleString();
  $('seaCount').textContent=layers.sea.userData.count.toLocaleString();
 }catch(e){console.warn('WorldPulse connections:',e);$('airHint').textContent='Route dataset unavailable';$('seaHint').textContent='Route dataset unavailable';}
}
function bindToggle(id,callback){$(id).addEventListener('change',e=>callback(e.target.checked));}bindToggle('newsToggle',v=>{news.setVisible(v);if(historicalObservation)layers.news.visible=false;historicalDots.visible=v;});bindToggle('airToggle',v=>layers.air.visible=v);bindToggle('seaToggle',v=>layers.sea.visible=v);bindToggle('routesMotionToggle',v=>{settings.routesMotion=v;if(v&&settings.reduce){settings.reduce=false;$('motionToggle').checked=false;}});bindToggle('populationToggle',v=>{if(layers.population)layers.population.visible=v;});bindToggle('bordersToggle',v=>layers.borders&&(layers.borders.visible=v));bindToggle('meshToggle',v=>layers.mesh.visible=v);bindToggle('rotationToggle',v=>{settings.rotate=v;if(v&&settings.reduce){settings.reduce=false;$('motionToggle').checked=false;}});bindToggle('flickerToggle',v=>{settings.flicker=v;if(pop)pop.material.uniforms.uFlicker.value=v?1:0;if(v&&settings.reduce){settings.reduce=false;$('motionToggle').checked=false;}});bindToggle('motionToggle',v=>{settings.reduce=v;if(v){settings.rotate=false;settings.flicker=false;settings.routesMotion=false;$('routesMotionToggle').checked=false;if(pop)pop.material.uniforms.uFlicker.value=0;$('rotationToggle').checked=false;$('flickerToggle').checked=false;}});$('quality').addEventListener('change',async e=>{settings.quality=e.target.value;status.innerHTML='<span class="status-led"></span> REBUILDING DOTS';await changePopulation();await changeRoutes();await updateNews();status.innerHTML='<span class="status-led"></span> RENDERER READY';});$('rotationToggle').checked=settings.rotate;$('flickerToggle').checked=settings.flicker;$('motionToggle').checked=settings.reduce;$('routesMotionToggle').checked=settings.routesMotion;
$('homeBtn').addEventListener('click',()=>{geoFlight=null;controls.reset();fitGlobeView(true);});
function tick(now){requestAnimationFrame(tick);const dt=Math.min(.05,(now-last)/1000);last=now;controls.autoRotate=settings.rotate&&!settings.reduce&&document.visibilityState==='visible';controls.update();advanceGeoFlight(now);news.update();if(pop){pop.material.uniforms.uCameraDistance.value=camera.position.length();if(document.visibilityState==='visible'&&!settings.reduce)pop.material.uniforms.uTime.value+=dt;}for(const key of ['air','sea']){const m=layers[key]?.userData?.lines?.material;if(m){m.uniforms.uMotion.value=settings.routesMotion&&!settings.reduce?1:0;if(document.visibilityState==='visible'&&!settings.reduce&&settings.routesMotion)m.uniforms.uTime.value+=dt;}}renderer.render(scene,camera);frame++;}requestAnimationFrame(tick);load();
function clock(){const d=new Date();$('utc').textContent='UTC '+d.toISOString().slice(11,16);}clock();setInterval(clock,30000);
// News is read from the original WorldPulse publisher feed; no synthetic headlines.
setInterval(()=>{if(document.visibilityState==='visible')updateNews()},15*60*1000);