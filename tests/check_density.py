from pathlib import Path
s=Path(__file__).resolve().parents[1].joinpath('src/news.js').read_text()
checks={
 'default individual news constellation': "return 0;\n }\n update()" in s,
 'explicit clustered mode preserved': "this.mode==='clustered'" in s,
 'bounded 10px spread': 'const maxShift=10' in s,
 'geographic anchors intact': 'positions.push(...llToXYZ(p.lat,p.lng,1.027))' in s,
 'screen displacement shader': 'aOffset/max(uResolution' in s,
 'screen-space click hit': 'const index=this.screenHit(clientX,clientY)' in s,
 'hover preview retained': 'this.onHover?.(next>=0?this.active[next]:null' in s,
 'hover neighbour fade': 'setHoverDimming(index)' in s,
 'freshness shimmer intact': 'recentReportingStrength(p)' in s,
 'category colours intact': 'NEWS_COLORS[p.category]' in s,
 'front hemisphere filter': 'w.dot(this.camera.position)>=.95' in s,
 'No camera movement code': 'camera.position.set(' not in s and 'camera.lookAt(' not in s,
}
for name,ok in checks.items():print(('PASS' if ok else 'FAIL'),name)
assert all(checks.values())
