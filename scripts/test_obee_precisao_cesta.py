import copy
import json
import unittest
from scripts.obee_precisao_cesta import build, validate, OUTPUT, DOCS, ROOT, digest


class PrecisaoCesta(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.payload = build()

    def test_generated_file_matches(self):
        self.assertEqual(json.loads(OUTPUT.read_text()), self.payload)

    def test_missing_measure_capital_or_duplicate_fails(self):
        for mode in ('measure', 'capital', 'duplicate'):
            p = copy.deepcopy(self.payload)
            if mode == 'measure':
                p['records'] = [r for r in p['records'] if r['medida'] != 'trabalho']
            elif mode == 'capital':
                p['records'].pop()
            else:
                p['records'][0]['codigo_ibge'] = p['records'][7]['codigo_ibge']
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                validate(p)

    def test_zero_or_fabricated_error_fails(self):
        for field in ('standard_error', 'confidence_interval'):
            for value in (0, False, 1, [0, 0]):
                p = copy.deepcopy(self.payload)
                p['records'][0][field] = value
                with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                    validate(p)

    def test_classified_nature_requires_matching_evidence(self):
        for field, value in [('trecho', ''), ('url', ''), ('verificada', False), ('natureza', 'universo_censo')]:
            p = copy.deepcopy(self.payload)
            p['evidencias']['10056'][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate(p)

    def test_unverified_is_explicit_and_not_an_error_estimate(self):
        p = copy.deepcopy(self.payload)
        p['evidencias']['10056']['verificada'] = False
        for r in p['records']:
            if r['medida'] == 'educacao':
                r['natureza'] = 'nao_verificada'
        validate(p)

    def test_hidden_share_is_not_standard_error(self):
        rows = {r['codigo_ibge']: r for r in self.payload['records'] if r['medida'] == 'seguranca'}
        self.assertEqual(rows['3550308']['homicidios']['registrados'], 344)
        self.assertEqual(rows['3550308']['homicidios']['ocultos'], 1418)
        self.assertAlmostEqual(rows['3550308']['homicidios']['parcela_ocultos_pct'], 100 * 1418 / 1762)
        self.assertEqual(rows['4205407']['homicidios']['ocultos'], 0)
        self.assertIsNone(rows['4205407']['standard_error'])
        p = copy.deepcopy(self.payload)
        next(r for r in p['records'] if r['medida'] == 'seguranca')['homicidios']['total'] += 1
        with self.assertRaises(ValueError):
            validate(p)

    def test_frozen_packet_and_editorial_gates(self):
        packet = json.loads((DOCS / 'revisao-v3-pacote.json').read_text())
        self.assertEqual(len(packet['files']), 54)
        for source in packet['files']:
            self.assertEqual(digest(ROOT / source['path']), source['sha256'], source['path'])
        self.assertFalse(self.payload['publication_ready'])
        self.assertIsNone(self.payload['approved_weights'])


if __name__ == '__main__':
    unittest.main()
