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
const boxes=featureBBoxes(features),size=quality==='low'?2.9:quality==='high'?1.35:1.9;const pos=[],strength=[],seed=[];let pix=null,pw=0,ph=0,real=false;
try{const image=new Image();image.src=pngURL;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);pix=context.getImageData(0,0,canvas.width,canvas.height).data;pw=canvas.width;ph=canvas.height;real=true;}catch{/* Optional: valid land-only fallback */}
for(let lat=-77;lat<=82;lat+=size){const step=size/Math.max(.34,Math.cos(lat*Math.PI/180));for(let lon=-180;lon<180;lon+=step){if(!landAt(lon,lat,boxes))continue;const seedValue=hash(lat*9.61+lon*3.79);const jlat=lat+(seedValue-.5)*Math.min(.27,size*.16),jlon=lon+(hash(lon*6.13+lat)-.5)*Math.min(.27,size*.16);let weight=.3+.3*seedValue;if(pix){const x=Math.max(0,Math.min(pw-1,Math.floor((lon+180)/360*pw)));const y=Math.max(0,Math.min(ph-1,Math.floor((90-lat)/180*ph)));weight=pix[(y*pw+x)*4]/255;weight=Math.max(.015,Math.pow(weight,1.12));}if(pix && hash(lon*41.13+lat*13.73) > (.22+.78*Math.pow(weight,.38)))continue;pos.push(...llToXYZ(jlat,jlon,1.018));strength.push(weight);seed.push(hash(lon*23.91+lat*9.15)*100);}}
const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geom.setAttribute('aStrength',new THREE.Float32BufferAttribute(strength,1));geom.setAttribute('aSeed',new THREE.Float32BufferAttribute(seed,1));const uniforms={uTime:{value:0},uFlicker:{value:1},uSize:{value:quality==='low'?2.2:2.6}};
const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,vertexShader:`
attribute float aStrength; attribute float aSeed;
varying float vBrightness; varying float vSeed;
uniform float uSize;
void main(){
 vec4 mv=modelViewMatrix*vec4(position,1.);
 gl_Position=projectionMatrix*mv;
 // Screen-space dots stay visible at the default view without ballooning close-up.
 gl_PointSize=clamp(uSize*2.15/max(1.15,-mv.z),1.15,3.25);
 vBrightness=aStrength;vSeed=aSeed;
}`,fragmentShader:`
uniform float uTime;uniform float uFlicker;
varying float vBrightness; varying float vSeed;
float rnd(float v){return fract(sin(v*12.9898)*43758.5453);}
void main(){
 float r=length(gl_PointCoord-.5);
 float disc=1.-smoothstep(.29,.51,r);
 // Soft, distinct points. Each point follows a different slowly-changing random sequence.
 float t=uTime*(.60+rnd(vSeed*1.17)*.64)+vSeed*3.71;
 float k=floor(t);float f=fract(t);float e=f*f*(3.-2.*f);
 float n=mix(rnd(k+vSeed*1.47),rnd(k+1.+vSeed*1.47),e);
 float slowT=t*.29;float sk=floor(slowT);float sf=fract(slowT);sf=sf*sf*(3.-2.*sf);
 float n2=mix(rnd(sk+vSeed*4.31),rnd(sk+1.+vSeed*4.31),sf);
 float variation=mix(.72, .23+1.78*(.7*n+.3*n2),uFlicker);
 float opacity=disc*clamp((.19+.81*pow(vBrightness,.70))*variation,0.,.93);
 gl_FragColor=vec4(.24,.99,.91,opacity);
}`});const points=new THREE.Points(geom,material);points.frustumCulled=false;return {object:points,material,count:pos.length/3,measured:real};}
export function emptyRouteLayers(){return {news:new THREE.Group(),air:new THREE.Group(),sea:new THREE.Group()};}
