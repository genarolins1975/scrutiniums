"""Observatório do Varejo: séries setoriais (PMC, PAC, contexto macroeconômico).

Uso: python3 -m pipeline.varejo.setor            (coleta e grava public/varejo/gold/setor.json)

Fontes, todas oficiais e com tabela declarada na gold:
  IBGE/SIDRA PMC  8880 (varejo restrito), 8881 (ampliado), 8882 e 8883 (atividades), base 2022 = 100
  IBGE/SIDRA PAC  10645, 10651, 10653, 10655, 10656 (ano de referência 2024, série nova)
  IBGE/SIDRA PNAD Contínua 6392 (massa de rendimento real habitual) e IPCA 7060 (alimentação no domicílio)
  Banco Central SGS 20740 (taxa média de juros do crédito livre a pessoas físicas)
Ausência de dado fica como null; nenhum valor é estimado aqui.
"""
from __future__ import annotations

import hashlib
import json
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / "public" / "varejo" / "gold" / "setor.json"
INICIO = "201801"  # um ano antes de 2019 para permitir comparações interanuais desde jan/2019
SIDRA = "https://apisidra.ibge.gov.br/values"
VARS_PMC = {"7169": "indice", "7170": "indice_sa", "11708": "mm", "11709": "aa", "11710": "ano", "11711": "m12"}
TIPO = {"56733": "receita", "56734": "volume", "56735": "receita", "56736": "volume"}
UFS = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE",
       "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
       "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF"}
# Atividades da PMC. "restrito": entra no varejo restrito e no ampliado; "ampliado": só no ampliado;
# "detalhe": subdivisão de outra atividade (não soma de novo).
ATIVIDADES = {
    "90671": ("combustiveis", "Combustíveis e lubrificantes", "restrito", None),
    "90672": ("alimentar", "Hipermercados, supermercados, produtos alimentícios, bebidas e fumo", "restrito", None),
    "103154": ("hiper-super", "Hipermercados e supermercados", "detalhe", "alimentar"),
    "90673": ("vestuario", "Tecidos, vestuário e calçados", "restrito", None),
    "2759": ("moveis-eletro", "Móveis e eletrodomésticos", "restrito", None),
    "31555": ("moveis", "Móveis", "detalhe", "moveis-eletro"),
    "31556": ("eletrodomesticos", "Eletrodomésticos", "detalhe", "moveis-eletro"),
    "103155": ("farmacia", "Artigos farmacêuticos, médicos, ortopédicos, de perfumaria e cosméticos", "restrito", None),
    "103156": ("livros", "Livros, jornais, revistas e papelaria", "restrito", None),
    "103157": ("informatica", "Equipamentos e materiais para escritório, informática e comunicação", "restrito", None),
    "103158": ("uso-pessoal", "Outros artigos de uso pessoal e doméstico", "restrito", None),
    "103159": ("veiculos", "Veículos, motocicletas, partes e peças", "ampliado", None),
    "2762": ("construcao", "Material de construção", "ampliado", None),
    "56741": ("atacado-alimentar", "Atacado especializado em produtos alimentícios, bebidas e fumo", "ampliado", None),
}


def baixar(url: str, tentativas: int = 4):
    ultimo = None
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "scrutiniums-pipeline"})
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            ultimo = e
            time.sleep(3 * (i + 1))
    raise RuntimeError(f"falha ao baixar {url}: {ultimo}")


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None  # "...", "-", "X": sem dado


def mes(p: str) -> str:
    return f"{p[:4]}-{p[4:]}"


def sidra(tabela: int, caminho: str):
    linhas = baixar(f"{SIDRA}/t/{tabela}/{caminho}?formato=json")
    return linhas[1:]


def blocos(meses):
    return {t: {v: [None] * len(meses) for v in VARS_PMC.values()} for t in ("volume", "receita")}


