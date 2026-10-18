import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from publisher_network import merge_feeds
from coverage_expansion import CANDIDATE_FEEDS
class CoverageExtensionTests(unittest.TestCase):
 def test_repeat_merge_is_stable(self):
  items=merge_feeds([])
  self.assertEqual(items,merge_feeds(items))
 def test_no_duplicate_urls(self):
  rows=merge_feeds([])
  self.assertEqual(len(rows),len(set(x[1].rstrip('/').casefold() for x in rows)))
 def test_candidate_shape(self):
  self.assertTrue(all(len(row)==4 and row[1].startswith('https://') for row in CANDIDATE_FEEDS))
if __name__=='__main__':unittest.main()
