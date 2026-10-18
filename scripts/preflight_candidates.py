#!/usr/bin/env python3
"""Optionally test candidate RSS/Atom URLs before enabling additional feeds.
Network is used only when this script is explicitly run.
"""
import argparse
import json
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from coverage_expansion import CANDIDATE_FEEDS

def probe(url,timeout=9):
    req=urllib.request.Request(url,headers={'User-Agent':'WorldPulse/2.0D.2 feed health check','Accept':'application/xml, application/rss+xml, application/atom+xml'})
    with urllib.request.urlopen(req,timeout=timeout) as response:
        body=response.read(500000)
    root=ET.fromstring(body)
    kind=root.tag.rsplit('}',1)[-1].lower()
    if kind not in ('feed','rss','rdf'):raise ValueError('Not recognized RSS/Atom: '+kind)
    return kind

def main():
    p=argparse.ArgumentParser();p.add_argument('--timeout',type=float,default=9);p.add_argument('--limit',type=int,default=0);args=p.parse_args()
    feedlist=CANDIDATE_FEEDS[:args.limit] if args.limit else CANDIDATE_FEEDS
    rows=[]
    for name,url,region,lang in feedlist:
        try: rows.append({'name':name,'url':url,'region':region,'language':lang,'status':'ok','format':probe(url,args.timeout)})
        except Exception as exc:rows.append({'name':name,'url':url,'region':region,'language':lang,'status':'failed','error':str(exc)[:220]})
        print(rows[-1]['status'],name,flush=True)
    out=Path('data/feed-candidate-preflight.json');out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps({'checked':len(rows),'sources':rows},indent=2),encoding='utf-8')
    print('Saved',out)
if __name__=='__main__':main()
