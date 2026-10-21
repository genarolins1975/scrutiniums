import copy
import json
import unittest
from .fundacao import ROOT, aggregate, build, normalize, validate_cards


class FoundationTests(unittest.TestCase):
    def records(self, values=(80, 60, 75)):
        return [dict(id=k, value=v, validated=True, state="CALCULAVEL_EXPERIMENTAL",
            territory="test", edition="synthetic", comparison_window="2023")
            for k, v in zip(("access", "response", "quality"), values)]

    def calc(self, rows):
        return aggregate(rows, ["access", "response", "quality"], territory="test",
            edition="synthetic", comparison_window="2023")

    def test_geometric_and_order(self):
        self.assertAlmostEqual(self.calc(self.records())["value"], 71.1378660898)
        self.assertEqual(self.calc(self.records()), self.calc(list(reversed(self.records()))))

    def test_zero_is_not_missing(self):
        self.assertEqual(self.calc(self.records((80, 0, 75)))["value"], 0)
        self.assertIsNone(self.calc(self.records((80, None, 75)))["value"])

    def test_incomplete_never_reweights(self):
        self.assertIsNone(self.calc(self.records()[:2])["value"])

    def test_incompatible_context_blocks(self):
        for field in ("territory", "edition", "comparison_window"):
            rows = self.records()
            rows[0][field] = "other"
            self.assertIn("RECORTE_INCOMPATIVEL", [r["reason"] for r in self.calc(rows)["reasons"]])

    def test_unvalidated_and_invalid_block(self):
        for value in (float("nan"), float("inf"), -1, 101, True):
            self.assertIsNone(self.calc(self.records((80, value, 75)))["value"])
        rows = self.records(); rows[0]["validated"] = False
        self.assertIsNone(self.calc(rows)["value"])

    def test_duplicate_rejected(self):
        with self.assertRaises(ValueError):
            self.calc(self.records() + self.records()[:1])

    def test_normalization(self):
        ref = dict(validated=True, lower=40, upper=90, direction="higher")
        self.assertEqual(normalize(80, ref), 80)
        self.assertLess(normalize(70, ref), normalize(80, ref))
        self.assertEqual(normalize(95, ref), 100)
        self.assertIsNone(normalize(None, ref))
        self.assertIsNone(normalize(80, dict(ref, validated=False)))
        self.assertEqual(normalize(80, dict(ref, direction="lower")), 20)
        with self.assertRaises(ValueError): normalize(80, dict(ref, upper=40))

    def test_real_adapters_keep_raw_values_without_scores(self):
        report = build()
        self.assertEqual([(r["territory"], r["raw_value"]) for r in report["observations"]],
            [("2611606", 199.9), ("4106902", 218.13)])
        self.assertEqual([r["raw_value"] for r in report["regional_context_not_city_scores"]], [65.2, 86.4])
        for profile in report["profiles"]:
            self.assertIsNone(profile["aggregate"]["value"])
            self.assertEqual(sum(len(c["pillars"]) for c in profile["chapters"]), 15)
        self.assertTrue(all(r["geography"] == "region" for r in report["regional_context_not_city_scores"]))

    def test_fifteen_cards_and_incomplete_matrix_rejected(self):
        doc = json.loads((ROOT / "pipeline/eficiencia_escores/fichas.json").read_text())
        validate_cards(doc)
        broken = copy.deepcopy(doc); broken["cards"].pop()
        with self.assertRaises(ValueError): validate_cards(broken)


if __name__ == "__main__":
    unittest.main()
