import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {earthLayer,meshLayer,borderLayer,populationLayer,emptyRouteLayers} from './layers.js';
import {loadConnections} from './routes.js';
import {NewsLayer,fetchNews,NEWS_COLORS,NEWS_LABELS} from './news.js';
const $=id=>document.getElementById(id);const stage=$('globe'),status=$('status'),error=$('error');const prefersReduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const settings={rotate:!prefersReduced.matches,reduce:prefersReduced.matches,flicker:!prefersReduced.matches,quality:'auto',routesMotion:!prefersReduced.matches};
const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(40,1,.1,70);camera.position.set(0,0,3.55);const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;stage.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=1.68;controls.maxDistance=6.4;controls.enablePan=false;controls.autoRotate=settings.rotate;controls.autoRotateSpeed=.38;controls.enableZoom=true;const globe=new THREE.Group();scene.add(globe);const sun=new THREE.DirectionalLight(0x89f3ea,1.2);sun.position.set(4,3,5);scene.add(sun);scene.add(new THREE.AmbientLight(0x2e6272,.6));
const layers={earth:earthLayer(),mesh:meshLayer(),borders:null,population:null,...emptyRouteLayers()};globe.add(layers.earth,layers.mesh,layers.news,layers.air,layers.sea);
let pop=null,features=[],frame=0,last=performance.now();
const news=new NewsLayer(layers.news,camera,renderer.domElement);
let newsFeed=null,newsLastUpdated=0,newsPointerDown=null,selectedNews=null;
const safeText=v=>typeof v==='string'?v:'';
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
  const d=await fetchNews();newsFeed=d;news.setPoints(d.points);newsLastUpdated=Date.now();
  $('newsHint').textContent=d.points.length.toLocaleString()+' geographic signals · '+(d.meta.status||'snapshot');
  $('newsStats').textContent=d.points.reduce((n,p)=>n+p.count,0).toLocaleString()+' mapped sampled articles · Updated '+readableDate(d.meta.updated_at)+(d.meta.status==='partial'?' · partial feeds':'')+(d.meta.status==='stale'?' · feed reported stale':'');
  if($('storySearch').value.trim())exploreStories();
  renderDiscovery();
  console.info('WorldPulse news ready',d.points.length,'mapped geographic signals, source:',d.source);
 }catch(e){
  console.warn('WorldPulse news:',e);$('newsHint').textContent='News feed unavailable';
  $('newsStats').textContent='No news snapshot could be loaded. The globe, population and route layers remain available. Check the original WorldPulse news feed or upload a local data/news.json snapshot.';
 }
}
function showNews(p){
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
 matches.sort((a,b)=>(Date.parse(b.story.published_at||'')||0)-(Date.parse(a.story.published_at||'')||0));
 $('searchSummary').textContent=`${matches.length} matching linked ${matches.length===1?'article':'articles'} in mapped feed`;
 container.hidden=false;
 if(!matches.length){const p=document.createElement('p');p.textContent='No matching linked stories. Try a broader term or enable more categories.';container.append(p);return;}
 for(const {story,point} of matches.slice(0,40)){
  const item=document.createElement('div');item.className='search-result';
  const title=document.createElement('strong');title.textContent=story.title||'Untitled article';
  const meta=document.createElement('small');meta.textContent=[point.name,story.publisher,NEWS_LABELS[point.category]].filter(Boolean).join(' · ');
  const inspect=document.createElement('button');inspect.type='button';inspect.textContent='View location';inspect.addEventListener('click',()=>{showNews({...point,members:[point]});});
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
  items=rows.slice().sort((a,b)=>b.time-a.time).slice(0,16).map(row=>({title:row.title,row,info:[row.a.publisher,NEWS_LABELS[row.p.category],row.p.name,row.time?new Date(row.time).toLocaleString():null].filter(Boolean).join(' · ')}));
  cap.textContent='Latest available linked articles · sorted by publisher timestamps';
 }else if(discoveryMode==='covered'||discoveryMode==='top'){
  grouped.sort((a,b)=>{
   if(discoveryMode==='covered')return b.publishers.size-a.publishers.size||b.rows.length-a.rows.length||byTime(a,b);
   // Coverage-first but recent; explicit proxy ranking, not importance judgement.
   const score=g=>g.publishers.size*2+Math.log1p(g.rows.length)+Math.max(0,1-(Date.now()-g.latest)/86400000)*2;
   return score(b)-score(a)||byTime(a,b);
  });
  items=grouped.slice(0,16).map(g=>({title:g.title,row:g.rows[0],info:`${g.rows.length} linked article${g.rows.length===1?'':'s'} · ${g.publishers.size} publisher${g.publishers.size===1?'':'s'} · ${g.rows[0].p.name||'Mapped location'}`}));
  cap.textContent=discoveryMode==='covered'?'Most covered exact-headline groups · counts are limited by the mapped feed':'Top linked headlines · ranked by publisher count, linked copies and recency';
 }else{
  // Round-robin coverage by mapped location label so one news hub can't
  // dominate the entire discovery list. Labels are not guaranteed countries.
  const buckets=new Map();for(const row of rows.sort((a,b)=>b.time-a.time)){const key=norm(row.p.name||'Unspecified location');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(row);}
  const locations=[...buckets.entries()].sort((a,b)=>(b[1][0]?.time||0)-(a[1][0]?.time||0));
  items=locations.slice(0,16).map(([name,rs])=>({title:rs[0].title,row:rs[0],info:`${rs[0].p.name||'Mapped location'} · ${rs[0].a.publisher||'Publisher unspecified'} · ${NEWS_LABELS[rs[0].p.category]}`}));
  cap.textContent='Around the world · one recent story per distinct mapped location (not guaranteed country coverage)';
 }
 for(const item of items){const card=document.createElement('article');card.className='discover-card';
  const title=document.createElement('strong');title.textContent=item.title;
  const meta=document.createElement('small');meta.textContent=item.info;
  const actions=document.createElement('div');actions.className='discover-card-actions';
  const locate=document.createElement('button');locate.type='button';locate.textContent='View on globe';locate.addEventListener('click',()=>showNews({...item.row.p,members:[item.row.p]}));
  actions.append(locate);
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
renderer.domElement.addEventListener('pointerup',e=>{if(newsPointerDown&&Math.hypot(newsPointerDown.x-e.clientX,newsPointerDown.y-e.clientY)<6)news.pick(e.clientX,e.clientY);newsPointerDown=null;});
function resize(){const w=stage.clientWidth,h=stage.clientHeight;camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();renderer.setSize(w,h,false);}new ResizeObserver(resize).observe(stage);resize();
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
function bindToggle(id,callback){$(id).addEventListener('change',e=>callback(e.target.checked));}bindToggle('newsToggle',v=>news.setVisible(v));bindToggle('airToggle',v=>layers.air.visible=v);bindToggle('seaToggle',v=>layers.sea.visible=v);bindToggle('routesMotionToggle',v=>{settings.routesMotion=v;if(v&&settings.reduce){settings.reduce=false;$('motionToggle').checked=false;}});bindToggle('populationToggle',v=>{if(layers.population)layers.population.visible=v;});bindToggle('bordersToggle',v=>layers.borders&&(layers.borders.visible=v));bindToggle('meshToggle',v=>layers.mesh.visible=v);bindToggle('rotationToggle',v=>{settings.rotate=v;if(v&&settings.reduce){settings.reduce=false;$('motionToggle').checked=false;}});bindToggle('flickerToggle',v=>{settings.flicker=v;if(pop)pop.material.uniforms.uFlicker.value=v?1:0;if(v&&settings.reduce){settings.reduce=false;$('motionToggle').checked=false;}});bindToggle('motionToggle',v=>{settings.reduce=v;if(v){settings.rotate=false;settings.flicker=false;settings.routesMotion=false;$('routesMotionToggle').checked=false;if(pop)pop.material.uniforms.uFlicker.value=0;$('rotationToggle').checked=false;$('flickerToggle').checked=false;}});$('quality').addEventListener('change',async e=>{settings.quality=e.target.value;status.innerHTML='<span class="status-led"></span> REBUILDING DOTS';await changePopulation();await changeRoutes();await updateNews();status.innerHTML='<span class="status-led"></span> RENDERER READY';});$('rotationToggle').checked=settings.rotate;$('flickerToggle').checked=settings.flicker;$('motionToggle').checked=settings.reduce;$('routesMotionToggle').checked=settings.routesMotion;
$('homeBtn').addEventListener('click',()=>{controls.reset();camera.position.set(0,0,3.55);controls.target.set(0,0,0);controls.update();});
function tick(now){requestAnimationFrame(tick);const dt=Math.min(.05,(now-last)/1000);last=now;controls.autoRotate=settings.rotate&&!settings.reduce&&document.visibilityState==='visible';controls.update();news.update();if(pop){pop.material.uniforms.uCameraDistance.value=camera.position.length();if(document.visibilityState==='visible'&&!settings.reduce)pop.material.uniforms.uTime.value+=dt;}for(const key of ['air','sea']){const m=layers[key]?.userData?.lines?.material;if(m){m.uniforms.uMotion.value=settings.routesMotion&&!settings.reduce?1:0;if(document.visibilityState==='visible'&&!settings.reduce&&settings.routesMotion)m.uniforms.uTime.value+=dt;}}renderer.render(scene,camera);frame++;}requestAnimationFrame(tick);load();
function clock(){const d=new Date();$('utc').textContent='UTC '+d.toISOString().slice(11,16);}clock();setInterval(clock,30000);
// News is read from the original WorldPulse publisher feed; no synthetic headlines.
setInterval(()=>{if(document.visibilityState==='visible')updateNews()},15*60*1000);
