"""Reproduce the frozen 2022 three-indicator pilot, without publishing a full OBEE score."""
import csv
import hashlib
import itertools
import json
from pathlib import Path
from .motor import aggregate, number, percentile

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).parent
OUT = ROOT / 'docs/obee/resultados'


def build():
    config = json.loads((HERE / 'referencia-2022-v1.json').read_text())
    raw = (ROOT / config['input_path']).read_bytes()
    if hashlib.sha256(raw).hexdigest() != config['input_sha256']:
        raise ValueError('Snapshot changed: review and create a new reference version')
    source = json.loads(raw)
    metrics = {m['id']:m for m in source['metrics']}
    if len(metrics) != len(source['metrics']):
        raise ValueError('Duplicate metric')
    cities = source['cities']
    ids = [c['id'] for c in cities]
    if len(set(ids)) != 26 or sorted(ids) != config['territories']:
        raise ValueError('Reference cohort changed')
    basket = config['basket']
    weights = {b['id']:b['weight'] for b in basket}
    coverage = []
    maps = {}
    for m in source['metrics']:
        obs = m['observations']
        if len({o['territory'] for o in obs}) != len(obs) or {o['territory'] for o in obs} != set(ids):
            raise ValueError('Duplicate or missing territory rows')
        maps[m['id']] = {o['territory']:o for o in obs}
        included = m['id'] in weights
        coverage.append({'id':m['id'], 'title':m['title'], 'period':m['period'],
                         'valid_rows':sum(o['eligible'] and number(o['value']) for o in obs),
                         'total':26, 'included_in_pilot':included,
                         'reason':'Resultado contextual no recorte de 2022' if included else 'APS potencial mede capacidade, nao atendimento ou desfecho',
                         'source_url':m['sourceUrl'], 'source_hash':m['sourceHash'], 'warning':m['warning']})
    for b in basket:
        actual = sorted(maps[b['id']][city]['value'] for city in ids)
        if actual != b['reference'] or metrics[b['id']]['period'] != b['period']:
            raise ValueError('Frozen reference mismatch')
    scenarios = []
    for factors in itertools.product((0.8, 1.2), repeat=len(basket)):
        raw_weights = {b['id']:b['weight']*f for b,f in zip(basket,factors)}
        total = sum(raw_weights.values())
        scenarios.append({k:v/total for k,v in raw_weights.items()})
    rows = []
    for city in cities:
        values = {}
        scores = {}
        for b in basket:
            obs = maps[b['id']][city['id']]
            value = obs['value'] if obs['eligible'] else None
            values[b['id']] = value
            scores[b['id']] = percentile(value,b['reference'],b['direction'])
        base = aggregate(scores,weights)
        variants = [aggregate(scores,w)['score'] for w in scenarios]
        leave_one = {}
        for excluded in weights:
            kept = {k:w for k,w in weights.items() if k != excluded}
            total = sum(kept.values())
            leave_one[excluded] = aggregate({k:scores[k] for k in kept},{k:w/total for k,w in kept.items()})['score']
        rows.append({**city,'raw_values':values,'indicator_scores':scores,**base,
                     'weight_scenarios':variants,
                     'weight_sensitivity_range':[min(variants),max(variants)] if all(v is not None for v in variants) else None,
                     'leave_one_out':leave_one})
    pairwise = []
    for a,b in itertools.combinations(rows,2):
        if a['score'] is None or b['score'] is None:continue
        baseline = a['score'] - b['score']
        differences = [x-y for x,y in zip(a['weight_scenarios'],b['weight_scenarios'])]
        pairwise.append({'a':a['id'],'b':b['id'],'baseline_difference':baseline,
                         'difference_range':[min(differences),max(differences)],
                         'sign_reversal':any(d*baseline < -1e-10 for d in differences)})
    return {'version':config['version'],'role':'PILOTO_TECNICO_CONDICOES_DE_VIDA_2022',
            'publication_ready':False,'is_full_obee_score':False,
            'reference':config,'coverage_matrix':coverage,'rows':rows,
            'sensitivity':{'type':'Cenarios deterministas; nao sao intervalos de confianca',
                           'weights':scenarios,'pairwise_comparisons':len(pairwise),
                           'pairs_with_sign_reversal':sum(p['sign_reversal'] for p in pairwise),
                           'pairwise':pairwise}}


if __name__ == '__main__':
    result=build();OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'piloto-2022.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    with (OUT/'piloto-2022.csv').open('w',newline='') as f:
        fields=['id','name','score','lower','upper','coverage_weight','educacao','trabalho','mobilidade','sensitivity_min','sensitivity_max']
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
        for r in result['rows']:
            w.writerow({**{k:r[k] for k in fields[:6]},**r['indicator_scores'],
                        'sensitivity_min':r['weight_sensitivity_range'][0], 'sensitivity_max':r['weight_sensitivity_range'][1]})
    print(json.dumps({'cities':len(result['rows']),'pair_reversals':result['sensitivity']['pairs_with_sign_reversal'],
                      'examples':[{k:r[k] for k in ['name','score','weight_sensitivity_range']} for r in result['rows'] if r['id'] in ['2611606','4106902']]},ensure_ascii=False))
