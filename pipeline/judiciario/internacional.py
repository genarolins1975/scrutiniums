"""Recorte internacional reproduzível, sem promover uma edição automaticamente.

python3 -m pipeline.judiciario.internacional [--check]
Lê a planilha original fixada pelo hash; não requer rede nem dependências extras.
"""
import argparse
import csv
import hashlib
import io
import json
import math
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
SEED = ROOT / 'pipeline/judiciario/seed'
OUT = ROOT / 'public/eficiencia/judiciario'
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
COLUNAS = [col for grupo in (7, 8) for col in
           [f'f_{grupo}', *[f'f_{grupo}_{i}' for i in range(1, 8)]]]


def ler_planilha(original):
    """Preserva os dois cabeçalhos e células vazias; zero continua observado."""
    with zipfile.ZipFile(io.BytesIO(original)) as book:
        strings = [''.join(t.text or '' for t in e.findall('.//m:t', NS))
                   for e in ET.fromstring(book.read('xl/sharedStrings.xml')).findall('m:si', NS)]
        rows = []
        for row in ET.fromstring(book.read('xl/worksheets/sheet1.xml')).findall('m:sheetData/m:row', NS):
            values = {}
            for cell in row.findall('m:c', NS):
                value = cell.find('m:v', NS)
                if cell.get('t') == 'inlineStr':
                    text = ''.join(t.text or '' for t in cell.findall('m:is//m:t', NS))
                elif value is not None:
                    text = strings[int(value.text)] if cell.get('t') == 's' else value.text
                else:
                    continue
                values[re.sub(r'\d', '', cell.get('r'))] = text
            rows.append(values)
    if len(rows) < 3:
        raise ValueError('Planilha sem cabeçalhos e observações')
    headers = {**rows[1], **rows[0]}
    if not set(COLUNAS).issubset(headers.values()):
        raise ValueError('Colunas do WJP incompatíveis')
    definitions = {headers[k]: v for k, v in rows[1].items() if k in headers}
    return [{headers[k]: v for k, v in r.items() if k in headers} for r in rows[2:]], definitions


def edicao_final(edicao):
    return int(edicao.split('-')[-1])


def gerar():
    origin = json.loads((SEED / 'wjp-origem.json').read_text())
    original = (SEED / 'wjp-historico.xlsx').read_bytes()
    if hashlib.sha256(original).hexdigest() != origin['sha256']:
        raise ValueError('Planilha diverge do original fixado')
    blob = b'blob ' + str(len(original)).encode() + b'\0' + original
    if hashlib.sha1(blob).hexdigest() != origin['gitBlobSha1']:
        raise ValueError('Blob difere do objeto publicado no commit fonte')
    rows, definitions = ler_planilha(original)
    edicao = origin['edicaoAdotada']
    adotadas = [r for r in rows if r.get('Year') == edicao]
    if len(adotadas) != 143 or len({r['Country Code'] for r in adotadas}) != 143:
        raise ValueError('Cobertura da edição adotada diverge dos 143 países/jurisdições')
    ids = {r['Country Code'] for r in adotadas}
    if 'BRA' not in ids:
        raise ValueError('Brasil ausente')

    def escores(row):
        values = [float(row[c]) if row.get(c) not in (None, '') else None for c in COLUNAS]
        if any(v is not None and (not math.isfinite(v) or not 0 <= v <= 1) for v in values):
            raise ValueError('Escore fora da escala original 0–1')
        return values

    countries = [dict(iso3=r['Country Code'], nome=origin['nomes'].get(r['Country Code'], r['Country']),
                      nomeFonte=r['Country'], regiao=r['Region'], renda=r.get('income_group'),
                      escores=escores(r)) for r in adotadas]
    countries.sort(key=lambda p: p['iso3'])
    editions = sorted({r['Year'] for r in rows
                       if 2015 <= edicao_final(r['Year']) <= edicao_final(edicao)}, key=edicao_final)
    observations = [dict(iso3=r['Country Code'], edicao=r['Year'], escores=escores(r))
                    for r in rows if r['Country Code'] in ids and r['Year'] in editions]
    keys = [(r['iso3'], r['edicao']) for r in observations]
    if len(keys) != len(set(keys)):
        raise ValueError('Duplicata país/edição; não somar nem escolher arbitrariamente')
    observations.sort(key=lambda r: (r['iso3'], edicao_final(r['edicao'])))
    fonte = {k: v for k, v in origin.items() if k != 'nomes'}
    latest = dict(versao='judiciario-internacional-1', edicao=edicao, fonte=fonte, colunas=COLUNAS,
                  definicoesFonte={c: definitions[c] for c in COLUNAS}, paises=countries,
                  cobertura=dict(paises=len(countries), edicoes=editions, unidade='escore de 0 a 1',
                                 historicoObservacoes=len(observations),
                                 ausenciasUltimaEdicao=sum(v is None for p in countries for v in p['escores'])))
    history = dict(versao=latest['versao'], edicoes=editions, colunas=COLUNAS, observacoes=observations)
    output = io.StringIO(newline='')
    writer = csv.writer(output, delimiter=';', quoting=csv.QUOTE_ALL, lineterminator='\r\n')
    writer.writerow(['ISO3', 'País/jurisdição', 'Edição', 'Região WJP', 'Renda na fonte', 'Indicador WJP',
                     'Definição original', 'Valor', 'Unidade', 'Fonte fixada', 'Limite'])
    for p in countries:
        for index, column in enumerate(COLUNAS):
            writer.writerow([p['iso3'], p['nome'], edicao, p['regiao'], p['renda'], column,
                             definitions[column], '' if p['escores'][index] is None else p['escores'][index],
                             'escore de 0 a 1', origin['url'], 'Experiências e percepções; não é percentual, duração nem ganho causal.'])
    encode = lambda data: (json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    files = {'internacional.json': encode(latest), 'internacional-historico.json': encode(history),
             'internacional.csv': ('\ufeff' + output.getvalue()).encode()}
    manifest = dict(versao=latest['versao'], fonte=fonte, edicaoAdotada=edicao,
                    arquivos={name: hashlib.sha256(content).hexdigest() for name, content in files.items()},
                    regra='Sem nova nota, conversão de escores em percentuais ou promessa de economia. Edição conjunta 2017–2018 preservada como uma observação. Comparações não estimam efeitos de reformas.')
    files['internacional-manifesto.json'] = encode(manifest)
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    files = gerar()
    if args.check:
        for name, content in files.items():
            if not (OUT / name).exists() or (OUT / name).read_bytes() != content:
                raise SystemExit('Arquivo internacional desatualizado: ' + name)
    else:
        OUT.mkdir(parents=True, exist_ok=True)
        for name, content in files.items():
            (OUT / name).write_bytes(content)
    print(json.dumps({'arquivos': len(files), 'check': args.check, 'bytes': sum(map(len, files.values()))}))


if __name__ == '__main__':
    main()
