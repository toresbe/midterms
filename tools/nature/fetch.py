import json, ssl, sys, time, urllib.request, urllib.parse, os
_ca = '/root/.ccr/ca-bundle.crt'
ctx = ssl.create_default_context(cafile=_ca if os.path.exists(_ca) else None)
UA = {'User-Agent': 'MellomvalgNature/0.1 (https://frikanalen.no; one-off build of a few images)'}
titles = json.load(open(sys.argv[1])); out_path = sys.argv[2]
out = json.load(open(out_path)) if os.path.exists(out_path) else {}
def get(url, raw=False):
    for i in range(12):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), context=ctx, timeout=30) as r:
                b = r.read()
                if not raw and b[:1] != b'{': raise Exception('not json')
                return b if raw else json.loads(b)
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
            time.sleep(4 + i * 3)
        except Exception as e:
            time.sleep(4 + i * 3)
    raise Exception('gave up ' + url)
uniq = sorted({t for pair in titles.values() for t in pair})
for t in uniq:
    if t in out and out[t].get('file'): continue
    s = get('https://en.wikipedia.org/api/rest_v1/page/summary/' + urllib.parse.quote(t.replace(' ', '_'), safe="()'"))
    if not s or 'thumbnail' not in s: print('NO', t); out[t] = {}; continue
    src = s['thumbnail']['source'].split('?')[0]
    img = get(src, raw=True)
    fn = 'nature/' + urllib.parse.quote(t, safe='') + os.path.splitext(src)[1]
    open(fn, 'wb').write(img)
    out[t] = {'title': s.get('title'), 'desc': s.get('description'), 'src': src, 'file': fn, 'orig': s.get('originalimage', {}).get('source')}
    json.dump(out, open(out_path, 'w'), indent=1)
    print('ok', t, len(img)); sys.stdout.flush()
    time.sleep(1.5)
json.dump(out, open(out_path, 'w'), indent=1)
