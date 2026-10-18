import './global-pulse.js';
// WorldPulse v2.0F.3 — multi-publisher coverage comparison.
// Data from sampled feeds, not fact-checked canonical events or editorial bias scores.
const VALID_URL = /^https?:\/\//i;

function el(tag, cls, value) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (value !== undefined && value !== null) n.textContent = String(value);
  return n;
}
function dateValue(value) {
  const d = Date.parse(value || '');
  return Number.isFinite(d) ? d : 0;
}
function formattedTime(value) {
  const d = dateValue(value);
  return d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Time not provided';
}
function publishedSource(article) {
  return String(article?.publisher || '').trim() || 'Unspecified publisher';
}
function distinctSources(articles) {
  const map = new Map();
  for (const a of articles) {
    const name = publishedSource(a);
    if (!map.has(name.toLocaleLowerCase())) map.set(name.toLocaleLowerCase(), name);
  }
  return [...map.values()].sort((a,b) => a.localeCompare(b));
}
function installStyles() {
  if (document.getElementById('wp-f3-styles')) return;
  const style = el('style'); style.id = 'wp-f3-styles';
  style.textContent = `
.wp-f3-tools{display:flex;flex-wrap:wrap;align-items:center;gap:.55rem;margin:.7rem 0}
.wp-f3-tools label{display:flex;align-items:center;gap:.35rem;font-size:.81rem;opacity:.9}
.wp-f3-tools select{max-width:180px;background:rgba(25,34,47,.94);color:#eef6ff;border:1px solid rgba(155,192,224,.35);border-radius:7px;padding:.35rem}
.wp-f3-intro,.wp-f3-small{font-size:.79rem;opacity:.8;margin:.3rem 0 .65rem}
.wp-f3-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,245px),1fr));gap:.65rem;margin:.7rem 0}
.wp-f3-card{min-width:0;padding:.8rem;border-radius:10px;border:1px solid rgba(146,185,215,.26);background:rgba(88,134,171,.08);display:flex;flex-direction:column;gap:.35rem}
.wp-f3-card .wp-f3-head{display:flex;align-items:center;justify-content:space-between;gap:.45rem;font-size:.76rem;opacity:.85}
.wp-f3-card a{color:inherit;text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere;font-weight:600}
.wp-f3-card time{font-size:.76rem;opacity:.75}
.wp-f3-history{margin:.6rem 0 .4rem;padding:.6rem .75rem;border-left:2px solid rgba(107,185,218,.5)}
.wp-f3-history ol{padding-left:1.4rem;margin:.3rem 0 .1rem}.wp-f3-history li{font-size:.8rem;margin:.25rem 0}
.wp-f3-empty{font-size:.85rem;opacity:.75}
`;
  document.head.append(style);
}
function coveragePanel(cluster) {
  const panel=el('div','wp-f3-history');
  const label={newly_observed:'Newly observed in WorldPulse',increasing_coverage:'New publisher coverage observed',ongoing_coverage:'Ongoing sampled coverage'};
  panel.append(el('strong',null,label[cluster.coverage_status] || 'Sampled coverage history'));
  const observations=Array.isArray(cluster.coverage_timeline)?cluster.coverage_timeline:[];
  if (observations.length) {
    const ol=el('ol'); ol.setAttribute('aria-label','Coverage observations in time order');
    for (const obs of [...observations].sort((a,b)=>dateValue(a.at)-dateValue(b.at)).slice(-8)) {
      const active=Number.isFinite(Number(obs.active_publishers))?Number(obs.active_publishers):0;
      const added=Number.isFinite(Number(obs.new_publishers))?Number(obs.new_publishers):0;
      ol.append(el('li',null,`${formattedTime(obs.at)}: ${active} publishers in sample${added>0?` · ${added} newly observed`:''}`));
    }
    panel.append(ol);
  } else panel.append(el('p','wp-f3-small','Historical observations are not available yet.'));
  panel.append(el('p','wp-f3-small','Counts reflect sampled coverage at each refresh, not verified event severity or a complete media census.'));
  return panel;
}
function articleCard(article) {
  const card=el('article','wp-f3-card');
  const header=el('div','wp-f3-head');
  header.append(el('span',null,publishedSource(article)));
  card.append(header);
  const link=el('a',null,article.title||'Read original article');
  link.href=article.url;link.target='_blank';link.rel='noopener noreferrer';
  card.append(link);
  const time=el('time',null,formattedTime(article.published_at));
  if(dateValue(article.published_at))time.dateTime=article.published_at;
  card.append(time);
  return card;
}
function comparison(cluster){
  const root=el('div','wp-f3-comparison');
  const articles=Array.isArray(cluster.articles)?cluster.articles.filter(a=>a&&typeof a.url==='string'&&VALID_URL.test(a.url)):[];
  if(!articles.length){root.append(el('p','wp-f3-empty','No linked publisher articles available.'));return root;}
  const sources=distinctSources(articles);
  root.append(el('p','wp-f3-intro',`Compare the original headlines from ${sources.length} publisher${sources.length===1?'':'s'}. Differences in wording do not establish bias or accuracy.`));
  const tools=el('div','wp-f3-tools');
  const sourceLabel=el('label',null,'Publisher');
  const sourceSelect=el('select');sourceSelect.setAttribute('aria-label','Filter publisher');
  const any=el('option',null,'All publishers');any.value='';sourceSelect.append(any);
  for(const source of sources){const option=el('option',null,source);option.value=source.toLocaleLowerCase();sourceSelect.append(option);}
  sourceLabel.append(sourceSelect);tools.append(sourceLabel);
  const sortLabel=el('label',null,'Published');
  const sortSelect=el('select');sortSelect.setAttribute('aria-label','Sort published articles');
  for(const [value,label] of [['new','Newest first'],['old','Oldest first'],['publisher','Publisher A–Z']]){const option=el('option',null,label);option.value=value;sortSelect.append(option);}
  sortLabel.append(sortSelect);tools.append(sortLabel);root.append(tools);
  const count=el('p','wp-f3-small');count.setAttribute('aria-live','polite');root.append(count);
  const grid=el('div','wp-f3-grid');root.append(grid);
  function render(){
    const selected=sourceSelect.value;
    const items=articles.filter(a=>!selected || publishedSource(a).toLocaleLowerCase()===selected).slice();
    if(sortSelect.value==='publisher')items.sort((a,b)=>publishedSource(a).localeCompare(publishedSource(b))||dateValue(b.published_at)-dateValue(a.published_at));
    else if(sortSelect.value==='old')items.sort((a,b)=>dateValue(a.published_at)-dateValue(b.published_at));
    else items.sort((a,b)=>dateValue(b.published_at)-dateValue(a.published_at));
    grid.replaceChildren(...items.map(articleCard));
    count.textContent=`Showing ${items.length} of ${articles.length} distinct article${articles.length===1?'':'s'} in this cluster.`;
  }
  sourceSelect.addEventListener('change',render);sortSelect.addEventListener('change',render);render();
  if(cluster.coverage_status||Array.isArray(cluster.coverage_timeline))root.append(coveragePanel(cluster));
  return root;
}
// F4: cautious bilateral relationship explorer. No effect on Three.js scene.
function crossBorderSection(feed){
  const links=Array.isArray(feed?.cross_border?.links)?feed.cross_border.links:[];
  const section=el('section','wp-f4-section');
  section.append(el('h3',null,'Cross-border connections'));
  section.append(el('p','wp-f3-intro','Explicit country-to-country relationships mentioned in sampled headlines. A link indicates reporting about a possible relationship—not a verified event, flight, trade flow or causal connection.'));
  if(!links.length){section.append(el('p','wp-f3-empty','No high-confidence headline candidates in this refresh. WorldPulse does not draw inferred links.'));return section;}
  const tools=el('div','wp-f4-tools');
  const filter=el('select');filter.setAttribute('aria-label','Filter cross-border relationship');
  const opts=[['','All relationship types'],...new Set(links.map(x=>x.relationship)).values()].map(x=>Array.isArray(x)?x:[x,x[0].toUpperCase()+x.slice(1)]);
  for(const [val,label] of opts){const o=el('option',null,label);o.value=val;filter.append(o);} tools.append(filter);section.append(tools);
  const diagram=el('div','wp-f4-map');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 720 310');svg.setAttribute('role','img');svg.setAttribute('aria-label','Schematic location of connected countries, not an incident or navigation map');
  const label=el('p','wp-f3-small','Country positions are approximate map anchors, not event coordinates.');
  diagram.append(svg,label);section.append(diagram);
  const cards=el('div','wp-f4-list');section.append(cards);
  function drawMap(items){
    svg.replaceChildren();
    const ns='http://www.w3.org/2000/svg';
    function elem(tag,attrs){const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));svg.append(n);return n;}
    for(let i=1;i<6;i++)elem('line',{x1:0,x2:720,y1:i*310/6,y2:i*310/6,stroke:'#325367','stroke-opacity':'.35'});
    for(let i=1;i<12;i++)elem('line',{x1:i*720/12,x2:i*720/12,y1:0,y2:310,stroke:'#325367','stroke-opacity':'.35'});
    const coord=c=>[10+(c.lng+180)/360*700,10+(90-c.lat)/180*290];
    for(const item of items.slice(0,15)){
      const [a,b]=item.countries.map(coord);
      const path=elem('path',{d:`M ${a[0]} ${a[1]} Q ${(a[0]+b[0])/2} ${Math.min(a[1],b[1])-20} ${b[0]} ${b[1]}`,fill:'none',stroke:'#60dec9','stroke-width':1.5,'stroke-opacity':'.45'});
      for(let i=0;i<2;i++){const c=item.countries[i],v=[a,b][i];elem('circle',{cx:v[0],cy:v[1],r:4,fill:'#80f4e5',stroke:'#0c2935','stroke-width':2});}
    }
  }
  function render(){
    const items=links.filter(x=>!filter.value||x.relationship===filter.value);
    drawMap(items);cards.replaceChildren();
    for(const item of items){
      if(!Array.isArray(item.countries)||item.countries.length!==2)continue;
      const d=el('details','wp-f4-card'),summary=el('summary');
      summary.append(el('strong',null,`${item.countries[0].name} ↔ ${item.countries[1].name}`));
      summary.append(el('small',null,`${item.relationship} · ${item.article_count} reports · ${item.publisher_count} publishers`));d.append(summary);
      const body=el('div','wp-f4-body');body.append(el('p','wp-f3-small',item.note||'Headline evidence only.'));
      for(const a of (item.articles||[])){
        if(!a||!VALID_URL.test(a.url||''))continue;
        const row=el('p','wp-f4-article');const link=el('a',null,a.title||'Read original report');link.href=a.url;link.target='_blank';link.rel='noopener noreferrer';row.append(link,el('small',null,a.publisher||'Unspecified publisher'));body.append(row);
      }
      d.append(body);cards.append(d);
    }
  }
  filter.addEventListener('change',render);render();return section;
}
function installF4Styles(){
  if(document.getElementById('wp-f4-styles'))return;
  const st=el('style');st.id='wp-f4-styles';st.textContent=`
.wp-f4-section{grid-column:1/-1;min-width:0;padding:15px;border:1px solid rgba(108,202,212,.33);border-radius:12px;background:rgba(11,50,63,.6);margin:0 0 12px}
.wp-f4-section h3{margin:0 0 8px;color:#c8fcf4}.wp-f4-tools select{padding:9px 12px;color:#e7f8fa;background:#102b38;border:1px solid #46717b;border-radius:8px;margin:4px 0 13px}
.wp-f4-map{background:linear-gradient(140deg,#102b3d,#09212e);border:1px solid #294b5d;border-radius:10px;overflow:hidden}
.wp-f4-map svg{display:block;width:100%;height:auto;max-height:310px}.wp-f4-map p{padding:0 12px}
.wp-f4-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:8px;margin-top:14px}
.wp-f4-card{border:1px solid #345b69;border-radius:9px;padding:10px;background:#102f3e;min-width:0}.wp-f4-card summary{cursor:pointer}.wp-f4-card summary strong,.wp-f4-card summary small{display:block}.wp-f4-card summary small{color:#9bc3c9;margin-top:5px;font-size:11px}.wp-f4-body{margin-top:9px}.wp-f4-article{display:flex;flex-direction:column;gap:2px;font-size:12px;border-top:1px solid #325160;padding-top:8px}.wp-f4-article a{color:#b3f8e9;overflow-wrap:anywhere}.wp-f4-article small{opacity:.75}
`;document.head.append(st);
}
export function renderStoryClusters(feed,list,enabledCategories){
  const clusters=Array.isArray(feed?.meta?.story_clusters)?feed.meta.story_clusters:[];
  const visible=clusters.filter(c=>c&&enabledCategories.has(c.category)&&Array.isArray(c.articles)&&Number(c.publisher_count)>=2).slice(0,8);
  const hasCrossBorder=Array.isArray(feed?.cross_border?.links);
  if(!visible.length&&!hasCrossBorder)return;
  installStyles();
  const section=el('section','story-cluster-section');
  if(hasCrossBorder){installF4Styles();list.append(crossBorderSection(feed));}
  if(!visible.length)return;
  section.append(el('h3',null,'Multi-source story groups'));
  section.append(el('p','story-cluster-note','Headlines grouped by similarity, location and category. These are sampled reports, not verified events or fact-checks.'));
  for(const cluster of visible){
    const details=el('details','story-cluster');const summary=el('summary');
    summary.append(el('strong',null,cluster.label||'Grouped reports'));
    const meta=el('small',null,`${cluster.article_count} reports · ${cluster.publisher_count} publishers · ${cluster.location||'Mapped geographic subject'} · ${cluster.matching_rule==='shared_event_terms'?'Guarded event-term match':'Strong headline match'}`);
    summary.append(meta);details.append(summary);
    // Lazy rendering keeps large news lists responsive.
    details.addEventListener('toggle',()=>{if(details.open&&!details.dataset.f3Rendered){details.append(comparison(cluster));details.dataset.f3Rendered='1';}});
    section.append(details);
  }
  list.append(section);
}

