"""Cenários conjuntos explícitos: pesos e âncoras, sem publicação de escores."""
import argparse
import copy
import itertools
import json
from pathlib import Path
from .fundacao import ROOT, PILLARS, finite
from .hierarquia import normalize_profile, hierarchy, relation, demo as hierarchy_demo


def compare_joint(a, b, basket, references, scenarios):
    expected={f'{c}.{p}' for c in basket for p in PILLARS}
    if not basket or len(set(basket))!=len(basket) or set(references)!=expected:
        raise ValueError('Cesta ou referências incompatíveis')
    if any(a['context'][k]!=b['context'][k] for k in ('edition','comparison_window')):
        raise ValueError('Edição ou janela incompatível')
    # Exige aprovação booleana explícita na base; hipóteses nunca mudam esse estado.
    base_refs={k:{**r,'validated':r.get('validated') is True} for k,r in references.items()}
    normalized=[normalize_profile(p['records'],base_refs) for p in (a,b)]
    cw=dict.fromkeys(basket,1); pw=dict.fromkeys(PILLARS,1)
    def run(rows,chapters,pillars):
        results=[hierarchy(r,basket,chapters,pillars,**p['context']) for r,p in zip(rows,(a,b))]
        av,bv=[r['aggregate']['value'] for r in results]
        return dict(a=results[0],b=results[1],relation=relation(av,bv),
                    difference=None if av is None or bv is None else av-bv)
    baseline=run(normalized,cw,pw)
    output=dict(purpose='SENSIBILIDADE_CONJUNTA_INTERNA',publishable=False,
                methodology_approved=False,baseline=baseline,scenarios=[])
    if baseline['relation']=='INCOMPARAVEL':
        return {**output,'state':'BLOQUEADO','summary':{'scenarios':0,'order_reversals':0}}
    ids=[s['id'] for s in scenarios]
    if not ids or any(not isinstance(x,str) or not x for x in ids) or len(set(ids))!=len(ids):
        raise ValueError('Cenários vazios ou identificadores inválidos/duplicados')
    results=[]
    for scenario in scenarios:
        if set(scenario)-{'id','chapter_weights','pillar_weights','reference_shifts'}:
            raise ValueError('Campo de cenário desconhecido')
        chapters=scenario.get('chapter_weights',cw); pillars=scenario.get('pillar_weights',pw)
        shifts=scenario.get('reference_shifts',{})
        if set(shifts)-expected: raise ValueError('Componente desconhecido')
        changed=copy.deepcopy(normalized); candidates={}
        for key,shift in shifts.items():
            if set(shift)-{'lower','upper'}: raise ValueError('Âncora desconhecida')
            ref=references[key]; span=ref['upper']-ref['lower']
            if any(not finite(v) or abs(v)>=.5 for v in shift.values()):
                raise ValueError('Deslocamento deve ser finito e menor que meia amplitude')
            low=ref['lower']+span*shift.get('lower',0); high=ref['upper']+span*shift.get('upper',0)
            if not finite(low) or not finite(high) or high<=low: raise ValueError('Âncoras inválidas')
            candidates[key]={**ref,'lower':low,'upper':high,'validated':False}
            # Normalização contrafactual explícita, sem promover hipóteses a referências aprovadas.
            for profile in changed:
                row=next(r for r in profile if r['id']==key)
                value=100*(row['raw_value']-low)/(high-low)
                row['value']=min(100,max(0,value if ref['direction']=='higher' else 100-value))
        result=run(changed,chapters,pillars)
        results.append(dict(id=scenario['id'],hypothesis=copy.deepcopy(scenario),
            candidate_references=candidates,
            effective_weights={'chapters':{k:v/sum(chapters.values()) for k,v in chapters.items()},
                               'pillars':{k:v/sum(pillars.values()) for k,v in pillars.items()}},
            delta_aggregate={k:result[k]['aggregate']['value']-baseline[k]['aggregate']['value'] for k in ('a','b')},
            order_reversal={baseline['relation'],result['relation']}=={'A_MAIOR','B_MAIOR'}, **result))
    return {**output,'state':'SIMULACAO_NAO_PUBLICAVEL','scenarios':results,
        'summary':{'scenarios':len(results),'order_reversals':sum(r['order_reversal'] for r in results),
            'aggregate_ranges':{k:{'min':min(r[k]['aggregate']['value'] for r in results),
                                   'max':max(r[k]['aggregate']['value'] for r in results)} for k in ('a','b')}},
        'limitations':['Resultados condicionais às hipóteses declaradas; não são probabilidades.',
                      'Faixas de cenários não são intervalos de confiança.',
                      'Nenhuma validação empírica ou aprovação metodológica.',
                      'Um desenho restrito de cenários não cobre todas as combinações possíveis.']}


def factorial_scenarios(basket):
    """16 combinações dos extremos de quatro fatores predefinidos; não amostragem aleatória."""
    scenarios=[]
    for i,(c,p,lo,hi) in enumerate(itertools.product((-1,1),repeat=4),1):
        scenarios.append(dict(id=f'F{i:02d}',
            chapter_weights={k:1+.2*c if k=='education' else 1 for k in basket},
            pillar_weights={k:1+.2*p if k=='access' else 1 for k in PILLARS},
            reference_shifts={'education.access':{'lower':.1*lo},'health.quality':{'upper':.1*hi}}))
    return scenarios


def demo():
    profiles=hierarchy_demo()['input_profiles']
    basket=json.loads((ROOT/'pipeline/eficiencia_escores/fichas.json').read_text())['basket']
    refs={r['id']:dict(lower=0,upper=100,direction='higher',validated=True) for r in profiles['a']['records']}
    return dict(data_kind='SINTETICO_SEM_TERRITORIOS_REAIS',real_scores_released=0,
                design='Fatorial completo 2^4 dos quatro fatores selecionados; pesos ±20%, âncoras ±10% da amplitude.',
                **compare_joint(profiles['a'],profiles['b'],basket,refs,factorial_scenarios(basket)))


def main():
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args(); target=args.output.resolve(); public=(ROOT/'public').resolve()
    if target==public or public in target.parents: parser.error('Diagnóstico interno fora de public/')
    result=demo(); target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
    print(json.dumps(result['summary']))

if __name__=='__main__': main()
