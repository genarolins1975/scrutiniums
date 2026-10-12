import csv
import io
import unittest
from .cobertura import STAGES, audit, build, csv_text


class CoverageTests(unittest.TestCase):
    cities = [{'id': '2611606', 'name': 'Recife', 'uf': 'PE'}]

    def row(self, **changes):
        return dict({'ano': '2023', 'codigo_ibge': '2611606', 'etapa': STAGES[0],
            'componente': 'portugues', 'indicador_id': 'edu.saeb.rede_municipal',
            'valor': '0', 'status': 'OBSERVADO', 'elegivel_comparacao': 'sim',
            'participacao_pct': '', 'fonte': 'teste', 'registro': 'teste'}, **changes)

    def test_zero_is_observed_but_not_score(self):
        row = audit([self.row()], self.cities)[0]
        self.assertEqual(row['raw_value'], 0)
        self.assertTrue(row['raw_comparison_eligible'])
        self.assertIsNone(row['score'])
        self.assertFalse(row['score_eligible'])

    def test_missing_rows_remain_in_denominator(self):
        result = audit([], self.cities)
        self.assertEqual(len(result), 4)
        self.assertTrue(all(r['source_state'] == 'REGISTRO_AUSENTE' for r in result))
        self.assertTrue(all(r['raw_value'] is None for r in result))

    def test_duplicate_and_unknown_territory_rejected(self):
        with self.assertRaises(ValueError):
            audit([self.row(), self.row()], self.cities)
        with self.assertRaises(ValueError):
            audit([self.row(codigo_ibge='5300108')], self.cities)

    def test_bad_values_and_participation_rejected(self):
        for changes in ({'valor': 'NaN'}, {'participacao_pct': '101'}, {'participacao_pct': '-1'}):
            with self.assertRaises(ValueError):
                audit([self.row(**changes)], self.cities)

    def test_suppressed_value_never_becomes_eligible(self):
        row = audit([self.row(status='NAO_DIVULGADO', valor='210', elegivel_comparacao='nao')], self.cities)[0]
        self.assertEqual(row['raw_value'], 210)
        self.assertFalse(row['raw_comparison_eligible'])

    def test_participation_does_not_approve_score(self):
        row = audit([self.row(participacao_pct='100')], self.cities)[0]
        self.assertTrue(row['participation_available'])
        self.assertFalse(row['score_eligible'])
        self.assertIn('REPRESENTATIVIDADE_NAO_AUDITADA', row['blockers'])

    def test_real_universe_and_export_reconciliation(self):
        report = build()
        self.assertEqual(report['summary']['territories'], 26)
        self.assertEqual(report['summary']['expected_observations'], 104)
        rows = list(csv.DictReader(io.StringIO(csv_text(report))))
        self.assertEqual(len(rows), len(report['observations']))
        for raw, exported in zip(report['observations'], rows):
            self.assertEqual(exported['territory'], raw['territory'])
            self.assertEqual(exported['stage'], raw['stage'])
            self.assertEqual(exported['subject'], raw['subject'])
            self.assertEqual(exported['score'], '')
            if raw['raw_value'] is None:
                self.assertEqual(exported['raw_value'], '')
            else:
                self.assertEqual(float(exported['raw_value']), raw['raw_value'])
            self.assertEqual(exported['blockers'], ' | '.join(raw['blockers']))


if __name__ == '__main__':
    unittest.main()
