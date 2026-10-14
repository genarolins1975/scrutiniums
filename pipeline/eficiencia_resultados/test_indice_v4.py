import json
import math
import random
import shutil
import tempfile
import unittest
from fractions import Fraction as F
from itertools import product
from pathlib import Path

from . import indice_v4 as v4


def brute_extremes(values, base, box):
    """Vértices da caixa ∩ simplex: todas as coordenadas nos limites, salvo uma."""
    keys, (lo, hi) = list(base), box
    found = []
    for free in keys:
        others = [k for k in keys if k != free]
        for bounds in product((lo, hi), repeat=len(others)):
            w = {k: base[k] * b for k, b in zip(others, bounds)}
            w[free] = 1 - sum(w.values())
            if base[free] * lo <= w[free] <= base[free] * hi:
                found.append(sum(w[k] * values[k] for k in keys))
    return min(found), max(found)


class Contratos(unittest.TestCase):
    def test_percentil_rejeita_ausencia_e_valores_invalidos(self):
        for values in ([1.0, None], [1.0, float('nan')], [1.0, float('inf')], [True, 2.0], [], ['1', 2.0], None):
            with self.assertRaises(ValueError):
                v4.percentiles(values, 'higher')
        with self.assertRaises(ValueError):
            v4.percentiles([1.0, 2.0], 'maior')

    def test_percentil_exato_preserva_empates_e_direcao(self):
        self.assertEqual(v4.percentiles([1, 2, 2, 3], 'higher'), [F(25, 2), F(50), F(50), F(175, 2)])
        self.assertEqual(v4.percentiles([1, 2, 2, 3], 'lower'), [F(175, 2), F(50), F(50), F(25, 2)])
        self.assertEqual(sum(v4.percentiles([5, 1, 9, 9, 2], 'higher')), F(250))

    def test_pesos_estritamente_positivos_somando_um(self):
        components = {'a': F(50), 'b': F(10)}
        for weights in ({'a': F(1), 'b': F(0)}, {'a': F(3, 2), 'b': F(-1, 2)}, {'a': .5, 'b': .5},
                        {'a': F(1, 2), 'b': F(1, 3)}, {}):
            with self.assertRaises(ValueError):
                v4.aggregate(components, weights)
        with self.assertRaises(ValueError):
            v4.aggregate({'a': F(50)}, {'a': F(1, 2), 'b': F(1, 2)})
        with self.assertRaises(ValueError):
            v4.aggregate({'a': F(101), 'b': F(1)}, {'a': F(1, 2), 'b': F(1, 2)})
        self.assertEqual(v4.aggregate(components, {'a': F(1, 2), 'b': F(1, 2)}), F(30))

    def test_extremos_da_familia_de_pesos_coincidem_com_os_vertices(self):
        rng = random.Random(20261014)
        for box in (v4.WEIGHT_BOX, v4.WEIGHT_BOX_WIDE):
            for _ in range(60):
                values = {d: F(rng.randint(-100, 100), rng.choice((1, 2, 13, 26))) for d in v4.DIMS}
                lo, hi, w_lo, w_hi = v4.box_extremes(values, v4.WEIGHTS, box)
                self.assertEqual((lo, hi), brute_extremes(values, v4.WEIGHTS, box))
                for w in (w_lo, w_hi):
                    self.assertEqual(sum(w.values()), 1)
                    self.assertTrue(all(v4.WEIGHTS[d] * box[0] <= w[d] <= v4.WEIGHTS[d] * box[1] for d in v4.DIMS))

    def test_familia_de_pesos_invalida(self):
        with self.assertRaises(ValueError):
            v4.box_extremes({'a': F(1)}, {'a': F(1)}, (F(0), F(2)))
        with self.assertRaises(ValueError):
            v4.box_extremes({'a': F(1), 'b': F(2)}, {'a': F(1, 2), 'b': F(1, 2)}, (F(5, 4), F(3, 2)))


