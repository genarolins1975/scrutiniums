"""Laboratório interno de sensibilidade. Não publica nem valida escores."""
import argparse
import json
import math
from pathlib import Path
from .fundacao import ROOT, aggregate, finite, normalize, validate_cards


def weighted_score(records, required_ids, weights, **context):
    # O mesmo gate da fundação precede qualquer experimento de pesos.
    baseline = aggregate(records, required_ids, **context)
    if set(weights) != set(required_ids) or any(not finite(w) or w <= 0 for w in weights.values()):
        raise ValueError('Todos os componentes devem ter peso positivo e finito')
    total = sum(weights.values())
    if not finite(total):
        raise ValueError('Soma de pesos inválida')
    if baseline['value'] is None:
        return baseline
    values = {r['id']: r['value'] for r in records}
    value = 0 if any(v == 0 for v in values.values()) else math.exp(
        sum(weights[k]/total * math.log(values[k]) for k in required_ids))
    return {'value': value, 'state': 'SIMULACAO_NAO_PUBLICAVEL', 'reasons': []}


def weight_sensitivity(records, required_ids, *, relative_change=0.2, **context):
    """Varia um peso por vez em ±20%; renormaliza a cesta completa, nunca exclui itens."""
    if not finite(relative_change) or not 0 < relative_change < 1:
        raise ValueError('Perturbação deve estar entre zero e um')
    weights = {k: 1.0 for k in required_ids}
    baseline = weighted_score(records, required_ids, weights, **context)
    scenarios = []
    for key in required_ids:
        for sign in (-1, 1):
            alternative = {**weights, key: 1 + sign*relative_change}
            result = weighted_score(records, required_ids, alternative, **context)
            scenarios.append({'component': key, 'relative_change': sign*relative_change,
                'weights': {k:v/sum(alternative.values()) for k,v in alternative.items()},
                'value': result['value'], 'state': result['state'], 'reasons': result['reasons'],
                'delta_points': None if result['value'] is None else result['value']-baseline['value']})
    values = [s['value'] for s in scenarios if s['value'] is not None]
    return {'purpose': 'SENSIBILIDADE_INTERNA_NAO_PUBLICA_ESCORE',
        'baseline': baseline, 'scenarios': scenarios,
        'scenario_range': None if not values else {'min': min(values), 'max': max(values)},
        'range_meaning': 'Faixa dos cenários escolhidos; não é intervalo de confiança.'}


def reference_sensitivity(value, reference, *, span_fraction=0.1):
    """Desloca cada âncora separadamente por ±10% da amplitude original."""
    if not finite(span_fraction) or not 0 < span_fraction < 0.5:
        raise ValueError('Perturbação de referência inválida')
    baseline = normalize(value, reference)
    if baseline is None:
        return {'state':'BLOQUEADO', 'baseline':None, 'scenarios':[],
            'reason':'VALOR_OU_REFERENCIA_PENDENTE'}
    step = span_fraction*(reference['upper']-reference['lower'])
    scenarios = []
    for bound in ('lower','upper'):
        for sign in (-1,1):
            candidate = {**reference, bound:reference[bound]+sign*step}
            result = normalize(value, candidate)
            scenarios.append({'bound':bound, 'shift':sign*step,
                'candidate_reference':{**candidate, 'validated':False}, 'value':result, 'delta_points':result-baseline})
    return {'state':'SIMULACAO_NAO_PUBLICAVEL','baseline':baseline,'scenarios':scenarios,
        'note':'Âncoras alternativas são hipóteses do laboratório, sem aprovação metodológica.'}


def demo():
    document = json.loads((ROOT/'pipeline/eficiencia_escores/fichas.json').read_text())
    validate_cards(document)
    ids = ['access','response','quality']
    context = dict(territory='SINTETICO_SEM_GEOGRAFIA',edition='LABORATORIO',comparison_window='CENARIO')
    cases = {}
    for name, values in {'equilibrado':[70,70,70], 'desigual':[95,95,20],
        'zero_observado':[80,0,75], 'dado_ausente':[80,None,75]}.items():
        rows = [dict(id=k,value=v,validated=True,state='CALCULAVEL_EXPERIMENTAL',**context)
                for k,v in zip(ids,values)]
        cases[name] = {'input':values, **weight_sensitivity(rows,ids,**context)}
    return {'purpose':'DEMONSTRACAO_SINTETICA_NAO_REPRESENTA_TERRITORIOS',
        'methodology_approved':False, 'real_scores_released':0,
        'real_card_readiness':{'cards':len(document['cards']),
            'validated_references':sum(c['reference']['validated'] for c in document['cards'])},
        'cases':cases, 'reference_example':reference_sensitivity(70,
            {'lower':0,'upper':100,'direction':'higher','validated':True})}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.resolve() == (ROOT/'public').resolve() or (ROOT/'public').resolve() in args.output.resolve().parents:
        parser.error('Laboratório deve permanecer fora de public/')
    result = demo()
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
    print(json.dumps({k:v['baseline'] for k,v in result['cases'].items()},ensure_ascii=False))

if __name__=='__main__': main()
