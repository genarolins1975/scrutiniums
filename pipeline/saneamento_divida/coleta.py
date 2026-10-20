"""Coleta do capítulo 7.1: cadastro, DFP e ITR da CVM, filtrados para as companhias de água e esgoto.

Baixa o cadastro de companhias abertas, os ZIPs da DFP desde 2010 e os do ITR desde 2015 e guarda no seed só as linhas
das companhias do universo (universo.py) e das contas usadas (fontes.CONTAS), na última versão de cada documento. Cada
arquivo original fica registrado no manifesto com endereço, tamanho, sha256 e a data de modificação informada pelo
servidor; cada membro lido do ZIP, com o próprio sha256.

`--zips PASTA` lê os ZIPs e o cadastro de uma pasta local com os mesmos nomes do portal (cópia já baixada), sem rede.
"""
from __future__ import annotations

import csv
import datetime as dt
import gzip
import hashlib
import io
import json
import time
import urllib.request
import zipfile
from pathlib import Path

from . import fontes as F
from . import universo as U

AQUI = Path(__file__).resolve().parent
SEED = AQUI / "seed"
COLUNAS_DEM = [
    "fonte", "escopo", "demonstracao", "CNPJ_CIA", "DT_REFER", "VERSAO", "CD_CVM", "ESCALA_MOEDA", "ORDEM_EXERC",
    "DT_INI_EXERC", "DT_FIM_EXERC", "CD_CONTA", "DS_CONTA", "VL_CONTA",
]
COLUNAS_DOC = ["fonte", "CNPJ_CIA", "DT_REFER", "VERSAO", "DENOM_CIA", "CD_CVM", "CATEG_DOC", "ID_DOC", "DT_RECEB", "LINK_DOC"]
COLUNAS_CAD = ["CNPJ_CIA", "DENOM_SOCIAL", "DENOM_COMERC", "CD_CVM", "SETOR_ATIV", "SIT", "DT_REG", "DT_CANCEL", "CATEG_REG", "TP_MERC"]


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def baixar(url: str, pasta_local: Path | None) -> tuple[bytes, str | None]:
    if pasta_local is not None:
        return (pasta_local / url.rsplit("/", 1)[1]).read_bytes(), None
    erro = None
    for tentativa in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": F.UA}), timeout=300) as r:
                return r.read(), r.headers.get("Last-Modified")
        except Exception as e:  # noqa: BLE001 - rede instável: tenta de novo e, na quarta, propaga
            erro = e
            time.sleep(5 * (tentativa + 1))
    raise RuntimeError(f"falha ao baixar {url}: {erro}")


def _csv(bruto: bytes) -> list[dict]:
    return list(csv.DictReader(io.StringIO(bruto.decode("latin-1")), delimiter=";"))


def _gravar(nome: str, linhas: list[dict], colunas: list[str]) -> dict:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=colunas, delimiter=";", lineterminator="\n", extrasaction="ignore")
    w.writeheader()
    w.writerows(linhas)
    bruto = buf.getvalue().encode("utf-8")
    (SEED / f"{nome}.gz").write_bytes(gzip.compress(bruto, mtime=0))
    return {"arquivo": f"{nome}.gz", "sha256": sha(bruto), "bytes": len(bruto), "linhas": len(linhas)}


def _ultima_versao(linhas: list[dict]) -> list[dict]:
    """Só a maior VERSAO de cada (companhia, data de referência): a reapresentação substitui a anterior."""
    maior: dict[tuple[str, str], int] = {}
    for l in linhas:
        k = (l["CNPJ_CIA"], l["DT_REFER"])
        maior[k] = max(maior.get(k, 0), int(l["VERSAO"]))
    return [l for l in linhas if int(l["VERSAO"]) == maior[(l["CNPJ_CIA"], l["DT_REFER"])]]


