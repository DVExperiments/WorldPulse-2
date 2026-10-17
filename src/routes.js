import * as THREE from 'three';
import {llToXYZ} from './geo.js';

function vec(lat,lon,r){const v=llToXYZ(lat,lon,r);return new THREE.Vector3(...v);}
function interpolateGreatCircle(a,b,progress,alt=0){
 const va=vec(a[0],a[1],1),vb=vec(b[0],b[1],1);
 let theta=va.angleTo(vb),p;
 if(theta<.00001)p=va;
 else if(Math.abs(Math.sin(theta))<.000001)p=va.clone().lerp(vb,progress).normalize();
 else p=va.clone().multiplyScalar(Math.sin((1-progress)*theta)/Math.sin(theta)).addScaledVector(vb,Math.sin(progress*theta)/Math.sin(theta)).normalize();
 return p.multiplyScalar(1+alt);
}
function segmentGeometry(paths,opacity,color,altFn){
 const coords=[],progress=[],phases=[];
 for(let pi=0;pi<paths.length;pi++){
  const path=paths[pi],stops=path.stops;
  for(let j=0;j<stops.length-1;j++){
   const a=stops[j],b=stops[j+1];
   const segments=Math.max(6,Math.min(70,Math.ceil(vec(a[0],a[1],1).angleTo(vec(b[0],b[1],1))*33)));
   for(let i=0;i<segments;i++){
    for(const k of [i,i+1]){
     const u=k/segments,arc=altFn(u,path,j),xyz=interpolateGreatCircle(a,b,u,arc);
     coords.push(xyz.x,xyz.y,xyz.z);progress.push(u);phases.push(pi*.143+j*.313);
    }
   }
  }
 }
 const geom=new THREE.BufferGeometry();
 geom.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
 geom.setAttribute('aProgress',new THREE.Float32BufferAttribute(progress,1));
 geom.setAttribute('aPhase',new THREE.Float32BufferAttribute(phases,1));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,
 uniforms:{uTime:{value:0},uMotion:{value:1},uAlpha:{value:opacity},uColor:{value:new THREE.Color(color)}},
 vertexShader:`attribute float aProgress;attribute float aPhase;varying float vProgress;varying float vPhase;void main(){vProgress=aProgress;vPhase=aPhase;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`
 uniform float uTime;uniform float uMotion;uniform float uAlpha;uniform vec3 uColor;
 varying float vProgress;varying float vPhase;
 void main(){
  // Positive travel from the first mapped waypoint toward the final one.
  // A broad, soft tail follows a smaller luminous leading crest.
  float head=fract(uTime*.073-vPhase);
  float behind=fract(head-vProgress+1.0);
  float tail=exp(-pow(behind/.125,1.45)*3.2);
  float crest=exp(-pow(min(behind,1.0-behind)/.028,2.0)*2.5);
  // Keep the original faint corridor visible when motion is disabled.
  float intensity=uAlpha*(.69+uMotion*(1.65*tail+2.5*crest));
  gl_FragColor=vec4(uColor,clamp(intensity,0.0,.92));
 }`});
 const lines=new THREE.LineSegments(geom,material);lines.frustumCulled=false;return lines;
}
export function buildAirLayer(data){
 const group=new THREE.Group(),routes=data.routes.map(route=>({...route,stops:[data.airports[route.a],data.airports[route.b]]})).filter(r=>r.stops.every(Boolean));
 // Higher arcs for longer distances. This does not imply aircraft altitude.
 const arc=(u,r)=>{const a=vec(...r.stops[0],1),b=vec(...r.stops[1],1);const angle=a.angleTo(b);return .014+Math.sin(Math.PI*u)*Math.min(.3,.055+angle*.09)};
 const lines=segmentGeometry(routes,.23,0x75bfff,arc);group.add(lines);
 const endpoints=[];
 for(const coord of Object.values(data.airports)){endpoints.push(...llToXYZ(coord[0],coord[1],1.023));}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(endpoints,3));
 const pts=new THREE.Points(g,new THREE.PointsMaterial({color:0x89d0ff,size:2.3,sizeAttenuation:false,transparent:true,opacity:.7,depthWrite:false}));group.add(pts);
 group.userData.lines=lines;group.userData.count=routes.length;return group;
}
export function buildSeaLayer(data){
 const group=new THREE.Group();const routes=[];
 for(const route of data.routes){const pts=route.points.map(id=>data.waypoints[id]).filter(Boolean);if(pts.length>=2)routes.push({name:route.name,stops:pts});}
 const lines=segmentGeometry(routes,.2,0x49ceb6,()=>.014);group.add(lines);
 group.userData.lines=lines;group.userData.count=routes.length;return group;
}
export async function loadConnections(){
 const [airRes,seaRes]=await Promise.all([fetch('./data/air-network.json'),fetch('./data/sea-network.json')]);
 if(!airRes.ok||!seaRes.ok)throw new Error('Could not load route datasets');
 return {air:buildAirLayer(await airRes.json()),sea:buildSeaLayer(await seaRes.json())};
}
