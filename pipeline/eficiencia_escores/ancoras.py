"""Propaga hipóteses de âncoras pela hierarquia, sem aprovar referências."""
import argparse
import copy
import json
from pathlib import Path
from .fundacao import ROOT, PILLARS, finite
from .calibracao import reference_sensitivity
from .hierarquia import normalize_profile, hierarchy, relation, demo as hierarchy_demo


def compare_references(a, b, basket, references, *, span_fraction=0.1):
    """Recebe perfis com raw_value e referências comuns explicitamente validadas.

    Cenários são cálculos contrafactuais internos sobre uma base elegível. As
    referências alternativas retornam validated=False; não são promovidas a fichas.
    """
    if not finite(span_fraction) or not 0 < span_fraction < 0.5:
        raise ValueError('Perturbação de referência inválida')
    expected = {f'{c}.{p}' for c in basket for p in PILLARS}
    if not basket or len(set(basket)) != len(basket) or set(references) != expected:
        raise ValueError('Cesta ou referências incompatíveis')
    for key in ('edition', 'comparison_window'):
        if a['context'][key] != b['context'][key]:
            raise ValueError('Edição ou janela incompatível')
    normalized = [normalize_profile(p['records'], references) for p in (a, b)]
    cw, pw = dict.fromkeys(basket, 1), dict.fromkeys(PILLARS, 1)
    def run(rows):
        results = [hierarchy(r, basket, cw, pw, **p['context'])
                   for r, p in zip(rows, (a, b))]
        av, bv = [r['aggregate']['value'] for r in results]
        return dict(a=results[0], b=results[1], relation=relation(av, bv),
                    difference=None if av is None or bv is None else av-bv)
    baseline = run(normalized)
    output = dict(purpose='ANCORAS_HIERARQUICAS_NAO_PUBLICAVEIS', publishable=False,
                  methodology_approved=False, baseline=baseline, scenarios=[])
    if baseline['relation'] == 'INCOMPARAVEL':
        return {**output, 'state':'BLOQUEADO', 'summary':{'scenarios':0, 'order_reversals':0}}
    scenarios = []
    for component in sorted(expected):
        rows = [next(r for r in profile if r['id'] == component) for profile in normalized]
        alternatives = [reference_sensitivity(r['raw_value'], references[component],
                        span_fraction=span_fraction)['scenarios'] for r in rows]
        for left, right in zip(*alternatives):
            changed = copy.deepcopy(normalized)
            for profile, alternative in zip(changed, (left, right)):
                row = next(r for r in profile if r['id'] == component)
                # Reutiliza somente o gate da base elegível para cálculo interno.
                # A hipótese não é uma nova referência validada.
                row['value'] = alternative['value']
            result = run(changed)
            result['order_reversal'] = {baseline['relation'], result['relation']} == {'A_MAIOR','B_MAIOR'}
            result['delta_aggregate'] = {k:result[k]['aggregate']['value']-baseline[k]['aggregate']['value'] for k in ('a','b')}
            scenarios.append(dict(component=component, bound=left['bound'], shift=left['shift'],
                candidate_reference=left['candidate_reference'],
                normalized_values=dict(a=left['value'], b=right['value']),
                at_boundary={k:s['value'] in (0,100) for k,s in zip(('a','b'),(left,right))}, **result))
    return {**output, 'state':'SIMULACAO_NAO_PUBLICAVEL', 'scenarios':scenarios,
        'summary':{'scenarios':len(scenarios), 'order_reversals':sum(s['order_reversal'] for s in scenarios),
                   'boundary_scenarios':sum(any(s['at_boundary'].values()) for s in scenarios)},
        'limitations':['Uma âncora de um componente por vez; pesos iguais e fixos.',
                      'A mesma hipótese é aplicada aos dois perfis.',
                      'Faixas não são intervalos de confiança; inversões não são probabilidades.',
                      'Referências alternativas não aprovadas; ausência de inversão não comprova robustez.']}


def demo():
    source=hierarchy_demo()
    profiles=source['input_profiles']
    basket=json.loads((ROOT/'pipeline/eficiencia_escores/fichas.json').read_text())['basket']
    refs={r['id']:dict(lower=0,upper=100,direction='higher',validated=True)
          for r in profiles['a']['records']}
    return dict(data_kind='SINTETICO_SEM_TERRITORIOS_REAIS', real_scores_released=0,
                **compare_references(profiles['a'],profiles['b'],basket,refs))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args(); target=args.output.resolve(); public=(ROOT/'public').resolve()
    if target==public or public in target.parents:
        parser.error('Diagnóstico interno fora de public/')
    result=demo(); target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
    print(json.dumps(result['summary']))

if __name__=='__main__': main()
