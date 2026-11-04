"""Regression checks for source identity and reviewed image fingerprints."""
import base64
import hashlib
import io
import unittest
from unittest.mock import patch

from PIL import Image
import fetch
import campaigns
import profiles


def jpeg():
    data = io.BytesIO()
    Image.new('RGB', (40, 60), 'gray').save(data, format='JPEG')
    return data.getvalue()


class SourceChecks(unittest.TestCase):
    def test_civic_roster_uses_displayed_candidates_and_deduplicates_by_state(self):
        data = {'races': {'huset': [
            {'id': 'AK-1', 'candidates': {'D': None, 'R': {'name': 'Roster Test Person'}}},
        ], 'senat': [
            {'id': 'AK', 'candidates': {'D': {'name': 'Roster Test Person'}, 'R': None}},
            {'id': 'AL', 'candidates': {'D': {'name': 'Roster Test Person'}, 'R': None}},
        ]}}
        people = fetch.roster(data)
        self.assertEqual(people['Roster Test Person|AK']['races'], ['huset-AK-1', 'senat-AK'])
        self.assertEqual(people['Roster Test Person|AL']['state'], 'AL')
        self.assertEqual(people['Roster Test Person|AK']['bioguide'], '')

    def test_reviewed_source_reproduces_crop_and_attribution(self):
        data = jpeg()
        source = dict(source='https://campaign.example/about', image='https://campaign.example/portrait.jpg',
                      crop=[5, 10, 35, 50], sha256=hashlib.sha256(data).hexdigest(), credit='Campaign')
        with patch.dict(fetch.EXTERNAL, {'Test Person|CA': source}, clear=True), patch.object(fetch, 'get', return_value=(data, 'image/jpeg')):
            key, result = fetch.fetch_person(('Test Person|CA', dict(name='Test Person', state='CA', bioguide='')))
        self.assertEqual(key, 'Test Person|CA')
        self.assertTrue(result['reviewed'])
        self.assertEqual(result['source'], source['source'])
        self.assertEqual(result['credit'], source['credit'])
        image = Image.open(io.BytesIO(base64.b64decode(result['uri'].split(',')[1])))
        self.assertEqual(image.size, (30, 40))

    def test_changed_source_cannot_silently_replace_reviewed_person(self):
        source = dict(image='https://campaign.example/portrait.jpg', sha256='old-image-hash')
        with patch.dict(fetch.EXTERNAL, {'Test Person|CA': source}, clear=True), patch.dict(fetch.SUMMARIES, {}, clear=True), patch.object(fetch, 'get', return_value=(jpeg(), 'image/jpeg')):
            _, result = fetch.fetch_person(('Test Person|CA', dict(name='Test Person', state='CA', bioguide='')))
        self.assertTrue(result['missing'])
        self.assertIn('Reviewed source image changed; review required', result['errors'])

    def profile(self, title, state, alt='Headshot of Test'):
        return f'<h1>{title}</h1><p>Candidate for Congress in {state}.</p><img alt="{alt}" src="https://assets.civicengine.com/uploads/candidate/headshot/123/photo.jpg">'.encode()

    def test_profile_rejects_namesake_from_other_state(self):
        with patch.object(campaigns, 'cached_get', return_value=self.profile('Test Person', 'Texas')) as get:
            _, result = profiles.collect(dict(key='Test Person|CA', name='Test Person', state='CA'))
        self.assertFalse(result['options'])
        self.assertEqual(get.call_count, 1, 'No photo should be fetched from the wrong profile')

    def test_profile_rejects_another_persons_headshot(self):
        with patch.object(campaigns, 'cached_get', return_value=self.profile('Test Person', 'California', 'Headshot of Opponent')) as get:
            _, result = profiles.collect(dict(key='Test Person|CA', name='Test Person', state='CA'))
        self.assertFalse(result['options'])
        self.assertEqual(get.call_count, 1)

    def test_profile_accepts_matching_named_headshot(self):
        html, data = self.profile('Test Person', 'California'), jpeg()
        with patch.object(campaigns, 'cached_get', side_effect=[html, data]), patch.object(campaigns, 'detect', return_value=(data, [0, 0, 40, 60], [40, 60])), patch.object(campaigns.CACHE.__class__, 'write_bytes'):
            _, result = profiles.collect(dict(key='Test Person|CA', name='Test Person', state='CA'))
        self.assertEqual(result['options'][0]['credit'], 'BallotReady')
        self.assertEqual(result['options'][0]['sha256'], hashlib.sha256(data).hexdigest())


if __name__ == '__main__':
    unittest.main()
