"""Censo 2022 por grupo: originais SIDRA preservados, hashes e gold sem rede.

Coleta: python3 -m pipeline.observatorio_saneamento.desigualdades --coletar
"""
import argparse
import concurrent.futures
import datetime as dt
import gzip
import hashlib
import json
from pathlib import Path
import urllib.request

RAIZ = Path(__file__).resolve().parent
SEED = RAIZ / 'seed' / 'desigualdades'
RACAS = [('branca', 'Branca', 2776), ('preta', 'Preta', 2777), ('amarela', 'Amarela', 2778), ('parda', 'Parda', 2779), ('indigena-cor', 'Indígena (cor ou raça)', 2780)]
ESGOTO = [46292, 72113, 92858, 72114, 72115, 92861]

def especificacoes():
    out = []
    def add(grupo, rotulo, medida, tabela, variavel, classe, categorias, fixas, unidade, universo):
        out.append(dict(id=f'{grupo}-{medida}', grupo=grupo, rotulo=rotulo, medida=medida,
                        tabela=tabela, variavel=variavel, classe=classe, categorias=categorias,
                        fixas=fixas, unidade=unidade, universo=universo))
    for grupo, rotulo, cor in RACAS:
        universo = f'Moradores de cor ou raça {rotulo.lower()} em domicílios particulares permanentes ocupados'
        add(grupo,rotulo,'agua',6894,382,1821,[72129,72153],{58:95253,86:cor},'moradores',universo)
        add(grupo,rotulo,'esgoto',7555,382,11558,ESGOTO,{58:95253,86:cor},'moradores',universo)
    add('quilombolas','Quilombolas','esgoto',10105,7097,11558,ESGOTO,{2661:32776,1:6795},'moradores','Moradores quilombolas em domicílios particulares permanentes ocupados, dentro e fora de territórios quilombolas')
    add('indigenas','Indígenas (identificação ampliada)','esgoto',9957,8691,11558,ESGOTO,{125:2932,2661:32776,1:6795},'moradores','Moradores indígenas em domicílios particulares permanentes ocupados, inclusive habitação indígena sem paredes ou maloca, dentro e fora de terras indígenas')
    add('favelas','Favelas e comunidades urbanas','agua',9894,9913,1821,[72129,72153],{},'domicílios','Domicílios particulares permanentes ocupados em favelas e comunidades urbanas')
    add('favelas','Favelas e comunidades urbanas','esgoto',9898,9914,11558,ESGOTO,{458:72117,86:95251,2:6794,58:95253},'moradores','Moradores em domicílios particulares permanentes ocupados em favelas e comunidades urbanas')
    return out

SPECS = especificacoes()

def sha(b):
    return hashlib.sha256(b).hexdigest()

def baixar(url):
    with urllib.request.urlopen(url,timeout=180) as r:
        b=r.read()
    return gzip.decompress(b) if b[:2] == b'\x1f\x8b' else b

def gravar_original(nome,url):
    b=baixar(url)
    json.loads(b)  # erro textual do SIDRA não é dado
    (SEED/nome).write_bytes(gzip.compress(b,mtime=0))
    return dict(arquivo=nome,url=url,sha256=sha(b))

def validar_meta(s,meta):
    assert s['variavel'] in [v['id'] for v in meta['variaveis']], s['id']
    classes={c['id']:c for c in meta['classificacoes']}
    pedidos={**s['fixas'],s['classe']:s['categorias']}
    for c,values in pedidos.items():
        values=values if isinstance(values,list) else [values]
        assert set(values) <= {v['id'] for v in classes[int(c)]['categorias']}, (s['id'],c)
    assert set(classes) == {int(k) for k in pedidos}, 'Classificação não fixada'

