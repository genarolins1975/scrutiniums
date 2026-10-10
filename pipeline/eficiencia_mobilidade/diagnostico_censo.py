"""Conferência pública do agregado nacional; apenas leitura, sem promoção."""
import json
import pathlib
import tempfile
import urllib.parse
from coletar import baixar
from censo import resultados, valor_censo, TOTAL

def main():
    with tempfile.TemporaryDirectory() as tmp:
        dest=pathlib.Path(tmp)
        for dim in ['537','2088']:
            query=urllib.parse.urlencode({'localidades':'N1[all]','classificacao':'|'.join(k+'['+('all' if k==dim else v)+']' for k,v in TOTAL.items())})
            url='https://servicodados.ibge.gov.br/api/v3/agregados/10330/periodos/2022/variaveis/13376?'+query
            f=baixar('nacional.json',url,dest)
            if f['estado']!='coletado': raise RuntimeError(f)
            payload=json.loads((dest/'nacional.json').read_bytes())
            values=resultados(payload,dim)
            print('CENSO_DIAGNOSTICO',json.dumps({'dimensao':dim,'url':url,'sha256':f['sha256'],'valores':{cat:item['raw'] for (code,cat),item in values.items() if code=='1'}},ensure_ascii=False))
            for result in payload[0]['resultados']:
                print('CATEGORIA_NACIONAL',json.dumps(result,ensure_ascii=False))
if __name__=='__main__':main()
