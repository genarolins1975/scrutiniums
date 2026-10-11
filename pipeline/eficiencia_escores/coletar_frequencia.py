"""Captura primária SIDRA 10056: contexto educacional, não escore de serviço público."""
import concurrent.futures
import datetime
import gzip
import hashlib
import json
from pathlib import Path
import urllib.request

CAPITALS='1100205,1200401,1302603,1400100,1501402,1600303,1721000,2111300,2211001,2304400,2408102,2507507,2611606,2704302,2800308,2927408,3106200,3205309,3304557,3550308,4106902,4205407,4314902,5002704,5103403,5208707'
ROOT=Path(__file__).resolve().parents[2]
DEST=ROOT/'docs/obee/calibracao/evidencias'
BASE='https://apisidra.ibge.gov.br/values/t/10056/'
SUFFIX='/v/3795/p/2022/c58/99749,47813,31615,2792/c2/6794/c86/95251'
URLS={'capitais':BASE+'n6/'+CAPITALS+SUFFIX,'brasil':BASE+'n1/1'+SUFFIX,
      'metadados':'https://servicodados.ibge.gov.br/api/v3/agregados/10056/metadados'}

def capture(item):
    name,url=item
    with urllib.request.urlopen(url,timeout=40) as response:
        raw=response.read()
    payload=gzip.decompress(raw) if raw[:2]==b'\x1f\x8b' else raw
    data=json.loads(payload)
    if name!='metadados' and (not isinstance(data,list) or len(data)<2):
        raise ValueError('Resposta sem observações')
    return name,url,payload,data


def main():
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results=list(pool.map(capture,URLS.items()))
    DEST.mkdir(parents=True,exist_ok=True);sources=[];combined=[]
    for name,url,payload,data in results:
        filename=f'ibge-10056-{name}.json';(DEST/filename).write_bytes(payload)
        sources.append(dict(file=filename,url=url,sha256=hashlib.sha256(payload).hexdigest()))
        if name!='metadados':
            header=data[0]
            combined.extend(dict(source=name,fields={header[k]:v for k,v in row.items()}) for row in data[1:])
    manifest=dict(captured_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),sources=sources,
        role='CONTEXTO_EDUCACIONAL_NAO_ESCORE',period=2022,public_network_identifiable=False,
        rows=len(combined),notes=['26 capitais estaduais; Brasília fora da cesta municipal.',
        'Sexo total, cor ou raça total; quatro faixas etárias separadas.',
        'Taxas publicadas, sem conversão em escore; não somar nem fazer média simples das idades.',
        'A tabela não identifica dependência administrativa da escola; não mede cobertura exclusiva do Estado.'])
    (DEST/'frequencia-manifesto.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    (DEST/'frequencia-observacoes.json').write_text(json.dumps(combined,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(manifest,ensure_ascii=False))
    print(json.dumps(combined[:2],ensure_ascii=False))

if __name__=='__main__':main()
