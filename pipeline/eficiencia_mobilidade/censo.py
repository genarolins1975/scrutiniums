"""Censo 2022: parcelas sobre o total publicado e reconciliação explícita.

O total da tabela não coincide necessariamente com a soma de suas categorias.
Nunca reescala parcelas para 100%, nunca atribui o resíduo a uma causa presumida.
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

TOTAL={'537':'31609','2088':'79488','86':'95251','469':'79176'}
UNIVERSO=('Pessoas de 10 anos ou mais ocupadas na semana de referência, que trabalhavam fora do domicílio no trabalho principal e retornavam do trabalho para casa em três ou mais dias da semana. Não corresponde a toda a população nem a todas as viagens.')
AVISO=('Censo 2022, não situação atual. Estimativas amostrais: pequenas diferenças não sustentam rankings. As categorias publicadas não esgotam necessariamente o total; a diferença é exibida separadamente, sem atribuir causa. O meio principal é aquele em que se passa mais tempo, não todas as etapas da viagem.')


def valor_censo(raw):
    if raw is None or str(raw).strip()=='':return None,'nao_informado'
    s=str(raw).strip()
    if s=='-':return 0.0,'observado'
    if s.upper()=='X':return None,'suprimido'
    if s=='..':return None,'nao_aplicavel'
    if s=='...':return None,'nao_disponivel'
    try:n=float(s)
    except (TypeError,ValueError):return None,'invalido'
    if not math.isfinite(n) or n<0:return None,'invalido'
    return n,'observado'


def razao(n,ns,d,ds):
    if ns!='observado':return None,ns
    if ds!='observado':return None,ds
    if d is None or n is None:return None,'nao_informado'
    if d==0:return None,'nao_aplicavel'
    if n>d or n<0:return None,'invalido'
    return 100*n/d,'observado'


def residuo(d,ds,parcelas):
    """Somente com TODAS as células observadas; nunca infere célula suprimida."""
    if ds!='observado':return None,ds
    estado=next((s for _,s in parcelas if s!='observado'),'observado')
    if estado!='observado':return None,estado
    if d is None or any(v is None for v,_ in parcelas):return None,'nao_informado'
    diferenca=d-sum(v for v,_ in parcelas)
    # Pequenas diferenças negativas são preservadas no diagnóstico, sem truncar
    # a zero nem alterar parcelas. Um excesso maior bloqueia a promoção.
    if diferenca < -len(parcelas):raise ValueError('Soma das categorias excede o total além da margem de arredondamento')
    return diferenca,'observado' if diferenca>=0 else 'invalido'


def resultados(payload,dimension):
    if not isinstance(payload,list) or len(payload)!=1 or str(payload[0].get('id'))!='13376':raise ValueError('Resposta não corresponde à variável 13376')
    found={}
    for result in payload[0]['resultados']:
        selected={}
        for c in result['classificacoes']:
            cats=c.get('categoria',c.get('categorias'))
            if not isinstance(cats,dict) or len(cats)!=1:raise ValueError('Classificação ambígua')
            selected[str(c['id'])]=str(next(iter(cats)))
        if set(selected)!=set(TOTAL):raise ValueError('Dimensões incompatíveis')
        for key,total in TOTAL.items():
            if key!=dimension and selected[key]!=total:raise ValueError('Resultado não é total nas dimensões complementares')
        for series in result['series']:
            loc=series['localidade'];code=str(loc['id']);key=(code,selected[dimension])
            if key in found:raise ValueError('Chave IBGE repetida')
            found[key]={'raw':series['serie'].get('2022'),'name':loc['nome'],'level':loc['nivel']['id']}
    if not found:raise ValueError('Consulta sem resultados')
    return found


def gerar(origem,saida,offline=False):
    gold=gerar_pemob(origem,saida,offline);n_pemob=len(gold['territories'])
    manifest=json.loads((origem/'manifesto.json').read_text());sources={f['arquivo']:f for f in manifest['fontes']}
    meta=json.loads((origem/'ibge_metadados_10330.json').read_bytes());classes={str(c['id']):c for c in meta['classificacoes']}
    territories={t['id']:t for t in gold['territories']}
    mun={str(m['id']):m for m in json.loads((origem/'municipios.json').read_bytes())};ufmap={}
    for m in mun.values():
        micro=m.get('microrregiao');uf=micro['mesorregiao']['UF'] if micro else m['regiao-imediata']['regiao-intermediaria']['UF']
        ufmap[str(uf['id'])]=uf['sigla']
    all_totals={};leaf_counts={};reconciliation=[]
    for dimension,group in [('537','tempo'),('2088','modos')]:
        categories={str(c['id']):c for c in classes[dimension]['categorias']}
        if TOTAL[dimension] not in categories:raise ValueError('Total da classificação mudou')
        filename='censo_2022_'+group+'.json'
        query=urllib.parse.urlencode({'localidades':'N1[all]|N3[all]|N6[all]','classificacao':'|'.join(k+'['+('all' if k==dimension else v)+']' for k,v in TOTAL.items())})
        url='https://servicodados.ibge.gov.br/api/v3/agregados/10330/periodos/2022/variaveis/13376?'+query
        path=origem/filename
        if not path.exists():
            if offline:raise ValueError('Original ausente: '+filename)
            sources[filename]=baixar(filename,url,origem)
        source=sources.get(filename)
        if not source or source['estado']!='coletado':raise ValueError('Coleta incompleta: '+filename)
        if hashlib.sha256(path.read_bytes()).hexdigest()!=source['sha256']:raise ValueError('Hash divergente: '+filename)
        values=resultados(json.loads(path.read_bytes()),dimension);codes=sorted({k[0] for k in values})
        if '1' not in codes:raise ValueError('Brasil ausente')
        for (code,cat),item in values.items():
            if cat not in categories:raise ValueError('Categoria desconhecida')
            if code not in territories:
                level=item['level']
                if level=='N6':
                    if code not in mun:raise ValueError('Município não reconciliado: '+code)
                    territories[code]={'id':code,'name':mun[code]['nome'],'uf':ufmap[code[:2]],'level':'municipio'}
                elif level=='N3':territories[code]={'id':code,'name':item['name'],'uf':ufmap[code],'level':'uf'}
                elif level=='N1':territories[code]={'id':code,'name':'Brasil','uf':'','level':'brasil'}
                else:raise ValueError('Nível territorial inesperado')
        leaves=[c for c in categories if c!=TOTAL[dimension]]
        for cat in leaves:
            category=categories[cat]
            if category['nivel']!=1:raise ValueError('Hierarquia mudou')
            metric='censo.'+group+'.'+cat
            gold['metrics'].append({'id':metric,'title':('Tempo: ' if group=='tempo' else 'Meio principal: ')+category['nome'],'section':'tempo','unit':'%','period':'2022','source':filename,'definition':'100 × pessoas na categoria / total publicado para o mesmo território e universo. '+category['nome']+'.','universe':UNIVERSO,'warning':AVISO,'reference':'brasil','group':group})
            for code in codes:
                item=values.get((code,cat),{});den=values.get((code,TOTAL[dimension]),{})
                n,ns=valor_censo(item.get('raw'));d,ds=valor_censo(den.get('raw'));v,state=razao(n,ns,d,ds)
                gold['observations'].append({'territory':code,'metric':metric,'period':'2022','value':v,'state':state,'raw':item.get('raw'),'cell':'10330/13376/'+dimension+'/'+cat,'numerator':n,'denominator':d})
                if group=='tempo':leaf_counts[(code,cat)]=(n,ns)
        totals={code:valor_censo(item['raw']) for (code,cat),item in values.items() if cat==TOTAL[dimension]}
        if all_totals and totals!=all_totals:raise ValueError('Denominadores diferem entre tempo e modos')
        all_totals=totals
        mid='censo.'+group+'.residuo'
        gold['metrics'].append({'id':mid,'title':('Tempo: ' if group=='tempo' else 'Meio principal: ')+'diferença entre total e categorias (calculada)','section':'tempo','unit':'%','period':'2022','source':filename,'definition':'100 × (total publicado − soma de todas as categorias publicadas) / total. Diagnóstico calculado pelo OBEE; não é uma categoria do IBGE. Não é calculado se houver célula suprimida ou ausente.','universe':UNIVERSO,'warning':'Diferença aritmética, sem causa determinada nesta integração. Não deve ser interpretada como não resposta, modalidade de transporte ou erro da fonte. Não foram redistribuídos valores para completar 100%. '+AVISO,'reference':'brasil','group':group})
        for code,(d,ds) in sorted(totals.items()):
            parts=[valor_censo(values.get((code,cat),{}).get('raw')) for cat in leaves]
            delta,ns=residuo(d,ds,parts);v,state=razao(delta,ns,d,ds)
            gold['observations'].append({'territory':code,'metric':mid,'period':'2022','value':v,'state':state,'raw':None,'cell':'10330/13376/'+dimension+'/total-menos-categorias','numerator':delta if ns=='observado' else None,'denominator':d})
            reconciliation.append({'territory':code,'group':group,'total':d,'difference':delta,'state':ns,'share':v})
        print('CENSO',group,'territórios',len(totals),'células',len(values),'resíduo nacional',next(r for r in reconciliation if r['territory']=='1' and r['group']==group))
    gold['metrics'].append({'id':'censo.tempo.longo','title':'Mais de uma hora até o trabalho','section':'tempo','unit':'%','period':'2022','source':'censo_2022_tempo.json','definition':'100 × soma das três faixas publicadas acima de uma hora / total publicado no território. Não inclui nem distribui o resíduo não classificado; não calcula duração média ou ida e volta.','universe':UNIVERSO,'warning':AVISO,'reference':'brasil','group':'resumo'})
    for code,(d,ds) in sorted(all_totals.items()):
        parts=[leaf_counts.get((code,cat),(None,'nao_informado')) for cat in ['19432','79191','79192']]
        n=sum(p[0] for p in parts) if all(p[0] is not None for p in parts) else None
        ns=next((s for _,s in parts if s!='observado'),'observado');v,state=razao(n,ns,d,ds)
        gold['observations'].append({'territory':code,'metric':'censo.tempo.longo','period':'2022','value':v,'state':state,'raw':None,'cell':'10330/13376/537/19432+79191+79192','numerator':n,'denominator':d})
    gold['territories']=sorted(territories.values(),key=lambda t:t['id']);gold['sources']=list(sources.values());gold['edition']='Pemob 2025 e Censo 2022 com resíduos explícitos'
    gold['gaps']=[g for g in gold['gaps'] if g['section']!='tempo']
    gold['gaps'].append({'section':'tempo','reason':'O total publicado pelo IBGE excede a soma das categorias nacionais de tempo e de modo. A diferença é mostrada como diagnóstico calculado, com causa não determinada; nenhuma parcela foi reescalada. Não foram integrados intervalos de confiança nem cruzamentos por renda, sexo ou cor/raça.'})
    gold['reconciliation']={'items':reconciliation,'rule':'Total menos categorias, preservado sem reescalonamento. Excesso da soma além do número de categorias bloqueia a promoção. Diferença nunca é calculada a partir de células suprimidas.'}
    keys=[(o['territory'],o['metric'],o['period']) for o in gold['observations']]
    if len(keys)!=len(set(keys)):raise ValueError('Observação duplicada')
    payload=json.dumps(gold,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode();(saida/'gold.json').write_bytes(payload);sha=hashlib.sha256(payload).hexdigest();(saida/'gold.sha256').write_text(sha+'\n')
    summary={'municipios_pemob':n_pemob,'territorios_censo':len(all_totals),'territorios':len(territories),'indicadores':len(gold['metrics']),'observacoes':len(gold['observations']),'validas':sum(o['state']=='observado' for o in gold['observations']),'bytes':len(payload),'sha256':sha}
    (saida/'resumo.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));(origem/'manifesto.json').write_text(json.dumps({**manifest,'fontes':list(sources.values())},ensure_ascii=False,indent=2))
    print('RESUMO_CENSO',json.dumps(summary,ensure_ascii=False));return gold

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--origem',type=pathlib.Path,required=True);p.add_argument('--saida',type=pathlib.Path,required=True);p.add_argument('--offline',action='store_true');a=p.parse_args();gerar(a.origem,a.saida,a.offline)
