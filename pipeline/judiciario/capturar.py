"""Captura limitada do relatório oficial, sem coleta de processos individuais.

python3 -m pipeline.judiciario.capturar --pdf /caminho/relatorio.pdf
python3 -m pipeline.judiciario.capturar --baixar
O hash é o do original previamente identificado e conferido na Biblioteca Digital.
"""
import argparse
import gzip
import hashlib
import json
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
URL = 'https://bibliotecadigital.cnj.jus.br/bitstream/123456789/1126/1/relatorio_justica_em_numeros2026_1.pdf'
PDF_SHA = '7aafbf664cbd3edadf46492151988468e154fe9cb131b460fe7dde335c3dca19'
PAGES = [22,23,24,40,41,51,62,63,64,70,71,110,111,113,118,132,133,139,157,158,165,214,221,229,231,
         232,233,234,286,303,310,311,312,313,329,333,340,351,353,372,383,384,394,397,400,407,438,439,440,455,459,465,473]
# Limites dos gráficos, na geometria original do PDF. Fora deles estão eixo,
# narrativa e notas. A ordenação por x recupera os 17 anos rotulados na figura.
SERIES = {'nacional':(63,320,450), 'estadual':(111,300,450),
          'federal':(133,320,400), 'trabalho':(158,390,440)}


def download(destination):
    for attempt in range(3):
        try:
            request = urllib.request.Request(URL, headers={'User-Agent':'Scrutiniums-Judiciario/1.0'})
            with urllib.request.urlopen(request, timeout=45) as response, destination.open('wb') as output:
                total = 0
                while chunk := response.read(1024*1024):
                    total += len(chunk)
                    if total > 40*1024*1024:
                        raise ValueError('Relatório ultrapassou o limite de 40 MiB')
                    output.write(chunk)
            return
        except urllib.error.HTTPError as error:
            if error.code not in {429,500,502,503,504} or attempt==2:
                raise
            time.sleep(attempt+1)
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(attempt+1)


def capture(pdf, temporary):
    if hashlib.sha256(pdf.read_bytes()).hexdigest() != PDF_SHA:
        raise ValueError('PDF diverge do original identificado: revisar edição antes de promover')
    txt = temporary/'relatorio.txt'
    subprocess.run(['pdftotext','-layout',str(pdf),str(txt)], check=True, timeout=45)
    pages = txt.read_text().split('\f')
    series = {}
    for identifier,(number,ymin,ymax) in SERIES.items():
        bbox = temporary/f'pagina-{number}.html'
        subprocess.run(['pdftotext','-f',str(number),'-l',str(number),'-bbox',str(pdf),str(bbox)],check=True,timeout=15)
        words = ET.parse(bbox).findall('.//{http://www.w3.org/1999/xhtml}word')
        values = sorted((float(w.attrib['xMin']), w.text) for w in words
                        if float(w.attrib['xMin']) > 130 and ymin < float(w.attrib['yMin']) < ymax
                        and re.fullmatch(r'\d+,\d',w.text or ''))
        if len(values) != 17:
            raise ValueError(f'Série {identifier}: esperados 17 rótulos, recebidos {len(values)}')
        series[identifier] = [dict(ano=year,valor=round(float(value.replace(',','.'))*1e9),
                                  rotuloOriginal=value,pagina=number,unidade='R$ a preços de 2025',
                                  resolucao=100_000_000,x=round(x,3))
                              for year,(x,value) in zip(range(2009,2026),values)]
    return dict(fonte=URL,sha256Original=PDF_SHA,capturadoEm=datetime.now(timezone.utc).date().isoformat(),
                paginas={str(n):pages[n-1] for n in PAGES},seriesDespesas=series,
                convencao='Séries corrigidas pelo CNJ pelo IPCA para 2025; o trecho metodológico não informa mês-base ou média anual. A Scrutiniums reproduz a série publicada, sem recalcular a deflação.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--pdf', type=Path)
    group.add_argument('--baixar', action='store_true')
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as directory:
        temporary = Path(directory)
        pdf = args.pdf or temporary/'original.pdf'
        if args.baixar:
            download(pdf)
        data = capture(pdf, temporary)
        target = ROOT/'pipeline/judiciario/seed/cnj-ampliado.json.gz'
        target.parent.mkdir(parents=True,exist_ok=True)
        packed = gzip.compress(json.dumps(data,ensure_ascii=False,sort_keys=True).encode(),mtime=0)
        target.write_bytes(packed)
        print(json.dumps({'paginas':len(data['paginas']),'sha256_semente':hashlib.sha256(packed).hexdigest()}))


if __name__ == '__main__':
    main()
