import json, ssl, time, urllib.request, os
ctx = ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt')
UA = {'User-Agent': 'MellomvalgNature/0.1 (https://frikanalen.no; one-off build of a few images)'}
d = json.load(open('nature/index.json'))
for t, v in d.items():
    if not v.get('src') or v.get('big'): continue
    url = v['src'].replace('/330px-', '/500px-') if '/330px-' in v['src'] else None
    if not url: continue
    for i in range(8):
        try:
            b = urllib.request.urlopen(urllib.request.Request(url, headers=UA), context=ctx, timeout=30).read()
            if b[:1] in (b'<', b'{'): raise Exception('html')
            fn = v['file'] + '.500' + os.path.splitext(url)[1]; open(fn, 'wb').write(b); v['big'] = fn; break
        except urllib.error.HTTPError as e:
            if e.code in (400, 404): break
            time.sleep(3 + 3 * i)
        except Exception: time.sleep(3 + 3 * i)
    time.sleep(0.7)
json.dump(d, open('nature/index.json', 'w'), indent=1)
print(sum(1 for v in d.values() if v.get('big')), 'big of', len(d))
