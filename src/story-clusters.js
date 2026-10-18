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
export function renderStoryClusters(feed,list,enabledCategories){
  const clusters=Array.isArray(feed?.meta?.story_clusters)?feed.meta.story_clusters:[];
  const visible=clusters.filter(c=>c&&enabledCategories.has(c.category)&&Array.isArray(c.articles)&&Number(c.publisher_count)>=2).slice(0,8);
  if(!visible.length)return;
  installStyles();
  const section=el('section','story-cluster-section');
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