class Edicao(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = v4.build()

    def test_coorte_pesos_e_natureza(self):
        r = self.result
        self.assertEqual(len(r['rows']), 26)
        self.assertNotIn('5300108', r['cohort'])
        self.assertEqual(set(r['weights'].values()), {'1/7'})
        self.assertFalse(r['official_index'])
        self.assertEqual(r['municipal_precision'], 'nao_quantificada')
        self.assertEqual(r['independent_review'], 'pendente')
        self.assertEqual(r['editorial_decisions']['housing'], 'moradores_gt3')

    def test_nota_e_a_soma_exata_das_contribuicoes(self):
        for row in self.result['rows']:
            percentis = [F(p).limit_denominator(52) for p in row['percentiles'].values()]
            self.assertEqual(sum(p / 7 for p in percentis), F(row['score_fraction']))
            self.assertAlmostEqual(sum(row['contributions'].values()), row['score'], places=9)
            self.assertAlmostEqual(sum(row['centered_contributions'].values()), row['score'] - 50, places=9)
            self.assertLessEqual(row['band'][0], row['score'])
            self.assertGreaterEqual(row['band'][1], row['score'])
            for low, high in row['sensitivity'].values():
                self.assertLessEqual(low, row['score'] + 1e-9)
                self.assertGreaterEqual(high, row['score'] - 1e-9)
        self.assertAlmostEqual(self.result['summary']['mean_score'], 50, places=9)

    def test_habitacao_principal_e_moradores_acima_de_tres(self):
        housing = v4.audit_housing()
        expected = {r['id']: r['above_three_pct'] for r in housing['residents']}
        for row in self.result['rows']:
            self.assertEqual(row['raw_values']['habitacao'], expected[row['id']])

    def test_pares_coerentes_com_as_notas_e_com_as_faixas(self):
        rows = {r['id']: r for r in self.result['rows']}
        status = {'mantida': 0, 'pode_empatar': 0, 'pode_inverter': 0, 'empate': 0}
        self.assertEqual(len(self.result['pairs']), 325)
        for p in self.result['pairs']:
            self.assertAlmostEqual(p['difference'], rows[p['a']]['score'] - rows[p['b']]['score'], places=9)
            status[p['status']] += 1
            s = (p['difference'] > 0) - (p['difference'] < 0)
            crosses = any(low * s < 0 or high * s < 0 for low, high in p['ranges'].values())
            self.assertEqual(p['status'] == 'pode_inverter', bool(s) and crosses)
            for family in p['families_reversing']:
                low, high = p['ranges'][family]
                self.assertTrue(low * s < 0 or high * s < 0)
        self.assertEqual(status, self.result['summary']['pair_status'])

    def test_comparacao_com_v3_reconcilia(self):
        c = self.result['comparison_v3']
        for row in c['rows']:
            self.assertAlmostEqual(row['change'], row['housing_definition_effect'] + row['weights_effect'], places=9)
            self.assertAlmostEqual(row['change'], row['v4_score'] - row['v3_score'], places=9)

    def test_evidencia_inclui_manifestos_e_metadados_lidos_pelas_auditorias(self):
        paths = {e['path'] for e in self.result['input_evidence']}
        seed = 'pipeline/eficiencia_resultados/seed/'
        for folder in ('habitacao', 'conectividade'):
            manifest = json.loads((v4.ROOT / seed / folder / 'manifest.json').read_text())
            self.assertIn(seed + folder + '/manifest.json', paths)
            for source in manifest['sources']:
                self.assertIn(seed + folder + '/' + source['path'], paths)

    def test_saidas_versionadas_atualizadas(self):
        v4.write(self.result, check=True)

    def test_csv_tem_26_capitais_e_valores_sem_arredondamento(self):
        text = v4.render(self.result)['indice-resultados-v4.csv'].splitlines()
        self.assertEqual(len(text), 27)
        first = dict(zip(text[0].split(','), text[1].split(',')))
        row = self.result['rows'][0]
        self.assertEqual(float(first['score']), row['score'])
        self.assertEqual(float(first['habitacao_raw']), row['raw_values']['habitacao'])


class Congelamento(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        result = json.loads((v4.ROOT / v4.FROZEN[0]).read_text())
        for path in set(v4.FROZEN) | {e['path'] for e in result['input_evidence']}:
            (self.tmp / path).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(v4.ROOT / path, self.tmp / path)
        self.target = self.tmp / 'pacote.json'

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_congela_uma_vez_verifica_e_recusa_sobrescrever(self):
        first = v4.freeze(self.tmp, self.target)
        self.assertEqual(v4.freeze(self.tmp, self.target), first)
        self.assertEqual(v4.verify(self.tmp, self.target)['packet_sha256'], first['packet_sha256'])
        doc = self.tmp / 'docs/obee/resultados/v4/METODOLOGIA_V4.md'
        doc.write_text(doc.read_text() + '\nalteração\n')
        with self.assertRaises(ValueError):
            v4.verify(self.tmp, self.target)
        with self.assertRaises(ValueError):
            v4.freeze(self.tmp, self.target)

    def test_pacote_versionado_confere(self):
        if v4.PACKET.exists():
            v4.verify()


if __name__ == '__main__':
    unittest.main()
