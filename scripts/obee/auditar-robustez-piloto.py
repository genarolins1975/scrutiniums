"""Descriptive audit of the frozen pilot; no fitting, inference or score changes."""
import hashlib
import json
import math
from itertools import combinations
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / 'docs/obee/resultados/piloto-2022-v2.json'
OUTPUT = ROOT / 'docs/obee/resultados/robustez-2022-v2.json'
TOL = 1e-9


def sign(x):
    return 0 if abs(x) <= TOL else (1 if x > 0 else -1)


def covariance(a, b):
    ma, mb = mean(a), mean(b)
    return mean((x-ma)*(y-mb) for x, y in zip(a, b))


def correlation(a, b):
    denominator = math.sqrt(covariance(a, a)*covariance(b, b))
    return covariance(a, b)/denominator if denominator else None


def compare(base, scenarios):
    pairs = []
    for i, j in combinations(range(len(base)), 2):
        original = sign(base[i]-base[j])
        outcomes = [sign(s[i]-s[j]) for s in scenarios]
        pairs.append({'i': i, 'j': j, 'baseline_sign': original,
                      'strict_reversal': bool(original and -original in outcomes),
                      'baseline_tie_broken': original == 0 and any(outcomes),
                      'tie_reached': original != 0 and 0 in outcomes})
    return {'pairs': len(pairs),
            **{k: sum(bool(p[k]) for p in pairs) for k in
               ('strict_reversal', 'baseline_tie_broken', 'tie_reached')},
            'details': [p for p in pairs if any(p[k] for k in ('strict_reversal', 'baseline_tie_broken', 'tie_reached'))]}


def audit(data):
    rows = data['rows']
    basket = data['reference']['basket']
    dims = [d['id'] for d in basket]
    weights = {d['id']: d['weight'] for d in basket}
    base = [r['pilot_five']['score'] for r in rows]
    columns = {d: [r['indicator_scores'][d] for r in rows] for d in dims}
    if not math.isclose(sum(weights.values()), 1):
        raise ValueError('Weights do not sum to one')
    for row, score in zip(rows, base):
        if not math.isclose(sum(weights[d]*row['indicator_scores'][d] for d in dims), score, abs_tol=TOL):
            raise ValueError('Frozen score cannot be reconciled')
    scenarios = data['sensitivity']['weights']
    calculated = [[sum(w[d]*r['indicator_scores'][d] for d in dims) for r in rows] for w in scenarios]
    for k, values in enumerate(calculated):
        for row, value in zip(rows, values):
            if not math.isclose(value, row['weight_scenarios'][k], abs_tol=TOL):
                raise ValueError('Weight scenario differs from frozen result')
    removal = {}
    for d in dims:
        values = [sum(weights[e]*r['indicator_scores'][e] for e in dims if e != d)/(1-weights[d]) for r in rows]
        for row, value in zip(rows, values):
            if not math.isclose(value, row['leave_one_out'][d], abs_tol=TOL):
                raise ValueError('Leave-one-out differs from frozen result')
        removal[d] = compare(base, [values])
    variance = covariance(base, base)
    return {'publication_ready': False, 'reference_version': data['version'],
            'n': len(rows), 'tolerance_points': TOL,
            'correlation_oriented_percentiles': {d: {e: correlation(columns[d], columns[e]) for e in dims} for d in dims},
            'variance_share': {d: weights[d]*covariance(columns[d], base)/variance for d in dims},
            'variance_share_definition': 'w_j Cov(P_j,S) / Var(S); descriptive covariance allocation, not causal influence or recommended weights',
            'weight_scenarios': len(scenarios),
            'distinct_weight_vectors': len({tuple(round(w[d], 12) for d in dims) for w in scenarios}),
            'weights': compare(base, calculated), 'leave_one_out': removal,
            'definitions': {d: compare(base, [[r['definition_sensitivity'][d] for r in rows]]) for d in rows[0]['definition_sensitivity']},
            'territories': [{'i': i, 'id': r['id'], 'name': r['name']} for i, r in enumerate(rows)],
            'limits': ['26 state capitals; descriptive cross-section, not population inference.',
                       'Reversals are relative to equal-weight baseline; ties separated with explicit tolerance.',
                       'Scenario counts are not probabilities; families must not be pooled.',
                       'Correlation does not justify removing an indicator or imply causality.',
                       'No uncertainty propagation, revised weights or official validation.']}


def main():
    raw = INPUT.read_bytes()
    result = audit(json.loads(raw))
    result['input_sha256'] = hashlib.sha256(raw).hexdigest()
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False)+'\n')
    print(json.dumps({k: result[k] for k in ('n', 'weight_scenarios', 'distinct_weight_vectors', 'variance_share')}, ensure_ascii=False))
    for family in ('weights', 'leave_one_out', 'definitions'):
        value = result[family]
        if family == 'weights':
            print(family, {k: v for k, v in value.items() if k != 'details'})
        else:
            print(family, {d: {k: v for k, v in x.items() if k != 'details'} for d, x in value.items()})

if __name__ == '__main__':
    main()
