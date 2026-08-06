"""Fase 2 — releases de instituições FORA da CVM: Caixa (não listada; RI
próprio na plataforma MZ) e os digitais listados no exterior (Nubank e Inter,
arquivos 6-K na SEC/EDGAR).

Segue o princípio do plano: nenhum crawler genérico — um CADASTRO explícito e
auditável de documentos oficiais por instituição (URL verificada, formato,
período). A cada temporada de resultados a sessão de extração adiciona os
documentos novos ao cadastro; o coletor baixa o que ainda não tem (idempotente
por protocolo), extrai o texto (PDF via pypdf; HTM por remoção de tags) e
grava as páginas candidatas nas MESMAS tabelas do coletor CVM/IPE
(rel_docs/rel_paginas), para a mesma esteira de extração e revisão.

A descoberta automática de 6-K novos existe como aviso: o coletor consulta o
índice EDGAR de cada CIK e registra em `rel_ext_avisos` os 6-K posteriores ao
último documento cadastrado — sinal para a próxima sessão de curadoria, nunca
download às cegas (um 6-K pode ser qualquer coisa, de ata a prospecto).
"""
import html as html_mod
import io
import json
import re

from pipeline import common
from pipeline.sources.releases import TERMOS_CLIENTES, _ensure as _ensure_rel

UA_SEC = "ObservatorioBrasileiroDeCredito contato@scrutiniums.com"

# CIKs verificados em https://www.sec.gov/files/company_tickers.json
CIK = {"nubank": 1691493, "inter": 1864163}

# Cadastro de documentos: cada entrada foi verificada manualmente em sessão
# (URL respondendo o formato declarado). Termos em inglês entram porque os
# 6-K são bilíngues ou em inglês.
DOCS = [
    {
        "protocolo": "mz:0310f05a-c6b5-b949-3ee4-b1463b04f54b",
        "company_id": "caixa",
        "fonte": "RI Caixa (plataforma MZ)",
        "tipo": "Relatório de Análise de Desempenho",
        "assunto": "Relatório de Análise de Desempenho 1T26",
        "periodo_ref": "2026-03-31",
        "entregue_em": "2026-05",
        "formato": "pdf",
        "url": "https://api.mziq.com/mzfilemanager/v2/d/fb86b0b8-b4e9-407b-a575-ba3668a566a9/0310f05a-c6b5-b949-3ee4-b1463b04f54b?origin=2",
    },
    {
        "protocolo": "sec:0001292814-26-003057",
        "company_id": "nubank",
        "fonte": "SEC/EDGAR",
        "tipo": "6-K (earnings release)",
        "assunto": "Nu Holdings — 1Q26 earnings release (6-K de 14/05/2026)",
        "periodo_ref": "2026-03-31",
        "entregue_em": "2026-05-14",
        "formato": "htm",
        "url": "https://www.sec.gov/Archives/edgar/data/1691493/000129281426003057/nu20260514_6k2.htm",
    },
    {
        "protocolo": "sec:0001864163-26-000048",
        "company_id": "inter",
        "fonte": "SEC/EDGAR",
        "tipo": "6-K (EX-99.1 earnings release)",
        "assunto": "Inter & Co — 1Q26 Earnings Release (6-K de 07/05/2026)",
        "periodo_ref": "2026-03-31",
        "entregue_em": "2026-05-07",
        "formato": "htm",
        "url": "https://www.sec.gov/Archives/edgar/data/1864163/000186416326000048/interco1q26earningsrelea.htm",
    },
    {
        "protocolo": "safra:resumo-consolidado-mar-2026",
        "company_id": "safra",
        "fonte": "RI Banco Safra (site institucional)",
        "tipo": "Resumo Consolidado e Principais Indicadores",
        "assunto": "Resumo Consolidado e Principais Indicadores — mar/2026",
        "periodo_ref": "2026-03-31",
        "entregue_em": "2026-05",
        "formato": "pdf",
        "url": "https://www.safra.com.br/data/files/D2/E4/8D/BC/1582E910BB0B22D901B9F9C2/Resumo%20Consolidado%20e%20Principais%20Indicadores%20-%20mar%202026.pdf",
    },
]

TERMOS = TERMOS_CLIENTES + ["customers", "clients", "active clients", "total clients"]


