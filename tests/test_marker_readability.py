from pathlib import Path
base=Path(__file__).resolve().parents[1]
n=(base/'src/news.js').read_text();m=(base/'src/main.js').read_text()
assert 'sampled<=2?0.43:sampled<=7?0.68:0.94' in n
assert 'uHover' in n and 'hoverAt(clientX,clientY)' in n
assert 'this.dom.addEventListener('pointermove'' in n
assert 'NEWS_COLORS' in n and 'this.onSelect?.(p)' in n
assert 'GLOBE MARKERS' in m and '1–2' in m and '3–7' in m and '8+' in m
assert "glance.hidden=true" in m
print('Six marker-readability regression checks passed')
