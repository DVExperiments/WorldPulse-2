#!/usr/bin/env python3
"""Offline WorldPulse coverage audit. Stdlib only. Does not alter collector output.

Usage from repo root: python scripts/audit_global_coverage.py
Inputs: data/news.json, data/source-health.json, data/world-borders.geojson
Output: data/coverage-audit.json and data/coverage-audit.csv

Locations are geographic subjects, not proven incident sites. Country-level
counts include ONLY explicit country-labelled signals; city points are omitted.
"""
from __future__ import annotations
import csv
import datetime as dt
import json
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'


def load(name,default):
    p=DATA/name
    if not p.exists():return default
    try:return json.loads(p.read_text(encoding='utf-8'))
    except (OSError,ValueError):return default


def audit():
    news=load('news.json',{})
    health=load('source-health.json',{})
    borders=load('world-borders.geojson',{})
    # WorldPulse 2 stores geographic boundaries with the same filename.
    if not borders.get('features'):
        borders=load('countries.geojson',{})
    names=sorted(set(f.get('properties',{}).get('name','').strip() for f in borders.get('features',[]) if f.get('properties',{}).get('name')))
    if not names: names=sorted(load('country-inventory.json',[]))
    points=news.get('points',[])
    country_labels=Counter()
    for point in points:
        if point.get('accuracy')=='country':
            country_labels[point.get('name','')]+=int(point.get('count') or 0)
    feeds=health.get('sources',[])
    by_region={}
    for feed in feeds:
        region=feed.get('editorial_region') or feed.get('source_region') or 'unclassified'
        r=by_region.setdefault(region,{'configured':0,'working':0,'mapped_before_dedupe':0,'failed':[]})
        r['configured']+=1
        if feed.get('status')=='ok':r['working']+=1
        else:r['failed'].append(feed.get('source','unknown'))
        r['mapped_before_dedupe']+=int(feed.get('mapped') or 0)
    rows=[{'country_name':n,'explicit_country_label_articles':country_labels.get(n,0),
           'coverage_interpretation':'lower-bound country-name mentions ONLY; excludes city/region matches'} for n in names]
    summary={'schema':1,'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),
      'feed_updated_at':news.get('updated_at'), 'feed_status':news.get('status','unknown'),
      'source_health_updated_at':health.get('updated_at'),
      'mapped_signal_count':len(points),'configured_feed_health_rows':len(feeds),
      'source_region_health':by_region,'country_label_mentions':rows,
      'warnings':[
        'Country-level counts only include explicitly country-labelled signals, not city/region signals.',
        'Zero country-name mentions does not mean a country has no news or no publishers.',
        'Feed editorial region is not the country where an event occurred.',
        'Source URLs in candidate registry were not live-verified by this offline tool.',
      ]}
    DATA.mkdir(parents=True,exist_ok=True)
    (DATA/'coverage-audit.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    with (DATA/'coverage-audit.csv').open('w',encoding='utf-8',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=['country_name','explicit_country_label_articles','coverage_interpretation']);writer.writeheader();writer.writerows(rows)
    print('Coverage audit written:',len(rows),'countries',len(feeds),'feed health records')
    return summary

if __name__=='__main__':audit()