def _texto_htm(body):
    t = re.sub(r"</t[dh]>", " | ", body.decode("utf-8", errors="replace"), flags=re.I)
    t = re.sub(r"</tr>", "\n", t, flags=re.I)
    t = html_mod.unescape(re.sub(r"<[^>]+>", " ", t))
    return t


def _paginas(body, formato):
    """(total_paginas, [(pagina, texto)]) — HTM é documento de página única."""
    if formato == "pdf":
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(body))
        out = []
        for i, page in enumerate(reader.pages):
            texto = page.extract_text() or ""
            if any(term in texto.lower() for term in TERMOS):
                out.append((i + 1, texto))
        return len(reader.pages), out
    texto = _texto_htm(body)
    tem = any(term in texto.lower() for term in TERMOS)
    return 1, ([(1, texto)] if tem else [])


def _ensure(con):
    _ensure_rel(con)
    con.execute("""CREATE TABLE IF NOT EXISTS rel_ext_avisos(
        company_id TEXT, filed_em TEXT, accession TEXT, doc TEXT,
        PRIMARY KEY(company_id, accession))""")


def _avisos_sec(con, resultados):
    """6-K arquivados depois do último documento cadastrado: aviso, não download."""
    ja = {d["protocolo"].split(":", 1)[1] for d in DOCS if d["protocolo"].startswith("sec:")}
    for cid, cik in CIK.items():
        corte = max((d["entregue_em"] for d in DOCS if d["company_id"] == cid), default="2026-01-01")
        try:
            body, _ = common.http_get(
                f"https://data.sec.gov/submissions/CIK{cik:010d}.json",
                timeout=90, accept=None)
            rec = json.loads(body)["filings"]["recent"]
            novos = 0
            for i in range(len(rec["form"])):
                if rec["form"][i] == "6-K" and rec["filingDate"][i] > corte \
                        and rec["accessionNumber"][i] not in ja:
                    con.execute("INSERT OR IGNORE INTO rel_ext_avisos VALUES(?,?,?,?)",
                                (cid, rec["filingDate"][i], rec["accessionNumber"][i],
                                 rec["primaryDocument"][i]))
                    novos += 1
            resultados.append({"key": f"releases_ext:avisos:{cid}", "ok": True, "novos_6k": novos})
        except Exception as e:
            resultados.append({"key": f"releases_ext:avisos:{cid}", "ok": False, "error": str(e)[:200]})


def collect(con, cfg=None):
    _ensure(con)
    resultados = []
    ja = {r[0] for r in con.execute("SELECT protocolo FROM rel_docs")}
    for d in DOCS:
        if d["protocolo"] in ja:
            continue
        try:
            # A SEC exige User-Agent identificado; o común usa o UA da plataforma,
            # então o download usa urllib direto com o UA de contato.
            import urllib.request
            req = urllib.request.Request(d["url"], headers={"User-Agent": UA_SEC})
            body = urllib.request.urlopen(req, timeout=180).read()
            if d["formato"] == "pdf" and body[:4] != b"%PDF":
                raise RuntimeError("resposta não é PDF")
            _, sha = common.save_bronze("releases_ext", f"{d['company_id']}_{d['protocolo'].replace(':', '_')}",
                                        body, {"url": d["url"], "collected_at": common.now_utc()})
            n_pag, candidatas = _paginas(body, d["formato"])
            for pagina, texto in candidatas:
                con.execute("INSERT OR REPLACE INTO rel_paginas VALUES(?,?,?)",
                            (d["protocolo"], pagina, texto))
            con.execute("INSERT OR REPLACE INTO rel_docs VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                        (d["protocolo"], d["company_id"], d["tipo"], d["assunto"],
                         d["periodo_ref"], d["entregue_em"], d["url"], sha,
                         n_pag, len(candidatas), None, common.now_utc()))
            common.record_lineage(con, "operacional.json", d["protocolo"], sha,
                                  f"release fora da CVM ({d['fonte']}) -> rel_docs/rel_paginas")
            resultados.append({"key": f"releases_ext:{d['company_id']}:{d['periodo_ref']}",
                               "ok": True, "paginas": n_pag, "candidatas": len(candidatas)})
        except Exception as e:
            resultados.append({"key": f"releases_ext:{d['company_id']}", "ok": False,
                               "error": str(e)[:200]})
    _avisos_sec(con, resultados)
    con.commit()
    return resultados
