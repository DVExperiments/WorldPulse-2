// v2.0E.4: explain the *evidence*, never claim a verified event location.
export function geographicEvidence(article, mapped=true) {
 if(!mapped) return 'No confident mapped geographic subject; this story is available for browsing only.';
 const label=article?.evidence_label || ({headline:'Headline evidence',description:'Description evidence','headline-reviewed-correction':'Headline evidence'}[article?.geo_match]||'Geographic association');
 const explain=article?.evidence_explanation || (article?.geo_match?.startsWith('description')?'Based on the feed description.':article?.geo_match?.startsWith('headline')?'Based on a location named in the headline.':'Geographic subject inferred from available article metadata.');
 const precision=article?.location_precision||'approximate';
 return `${label} · ${explain} ${precision} reference, not a verified incident location.`;
}
export function evidenceElement(article,mapped=true){
 const p=document.createElement('p');p.className='geographic-evidence';p.textContent=geographicEvidence(article,mapped);return p;
}
