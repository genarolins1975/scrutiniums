"""Relative citizen outcomes pilot. Standard library only; no implicit imputation."""
import math


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def percentile(value, reference, direction):
    if direction not in ('higher', 'lower'):
        raise ValueError('Unknown direction')
    if not reference or any(not number(x) for x in reference):
        raise ValueError('Reference must contain finite observations')
    if value is None:
        return None
    if not number(value):
        raise ValueError('Invalid observation')
    worse = sum(x < value if direction == 'higher' else x > value for x in reference)
    equal = sum(x == value for x in reference)
    return 100 * (worse + equal / 2) / len(reference)


def aggregate(scores, weights):
    if not weights or set(scores) != set(weights):
        raise ValueError('Exact basket required, use None for missing observations')
    if any(not number(w) or w <= 0 for w in weights.values()) or not math.isclose(sum(weights.values()), 1, abs_tol=1e-12):
        raise ValueError('Positive weights summing to one required')
    if any(v is not None and (not number(v) or not 0 <= v <= 100) for v in scores.values()):
        raise ValueError('Scores must be finite in 0..100 or None')
    lower = math.fsum(weights[k] * v for k, v in scores.items() if v is not None)
    missing = math.fsum(weights[k] for k, v in scores.items() if v is None)
    return {'score': lower if all(v is not None for v in scores.values()) else None,
            'lower': lower, 'upper': min(100, lower + 100 * missing),
            'coverage_weight': 1 - missing,
            'missing': [k for k, v in scores.items() if v is None]}
