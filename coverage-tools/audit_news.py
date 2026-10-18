#!/usr/bin/env python3
"""Audit WorldPulse mapped news feed coverage (no network or third-party dependencies).
Usage: python coverage-tools/audit_news.py data/news.json --out coverage-report.csv
This audits story locations and publishers as present in the snapshot; it does NOT
infer country from coordinates or present low observed counts as proof of no news.
"""
import argparse,csv,json,collections,datetime
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('news_json');p.add_argument('--out',default='coverage-report.csv');a=p.parse_args()
data=json.loads(Path(a.news_json).read_text(encoding='utf-8'));points=data.get('points',[])
report=collections.defaultdict(lambda:{'signals':0,'reported_articles':0,'linked_urls':set(),'publishers':set(),'newest':''})
for point in points:
 name=str(point.get('name') or 'Unknown mapped location')
 r=report[name];r['signals']+=1;r['reported_articles']+=int(point.get('count') or 0)
 for art in point.get('articles') or []:
  if art.get('url'):r['linked_urls'].add(art['url'])
  if art.get('publisher'):r['publishers'].add(art['publisher'])
  stamp=str(art.get('published_at') or art.get('date') or '')
  if stamp>r['newest']:r['newest']=stamp
out=Path(a.out)
with out.open('w',newline='',encoding='utf-8') as f:
 w=csv.writer(f);w.writerow(['mapped_location','geographic_signals','reported_sampled_articles','distinct_linked_urls','distinct_publishers','newest_linked_publication'])
 for name,r in sorted(report.items(),key=lambda kv:(len(kv[1]['linked_urls']),kv[0])):
  w.writerow([name,r['signals'],r['reported_articles'],len(r['linked_urls']),len(r['publishers']),r['newest']])
print(f'Wrote {out} for {len(report)} mapped location names; not a country-level completeness audit')
