import * as THREE from 'three';
import {llToXYZ} from './geo.js';

// Broad illustrative circulation paths, not live or measured velocities.
// The short strokes below sit directly on the sphere (r=1.013), unlike route
// arches, and are grouped into narrow offshore bands for a flow-field effect.
const PATHS = [
 {name:'North Atlantic gyre',pts:[[13,-55],[21,-67],[29,-75],[36,-66],[41,-48],[45,-31],[39,-18],[30,-20],[21,-34],[13,-55]]},
 {name:'North Atlantic drift',pts:[[35,-70],[41,-55],[47,-39],[54,-24],[59,-15]]},
 {name:'Labrador',pts:[[62,-54],[55,-50],[48,-48],[43,-51]]},
 {name:'South Atlantic gyre',pts:[[-10,-27],[-20,-35],[-30,-39],[-38,-30],[-34,-13],[-24,1],[-14,-2],[-10,-27]]},
 {name:'North Pacific gyre',pts:[[20,125],[27,133],[37,145],[41,164],[41,-174],[39,-155],[34,-139],[27,-130],[20,-149],[17,172],[20,125]]},
 {name:'Kuroshio',pts:[[19,126],[28,132],[36,142],[40,159],[41,177]]},
 {name:'South Pacific gyre',pts:[[-12,-88],[-20,-96],[-30,-117],[-35,-142],[-32,-165],[-25,175],[-18,169],[-13,-169],[-12,-126],[-12,-88]]},
 {name:'Humboldt',pts:[[-41,-79],[-31,-77],[-21,-75],[-11,-79],[-5,-86]]},
 {name:'East Australia',pts:[[-16,155],[-24,158],[-32,160],[-39,162]]},
 {name:'Indian Ocean gyre',pts:[[-13,59],[-21,65],[-30,78],[-34,94],[-29,105],[-20,110],[-13,91],[-13,59]]},
 {name:'Agulhas',pts:[[-22,38],[-29,36],[-36,30],[-40,28]]},
 {name:'Pacific equatorial',pts:[[2,152],[2,174],[1,-165],[0,-142],[-1,-118]]},
 {name:'Atlantic equatorial',pts:[[4,-48],[3,-33],[3,-19],[2,-11]]},
 {name:'Indian equatorial',pts:[[0,49],[0,64],[-1,79],[-1,93]]},
 {name:'Southern Ocean',pts:[[-55,-177],[-55,-149],[-56,-123],[-55,-94],[-55,-70],[-54,-47],[-55,-19],[-54,11],[-54,42],[-55,72],[-54,101],[-55,132],[-54,158],[-55,179]]}
];
const RAD=Math.PI/180;
const radius=1.013;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function cart([lat,lon]){return new THREE.Vector3(...llToXYZ(lat,lon,1)).normalize();}
function slerp(a,b,t){
 const angle=a.angleTo(b);
 if(angle<1e-7)return a.clone();
 const s=Math.sin(angle);
 return a.clone().multiplyScalar(Math.sin((1-t)*angle)/s).addScaledVector(b,Math.sin(t*angle)/s).normalize();
}
// Consistent surface interpolation, including dates crossing the date line.
export function interpolateArc(a,b,t){return slerp(cart(a),cart(b),t);}
const FRACT=x=>x-Math.floor(x);
function hash(x){return FRACT(Math.sin(x*127.1+47.7)*43758.5453);}

export function createOceanCurrents(){
 const group=new THREE.Group();
 group.name='WorldPulse illustrative surface ocean flow';
 const pos=[],phase=[],tone=[],weight=[];
 let strokes=0;
 for(let k=0;k<PATHS.length;k++){
  const path=PATHS[k];
  const points=[];
  for(let s=1;s<path.pts.length;s++){
   const a=cart(path.pts[s-1]),b=cart(path.pts[s]);
   const arc=a.angleTo(b);
   const steps=Math.max(2,Math.ceil(arc/RAD/.62));
   for(let i=0;i<steps;i++)points.push(slerp(a,b,i/steps));
  }
  points.push(cart(path.pts[path.pts.length-1]));
  // Multiple narrow nearby lanes create a surface flow band, not giant arcs.
  // Side offsets are spherical tangent offsets, not displaced globe radii.
  const lanes=k===14?5:4;
  const total=points.length;
  for(let lane=0;lane<lanes;lane++){
   const lateral=(lane-(lanes-1)/2)*(.0053+(k===14?.0011:.0018));
   const offset=hash(k*19.9+lane*4.2);
   for(let i=0;i<total-1;i++){
    // Only short separated strokes. Roughly 45% of each lane is dark gap.
    if(((i+Math.floor(offset*7))%5)>2)continue;
    const a=points[i],b=points[i+1];
    const tangent=b.clone().sub(a).normalize();
    const side=new THREE.Vector3().crossVectors(a,tangent).normalize();
    const jitter=(hash(i*2.17+lane*19.1+k*3.9)-.5)*.0014;
    const lateralJ=lateral+jitter;
    const va=a.clone().addScaledVector(side,lateralJ).normalize().multiplyScalar(radius);
    const vb=b.clone().addScaledVector(side,lateralJ).normalize().multiplyScalar(radius);
    pos.push(...va.toArray(),...vb.toArray());
    const p=(i/total+lane*.21+k*.07);
    phase.push(p,p);
    const shade=hash(k*17.1+lane*6.3+i*.31);
    tone.push(shade,shade);
    const w=(lane===0||lane===lanes-1?.6:1.0)*(k===14?.65:1);
    weight.push(w,w);
    strokes++;
   }
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 geometry.setAttribute('aPhase',new THREE.Float32BufferAttribute(phase,1));
 geometry.setAttribute('aTone',new THREE.Float32BufferAttribute(tone,1));
 geometry.setAttribute('aWeight',new THREE.Float32BufferAttribute(weight,1));
 const uniforms={uTime:{value:0},uMotion:{value:1},uIntensity:{value:0.66}};
 const material=new THREE.ShaderMaterial({
  uniforms,transparent:true,depthTest:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`
   attribute float aPhase; attribute float aTone; attribute float aWeight;
   varying float vPhase; varying float vTone; varying float vWeight;
   void main(){
    vPhase=aPhase;vTone=aTone;vWeight=aWeight;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
   }`,
  fragmentShader:`
   precision mediump float;
   uniform float uTime;uniform float uMotion;uniform float uIntensity;
   varying float vPhase;varying float vTone;varying float vWeight;
   void main(){
    // A low-frequency travelling brightness wave, no flashing or hard pulses.
    float traveling=.5+.5*cos(6.2831853*(vPhase*7.0-uTime*.08));
    float brightness=mix(.74,.53+.47*traveling,uMotion);
    float alpha=uIntensity*vWeight*(.16+.12*vTone)*brightness;
    gl_FragColor=vec4(.20,.79,.83,alpha);
   }`
 });
 const flow=new THREE.LineSegments(geometry,material);
 flow.frustumCulled=false;
 group.add(flow);
 group.userData={material,streamCount:PATHS.length,strokeCount:strokes,representation:'illustrative surface flow bands'};
 return group;
}
