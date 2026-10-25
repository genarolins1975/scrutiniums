"""Reprocessa a captura de 24/10 em pasta isolada, sem rede nem publicação.

Uso: python3 docs/ux-2026-10-25/pacote-c/reproduzir-captura.py BANCO_SILVER PASTA_SAIDA
O banco vem da release pipeline-estado.20261024150225, conferida pelo manifesto.
O CSV integral vem da fixture do repositório; a cópia do banco é descartável.
"""
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3
import sys
from unittest.mock import patch

RAIZ = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(RAIZ))
from pipeline import common, desenrola, juros
from pipeline.sources import desenrola as coletor

saida = Path(sys.argv[2]).resolve()
saida.mkdir(parents=True, exist_ok=True)
shutil.copy2(sys.argv[1], saida / 'captura.db')
bronze = gzip.decompress((RAIZ / 'pipeline/tests/fixtures/desenrola/bcb-2026-10-24.csv.gz').read_bytes())
with sqlite3.connect(saida / 'captura.db') as con, \
     patch.object(common, 'GOLD', str(saida)), \
     patch.object(common, 'BRONZE', str(saida / 'bronze')), \
     patch.object(common, 'http_get', return_value=(bronze, {'status': 200})):
    resultados = {'csv_sha256': hashlib.sha256(bronze).hexdigest(), 'juros': juros.build(con)}
    # Reproduz o instante documentado no bronze; não simula uma consulta nova ao BCB.
    # Os builders mantêm gerado_em no instante real deste reprocessamento local.
    with patch.object(common, 'now_utc', return_value='2026-10-24T13:23:24+00:00'):
        resultados['coleta'] = coletor.collect(con)
        resultados['repeticao'] = coletor.collect(con)
    resultados['desenrola'] = desenrola.build(con)
(saida / 'resultado.json').write_text(json.dumps(resultados, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(resultados, ensure_ascii=False, indent=2))
