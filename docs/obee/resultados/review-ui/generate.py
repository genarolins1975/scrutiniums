"""Gera prévia autocontida a partir do experimento publicado no repositório."""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
DOCS = HERE.parent
ROOT = DOCS.parents[2]
SOURCE = DOCS / 'cesta-conjunta.json'
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

# Valores originais: o leitor precisa ver a medida, não só a posição relativa.
pilot = json.loads((DOCS / 'piloto-2022-v2.json').read_text())
assert pilot['version'] == 'irc-piloto-2022-v2' and pilot['publication_ready'] is False
violence = {r['id']: r for r in json.loads((ROOT / 'pipeline/eficiencia_resultados/seed/expansao-2022.json').read_text())['violence']}
original = {r['id']: {**r['raw_values'], 'homicidios_ocultos_pct': 100 * violence[r['id']]['hidden_estimated'] / violence[r['id']]['total_estimated']}
            for r in pilot['rows']}
for source in data['scenarios']:
    for row in source['rows']:
        values = original[row['id']]
        for key, value in row['candidate_raw_pct'].items():
            name = key if key == 'conectividade' else source['housing_definition']
            assert values.setdefault(name, value) == value, 'Valor original divergente entre cenários'
assert len(original) == 26 and all(len(v) == 11 for v in original.values())
payload['original'] = original

sensitivity = json.loads((DOCS / 'sensibilidade-pares-v3.json').read_text())
assert sensitivity['source_sha256'] == payload['sha256']
assert len(sensitivity['pairs']) == 325 and sensitivity['publication_ready'] is False
payload['sensitivity'] = {'summary': sensitivity['summary'], 'pairs': [
    {k: pair[k] for k in ('a', 'b', 'state', 'min_gap', 'max_gap', 'definitions')}
    for pair in sensitivity['pairs']]}

robustness = json.loads((DOCS / 'robustez-ampliada-v3.json').read_text())
assert robustness['input_sha256']['docs/obee/resultados/cesta-conjunta.json'] == payload['sha256']
assert len(robustness['pairs']) == 325 and robustness['publication_ready'] is False
payload['robustness'] = {'summary': robustness['summary'], 'pairs': [
    {k: pair[k] for k in ('a', 'b', 'robustness', 'box_inversion_possible', 'leave_one_out_reversals',
                          'minmax_reversal', 'zscore_reversal', 'registered_homicides_family_state')}
    for pair in robustness['pairs']]}
precision = json.loads((DOCS / 'precisao-candidatas.json').read_text())
payload['mandatory_label'] = precision['mandatory_label']
html = (HERE / 'template.html').read_text().replace('__DATA__', json.dumps(payload, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c'))
output = DOCS / 'revisao-interativa-v3.html'
output.write_text(html)
print(output)