def ler_zip(fonte: str, ano: int, bruto: bytes, alvo: set[str]) -> tuple[list[dict], list[dict], dict, set[str]]:
    """Linhas de demonstração e de índice das companhias-alvo num ZIP da DFP ou do ITR, e o sha256 de cada membro lido."""
    prefixo = fonte.lower()
    z = zipfile.ZipFile(io.BytesIO(bruto))
    membros, dem, docs, presentes = {}, [], [], set()
    nome_idx = f"{prefixo}_cia_aberta_{ano}.csv"
    b = z.read(nome_idx)
    membros[nome_idx] = {"sha256": sha(b), "bytes": len(b)}
    for l in _csv(b):
        c = U.cnpj14(l["CNPJ_CIA"])
        if c in alvo:
            docs.append({**{k: l.get(k, "") for k in COLUNAS_DOC if k != "fonte"}, "fonte": fonte, "CNPJ_CIA": c})
    for d in F.DEMONSTRACOES:
        contas = set(F.CONTAS[d])
        for esc in F.ESCOPOS:
            nome = f"{prefixo}_cia_aberta_{d}_{esc}_{ano}.csv"
            if nome not in z.namelist():
                continue
            b = z.read(nome)
            membros[nome] = {"sha256": sha(b), "bytes": len(b)}
            for l in _csv(b):
                c = U.cnpj14(l["CNPJ_CIA"])
                if c not in alvo:
                    continue
                presentes.add(c)
                if l["CD_CONTA"] not in contas:
                    continue
                ordem = l["ORDEM_EXERC"]
                if fonte == "DFP" and ordem != "ÚLTIMO":
                    continue
                if fonte == "ITR" and d in ("BPA", "BPP") and ordem != "ÚLTIMO":
                    continue
                ini = l.get("DT_INI_EXERC", "")
                if fonte == "ITR" and d in ("DRE", "DVA") and ini and not ini[5:] == "01-01":
                    continue  # só o acumulado no ano; o trimestre isolado não entra
                dem.append({**{k: l.get(k, "") for k in COLUNAS_DEM if k not in ("fonte", "escopo", "demonstracao")},
                            "fonte": fonte, "escopo": esc, "demonstracao": d, "CNPJ_CIA": c})
    return _ultima_versao(dem), _ultima_versao(docs), membros, presentes


def coletar(pasta_local: Path | None = None, ano_final: int | None = None) -> dict:
    SEED.mkdir(parents=True, exist_ok=True)
    agora = dt.datetime.now(dt.timezone.utc)
    ano_final = ano_final or agora.year
    cad_bruto, cad_mod = baixar(F.URL_CADASTRO, pasta_local)
    cadastro = _csv(cad_bruto)
    decl = U.declarados()
    docs_fre, pos_fre = U.ler_fre()
    cands = U.candidatos(decl, U.controladores_pj(docs_fre, pos_fre), cadastro)
    alvo = set(cands)

    arquivos_fonte, dem, docs, presentes = [], [], [], set()
    for fonte, url, anos in (
        ("DFP", F.URL_DFP, range(F.PRIMEIRO_ANO_DFP, ano_final + 1)),
        ("ITR", F.URL_ITR, range(F.PRIMEIRO_ANO_ITR, ano_final + 1)),
    ):
        for ano in anos:
            u = url.format(ano=ano)
            bruto, mod = baixar(u, pasta_local)
            d, i, membros, p = ler_zip(fonte, ano, bruto, alvo)
            dem += d
            docs += i
            presentes |= p
            arquivos_fonte.append({"fonte": fonte, "ano": ano, "url": u, "sha256": sha(bruto), "bytes": len(bruto), "last_modified": mod, "membros": membros})
            print(f"{fonte} {ano}: {len(d)} linhas, {len(p)} companhias", flush=True)

    univ = U.universo(cands, presentes)
    dentro = {r["cnpj"] for r in univ}
    dem = [l for l in dem if l["CNPJ_CIA"] in dentro]
    docs = [l for l in docs if l["CNPJ_CIA"] in dentro]
    cad = []
    vistos = set()
    for r in cadastro:
        c = U.cnpj14(r["CNPJ_CIA"])
        if c in dentro or F.SETOR_SANEAMENTO in (r.get("SETOR_ATIV") or ""):
            linha = {k: (r.get(k) or "").strip() for k in COLUNAS_CAD}
            chave = tuple(linha.values())
            if chave not in vistos:
                vistos.add(chave)
                cad.append(linha)
    dem.sort(key=lambda l: (l["CNPJ_CIA"], l["fonte"], l["DT_REFER"], l["escopo"], l["demonstracao"], l["ORDEM_EXERC"], l["DT_INI_EXERC"], l["CD_CONTA"]))
    docs.sort(key=lambda l: (l["CNPJ_CIA"], l["fonte"], l["DT_REFER"]))
    cad.sort(key=lambda l: (l["CNPJ_CIA"], l["SIT"], l["TP_MERC"]))
    manifesto = {
        "capturado_em": agora.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "cadastro": {"url": F.URL_CADASTRO, "sha256": sha(cad_bruto), "bytes": len(cad_bruto), "last_modified": cad_mod},
        "originais": arquivos_fonte,
        "criterio": {
            "operadora": "CNPJ declarado por algum município como prestador de água ou esgoto (SINISA 2024, Gestão Municipal) e com DFP ou ITR na base da CVM",
            "holding": "pessoa jurídica controladora na cadeia de controle declarada no FRE de uma operadora, com setor de saneamento no cadastro da CVM e com DFP ou ITR na base",
        },
        "universo": univ,
        "arquivos": {
            "demonstracoes": _gravar("demonstracoes.csv", dem, COLUNAS_DEM),
            "documentos": _gravar("documentos.csv", docs, COLUNAS_DOC),
            "cadastro": _gravar("cadastro.csv", cad, COLUNAS_CAD),
        },
    }
    (SEED / "manifesto.json").write_text(json.dumps(manifesto, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(univ)} companhias no universo; {len(dem)} linhas de demonstração", flush=True)
    return manifesto
