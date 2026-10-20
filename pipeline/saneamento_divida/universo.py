"""Quem entra no capítulo 7.1: as companhias de água e esgoto com demonstrações na CVM, ligadas ao SINISA por CNPJ.

Duas portas, nenhuma por nome:
- operadora: CNPJ que algum município declarou como prestador de água ou esgoto no módulo Gestão Municipal do SINISA
  2024 (mesma leitura do controle societário, capítulo 7);
- holding de grupo: pessoa jurídica marcada como controladora em qualquer nível da cadeia de controle que uma operadora
  declara no Formulário de Referência, com setor de saneamento no cadastro da CVM.

Em ambos os casos a companhia só entra se tiver DFP ou ITR na base estruturada da CVM. As demonstrações consolidadas de
uma holding incluem as das operadoras que ela controla: os números das duas nunca se somam.
"""
from __future__ import annotations

import csv
import gzip
import io
import re
from pathlib import Path

from . import fontes as F

RAIZ = Path(__file__).resolve().parents[2]
SEED_FRE = RAIZ / "pipeline" / "observatorio_saneamento" / "seed" / "cvm"


def cnpj14(v) -> str | None:
    d = re.sub(r"\D", "", str(v or ""))
    return d if len(d) == 14 else None


def cnpj_fmt(d: str) -> str:
    return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}"


def declarados() -> dict[str, set[str]]:
    """CNPJ (14 dígitos) → municípios que o declaram como prestador de água ou esgoto (SINISA 2024, Gestão Municipal)."""
    from pipeline.observatorio_saneamento.controle import declarados_do_seed

    return declarados_do_seed()


def ler_fre() -> tuple[list[dict], list[dict]]:
    """Índice de documentos e posição acionária do FRE já versionados pelo capítulo 7 (sem CPF)."""
    def ler(nome):
        return list(csv.DictReader(io.StringIO(gzip.decompress((SEED_FRE / nome).read_bytes()).decode("utf-8")), delimiter=";"))

    return ler("documentos.csv.gz"), ler("posicao_acionaria.csv.gz")


def controladores_pj(documentos: list[dict], posicao: list[dict]) -> dict[str, list[tuple[str, int]]]:
    """Companhia → [(CNPJ do controlador PJ, nível na cadeia)], do último FRE de cada companhia."""
    ultimo = {}
    for d in documentos:
        c = cnpj14(d["CNPJ_CIA"])
        if c and (c not in ultimo or int(d["VERSAO"]) > int(ultimo[c]["VERSAO"])):
            ultimo[c] = d
    saida: dict[str, list[tuple[str, int]]] = {}
    for c, d in ultimo.items():
        linhas = [p for p in posicao if p["ID_Documento"] == d["ID_DOC"]]
        por_id = {p["ID_Acionista"]: p for p in linhas}

        def nivel(p, visto=()):
            pai = (p["ID_Acionista_Relacionado"] or "").strip()
            if not pai or pai not in por_id or pai in visto:
                return 1
            return 1 + nivel(por_id[pai], visto + (pai,))

        for p in linhas:
            if (p["Acionista_Controlador"] or "").strip().upper() != "S" or (p["Tipo_Pessoa_Acionista"] or "").strip() != "PJ":
                continue
            alvo = cnpj14(p["CPF_CNPJ_Acionista"])
            if alvo:
                saida.setdefault(c, []).append((alvo, nivel(p)))
    return saida


def setor_saneamento(cadastro: list[dict]) -> set[str]:
    return {cnpj14(r["CNPJ_CIA"]) for r in cadastro if F.SETOR_SANEAMENTO in (r.get("SETOR_ATIV") or "")} - {None}


def candidatos(decl: dict[str, set[str]], ctrl: dict[str, list[tuple[str, int]]], cadastro: list[dict]) -> dict[str, dict]:
    """Operadoras declaradas e holdings da cadeia de controle, antes de conferir a presença na base de demonstrações."""
    setor = setor_saneamento(cadastro)
    out: dict[str, dict] = {}
    for c, muns in decl.items():
        out[c] = {"cnpj": c, "papel": "operadora", "municipios_declarados": len(muns), "holdings": [], "controladas": []}
    for op, lista in ctrl.items():
        if op not in decl:
            continue
        for h, niv in sorted(lista, key=lambda x: (x[1], x[0])):
            if h not in setor or h in decl:
                continue
            reg = out.setdefault(h, {"cnpj": h, "papel": "holding", "municipios_declarados": 0, "holdings": [], "controladas": []})
            if op not in reg["controladas"]:
                reg["controladas"].append(op)
            if h not in out[op]["holdings"]:
                out[op]["holdings"].append(h)
    for r in out.values():
        r["controladas"].sort()
    return out


def universo(cands: dict[str, dict], presentes: set[str]) -> list[dict]:
    """Candidatos com DFP ou ITR na base; holdings e controladas restritas ao próprio universo."""
    dentro = {c for c in cands if c in presentes}
    saida = []
    for c in sorted(dentro):
        r = dict(cands[c])
        r["holdings"] = [h for h in r["holdings"] if h in dentro]
        r["controladas"] = [x for x in r["controladas"] if x in dentro]
        saida.append(r)
    return saida
