"""Discover campaign websites and collect portrait proposals for visual review.

PYTHONPATH=/tmp/midterms-portrait-python python3 tools/portraits/campaigns.py
Requires beautifulsoup4, Pillow, numpy and opencv-python-headless. Only reviewed
proposals are imported into the bundled catalogue, using --approve FILE.
"""
import argparse
import concurrent.futures
import hashlib
import io
import json
import os
import re
import time
import urllib.parse
from pathlib import Path

import fetch as base
from bs4 import BeautifulSoup
from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parent
CACHE = HERE / 'campaign-cache'
CACHE.mkdir(exist_ok=True)
STATES = dict(re.findall(r"([A-Z]{2}): '([^']+)'", (base.ROOT / 'src/data.ts').read_text()))


def save(path, data):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def read(path):
    return json.loads(path.read_text()) if path.exists() else {}


def discovery(missing):
    campaigns = read(HERE / 'campaign-websites.json')
    campaigns.update(read(HERE / 'campaign-extra-websites.json'))
    articles = {}
    for c in missing:
        state = STATES[c['state']]
        for race in c['races']:
            if race.startswith('S-') or race.startswith('offline-sen-'):
                titles = [f'2026 United States Senate election in {state}']
            elif race.startswith('G-') or race.startswith('offline-gov-'):
                titles = [f'2026 {state} gubernatorial election']
            else:
                titles = [f'2026 United States House of Representatives elections in {state}']
                if state == 'California':
                    titles += [titles[0] + ' (districts 1–26)', titles[0] + ' (districts 27–52)']
            for title in titles:
                articles.setdefault(title, []).append(c)
    titles = list(articles)
    for offset in range(0, len(titles), 15):
        batch = titles[offset:offset + 15]
        token = hashlib.sha256('|'.join(batch).encode()).hexdigest()[:12]
        path = CACHE / ('wiki-' + token + '.json')
        if path.exists():
            query = json.loads(path.read_text())
        else:
            params = dict(action='query', format='json', prop='revisions', rvprop='content', rvslots='main', titles='|'.join(batch), redirects=1)
            raw, _ = base.get('https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode(params))
            query = json.loads(raw)['query']
            save(path, query)
        aliases = {a['from']: a['to'] for a in query.get('normalized', []) + query.get('redirects', [])}
        pages = {p['title']: p for p in query['pages'].values()}
        for title in batch:
            target = aliases.get(title, title)
            p = pages.get(target, {})
            text = p.get('revisions', [{}])[0].get('slots', {}).get('main', {}).get('*', '')
            sections = re.split(r'==\s*External links\s*==', text, flags=re.I)
            if len(sections) < 2:
                continue
            external = sections[-1]
            for url, label in re.findall(r'\[(https?://[^\s\]]+)\s+([^\]\n]+)\]', external):
                for c in articles[title]:
                    if base.identity(c['name'], re.sub(r'<[^>]+>', '', label).split(' for ')[0]):
                        campaigns.setdefault(c['key'], dict(url=url, label=label,
                            evidence='https://en.wikipedia.org/wiki/' + urllib.parse.quote(target.replace(' ', '_'))))
        save(HERE / 'campaign-websites.json', campaigns)
        print('Campaign links:', len(campaigns), 'after', min(offset + 15, len(titles)), '/', len(titles), 'election pages', flush=True)
    return campaigns


def cached_get(url):
    token = hashlib.sha256(url.encode()).hexdigest()
    path = CACHE / token
    if path.exists():
        return path.read_bytes()
    data, _ = base.get(url)
    if len(data) > 20_000_000:
        raise ValueError('Image/page too large')
    path.write_bytes(data)
    return data


def image_options(html, page, name):
    soup = BeautifulSoup(html, 'html.parser')
    choices = {}
    words = re.findall(r'[a-z]+', name.lower())
    def add(url, label, weight):
        if not url or url.startswith('data:'):
            return
        url = urllib.parse.urljoin(page, url.replace('&amp;', '&'))
        if not url.startswith(('https://', 'http://')):
            return
        text = (urllib.parse.unquote(url) + ' ' + label).lower()
        if re.search(r'logo|favicon|sprite|icon|\.svg|seal|placeholder|donat|actblue|winred|pixel|tracker|endorsement', text):
            return
        weight += 12 * sum(w in text for w in words if len(w) > 2)
        weight += 8 * bool(re.search(r'headshot|portrait|candidate|hero|about|meet', text))
        choices[url] = max(choices.get(url, (0, '')), (weight, label))
    for tag in soup.select('meta[property="og:image"], meta[name="twitter:image"], meta[property="twitter:image"]'):
        add(tag.get('content'), 'social sharing image', 15)
    for img in soup.find_all('img'):
        label = ' '.join([img.get('alt', ''), img.get('title', ''), ' '.join(img.get('class', []))])
        add(img.get('data-src') or img.get('data-orig-src') or img.get('src'), label, 5)
        for item in (img.get('srcset') or img.get('data-srcset') or '').split(','):
            if item.strip():
                add(item.strip().split()[0], label, 4)
    for video in soup.find_all('video'):
        add(video.get('poster'), 'video poster', 6)
    for picture in soup.find_all('picture'):
        label = picture.img.get('alt', '') if picture.img else ''
        for source in picture.find_all('source', srcset=True):
            # The final token is a width/density descriptor, not part of the URL.
            item = source['srcset'].strip().split()[-2:]
            if item:
                add(item[0].rstrip(','), label, 7)
    for element in soup.select('[style]'):
        for url in re.findall(r'url\([\"\']?([^\)\"\']+)', element['style']):
            add(url, 'background image', 3)
    for url in re.findall(r'url\([\"\']?([^\)\"\']+)', html):
        add(url, 'background image', 3)
    about = []
    for link in soup.find_all('a', href=True):
        label = link.get_text(' ', strip=True)
        url = urllib.parse.urljoin(page, link['href'])
        if urllib.parse.urlparse(url).netloc == urllib.parse.urlparse(page).netloc and re.search(r'\babout\b|\bmeet\b|\bbiography\b|\bour story\b', label, re.I):
            if url.rstrip('/') != page.rstrip('/') and url not in about:
                about.append(url)
    return sorted([(url, weight, label) for url, (weight, label) in choices.items()], key=lambda x: -x[1]), about[:2]


def detect(data):
    import cv2
    import numpy as np
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert('RGB')
    if im.width < 100 or im.height < 100:
        return None
    small = im.copy()
    small.thumbnail((800, 800))
    cv2.setNumThreads(1)
    model = os.environ.get('PORTRAIT_FACE_MODEL')
    if model:
        detector = cv2.FaceDetectorYN_create(model, '', small.size, 0.9)
        _, detected = detector.detect(cv2.cvtColor(np.array(small), cv2.COLOR_RGB2BGR))
        faces = [] if detected is None else [f[:4] for f in detected if min(f[2:4]) >= 30]
    else:
        gray = cv2.cvtColor(np.array(small), cv2.COLOR_RGB2GRAY)
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6, minSize=(35, 35))
    if len(faces) != 1:
        return None
    x, y, w, h = [float(v) * im.width / small.width for v in faces[0]]
    # Keep face and shoulders; preserve proportions and clamp to the source.
    width = min(im.width, 2.8 * w)
    height = min(im.height, width * 1.25)
    width = height / 1.25
    left = max(0, min(im.width - width, x + w / 2 - width / 2))
    top = max(0, min(im.height - height, y - 0.55 * h))
    box = [round(left), round(top), round(left + width), round(top + height)]
    out = io.BytesIO()
    im.crop(box).save(out, format='JPEG', quality=90)
    return out.getvalue(), box, [im.width, im.height]


