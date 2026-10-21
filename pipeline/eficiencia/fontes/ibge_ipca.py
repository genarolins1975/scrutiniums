"""IPCA (IBGE): número-índice mensal para correção monetária opcional da despesa.

API de agregados do IBGE (SIDRA), tabela 1737, variável 2266 (IPCA, número-índice,
base dezembro de 1993 = 100), Brasil. https://servicodados.ibge.gov.br/api/docs/agregados?versao=3
"""
import json
import os
import time
import urllib.request

from pipeline.eficiencia import base

URL = ("https://servicodados.ibge.gov.br/api/v3/agregados/1737/periodos/{periodos}"
       "/variaveis/2266?localidades=N1[all]")
PAGINA = "https://sidra.ibge.gov.br/tabela/1737"


def coleta(ano_ini, ano_fim):
    periodos = "|".join(f"{a}{m:02d}" for a in range(ano_ini, ano_fim + 1) for m in range(1, 13))
    url = URL.format(periodos=periodos)
    capturado_em = base.agora_utc()
    espera, ultimo = 2, None
    for _ in range(4):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                corpo = json.loads(r.read().decode("utf-8"))
            break
        except Exception as e:
            ultimo = e
            time.sleep(espera)
            espera *= 2
    else:
        raise RuntimeError(f"IBGE indisponível: {ultimo}")
    destino = os.path.join(base.SEED, "ibge_ipca", f"ipca_numero_indice_{ano_ini}_{ano_fim}.json.gz")
    sha = base.grava_json_gz(destino, corpo)
    serie = corpo[0]["resultados"][0]["series"][0]["serie"]
    base.registra_captura("ibge_ipca", {
        "instituicao": "Instituto Brasileiro de Geografia e Estatística (IBGE)",
        "conjunto": "IPCA, número-índice (base dezembro de 1993 = 100), tabela 1737, variável 2266",
        "pagina": PAGINA,
        "url": url,
        "capturado_em": capturado_em,
        "parametros": f"Brasil, meses de janeiro de {ano_ini} a dezembro de {ano_fim}",
        "recorte": os.path.relpath(destino, base.RAIZ),
        "sha256_recorte": sha,
        "linhas_recorte": len(serie),
    })
    return len(serie)
