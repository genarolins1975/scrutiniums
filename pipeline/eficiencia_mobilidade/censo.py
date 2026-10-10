"""Distribuições do Censo 2022 com universo, denominador e originais próprios.

Não estima duração média pelas faixas, não transforma ida em ida/volta e não
projeta 2022 para o presente. '-' = zero absoluto (legenda oficial SIDRA).
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import pathlib
import urllib.parse
try:
    from .normalizar import gerar as gerar_pemob
    from .coletar import baixar
except ImportError:
    from normalizar import gerar as gerar_pemob
    from coletar import baixar

TOTAL = {'537':'31609','2088':'79488','86':'95251','469':'79176'}
UNIVERSO = ('Pessoas de 10 anos ou mais ocupadas na semana de referência, que trabalhavam fora do domicílio no trabalho principal e retornavam do trabalho para casa em três ou mais dias da semana. Não corresponde a toda a população nem a todas as viagens.')


def valor_censo(raw):
    if raw is None or str(raw).strip() == '': return None, 'nao_informado'
    s = str(raw).strip()
    if s == '-': return 0.0, 'observado'
    if s.upper() == 'X': return None, 'suprimido'
    if s == '..': return None, 'nao_aplicavel'
    if s == '...': return None, 'nao_disponivel'
    try:
        n = float(s)
    except (TypeError, ValueError):
        return None, 'invalido'
    if not math.isfinite(n) or n < 0: return None, 'invalido'
    return n, 'observado'


def razao(n, ns, d, ds):
    if ns != 'observado': return None, ns
    if ds != 'observado': return None, ds
    if d is None or n is None: return None, 'nao_informado'
    if d == 0: return None, 'nao_aplicavel'
    if n > d: return None, 'invalido'
    return 100 * n / d, 'observado'


def resultados(payload, dimension):
    if not isinstance(payload, list) or len(payload) != 1 or str(payload[0].get('id')) != '13376':
        raise ValueError('Resposta não corresponde à variável 13376')
    found = {}
    for result in payload[0]['resultados']:
        selected = {}
        for c in result['classificacoes']:
            categories = c.get('categoria', c.get('categorias'))
            if not isinstance(categories, dict) or len(categories) != 1:
                raise ValueError('Classificação ambígua')
            selected[str(c['id'])] = str(next(iter(categories)))
        if set(selected) != set(TOTAL): raise ValueError('Dimensões incompatíveis')
        for key, total in TOTAL.items():
            if key != dimension and selected[key] != total:
                raise ValueError('Resultado não é total nas dimensões complementares')
        category = selected[dimension]
        for series in result['series']:
            loc = series['localidade']; code = str(loc['id']); key = (code, category)
            if key in found: raise ValueError('Chave IBGE repetida')
            found[key] = {'raw':series['serie'].get('2022'),'name':loc['nome'],'level':loc['nivel']['id']}
    if not found: raise ValueError('Consulta sem resultados')
    return found


def gerar(origem, saida, offline=False):
    gold = gerar_pemob(origem, saida, offline)
    n_pemob = len(gold['territories'])
    manifest = json.loads((origem/'manifesto.json').read_text())
    sources = {f['arquivo']:f for f in manifest['fontes']}
    meta = json.loads((origem/'ibge_metadados_10330.json').read_bytes())
    classes = {str(c['id']): c for c in meta['classificacoes']}
    territories = {t['id']:t for t in gold['territories']}
    mun = {str(m['id']):m for m in json.loads((origem/'municipios.json').read_bytes())}
    ufmap = {}
    for m in mun.values():
        micro=m.get('microrregiao')
        uf=(micro['mesorregiao']['UF'] if micro else m['regiao-imediata']['regiao-intermediaria']['UF'])
        ufmap[str(uf['id'])] = uf['sigla']
    all_totals = {}
    leaf_counts = {}
    reconciliation = []
    for dimension, group in [('537','tempo'),('2088','modos')]:
        categories = {str(c['id']):c for c in classes[dimension]['categorias']}
        if TOTAL[dimension] not in categories: raise ValueError('Total da classificação mudou')
        filename = 'censo_2022_'+group+'.json'
        query = urllib.parse.urlencode({'localidades':'N1[all]|N3[all]|N6[all]','classificacao':'|'.join(k+'['+('all' if k==dimension else v)+']' for k,v in TOTAL.items())})
        url = 'https://servicodados.ibge.gov.br/api/v3/agregados/10330/periodos/2022/variaveis/13376?'+query
        path=origem/filename
        if not path.exists():
            if offline: raise ValueError('Original ausente: '+filename)
            sources[filename]=baixar(filename,url,origem)
        source=sources.get(filename)
        if not source or source['estado']!='coletado': raise ValueError('Coleta incompleta: '+filename)
        if hashlib.sha256(path.read_bytes()).hexdigest()!=source['sha256']: raise ValueError('Hash divergente: '+filename)
        values=resultados(json.loads(path.read_bytes()),dimension)
        if not any(k[0]=='1' for k in values): raise ValueError('Brasil ausente na resposta')
        codes=sorted({k[0] for k in values})
        for (code,cat), item in values.items():
            if cat not in categories: raise ValueError('Categoria desconhecida')
            if code not in territories:
                level=item['level']
                if level=='N6':
                    if code not in mun: raise ValueError('Código municipal não reconciliado: '+code)
                    territories[code]={'id':code,'name':mun[code]['nome'],'uf':ufmap[code[:2]],'level':'municipio'}
                elif level=='N3': territories[code]={'id':code,'name':item['name'],'uf':ufmap[code],'level':'uf'}
                elif level=='N1': territories[code]={'id':code,'name':'Brasil','uf':'','level':'brasil'}
                else: raise ValueError('Grão territorial inesperado: '+level)
        for cat, category in categories.items():
            if cat==TOTAL[dimension]: continue
            if category['nivel']!=1: raise ValueError('Hierarquia de categorias mudou')
            metric='censo.'+group+'.'+cat
            title=('Tempo: ' if group=='tempo' else 'Meio principal: ')+category['nome']
            gold['metrics'].append({'id':metric,'title':title,'section':'tempo','unit':'%','period':'2022','source':filename,'definition':'100 × pessoas na categoria / total do mesmo território e universo. '+category['nome']+'.','universe':UNIVERSO,'warning':'Retrato do Censo 2022, não situação atual. Estimativas amostrais; diferenças pequenas e recortes municipais exigem cautela. O modo é aquele em que a pessoa passa mais tempo, não todas as etapas da viagem.','reference':'brasil','group':group})
            for code in codes:
                item=values.get((code,cat),{}); denominator=values.get((code,TOTAL[dimension]),{})
                n, ns=valor_censo(item.get('raw')); d, ds=valor_censo(denominator.get('raw'))
                value,state=razao(n,ns,d,ds)
                gold['observations'].append({'territory':code,'metric':metric,'period':'2022','value':value,'state':state,'raw':item.get('raw'),'cell':'10330/13376/'+dimension+'/'+cat,'numerator':n,'denominator':d})
                if group=='tempo': leaf_counts[(code,cat)]=(n,ns)
        totals={code:valor_censo(item['raw']) for (code,cat),item in values.items() if cat==TOTAL[dimension]}
        if all_totals and totals!=all_totals: raise ValueError('Denominadores diferem entre tempo e modos')
        all_totals=totals
        # Valores de pessoas são estimativas arredondadas: tolerância em contagens,
        # nunca normalização artificial das parcelas para completar 100%.
        for code,(den,ds) in totals.items():
            leaves=[valor_censo(values.get((code,c),{}).get('raw')) for c in categories if c!=TOTAL[dimension]]
            if ds=='observado' and all(s=='observado' for _,s in leaves):
                delta=sum(v for v,_ in leaves)-den
                if abs(delta)>len(leaves): raise ValueError('Categorias não reconciliam: '+code+'/'+group)
                if delta: reconciliation.append({'territory':code,'group':group,'roundingDifference':delta})
        print('CENSO',group,'territórios',len(totals),'células',len(values))
    gold['metrics'].append({'id':'censo.tempo.longo','title':'Mais de uma hora até o trabalho','section':'tempo','unit':'%','period':'2022','source':'censo_2022_tempo.json','definition':'100 × soma das três faixas acima de uma hora / total do mesmo território. Não calcula a duração média nem tempo de ida e volta.','universe':UNIVERSO,'warning':'Censo 2022; situação histórica. Estimativas amostrais. Depende das três faixas e do denominador válidos.','reference':'brasil','group':'resumo'})
    for code,(d,ds) in sorted(all_totals.items()):
        parts=[leaf_counts.get((code,cat),(None,'nao_informado')) for cat in ['19432','79191','79192']]
        n=sum(p[0] for p in parts) if all(p[0] is not None for p in parts) else None
        ns=next((s for _,s in parts if s!='observado'),'observado')
        value,state=razao(n,ns,d,ds)
        gold['observations'].append({'territory':code,'metric':'censo.tempo.longo','period':'2022','value':value,'state':state,'raw':None,'cell':'10330/13376/537/19432+79191+79192','numerator':n,'denominator':d})
    gold['territories']=sorted(territories.values(),key=lambda t:t['id'])
    gold['sources']=list(sources.values()); gold['edition']='Integração Pemob 2025 e Censo 2022'
    gold['gaps']=[g for g in gold['gaps'] if g['section']!='tempo']
    gold['reconciliation']={'rounding':reconciliation,'rule':'Diferença máxima: número de categorias, em pessoas estimadas. Percentuais não reescalados.'}
    keys=[(o['territory'],o['metric'],o['period']) for o in gold['observations']]
    if len(keys)!=len(set(keys)): raise ValueError('Observação duplicada no conjunto')
    payload=json.dumps(gold,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
    (saida/'gold.json').write_bytes(payload); sha=hashlib.sha256(payload).hexdigest()
    (saida/'gold.sha256').write_text(sha+'\n')
    summary={'municipios_pemob':n_pemob,'territorios_censo':len(all_totals),'territorios':len(territories),'indicadores':len(gold['metrics']),'observacoes':len(gold['observations']),'validas':sum(o['state']=='observado' for o in gold['observations']),'sha256':sha}
    (saida/'resumo.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
    (origem/'manifesto.json').write_text(json.dumps({**manifest,'fontes':list(sources.values())},ensure_ascii=False,indent=2))
    print('RESUMO_CENSO',json.dumps(summary,ensure_ascii=False)); return gold

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--origem',type=pathlib.Path,required=True);p.add_argument('--saida',type=pathlib.Path,required=True);p.add_argument('--offline',action='store_true');a=p.parse_args();gerar(a.origem,a.saida,a.offline)
