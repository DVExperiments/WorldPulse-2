"""Opt-in candidate independent RSS sources for WorldPulse.

Candidates are best-effort, NOT verified working feeds. Do not infer a story location
from the publisher's region; source_region is only for collection diagnostics.
Only public headlines, timestamps, and source links are used.
"""
NEW_FEEDS = [
 # (feed label, URL, editorial geography, original feed language)
 ('Global Voices English','https://globalvoices.org/feed/','global','en'),
 ('Global Voices Spanish','https://es.globalvoices.org/feed/','global','es'),
 ('Global Voices Portuguese','https://pt.globalvoices.org/feed/','global','pt'),
 ('Global Voices French','https://fr.globalvoices.org/feed/','global','fr'),
 ('Mongabay Global','https://news.mongabay.com/feed/','global','en'),
 ('Mongabay Indonesia','https://www.mongabay.co.id/feed/','asia','id'),
 ('Africa Arguments','https://africanarguments.org/feed/','africa','en'),
 ('The Conversation Africa','https://theconversation.com/africa/articles.atom','africa','en'),
 ('The Conversation Indonesia','https://theconversation.com/id/articles.atom','asia','id'),
 ('The Diplomat','https://thediplomat.com/feed/','asia','en'),
 ('The Conversation France','https://theconversation.com/fr/articles.atom','europe','fr'),
 ('The Conversation España','https://theconversation.com/es/articles.atom','europe','es'),
 ('The Conversation Brasil','https://theconversation.com/br/articles.atom','south-america','pt'),
 ('The Conversation NZ','https://theconversation.com/nz/articles.atom','oceania','en'),
 ('The Conversation Canada','https://theconversation.com/ca/articles.atom','north-america','en'),
 ('RNZ Pacific News','https://www.rnz.co.nz/rss/pacific.xml','oceania','en'),
 ('Mongabay Latam','https://es.mongabay.com/feed/','south-america','es'),
 ('Inter Press Service Headlines','https://www.ipsnews.net/feed/','global','en'),
]

from coverage_expansion import append_candidates

def merge_feeds(current):
    names={row[0].casefold() for row in current}
    urls={row[1].rstrip('/') for row in current}
    merged=list(current)
    for record in NEW_FEEDS:
        if record[0].casefold() in names or record[1].rstrip('/') in urls:
            continue
        merged.append(record)
        names.add(record[0].casefold())
        urls.add(record[1].rstrip('/'))
    return append_candidates(merged)
