"""Captura oficial limitada de PAM/PPM, preservando metadados, unidades e originais.

python3 -m pipeline.agro.capturar --fonte pam [--anos 5]
Começa pelos metadados. Só promove a captura se todos os recortes forem válidos.
Requer liberação dos domínios IBGE nas configurações do ambiente.
"""
import argparse
import hashlib
import json
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from .run import ROOT, SIGLAS, numero, validar_unicos

OUT=ROOT/'pipeline/agro/capturas'
BASE='https://servicodados.ibge.gov.br/api/v3/agregados'

def normalizar_texto(s):
    return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())


def baixar_json(url):
    for tentativa in range(2):
        try:
            request=urllib.request.Request(url,headers={'User-Agent':'Scrutiniums Agro/1.0; public data, bounded requests'})
            with urllib.request.urlopen(request,timeout=25) as response:
                raw=response.read(8_000_001)
                if len(raw)>8_000_000: raise ValueError('Resposta acima do limite; reduza o recorte')
                return json.loads(raw),raw
        except urllib.error.HTTPError as e:
            if e.code not in (429,500,502,503,504) or tentativa==1: raise
        except urllib.error.URLError as e:
            if '403' in str(e) or tentativa==1: raise
        time.sleep(1)
    raise RuntimeError('Captura não concluída')


def escolher_categoria(meta,produto):
    matches=[]
    for classification in meta.get('classificacoes',[]):
        for cat in classification['categorias']:
            nome=normalizar_texto(cat['nome'])
            if produto=='cafe': ok=nome.startswith('cafeemgrao') and not any(x in nome for x in ['arabica','canephora','robusta'])
            elif produto=='bovinos': ok=nome in ('bovino','bovinos')
            elif produto=='leite': ok=nome=='leite'
            else: ok=nome.startswith(normalizar_texto(produto)+'emgrao') or produto=='arroz' and nome=='arrozemcasca'
            if ok: matches.append((str(classification['id']),str(cat['id']),cat['nome']))
    if len(matches)!=1: raise ValueError(f'Categoria não unívoca para {produto}: {matches}')
    return matches[0]


def variaveis(meta,fonte):
    mappings={'quantidade':['quantidadeproduzida'],'valorProducao':['valordaproducao']}
    if fonte=='pam': mappings.update(areaPlantada=['areaplantadaoudestinadaacolheita'],areaColhida=['areacolhida'])
    elif fonte=='rebanho': mappings={'rebanho':['efetivodosrebanhos','efetivodorebanho']}
    result={}
    for field,names in mappings.items():
        matches=[v for v in meta['variaveis'] if normalizar_texto(v['nome']) in names]
        if len(matches)!=1: raise ValueError(f'Variável {field} não unívoca nos metadados')
        key=str(matches[0]['id'])
        if key in result: raise ValueError('Identificador de variável repetido nos metadados')
        result[key]=field
    return result


def unidade_canonica(unidade,indicador,cadeia):
    norm=normalizar_texto(unidade)
    if indicador in ('areaPlantada','areaColhida') and norm in ('hectares','hectare'): return 'ha',1
    if indicador=='valorProducao':
        if norm=='milreais': return 'R$ correntes',1000
        if norm=='reais': return 'R$ correntes',1
    if indicador=='rebanho' and norm in ('cabecas','cabeca'): return 'cabeças',1
    if indicador=='quantidade' and cadeia=='leite':
        if norm in ('millitros',): return 'L',1000
        if norm in ('litros','litro'): return 'L',1
    if indicador=='quantidade' and cadeia!='leite' and norm in ('toneladas','tonelada'): return 't',1
    raise ValueError(f'Unidade não homologada: {unidade}, {indicador}, {cadeia}')


