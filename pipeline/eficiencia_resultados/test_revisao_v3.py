import copy
import json
from pathlib import Path
import tempfile
import unittest

from .revisao_v3 import CRITERIA, DOCS, digest, evaluate, file_hash


class ReviewPacketTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'source.txt').write_text('fixture de evidência')
        (self.root / 'review.txt').write_text('fixture de parecer; não é aprovação real')
        payload = {'criteria': list(CRITERIA), 'authors': ['author'],
                   'files': [{'path': 'source.txt', 'sha256': file_hash(self.root, 'source.txt')}]}
        self.packet = {**payload, 'packet_sha256': digest(payload)}
        self.reviews = {'packet_sha256': self.packet['packet_sha256'], 'records': []}

    def record(self, criterion):
        return {'criterion': criterion, 'decision': 'approve', 'reviewer': 'fixture-reviewer',
                'reviewed_at': '2026-10-12', 'rationale': 'fixture de teste',
                'independence_declared': True, 'evidence_path': 'review.txt',
                'evidence_sha256': file_hash(self.root, 'review.txt')}

    def test_real_packet_is_intact_and_still_pending(self):
        packet = json.loads((DOCS / 'revisao-v3-pacote.json').read_text())
        reviews = json.loads((DOCS / 'revisao-v3-pareceres.json').read_text())
        result = evaluate(packet, reviews)
        self.assertEqual(result, json.loads((DOCS / 'revisao-v3-status.json').read_text()))
        self.assertEqual(result['pending'], list(CRITERIA))
        self.assertFalse(result['publication_ready'])

    def test_complete_documentation_never_publishes(self):
        self.reviews['records'] = [self.record(c) for c in CRITERIA]
        result = evaluate(self.packet, self.reviews, self.root)
        self.assertTrue(result['documentary_review_complete'])
        self.assertTrue(result['human_authenticity_check_required'])
        self.assertFalse(result['publication_ready'])
        for decision in ('reject', 'changes_requested'):
            self.reviews['records'][0]['decision'] = decision
            self.assertIn(CRITERIA[0], evaluate(self.packet, self.reviews, self.root)['pending'])

    def test_changed_source_or_packet_and_stale_reviews_rejected(self):
        bad = copy.deepcopy(self.packet); bad['authors'] = ['other']
        with self.assertRaises(ValueError): evaluate(bad, self.reviews, self.root)
        stale = dict(self.reviews, packet_sha256='old')
        with self.assertRaises(ValueError): evaluate(self.packet, stale, self.root)
        (self.root / 'source.txt').write_text('changed')
        with self.assertRaises(ValueError): evaluate(self.packet, self.reviews, self.root)

    def test_self_review_missing_evidence_and_invalid_records_rejected(self):
        for changes in ({'reviewer': 'author'}, {'independence_declared': False},
                        {'rationale': ''}, {'decision': 'pending'}, {'criterion': 'unknown'},
                        {'evidence_sha256': 'wrong'}, {'evidence_path': '../outside.txt'}):
            with self.subTest(changes=changes):
                self.reviews['records'] = [dict(self.record(CRITERIA[0]), **changes)]
                with self.assertRaises(ValueError): evaluate(self.packet, self.reviews, self.root)
        self.reviews['records'] = [self.record(CRITERIA[0])] * 2
        with self.assertRaises(ValueError): evaluate(self.packet, self.reviews, self.root)


if __name__ == '__main__':
    unittest.main()