def coletar_pmc(fim: str):
    periodo = f"p/{INICIO}-{fim}"
    brutas = {t: sidra(t, f"n1/all/n3/all/v/all/{periodo}/c11046/all") for t in (8880, 8881)}
    meses = sorted({mes(r["D3C"]) for r in brutas[8880]})
    pos = {m: i for i, m in enumerate(meses)}
    brasil = {"restrito": blocos(meses), "ampliado": blocos(meses)}
    ufs = {sg: {"restrito": blocos(meses), "ampliado": blocos(meses)} for sg in UFS.values()}
    for tabela, universo in ((8880, "restrito"), (8881, "ampliado")):
        for r in brutas[tabela]:
            alvo = brasil if r["D1C"] == "1" else ufs.get(UFS.get(r["D1C"], ""))
            if alvo is None or r["D2C"] not in VARS_PMC:
                continue
            alvo[universo][TIPO[r["D4C"]]][VARS_PMC[r["D2C"]]][pos[mes(r["D3C"])]] = num(r["V"])
    # atividades, Brasil, série inteira (a 8883 contém as 14; a 8882, as 11 do restrito, idênticas)
    atividades = {slug: {"nome": nome, "universo": uni, "parte_de": pai, **blocos(meses)}
                  for slug, nome, uni, pai in ATIVIDADES.values()}
    for r in sidra(8883, f"n1/all/v/all/{periodo}/c11046/all/c85/all"):
        a = ATIVIDADES.get(r["D5C"])
        if a and r["D2C"] in VARS_PMC:
            atividades[a[0]][TIPO[r["D4C"]]][VARS_PMC[r["D2C"]]][pos[mes(r["D3C"])]] = num(r["V"])
    # atividades por UF: só o último mês, interanual e 12 meses
    ult = fim
    uf_ativ = {sg: {} for sg in UFS.values()}
    for r in sidra(8883, f"n3/all/v/11709,11711/p/{ult}/c11046/all/c85/all"):
        a, sg = ATIVIDADES.get(r["D5C"]), UFS.get(r["D1C"])
        if a and sg:
            uf_ativ[sg].setdefault(a[0], {}).setdefault(TIPO[r["D4C"]], {})[VARS_PMC[r["D2C"]]] = num(r["V"])
    return {"meses": meses, "brasil": brasil, "ufs": ufs, "atividades": atividades, "ufs_atividades": {"mes": mes(ult), "dados": uf_ativ}}


def coletar_pac():
    ano = "2024"
    v645 = {"643": "receita_operacional_liquida", "502": "receita_liquida_revenda", "635": "valor_adicionado", "631": "pessoal_ocupado",
            "368": "unidades_locais", "310": "empresas", "503": "margem_comercializacao", "1400": "taxa_margem",
            "314": "salarios", "504": "compras", "506": "estoque_final"}
    grupos = {}
    for r in sidra(10645, f"n1/all/v/{','.join(v645)}/p/{ano}/c11070/all"):
        nome = r["D4N"]
        if r["D4C"] == "83311" or nome.startswith(("47", "45 ", "46 ")):
            grupos.setdefault(r["D4C"], {"nome": nome})[v645[r["D2C"]]] = num(r["V"])
    # 20 ou mais pessoas ocupadas (porte): empresas e pessoal
    porte = {}
    for r in sidra(10655, f"n1/all/v/540,631/p/{ano}/c11070/83337"):
        porte["empresas_20mais" if r["D2C"] == "540" else "pessoal_20mais"] = num(r["V"])
    # formas de comercialização (empresas com 20+), varejo total
    formas = []
    for r in sidra(10656, f"n1/all/v/866/p/{ano}/c12352/all/c11070/83337"):
        formas.append({"forma": r["D4N"], "receita_bruta_revenda": num(r["V"])})
    # UF: comércio varejista
    v653 = {"310": "empresas", "368": "unidades_locais", "866": "receita_bruta_revenda", "503": "margem_comercializacao", "312": "pessoal_ocupado", "314": "salarios"}
    ufs = {}
    for r in sidra(10653, f"n3/all/v/{','.join(v653)}/p/{ano}/c11066/90084"):
        sg = UFS.get(r["D1C"])
        if sg:
            ufs.setdefault(sg, {})[v653[r["D2C"]]] = num(r["V"])
    return {"ano": int(ano), "unidade_monetaria": "mil reais correntes de 2024", "grupos": grupos, "porte_varejo": porte,
            "formas_comercializacao_20mais": formas, "ufs_varejo": ufs}


