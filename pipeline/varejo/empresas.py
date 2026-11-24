"""Observatório do Varejo: demonstrações das companhias abertas (CVM, DFP e ITR, consolidado).

Uso: python3 -m pipeline.varejo.empresas     (grava public/varejo/gold/empresas.json)

Lê os arquivos anuais (DFP) e trimestrais (ITR) do portal de dados abertos da CVM. De cada
exercício usa a coluna "ÚLTIMO" do próprio arquivo daquele ano (o número como foi publicado);
quando o exercício seguinte reapresenta o valor na coluna "PENÚLTIMO" com diferença relevante,
a gold marca a reapresentação. Dívida líquida, margens e a ponte de R$ 100 são cálculos desta
gold, com a fórmula declarada em "formulas". Campo não encontrado fica null.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import re
import sys
import tempfile
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / "public" / "varejo" / "gold" / "empresas.json"
CACHE = Path(os.environ.get("VAREJO_CACHE_CVM", Path(tempfile.gettempdir()) / "varejo-cvm"))
ANOS_DFP = [2021, 2022, 2023, 2024, 2025]
ANOS_ITR = [2025, 2026]
BASE = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC"

# slug -> (código CVM, nome de exibição). Inclui os grupos do ranking com registro na CVM e
# pares de segmento usados no comparador.
EMPRESAS = {
    "carrefour-brasil": ("024171", "Grupo Carrefour Brasil (Atacadão S.A.)"),
    "assai": ("025372", "Assaí (Sendas Distribuidora)"),
    "rd-saude": ("005258", "RD Saúde (Raia Drogasil)"),
    "magazine-luiza": ("022470", "Magazine Luiza"),
    "grupo-mateus": ("025186", "Grupo Mateus"),
    "casas-bahia": ("006505", "Grupo Casas Bahia"),
    "natura": ("019550", "Natura"),
    "gpa": ("014826", "GPA (Companhia Brasileira de Distribuição)"),
    "lojas-renner": ("008133", "Lojas Renner"),
    "americanas": ("020990", "Americanas"),
    "pague-menos": ("022608", "Pague Menos"),
    "cea": ("024848", "C&A Modas"),
    "guararapes": ("004669", "Guararapes (Riachuelo)"),
    "azzas": ("022349", "Azzas 2154"),
    "grupo-sbf": ("024694", "Grupo SBF (Centauro)"),
    "panvel": ("009342", "Panvel (Dimed)"),
    "vivara": ("024805", "Vivara"),
    "zamp": ("024317", "Zamp (Burger King Brasil)"),
}

DRE = {"3.01": "receita_liquida", "3.02": "custo", "3.03": "lucro_bruto", "3.04": "despesas_operacionais", "3.05": "ebit",
       "3.06": "resultado_financeiro", "3.07": "lucro_antes_ir", "3.08": "ir_csll", "3.09": "lucro_operacoes_continuadas",
       "3.10": "operacoes_descontinuadas", "3.11": "lucro_liquido"}
BPA = {"1": "ativo_total", "1.01.01": "caixa", "1.01.02": "aplicacoes", "1.01.03": "contas_a_receber", "1.01.04": "estoques"}
BPP = {"2.01.02": "fornecedores", "2.01.04": "emprestimos_cp", "2.02.01": "emprestimos_lp", "2.03": "patrimonio_liquido"}
DFC = {"6.01": "caixa_operacional", "6.02": "caixa_investimento", "6.03": "caixa_financiamento"}
# Linhas do fluxo de caixa operacional identificadas pela descrição (as contas variam por empresa)
GIRO = {"var_estoques": r"^estoques?", "var_fornecedores": r"^fornecedor", "var_recebiveis": r"^contas a receber|^clientes"}
CAPEX = r"imobilizado|intang"


def arquivo(tipo: str, ano: int) -> zipfile.ZipFile:
    CACHE.mkdir(parents=True, exist_ok=True)
    destino = CACHE / f"{tipo}_{ano}.zip"
    if not destino.exists():
        url = f"{BASE}/{tipo.upper()}/DADOS/{tipo}_cia_aberta_{ano}.zip"
        with urllib.request.urlopen(url, timeout=600) as r:
            destino.write_bytes(r.read())
    return zipfile.ZipFile(destino)


def linhas(z: zipfile.ZipFile, nome: str):
    with z.open(nome) as f:
        yield from csv.DictReader(io.TextIOWrapper(f, encoding="latin-1"), delimiter=";")


def valor(r) -> float:
    v = float(r["VL_CONTA"])
    return v * 1000 if r["ESCALA_MOEDA"].upper().startswith("MIL") else v


def ler(tipo: str, ano: int, codigos: set[str]):
    """Devolve {cd_cvm: {dt_refer: {"doc":…, "ultimo": {campo: valor}, "penultimo": {...}}}} com a última versão."""
    z = arquivo(tipo, ano)
    docs = {}
    for r in linhas(z, f"{tipo}_cia_aberta_{ano}.csv"):
        if r["CD_CVM"] in codigos:
            chave = (r["CD_CVM"], r["DT_REFER"])
            if chave not in docs or int(r["VERSAO"]) > int(docs[chave]["VERSAO"]):
                docs[chave] = r
    versao = {k: v["VERSAO"] for k, v in docs.items()}
    saida = {}

    def alvo(r, ordem):
        d = saida.setdefault(r["CD_CVM"], {}).setdefault(r["DT_REFER"], {"ultimo": {}, "penultimo": {}, "capex_linhas": []})
        return d["ultimo" if ordem == "ÚLTIMO" else "penultimo"]

    def processar(base: str, restritos: set[str]):
        vistos = set()
        for quadro, mapa in (("DRE", DRE), ("BPA", BPA), ("BPP", BPP), ("DFC_MI", DFC)):
            for r in linhas(z, f"{tipo}_cia_aberta_{quadro}_{base}_{ano}.csv"):
                if r["CD_CVM"] not in restritos or versao.get((r["CD_CVM"], r["DT_REFER"])) != r["VERSAO"]:
                    continue
                ordem = r["ORDEM_EXERC"]
                # ITR: DRE e DFC trazem o trimestre isolado e o acumulado; fica o acumulado (início em 1º de janeiro)
                if tipo == "itr" and quadro in ("DRE", "DFC_MI") and not r.get("DT_INI_EXERC", "").endswith("-01-01"):
                    continue
                vistos.add(r["CD_CVM"])
                a = alvo(r, ordem)
                a["base"] = "consolidado" if base == "con" else "individual"
                cd, ds = r["CD_CONTA"], r["DS_CONTA"].strip()
                v = valor(r)
                if cd in mapa:
                    a[mapa[cd]] = v
                # parcelas que a página permite abrir: despesas operacionais, resultado financeiro,
                # variações de ativos e passivos e fluxo de financiamento (nível imediatamente abaixo)
                for pai, chave in (("3.04", "abre_despesas"), ("3.06", "abre_financeiro"), ("6.01.02", "abre_giro"), ("6.03", "abre_financiamento")):
                    if cd.startswith(pai + ".") and cd.count(".") == pai.count(".") + 1 and v != 0:
                        a.setdefault(chave, []).append({"conta": cd, "descricao": ds, "valor": v})
                if quadro == "DFC_MI" and cd.startswith("6.01.") and cd.count(".") >= 2 and v != 0:
                    for campo, padrao in GIRO.items():
                        if re.search(padrao, ds, re.I) and campo not in a:
                            a[campo] = v
                if quadro == "DFC_MI" and cd.startswith("6.02.") and re.search(CAPEX, ds, re.I) and re.search(r"aquisi|compra|adi[çc]|aplica|pagamento", ds, re.I):
                    a["capex"] = a.get("capex", 0.0) + v
                if quadro == "BPP" and re.search(r"arrendamento", ds, re.I) and re.match(r"2\.0[12]\.", cd) and cd.count(".") >= 2:
                    # evita dupla contagem de conta-pai e conta-filha com a mesma descrição
                    chave = "arrendamento_cp" if cd.startswith("2.01") else "arrendamento_lp"
                    a[chave] = max(a.get(chave, 0.0), v)
        return vistos

    com_consolidado = processar("con", codigos)
    # companhia sem controladas apresenta só a demonstração individual (caso da Sendas/Assaí)
    processar("ind", codigos - com_consolidado)
    for (cd, dt), d in docs.items():
        if cd in saida and dt in saida[cd]:
            saida[cd][dt]["doc"] = {"versao": int(d["VERSAO"]), "recebido_em": d["DT_RECEB"], "link": d["LINK_DOC"].replace("http://", "https://", 1), "denominacao": d["DENOM_CIA"], "cnpj": d["CNPJ_CIA"]}
    return saida


def derivar(p: dict) -> dict:
    g = p.get
    rl = g("receita_liquida")

    def pct(x):
        return round(100 * x / rl, 2) if rl and x is not None else None

    divida = None
    if g("emprestimos_cp") is not None or g("emprestimos_lp") is not None:
        divida = (g("emprestimos_cp") or 0) + (g("emprestimos_lp") or 0) - (g("caixa") or 0) - (g("aplicacoes") or 0)
    arr = None
    if g("arrendamento_cp") is not None or g("arrendamento_lp") is not None:
        arr = (g("arrendamento_cp") or 0) + (g("arrendamento_lp") or 0)
    # pagamentos a fornecedores via convênio (risco sacado) que a companhia classifica no fluxo de financiamento
    # só pagamentos ou variação líquida da conta; captação de financiamento ligada a fornecedores é entrada de
    # dívida, não pagamento a fornecedor, e fica fora do ajuste (caso da Vivara)
    conv = [x["valor"] for x in p.get("abre_financiamento", [])
            if re.search(r"fornecedor|conv[eê]nio|risco sacado", x["descricao"], re.I) and not re.search(r"capta", x["descricao"], re.I)]
    p["convenio_fornecedores_no_financiamento"] = sum(conv) if conv else None
    p["caixa_operacional_apos_convenio"] = (g("caixa_operacional") + sum(conv)) if conv and g("caixa_operacional") is not None else None
    p["divida_liquida_sem_arrendamento"] = divida
    p["passivo_arrendamento"] = arr
    p["margem_bruta_pct"] = pct(g("lucro_bruto"))
    p["margem_operacional_pct"] = pct(g("ebit"))
    p["margem_liquida_pct"] = pct(g("lucro_liquido"))
    # ponte de R$ 100 de receita líquida (soma exata até o lucro líquido consolidado)
    if rl and all(g(k) is not None for k in ("custo", "despesas_operacionais", "resultado_financeiro", "ir_csll", "lucro_liquido")):
        base = {k: 100 * g(k) / rl for k in ("custo", "despesas_operacionais", "resultado_financeiro", "ir_csll")}
        ll = 100 * g("lucro_liquido") / rl
        outros = ll - (100 + sum(base.values()))  # operações descontinuadas e arredondamentos
        p["ponte_100"] = {**{k: round(v, 2) for k, v in base.items()}, "descontinuadas_e_outros": round(outros, 2), "lucro_liquido": round(ll, 2)}
    else:
        p["ponte_100"] = None
    return p


def main():
    agora = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    codigos = {c for c, _ in EMPRESAS.values()}
    dfp = {ano: ler("dfp", ano, codigos) for ano in ANOS_DFP}
    itr = {ano: ler("itr", ano, codigos) for ano in ANOS_ITR}
    empresas = {}
    for slug, (cd, nome) in EMPRESAS.items():
        anuais, doc0 = [], None
        for ano in ANOS_DFP:
            d = dfp[ano].get(cd, {}).get(f"{ano}-12-31")
            if not d or not d["ultimo"].get("receita_liquida"):
                continue
            p = derivar({"exercicio": ano, "data_base": f"{ano}-12-31", **d["ultimo"], "documento": d.get("doc")})
            seg = dfp.get(ano + 1, {}).get(cd, {}).get(f"{ano + 1}-12-31")
            if seg and seg["penultimo"].get("receita_liquida"):
                novo, antigo = seg["penultimo"]["receita_liquida"], d["ultimo"]["receita_liquida"]
                novo_ll, antigo_ll = seg["penultimo"].get("lucro_liquido"), d["ultimo"].get("lucro_liquido")
                if abs(novo - antigo) > 0.005 * abs(antigo) or (novo_ll is not None and antigo_ll is not None and abs(novo_ll - antigo_ll) > max(0.02 * abs(antigo_ll), 1e6)):
                    p["reapresentado_no_exercicio_seguinte"] = {"receita_liquida": novo, "lucro_liquido": novo_ll}
            anuais.append(p)
            doc0 = d.get("doc") or doc0
        # último trimestre disponível (acumulado no ano) e o mesmo período do ano anterior
        trimestre = None
        for ano in reversed(ANOS_ITR):
            datas = sorted(itr[ano].get(cd, {}))
            if datas:
                dt = datas[-1]
                d = itr[ano][cd][dt]
                if d["ultimo"].get("receita_liquida"):
                    trimestre = {"data_base": dt, "periodo": f"acumulado de janeiro a {dt[5:7]}/{dt[:4]}",
                                 "atual": derivar({**d["ultimo"]}), "mesmo_periodo_ano_anterior": derivar({**d["penultimo"]}), "documento": d.get("doc")}
                    doc0 = doc0 or d.get("doc")
                    break
        if not anuais and not trimestre:
            continue
        empresas[slug] = {"nome": nome, "cd_cvm": cd, "cnpj": (doc0 or {}).get("cnpj"), "denominacao_cvm": (doc0 or {}).get("denominacao"),
                          "anuais": anuais, "ultimo_trimestre": trimestre}
    corpo = {"empresas": empresas}
    gold = {
        "versao": 1, "gerado_por": "pipeline/varejo/empresas.py", "capturado_em": agora,
        "unidade": "reais correntes; demonstrações consolidadas (individuais quando a companhia não tem controladas, marcado em 'base')",
        "fontes": {
            "dfp": {"orgao": "CVM", "nome": "Demonstrações Financeiras Padronizadas (DFP), dados abertos", "url": "https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp", "capturado_em": agora, "exercicios": ANOS_DFP},
            "itr": {"orgao": "CVM", "nome": "Informações Trimestrais (ITR), dados abertos", "url": "https://dados.cvm.gov.br/dataset/cia_aberta-doc-itr", "capturado_em": agora, "exercicios": ANOS_ITR},
        },
        "formulas": {
            "margem_bruta_pct": "lucro bruto (conta 3.03) ÷ receita líquida (3.01) × 100",
            "margem_operacional_pct": "resultado antes do resultado financeiro e dos tributos (3.05) ÷ receita líquida × 100",
            "margem_liquida_pct": "lucro ou prejuízo consolidado do período (3.11) ÷ receita líquida × 100",
            "divida_liquida_sem_arrendamento": "empréstimos e financiamentos de curto (2.01.04) e longo prazo (2.02.01) − caixa e equivalentes (1.01.01) − aplicações financeiras (1.01.02); não inclui passivo de arrendamento nem antecipação de recebíveis",
            "ponte_100": "cada rubrica da DRE (3.02, 3.04, 3.06, 3.08) dividida pela receita líquida × 100; 'descontinuadas_e_outros' fecha a diferença até o lucro líquido consolidado (3.11)",
            "caixa_operacional_apos_convenio": "caixa líquido das atividades operacionais (6.01) + linhas de fornecedores por convênio ou risco sacado que a companhia apresenta no fluxo de financiamento (6.03), sejam pagamentos ou a variação líquida da conta, conforme a companhia divulga; linhas de captação ficam fora; só existe quando a companhia apresenta essas linhas",
            "capex": "soma das linhas do fluxo de investimento (6.02) descritas como aquisição ou adição de imobilizado e intangível",
            "var_estoques, var_fornecedores, var_recebiveis": "linhas do fluxo de caixa operacional (6.01) com essas descrições; sinal negativo consome caixa",
        },
        **corpo,
        "hash_dados": hashlib.sha256(json.dumps(corpo, sort_keys=True, ensure_ascii=False).encode()).hexdigest(),
    }
    SAIDA.write_text(json.dumps(gold, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"empresas.json: {SAIDA.stat().st_size // 1024} KB, {len(empresas)} companhias")


if __name__ == "__main__":
    sys.exit(main())
