"""Build an embedded portrait catalogue and an honest coverage report.

python3 tools/portraits/fetch.py --roster /tmp/civicapi-roster.json
Requires Pillow (Debian/Ubuntu: python3-pil).
Uses Python's normal TLS trust (SSL_CERT_FILE can supply a proxy CA).
Reruns resume from index.json; --retry retries missing biographies/images.
"""
import argparse
import concurrent.futures
import base64
import json
import re
import io
import hashlib
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
UA = {'User-Agent': 'FrikanalenMellomvalg/1.0 (https://frikanalen.no; candidate portraits)'}
LOCK = threading.Lock()
LAST_REQUEST = 0
SUMMARIES = {}
EXTERNAL = {}


def identity(name, title):
    def words(text):
        text = unicodedata.normalize('NFKD', text.split(' (')[0]).encode('ascii', 'ignore').decode()
        return re.findall(r'[a-z]+', text.lower())
    a, b = words(name), words(title or '')
    return bool(a and b and (a == b or (a[-1] == b[-1] and any(w in b for w in a[:-1] if len(w) > 1))))


def photo_url(url):
    return bool(re.search(r'\.(?:jpe?g|png)(?:/|$)', url, re.I) and not re.search(r'\.svg|seal|logo|flag|coat.of.arms|results.map', url, re.I))


def get(url):
    global LAST_REQUEST
    with LOCK:
        time.sleep(max(0, 0.35 - (time.monotonic() - LAST_REQUEST)))
        LAST_REQUEST = time.monotonic()
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
        return r.read(), r.headers.get_content_type()


