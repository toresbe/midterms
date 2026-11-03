"""Collect named public BallotReady headshots, with matching state context.

Produces proposals for the same visual-review workflow as campaigns.py.
"""
import concurrent.futures
import hashlib
import json
import re
import unicodedata
from pathlib import Path
import campaigns as c
from bs4 import BeautifulSoup


def plain(name):
    name = re.sub(r'\s+(?:Jr\.?|Sr\.?|II|III|IV)$', '', name, flags=re.I)
    return unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode()


def collect(person):
    key, name = person['key'], person['name']
    slug = re.sub(r'[^a-z0-9]+', '-', plain(name).lower()).strip('-')
    slugs = [slug]
    aliases = {'mike': 'michael', 'tom': 'thomas', 'dan': 'daniel', 'pam': 'pamela', 'jim': 'james', 'bob': 'robert', 'rick': 'richard', 'nikki': 'nicole', 'chris': 'christopher', 'vic': 'victor'}
    first, _, rest = slug.partition('-')
    if first in aliases:
        slugs.append(aliases[first] + '-' + rest)
    errors = []
    for slug in slugs:
        source = 'https://www.ballotready.org/people/' + slug
        try:
            html = c.cached_get(source)
            soup = BeautifulSoup(html, 'html.parser')
            header = soup.find('h1')
            title = header.get_text(' ', strip=True) if header else ''
            # The candidate's name and state must both match the profile.
            if not c.base.identity(plain(name), plain(title)):
                errors.append('Profile name mismatch: ' + title)
                continue
            text = soup.get_text(' ', strip=True)
            intro = text[text.find(title):][:900]
            if c.STATES[person['state']] not in intro:
                errors.append('No matching state in profile introduction')
                continue
            for image in soup.find_all('img'):
                url = image.get('src', '')
                if not ('assets.civicengine.com/' in url and '/headshot/' in url and image.get('alt', '').lower().startswith('headshot')):
                    continue
                given = re.findall(r"[a-z']+", plain(title).lower())[0]
                if given not in re.findall(r"[a-z']+", plain(image.get('alt', '')).lower()):
                    continue
                original = c.cached_get(url)
                result = c.detect(original)
                if not result:
                    errors.append('Headshot has no unambiguous single face')
                    continue
                data, crop, size = result
                token = hashlib.sha256((key + url).encode()).hexdigest()[:16]
                (c.CACHE / (token + '.jpg')).write_bytes(data)
                return key, dict(options=[dict(file=token + '.jpg', source=source, image=url,
                    label=title + ' — ' + intro[:300], weight=100, crop=crop, originalSize=size,
                    sha256=hashlib.sha256(original).hexdigest(), credit='BallotReady')], errors=[])
        except Exception as e:
            errors.append(str(e)[:160])
    return key, dict(options=[], errors=errors)


def main():
    report = c.read(c.HERE / 'coverage.json')
    reviewed = c.read(c.HERE / 'campaign-reviewed.json')
    campaigns = c.read(c.HERE / 'campaign-proposals.json')
    path = c.HERE / 'profile-proposals.json'
    profiles = c.read(path)
    people = [p for p in report['missing'] if p['key'] not in profiles and
        (p['key'] not in campaigns or not campaigns[p['key']]['options'] or (p['key'] in reviewed and reviewed[p['key']] is None))]
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        futures = [pool.submit(collect, p) for p in people]
        for n, future in enumerate(concurrent.futures.as_completed(futures), 1):
            key, result = future.result()
            profiles[key] = result
            c.save(path, profiles)
            print(n, '/', len(people), key, len(result['options']), 'profile proposals', flush=True)


if __name__ == '__main__':
    main()
