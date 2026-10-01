"""Leitor do número-índice do IPCA (IBGE, tabela SIDRA 1737, variável 2266) usado como
deflator opcional do PLD no módulo PLD (detalhe).

O IPCA é o índice oficial de inflação ao consumidor; o observatório o usa só para
expressar médias mensais do PLD em reais de um mesmo mês (moeda constante), como
perspectiva adicional. O valor nominal continua sendo o dado principal.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia.fontes.ons_pld import numero_ons  # noqa: E402

URL_SIDRA = "https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/2266/p/all?formato=json"
URL_TABELA = "https://sidra.ibge.gov.br/tabela/1737"


def parse_ipca_sidra(texto):
    """Resposta JSON da API SIDRA (tabela 1737, variável 2266) → [("ipca.indice", 'AAAA-MM', valor)].

    A primeira linha da resposta é o cabeçalho descritivo; valores '...' ou '-' (não
    disponível na convenção do IBGE) são ausência. A variável é conferida por código
    para não confundir número-índice com variação mensal."""
    dados = json.loads(texto)
    out = []
    for r in dados[1:]:
        if str(r.get("D2C")) != "2266":
            continue
        periodo = str(r.get("D3C") or "")
        if not re.fullmatch(r"\d{6}", periodo):
            continue
        v, ok = numero_ons(r.get("V"))
        if v is None or not ok:
            continue
        out.append(("ipca.indice", f"{periodo[:4]}-{periodo[4:]}", v))
    return out
