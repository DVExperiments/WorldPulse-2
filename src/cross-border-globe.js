import * as THREE from 'three';
import {llToXYZ} from './geo.js';

const MAX_LINKS = 24;
const MAX_ARTICLES = 12;
const isCoord = c => c && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng)) && Math.abs(Number(c.lat)) <= 90 && Math.abs(Number(c.lng)) <= 180;
const xyz = (c, radius = 1) => new THREE.Vector3(...llToXYZ(Number(c.lat), Number(c.lng), radius));
const safeUrl = value => typeof value === 'string' && /^https:\/\/[^\s]+$/i.test(value);

// Use geographic great-circle arcs for a visual relationship only. No direction,
// flow, exact event position, or physical travel is implied.
function pathBetween(a, b) {
  const x = xyz(a), y = xyz(b), angle = x.angleTo(y);
  const n = Math.max(28, Math.min(100, Math.ceil(angle * 40)));
  const points = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const chord = x.clone().lerp(y, t).normalize();
    let onSphere = chord;
    if (angle > 0.0001 && angle < Math.PI - 0.0001) {
      const s = Math.sin(angle);
      onSphere = x.clone().multiplyScalar(Math.sin((1-t)*angle)/s)
        .addScaledVector(y, Math.sin(t*angle)/s).normalize();
    }
    // At antipodal positions, the normalized chord can be zero at t=.5.
    if (onSphere.lengthSq() < 0.01) onSphere = xyz(a);
    points.push(onSphere.multiplyScalar(1.027 + Math.sin(t * Math.PI) * (0.09 + angle * 0.035)));
  }
  return points;
}

export class CrossBorderGlobe {
  constructor(globe) {
    this.group = new THREE.Group();
    this.group.name = 'Cross-border news relationships (headline candidates)';
    this.group.visible = false;
    globe.add(this.group);
    this.links = [];
    this.pickable = [];
  }
  setVisible(value) { this.group.visible = Boolean(value); }
  setLinks(payload) {
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      child.geometry?.dispose();
      child.material?.dispose();
    }
    this.pickable = [];
    const input = Array.isArray(payload?.links) ? payload.links : [];
    this.links = input.filter(link =>
      link && link.evidence === 'explicit_bilateral_headline' &&
      Array.isArray(link.countries) && link.countries.length === 2 &&
      link.countries.every(c => isCoord(c) && typeof c.name === 'string') &&
      Array.isArray(link.articles) && link.articles.some(a => safeUrl(a?.url))
    ).slice(0, MAX_LINKS);
    this.links.forEach((link, index) => {
      const [a,b] = link.countries;
      const g = new THREE.BufferGeometry().setFromPoints(pathBetween(a,b));
      const mat = new THREE.LineBasicMaterial({color:0xf3bb75,transparent:true,opacity:0.60,depthWrite:false,depthTest:true});
      const line = new THREE.Line(g,mat);
      line.userData.linkIndex = index;
      line.frustumCulled = false;
      this.group.add(line);
      this.pickable.push(line);
    });
    return this.links.length;
  }
  pick(pointer, camera, rect) {
    if (!this.group.visible || !this.pickable.length || rect.width < 2 || rect.height < 2) return null;
    const mouse = new THREE.Vector2(((pointer.clientX-rect.left)/rect.width)*2-1,-((pointer.clientY-rect.top)/rect.height)*2+1);
    const ray = new THREE.Raycaster();
    ray.params.Line.threshold = 0.028;
    ray.setFromCamera(mouse,camera);
    const intersections = ray.intersectObjects(this.pickable,false);
    if (!intersections.length) return null;
    // Prevent selecting a line on the back of the planet.
    const hit = intersections.find(i => {
      const dist = i.distance;
      const oc = camera.position.clone().sub(this.group.parent?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3());
      const B = 2 * oc.dot(ray.ray.direction), C = oc.lengthSq() - 1.005*1.005;
      const d = B*B-4*C;
      if (d < 0) return true;
      const sphereNear = (-B-Math.sqrt(d))/2;
      return sphereNear < 0 || dist < sphereNear + 0.055;
    });
    return hit ? this.links[hit.object.userData.linkIndex] : null;
  }
}
export function showCrossBorderDetails(link) {
  const drawer = document.getElementById('newsDrawer');
  const title = document.getElementById('newsTitle');
  const meta = document.getElementById('newsMeta');
  const stories = document.getElementById('newsStories');
  if (!drawer || !title || !meta || !stories) return;
  drawer.hidden = false;
  title.textContent = `${link.countries[0].name} ↔ ${link.countries[1].name}`;
  const label = typeof link.relationship_label === 'string' && link.relationship_label.trim()
    ? link.relationship_label : (link.relationship || 'Bilateral reporting');
  const explanation = typeof link.relationship_explanation === 'string' && link.relationship_explanation.trim()
    ? link.relationship_explanation : 'The relationship is inferred from the headline; it is not independently verified.';
  meta.textContent = `${label} · ${explanation} Country anchors are approximate; the arc is not a physical route.`;
  stories.replaceChildren();
  for (const article of link.articles.slice(0,MAX_ARTICLES)) {
    if (!safeUrl(article?.url)) continue;
    const row = document.createElement('div'); row.className='news-story';
    const anchor=document.createElement('a'); anchor.href=article.url; anchor.target='_blank'; anchor.rel='noopener noreferrer'; anchor.textContent=article.title||'Read source article';
    const source=document.createElement('small'); source.textContent=article.publisher||'Publisher unspecified';
    row.append(anchor,source); stories.append(row);
  }
}
