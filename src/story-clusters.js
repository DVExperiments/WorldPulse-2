// F.1 published similarity groups: not verified shared events or validated claims.
export function renderStoryClusters(feed,list,enabledCategories){
 const clusters=Array.isArray(feed?.meta?.story_clusters)?feed.meta.story_clusters:[];
 const visible=clusters.filter(c=>c && enabledCategories.has(c.category) && Array.isArray(c.articles) && c.publisher_count>=2).slice(0,8);
 if(!visible.length)return;
 const section=document.createElement('section');section.className='story-cluster-section';
 const h=document.createElement('h3');h.textContent='Multi-source story groups';section.append(h);
 const note=document.createElement('p');note.className='story-cluster-note';note.textContent='Strongly similar headlines from different publishers, grouped within a location and category. Not a verified event or fact-check.';section.append(note);
 for(const cluster of visible){
  const details=document.createElement('details');details.className='story-cluster';
  const summary=document.createElement('summary');
  const title=document.createElement('strong');title.textContent=cluster.label||'Grouped reports';
  const meta=document.createElement('small');meta.textContent=`${cluster.article_count} distinct reports · ${cluster.publisher_count} publishers · ${cluster.location||'Mapped geographic subject'} · ${cluster.matching_rule==='shared_event_terms'?'Guarded event-term match':'Strong headline match'}`;
  summary.append(title,meta);details.append(summary);
  if(cluster.coverage_status){
   const status=document.createElement('p');status.className='story-cluster-note';
   const labels={newly_observed:'Newly observed in WorldPulse',increasing_coverage:'New publisher coverage observed',ongoing_coverage:'Ongoing sampled coverage'};
   status.textContent=(labels[cluster.coverage_status]||'Sampled story coverage')+' · Coverage is not a measure of event severity.';
   details.append(status);
   if(Array.isArray(cluster.coverage_timeline)&&cluster.coverage_timeline.length){
    const timeline=document.createElement('ol');timeline.setAttribute('aria-label','Sampled coverage observations');
    for(const o of cluster.coverage_timeline.slice(-6)){
     const entry=document.createElement('li');const when=Date.parse(o.at);
     const label=Number.isFinite(when)?new Date(when).toLocaleString(): 'Observation';
     entry.textContent=`${label}: ${o.active_publishers} publishers in sample`;
     timeline.append(entry);
    }
    details.append(timeline);
   }
  }
  const ul=document.createElement('ul');
  for(const a of cluster.articles.slice(0,20)){
   if(typeof a.url!=='string'||!/^https?:\/\//i.test(a.url))continue;
   const li=document.createElement('li');const link=document.createElement('a');link.href=a.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=a.title||'Read original';
   const source=document.createElement('small');source.textContent=a.publisher||'Publisher unspecified';li.append(link,source);ul.append(li);
  }
  details.append(ul);section.append(details);
 }
 list.append(section);
}