def normalizar_resposta(payload,mapping,cadeia,fonte_id):
    rows=[]
    for variable in payload:
        key=str(variable['id'])
        if key not in mapping: raise ValueError('Variável inesperada na resposta oficial')
        indicador=mapping[key];unit,fator=unidade_canonica(variable['unidade'],indicador,cadeia)
        for result in variable['resultados']:
            for serie in result['series']:
                locality=serie['localidade'];cod=str(locality['id'])
                if cod not in {'1',*SIGLAS}: raise ValueError('Território fora de BR/UF')
                for year,value in serie['serie'].items():
                    if not re.fullmatch(r'\d{4}',year): raise ValueError('Período anual inválido')
                    estado={'..':'NAO_APLICAVEL','...':'AUSENTE','X':'SUPRIMIDO'}.get(value,'OBSERVADO')
                    val=numero(value)
                    if val is not None and val<0: raise ValueError('Valor agro negativo na estatística')
                    rows.append({'cadeia':cadeia,'territorio':'BR' if cod=='1' else cod,'nome':locality['nome'],'ano':int(year),'indicador':indicador,'valor':val*fator if val is not None else None,'unidade':unit,'fonte':fonte_id,'estado':estado,'nota':f'Unidade original: {variable["unidade"]}; fator explícito: {fator}. Sinal original: {value}.'})
    validar_unicos(rows,['cadeia','territorio','ano','indicador'])
    return rows


def validar_cobertura(rows,indicadores,anos):
    expected={(indicador,ano,territorio) for indicador in set(indicadores) for ano in set(anos) for territorio in {'BR',*SIGLAS}}
    actual={(r['indicador'],r['ano'],r['territorio']) for r in rows}
    if actual!=expected:
        raise ValueError(f'Cobertura por indicador, ano e território inválida: ausentes={sorted(expected-actual)[:3]}, extras={sorted(actual-expected)[:3]}')


def capturar(fonte,anos=5):
    if not 2<=anos<=12: raise ValueError('Recorte de dois a doze anos')
    table={'pam':'5457','rebanho':'3939','leite':'74'}[fonte]
    files={}; requests=[]
    def get(path,name):
        url=BASE+path;data,raw=baixar_json(url);files[name]=raw;requests.append({'arquivo':name,'url':url,'sha256':hashlib.sha256(raw).hexdigest()});return data
    meta=get(f'/{table}/metadados','metadados.json');periods=get(f'/{table}/periodos','periodos.json')
    limite=datetime.now(timezone.utc).year-1
    years=sorted(int(p['id']) for p in periods if re.fullmatch(r'\d{4}',str(p['id'])) and int(p['id'])<=limite)[-anos:]
    if len(years)<2: raise ValueError('Série anual insuficiente')
    mapping=variaveis(meta,fonte);products=['soja','milho','arroz','feijao','cafe'] if fonte=='pam' else ['bovinos'] if fonte=='rebanho' else ['leite']
    rows=[];categories={}
    for product in products:
        classification,category,name=escolher_categoria(meta,product);categories[product]={'classificacao':classification,'categoria':category,'nomeFonte':name}
        query=urllib.parse.urlencode({'localidades':'N1[1]|N3[all]','classificacao':f'{classification}[{category}]'})
        path=f'/{table}/periodos/'+ '|'.join(map(str,years))+'/variaveis/'+'|'.join(mapping)+'?'+query
        payload=get(path,product+'.json');parsed=normalizar_resposta(payload,mapping,product,'ibge-'+fonte)
        validar_cobertura(parsed,mapping.values(),years)
        rows.extend(parsed)
    validar_unicos(rows,['cadeia','territorio','ano','indicador'])
    stamp=datetime.now(timezone.utc).isoformat()
    files['normalizado.json']=(json.dumps({'fonte':'ibge-'+fonte,'tabela':table,'capturadoEm':stamp,'periodos':years,'categorias':categories,'observacoes':rows},ensure_ascii=False,separators=(',',':'))+'\n').encode()
    manifest={'fonte':fonte,'tabela':table,'capturadoEm':stamp,'requisicoes':requests,'arquivos':{name:hashlib.sha256(raw).hexdigest() for name,raw in files.items()},'licenca':'Dados IBGE, citar a fonte; verificar os termos de uso da publicação.'}
    # Nada é gravado antes da validação de todos os produtos da fonte.
    folder=OUT/fonte;folder.mkdir(parents=True,exist_ok=True)
    for name,raw in files.items(): (folder/(name+'.tmp')).write_bytes(raw)
    for name in files: (folder/(name+'.tmp')).replace(folder/name)
    (folder/'manifesto.json.tmp').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(folder/'manifesto.json.tmp').replace(folder/'manifesto.json')
    return {'fonte':fonte,'periodos':years,'observacoes':len(rows),'arquivos':len(files)+1}


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--fonte',choices=['pam','rebanho','leite'],required=True);p.add_argument('--anos',type=int,default=5);args=p.parse_args();print(json.dumps(capturar(args.fonte,args.anos)))
if __name__=='__main__':main()
