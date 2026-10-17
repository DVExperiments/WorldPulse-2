import * as THREE from 'three';
import {llToXYZ,featureBBoxes,landAt,hash} from './geo.js';
// Open globe: only lines and points are visible. No physical surface or atmosphere.
// A colorless depth-only sphere occludes far-side geography, maintaining legibility.
export function earthLayer(){
 const group=new THREE.Group();
 const mask=new THREE.Mesh(new THREE.SphereGeometry(1.001,80,56),new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:true,depthTest:true,side:THREE.FrontSide}));
 mask.renderOrder=-20;
 group.add(mask);
 return group;
}
// Clean open globe: sparse meridians and parallels only.
// World-space lines remain independently toggleable; there are no diagonals.
export function meshLayer(){
 const group=new THREE.Group(),positions=[];
 const R=1.008;
 const line=(a,b)=>positions.push(...llToXYZ(a[0],a[1],R),...llToXYZ(b[0],b[1],R));
 // Wide spacing lets the geography and population data take visual priority.
 // Small segments approximate smooth arcs on the sphere.
 for(let lon=-180;lon<180;lon+=20){
  for(let lat=-80;lat<80;lat+=2){line([lat,lon],[lat+2,lon]);}
 }
 for(let lat=-80;lat<=80;lat+=20){
  for(let lon=-180;lon<180;lon+=2){line([lat,lon],[lat,lon+2]);}
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 const material=new THREE.LineBasicMaterial({
  color:0x1b97a2,transparent:true,opacity:.14,depthTest:true,depthWrite:false
 });
 const mesh=new THREE.LineSegments(geometry,material);
 mesh.frustumCulled=false;
 group.add(mesh);
 return group;
}
export function borderLayer(features){const group=new THREE.Group(),positions=[];for(const f of features){const geom=f.geometry;const polys=geom.type==='Polygon'?[geom.coordinates]:geom.type==='MultiPolygon'?geom.coordinates:[];for(const rings of polys){for(const ring of rings){for(let j=1;j<ring.length;j++){const a=ring[j-1],b=ring[j]; // Skip dateline jumps to prevent lines crossing the sphere.
if(Math.abs(a[0]-b[0])>180)continue;const d=Math.hypot(a[0]-b[0],a[1]-b[1]);const splits=Math.max(1,Math.ceil(d/1.2));for(let k=0;k<splits;k++){const t=k/splits,u=(k+1)/splits;positions.push(...llToXYZ(a[1]+(b[1]-a[1])*t,a[0]+(b[0]-a[0])*t,1.011));positions.push(...llToXYZ(a[1]+(b[1]-a[1])*u,a[0]+(b[0]-a[0])*u,1.011));}}}}}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const lines=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x69fff1,transparent:true,opacity:.84,depthWrite:false}));group.add(lines);return group;}
export async function populationLayer(features,quality='auto',pngURL='./assets/population-density.png'){
 const boxes=featureBBoxes(features),cell=quality==='low'?2.05:quality==='high'?1.05:1.45;
 const pos=[],strength=[],seed=[],weightSize=[];let pix=null,pw=0,ph=0,real=false;
 try{
  const image=new Image();image.src=pngURL;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
  pix=context.getImageData(0,0,canvas.width,canvas.height).data;pw=canvas.width;ph=canvas.height;real=true;
 }catch(e){console.info('WorldPulse: measured population raster not present; land preview only.');}
 const wrapLon=lon=>((((lon+180)%360)+360)%360)-180;
 const sample=(lat,lon)=>{
  if(!pix)return 0;
  const wlon=wrapLon(lon);
  const x=Math.max(0,Math.min(pw-1,Math.floor((wlon+180)/360*pw)));
  const y=Math.max(0,Math.min(ph-1,Math.floor((90-lat)/180*ph)));
  return pix[(y*pw+x)*4]/255;
 };
 const spreadSample=(lat,lon)=>{
  const cosLat=Math.max(.3,Math.cos(lat*Math.PI/180));
  let sum=0,total=0;
  const tap=(dLat,dLon,w)=>{sum+=sample(lat+dLat,lon+dLon)*w;total+=w;};
  tap(0,0,.36);
  const ring1=[[ .6,0],[ -.6,0],[0,.6/cosLat],[0,-.6/cosLat],[ .42,.42/cosLat],[ .42,-.42/cosLat],[-.42,.42/cosLat],[-.42,-.42/cosLat]];
  for(const [a,b] of ring1)tap(a,b,.055);
  const ring2=[[ 1.4,0],[-1.4,0],[0,1.4/cosLat],[0,-1.4/cosLat],[ 1.0,1.0/cosLat],[ 1.0,-1.0/cosLat],[-1.0,1.0/cosLat],[-1.0,-1.0/cosLat]];
  for(const [a,b] of ring2)tap(a,b,.025);
  const ring3=[[ 2.5,0],[-2.5,0],[0,2.5/cosLat],[0,-2.5/cosLat],[ 1.8,1.8/cosLat],[ 1.8,-1.8/cosLat],[-1.8,1.8/cosLat],[-1.8,-1.8/cosLat]];
  for(const [a,b] of ring3)tap(a,b,.01);
  return total?sum/total:0;
 };
 const add=(lat,lon,weight,salt)=>{
  pos.push(...llToXYZ(lat,lon,1.018));strength.push(weight);
  seed.push(hash(lat*23.91+lon*9.15+salt)*100);
  weightSize.push(.66+1.06*Math.pow(weight,.58));
 };
 // Geographic grid is the candidate sampling lattice. When the measured raster
 // is present, a spread-aware field makes dense settlements influence nearby
 // points too, so urban regions read as broader luminous networks.
 for(let lat=-77;lat<=82;lat+=cell){
  const step=cell/Math.max(.34,Math.cos(lat*Math.PI/180));
  for(let lon=-180;lon<180;lon+=step){
   if(!landAt(lon,lat,boxes))continue;
   const jitter=hash(lat*9.61+lon*3.79);
   const jlat=lat+(jitter-.5)*cell*.58;
   const jlon=lon+(hash(lon*6.13+lat)-.5)*step*.58;
   if(!landAt(jlon,jlat,boxes))continue;
   if(!real){
    add(jlat,jlon,.34+.13*jitter,1);continue;
   }
   const local=sample(jlat,jlon);
   const spread=spreadSample(jlat,jlon);
   const field=Math.min(1,Math.max(local*.52+spread*.92, spread*.82));
   // Increase visible spread in and around populated regions while keeping
   // rural interiors and deserts comparatively quiet.
   const keep=Math.min(0.995,.01+.985*Math.pow(field,.88));
   if(hash(lat*41.13+lon*13.73)>keep)continue;
   const weight=Math.min(1,.04+.3*Math.pow(local,.72)+.78*Math.pow(field,.8));
   add(jlat,jlon,weight,1);
   // Additional companion lights widen the visual field around dense settlements
   // instead of only stacking a few dots on the exact same spot.
   const extras=field>.18?(field>.76?5:field>.58?4:field>.4?3:field>.26?2:1):0;
   for(let k=0;k<extras;k++){
    const h=hash(lat*31.17+lon*9.11+k*19.7);
    const survive=Math.pow(field,.74)*(.94-k*.1);
    if(h>survive)continue;
    const angle=6.283*hash(lat*5.23+lon*3.19+k*9.21);
    const spreadBias=.85+1.15*Math.pow(field,.7);
    const dist=(.22+.52*hash(lat*13.1+lon*17.3+k))*cell*spreadBias;
    const eLat=jlat+Math.sin(angle)*dist;
    const eLon=jlon+Math.cos(angle)*dist/Math.max(.35,Math.cos(jlat*Math.PI/180));
    if(!landAt(eLon,eLat,boxes))continue;
    const extraLocal=sample(eLat,eLon);
    const extraSpread=spreadSample(eLat,eLon);
    const extraField=Math.min(1,Math.max(extraLocal*.5+extraSpread*.95, extraSpread*.84));
    const eWeight=Math.min(1,weight*(.56+.28*h)+extraField*.26);
    add(eLat,eLon,eWeight,k+2);
   }
  }
 }
 const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 geom.setAttribute('aStrength',new THREE.Float32BufferAttribute(strength,1));
 geom.setAttribute('aSeed',new THREE.Float32BufferAttribute(seed,1));
 geom.setAttribute('aDotScale',new THREE.Float32BufferAttribute(weightSize,1));
 const uniforms={uTime:{value:0},uFlicker:{value:1},uSize:{value:quality==='low'?2.15:2.45}};
 const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,vertexShader:`
 attribute float aStrength;attribute float aSeed;attribute float aDotScale;
 varying float vBrightness;varying float vSeed;uniform float uSize;
 void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;
 gl_PointSize=clamp(uSize*2.05*aDotScale/max(1.15,-mv.z),1.0,3.6);
 vBrightness=aStrength;vSeed=aSeed;
 }`,fragmentShader:`
 uniform float uTime;uniform float uFlicker;
 varying float vBrightness;varying float vSeed;
 float rnd(float v){return fract(sin(v*12.9898)*43758.5453);}
 void main(){
 float r=length(gl_PointCoord-.5);float disc=1.-smoothstep(.29,.51,r);
 float chosen=step(.75,rnd(vSeed*2.91+3.4));
 float period=mix(3.2,7.4,rnd(vSeed*5.7+1.9));
 float phase=uTime/period+rnd(vSeed*7.43);
 float cycle=floor(phase);float f=fract(phase);
 float happens=step(.32,rnd(cycle*17.83+vSeed*11.37));
 float start=mix(.14,.54,rnd(cycle*3.17+vSeed*1.33));
 float dur=mix(.16,.29,rnd(cycle*7.13+vSeed*4.61));
 float rise=smoothstep(start,start+.055,f);
 float fall=1.-smoothstep(start+.055,start+dur,f);
 float glint=chosen*happens*rise*fall;
 float base=(.22+.76*pow(vBrightness,.63));
 float opacity=disc*clamp(base*(.5+uFlicker*.98*glint),0.,.98);
 gl_FragColor=vec4(.24,.99,.91,opacity);
 }`});
 const points=new THREE.Points(geom,material);points.frustumCulled=false;
 return {object:points,material,count:pos.length/3,measured:real};
}

export function emptyRouteLayers(){return {news:new THREE.Group(),air:new THREE.Group(),sea:new THREE.Group()};}