// v2.0F.3.1 — Move discovery out of the narrow controls sidebar.
// Keep existing #discovery / #story-explorer nodes: existing main.js listeners
// and feed refreshes continue to operate with no modifications.
function setupDiscoverWorkspace() {
  const discovery=document.getElementById('discovery');
  const explorer=document.querySelector('.news-section .story-explorer');
  const sideSection=document.querySelector('.news-section');
  if (!discovery || !explorer || !sideSection || document.getElementById('wp-discover-launch')) return;
  const styles=el('style');styles.id='wp-discover-workspace-styles';
  styles.textContent=`
.wp-discover-launch{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:14px 15px;margin:13px 0 17px;border:1px solid #3b8290;border-radius:10px;background:linear-gradient(105deg,#113944,#0a2d3b);color:#dffffa;font:inherit;font-size:13px;font-weight:700;letter-spacing:.025em;cursor:pointer;text-align:left}
.wp-discover-launch:hover,.wp-discover-launch:focus-visible{border-color:#6ef2df;background:#174954;outline-offset:3px}
.wp-discover-launch small{display:block;font-size:10px;font-weight:400;color:#a1c6cc;margin-top:3px}
.wp-discover-launch .wp-launch-arrow{font-size:22px;font-weight:400;color:#74eadb}
.wp-discover-modal[hidden]{display:none!important}
.wp-discover-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:clamp(10px,2.5vw,34px);background:rgba(1,9,18,.78);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}
.wp-discover-dialog{width:min(1200px,100%);height:min(830px,94dvh);min-height:0;background:linear-gradient(135deg,#0d2836,#071b27 65%);border:1px solid #326477;box-shadow:0 24px 100px rgba(0,0,0,.7);border-radius:17px;display:flex;flex-direction:column;overflow:hidden;color:#e8f9fa;font-family:inherit}
.wp-discover-top{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:20px 25px 16px;border-bottom:1px solid #234756;flex:0 0 auto}
.wp-discover-kicker{color:#76d9d1;letter-spacing:.17em;font-size:10px;font-weight:700}
.wp-discover-top h2{font-size:clamp(20px,2.6vw,29px);line-height:1.1;margin:6px 0;color:#f2fcff}
.wp-discover-top p{margin:5px 0 0;color:#a8c4ce;font-size:12px;line-height:1.5}
.wp-discover-close{border:1px solid #37677a;background:#123646;border-radius:9px;color:#e8fbfb;width:38px;height:38px;cursor:pointer;font-size:20px;flex:0 0 auto}
.wp-discover-close:hover,.wp-discover-close:focus-visible{border-color:#73e5da}
.wp-discover-scroll{overflow-y:auto;overscroll-behavior:contain;min-height:0;padding:22px 25px 32px;flex:1}
.wp-discover-scroll .discovery{border:0;background:transparent;margin:0;padding:0;min-width:0}
.wp-discover-scroll .discovery>.section-name{display:none}
.wp-discover-scroll .discover-tabs{display:flex;flex-wrap:wrap;gap:7px;margin:15px 0}
.wp-discover-scroll .discover-tabs button{font-size:12px;padding:10px 15px;flex:0 1 auto}
.wp-discover-scroll .discover-explainer,.wp-discover-scroll .discover-caption{font-size:12px;max-width:75ch}
.wp-discover-scroll .discover-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;max-height:none;overflow:visible;align-items:stretch}
.wp-discover-scroll .discover-card{padding:17px;border-radius:10px;gap:9px;min-width:0;min-height:155px;display:flex;flex-direction:column;height:100%}
.wp-discover-scroll .discover-card .discover-card-actions{margin-top:auto;padding-top:6px}
.wp-discover-scroll .discover-card strong{font-size:14px;line-height:1.45}
.wp-discover-scroll .discover-card small{font-size:11px}
.wp-discover-scroll .story-cluster-section{grid-column:1/-1;min-width:0}
.wp-discover-scroll .story-cluster{padding:14px;border-radius:12px}
.wp-discover-scroll .story-cluster summary{font-size:15px;line-height:1.5}
.wp-discover-scroll .wp-f3-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.wp-discover-scroll .wp-f3-card{padding:16px;gap:10px}
.wp-discover-scroll .wp-f3-card a{font-size:14px;line-height:1.5}
.wp-discover-scroll .wp-f3-tools{gap:14px;margin:15px 0}
.wp-discover-scroll .wp-f3-tools label{font-size:12px;gap:9px}
.wp-discover-scroll .wp-f3-tools select{max-width:260px;min-width:155px;font-size:12px;padding:9px}
.wp-discover-search{margin:0 0 22px;padding:17px 18px;background:rgba(15,49,62,.65);border:1px solid #315463;border-radius:12px}
.wp-discover-search .story-explorer{margin:0;padding:0;border:0;background:none}
.wp-discover-search .story-explorer input{font-size:13px;padding:13px}
.wp-discover-search .search-results{max-height:350px}
.wp-discover-section-heading{color:#d3f5f4;font-size:12px;letter-spacing:.08em;font-weight:700;margin:0 0 12px}
body.wp-discover-open{overflow:hidden}
@media(max-width:730px){.wp-discover-modal{padding:0}.wp-discover-dialog{height:100dvh;width:100%;border:0;border-radius:0}.wp-discover-top{padding:16px}.wp-discover-scroll{padding:16px}.wp-discover-scroll .discover-list,.wp-discover-scroll .wp-f3-grid{grid-template-columns:minmax(0,1fr)}.wp-discover-scroll .wp-f3-tools{flex-direction:column;align-items:stretch}.wp-discover-scroll .wp-f3-tools label{justify-content:space-between}.wp-discover-scroll .wp-f3-tools select{max-width:none;flex:1;min-width:0}}
@media(prefers-reduced-motion:reduce){.wp-discover-modal{backdrop-filter:none;-webkit-backdrop-filter:none}}
`;
  document.head.append(styles);
  const launch=el('button','wp-discover-launch');launch.type='button';launch.id='wp-discover-launch';
  const title=el('span');title.append(document.createTextNode('◈  Discover news'));
  title.append(el('small',null,'Explore stories · Compare coverage'));
  launch.append(title,el('span','wp-launch-arrow','↗'));
  explorer.before(launch);
  const modal=el('div','wp-discover-modal');modal.id='wp-discover-modal';modal.hidden=true;
  const dialog=el('section','wp-discover-dialog');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','wp-discover-title');
  const header=el('div','wp-discover-top');
  const intro=el('div');intro.append(el('div','wp-discover-kicker','WORLDPULSE / DISCOVER'));
  const h2=el('h2',null,"Explore the world's stories");h2.id='wp-discover-title';intro.append(h2,el('p',null,'Browse headlines, explore linked coverage, and compare how publishers report.'));
  const close=el('button','wp-discover-close','×');close.type='button';close.setAttribute('aria-label','Close Discover');
  header.append(intro,close);
  const scroll=el('div','wp-discover-scroll');
  const searchArea=el('div','wp-discover-search');searchArea.append(explorer);
  scroll.append(searchArea,el('h3','wp-discover-section-heading','DISCOVER / CURRENT FEED'),discovery);
  dialog.append(header,scroll);modal.append(dialog);document.body.append(modal);
  let previousFocus=null;
  function open(){previousFocus=document.activeElement;modal.hidden=false;document.body.classList.add('wp-discover-open');close.focus();}
  function dismiss(){modal.hidden=true;document.body.classList.remove('wp-discover-open');if(previousFocus?.isConnected)previousFocus.focus();else launch.focus();}
  window.addEventListener('worldpulse:explore',event=>{
    const detail=event.detail||{};
    open();
    const input=document.getElementById('storySearch');
    if(input && detail.query){input.value=String(detail.query);document.getElementById('searchStories')?.click();}
    scroll.scrollTop=0;
    input?.focus();
  });
  launch.addEventListener('click',open);close.addEventListener('click',dismiss);
  modal.addEventListener('click',e=>{if(e.target===modal)dismiss();});
  modal.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();dismiss();return;}
    if(e.key==='Tab'){
      const controls=[...dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(n=>n.getClientRects().length);
      if(!controls.length)return;
      const first=controls[0],last=controls[controls.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupDiscoverWorkspace,{once:true});
else setupDiscoverWorkspace();

// F.5.3: optional RSS publisher thumbnails. Never infer artwork from a headline.
(function installDiscoveryThumbnails(){
 const st=document.createElement('style'); st.textContent=`
.wp-discover-scroll .discover-card.wp-has-image{display:grid;grid-template-columns:112px minmax(0,1fr);column-gap:12px;align-items:start}
.wp-discover-scroll .discover-card .wp-story-thumbnail{width:112px;height:85px;object-fit:cover;border-radius:7px;border:1px solid #315767;grid-row:1 / span 3;grid-column:1;background:#102c3b}
.wp-discover-scroll .discover-card.wp-has-image > strong,.wp-discover-scroll .discover-card.wp-has-image > small,.wp-discover-scroll .discover-card.wp-has-image > .discover-card-actions{grid-column:2}
@media(max-width:490px){.wp-discover-scroll .discover-card.wp-has-image{grid-template-columns:85px minmax(0,1fr)}.wp-discover-scroll .discover-card .wp-story-thumbnail{width:85px;height:72px}}
`; document.head.append(st);
 let feed=null,loading=false;
 const feeds=['https://dvexperiments.github.io/WorldPulse/data/news.json','./data/news.json'];
 const secure=url=>{try{const p=new URL(url);return p.protocol==='https:'&&!p.username&&!p.password&& !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(p.hostname)?p.href:null;}catch{return null;}};
 async function obtain(){if(feed||loading)return;loading=true;try{for(const src of feeds){try{const r=await fetch(src);if(!r.ok)continue;const d=await r.json();const map=new Map();for(const p of d.points||[])for(const a of p.articles||[])if(a.image_url&&a.url)map.set(a.url,a.image_url);for(const a of d.meta?.unlocated_articles||[])if(a.image_url&&a.url)map.set(a.url,a.image_url);feed=map;break;}catch{}}}finally{loading=false;} }
 function paint(){const list=document.getElementById('discoverList');if(!list||!feed)return;
 for(const card of list.querySelectorAll('.discover-card:not([data-wp-image-checked])')){
 card.dataset.wpImageChecked='1';const anchor=card.querySelector('.discover-card-actions a[href]');if(!anchor)continue;
 const url=secure(feed.get(anchor.href));if(!url)continue;
 const img=document.createElement('img');img.className='wp-story-thumbnail';img.src=url;img.loading='lazy';img.decoding='async';img.alt='';img.referrerPolicy='no-referrer';img.onerror=()=>{img.remove();card.classList.remove('wp-has-image');};card.prepend(img);card.classList.add('wp-has-image');
 }
 }
 function setup(){const list=document.getElementById('discoverList');if(!list)return;const obs=new MutationObserver(()=>{if(feed)paint();});obs.observe(list,{childList:true});obtain().then(paint);document.getElementById('wp-discover-launch')?.addEventListener('click',()=>{obtain().then(paint);});}
 if(document.readyState==='complete')setup();else window.addEventListener('load',setup,{once:true});
})();
