"""Gera prévia autocontida a partir do experimento publicado no repositório."""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / 'cesta-conjunta.json'
raw = SOURCE.read_bytes()
data = json.loads(raw)
assert data['publication_ready'] is False and len(data['scenarios']) == 18
for scenario in data['scenarios']:
    assert len(scenario['rows']) == 26
    for row in scenario['rows']:
        assert abs(row['scenario_score'] - sum(row['indicator_scores'][k] * w for k, w in scenario['weights'].items())) < 1e-9
        assert abs(row['composition_delta'] - row['decomposition']['added_total'] - row['decomposition']['reweighting_total']) < 1e-9
scenarios = []
for source in data['scenarios']:
    scenario = {k: source[k] for k in ('id', 'weights', 'material_weight', 'versus_v2')}
    scenario['rows'] = [{**{k: row[k] for k in ('id', 'name', 'indicator_scores', 'baseline_score', 'scenario_score', 'composition_delta')},
                         'decomposition': {k: row['decomposition'][k] for k in ('added_total', 'reweighting_total')}} for row in source['rows']]
    scenarios.append(scenario)
payload = {'sha256': hashlib.sha256(raw).hexdigest(), 'scenarios': scenarios}
sensitivity = json.loads((HERE.parent / 'sensibilidade-pares-v3.json').read_text())
assert sensitivity['source_sha256'] == payload['sha256']
assert len(sensitivity['pairs']) == 325 and sensitivity['publication_ready'] is False
payload['sensitivity'] = {'summary': sensitivity['summary'], 'pairs': [
    {k: pair[k] for k in ('a', 'b', 'state', 'min_gap', 'max_gap', 'definitions')}
    for pair in sensitivity['pairs']]}
html = (HERE / 'template.html').read_text().replace('__DATA__', json.dumps(payload, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c'))
output = HERE.parent / 'revisao-interativa-v3.html'
output.write_text(html)
print(output)
