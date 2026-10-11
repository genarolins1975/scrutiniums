"""Consultas pequenas e junção verificável, sem ultrapassar o limite da API."""
from __future__ import annotations
import hashlib
import json
import pathlib
import urllib.parse
try:
    from .coletar import baixar
except ImportError:
    from coletar import baixar


def obter_dimensao(origem:pathlib.Path,sources:dict,dimension:str,categories:dict,totals:dict,offline:bool):
    nomes=[];resultados=[];parts=[]
    cats=list(categories)
    # Até seis categorias por chamada. Metadados definem o universo de categorias.
    for start in range(0,len(cats),6):
        nome='censo_2022_'+dimension+'_parte_'+str(start//6+1)+'.json'
        selected=','.join(cats[start:start+6])
        classification='|'.join(k+'['+(selected if k==dimension else v)+']' for k,v in totals.items())
        query=urllib.parse.urlencode({'localidades':'N1[all]|N3[all]|N6[all]','classificacao':classification})
        url='https://servicodados.ibge.gov.br/api/v3/agregados/10330/periodos/2022/variaveis/13376?'+query
        path=origem/nome
        if not path.exists():
            if offline:raise ValueError('Parte original ausente: '+nome)
            sources[nome]=baixar(nome,url,origem)
        source=sources.get(nome)
        if not source or source.get('estado')!='coletado':raise ValueError('Parte não coletada: '+nome+'; '+str(source))
        raw=path.read_bytes()
        if hashlib.sha256(raw).hexdigest()!=source['sha256']:raise ValueError('Hash da parte diverge: '+nome)
        value=json.loads(raw)
        if not isinstance(value,list) or len(value)!=1 or str(value[0].get('id'))!='13376':raise ValueError('Variável incorreta na parte: '+nome)
        resultados.extend(value[0]['resultados']);nomes.append(nome);parts.append({'arquivo':nome,'url':url,'sha256':source['sha256']})
    payload=[{'id':'13376','resultados':resultados}]
    content=json.dumps(payload,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
    nome='censo_2022_'+('tempo' if dimension=='537' else 'modos')+'.json'
    path=origem/nome
    if path.exists() and path.read_bytes()!=content:raise ValueError('Junção difere das respostas originais')
    path.write_bytes(content)
    sources[nome]={'arquivo':nome,'url':'https://sidra.ibge.gov.br/tabela/10330','estado':'coletado','capturado_em':sources[nomes[0]]['capturado_em'],'bytes':len(content),'sha256':hashlib.sha256(content).hexdigest(),'derivado':True,'transformacao':'Concatenação dos resultados das partes, sem alterar nenhuma célula.','partes':parts}
    return nome,payload
