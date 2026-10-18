from pathlib import Path
import math
s=Path(__file__).resolve().parents[1].joinpath('src/news.js').read_text()
assert "const sampled=Math.max(1,Number.isFinite(p.count)?p.count:1);" in s
assert "Math.min(0.27,0.085*Math.log2(sampled))" in s
assert "Math.min(0.88,0.52+coverageCue+clusterCue)" in s
assert "NEWS_COLORS[p.category]" in s
assert "this.onSelect?.(p)" in s
assert "max(1.0,-v.z),2.2,12.0)" in s
sizes=[min(.88,.52+min(.27,.085*math.log2(n))) for n in (1,2,4,8,16,40,300)]
assert all(x<=y for x,y in zip(sizes,sizes[1:]))
assert sizes[0]>=.50 and sizes[-1]<=.88
print('Marker sizing regression checks: passed')
