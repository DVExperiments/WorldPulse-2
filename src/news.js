import * as THREE from 'three';
import {llToXYZ} from './geo.js';

// This is the established category schema of the original WorldPulse feed.
export const NEWS_COLORS={politics:'#eeb67e',environment:'#6edcb3',hazards:'#ef797d',society:'#ae94f3',health:'#d3a1ff',education:'#a8a3ff',rights:'#ef9bd0',community:'#bb95dd',economy:'#72baf1',science:'#e4d475',conflict:'#ff5878'};
export const NEWS_LABELS={politics:'Politics',environment:'Environment',hazards:'Hazards',society:'Society',health:'Health',education:'Education',rights:'Rights',community:'Community',economy:'Economy',science:'Science',conflict:'Conflict'};
const NEWS_SOURCES=['https://dvexperiments.github.io/WorldPulse/data/news.json','./data/news.json'];
const valid=(p)=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180&&Number.isFinite(p.count)&&p.count>=0&&NEWS_COLORS[p.category];
export async function fetchNews(){
 let lastError;
 for(const url of NEWS_SOURCES){try{
  const response=await fetch(url+(url.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const json=await response.json();if(!Array.isArray(json.points))throw Error('Missing points array');
  const points=json.points.filter(valid);
  return {points,meta:json,source:url};
 }catch(e){lastError=e;console.warn('WorldPulse news source unavailable:',url,e);}}
 throw new Error('News feed unavailable: '+(lastError?.message||'unknown error'));
}
function cluster(points,cell){
 if(!cell)return points.map(p=>({...p,members:[p]}));
 const groups=new Map();
 for(const p of points){
  // Avoid false global cell-bridging and keep categories independently grouped.
  const key=p.category+'|'+Math.floor((p.lat+90)/cell)+'|'+Math.floor((p.lng+180)/cell);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);
 }
 return [...groups.values()].map(m=>{
  if(m.length===1)return {...m[0],members:m};
  const count=m.reduce((sum,p)=>sum+p.count,0),div=Math.max(1,count);
  const lat=m.reduce((sum,p)=>sum+p.lat*p.count,0)/div;
  const sin=m.reduce((sum,p)=>sum+Math.sin(p.lng*Math.PI/180)*p.count,0);
  const cos=m.reduce((sum,p)=>sum+Math.cos(p.lng*Math.PI/180)*p.count,0);
  const lead=m.reduce((a,b)=>b.count>a.count?b:a);
  return {lat,lng:Math.atan2(sin,cos)*180/Math.PI,count,category:lead.category,name:`${m.length} nearby ${NEWS_LABELS[lead.category]} signals`,members:m,accuracy:'cluster'};
 });
}
// Freshness is based on the newest valid, linked article timestamp in a geographic
// signal (or its nearby members). It does not measure severity or event urgency.
// Unknown/invalid/future timestamps never activate the cue.
export function recentReportingStrength(point,now=Date.now()){
 const members=Array.isArray(point?.members)&&point.members.length?point.members:[point];
 let latest=-Infinity;
 for(const member of members){
  const articles=Array.isArray(member?.articles)?member.articles:[];
  for(const article of articles){
   if(typeof article?.url!=='string'||!/^https:\/\//i.test(article.url))continue;
   const stamp=Date.parse(article.published_at||'');
   if(Number.isFinite(stamp)&&stamp<=now+5*60_000&&stamp>latest)latest=stamp;
  }
 }
 if(!Number.isFinite(latest))return 0;
 const age=Math.max(0,now-latest);
 // 0–3 h: faint, intermittent shimmer; 3–6 h: fading; >6 h: steady.
 return age>=6*3_600_000?0:age<=3*3_600_000?1: (6*3_600_000-age)/(3*3_600_000);
}
function markerTexture(){
 const c=document.createElement('canvas');c.width=c.height=64;
 const x=c.getContext('2d');const g=x.createRadialGradient(32,32,3,32,32,31);
 g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.19,'rgba(255,255,255,.96)');g.addColorStop(.34,'rgba(255,255,255,.38)');g.addColorStop(1,'rgba(255,255,255,0)');
 x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);
}
export class NewsLayer{
 constructor(group,camera,dom){this.group=group;this.camera=camera;this.dom=dom;this.points=[];this.active=[];this.selected=null;this.enabled=true;this.categories=new Set(Object.keys(NEWS_COLORS));this.mode='balanced';this.lastTier=-1;this.texture=markerTexture();this.raycaster=new THREE.Raycaster();this.raycaster.params.Points.threshold=.017;this.mouse=new THREE.Vector2();this.geometry=null;this.markers=null;this.onSelect=null;this.onHover=null;this.hoveredIndex=-1;this.screenPositions=[];this.lastDensityAt=0;this._densityCache='';this.motionAllowed=!(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);this._hoverMove=e=>this.hoverAt(e.clientX,e.clientY);this._hoverLeave=()=>this.clearHover();this.dom.addEventListener('pointermove',this._hoverMove,{passive:true});this.dom.addEventListener('pointerleave',this._hoverLeave);}
 setPoints(points){this.points=points;this.rebuild(true);}
 setCategory(k,on){if(on)this.categories.add(k);else this.categories.delete(k);this.rebuild(true);}
 setVisible(show){this.enabled=show;this.group.visible=show;if(!show)this.clearHover();}
 setMode(mode){if(!['balanced','individual','clustered'].includes(mode))return;this.mode=mode;this.lastTier=-1;this.rebuild(true);}
 tier(){
  const d=this.camera.position.length();
  if(this.mode==='individual')return 0;
  if(this.mode==='clustered')return d>3.4?8:d>2.5?4.5:d>1.95?2:0;
  // Default: keep the constellation of individual news signals at every zoom.
  // The explicit 'clustered' mode above remains available for users who choose it.
  return 0;
 }
 update(){
  const tier=this.tier();if(tier!==this.lastTier)this.rebuild();
  if(this.markers){
   this.updateDensity();
   const u=this.markers.material.uniforms;
   u.uTime.value=performance.now()*0.001;
   u.uMotion.value=this.motionAllowed&&document.visibilityState==='visible'?1:0;
  }
 }
 rebuild(force=false){
  const tier=this.tier();if(!force&&tier===this.lastTier)return;this.lastTier=tier;
  const included=this.points.filter(p=>this.categories.has(p.category));this.active=cluster(included,tier);
  if(this.markers){this.group.remove(this.markers);this.geometry.dispose();this.markers.material.dispose();this.markers=null;}
  if(!this.active.length)return;
  this.hoveredIndex=-1;this.screenPositions=[];this.lastDensityAt=0;
  const positions=[],colors=[],sizes=[],indices=[],freshness=[],offsets=[],dim=[];
  for(const p of this.active){
   positions.push(...llToXYZ(p.lat,p.lng,1.027));
   const col=new THREE.Color(NEWS_COLORS[p.category]);colors.push(col.r,col.g,col.b);
   // Readable, intentionally bounded tiers based on sampled article counts.
   // The count measures RSS coverage, NOT severity, importance or event volume.
   const sampled=Math.max(1,Number.isFinite(p.count)?p.count:1);
   const tierSize=sampled<=2?0.43:sampled<=7?0.68:0.94;
   const clusterCue=p.members?.length>1?0.035:0;
   sizes.push(tierSize+clusterCue);
   indices.push(sizes.length-1);freshness.push(recentReportingStrength(p));offsets.push(0,0);dim.push(0);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('aSize',new THREE.Float32BufferAttribute(sizes,1));g.setAttribute('aIndex',new THREE.Float32BufferAttribute(indices,1));g.setAttribute('aFresh',new THREE.Float32BufferAttribute(freshness,1));g.setAttribute('aOffset',new THREE.Float32BufferAttribute(offsets,2));g.setAttribute('aDim',new THREE.Float32BufferAttribute(dim,1));
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,vertexColors:true,uniforms:{uSprite:{value:this.texture},uViewport:{value:Math.min(2,window.devicePixelRatio||1)},uHover:{value:-1},uTime:{value:0},uMotion:{value:0},uResolution:{value:new THREE.Vector2(1,1)}},vertexShader:`attribute float aSize;attribute float aIndex;attribute float aFresh;attribute vec2 aOffset;attribute float aDim;varying vec3 vCol;varying float vHover;varying float vFresh;varying float vDim;uniform float uViewport;uniform float uHover;uniform float uTime;uniform float uMotion;uniform vec2 uResolution;void main(){vCol=color;vFresh=aFresh;vDim=aDim;vHover=1.0-step(0.5,abs(aIndex-uHover));float softPulse=0.5+0.5*sin(uTime*1.15+aIndex*2.39996);float shimmer=aFresh*uMotion*softPulse;vec4 v=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*v;gl_Position.xy+=2.0*aOffset/max(uResolution,vec2(1.0))*gl_Position.w;gl_PointSize=clamp((aSize+vHover*0.25+shimmer*0.075)*21.0*uViewport/max(1.0,-v.z),2.2,15.5);}`,fragmentShader:`uniform sampler2D uSprite;uniform float uTime;uniform float uMotion;varying vec3 vCol;varying float vHover;varying float vFresh;varying float vDim;void main(){float a=texture2D(uSprite,gl_PointCoord).r;float softPulse=0.5+0.5*sin(uTime*1.15+gl_FragCoord.x*0.011);float shimmer=vFresh*uMotion*softPulse;gl_FragColor=vec4(mix(vCol,vec3(1.0),vHover*0.32+shimmer*0.10)*(1.0-0.42*vDim),a*(0.90+vHover*0.10+shimmer*0.08)*(1.0-0.50*vDim));}`});
  const points=new THREE.Points(g,m);points.frustumCulled=false;this.group.add(points);this.markers=points;this.geometry=g;
 }
 // Screen-space overlap relief: display offsets, never changes actual latitude/longitude.
 // Bounded offsets preserve the visible constellation while easing selection in busy areas.
 updateDensity(force=false){
  if(!this.markers)return;
  const now=performance.now();if(!force&&now-this.lastDensityAt<140)return;
  this.lastDensityAt=now;
  const rect=this.dom.getBoundingClientRect();if(!rect.width||!rect.height)return;
  this.group.updateWorldMatrix(true,false);this.camera.updateMatrixWorld();
  const attr=this.geometry.getAttribute('position');const n=attr.count;
  const pts=[];const a=new THREE.Vector3(),w=new THREE.Vector3();
  for(let i=0;i<n;i++){
   a.fromBufferAttribute(attr,i);w.copy(a).applyMatrix4(this.group.matrixWorld);
   const front=w.dot(this.camera.position)>=.95;
   const projected=w.clone().project(this.camera);
   pts.push({x:(projected.x+1)*rect.width/2,y:(1-projected.y)*rect.height/2,dx:0,dy:0,visible:front&&projected.z<1&&projected.z>-1});
  }
  // Iterative bounded repulsion in CSS pixels. Dots remain tied visually to their anchor.
  const maxShift=10;const separation=11;
  for(let round=0;round<4;round++){
   for(let i=0;i<n;i++){const q=pts[i];if(!q.visible)continue;
    let fx=-q.dx*.14,fy=-q.dy*.14;
    for(let j=0;j<n;j++){if(i===j||!pts[j].visible)continue;
     const r=pts[j],vx=q.x+q.dx-r.x-r.dx,vy=q.y+q.dy-r.y-r.dy;
     if(Math.abs(vx)>separation||Math.abs(vy)>separation)continue;
     const len=Math.hypot(vx,vy),dist=Math.max(.01,len);
     if(len>=separation)continue;
     // Deterministic separation for coincident coordinates (not random each frame).
     const theta=(i*2.399963+j*.37);const ux=len>.2?vx/dist:Math.cos(theta),uy=len>.2?vy/dist:Math.sin(theta);
     const push=(separation-len)*.22;fx+=ux*push;fy+=uy*push;
    }
    q.dx+=fx;q.dy+=fy;
    const len=Math.hypot(q.dx,q.dy);if(len>maxShift){q.dx*=maxShift/len;q.dy*=maxShift/len;}
   }
  }
  const shift=this.geometry.getAttribute('aOffset');
  for(let i=0;i<n;i++){shift.setXY(i,pts[i].dx, -pts[i].dy);}
  shift.needsUpdate=true;this.screenPositions=pts;
  this.markers.material.uniforms.uResolution.value.set(rect.width,rect.height);
  if(this.hoveredIndex>=0)this.setHoverDimming(this.hoveredIndex);
 }
 // Screen-based hit testing agrees with displaced dots. No raycaster/coordinate drift.
 screenHit(clientX,clientY,touch=false){
  if(!this.enabled||!this.markers)return -1;
  this.updateDensity();const rect=this.dom.getBoundingClientRect();
  const x=clientX-rect.left,y=clientY-rect.top;
  let best=-1,bestSq=Infinity;
  for(let i=0;i<this.screenPositions.length;i++){
   const p=this.screenPositions[i];if(!p.visible)continue;
   const dx=x-p.x-p.dx,dy=y-p.y-p.dy,d2=dx*dx+dy*dy;
   // 10px click target (density separated dots receive a modest tap target).
   if(d2<=(touch?324:100)&&d2<bestSq){best=i;bestSq=d2;}
  }
  return best;
 }
 setHoverDimming(index){
  if(!this.geometry)return;
  const attr=this.geometry.getAttribute('aDim'),target=this.screenPositions[index];
  for(let i=0;i<attr.count;i++){
   const p=this.screenPositions[i];const near=target&&p&&i!==index&&p.visible&&Math.hypot(p.x+p.dx-target.x-target.dx,p.y+p.dy-target.y-target.dy)<23;
   attr.setX(i,near?1:0);
  }
  attr.needsUpdate=true;
 }
 hoverAt(clientX,clientY){
  const next=this.screenHit(clientX,clientY);
  if(this.hoveredIndex!==next){this.hoveredIndex=next;
   if(this.markers)this.markers.material.uniforms.uHover.value=next;
   this.setHoverDimming(next);
   this.onHover?.(next>=0?this.active[next]:null,clientX,clientY);
  }
 }
 clearHover(){const had=this.hoveredIndex>=0;this.hoveredIndex=-1;
  if(this.markers)this.markers.material.uniforms.uHover.value=-1;
  this.setHoverDimming(-1);if(had)this.onHover?.(null);
 }
 hitAt(clientX,clientY,touch=false){const index=this.screenHit(clientX,clientY,touch);return index>=0?this.active[index]:null;}
 pick(clientX,clientY){const p=this.hitAt(clientX,clientY);if(!p)return false;this.onSelect?.(p);return true;}
}