def coletar_macro(fim: str):
    periodo = f"p/{INICIO}-{fim}"
    massa = {mes(r["D3C"]): num(r["V"]) for r in sidra(6392, f"n1/all/v/6293/{periodo}")}
    massa_aa = {mes(r["D3C"]): num(r["V"]) for r in sidra(6392, f"n1/all/v/8914/{periodo}")}
    alim = {mes(r["D3C"]): num(r["V"]) for r in sidra(7060, f"n1/all/v/2265/p/202001-{fim}/c315/7171")}
    geral = {mes(r["D3C"]): num(r["V"]) for r in sidra(7060, f"n1/all/v/2265/p/202001-{fim}/c315/7169")}
    sgs = baixar(f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.20740/dados?formato=json&dataInicial=01/01/2018&dataFinal=31/12/{fim[:4]}")
    juros = {f"{d['data'][6:]}-{d['data'][3:5]}": num(d["valor"]) for d in sgs}
    return {
        "massa_renda_real": {"unidade": "milhões de reais, a preços do último trimestre móvel divulgado", "periodicidade": "trimestre móvel encerrado no mês", "valores": massa, "variacao_interanual_pct": massa_aa},
        "ipca_alimentacao_domicilio_12m": {"unidade": "% acumulado em 12 meses", "valores": alim},
        "ipca_geral_12m": {"unidade": "% acumulado em 12 meses", "valores": geral},
        "juros_credito_livre_pf": {"unidade": "% ao ano", "valores": juros},
    }


def main():
    agora = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    meta = baixar("https://servicodados.ibge.gov.br/api/v3/agregados/8880/metadados")
    fim = str(meta["periodicidade"]["fim"])
    pmc = coletar_pmc(fim)
    pac = coletar_pac()
    macro = coletar_macro(fim)

    def f(orgao, nome, tabela, url):
        return {"orgao": orgao, "nome": nome, "tabela": tabela, "url": url, "capturado_em": agora}

    fontes = {
        "pmc_restrito": f("IBGE", "Pesquisa Mensal de Comércio, varejo restrito (2022 = 100)", "SIDRA 8880", "https://sidra.ibge.gov.br/tabela/8880"),
        "pmc_ampliado": f("IBGE", "Pesquisa Mensal de Comércio, varejo ampliado (2022 = 100)", "SIDRA 8881", "https://sidra.ibge.gov.br/tabela/8881"),
        "pmc_atividades": f("IBGE", "Pesquisa Mensal de Comércio, por atividades (2022 = 100)", "SIDRA 8882 e 8883", "https://sidra.ibge.gov.br/tabela/8883"),
        "pac_geral": f("IBGE", "Pesquisa Anual de Comércio 2024, empresas comerciais por atividade", "SIDRA 10645", "https://sidra.ibge.gov.br/tabela/10645"),
        "pac_porte": f("IBGE", "Pesquisa Anual de Comércio 2024, empresas com 20 ou mais pessoas ocupadas", "SIDRA 10655", "https://sidra.ibge.gov.br/tabela/10655"),
        "pac_formas": f("IBGE", "Pesquisa Anual de Comércio 2024, formas de comercialização (20 ou mais pessoas ocupadas)", "SIDRA 10656", "https://sidra.ibge.gov.br/tabela/10656"),
        "pac_uf": f("IBGE", "Pesquisa Anual de Comércio 2024, por unidade da federação", "SIDRA 10653", "https://sidra.ibge.gov.br/tabela/10653"),
        "pnadc_massa": f("IBGE", "PNAD Contínua, massa de rendimento real habitual de todos os trabalhos", "SIDRA 6392", "https://sidra.ibge.gov.br/tabela/6392"),
        "ipca": f("IBGE", "IPCA, variação acumulada em 12 meses", "SIDRA 7060", "https://sidra.ibge.gov.br/tabela/7060"),
        "bcb_juros": f("Banco Central do Brasil", "Taxa média de juros das operações de crédito com recursos livres, pessoas físicas, total", "SGS 20740", "https://www3.bcb.gov.br/sgspub/consultarvalores/consultarValoresSeries.do?method=consultarValores&series=20740"),
    }
    corpo = {"pmc": pmc, "pac": pac, "macro": macro}
    gold = {
        "versao": 1,
        "gerado_por": "pipeline/varejo/setor.py",
        "capturado_em": agora,
        "referencia": {"pmc": mes(fim), "pac": "2024"},
        "notas": {
            "pmc_base": "Índices com base 2022 = 100. O varejo ampliado soma ao restrito veículos, motocicletas, partes e peças, material de construção e, desde janeiro de 2023, o atacado especializado em produtos alimentícios, bebidas e fumo.",
            "pmc_pesos": "O IBGE não publica no SIDRA os pesos das atividades; a gold não calcula contribuições em pontos percentuais.",
            "pac": "PAC 2024, série nova: valores em mil reais correntes de 2024; não comparável diretamente com a série encerrada em 2023.",
        },
        "fontes": fontes,
        **corpo,
        "hash_dados": hashlib.sha256(json.dumps(corpo, sort_keys=True, ensure_ascii=False).encode()).hexdigest(),
    }
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps(gold, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"setor.json: {SAIDA.stat().st_size // 1024} KB, PMC até {mes(fim)}, {len(pmc['meses'])} meses")


if __name__ == "__main__":
    sys.exit(main())
