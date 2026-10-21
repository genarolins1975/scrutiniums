"""Leitores das fontes ONS do módulo PLD (detalhe): CMO semi-horário do DESSEM, CMO semanal
do DECOMP e dicionários de dados do ONS. O IPCA do IBGE fica em fontes/ibge_pld.py.

Por que leitores próprios e estritos, em vez de reaproveitar `ckan.numero_br`:
- o CMO é publicado com ponto decimal e, em alguns arquivos anuais, em notação
  científica ("0E-8" no CMO semanal de 2022); `numero_br` trata vírgula como decimal e
  aceitaria "1.234" como mil, o que num arquivo do ONS seria um erro silencioso;
- a investigação dos zeros do CMO semanal (achado A02) precisa do texto original de
  cada célula, não só do número: um zero escrito "0E-8" e outro escrito "0.0" são o
  mesmo valor, mas a forma é evidência de que vieram de rotinas de exportação distintas;
- vazio é ausência (None), zero é zero; token que não é número entra no relatório de
  leitura como inválido e não vira observação.

Todos os horários do ONS e da CCEE são locais (Brasília). Desde 2019 não há horário de
verão, então a hora local equivale a UTC-3 em todo o período integrado (2020 em diante).
"""
import csv
import io
import json
import re
from datetime import datetime

SUBSISTEMAS = ("SE", "S", "NE", "N")
NOMES_ONS = {"SE": "SUDESTE", "S": "SUL", "NE": "NORDESTE", "N": "NORTE"}

_NUM = re.compile(r"^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$")


def numero_ons(token):
    """Texto de uma célula numérica do ONS → (float|None, valido).

    Vazio → (None, True): ausência declarada, nunca zero. Número com ponto decimal ou
    notação científica → (float, True). Qualquer outra coisa (vírgula, texto) →
    (None, False): o chamador conta como inválido."""
    if token is None:
        return None, True
    s = str(token).strip().strip('"')
    if s == "":
        return None, True
    if not _NUM.match(s):
        return None, False
    return float(s), True


def _linhas_csv(texto):
    leitor = csv.reader(io.StringIO(texto), delimiter=";")
    cab = [c.strip().lstrip("﻿").strip('"') for c in next(leitor)]
    for row in leitor:
        if row:
            yield dict(zip(cab, row))


def meia_hora_ref(din_instante):
    """'2026-09-30 23:30:00' → '2026-09-30T23:30'. Rejeita minuto diferente de 00 e 30:
    o conjunto é semi-horário e um minuto fora da grade indicaria mudança de formato."""
    s = din_instante.strip()
    dt = datetime.strptime(s[:19], "%Y-%m-%d %H:%M:%S")
    if dt.minute not in (0, 30) or dt.second != 0:
        raise ValueError(f"instante fora da grade semi-horária: {s!r}")
    return dt.strftime("%Y-%m-%dT%H:%M")


def parse_cmo_semihorario(linhas):
    """Linhas (dicts) do CSV CMO_SEMIHORARIO_<ano> → (observações, relatório).

    Observações: [(f"cmo_sh.{SM}", "AAAA-MM-DDTHH:MM", valor)], com o instante marcando o
    INÍCIO da meia hora (convenção conferida contra o PLD horário: ver o documento do
    módulo). Relatório: contagens de linhas, zeros, negativos, vazios, inválidos,
    duplicados e subsistemas desconhecidos, para os controles de esquema e domínio."""
    obs, vistos = [], set()
    rel = {"linhas": 0, "observacoes": 0, "zeros": 0, "negativos": 0, "vazios": 0, "invalidos": 0,
           "duplicados": 0, "subsistema_desconhecido": 0, "nome_divergente": 0, "fora_da_grade": 0,
           "primeira": None, "ultima": None}
    for r in linhas:
        rel["linhas"] += 1
        sm = (r.get("id_subsistema") or "").strip().upper()
        if sm not in SUBSISTEMAS:
            rel["subsistema_desconhecido"] += 1
            continue
        if (r.get("nom_subsistema") or "").strip().upper() != NOMES_ONS[sm]:
            rel["nome_divergente"] += 1
        try:
            ref = meia_hora_ref(r.get("din_instante") or "")
        except ValueError:
            rel["fora_da_grade"] += 1
            continue
        v, ok = numero_ons(r.get("val_cmo"))
        if not ok:
            rel["invalidos"] += 1
            continue
        if v is None:
            rel["vazios"] += 1
            continue
        if (sm, ref) in vistos:
            rel["duplicados"] += 1
        vistos.add((sm, ref))
        if v == 0:
            rel["zeros"] += 1
        if v < 0:
            rel["negativos"] += 1
        obs.append((f"cmo_sh.{sm}", ref, v))
        rel["primeira"] = ref if rel["primeira"] is None or ref < rel["primeira"] else rel["primeira"]
        rel["ultima"] = ref if rel["ultima"] is None or ref > rel["ultima"] else rel["ultima"]
    rel["observacoes"] = len(obs)
    return obs, rel


