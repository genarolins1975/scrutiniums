"""Tempos por tribunal nas edições anteriores do Justiça em Números.

python3 -m pipeline.judiciario.historico --baixar   # baixa, confere checksums e regrava a semente
python3 -m pipeline.judiciario.historico --pdfs DIR  # mesmo, a partir de PDFs já baixados

Só as páginas das figuras de tempo por tribunal são preservadas. Cada edição
recalcula os tempos a partir do DataJud; valores de anos anteriores não são
revisados retroativamente, por isso a série mostra o que cada edição publicou.
"""
import argparse
import gzip
import hashlib
import json
import re
import subprocess
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED = ROOT / 'pipeline/judiciario/seed/historico-tempos.json.gz'
# Edição, ano-base, original no portal do CNJ, checksum conferido em 17/10/2026 e páginas da figura.
EDICOES = [
    dict(edicao=2022, ano=2021, url='https://www.cnj.jus.br/wp-content/uploads/2022/09/justica-em-numeros-2022-1.pdf',
         sha256='963f667b6eca7ca2b6f855b034b42b213049e7e57f49f154e56c2011b4db696c', paginas=[215]),
    dict(edicao=2023, ano=2022, url='https://www.cnj.jus.br/wp-content/uploads/2024/02/justica-em-numeros-2023-16022024.pdf',
         sha256='ca9e514c5213636fac8b421e97387c9f0f74f259f7380520ada2b74a9aab6494', paginas=[215]),
    dict(edicao=2024, ano=2023, url='https://www.cnj.jus.br/wp-content/uploads/2025/04/justica-em-numeros-2024.pdf',
         sha256='837b3016f1b56077152bcd827d3bba759e984c52fcb98e10263fb99b116b93ca', paginas=[282]),
    dict(edicao=2025, ano=2024, url='https://www.cnj.jus.br/wp-content/uploads/2025/11/justica-em-numeros-2025.pdf',
         sha256='190f48e6a9a7a11bda354e8fa3c0427d005853159da2c8f9b254848cb118bd02', paginas=[371, 437, 500]),
]
DURACAO = r'(\d+a(?: e \d+m)?|\d+m)'
SIGLA = r'(TJ[A-Z]{2,4}|TRF\d|TRT\d{1,2})'


def meses(valor):
    anos, resto = re.search(r'(\d+)a', valor), re.search(r'(\d+)m', valor)
    return (int(anos[1]) * 12 if anos else 0) + (int(resto[1]) if resto else 0)


def tempos(texto, siglas):
    """Baixados à esquerda e pendentes à direita da sigla, na mesma linha.

    Uma sigla cujos valores o PDF quebra em outras linhas fica ausente: não se
    recompõe o par por proximidade, para não trocar valores entre tribunais.
    """
    achados = {}
    for m in re.finditer(DURACAO + r'\s+' + SIGLA + r'\s+' + DURACAO, texto):
        if m[2] in siglas:
            achados.setdefault(m[2], dict(tempoBaixados=meses(m[1]), idadePendentes=meses(m[3])))
    return achados


def capturar(pdfs):
    edicoes = []
    with tempfile.TemporaryDirectory() as pasta:
        for e in EDICOES:
            pdf = pdfs / Path(e['url']).name
            if hashlib.sha256(pdf.read_bytes()).hexdigest() != e['sha256']:
                raise ValueError(f'PDF da edição {e["edicao"]} diverge do original conferido')
            paginas = {}
            for numero in e['paginas']:
                destino = Path(pasta) / f'{e["edicao"]}-{numero}.txt'
                subprocess.run(['pdftotext', '-layout', '-f', str(numero), '-l', str(numero), str(pdf), str(destino)],
                               check=True, timeout=60)
                paginas[str(numero)] = destino.read_text()
            edicoes.append({**e, 'paginas': paginas})
    return dict(capturadoEm='2026-10-17', edicoes=edicoes)


def baixar(destino):
    destino.mkdir(parents=True, exist_ok=True)
    for e in EDICOES:
        alvo = destino / Path(e['url']).name
        if not alvo.exists():
            pedido = urllib.request.Request(e['url'], headers={'User-Agent': 'Scrutiniums-Judiciario/1.0'})
            with urllib.request.urlopen(pedido, timeout=120) as resposta:
                alvo.write_bytes(resposta.read())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    grupo = parser.add_mutually_exclusive_group(required=True)
    grupo.add_argument('--pdfs', type=Path)
    grupo.add_argument('--baixar', action='store_true')
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as pasta:
        origem = args.pdfs or Path(pasta)
        if args.baixar:
            baixar(origem)
        dados = capturar(origem)
    pacote = gzip.compress(json.dumps(dados, ensure_ascii=False, sort_keys=True).encode(), mtime=0)
    SEED.write_bytes(pacote)
    print(json.dumps({'edicoes': len(dados['edicoes']), 'sha256_semente': hashlib.sha256(pacote).hexdigest()}))


if __name__ == '__main__':
    main()
