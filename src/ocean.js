import * as THREE from 'three';
import {llToXYZ,featureBBoxes,landAt} from './geo.js';

// WorldPulse v2.4C.4 — refined illustrated ocean FLOW FIELD, not live velocity data.
// Streamlets use a local tangent field on the unit sphere. They are not
// geographically connecting arcs or routes. Coastline mask reuses existing
// WorldPulse world-borders data. No raster/service/API dependencies.
const RAD=Math.PI/180;
const RADIUS=1.014;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const fract=x=>x-Math.floor(x);
const hash=x=>fract(Math.sin(x*127.1+38.17)*43758.5453123);
const wrapLon=x=>((x+180)%360+360)%360-180;
function position(lat,lon){return new THREE.Vector3(...llToXYZ(lat,lon,RADIUS));}
function vector(lat,lon){
 // Neighbouring gyres: broad basin circulation rather than isolated routes.
 // Contributions fade outside a gyre's ocean basin.
 const gyres=[
  [32,-45,34,39,-1],[-26,-16,30,28,1],
  [33,-160,53,35,-1],[-26,-124,46,28,1],
  [-24,79,35,30,1]
 ];
 let east=0,north=0;
 for(const [cy,cx,rx,ry,spin] of gyres){
  const dx=wrapLon(lon-cx)*Math.cos(cy*RAD)/rx,dy=(lat-cy)/ry;
  const r2=dx*dx+dy*dy;
  const fall=Math.exp(-2.5*r2);
  east+=(-dy)*spin*fall*1.7;
  north+=dx*spin*fall*1.7;
 }
 // Equatorial trade-driven flow and southern circumpolar band.
 const equator=Math.exp(-Math.pow(lat/11,2));
 east-=.74*equator;
 east+=.88*Math.exp(-Math.pow((lat+52)/9,2));
 north+=.11*Math.sin(lon*RAD*3)*Math.exp(-Math.pow(lat/26,2));
 // Subtle coherent local curvature; not random independent arrows.
 // Smaller, coherent sub-basin eddies softly bend surrounding flow.
 // These are schematic circulation details, not observed currents.
 const eddies=[[20,-137,12,1],[-33,-93,12,-1],[39,-54,9,-1],[-39,9,11,1],[12,96,11,-1]];
 for(const [ey,ex,scale,spin] of eddies){
  const dx=wrapLon(lon-ex)*Math.cos(ey*RAD)/scale;
  const dy=(lat-ey)/scale;
  const fall=Math.exp(-2.6*(dx*dx+dy*dy));
  east+=-dy*spin*fall*.34;
  north+=dx*spin*fall*.34;
 }
 const ripple=.12*Math.sin(lon*RAD*3.2+lat*RAD*3.7);
 east+=ripple*Math.cos(lat*RAD*2);
 north+=ripple*Math.sin(lon*RAD*1.4);
 const magnitude=Math.hypot(east,north);
 return magnitude>.09?{east:east/magnitude,north:north/magnitude,magnitude}:null;
}
function advect(lat,lon,distance,dir=1){
 const v=vector(lat,lon);
 if(!v)return null;
 const nextLat=clamp(lat+v.north*distance*dir,-74,76);
 const nextLon=wrapLon(lon+v.east*distance*dir/Math.max(.24,Math.cos(lat*RAD)));
 return {lat:nextLat,lon:nextLon};
}
function oceanMask(features){
 const boxes=featureBBoxes(features);
 // Cache an approximate coastline check. An extra point-in-polygon test
 // is made at each accepted stroke waypoint; never draw straight through land.
 const cache=new Map();
 return (lat,lon)=>{
  if(Math.abs(lat)>75)return false;
  const x=wrapLon(lon),key=`${Math.round(lat*2)}:${Math.round(x*2)}`;
  let hit=cache.get(key);
  if(hit===undefined){hit=!landAt(x,lat,boxes);cache.set(key,hit);}
  return hit;
 };
}
function makeMaterial(uniforms,points=false){
 return new THREE.ShaderMaterial({
  uniforms,transparent:true,depthTest:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:points?`
   attribute vec3 aTangent; attribute float aPhase; attribute float aSpeed; attribute float aTone;
   varying float vPhase; varying float vTone; uniform float uTime; uniform float uMotion;
   void main(){
    // A short looping travel along the local ocean surface tangent.
    // No paths are stretched between distant cities or islands.
    float travel=fract(aPhase+uTime*aSpeed*uMotion)*.024;
    vec3 sphere=normalize(position+aTangent*(travel-.012))*1.015;
    vec4 mv=modelViewMatrix*vec4(sphere,1.0);
    gl_Position=projectionMatrix*mv;
    gl_PointSize=clamp(2.6/max(.7,-mv.z)*2.5,1.2,3.9);
    vPhase=aPhase; vTone=aTone;
   }`:`
   attribute float aTone; attribute float aPhase;
   varying float vTone; varying float vPhase;
   void main(){
    vTone=aTone; vPhase=aPhase;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
   }`,
  fragmentShader:points?`
   uniform float uIntensity; varying float vPhase; varying float vTone;
   void main(){
    float d=length(gl_PointCoord-.5);
    float a=1.-smoothstep(.12,.5,d);
    gl_FragColor=vec4(.27,.88,.87,a*uIntensity*(.24+.34*vTone));
   }`:`
   uniform float uIntensity; uniform float uTime; uniform float uMotion;
   varying float vTone; varying float vPhase;
   void main(){
    float breathe=.84+.16*sin(uTime*uMotion*.75+vPhase*6.28318);
    // A deliberately quiet hierarchy keeps news markers the visual priority.
    float alpha=uIntensity*(.10+.24*vTone)*breathe;
    vec3 tint=mix(vec3(.10,.54,.65),vec3(.23,.80,.78),vTone);
    gl_FragColor=vec4(tint,alpha);
   }`
 });
}
function populate(group,features,uniforms){
 const isOcean=oceanMask(features);
 const linePositions=[],lineTones=[],linePhases=[];
 const particlePositions=[],particleTangents=[],particlePhases=[],particleSpeeds=[],particleTones=[];
 let lines=0,particles=0;
 // Distribution is approximately uniform in surface area, stable across loads.
 // 2,700 tries yield a widely populated (but not opaque) ocean texture.
 for(let i=0;i<2740;i++){
  const lat=Math.asin(hash(i*5.13+6.1)*1.94-.97)/RAD;
  const lon=-180+360*hash(i*9.71+11.3);
  if(!isOcean(lat,lon))continue;
  const v=vector(lat,lon);if(!v)continue;
  // Nearby strokes align loosely into ribbons, with gaps and variable lengths.
  // No lines exceed a few geographic degrees or connect distant places.
  const ribbon=(hash(Math.floor(i/7)*6.77+4.9)-.5);
  const side=(hash(i*1.87+8.5)-.5)*.85+ribbon*.42;
  const length=1.25+hash(i*7.3+2)*1.52;
  const centerLat=lat+side*v.east;
  const centerLon=lon-side*v.north/Math.max(.27,Math.cos(lat*RAD));
  if(!isOcean(centerLat,centerLon))continue;
  // Give coastlines, coastal news markers and route crossings some breathing room.
  // Coarse ocean-side clearance is visual only; no news data is filtered.
  const cos=Math.max(.35,Math.cos(centerLat*RAD));
  if(hash(i*19.47+4.1)<.58 && (
    !isOcean(centerLat+1.4,centerLon)||!isOcean(centerLat-1.4,centerLon)||
    !isOcean(centerLat,centerLon+1.4/cos)||!isOcean(centerLat,centerLon-1.4/cos)
  ))continue;
  // 2-3 curved segments, total span typically 1-2 degrees; no long arcs.
  const steps=hash(i*2.07+9)>.42?4:3;
  let current=advect(centerLat,centerLon,length*.5,-1);
  if(!current||!isOcean(current.lat,current.lon))continue;
  const pts=[current];let valid=true;
  for(let j=0;j<steps;j++){
   current=advect(current.lat,current.lon,length/steps);
   if(!current||!isOcean(current.lat,current.lon)){valid=false;break;}
   pts.push(current);
  }
  if(!valid)continue;
  const phase=hash(i*14.1+7);
  const tierRoll=hash(i*11.23+17.4);
  // Mostly background flow; a small fraction carries brighter direction cues.
  const tone=tierRoll<.65?.18+.24*hash(i*3.14+1):
    tierRoll<.93?.45+.23*hash(i*3.14+1):.72+.2*hash(i*3.14+1);
  for(let j=0;j<pts.length-1;j++){
   linePositions.push(...position(pts[j].lat,pts[j].lon).toArray(),...position(pts[j+1].lat,pts[j+1].lon).toArray());
   lineTones.push(tone,tone);
   linePhases.push(phase,phase);
   lines++;
  }
  if(hash(i*13.19+5)<.59){
   const midpoint=pts[Math.floor(pts.length/2)];
   const p=position(midpoint.lat,midpoint.lon);
   // Two unit-sphere nearby positions form a tangent basis in 3D.
   const toward=advect(midpoint.lat,midpoint.lon,.08);
   if(!toward)continue;
   const tangent=position(toward.lat,toward.lon).sub(p).normalize();
   particlePositions.push(...p.toArray());particleTangents.push(...tangent.toArray());
   particlePhases.push(phase);particleSpeeds.push(.11+.1*hash(i*3.31));particleTones.push(tone);
   particles++;
  }
 }
 const strokesGeo=new THREE.BufferGeometry();
 strokesGeo.setAttribute('position',new THREE.Float32BufferAttribute(linePositions,3));
 strokesGeo.setAttribute('aTone',new THREE.Float32BufferAttribute(lineTones,1));
 strokesGeo.setAttribute('aPhase',new THREE.Float32BufferAttribute(linePhases,1));
 const strokes=new THREE.LineSegments(strokesGeo,makeMaterial(uniforms));
 strokes.frustumCulled=false;strokes.renderOrder=1;group.add(strokes);
 const particleGeo=new THREE.BufferGeometry();
 particleGeo.setAttribute('position',new THREE.Float32BufferAttribute(particlePositions,3));
 particleGeo.setAttribute('aTangent',new THREE.Float32BufferAttribute(particleTangents,3));
 particleGeo.setAttribute('aPhase',new THREE.Float32BufferAttribute(particlePhases,1));
 particleGeo.setAttribute('aSpeed',new THREE.Float32BufferAttribute(particleSpeeds,1));
 particleGeo.setAttribute('aTone',new THREE.Float32BufferAttribute(particleTones,1));
 const dots=new THREE.Points(particleGeo,makeMaterial(uniforms,true));
 dots.frustumCulled=false;dots.renderOrder=2;group.add(dots);
 group.userData.strokeCount=lines;group.userData.particleCount=particles;
}
export function createOceanCurrents(){
 const group=new THREE.Group();group.name='WorldPulse illustrative ocean flow field';
 const uniforms={uTime:{value:0},uMotion:{value:1},uIntensity:{value:.68}};
 // main.js reads this interface once every frame. Preserve it unchanged.
 group.userData={material:{uniforms},representation:'illustrative ocean surface flow field',status:'loading'};
 fetch('./data/world-borders.geojson').then(r=>{if(!r.ok)throw Error(`Geography ${r.status}`);return r.json();})
  .then(data=>{populate(group,(data.features||[]).filter(f=>f?.geometry),uniforms);group.userData.status='ready';})
  .catch(e=>{group.userData.status='unavailable';console.warn('WorldPulse ocean flow needs world geography:',e);});
 return group;
}
