"""Run from repository root: python scripts/apply_f1_frontend.py"""
from pathlib import Path
import sys
root=Path(__file__).resolve().parents[1]
main=root/'src/main.js'
module=root/'src/story-clusters.js'
old_import="import {evidenceElement} from './geo-evidence.js';"
new_import=old_import+"\nimport {renderStoryClusters} from './story-clusters.js';"
old_point=" // Group conservatively by normalised headline. Similar but differently"
new_point=" renderStoryClusters(newsFeed,list,news.categories);\n"+old_point
def run():
 if not main.exists() or not module.exists():sys.exit('STOP: src/main.js or src/story-clusters.js missing')
 text=main.read_text(encoding='utf8')
 if new_import in text and new_point in text:print('F.1 frontend already installed');return
 if new_import in text or new_point in text:sys.exit('STOP: Partial frontend patch; no changes made')
 if text.count(old_import)!=1 or text.count(old_point)!=1:sys.exit('STOP: E.4 frontend anchors missing. Send current src/main.js for safe merge.')
 main.write_text(text.replace(old_import,new_import,1).replace(old_point,new_point,1),encoding='utf8')
 print('F.1 frontend installed; commit src/main.js')
if __name__=='__main__':run()
