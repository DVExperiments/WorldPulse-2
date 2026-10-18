"""Country-coverage-focused candidate feeds; endpoints are unverified.

Keep these separate from the existing registry to make testing and rollback easy.
Neither publisher country nor editorial region is an event geolocation.
"""
# label, public feed URL, editorial region (diagnostics only), original language
CANDIDATE_FEEDS = [
 ('RNZ New Zealand','https://www.rnz.co.nz/rss/national.xml','new-zealand','en'),
 ('RNZ Pacific','https://www.rnz.co.nz/rss/pacific.xml','pacific','en'),
 ('ABC Australia Pacific','https://www.abc.net.au/news/feed/51120/rss.xml','oceania','en'),
 ('The Conversation New Zealand','https://theconversation.com/nz/articles.atom','new-zealand','en'),
 ('The Conversation Indonesia','https://theconversation.com/id/articles.atom','indonesia','id'),
 ('The Conversation Africa','https://theconversation.com/africa/articles.atom','africa','en'),
 ('The Conversation Brazil','https://theconversation.com/br/articles.atom','brazil','pt'),
 ('The Conversation France','https://theconversation.com/fr/articles.atom','france','fr'),
 ('The Conversation Spain','https://theconversation.com/es/articles.atom','spain','es'),
 ('The Conversation Canada','https://theconversation.com/ca/articles.atom','canada','en'),
 ('Global Voices English','https://globalvoices.org/feed/','global','en'),
 ('Global Voices Español','https://es.globalvoices.org/feed/','global','es'),
 ('Global Voices Français','https://fr.globalvoices.org/feed/','global','fr'),
 ('Global Voices Português','https://pt.globalvoices.org/feed/','global','pt'),
 ('Global Voices Japanese','https://jp.globalvoices.org/feed/','global','ja'),
 ('Global Voices Arabic','https://ar.globalvoices.org/feed/','global','ar'),
 ('Global Voices Chinese','https://zh.globalvoices.org/feed/','global','zh'),
 ('Mongabay Global','https://news.mongabay.com/feed/','global','en'),
 ('Mongabay Indonesia','https://www.mongabay.co.id/feed/','indonesia','id'),
 ('Mongabay Latin America','https://es.mongabay.com/feed/','latin-america','es'),
 ('Africa Arguments','https://africanarguments.org/feed/','africa','en'),
 ('IPS News','https://www.ipsnews.net/feed/','global','en'),
 ('The Diplomat','https://thediplomat.com/feed/','asia','en'),
 ('Caribbean News Global','https://caribbeannewsglobal.com/feed/','caribbean','en'),
 ('Jamaica Gleaner','https://jamaica-gleaner.com/feed/rss.xml','jamaica','en'),
 ('Fiji Times','https://www.fijitimes.com.fj/feed/','fiji','en'),
 ('Vanuatu Daily Post','https://www.dailypost.vu/search/?f=rss&t=article&c=news','vanuatu','en'),
 ('Solomon Star','https://www.solomonstarnews.com/feed/','solomon-islands','en'),
 ('The Namibian','https://www.namibian.com.na/feed/','namibia','en'),
 ('New Era Namibia','https://neweralive.na/feed/','namibia','en'),
 ('The Kathmandu Post','https://kathmandupost.com/rss','nepal','en'),
 ('The Daily Star Bangladesh','https://www.thedailystar.net/frontpage/rss.xml','bangladesh','en'),
 ('The East African','https://www.theeastafrican.co.ke/tea/rss','east-africa','en'),
 ('Mongolia News Montsame','https://montsame.mn/en/rss','mongolia','en'),
]


# Stage a small additional collection batch by default; the full candidate pool
# is offered for later validation. Increase only after checking feed health.
STAGED_NAMES = {
 'Global Voices English', 'Global Voices Español', 'Global Voices Français',
 'Global Voices Português', 'Mongabay Latin America', 'The Conversation Africa',
 'The Conversation New Zealand', 'RNZ Pacific',
}

def append_candidates(existing):
    """Add candidate feeds without duplicate labels/URLs; preserve order."""
    seen_names = {row[0].casefold() for row in existing}
    seen_urls = {row[1].rstrip('/').casefold() for row in existing}
    out = list(existing)
    import os
    full = os.getenv('WP_EXPAND_ALL_CANDIDATES', '').strip().lower() in ('1','true','yes')
    for row in CANDIDATE_FEEDS:
        if not full and row[0] not in STAGED_NAMES:
            continue
        if row[0].casefold() in seen_names or row[1].rstrip('/').casefold() in seen_urls:
            continue
        out.append(row)
        seen_names.add(row[0].casefold())
        seen_urls.add(row[1].rstrip('/').casefold())
    return out