def propose(item):
    key, campaign = item
    errors = []
    urls = [campaign['url']]
    tried_images = set()
    options = []
    for page in urls:
        try:
            html = cached_get(page).decode('utf-8', errors='replace')
            images, about = image_options(html, page, key.split('|')[0])
            if len(urls) == 1:
                urls.extend(about)
            for image, weight, label in images[:8]:
                if image in tried_images:
                    continue
                tried_images.add(image)
                try:
                    original = cached_get(image)
                    result = detect(original)
                    if not result:
                        continue
                    data, crop, size = result
                    token = hashlib.sha256((key + image).encode()).hexdigest()[:16]
                    file = CACHE / (token + '.jpg')
                    file.write_bytes(data)
                    options.append(dict(file=file.name, source=page, image=image, label=label, weight=weight,
                                        crop=crop, originalSize=size, sha256=hashlib.sha256(original).hexdigest(), credit=campaign.get('credit', 'Kandidatens valgkampanje')))
                    # Inspect proposals before importing; a face detector cannot verify identity.
                    if len(options) >= 1:
                        return key, dict(options=options, errors=errors)
                except Exception as e:
                    errors.append(str(e)[:150])
        except Exception as e:
            errors.append(str(e)[:150])
    return key, dict(options=options, errors=list(dict.fromkeys(errors)))


