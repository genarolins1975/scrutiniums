"""Reproduz a rodada de 25/10 sobre o estado deixado em 24/10, com o CSV real do BCB.

Uso, num diretório de rascunho DIR fora do repositório:
  mkdir -p DIR/legado && git show 9f1505ad:pipeline/sources/desenrola.py > DIR/legado/desenrola_antigo.py
  curl -o DIR/dados.csv https://www.bcb.gov.br/pda/desig/desenrola/dados_desenrola.csv
  python3 docs/confiabilidade-2026-10-24/credito/desenrola-contrato-reproducao.py DIR DIR/dados.csv
"""
import importlib.util, json, shutil, sqlite3, sys, tempfile
from pathlib import Path
from unittest.mock import patch
RAIZ = Path(__file__).resolve().parents[3]; sys.path.insert(0, str(RAIZ))
S = Path(sys.argv[1]); csv_real = Path(sys.argv[2]).read_bytes()
from pipeline import common
from pipeline.sources import desenrola as coletor
from pipeline import desenrola as builder
import scripts.sanidade_gold as sg
spec = importlib.util.spec_from_file_location('antigo', S/'legado/desenrola_antigo.py')
antigo = importlib.util.module_from_spec(spec); spec.loader.exec_module(antigo)
tmp = Path(tempfile.mkdtemp(dir=S)); gold = tmp/'gold'; pub = tmp/'publicado'; gold.mkdir(); pub.mkdir()
shutil.copy2(RAIZ/'public/obs/data/gold/desenrola.json', pub/'desenrola.json')
(gold/'meta.json').write_text('{}')
con = sqlite3.connect(':memory:')
with patch.object(common, 'BRONZE', str(tmp)), patch.object(common, 'GOLD', str(gold)), \
     patch.object(common, 'record_lineage'), patch.object(common, 'http_get', return_value=(csv_real, {'status': 200})):
    r0 = antigo.collect(con); con.commit()
    print('24/10, código antigo:', r0)
    print('   silver:', con.execute("SELECT COUNT(*), MAX(data_base), SUM(tipo NOT IN ('faixa1','faixa2','pequenos_negocios')) FROM desenrola_op").fetchone())
    r1 = coletor.collect(con); con.commit()
    print('25/10, coletor com contrato:', {k: (v[:90] if isinstance(v, str) else v) for k, v in r1[0].items()})
    print('   silver preservado:', con.execute("SELECT COUNT(*), MAX(data_base) FROM desenrola_op").fetchone())
    print('   build:', builder.build(con))
    print('   candidata:', json.loads((gold/'desenrola.json').read_text())['motivo'][:160])
with patch.object(sg, 'NOVO', gold), patch.object(sg, 'PUBLICADO', pub):
    sg.main()
d = json.loads((gold/'desenrola.json').read_text())
print('publicação mantida:', d['data_base'], d['meses'], 'meses,', d['totais_scr']['operacoes'], 'operações, bronze', d['bronze_sha'][:12])
print('restaurados:', json.loads((gold/'meta.json').read_text())['restaurados'])
