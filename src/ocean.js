import * as THREE from 'three';
import {llToXYZ} from './geo.js';

// Simplified, illustrative pathways inspired by major climatological ocean
// circulation. These are NOT measured velocities, forecasts, or live currents.
// [latitude, longitude] waypoints are intentionally offshore where possible.
const PATHS = [
 {name:'North Atlantic subtropical circulation', pts:[[12,-58],[19,-68],[28,-76],[35,-70],[40,-56],[44,-40],[47,-25],[42,-13],[30,-17],[21,-32],[12,-58]]},
 {name:'North Atlantic drift',pts:[[35,-70],[40,-55],[45,-40],[51,-24],[56,-14],[62,-12]]},
 {name:'Labrador Current',pts:[[62,-56],[55,-53],[47,-49],[43,-51]]},
 {name:'South Atlantic subtropical circulation',pts:[[-8,-30],[-18,-36],[-29,-42],[-38,-33],[-37,-15],[-25,2],[-10,-2],[-8,-30]]},
 {name:'North Pacific subtropical circulation',pts:[[16,125],[23,129],[31,135],[37,145],[39,164],[40,-174],[38,-155],[34,-135],[27,-122],[22,-130],[18,-153],[16,170],[16,125]]},
 {name:'Kuroshio extension',pts:[[20,123],[28,128],[35,138],[39,150],[40,165],[41,-174]]},
 {name:'North Pacific Current',pts:[[39,158],[41,175],[41,-165],[39,-151],[35,-134]]},
 {name:'South Pacific subtropical circulation',pts:[[-12,-86],[-20,-95],[-30,-110],[-36,-132],[-36,-155],[-30,174],[-21,163],[-13,178],[-12,-155],[-12,-120],[-12,-86]]},
 {name:'Peru–Chile Current',pts:[[-41,-76],[-31,-75],[-22,-73],[-12,-78],[-5,-85]]},
 {name:'East Australian Current',pts:[[-17,153],[-25,156],[-33,157],[-40,160]]},
 {name:'Indian Ocean subtropical circulation',pts:[[-11,60],[-19,62],[-28,70],[-35,85],[-32,104],[-20,111],[-12,93],[-11,60]]},
 {name:'Agulhas Current',pts:[[-20,37],[-29,35],[-36,27],[-40,26],[-41,34]]},
 {name:'Equatorial Pacific circulation',pts:[[4,155],[4,175],[3,-164],[2,-142],[1,-121],[0,-104]]},
 {name:'Equatorial Atlantic circulation',pts:[[5,-45],[5,-33],[5,-20],[3,-10]]},
 {name:'Equatorial Indian Ocean circulation',pts:[[-2,48],[-2,62],[-1,78],[0,90]]},
 {name:'Southern Ocean circumpolar circulation',pts:[[-55,-177],[-55,-150],[-56,-120],[-55,-90],[-54,-67],[-54,-45],[-54,-18],[-54,10],[-53,40],[-54,70],[-53,100],[-54,130],[-55,158],[-55,179]]},
 {name:'Southern Ocean secondary circulation',pts:[[-60,-175],[-60,-145],[-61,-115],[-60,-85],[-60,-60],[-60,-35],[-59,-5],[-59,25],[-60,55],[-59,88],[-59,118],[-59,150],[-60,176]]}
];

// Great-circle interpolation stays on the globe's spherical surface and handles
// paths that cross the International Date Line without straight-through chords.
export function interpolateArc(a,b,t){
 const va=new THREE.Vector3(...llToXYZ(a[0],a[1],1)).normalize();
 const vb=new THREE.Vector3(...llToXYZ(b[0],b[1],1)).normalize();
 const angle=va.angleTo(vb);
 if(angle<1e-8)return va;
 const sin=Math.sin(angle);
 return va.multiplyScalar(Math.sin((1-t)*angle)/sin).addScaledVector(vb,Math.sin(t*angle)/sin).normalize();
}

export function createOceanCurrents(){
 const group=new THREE.Group();
 group.name='WorldPulse illustrative ocean circulation';
 const positions=[],progress=[],stream=[],opacity=[];
 const R=1.014;
 PATHS.forEach((path,pIndex)=>{
  const segments=[];
  for(let i=1;i<path.pts.length;i++){
   const a=path.pts[i-1],b=path.pts[i];
   const va=new THREE.Vector3(...llToXYZ(a[0],a[1],1));
   const vb=new THREE.Vector3(...llToXYZ(b[0],b[1],1));
   const steps=Math.max(3,Math.ceil(va.angleTo(vb)*180/Math.PI/1.55));
   for(let j=0;j<steps;j++)segments.push([interpolateArc(a,b,j/steps),interpolateArc(a,b,(j+1)/steps)]);
  }
  segments.forEach(([a,b],index)=>{
   positions.push(...a.multiplyScalar(R).toArray(),...b.multiplyScalar(R).toArray());
   const phase=index/Math.max(1,segments.length);
   progress.push(phase,(index+1)/Math.max(1,segments.length));
   stream.push(pIndex,pIndex);
   const base=pIndex>=15?.50:.72;
   opacity.push(base,base);
  });
 });
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('aProgress',new THREE.Float32BufferAttribute(progress,1));
 geometry.setAttribute('aStream',new THREE.Float32BufferAttribute(stream,1));
 geometry.setAttribute('aOpacity',new THREE.Float32BufferAttribute(opacity,1));
 const uniforms={uTime:{value:0},uMotion:{value:1},uIntensity:{value:0.42}};
 const material=new THREE.ShaderMaterial({
  transparent:true,depthTest:true,depthWrite:false,
  blending:THREE.AdditiveBlending,uniforms,
  vertexShader:`
   attribute float aProgress;attribute float aStream;attribute float aOpacity;
   varying float vProgress;varying float vStream;varying float vOpacity;
   void main(){
    vProgress=aProgress;vStream=aStream;vOpacity=aOpacity;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
   }`,
  fragmentShader:`
   precision highp float;
   uniform float uTime;uniform float uMotion;uniform float uIntensity;
   varying float vProgress;varying float vStream;varying float vOpacity;
   void main(){
    float phase=vProgress*38.0-vStream*2.17-uTime*uMotion*.64;
    float flow=pow(.5+.5*cos(phase*6.2831853),2.0);
    float idle=.37;
    float brightness=mix(idle,.25+.75*flow,uMotion);
    float alpha=(.28+.55*brightness)*uIntensity*vOpacity;
    gl_FragColor=vec4(.15,.69,.81,alpha);
   }`
 });
 const lines=new THREE.LineSegments(geometry,material);
 lines.frustumCulled=false;
 group.add(lines);
 group.userData={material,streamCount:PATHS.length};
 return group;
}
