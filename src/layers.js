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
 const boxes=featureBBoxes(features),cell=quality==='low'?2.15:quality==='high'?1.15:1.6;
 const pos=[],strength=[],seed=[],weightSize=[];let pix=null,pw=0,ph=0,real=false;
 try{
  const image=new Image();image.src=pngURL;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
  pix=context.getImageData(0,0,canvas.width,canvas.height).data;pw=canvas.width;ph=canvas.height;real=true;
 }catch(e){console.info('WorldPulse: measured population raster not present; land preview only.');}
 const sample=(lat,lon)=>{
  if(!pix)return 0;
  const x=Math.max(0,Math.min(pw-1,Math.floor((lon+180)/360*pw)));
  const y=Math.max(0,Math.min(ph-1,Math.floor((90-lat)/180*ph)));
  return pix[(y*pw+x)*4]/255;
 };
 const add=(lat,lon,weight,salt)=>{
  pos.push(...llToXYZ(lat,lon,1.018));strength.push(weight);
  seed.push(hash(lat*23.91+lon*9.15+salt)*100);
  weightSize.push(.72+1.08*Math.pow(weight,.55));
 };
 // Geographic grid is just the *candidate* sample lattice. Actual density
 // controls point survival and multiple additional nearby light sites.
 for(let lat=-77;lat<=82;lat+=cell){
  const step=cell/Math.max(.34,Math.cos(lat*Math.PI/180));
  for(let lon=-180;lon<180;lon+=step){
   if(!landAt(lon,lat,boxes))continue;
   const jitter=hash(lat*9.61+lon*3.79);
   const jlat=lat+(jitter-.5)*cell*.55;
   const jlon=lon+(hash(lon*6.13+lat)-.5)*step*.55;
   if(!landAt(jlon,jlat,boxes))continue;
   if(!real){ // This is NOT measured population. Intentionally neutral land-preview grid.
    add(jlat,jlon,.35+.12*jitter,1);continue;
   }
   const d=sample(jlat,jlon);
   // Raster values are encoded relative intensities, not raw people/km2.
   // Strongly suppress unpopulated areas while retaining some quiet lights.
   const abundance=Math.pow(Math.max(0,d),.73);
   const keep=.018+.96*abundance;
   if(hash(lat*41.13+lon*13.73)>keep)continue;
   const weight=Math.min(1,.08+.92*Math.pow(d,.58));
   add(jlat,jlon,weight,1);
   // Additional sub-cell lights give high-value population concentrations
   // genuine visual density, instead of simply oversized dots.
   const extras=d>.22? (d>.73?3:d>.49?2:1):0;
   for(let k=0;k<extras;k++){
    const h=hash(lat*31.17+lon*9.11+k*19.7);
    const survive=Math.pow(d,.72)*(.82-k*.14);
    if(h>survive)continue;
    const angle=6.283*hash(lat*5.23+lon*3.19+k*9.21);
    const dist=(.19+.24*hash(lat*13.1+lon*17.3+k))*cell;
    const eLat=jlat+Math.sin(angle)*dist;
    const eLon=jlon+Math.cos(angle)*dist/Math.max(.35,Math.cos(lat*Math.PI/180));
    if(landAt(eLon,eLat,boxes))add(eLat,eLon,Math.min(1,weight*(.72+.28*h)),k+2);
   }
  }
 }
 const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 geom.setAttribute('aStrength',new THREE.Float32BufferAttribute(strength,1));
 geom.setAttribute('aSeed',new THREE.Float32BufferAttribute(seed,1));
 geom.setAttribute('aDotScale',new THREE.Float32BufferAttribute(weightSize,1));
 const uniforms={uTime:{value:0},uFlicker:{value:1},uSize:{value:quality==='low'?2.25:2.6}};
 const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,vertexShader:`
 attribute float aStrength;attribute float aSeed;attribute float aDotScale;
 varying float vBrightness;varying float vSeed;uniform float uSize;
 void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;
 gl_PointSize=clamp(uSize*2.15*aDotScale/max(1.15,-mv.z),1.0,3.7);
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
 float base=(.23+.73*pow(vBrightness,.66));
 float opacity=disc*clamp(base*(.53+uFlicker*1.02*glint),0.,.98);
 gl_FragColor=vec4(.24,.99,.91,opacity);
 }`});
 const points=new THREE.Points(geom,material);points.frustumCulled=false;
 return {object:points,material,count:pos.length/3,measured:real};
}
export function emptyRouteLayers(){return {news:new THREE.Group(),air:new THREE.Group(),sea:new THREE.Group()};}
