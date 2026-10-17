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
// Population precision renderer. Raster is 0.25 degree / pixel (1440 x 720)
// and values already encode log1p(persons/km2) / log1p(10000).
// Never spread intensity across multi-degree distances for local geography.
export async function populationLayer(features,quality='auto',pngURL='./assets/population-density.png'){
 const boxes=featureBBoxes(features),high=quality!=='low';
 const coarse=high?1.0:1.7, fine=high?.26:.46;
 const pos=[],strength=[],seed=[],weightSize=[],detail=[];
 let pix=null,pw=0,ph=0,real=false,metadata=null,warning='';
 try{
  const [image,info]=await Promise.all([
   (async()=>{const image=new Image();image.src=pngURL;await image.decode();return image;})(),
   fetch('./assets/population-density-info.json').then(r=>r.ok?r.json():null).catch(()=>null)
  ]);
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  pix=ctx.getImageData(0,0,canvas.width,canvas.height).data;pw=canvas.width;ph=canvas.height;
  metadata=info;real=true;
  const reported=info?.resolution;
  if(reported&&(reported.width!==pw||reported.height!==ph))warning=`Raster dimensions ${pw}x${ph} differ from metadata ${reported.width}x${reported.height}.`;
  if(info?.brightness_transform&&!info.brightness_transform.includes('log1p'))warning='Unrecognised population raster transform; review metadata.';
 }catch(e){console.info('WorldPulse: no readable population raster, using land preview',e);}
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const get=(x,y)=>pix[((clamp(y,0,ph-1)*pw+((x%pw)+pw)%pw)*4)]/255;
 // Bilinear raster sampling, with longitude wrapping. Pixel centres map to
 // lon=-180..180, lat=+90..-90; avoid nearest-pixel aliasing.
 const sample=(lat,lon)=>{
  if(!pix)return 0;
  const xf=(lon+180)/360*pw-.5,yf=(90-lat)/180*ph-.5;
  const x=Math.floor(xf),y=Math.floor(yf),u=xf-x,v=yf-y;
  return ((1-u)*(1-v)*get(x,y)+u*(1-v)*get(x+1,y)+(1-u)*v*get(x,y+1)+u*v*get(x+1,y+1));
 };
 const density=(lat,lon)=>{
  // Local raster signal dominates. Four neighbouring samples provide only a
  // 0.3-degree (~25km NZ latitude) softly spread context, not a 2.5 degree blur.
  const d=sample(lat,lon);
  const c=Math.max(.3,Math.cos(lat*Math.PI/180));
  const n=(sample(lat+.30,lon)+sample(lat-.30,lon)+sample(lat,lon+.30/c)+sample(lat,lon-.30/c))*.25;
  return {local:d,field:clamp(.83*d+.17*n,0,1)};
 };
 const add=(lat,lon,weight,salt,isFine)=>{
  pos.push(...llToXYZ(lat,lon,1.018));
  strength.push(weight);seed.push(hash(lat*23.91+lon*9.15+salt)*100);
  weightSize.push(.72+1.05*Math.pow(weight,.65));detail.push(isFine?1:0);
 };
 for(let lat=-77;lat<=82;lat+=coarse){
  const step=coarse/Math.max(.34,Math.cos(lat*Math.PI/180));
  for(let lon=-180;lon<180;lon+=step){
   const coreLat=lat+(hash(lat*9.61+lon*3.79)-.5)*coarse*.45;
   const coreLon=lon+(hash(lon*6.13+lat)-.5)*step*.45;
   if(!landAt(coreLon,coreLat,boxes))continue;
   if(!real){add(coreLat,coreLon,.36,1,false);continue;}
   // Raster is log encoded. Thresholds are applied in encoded space.
   const {local,field}=density(coreLat,coreLon);
   const keep=clamp(.002+.87*Math.pow(field,1.3),0,.96);
   if(hash(lat*41.13+lon*13.73)<keep){
    const w=clamp(.13+.52*local+.38*field,0,1);
    add(coreLat,coreLon,w,1,false);
   }
   // At high zoom, reveal sub-degree population cells only near areas where
   // the raster shows actual settlement. Real image detail is 0.25 degrees;
   // finer sampling would invent precision, so do not go below that.
   if(field<.11)continue;
   const subCount=Math.min(4,Math.ceil(coarse/fine));
   const cellLat=coarse/subCount;
   const cellLon=step/subCount;
   for(let i=0;i<subCount;i++)for(let j=0;j<subCount;j++){
    const noise=hash(lat*17.23+lon*4.97+i*13.31+j*7.81);
    const la=lat+(i+.5+(noise-.5)*.36)*cellLat;
    const lo=lon+(j+.5+(hash(lat*7.9+lon+i*2.1+j*19.1)-.5)*.36)*cellLon;
    if(!landAt(lo,la,boxes))continue;
    const {local:dl,field:df}=density(la,lo);
    // Strictly sample each sub-cell to avoid phantom urban spread.
    const chance=clamp((df-.055)*1.7,0,.98);
    if(hash(la*41.13+lo*15.7)>chance)continue;
    add(la,lo,clamp(.07+.58*dl+.36*df,0,1),13+i*subCount+j,true);
   }
  }
 }
 const geom=new THREE.BufferGeometry();
 geom.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 geom.setAttribute('aStrength',new THREE.Float32BufferAttribute(strength,1));
 geom.setAttribute('aSeed',new THREE.Float32BufferAttribute(seed,1));
 geom.setAttribute('aDotScale',new THREE.Float32BufferAttribute(weightSize,1));
 geom.setAttribute('aDetail',new THREE.Float32BufferAttribute(detail,1));
 const uniforms={uTime:{value:0},uFlicker:{value:1},uSize:{value:high?2.55:2.2},uCameraDistance:{value:3.55}};
 const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,vertexShader:`
 attribute float aStrength;attribute float aSeed;attribute float aDotScale;attribute float aDetail;
 varying float vBrightness;varying float vSeed;varying float vDetail;uniform float uSize;
 void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;
 gl_PointSize=clamp(uSize*2.12*aDotScale/max(1.15,-mv.z),1.0,4.1);
 vBrightness=aStrength;vSeed=aSeed;vDetail=aDetail;
 }`,fragmentShader:`
 uniform float uTime;uniform float uFlicker;uniform float uCameraDistance;
 varying float vBrightness;varying float vSeed;varying float vDetail;
 float rnd(float v){return fract(sin(v*12.9898)*43758.5453);}
 void main(){
 float detailVisibility=mix(1.,1.-smoothstep(2.1,3.5,uCameraDistance),vDetail);
 if(detailVisibility<.012)discard;
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
 float opacity=disc*detailVisibility*clamp(base*(.5+uFlicker*.98*glint),0.,.98);
 gl_FragColor=vec4(.24,.99,.91,opacity);
 }`});
 const points=new THREE.Points(geom,material);points.frustumCulled=false;
 return {object:points,material,count:pos.length/3,measured:real,metadata,warning,detailCount:detail.filter(Boolean).length};
}

export function emptyRouteLayers(){return {news:new THREE.Group(),air:new THREE.Group(),sea:new THREE.Group()};}