CAMPOS_SEMANAL = ("val_cmomediasemanal", "val_cmoleve", "val_cmomedia", "val_cmopesada")


def parse_cmo_semanal_original(texto):
    """CSV CMO_SEMANAL_<ano> → [(SM, 'AAAA-MM-DD', {campo: (token_original, float|None)})].

    Leitura independente da usada por fontes/ons.py (que alimenta cmo.json): serve à
    reconciliação do achado A02 por outro caminho de código e guarda a forma textual
    de cada célula."""
    out = []
    for r in _linhas_csv(texto):
        sm = (r.get("id_subsistema") or "").strip().upper()
        if sm not in SUBSISTEMAS:
            continue
        semana = (r.get("din_instante") or "").strip()[:10]
        campos = {}
        for c in CAMPOS_SEMANAL:
            tok = (r.get(c) or "").strip()
            v, ok = numero_ons(tok)
            campos[c] = (tok, v if ok else None)
        out.append((sm, semana, campos))
    return out


def parse_cmo_semanal_parquet(caminho_ou_arquivo):
    """Parquet oficial CMO_SEMANAL_<ano> → mesma forma de parse_cmo_semanal_original.

    O Parquet do ONS guarda os valores de 2022 como texto ("0E-8") e os de 2023 em
    diante como double; os dois casos são convertidos por numero_ons."""
    import pyarrow.parquet as pq  # dependência declarada em pipeline/energia/requirements.txt
    tabela = pq.read_table(caminho_ou_arquivo)
    out = []
    for r in tabela.to_pylist():
        sm = (r.get("id_subsistema") or "").strip().upper()
        if sm not in SUBSISTEMAS:
            continue
        t = r.get("din_instante")
        semana = t.strftime("%Y-%m-%d") if hasattr(t, "strftime") else str(t)[:10]
        campos = {}
        for c in CAMPOS_SEMANAL:
            bruto = r.get(c)
            if bruto is None:
                campos[c] = ("", None)
            elif isinstance(bruto, (int, float)):
                campos[c] = (repr(float(bruto)), float(bruto))
            else:
                v, ok = numero_ons(bruto)
                campos[c] = (str(bruto), v if ok else None)
        out.append((sm, semana, campos))
    return out


_UNIDADE = re.compile(r"R\$\s*/\s*(MWh|MW)\b")


def unidade_da_descricao(descricao):
    """'Valor do CMO em R$/MWh' → 'R$/MWh'; 'CMO Médio Semanal, em R$/MW' → 'R$/MW'.
    A unidade é lida do texto da fonte como está: não se corrige R$/MW para R$/MWh."""
    m = _UNIDADE.search(descricao or "")
    return f"R$/{m.group(1)}" if m else None


def parse_dicionario_json(texto):
    """Dicionário simplificado do ONS (JSON) → [{codigo, descricao, unidade}]."""
    d = json.loads(texto)
    out = []
    for item in d.get("dicionario_simplificado", []):
        desc = (item.get("descricao") or "").strip()
        out.append({"codigo": (item.get("codigo") or "").strip(), "descricao": desc,
                    "unidade": unidade_da_descricao(desc)})
    return {"titulo": d.get("titulo"), "campos": out}

