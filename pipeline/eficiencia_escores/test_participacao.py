import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from .cobertura import build, STAGES
from .participacao import reconcile, load_evidence

class ParticipationTests(unittest.TestCase):
    def setUp(self):
        self.report = build()
        self.row = dict(territory='2611606', year='2023', stage=STAGES[0], subject='portugues', network='municipal', school_location='Urbana', participants='80', eligible_students='100', reported_pct='80', denominator_definition='Universo sintético de teste', source_locator='fixture:1')
        self.meta = dict(source_url='https://download.inep.gov.br/test-fixture', source_sha256='a'*64, extraction_sha256='b'*64, reviewer='fixture', reviewed_at='2026-10-11', review_status='REVIEWED')

    def test_join_preserves_values_missingness_and_score(self):
        before = copy.deepcopy(self.report)
        output = reconcile(self.report, [self.row], self.meta)
        self.assertEqual(self.report, before)
        self.assertEqual(output['summary']['participation_available'], 1)
        self.assertEqual(len(output['observations']), 104)
        for old, new in zip(before['observations'], output['observations']):
            for field in ('raw_value', 'source_state', 'raw_comparison_eligible', 'score', 'score_eligible'):
                self.assertEqual(old[field], new[field])
            self.assertIn('REPRESENTATIVIDADE_NAO_AUDITADA', new['blockers'])
        self.assertEqual(sum(g['participation_available'] for g in output['groups']), 1)

    def test_zero_and_rounding(self):
        for n, d, pct in [('0', '100', '0'), ('2', '3', '66.7')]:
            output = reconcile(self.report, [{**self.row, 'participants': n, 'eligible_students': d, 'reported_pct': pct}], self.meta)
            selected = [r for r in output['observations'] if r['participation_available']]
            self.assertAlmostEqual(selected[0]['participation_pct'], 100*int(n)/int(d))

    def test_wrong_granularity_or_duplicates(self):
        for changes in ({'year': '2025'}, {'network': 'estadual'}, {'school_location': 'Total'}, {'territory': '26'}, {'subject': 'ambas'}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                reconcile(self.report, [{**self.row, **changes}], self.meta)
        with self.assertRaises(ValueError):
            reconcile(self.report, [self.row, self.row], self.meta)

    def test_invalid_counts_and_percentages(self):
        for changes in ({'participants': ''}, {'participants': 'NaN'}, {'participants': '-1'}, {'eligible_students': '0'}, {'participants': '101'}, {'participants': '1.5'}, {'reported_pct': '90'}, {'reported_pct': 'inf'}, {'denominator_definition': ''}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                reconcile(self.report, [{**self.row, **changes}], self.meta)

    def test_provenance_and_empty_input(self):
        for changes in ({'review_status': 'PENDING'}, {'reviewer': ''}, {'source_sha256': 'invalid'}, {'source_url': 'https://download.inep.gov.br.example.org/data'}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                reconcile(self.report, [self.row], {**self.meta, **changes})
        with self.assertRaises(ValueError):
            reconcile(self.report, [], self.meta)

    def test_hashes_bind_actual_files(self):
        with tempfile.TemporaryDirectory() as temp:
            source, extraction, manifest = [Path(temp)/n for n in ('source', 'extract.csv', 'manifest.json')]
            source.write_bytes(b'synthetic source')
            extraction.write_text('territory\n2611606\n')
            metadata = {**self.meta, 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'extraction_sha256': hashlib.sha256(extraction.read_bytes()).hexdigest()}
            manifest.write_text(json.dumps(metadata))
            rows, _ = load_evidence(extraction, source, manifest)
            self.assertEqual(rows[0]['territory'], '2611606')
            source.write_bytes(b'changed')
            with self.assertRaises(ValueError):
                load_evidence(extraction, source, manifest)

if __name__ == '__main__':
    unittest.main()