def coletar():
    SEED.mkdir(parents=True,exist_ok=True)
    metas={}
    for tabela in sorted({s['tabela'] for s in SPECS}):
        metas[str(tabela)]=gravar_original(f'meta-{tabela}.json.gz',f'https://servicodados.ibge.gov.br/api/v3/agregados/{tabela}/metadados')
    consultas=[]
    for s in SPECS:
        validar_meta(s,ler(metas[str(s['tabela'])]))
        for nivel in [1,2,3,6]:
            path=f"/t/{s['tabela']}/n{nivel}/all/v/{s['variavel']}/p/2022/c{s['classe']}/"+','.join(map(str,s['categorias']))
            path+=''.join(f'/c{k}/{v}' for k,v in s['fixas'].items())+'/h/y/f/c'
            consultas.append((s['id'],nivel,'https://apisidra.ibge.gov.br/values'+path))
    def fetch(item):
        id_,nivel,url=item
        r=gravar_original(f'{id_}-n{nivel}.json.gz',url)
        print(id_,nivel,flush=True)
        return dict(r,id=id_,nivel=nivel)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        arquivos=list(pool.map(fetch,consultas))
    manifesto=dict(capturado_em=dt.datetime.now(dt.timezone.utc).isoformat(),metadados=metas,consultas=arquivos)
    (SEED/'manifesto.json').write_text(json.dumps(manifesto,ensure_ascii=False,indent=2)+'\n')

def ler(registro):
    b=gzip.decompress((SEED/registro['arquivo']).read_bytes())
    if sha(b)!=registro['sha256']: raise ValueError('SHA-256 divergente: '+registro['arquivo'])
    return json.loads(b)

def numero(v):
    if v == '-': return 0  # convenção SIDRA: zero absoluto
    if isinstance(v,str) and v.isdigit(): return int(v)
    if v in ('X','..','...',''): return None
    raise ValueError(f'Valor SIDRA desconhecido: {v!r}')

def construir():
    manifesto=json.loads((SEED/'manifesto.json').read_text())
    specs={s['id']:s for s in SPECS}
    territorios={}
    estados={}
    for r in manifesto['consultas']:
        s=specs[r['id']]
        meta=ler(manifesto['metadados'][str(s['tabela'])])
        validar_meta(s,meta)
        nome=next(c['nome'] for c in meta['classificacoes'] if c['id']==s['classe'])
        linhas=ler(r)
        coluna=next(k for k,v in linhas[0].items() if v==nome+' (Código)')
        vals={}
        for l in linhas[1:]:
            assert l['D2C']==str(s['variavel']) and l['D3C']=='2022'
            chave=f"{l['NC']}:{l['D1C']}"
            cats=vals.setdefault(chave,{})
            if l[coluna] in cats: raise ValueError('Chave SIDRA duplicada')
            cats[l[coluna]]=numero(l['V'])
            estados[l['V'] if l['V'] in ('-','X','..','...','') else 'numero']=estados.get(l['V'] if l['V'] in ('-','X','..','...','') else 'numero',0)+1
        for chave,cats in vals.items():
            if set(cats)!={str(c) for c in s['categorias']}: raise ValueError('Categorias incompletas')
            den=cats[str(s['categorias'][0])]
            partes=[cats[str(c)] for c in s['categorias'][1:]]
            num=sum(partes) if all(v is not None for v in partes) else None
            if num is not None and den is not None and not 0<=num<=den: raise ValueError('Numerador fora do universo')
            territorios.setdefault(chave,{})[s['id']]=[num,den]
    conferencias=[]
    for s in SPECS:
        for nivel in [2,3,6]:
            membros=[v[s['id']] for k,v in territorios.items() if k.startswith(f'{nivel}:') and s['id'] in v]
            br=territorios['1:1'][s['id']]
            for i,campo in enumerate(['numerador','denominador']):
                presentes=[v[i] for v in membros if v[i] is not None]
                conferencias.append(dict(id=s['id'],nivel=nivel,campo=campo,informantes=len(presentes),ausentes=len(membros)-len(presentes),soma=sum(presentes),brasil=br[i],diferenca=sum(presentes)-br[i] if br[i] is not None else None))
    return dict(periodo='2022',especificacoes=SPECS,territorios=territorios,proveniencia=manifesto,conferencias=conferencias,estados=estados)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--coletar',action='store_true');a=p.parse_args()
    if a.coletar: coletar()
    d=construir();print(json.dumps({'territorios':len(d['territorios']),'estados':d['estados'],'divergencias':[c for c in d['conferencias'] if c['diferenca']]},ensure_ascii=False))
