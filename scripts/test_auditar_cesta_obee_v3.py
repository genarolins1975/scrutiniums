"""Casos adversos da reconciliação alternativa; nenhuma fonte original é escrita."""
import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path

SOURCE = Path(__file__).with_name('auditar-cesta-obee-v3.py')
SPEC = importlib.util.spec_from_file_location('audit_obee', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class RationalAuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        for name in ('piloto-2022-v2.json', 'habitacao-adensamento-auditoria.json',
                     'conectividade-auditoria.json', 'cesta-conjunta.json',
                     'cesta-conjunta.csv', 'revisao-interativa-v3.html'):
            shutil.copyfile(MODULE.ROOT / 'docs/obee/resultados' / name, self.folder / name)

    def modify(self, name, change):
        path = self.folder / name
        data = json.loads(path.read_text())
        change(data)
        path.write_text(json.dumps(data))

    def test_real_artifacts_reconcile_without_methodological_approval(self):
        result = MODULE.audit(self.folder)
        self.assertEqual(result['city_scenario_rows'], 468)
        self.assertEqual(result['scenario_comparisons'], 49)
        self.assertLess(result['max_absolute_difference'], 1e-9)
        self.assertFalse(result['independent_methodological_review'])
        self.assertFalse(result['publication_ready'])

    def test_ties_and_direction_have_known_exact_midpoints(self):
        raw = dict(a=0, b=0, c=3, d=4)
        self.assertEqual(MODULE.ranks(raw, True), dict(a=25, b=25, c=62.5, d=87.5))
        self.assertEqual(MODULE.ranks(raw, False), dict(a=75, b=75, c=37.5, d=12.5))

    def test_row_order_does_not_change_identity(self):
        self.modify('habitacao-adensamento-auditoria.json', lambda d: d['households'].reverse())
        self.modify('conectividade-auditoria.json', lambda d: d['rows'].reverse())
        self.assertEqual(MODULE.audit(self.folder)['status'], 'pass')

    def test_wrong_score_is_rejected(self):
        self.modify('cesta-conjunta.json', lambda d: d['scenarios'][0]['rows'][0].update(scenario_score=0))
        with self.assertRaisesRegex(ValueError, 'scenario_score'):
            MODULE.audit(self.folder)

    def test_wrong_weight_is_rejected(self):
        self.modify('cesta-conjunta.json', lambda d: d['scenarios'][0]['weights'].update(educacao=0.3))
        with self.assertRaisesRegex(ValueError, 'Peso'):
            MODULE.audit(self.folder)

    def test_missing_city_is_rejected(self):
        self.modify('conectividade-auditoria.json', lambda d: d['rows'].pop())
        with self.assertRaisesRegex(ValueError, 'Coorte'):
            MODULE.audit(self.folder)

    def test_nonfinite_original_value_is_rejected(self):
        self.modify('conectividade-auditoria.json', lambda d: d['rows'][0].update(connected_pct=float('nan')))
        with self.assertRaisesRegex(ValueError, 'originais inválidos'):
            MODULE.audit(self.folder)

    def test_truncated_csv_is_rejected(self):
        path = self.folder / 'cesta-conjunta.csv'
        path.write_text('\n'.join(path.read_text().splitlines()[:-1]))
        with self.assertRaisesRegex(ValueError, 'CSV incompleto'):
            MODULE.audit(self.folder)

    def test_html_from_another_version_is_rejected(self):
        path = self.folder / 'revisao-interativa-v3.html'
        path.write_text(path.read_text().replace('"sha256":"', '"sha256":"stale-'))
        with self.assertRaisesRegex(ValueError, 'HTML aponta'):
            MODULE.audit(self.folder)


if __name__ == '__main__':
    unittest.main()
