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
function markerTexture(){
 const c=document.createElement('canvas');c.width=c.height=64;
 const x=c.getContext('2d');const g=x.createRadialGradient(32,32,3,32,32,31);
 g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.19,'rgba(255,255,255,.96)');g.addColorStop(.34,'rgba(255,255,255,.38)');g.addColorStop(1,'rgba(255,255,255,0)');
 x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);
}
export class NewsLayer{
 constructor(group,camera,dom){this.group=group;this.camera=camera;this.dom=dom;this.points=[];this.active=[];this.selected=null;this.enabled=true;this.categories=new Set(Object.keys(NEWS_COLORS));this.mode='balanced';this.lastTier=-1;this.texture=markerTexture();this.raycaster=new THREE.Raycaster();this.raycaster.params.Points.threshold=.017;this.mouse=new THREE.Vector2();this.geometry=null;this.markers=null;this.onSelect=null;this.onHover=null;this.hoveredIndex=-1;this._hoverMove=e=>this.hoverAt(e.clientX,e.clientY);this._hoverLeave=()=>this.clearHover();this.dom.addEventListener('pointermove',this._hoverMove,{passive:true});this.dom.addEventListener('pointerleave',this._hoverLeave);}
 setPoints(points){this.points=points;this.rebuild(true);}
 setCategory(k,on){if(on)this.categories.add(k);else this.categories.delete(k);this.rebuild(true);}
 setVisible(show){this.enabled=show;this.group.visible=show;if(!show)this.clearHover();}
 setMode(mode){if(!['balanced','individual','clustered'].includes(mode))return;this.mode=mode;this.lastTier=-1;this.rebuild(true);}
 tier(){
  const d=this.camera.position.length();
  if(this.mode==='individual')return 0;
  if(this.mode==='clustered')return d>3.4?8:d>2.5?4.5:d>1.95?2:0;
  // Balanced clusters only at distant overview; show mapped signals individually at usual zoom.
  return d>4.25?3.0:d>3.15?1.35:0;
 }
 update(){const tier=this.tier();if(tier!==this.lastTier)this.rebuild();}
 rebuild(force=false){
  const tier=this.tier();if(!force&&tier===this.lastTier)return;this.lastTier=tier;
  const included=this.points.filter(p=>this.categories.has(p.category));this.active=cluster(included,tier);
  if(this.markers){this.group.remove(this.markers);this.geometry.dispose();this.markers.material.dispose();this.markers=null;}
  if(!this.active.length)return;
  this.hoveredIndex=-1;
  const positions=[],colors=[],sizes=[],indices=[];
  for(const p of this.active){
   positions.push(...llToXYZ(p.lat,p.lng,1.027));
   const col=new THREE.Color(NEWS_COLORS[p.category]);colors.push(col.r,col.g,col.b);
   // Readable, intentionally bounded tiers based on sampled article counts.
   // The count measures RSS coverage, NOT severity, importance or event volume.
   const sampled=Math.max(1,Number.isFinite(p.count)?p.count:1);
   const tierSize=sampled<=2?0.43:sampled<=7?0.68:0.94;
   const clusterCue=p.members?.length>1?0.035:0;
   sizes.push(tierSize+clusterCue);
   indices.push(sizes.length-1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('aSize',new THREE.Float32BufferAttribute(sizes,1));g.setAttribute('aIndex',new THREE.Float32BufferAttribute(indices,1));
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,vertexColors:true,uniforms:{uSprite:{value:this.texture},uViewport:{value:Math.min(2,window.devicePixelRatio||1)},uHover:{value:-1}},vertexShader:`attribute float aSize;attribute float aIndex;varying vec3 vCol;varying float vHover;uniform float uViewport;uniform float uHover;void main(){vCol=color;vHover=1.0-step(0.5,abs(aIndex-uHover));vec4 v=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp((aSize+vHover*0.25)*21.0*uViewport/max(1.0,-v.z),2.2,15.5);}`,fragmentShader:`uniform sampler2D uSprite;varying vec3 vCol;varying float vHover;void main(){float a=texture2D(uSprite,gl_PointCoord).r;gl_FragColor=vec4(mix(vCol,vec3(1.0),vHover*0.32),a*(0.90+vHover*0.10));}`});
  const points=new THREE.Points(g,m);points.frustumCulled=false;this.group.add(points);this.markers=points;this.geometry=g;
 }
 // Hover changes only the shader highlight; no geometry rebuild or camera movement.
 hoverAt(clientX,clientY){
  if(!this.enabled||!this.markers){this.clearHover();return;}
  const rect=this.dom.getBoundingClientRect();if(!rect.width||!rect.height)return;
  this.mouse.set((clientX-rect.left)/rect.width*2-1,-((clientY-rect.top)/rect.height*2-1));
  this.raycaster.setFromCamera(this.mouse,this.camera);
  const hits=this.raycaster.intersectObject(this.markers);
  let next=-1;
  if(hits.length){const i=hits[0].index;const attr=this.markers.geometry.attributes.position;
   const world=new THREE.Vector3(attr.getX(i),attr.getY(i),attr.getZ(i));this.markers.localToWorld(world);
   if(world.dot(this.camera.position)>=.95)next=i;
  }
  if(this.hoveredIndex!==next){this.hoveredIndex=next;this.markers.material.uniforms.uHover.value=next;this.onHover?.(next>=0?this.active[next]:null,clientX,clientY);}
 }
 clearHover(){const had=this.hoveredIndex>=0;this.hoveredIndex=-1;if(this.markers)this.markers.material.uniforms.uHover.value=-1;if(had)this.onHover?.(null);}
 hitAt(clientX,clientY){
  if(!this.enabled||!this.markers)return null;
  const rect=this.dom.getBoundingClientRect();this.mouse.set((clientX-rect.left)/rect.width*2-1,-((clientY-rect.top)/rect.height*2-1));
  this.raycaster.setFromCamera(this.mouse,this.camera);
  const hits=this.raycaster.intersectObject(this.markers);
  if(!hits.length)return null;
  const p=this.active[hits[0].index];if(!p)return null;
  // Only points on the front-facing hemisphere should be selectable.
  const vec=this.markers.geometry.attributes.position;const i=hits[0].index;
  const world=new THREE.Vector3(vec.getX(i),vec.getY(i),vec.getZ(i));this.group.localToWorld(world);
  if(world.dot(this.camera.position)<.95)return null;
  return p;
 }
 pick(clientX,clientY){const p=this.hitAt(clientX,clientY);if(!p)return false;this.onSelect?.(p);return true;}
}
