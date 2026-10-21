"""Leitor do Cadastro Único agregado por município (MDS, MI Social / SAGI).

Fonte: serviço de dados abertos do Ministério do Desenvolvimento e Assistência Social
(https://aplicacoes.mds.gov.br/sagi/servicos/misocial), um índice Solr com uma linha
por município (código IBGE de 6 dígitos, sem o dígito verificador) e mês de
referência (anomes_s, AAAAMM). Campos usados, conferidos em 30/09/2026:

- cadun_qtd_familias_cadastradas_rfpc_ate_meio_sm_i: famílias inscritas no Cadastro
  Único com renda familiar mensal per capita de até meio salário mínimo;
- cadun_qtd_familias_atualizadas_rfpc_ate_meio_sm_i: as mesmas famílias com cadastro
  atualizado nos últimos dois anos (a ANEEL exige cadastro atualizado nos últimos 2
  anos para conceder a Tarifa Social);
- cadun_qtd_familias_cadastradas_i: total de famílias inscritas (todas as rendas), só
  para contexto; o total do cadastro NÃO é o universo elegível.

Contagens são de FAMÍLIAS (unidade familiar do Cadastro Único), não de unidades
consumidoras nem de pessoas.
"""
import csv
import io
import json
import re

URL_MISOCIAL = "https://aplicacoes.mds.gov.br/sagi/servicos/misocial"
CAMPOS = {
    "cadun_qtd_familias_cadastradas_rfpc_ate_meio_sm_i": "familias_ate_meio_sm",
    "cadun_qtd_familias_atualizadas_rfpc_ate_meio_sm_i": "familias_ate_meio_sm_atualizadas",
    "cadun_qtd_familias_cadastradas_i": "familias_total",
}


def params_municipios(anomes):
    """Parâmetros da consulta municipal de um mês (CSV)."""
    return {"q": "*:*", "fq": f"anomes_s:{anomes}", "rows": "6000", "wt": "csv",
            "fl": "codigo_ibge,anomes_s,municipio,sigla_uf," + ",".join(CAMPOS)}


def params_totais():
    """Parâmetros da consulta de totais nacionais por mês (estatísticas do Solr,
    soma de todos os municípios em cada mês de referência)."""
    p = [("q", "*:*"), ("rows", "0"), ("wt", "json"), ("stats", "true"), ("stats.facet", "anomes_s")]
    p += [("stats.field", c) for c in CAMPOS]
    return p


def le_municipios(texto):
    """CSV da consulta municipal → [(cod6, 'AAAA-MM', municipio, uf, {campo: valor|None})].
    Campo vazio é ausência (o MDS deixa em branco o que não informa)."""
    out = []
    for r in csv.DictReader(io.StringIO(texto)):
        cod = (r.get("codigo_ibge") or "").strip()
        am = (r.get("anomes_s") or "").strip()
        if not re.fullmatch(r"\d{6}", cod) or not re.fullmatch(r"\d{6}", am):
            continue
        vals = {}
        for campo, nome in CAMPOS.items():
            s = (r.get(campo) or "").strip()
            vals[nome] = float(s) if re.fullmatch(r"-?\d+(\.\d+)?", s) else None
        out.append((cod, f"{am[:4]}-{am[4:]}", (r.get("municipio") or "").strip(), (r.get("sigla_uf") or "").strip(), vals))
    return out


def le_totais(texto):
    """JSON de estatísticas → {(campo, 'AAAA-MM'): (soma, municipios_com_valor, municipios_sem_valor)}.
    Meses sem nenhum município informado (count = 0) são ausência, não zero."""
    d = json.loads(texto)
    out = {}
    for campo, st in (d.get("stats", {}).get("stats_fields") or {}).items():
        nome = CAMPOS.get(campo)
        if not nome:
            continue
        for am, v in ((st or {}).get("facets", {}).get("anomes_s") or {}).items():
            if not re.fullmatch(r"\d{6}", am) or not v or not v.get("count"):
                continue
            out[(nome, f"{am[:4]}-{am[4:]}")] = (float(v["sum"]), int(v["count"]), int(v.get("missing") or 0))
    return out
