"""Coleta auditável. Não altera public/, main, escores ou dados anteriores.

python3 pipeline/eficiencia_mobilidade/coletar.py --destino /tmp/mobilidade
Preserva bytes HTTP quando comprimidos, representação decodificada e dois hashes.
"""
from __future__ import annotations
import argparse
import concurrent.futures
import gzip
import hashlib
import io
import json
import pathlib
import time
import urllib.request
import zipfile
from datetime import datetime, timezone
from xml.etree import ElementTree as ET

FONTES = {
    'pemob_municipal_2025.xlsx': 'https://www.gov.br/cidades/pt-br/assuntos/mobilidade-urbana/arquivos/pemob_municipal_2025.xlsx',
    'pemob_metropolitana_2025.xlsx': 'https://www.gov.br/cidades/pt-br/assuntos/mobilidade-urbana/arquivos/pemob_metropolitana_2025.xlsx',
    'ibge_metadados_10330.json': 'https://servicodados.ibge.gov.br/api/v3/agregados/10330/metadados',
    'ipea_dados.html': 'https://www.ipea.gov.br/acessooportunidades/dados/',
    'ipea_dicionario.html': 'https://ipea.github.io/aopdata/articles/data_dic_pt.html',
}
LIMITE_BYTES = 64 * 1024 * 1024
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def decodificar(corpo: bytes) -> bytes:
    if corpo.startswith(b'\x1f\x8b'):
        with gzip.GzipFile(fileobj=io.BytesIO(corpo)) as stream:
            corpo = stream.read(LIMITE_BYTES + 1)
    if not corpo or len(corpo) > LIMITE_BYTES:
        raise ValueError('Resposta vazia ou acima do limite de coleta')
    return corpo


def baixar(nome: str, url: str, destino: pathlib.Path) -> dict:
    if pathlib.PurePath(nome).name != nome:
        raise ValueError('Nome deve ser um arquivo, sem diretórios')
    registro = {'arquivo': nome, 'url': url, 'estado': 'nao_coletado'}
    for tentativa in range(2):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Scrutiniums-OBEE/1.0 (public-data audit)', 'Accept': '*/*', 'Accept-Encoding': 'identity'})
            with urllib.request.urlopen(req, timeout=45) as resposta:
                bruto = resposta.read(LIMITE_BYTES + 1)
                if len(bruto) > LIMITE_BYTES:
                    raise ValueError('Resposta HTTP excede o limite')
                corpo = decodificar(bruto)
                if nome.endswith('.xlsx') and not corpo.startswith(b'PK'):
                    raise ValueError('Resposta não é XLSX')
                if nome.endswith('.json'):
                    json.loads(corpo)
                destino.mkdir(parents=True, exist_ok=True)
                temporario = destino / (nome + '.tmp')
                temporario.write_bytes(corpo)
                temporario.replace(destino / nome)
                if bruto != corpo:
                    (destino / (nome + '.http.gz')).write_bytes(bruto)
                registro.pop('erro', None)
                registro.update(estado='coletado', capturado_em=datetime.now(timezone.utc).isoformat(), url_final=resposta.url,
                                bytes=len(corpo), sha256=hashlib.sha256(corpo).hexdigest(),
                                http_sha256=hashlib.sha256(bruto).hexdigest(), content_encoding=resposta.headers.get('Content-Encoding'),
                                tipo=resposta.headers.get('Content-Type'))
                return registro
        except (OSError, ValueError, EOFError) as erro:
            registro['erro'] = str(erro)
            if tentativa == 0:
                time.sleep(1)
    return registro


def estrutura_xlsx(caminho: pathlib.Path) -> dict:
    with zipfile.ZipFile(caminho) as z:
        workbook = ET.fromstring(z.read('xl/workbook.xml'))
        rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        targets = {r.attrib['Id']: r.attrib['Target'] for r in rels}
        result = []
        for s in workbook.findall('s:sheets/s:sheet', NS):
            rid = s.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
            target = targets[rid]
            path = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            root = ET.fromstring(z.read(path))
            rows = root.findall('s:sheetData/s:row', NS)
            result.append({'nome': s.attrib['name'], 'linhas_fisicas': len(rows)})
        return {'abas': result, 'nota': 'Linhas físicas não equivalem a municípios elegíveis.'}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--destino', type=pathlib.Path, required=True)
    args = parser.parse_args()
    args.destino.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        fontes = list(executor.map(lambda item: baixar(*item, args.destino), FONTES.items()))
    estruturas = {f['arquivo']: estrutura_xlsx(args.destino / f['arquivo']) for f in fontes if f['estado'] == 'coletado' and f['arquivo'].endswith('.xlsx')}
    manifesto = {'versao': '0.2-descoberta', 'promocao_publica': False, 'fontes': fontes, 'estruturas': estruturas}
    (args.destino / 'manifesto.json').write_text(json.dumps(manifesto, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(manifesto, ensure_ascii=False, indent=2))
    return 0 if all(f['estado'] == 'coletado' for f in fontes) else 1


if __name__ == '__main__':
    raise SystemExit(main())
