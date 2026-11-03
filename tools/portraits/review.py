"""Render numbered campaign portrait proposals for visual inspection."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw
HERE = Path(__file__).resolve().parent
p = argparse.ArgumentParser()
p.add_argument('--start', type=int, default=0)
p.add_argument('--count', type=int, default=24)
p.add_argument('--output', default='/tmp/midterms-campaign-review.jpg')
p.add_argument('--unreviewed', action='store_true')
p.add_argument('--proposals', default='campaign-proposals.json')
a = p.parse_args()
proposals = json.loads((HERE / a.proposals).read_text())
keys = [c['key'] for c in json.loads((HERE / 'coverage.json').read_text())['missing'] if c['key'] in proposals and proposals[c['key']]['options']]
if a.unreviewed:
 reviewed = json.loads((HERE / 'campaign-reviewed.json').read_text()) if (HERE / 'campaign-reviewed.json').exists() else {}
 profiles = json.loads((HERE / 'profile-reviewed.json').read_text()) if (HERE / 'profile-reviewed.json').exists() else {}
 reviewed.update({key: value for key, value in profiles.items() if value is not None})
 keys = [key for key in keys if key not in reviewed]
keys = keys[a.start:a.start+a.count]
Path('/tmp/midterms-review-keys.json').write_text(json.dumps(keys))
out = Image.new('RGB', (1040, ((len(keys)+3)//4)*190), 'white')
draw = ImageDraw.Draw(out)
for n, key in enumerate(keys, a.start):
 left, top = (n-a.start)%4*260, (n-a.start)//4*190
 for i, option in enumerate(proposals[key]['options']):
  im = Image.open(HERE / 'campaign-cache' / option['file'])
  im.thumbnail((125,150))
  out.paste(im,(left+i*130,top))
  draw.text((left+i*130,top+151),f'{n}:{i}',fill='black')
 draw.text((left,top+170),key[:36],fill='black')
out.save(a.output)
print(a.output)
print('\n'.join(f'{n}: {key}' for n,key in enumerate(keys,a.start)))