def import_approved(path):
    approved = read(path)
    proposals = read(HERE / 'campaign-proposals.json')
    sources = read(HERE / 'campaign-sources.json')
    index = read(HERE / 'index.json')
    for key, choice in approved.items():
        if choice is None:
            continue
        option = proposals[key]['options'][choice]
        if 'sha256' not in option:
            option['sha256'] = hashlib.sha256(cached_get(option['image'])).hexdigest()
        sources[key] = {k: v for k, v in option.items() if k not in ('file', 'weight')}
        index[key] = {**sources[key], 'uri': base.encode((CACHE / option['file']).read_bytes()), 'reviewed': True}
    save(HERE / 'campaign-sources.json', sources)
    save(HERE / 'index.json', index)
    print('Reviewed campaign portraits:', len(sources))


def collect_hints(path):
    """Explicit source-page/image pairs found by research; still require review."""
    proposals = read(HERE / 'campaign-hint-proposals.json')
    def one(item):
        key, hints = item
        errors = []
        for hint in hints:
            try:
                original = cached_get(hint['image'])
                if 'crop' in hint:
                    # Explicit crops are supplied only after viewing the source.
                    im = ImageOps.exif_transpose(Image.open(io.BytesIO(original))).convert('RGB')
                    box = hint['crop']
                    if not (0 <= box[0] < box[2] <= im.width and 0 <= box[1] < box[3] <= im.height):
                        raise ValueError('Reviewed crop is outside the source image')
                    out = io.BytesIO()
                    im.crop(box).save(out, format='JPEG', quality=90)
                    result = out.getvalue(), box, list(im.size)
                else:
                    result = detect(original)
                if not result:
                    errors.append('No unambiguous single face')
                    continue
                data, crop, size = result
                token = hashlib.sha256((key + hint['image']).encode()).hexdigest()[:16]
                (CACHE / (token + '.jpg')).write_bytes(data)
                return key, dict(options=[{**hint, 'file': token + '.jpg', 'weight': 100,
                    'crop': crop, 'originalSize': size, 'sha256': hashlib.sha256(original).hexdigest()}], errors=[])
            except Exception as e:
                errors.append(str(e))
        return key, dict(options=[], errors=errors)
    jobs = [(key, hints) for key, hints in read(path).items() if not proposals.get(key, {}).get('options')]
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        futures = [pool.submit(one, item) for item in jobs]
        for future in concurrent.futures.as_completed(futures):
            key, result = future.result()
            proposals[key] = result
            save(HERE / 'campaign-hint-proposals.json', proposals)
            print(key, len(result['options']), 'researched photo proposals', flush=True)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--workers', type=int, default=8)
    p.add_argument('--discover-only', action='store_true')
    p.add_argument('--retry', action='store_true')
    p.add_argument('--max-jobs', type=int, default=64)
    p.add_argument('--keys', type=Path, help='Limit collection to these candidate keys')
    p.add_argument('--approve', type=Path)
    p.add_argument('--hints', type=Path)
    args = p.parse_args()
    if args.approve:
        import_approved(args.approve)
        return
    if args.hints:
        collect_hints(args.hints)
        return
    missing = read(HERE / 'coverage.json')['missing']
    campaigns = discovery(missing)
    if args.discover_only:
        return
    proposals = read(HERE / 'campaign-proposals.json')
    selected = set(read(args.keys)) if args.keys else None
    jobs = [(c['key'], campaigns[c['key']]) for c in missing if c['key'] in campaigns and
            (selected is None or c['key'] in selected) and
            (c['key'] not in proposals or (args.retry and not proposals[c['key']]['options']) or selected is not None)]
    jobs = jobs[:args.max_jobs]
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(propose, job) for job in jobs]
        for n, future in enumerate(concurrent.futures.as_completed(futures), 1):
            key, proposal = future.result()
            proposals[key] = proposal
            save(HERE / 'campaign-proposals.json', proposals)
            print(n, '/', len(jobs), key, len(proposal['options']), 'portrait proposals', flush=True)


if __name__ == '__main__':
    main()
