"""Calibração hierárquica interna: pilares, capítulos e comparação entre perfis."""
import argparse
import json
from pathlib import Path
from .fundacao import ROOT, PILLARS, normalize, finite
from .calibracao import weighted_score


def hierarchy(records, basket, chapter_weights, pillar_weights, **context):
    if not basket or len(set(basket)) != len(basket):
        raise ValueError('Cesta vazia ou duplicada')
    expected = {f'{c}.{p}' for c in basket for p in PILLARS}
    ids = [r['id'] for r in records]
    if len(ids) != len(set(ids)) or set(ids)-expected:
        raise ValueError('Componente duplicado ou fora da cesta')
    chapters = []
    for chapter in basket:
        rows = [{**r, 'id':r['id'].split('.')[1]} for r in records if r['id'].startswith(chapter+'.')]
        result = weighted_score(rows,list(PILLARS),pillar_weights,**context)
        chapters.append({'id':chapter, **result})
    # Conversão transitória para o contrato do gate; a saída continua não publicável.
    aggregate_rows = [{**r, 'validated':r['value'] is not None,
        'state':'CALCULAVEL_EXPERIMENTAL' if r['value'] is not None else 'BLOQUEADO', **context}
        for r in chapters]
    score = weighted_score(aggregate_rows,basket,chapter_weights,**context)
    return {'chapters':chapters,'aggregate':score,'publishable':False}


def normalize_profile(records, references):
    """Exige referência explícita por componente; não aprova referências pendentes."""
    if set(references) != {r['id'] for r in records}:
        raise ValueError('Referências não correspondem aos componentes fornecidos')
    return [{**r, 'reference_context':{k:references[r['id']].get(k) for k in ('lower','upper','direction')}, 'value':normalize(r.get('raw_value'),references[r['id']]),
        'validated':r.get('validated') is True and references[r['id']].get('validated') is True}
        for r in records]


def relation(a,b):
    if a is None or b is None:
        return 'INCOMPARAVEL'
    if abs(a-b)<=1e-9:
        return 'EMPATE_NUMERICO'
    return 'A_MAIOR' if a>b else 'B_MAIOR'


def compare_profiles(a,b,basket,*,relative_change=0.2):
    if not finite(relative_change) or not 0<relative_change<1:
        raise ValueError('Perturbação inválida')
    for key in ('edition','comparison_window'):
        if a['context'][key] != b['context'][key]:
            raise ValueError('Perfis de edições ou janelas diferentes')
    refs_a={r['id']:r.get('reference_context') for r in a['records']}
    refs_b={r['id']:r.get('reference_context') for r in b['records']}
    for key in refs_a.keys() & refs_b.keys():
        if refs_a[key] is None or refs_a[key] != refs_b[key]:
            raise ValueError('Referências de normalização incompatíveis')
    chapters=dict.fromkeys(basket,1.0); pillars=dict.fromkeys(PILLARS,1.0)
    def run(cw,pw):
        left=hierarchy(a['records'],basket,cw,pw,**a['context'])
        right=hierarchy(b['records'],basket,cw,pw,**b['context'])
        av,bv=left['aggregate']['value'],right['aggregate']['value']
        return {'a':left,'b':right,'relation':relation(av,bv),
                'difference':None if av is None or bv is None else av-bv}
    baseline=run(chapters,pillars)
    scenarios=[]
    for level,weights in (('chapter',chapters),('pillar',pillars)):
        for key in weights:
            for sign in (-1,1):
                changed={**weights,key:1+sign*relative_change}
                result=run(changed if level=='chapter' else chapters,
                           changed if level=='pillar' else pillars)
                flipped={baseline['relation'],result['relation']}=={'A_MAIOR','B_MAIOR'}
                scenarios.append({'level':level,'component':key,'relative_change':sign*relative_change,
                    'effective_weights':{k:v/sum(changed.values()) for k,v in changed.items()},
                    **result,'order_reversal':flipped,
                    'relation_changed':result['relation']!=baseline['relation']})
    comparable=sum(s['relation']!='INCOMPARAVEL' for s in scenarios)
    return {'purpose':'LABORATORIO_HIERARQUICO_NAO_PUBLICAVEL','baseline':baseline,
        'scenarios':scenarios,'summary':{'scenarios':len(scenarios),'comparable':comparable,
        'order_reversals':sum(s['order_reversal'] for s in scenarios),
        'assessment':'BLOQUEADO' if comparable<len(scenarios) else 'CENARIOS_CALCULADOS_SEM_APROVACAO'},
        'limitations':['Um peso alterado por cenário; não cobre perturbações simultâneas.',
        'Pesos de pilares são comuns aos capítulos.',
        'Inversões são descritivas, sem teste de significância ou probabilidade.',
        'Ausência de inversão não demonstra robustez fora dos cenários testados.']}


def demo():
    basket=json.loads((ROOT/'pipeline/eficiencia_escores/fichas.json').read_text())['basket']
    def profile(label,values):
        context=dict(territory=label,edition='SINTETICA',comparison_window='CENARIO')
        rows=[dict(id=f'{c}.{p}',raw_value=v,validated=True,state='CALCULAVEL_EXPERIMENTAL',**context)
              for c,v in zip(basket,values) for p in PILLARS]
        refs={r['id']:dict(lower=0,upper=100,direction='higher',validated=True) for r in rows}
        return {'context':context,'records':normalize_profile(rows,refs)}
    a=profile('PERFIL_SINTETICO_A',[95,50,70,70,70]);b=profile('PERFIL_SINTETICO_B',[70]*5)
    return {'data_kind':'SINTETICO_SEM_TERRITORIOS_REAIS','real_scores_released':0,
            'input_profiles':{'a':a,'b':b}, **compare_profiles(a,b,basket)}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    public=(ROOT/'public').resolve();target=args.output.resolve()
    if target==public or public in target.parents: parser.error('Diagnóstico interno fora de public/')
    result=demo();target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
    print(json.dumps(result['summary']))

if __name__=='__main__': main()
