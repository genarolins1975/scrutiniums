"""População residente estimada de todos os municípios (SIDRA, tabela 6579, variável 9324): denominador da referência nacional.

Mesma publicação, mesma variável e mesma política do indicador das capitais (valor vigente do SIDRA, estimativa
de 1º de julho do exercício). Uma única consulta traz os 5.570 municípios; a resposta fica no seed com sha256.
"""
import json
import os

from pipeline.eficiencia import base
from pipeline.eficiencia.fontes import ibge_populacao as I


def coleta(ano):
    capturado_em = base.agora_utc()
    url = f"{I.SIDRA}/t/6579/n6/all/v/9324/p/{ano}"
    bruto = I._get(url)
    linhas = json.loads(bruto.decode("utf-8"))[1:]
    pop = {}
    for x in linhas:
        v = x.get("V")
        pop[int(x["D1C"])] = int(v) if v not in (None, "", "-", "...", "X") and str(v).isdigit() else None
    destino = os.path.join(base.SEED, "ibge_populacao", f"populacao_municipios_{ano}.json.gz")
    sha = base.grava_json_gz(destino, [{"cod": c, "valor": pop[c]} for c in sorted(pop)])
    base.registra_captura(f"ibge_populacao_municipios_{ano}", {
        "instituicao": "Instituto Brasileiro de Geografia e Estatística (IBGE)",
        "conjunto": f"População residente estimada de todos os municípios, {ano} (SIDRA 6579, variável 9324, referência 1º de julho)",
        "pagina": I.PAGINA_ESTIMATIVAS, "url": url, "capturado_em": capturado_em,
        "parametros": f"n6/all; {len(pop)} municípios; valor vigente no SIDRA na data da captura",
        "sha256_resposta": base.sha256_bytes(bruto), "recorte": os.path.relpath(destino, base.RAIZ), "sha256_recorte": sha,
        "linhas_recorte": len(pop), "municipios_sem_valor": sum(1 for v in pop.values() if v is None),
    })
    return len(pop)
