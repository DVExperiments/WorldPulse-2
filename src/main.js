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
  view.addEventListener('click',()=>{flyToGeo(e);showNews({...e.points[0],name:e.name,members:e.points});geoResults.style.display='none';geoInput.setAttribute('aria-expanded','false');});
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
  const d=await fetchNews();newsFeed=d;buildGeoEntries();if(!historicalObservation)news.setPoints(d.points);newsLastUpdated=Date.now();
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
function showNews(p){
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