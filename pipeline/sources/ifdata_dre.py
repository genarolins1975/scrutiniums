"""DRE prudencial: relatório descoberto no catálogo oficial, não por lid fixo.

Conferência em 25/10/2026, Itaú C0080099, Caixa C0080738 e Nu C0084693,
202512 e 202606: receita/despesa assinadas fecham no lucro líquido com erro
< R$ 1. Os seis resultados e todos os lids viajam em gold.validacao_empirica.
O relatório 116 (2025+) traz (z)=(w)+(x)+(y); o 113 antigo, (j)=(g)+(h)+(i).
Brutos em R$, não R$ mil: a página oficial divide o valor por 1000 ao exibir.
Ex.: Itaú 202606 lucro 24.670.305.939,70 e Caixa 6.585.794.275,92998.
Zero numérico é conservado; célula ausente/null é NI, como getValueFromIfd.
Cadastro 1009 é o perímetro prudencial; só c4=C, chave estável C + (c0 - 1e9) em sete dígitos, como ifdata_ui.
O c33 mudou de formato em 202606; não é usado para unir a série. Não
reutilizamos a identidade do conglomerado financeiro nem somamos seus membros.
"""
import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path

from pipeline.sources.ifdata_carteiras import _fetch_json

ROOT = Path(__file__).resolve().parents[2]
SEED = ROOT / 'pipeline/seed/lucro_banco'
ARQUIVOS = 'https://www3.bcb.gov.br/ifdata/rest/arquivos?nomeArquivo='
CATALOGOS = ['https://www3.bcb.gov.br/ifdata/rest/relatorios2000a2024',
             'https://www3.bcb.gov.br/ifdata/rest/relatorios2025a2030']


def coletar(cache=None):
    proveniencia = []
    def obter(url):
        # Cache explícito só para reusar downloads desta coleta; sem TLS alternativo.
        nome = url.rsplit('/', 1)[-1]
        local = Path(cache) / nome if cache and '?nomeArquivo=' in url else None
        if local and local.exists():
            body = local.read_bytes(); data = json.loads(body)
        else:
            data, body, _ = _fetch_json(url)
            if local:
                local.parent.mkdir(parents=True, exist_ok=True); local.write_bytes(body)
        proveniencia.append({'url': url, 'sha256': hashlib.sha256(body).hexdigest()})
        return data
    catalogos = [obter(u) for u in CATALOGOS]
    antigos = [d for d in catalogos[0] if str(d['dt']).endswith(('06', '12'))]
    novos = [d for d in catalogos[1] if str(d['dt']).endswith(('06', '12'))]
    periodos = sorted(antigos, key=lambda d:d['dt'])[-1:] + sorted(novos, key=lambda d:d['dt'])
    seed = {'coletado_em': datetime.now(timezone.utc).isoformat(), 'periodos': {}}
    for entrada in periodos:
        d = str(entrada['dt']); files = entrada['files']
        candidatos = [f for f in files if f.get('trel', {}).get('n') == 'Demonstração de Resultado'
                      and {'id':1009} in f['trel']['s']]
        if len(candidatos) != 1: raise ValueError(f'DRE prudencial ambígua em {d}')
        dre = candidatos[0]
        def arquivo(sufixo):
            hits = [f['f'] for f in files if f['f'].endswith(sufixo)]
            if len(hits)!=1: raise ValueError(f'Arquivo ambíguo: {sufixo}')
            return obter(ARQUIVOS+hits[0])
        cad = arquivo(f'cadastro{d}_1009.json')
        cad = [c for c in cad if c.get('c4')=='C']
        ids = {int(c['c0']) for c in cad}
        dados = {}
        for area in (1,3):
            raw = arquivo(f'dados{d}_{area}.json')
            dados[str(area)] = [r for r in raw['values'] if r['e'] in ids]
        seed['periodos'][d] = {'cadastro':cad, 'info':arquivo(f'info{d}.json'),
                               'dre':obter(ARQUIVOS+dre['f']), 'dados':dados,
                               'carteiras':{str(r):arquivo(f'trel{d}_{r}.json') for r in (123,128)} if int(d)>=202501 else {}}
        print(f'IF.data {d}: {len(cad)} conglomerados; relatório {dre["trel"]["id"]}')
    seed['fontes'] = proveniencia
    body = gzip.compress(json.dumps(seed,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)
    SEED.mkdir(parents=True,exist_ok=True)
    (SEED/'originais.json.gz').write_bytes(body)
    (SEED/'manifesto.json').write_text(json.dumps({'sha256':hashlib.sha256(body).hexdigest(),
        'coletado_em':seed['coletado_em'],'fontes':proveniencia},ensure_ascii=False,indent=2)+'\n')


def ler_seed():
    body=(SEED/'originais.json.gz').read_bytes()
    manifesto=json.loads((SEED/'manifesto.json').read_text())
    if hashlib.sha256(body).hexdigest()!=manifesto['sha256']:raise ValueError('Checksum do seed diverge')
    return json.loads(gzip.decompress(body))


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--cache');a=p.parse_args();coletar(a.cache)