def encode(data):
    from PIL import Image, ImageOps
    image = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert('RGB')
    image.thumbnail((240, 300))
    out = io.BytesIO()
    image.save(out, format='JPEG', quality=85, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(out.getvalue()).decode()


def titles(c, state):
    return (c['name'], c['name'] + ' (' + state + ' politician)', c['name'] + ' (American politician)', c['name'] + ' (politician)')


def prefetch(jobs):
    """Twenty biographies per request instead of four requests per person."""
    state_names = dict(re.findall(r"([A-Z]{2}): '([^']+)'", (ROOT / 'src/data.ts').read_text()))
    wanted = list(dict.fromkeys(t for _, c in jobs if not c['bioguide'] for t in titles(c, state_names[c['state']])))
    cache_path = HERE / 'summaries.json'
    cached = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    wanted = [t for t in wanted if t not in cached]
    for offset in range(0, len(wanted), 20):
        batch = wanted[offset:offset + 20]
        params = dict(action='query', format='json', prop='pageimages|extracts|pageprops',
                      piprop='thumbnail', pithumbsize=240, exintro=1, explaintext=1,
                      exlimit='max', redirects=1, titles='|'.join(batch))
        try:
            raw, _ = get('https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode(params))
            query = json.loads(raw)['query']
            aliases = {a['from']: a['to'] for a in query.get('normalized', []) + query.get('redirects', [])}
            pages = {p['title']: p for p in query['pages'].values()}
            for t in batch:
                target = t
                visited = set()
                while target in aliases and target not in visited:
                    visited.add(target)
                    target = aliases[target]
                p = pages.get(target, {})
                cached[t] = dict(type='standard' if p.get('ns') == 0 and 'missing' not in p and 'disambiguation' not in p.get('pageprops', {}) else 'missing',
                                 title=p.get('title'), extract=p.get('extract', ''), thumbnail=p.get('thumbnail', {}),
                                 content_urls={'desktop': {'page': 'https://en.wikipedia.org/wiki/' + urllib.parse.quote(target.replace(' ', '_'))}})
            cache_path.write_text(json.dumps(cached, ensure_ascii=False))
            print('Biographies', min(offset + 20, len(wanted)), '/', len(wanted), flush=True)
        except Exception as e:
            print('Biography batch failed:', e, flush=True)
            # Do not multiply a rate limit into hundreds of individual retries.
            break
    SUMMARIES.update(cached)


def roster(core):
    people = {}
    # civicAPI rosters are produced by tools/civicapi/roster.mjs with the app's parser.
    if isinstance(core.get('races'), dict):
        for kind, races in core['races'].items():
            for race in races:
                state = race['id'][:2]
                for c in race.get('candidates', {}).values():
                    if c:
                        key = c['name'] + '|' + state
                        entry = people.setdefault(key, dict(name=c['name'], state=state, bioguide='', races=[]))
                        entry['races'].append(kind + '-' + race['id'])
    # Keep support for historical People's Tally snapshots used by earlier audits.
    for line in (core.get('races', '') if isinstance(core.get('races'), str) else '').splitlines():
        fields = line.split('|')
        if len(fields) < 6 or fields[0] not in ('S', 'G', 'H'):
            continue
        candidates = []
        for raw in '|'.join(fields[5:]).split(';'):
            m = re.match(r'^([A-Z]+)(!?):(.*)$', raw.strip())
            if not m or m[2]:
                continue
            name, _, meta = m[3].partition('#')
            bio = (meta.split('~') + [''] * 4)[3]
            candidates.append(dict(name=re.sub(r'\s\*$', '', name).strip(), party=m[1],
                                   bioguide=bio, rank=(2 if name.endswith(' *') else 0) + bool(bio)))
        def best(predicate):
            return next(iter(sorted(filter(predicate, candidates), key=lambda c: -c['rank'])), None)
        d = best(lambda c: c['party'] == 'D') or best(lambda c: c['party'] == 'I') or best(lambda c: c['party'] != 'R')
        r = best(lambda c: c['party'] == 'R') or best(lambda c: c is not d)
        d = d or best(lambda c: c is not r)
        for c in (d, r):
            if c:
                key = c['name'] + '|' + fields[1][:2]
                entry = people.setdefault(key, {**c, 'state': fields[1][:2], 'races': []})
                entry['races'].append(fields[0] + '-' + fields[1])
    # Also cover the offline statewide nominees, including names superseded by the feed.
    seeds = json.loads((ROOT / 'src/candidates.json').read_text())
    for kind in ('sen', 'gov'):
        for state, pair in seeds[kind].items():
            for name in pair.values():
                if name:
                    people.setdefault(name + '|' + state, dict(name=name, state=state, bioguide='', races=['offline-' + kind + '-' + state]))
    return people


def fetch_person(item):
    key, c = item
    errors = []
    if key in EXTERNAL:
        source = EXTERNAL[key]
        try:
            from PIL import Image, ImageOps
            data, _ = get(source['image'])
            if hashlib.sha256(data).hexdigest() != source['sha256']:
                raise ValueError('Reviewed source image changed; review required')
            image = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert('RGB')
            out = io.BytesIO()
            image.crop(source['crop']).save(out, format='JPEG', quality=90)
            return key, dict(**source, uri=encode(out.getvalue()), reviewed=True)
        except Exception as e:
            errors.append(str(e))
    if c['bioguide']:
        url = 'https://bioguide.congress.gov/photo/' + c['bioguide'] + '.jpg'
        try:
            data, mime = get(url)
            if data.startswith(b'\xff\xd8'):
                return key, dict(uri=encode(data), source=url, credit='U.S. Congress')
        except Exception as e:
            errors.append(str(e))
    state_names = dict(re.findall(r"([A-Z]{2}): '([^']+)'", (ROOT / 'src/data.ts').read_text()))
    state = state_names[c['state']]
    for title in titles(c, state):
        try:
            summary = SUMMARIES.get(title, {})
            image = summary.get('thumbnail', {}).get('source', '').split('?')[0]
            text = summary.get('extract', '')
            # Reject disambiguation, drawings, namesakes, and nonpolitical biographies.
            if summary.get('type') != 'standard' or not photo_url(image) or not identity(c['name'], summary.get('title')):
                continue
            if not re.search(r'politic|candidate|senator|governor|representative|congress|attorney|commissioner|mayor', text, re.I):
                continue
            if state not in text and title != c['name']:
                continue
            if state not in text and not re.search(r'American.*(?:politic|candidate|senator|governor|representative)', text, re.I):
                continue
            data, mime = get(image)
            if not (data.startswith(b'\xff\xd8') or data.startswith(b'\x89PNG')):
                continue
            return key, dict(uri=encode(data),
                             source=summary['content_urls']['desktop']['page'], image=image,
                             credit='Wikipedia / Wikimedia Commons', extract=text)
        except urllib.error.HTTPError as e:
            if e.code != 404:
                errors.append(str(e))
        except Exception as e:
            errors.append(str(e))
    return key, dict(missing=True, errors=sorted(set(errors)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--roster', help='civicAPI roster from tools/civicapi/roster.mjs')
    source.add_argument('--core', help='legacy People\'s Tally core snapshot')
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--retry', action='store_true')
    parser.add_argument('--legislators', help='congress-legislators JSON directory for missing bioguide IDs')
    args = parser.parse_args()
    core = json.loads(Path(args.roster or args.core).read_text())
    people = roster(core)
    external_path = HERE / 'campaign-sources.json'
    if external_path.exists():
        EXTERNAL.update(json.loads(external_path.read_text()))
    if args.legislators:
        def normal(name):
            return re.sub(r'[^a-z]', '', name.lower())
        for legislator in json.loads(Path(args.legislators).read_text()):
            names = legislator['name']
            aliases = {normal(names.get('official_full', '')), normal(names.get('nickname', names['first']) + ' ' + names['last']), normal(names['first'] + ' ' + names['last'])}
            aliases.add(normal(legislator['id'].get('wikipedia', '').split(' (')[0]))
            for c in people.values():
                if c['state'] == legislator['terms'][-1]['state'] and normal(c['name']) in aliases:
                    c['bioguide'] = legislator['id']['bioguide']
    path = HERE / 'index.json'
    index = json.loads(path.read_text()) if path.exists() else {}
    for key, entry in list(index.items()):
        if entry.get('image') and not entry.get('reviewed') and (not photo_url(entry['image']) or not identity(key.split('|')[0], urllib.parse.unquote(entry['source'].split('/wiki/')[-1]).replace('_', ' '))):
            index[key] = dict(missing=True, errors=['Rejected nonportrait or unrelated article'])
    jobs = [(k, c) for k, c in people.items() if k not in index or (args.retry and index[k].get('missing'))]
    prefetch(jobs)
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        for n, (key, result) in enumerate(pool.map(fetch_person, jobs), 1):
            index[key] = result
            temporary = path.with_suffix('.tmp')
            temporary.write_text(json.dumps(index, ensure_ascii=False))
            temporary.replace(path)
            print(n, '/', len(jobs), key, 'MISSING' if result.get('missing') else 'OK', flush=True)
    catalogue = {k: {'uri': encode(base64.b64decode(v['uri'].split(',')[1])), 'source': v['source'], 'credit': v['credit']} for k, v in index.items() if k in people and v.get('uri')}
    (ROOT / 'src/portrait-catalogue.json').write_text(json.dumps(catalogue, ensure_ascii=False))
    current = {k: c for k, c in people.items() if any(not r.startswith('offline-') for r in c['races'])}
    websites_path = HERE / 'campaign-websites.json'
    websites = json.loads(websites_path.read_text()) if websites_path.exists() else {}
    attempts = []
    for filename in ('campaign-proposals.json', 'profile-proposals.json', 'campaign-hint-proposals.json'):
        attempt_path = HERE / filename
        if attempt_path.exists():
            attempts.append(json.loads(attempt_path.read_text()))
    def missing_entry(key, candidate):
        errors = list(index.get(key, {}).get('errors', []))
        checked = []
        if key in websites:
            checked.append(websites[key]['url'])
        for attempt in attempts:
            record = attempt.get(key, {})
            errors.extend(record.get('errors', []))
            checked.extend(option['source'] for option in record.get('options', []))
        errors = ['Source did not provide a decodable image' if 'cannot identify image file' in e else e for e in errors]
        return dict(key=key, name=candidate['name'], state=candidate['state'], races=candidate['races'],
                    checkedSources=list(dict.fromkeys(checked)),
                    errors=list(dict.fromkeys(errors)) or ['No usable verified portrait found from the checked sources'])
    report = {'source': core.get('source', 'https://thepeoplestally.com/data/core.json'), 'rosterUpdated': core.get('updated'),
              'total': len(people), 'available': len(catalogue),
              'currentFeed': {'total': len(current), 'available': sum(k in catalogue for k in current)},
              'missing': [missing_entry(k, c) for k, c in people.items() if k not in catalogue]}
    (HERE / 'coverage.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print('Portraits:', len(catalogue), '/', len(people), flush=True)


if __name__ == '__main__':
    main()
