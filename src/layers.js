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
if(Math.abs(a[0]-b[0])>180)continue;const d=Math.hypot(a[0]-b[0],a[1]-b[1]);const splits=Math.max(1,Math.ceil(d/1.2));for(let k=0;k<splits;k++){const t=k/splits,u=(k+1)/splits;positions.push(...llToXYZ(a[1]+(b[1]-a[1])*t,a[0]+(b[0]-a[0])*t,1.011));positions.push(...llToXYZ(a[1]+(b[1]-a[1])*u,a[0]+(b[0]-a[0])*u,1.011));}}}}}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const glow=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x0be1dd,transparent:true,opacity:.25,depthWrite:false}));glow.scale.setScalar(1.003);const lines=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x64fff1,transparent:true,opacity:.85,depthWrite:false}));group.add(glow,lines);return group;}
export async function populationLayer(features,quality='auto',pngURL='./assets/population-density.png'){
const boxes=featureBBoxes(features),size=quality==='low'?2.9:quality==='high'?1.35:1.9;const pos=[],strength=[],seed=[];let pix=null,pw=0,ph=0,real=false;
try{const image=new Image();image.src=pngURL;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);pix=context.getImageData(0,0,canvas.width,canvas.height).data;pw=canvas.width;ph=canvas.height;real=true;}catch{/* Optional: valid land-only fallback */}
for(let lat=-77;lat<=82;lat+=size){const step=size/Math.max(.34,Math.cos(lat*Math.PI/180));for(let lon=-180;lon<180;lon+=step){if(!landAt(lon,lat,boxes))continue;const seedValue=hash(lat*9.61+lon*3.79);const jlat=lat+(seedValue-.5)*Math.min(.27,size*.16),jlon=lon+(hash(lon*6.13+lat)-.5)*Math.min(.27,size*.16);let weight=.3+.3*seedValue;if(pix){const x=Math.max(0,Math.min(pw-1,Math.floor((lon+180)/360*pw)));const y=Math.max(0,Math.min(ph-1,Math.floor((90-lat)/180*ph)));weight=pix[(y*pw+x)*4]/255;weight=Math.max(.065,Math.pow(weight,.68));}pos.push(...llToXYZ(jlat,jlon,1.018));strength.push(weight);seed.push(hash(lon*23.91+lat*9.15)*100);}}
const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geom.setAttribute('aStrength',new THREE.Float32BufferAttribute(strength,1));geom.setAttribute('aSeed',new THREE.Float32BufferAttribute(seed,1));const uniforms={uTime:{value:0},uFlicker:{value:1},uSize:{value:quality==='low'?2.2:2.6}};
const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,vertexShader:`attribute float aStrength; attribute float aSeed; varying float vBrightness; varying float vSeed; uniform float uSize; void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(uSize* (4.8 / max(1.,-mv.z)),1.0,4.0);vBrightness=aStrength;vSeed=aSeed;}`,fragmentShader:`uniform float uTime;uniform float uFlicker;varying float vBrightness; varying float vSeed;float rnd(float v){return fract(sin(v*12.9898)*43758.5453);}void main(){vec2 uv=gl_PointCoord-.5;float soft=1.-smoothstep(.22,.67,length(uv));float t=uTime*(.24+rnd(vSeed)*.2)+vSeed;float cell=floor(t),blend=fract(t);blend=blend*blend*(3.-2.*blend);float noise=mix(rnd(cell+vSeed),rnd(cell+1.+vSeed),blend);float light=mix(.82,.50+.7*noise,uFlicker);vec3 c=vec3(.21,.98,.89);gl_FragColor=vec4(c,soft*(.29+.71*vBrightness)*light);}`});const points=new THREE.Points(geom,material);points.frustumCulled=false;return {object:points,material,count:pos.length/3,measured:real};}
export function emptyRouteLayers(){return {news:new THREE.Group(),air:new THREE.Group(),sea:new THREE.Group()};}
