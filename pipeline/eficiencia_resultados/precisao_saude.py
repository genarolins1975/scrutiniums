"""Conditional Poisson precision audit. No correction, ranking or score promotion."""
import csv
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COUNTS = ROOT/'docs/obee/resultados/saude-contagens-2021-2023.json'
EVIDENCE = Path(__file__).parent/'seed/saude/ibge-subnotificacao-2023.json'
COUNTS_SHA256 = '1e322eb32a03593520f9a7f9925be1bb5f9cda049f37be55e034fff14b17f097'
EVIDENCE_SHA256 = 'd68235f39b362369a91c05ac47a43189e03799ad78eb6ff7e05cfdc98af3ebd6'


def _poisson_cdf(k, mean):
    if mean == 0: return 1.0
    # Log-sum-exp avoids overflow/underflow for the counts in this cohort.
    terms = [-mean + j*math.log(mean) - math.lgamma(j+1) for j in range(k+1)]
    peak = max(terms)
    return min(1.0, math.exp(peak)*math.fsum(math.exp(t-peak) for t in terms))


def _mean_at_cdf(k, probability):
    low, high = 0.0, float(max(1, k+1))
    while _poisson_cdf(k, high) > probability: high *= 2
    for _ in range(65):
        mid = (low+high)/2
        if _poisson_cdf(k, mid) > probability: low = mid
        else: high = mid
    return (low+high)/2


def poisson_interval(deaths, births):
    """Central 95% Garwood interval, fixed exposure; counts must be integers."""
    if type(deaths) is not int or deaths < 0:
        raise ValueError('Deaths must be a nonnegative integer')
    if type(births) is not int or births <= 0:
        raise ValueError('Births must be a positive integer')
    lower = 0.0 if deaths == 0 else _mean_at_cdf(deaths-1, .975)
    upper = _mean_at_cdf(deaths, .025)
    return {'rate_per_1000': 1000*deaths/births,
            'lower_95': 1000*lower/births, 'upper_95': 1000*upper/births,
            'relative_standard_error_pct': 100/math.sqrt(deaths) if deaths else None}


def coverage_scenario(rate, birth_coverage, death_coverage):
    """Hypothetical coverage identity, never an estimated correction."""
    for value in (rate, birth_coverage, death_coverage):
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError('Finite numeric parameters required')
    if rate < 0 or not 0 < birth_coverage <= 1 or not 0 < death_coverage <= 1:
        raise ValueError('Invalid rate or coverage fraction')
    return rate*birth_coverage/death_coverage


def _read_frozen(path, expected):
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError('Frozen audit input changed: '+path.name)
    return json.loads(raw)


def build():
    counts = _read_frozen(COUNTS, COUNTS_SHA256)
    evidence = _read_frozen(EVIDENCE, EVIDENCE_SHA256)
    if counts['years'] != ['2021', '2022', '2023'] or len(counts['rows']) != 26:
        raise ValueError('Unexpected health window/cohort')
    rows = []
    for row in counts['rows']:
        pooled = poisson_interval(row['deaths_total'], row['live_births_total'])
        rows.append({'id': row['id'], 'name': row['name'],
            'deaths': row['deaths_total'], 'births': row['live_births_total'],
            'pooled': pooled,
            'annual': {year: poisson_interval(row['deaths'][year], row['live_births'][year]) for year in counts['years']},
            'hypothetical_scenarios': [
                {'birth_coverage': b, 'death_coverage': d,
                 'rate_per_1000': coverage_scenario(pooled['rate_per_1000'], b, d)}
                for b, d in [(1, 1), (1, .95), (.95, 1), (.95, .95)]],
            'municipal_infant_registration_coverage': None,
            'score_eligible': False})
    return {'version': 'irc-health-precision-2021-2023-v1',
        'input_sha256': {str(COUNTS.relative_to(ROOT)): COUNTS_SHA256,
                         str(EVIDENCE.relative_to(ROOT)): EVIDENCE_SHA256},
        'confidence_level': .95, 'method': 'Central exact Poisson (Garwood), fixed live-birth denominator',
        'interpretation': 'Conditional random variation, not total uncertainty or a linked-cohort probability',
        'precision_threshold': None,
        'registration_review': {'reference_year': evidence['reference_year'],
            'municipal_births': 'available', 'municipal_all_age_deaths': 'available',
            'municipal_infant_deaths': 'not in inspected IBGE 2023 tables',
            'infant_deaths': 'state and region level only in inspected tables',
            'correction_applied': False},
        'decision': 'descriptive_research_only', 'score_eligible': False, 'publication_ready': False,
        'remaining_requirements': ['Municipal infant-specific registration evidence aligned to 2021-2023',
            'Versioned temporal contract and content validity review before adding health'],
        'rows': rows}


if __name__ == '__main__':
    result = build(); out = ROOT/'docs/obee/resultados'
    (out/'saude-precisao-2021-2023.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    with (out/'saude-precisao-2021-2023.csv').open('w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['id','name','window','deaths','births','rate_per_1000','lower_95','upper_95','relative_standard_error_pct','score_eligible'])
        for r in result['rows']:
            p = r['pooled']
            writer.writerow([r['id'],r['name'],'2021-2023',r['deaths'],r['births'],p['rate_per_1000'],p['lower_95'],p['upper_95'],p['relative_standard_error_pct'],'false'])
    print(json.dumps({'territories':len(result['rows']), 'decision':result['decision']}))
