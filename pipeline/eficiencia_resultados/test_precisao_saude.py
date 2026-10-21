import tempfile
import unittest
from pathlib import Path
from .precisao_saude import build, poisson_interval, coverage_scenario, _read_frozen


class HealthPrecisionTests(unittest.TestCase):
    def test_independent_chi_square_reference_values(self):
        # Independently calculated with scipy.stats.chi2.ppf; no SciPy runtime dependency.
        fixtures = [(0, 0, 3.688879454113936),
                    (1, .025317807984289876, 5.571643390938898),
                    (5, 1.6234863901184204, 11.66833207932267),
                    (100, 81.36399125092314, 121.62679379242638),
                    (581, 534.7113099811339, 630.223406684512),
                    (5000, 4862.359188694899, 5140.5489485350045)]
        for deaths, lower, upper in fixtures:
            result = poisson_interval(deaths, 1000)
            self.assertAlmostEqual(result['lower_95'], lower, delta=1e-7)
            self.assertAlmostEqual(result['upper_95'], upper, delta=1e-7)

    def test_invalid_counts_and_denominators(self):
        for d, b in [(-1, 100), (1.5, 100), (True,100), (1,0), (1,-1), (1,float('nan')), (1,True)]:
            with self.assertRaises(ValueError): poisson_interval(d,b)
        self.assertIsNone(poisson_interval(0,100)['relative_standard_error_pct'])

    def test_rate_exposure_scaling(self):
        a, b = poisson_interval(5,1000), poisson_interval(5,2000)
        for key in ['rate_per_1000','lower_95','upper_95']:
            self.assertAlmostEqual(a[key],2*b[key])
        self.assertEqual(a['relative_standard_error_pct'],b['relative_standard_error_pct'])

    def test_coverage_sensitivity_direction_and_cancellation(self):
        self.assertAlmostEqual(coverage_scenario(10, .95, .95),10)
        self.assertAlmostEqual(coverage_scenario(10, 1, .95),10/.95)
        self.assertAlmostEqual(coverage_scenario(10, .95, 1),9.5)
        for args in [(10,0,1),(10,1,0),(10,1,1.1),(10,True,1),(float('nan'),1,1),(-1,1,1)]:
            with self.assertRaises(ValueError): coverage_scenario(*args)

    def test_precision_never_substitutes_for_registration_evidence(self):
        result = build()
        self.assertEqual(len(result['rows']),26)
        self.assertEqual(sum(len(r['annual']) for r in result['rows']),78)
        self.assertEqual(result['decision'],'descriptive_research_only')
        self.assertFalse(result['score_eligible'])
        self.assertFalse(result['publication_ready'])
        self.assertFalse(result['registration_review']['correction_applied'])
        for row in result['rows']:
            self.assertIsNone(row['municipal_infant_registration_coverage'])
            self.assertFalse(row['score_eligible'])
            self.assertLess(row['pooled']['relative_standard_error_pct'],10)

    def test_changed_frozen_input_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'source.json'; path.write_text('{}')
            with self.assertRaises(ValueError): _read_frozen(path,'0'*64)


if __name__ == '__main__': unittest.main()
