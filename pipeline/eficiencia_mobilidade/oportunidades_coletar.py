"""Coleta independente do Ipea/AOP. Não altera a gold do Censo/Pemob.

2019: todos os modos e cidades do catálogo; população espacial de 2010.
Originais comprimidos, SHA-256 e cabeçalhos preservados. Nenhuma projeção.
Uso: python oportunidades_coletar.py --destino /tmp/aop
"""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor
import csv
from datetime import datetime, timezone
import gzip
import hashlib
import io
import json
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

META = 'https://www.ipea.gov.br/geobr/aopdata/metadata/metadata.csv'
META_ALT = 'https://github.com/ipeaGIT/aopdata/releases/download/v1.0.0/metadata.csv'
MAX_BYTES = 96 * 1024 * 1024
MODOS = {'walk', 'bicycle', 'public_transport', 'car'}


def baixar(urls: list[str]) -> tuple[bytes, str]:
    erros = []
    for url in urls:
        # Somente o catálogo oficial e seus dois espelhos conhecidos.
        if not (url.startswith('https://www.ipea.gov.br/geobr/aopdata/') or url.startswith('https://github.com/ipeaGIT/aopdata/releases/download/v1.0.0/')):
            raise ValueError('URL fora do catálogo autorizado')
        try:
            with urlopen(Request(url, headers={'User-Agent': 'Scrutiniums-OBEE-public-data/1.0'}), timeout=55) as r:
                raw = r.read(MAX_BYTES + 1)
            if not raw or len(raw) > MAX_BYTES or raw.lstrip().startswith(b'<'):
                raise ValueError('Resposta vazia, HTML ou acima do limite')
            return raw, url
        except (OSError, ValueError) as exc:
            erros.append(str(exc))
    raise OSError('; '.join(erros))


def ler(raw: bytes) -> tuple[list[str], list[dict[str, str]]]:
    r = csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))
    if not r.fieldnames or len(set(r.fieldnames)) != len(r.fieldnames):
        raise ValueError('Cabeçalhos ausentes ou duplicados')
    rows = list(r)
    if any(None in x for x in rows):
        raise ValueError('Linha com mais campos que o cabeçalho')
    return list(r.fieldnames), rows


def coletar(item: dict[str, str], destino: Path) -> dict:
    nome = urlsplit(item['download_path2']).path.rsplit('/', 1)[1]
    resultado = {'arquivo': nome, 'type': item['type'], 'city': item['city'], 'name_muni': item['name_muni'], 'year': item['year'], 'mode': item['mode'], 'url': item['download_path2'], 'estado': 'falha'}
    try:
        raw, url = baixar([item['download_path2'], item['download_path']])
        headers, rows = ler(raw)
        if 'id_hex' not in headers or not rows:
            raise ValueError('Original não contém grade H3 preenchida')
        if item['type'] == 'population':
            for key in ['P001', 'R003']:
                if key not in headers:
                    raise ValueError('População não contém '+key)
        else:
            for key in ['CMATT30', 'CMATT60', 'CMASB30', 'CMAEF30', 'CMACT30']:
                if key not in headers:
                    raise ValueError('Acessibilidade não contém '+key)
        destino.joinpath(nome+'.gz').write_bytes(gzip.compress(raw, mtime=0))
        resultado.update(estado='coletado', url=url, sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw), linhas=len(rows), cabecalhos=headers, capturado_em=datetime.now(timezone.utc).isoformat(), primeira_linha=rows[0])
    except (OSError, ValueError) as exc:
        resultado['erro'] = str(exc)
    print(json.dumps({k: resultado.get(k) for k in ['arquivo','estado','linhas','erro']}, ensure_ascii=False), flush=True)
    return resultado


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--destino', type=Path, required=True)
    args = parser.parse_args()
    args.destino.mkdir(parents=True, exist_ok=True)
    raw, url = baixar([META, META_ALT])
    headers, catalogo = ler(raw)
    if not {'type', 'city', 'year', 'mode', 'download_path', 'download_path2', 'name_muni'} <= set(headers):
        raise ValueError('Estrutura do catálogo mudou')
    args.destino.joinpath('metadata.csv').write_bytes(raw)
    items = [i for i in catalogo if (i['type']=='access' and i['year']=='2019' and i['mode'] in MODOS) or (i['type']=='population' and i['year']=='2010')]
    keys = [(i['type'], i['city'], i['year'], i['mode']) for i in items]
    if len(set(keys)) != len(keys) or not items:
        raise ValueError('Catálogo selecionado vazio ou com chaves duplicadas')
    with ThreadPoolExecutor(max_workers=6) as pool:
        resultados = list(pool.map(lambda i: coletar(i, args.destino), items))
    manifesto = {'schemaVersion':1,'referenceYear':2019,'populationYear':2010,'metadata':{'url':url,'sha256':hashlib.sha256(raw).hexdigest()},'files':resultados}
    args.destino.joinpath('manifesto.json').write_text(json.dumps(manifesto, ensure_ascii=False, indent=2), encoding='utf-8')
    n = sum(r['estado']=='coletado' for r in resultados)
    print('FONTES',n,'/',len(resultados))
    return 0 if n==len(resultados) else 1

if __name__ == '__main__':
    raise SystemExit(main())
