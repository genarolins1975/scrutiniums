"""APS mensal: resposta oficial preservada, separada das comparações anuais.

Não interpola meses ausentes, não limita cobertura a 100% e não soma estoques.
A fórmula atual não reconcilia 2021; esse ano é apenas registro histórico.
"""
import csv
import gzip
import hashlib
import json
import math
import os
import re

from pipeline.eficiencia import entes
from pipeline.eficiencia_saude import base

CAMPOS = {
    "cobertura_pct": "qtCobertura", "capacidade_pessoas": "qtCapacidadeEquipe",
    "populacao_referencia": "qtPopulacao", "esf": "qtEsf", "eap20": "qtEap20", "eap30": "qtEap30",
    "esfr": "qtEsfr", "ecr": "qtEcr", "eapp20": "qtEapp20", "eapp30": "qtEapp30",
    "cadastros_equipes_especiais": "qtCadastroEquipeEsfrEcrEapp",
}
VERSAO = "aps-mensal-1"


def normaliza(registros, codigo):
    linhas, vistos = [], set()
    for r in registros:
        if str(r.get("coMunicipioIbge")) != str(codigo)[:6]:
            raise ValueError(f"APS mensal: município divergente de {codigo}")
        comp = r.get("nuComp", "")
        if not re.fullmatch(r"(0[1-9]|1[0-2])/20\d{2}", comp):
            raise ValueError(f"APS mensal: competência inválida {comp!r}")
        mes, ano = comp.split("/")
        if int(ano) < 2021:
            raise ValueError("APS mensal: período anterior ao método desta série")
        periodo = f"{ano}-{mes}"
        if periodo in vistos:
            raise ValueError(f"APS mensal: competência duplicada {codigo}/{periodo}")
        vistos.add(periodo)
        valores = {}
        for chave, origem in CAMPOS.items():
            v = r.get(origem)
            if v is not None and (isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or v < 0 or (chave != "cobertura_pct" and v != int(v))):
                raise ValueError(f"APS mensal: valor inválido {codigo}/{periodo}/{origem}")
            valores[chave] = v
        pop, cap, cob = (valores[k] for k in ("populacao_referencia", "capacidade_pessoas", "cobertura_pct"))
        if pop == 0:
            raise ValueError(f"APS mensal: denominador zero {codigo}/{periodo}")
        completo = all(v is not None for v in valores.values())
        if pop is not None and cap is not None and cob is not None and abs(cap / pop * 100 - cob) > .011:
            raise ValueError(f"APS mensal: cobertura não reconcilia {codigo}/{periodo}")
        formula = None
        if all(valores[k] is not None for k in ("esf", "eap20", "eap30", "cadastros_equipes_especiais")):
            formula = valores["esf"] * 3500 + valores["eap20"] * 1750 + valores["eap30"] * 2625 + valores["cadastros_equipes_especiais"]
        if int(ano) >= 2022 and cap is not None and formula is not None and abs(formula - cap) > 1:
            raise ValueError(f"APS mensal: capacidade não reconcilia {codigo}/{periodo}")
        linhas.append({"codigo_ibge": codigo, "competencia": periodo, **valores,
                       "origem_populacao": r.get("tpOrigemBasePopulacao"),
                       "status": ("PROVISORIO" if int(ano) >= 2026 else "OBSERVADO") if completo else "INCOMPLETO",
                       "metodo": "regra_anterior_2021" if int(ano) == 2021 else "formula_atual"})
    return sorted(linhas, key=lambda x: x["competencia"])


def constroi():
    arquivos = base.le_manifesto()["capturas"]["relatorio_aps_cobertura"]["arquivos"]
    linhas, fontes = [], {}
    for codigo, nome, uf in entes.CAPITAIS:
        fonte = arquivos[str(codigo)]
        caminho = os.path.join(base.RAIZ, fonte["recorte"])
        with gzip.open(caminho, "rb") as f:
            hash_seed = base.sha256_bytes(f.read())
        if hash_seed != fonte["sha256"]:
            raise ValueError(f"APS mensal: hash do seed divergente {codigo}")
        registros = base.le_json_gz(caminho)
        if not registros or len(registros) != fonte["linhas"]:
            raise ValueError(f"APS mensal: contagem divergente {codigo}")
        linhas.extend(normaliza(registros, codigo))
        fontes[str(codigo)] = {**fonte, "capital": nome, "uf": uf}
    competencias = sorted({r["competencia"] for r in linhas})
    hash_dados = hashlib.sha256(json.dumps(linhas, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return {"versao": VERSAO, "hash_dados": hash_dados, "competencias": competencias,
            "campos": CAMPOS, "fontes": fontes, "linhas": linhas,
            "cobertura": [{"competencia": c, "capitais_com_registro": sum(r["competencia"] == c for r in linhas),
                           "capitais_com_valor": sum(r["competencia"] == c and r["cobertura_pct"] is not None for r in linhas)} for c in competencias]}


def publica(dados, caminho):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    extras = ["capital", "uf", "fonte_url", "data_captura", "sha256_seed", "versao", "hash_dados"]
    with open(caminho, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=[*dados["linhas"][0], *extras], lineterminator="\n")
        w.writeheader()
        for linha in dados["linhas"]:
            fonte = dados["fontes"][str(linha["codigo_ibge"]) ]
            w.writerow({**linha, "capital": fonte["capital"], "uf": fonte["uf"], "fonte_url": fonte["url"],
                        "data_captura": fonte["capturado_em"], "sha256_seed": fonte["sha256"],
                        "versao": dados["versao"], "hash_dados": dados["hash_dados"]})
