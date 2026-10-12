import copy
import json
import random
import unittest
from fractions import Fraction as F

from scripts import obee_robustez_ampliada as mod


class ExtendedRobustnessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = mod.main()
        cls.inputs = {p: json.loads(p.read_text()) for p in (mod.JOINT, mod.PILOT, mod.PAIRS, mod.VIOLENCE)}

    def rebuild(self, change=None):
        data = copy.deepcopy(self.inputs)
        if change:
            change(data)
        return mod.build(data[mod.JOINT], data[mod.PILOT], data[mod.VIOLENCE], data[mod.PAIRS],
                         self.result['input_sha256'])

    def test_frozen_output_reproduces_and_no_approval(self):
        self.assertEqual(self.result, json.loads(mod.OUTPUT.read_text()))
        self.assertFalse(self.result['publication_ready'])
        self.assertFalse(self.result['independent_review'])
        s = self.result['summary']
        self.assertEqual((s['classe_dominancia'], s['classe_estavel_so_na_familia'],
                          s['classe_inversao_possivel'], s['classe_empate_possivel']), (55, 239, 30, 1))
        self.assertEqual((s['caixa_25pct_inversao_possivel'], s['caixa_50pct_inversao_possivel']), (53, 99))
        self.assertEqual({k[9:]: v for k, v in s.items() if k.startswith('exclusao_')},
                         dict(educacao=27, trabalho=8, mobilidade=29, saneamento=10, seguranca=32,
                              habitacao=11, conectividade=5))
        self.assertEqual((s['minmax_inversoes'], s['escore_z_inversoes']), (19, 20))
        self.assertEqual(len(self.result['pairs']), 325)

    def test_box_extremes_are_exact_bounds(self):
        rng = random.Random(2022)
        ref = mod.reference_weights()
        for _ in range(200):
            delta = {d: F(rng.randint(-100, 100), rng.randint(1, 7)) for d in mod.DIMS}
            lo, hi = mod.box_extremes(delta, F(1, 4))
            neg = mod.box_extremes({d: -v for d, v in delta.items()}, F(1, 4))
            self.assertEqual(neg, (-hi, -lo))
            for _ in range(20):
                # pesos viáveis aleatórios: parte do limite inferior e distribui o resto
                w = {d: ref[d] * F(3, 4) for d in mod.DIMS}
                rest = 1 - sum(w.values())
                for d in rng.sample(mod.DIMS, len(mod.DIMS)):
                    add = min(ref[d] * F(1, 2), rest * F(rng.randint(0, 10), 10))
                    w[d] += add
                    rest -= add
                for d in mod.DIMS:
                    add = min(ref[d] * F(5, 4) - w[d], rest)
                    w[d] += add
                    rest -= add
                self.assertEqual(rest, 0)
                value = sum(w[d] * delta[d] for d in mod.DIMS)
                self.assertTrue(lo <= value <= hi)

    def test_dominance_never_reverses_and_recife_curitiba_is_dominance(self):
        pairs = {frozenset((p['a'], p['b'])): p for p in self.result['pairs']}
        recife = pairs[frozenset(('2611606', '4106902'))]
        self.assertEqual(recife['robustness'], 'dominancia')
        aracaju = pairs[frozenset(('2800308', '2211001'))]
        self.assertEqual(aracaju['robustness'], 'inversao_possivel')
        for p in self.result['pairs']:
            if p['robustness'] == 'dominancia':
                self.assertFalse(any(p['box_inversion_possible'].values()))
                self.assertEqual(p['leave_one_out_reversals'], [])
                self.assertFalse(p['minmax_reversal'] or p['zscore_reversal'])

    def test_row_order_is_irrelevant(self):
        def reverse(data):
            for s in data[mod.JOINT]['scenarios']:
                s['rows'].reverse()
            data[mod.PILOT]['rows'].reverse()
            data[mod.VIOLENCE]['violence'].reverse()
        self.assertEqual(self.rebuild(reverse)['summary'], self.result['summary'])

    def test_invalid_inputs_fail(self):
        def bad_percentile(data):
            next(s for s in data[mod.JOINT]['scenarios'] if s['inclusion'] == 'conjunta')['rows'][0]['indicator_scores']['educacao'] = 1.0

        def duplicate_city(data):
            data[mod.JOINT]['cohort'][1] = data[mod.JOINT]['cohort'][0]

        def missing_violence(data):
            data[mod.VIOLENCE]['violence'].pop()

        def approved(data):
            data[mod.JOINT]['approved_weights'] = {'educacao': 1}
        for change in (bad_percentile, duplicate_city, missing_violence, approved):
            with self.subTest(change=change.__name__), self.assertRaises(ValueError):
                self.rebuild(change)


if __name__ == '__main__':
    unittest.main()
