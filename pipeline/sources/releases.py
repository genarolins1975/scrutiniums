"""Fase 2 — releases de resultados dos bancos S1/S2, descobertos pela via
ESTRUTURADA: o dataset IPE da CVM (protocolos de entrega), nunca raspagem de
site de RI. Cada banco protocola o release na CVM com categoria e tipo
estáveis; o coletor filtra por regras explícitas, baixa o PDF do próprio
domínio da CVM (rad.cvm.gov.br), extrai o texto por página (pypdf) e guarda
apenas as páginas candidatas — onde aparecem os termos de interesse.

O que este módulo NÃO faz: extração de valores. A extração semântica é feita
em sessão de trabalho (Claude Code) sobre as páginas candidatas, com
evidência obrigatória, e vai para pipeline/curated/fase2_observacoes.json com
status "review" — nada é publicado sem aprovação humana (METODOLOGIA_OPERACIONAL.md).

Reentrega: quando a companhia reapresenta o mesmo documento (mesmo período e
tipo), fica a entrega mais recente; a anterior é marcada como substituída.
"""
import csv
import io
import json
import re
import zipfile
from datetime import datetime, timezone

from pipeline import common

IPE = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS/ipe_cia_aberta_{ano}.zip"
IPE_PRIMEIRO_ANO = 2026  # início da cobertura da Fase 2

# Regras de seleção por banco (S1 e S2 listados do piloto): categoria/tipo do
# IPE + filtro de assunto quando o tipo é genérico. Explícitas e auditáveis —
# banco novo entra adicionando uma linha, não mudando lógica.
REGRAS = {
    "itau": {"cnpj": "60.872.504/0001-23", "tipos": ["Relatório de Análise Gerencial"], "assunto_re": None},
    "bb": {"cnpj": "00.000.000/0001-91", "tipos": ["Relatório de Análise Gerencial", "Press-release"], "assunto_re": None},
    "bradesco": {"cnpj": "60.746.948/0001-12", "tipos": ["Relatório de Análise Gerencial", "Press-release"], "assunto_re": None},
    "santander": {"cnpj": "90.400.888/0001-42", "tipos": ["Press-release"], "assunto_re": r"^Release de Resultados"},
    "btg": {"cnpj": "30.306.294/0001-45", "tipos": ["Press-release"], "assunto_re": r"Portugu"},
    "banrisul": {"cnpj": "92.702.067/0001-96", "tipos": ["Apresentações a analistas/agentes do mercado"],
                 "assunto_re": r"(?i)resultados?\s+\dT"},
    "nordeste": {"cnpj": "07.237.373/0001-20", "tipos": ["Apresentações a analistas/agentes do mercado"],
                 "assunto_re": r"(?i)resultados?\s+\dT"},
    "abc": {"cnpj": "28.195.667/0001-06", "tipos": ["Press-release"],
            "assunto_re": r"(?i)portugu|^press-?release$"},
    "bmg": {"cnpj": "61.186.680/0001-74",
            "tipos": ["Relatório de Análise Gerencial", "Demonstrações Financeiras Adicionais"],
            "assunto_re": r"(?i)release"},
    "banestes": {"cnpj": "28.127.603/0001-78", "tipos": ["Press-release"], "assunto_re": None},
    "mercantil": {"cnpj": "17.184.037/0001-10", "tipos": ["Apresentações a analistas/agentes do mercado"],
                  "assunto_re": r"(?i)resultados"},
    "pine": {"cnpj": "62.144.175/0001-20", "tipos": ["Relatório de Análise Gerencial"],
             "assunto_re": r"(?i)an[áa]lise gerencial"},
    "brpartners": {"cnpj": "10.739.356/0001-03", "tipos": ["Relatório de Análise Gerencial"],
                   "assunto_re": r"(?i)earnings? release"},
    "amazonia": {"cnpj": "04.902.979/0001-44", "tipos": ["Outros Comunicados Não Considerados Fatos Relevantes"],
                 "assunto_re": r"(?i)divulga[çc][ãa]o de resultados"},
}

# Termos que marcam uma página como candidata à extração (minúsculas).
TERMOS_CLIENTES = ["clientes", "correntistas", "base de clientes", "clientes ativos"]


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS rel_docs(
        protocolo TEXT PRIMARY KEY, company_id TEXT, tipo TEXT, assunto TEXT,
        periodo_ref TEXT, entregue_em TEXT, url TEXT, sha TEXT,
        paginas INTEGER, paginas_candidatas INTEGER, substituido_por TEXT,
        coletado_em TEXT);
    CREATE TABLE IF NOT EXISTS rel_paginas(
        protocolo TEXT, pagina INTEGER, texto TEXT,
        PRIMARY KEY(protocolo, pagina));
    """)


def _docs_do_ipe(body):
    """Filtra o CSV do IPE pelas REGRAS; devolve a lista de candidatos."""
    zf = zipfile.ZipFile(io.BytesIO(body))
    raw = zf.read(zf.namelist()[0]).decode("latin-1")
    out = []
    por_cnpj = {r["cnpj"]: (cid, r) for cid, r in REGRAS.items()}
    for l in csv.DictReader(io.StringIO(raw), delimiter=";"):
        hit = por_cnpj.get((l.get("CNPJ_Companhia") or "").strip())
        if not hit:
            continue
        cid, regra = hit
        if (l.get("Tipo") or "").strip() not in regra["tipos"]:
            continue
        assunto = (l.get("Assunto") or "").strip()
        if regra["assunto_re"] and not re.search(regra["assunto_re"], assunto):
            continue
        out.append({
            "company_id": cid,
            "protocolo": (l.get("Protocolo_Entrega") or "").strip(),
            "tipo": (l.get("Tipo") or "").strip(),
            "assunto": assunto,
            "periodo_ref": (l.get("Data_Referencia") or "").strip(),
            "entregue_em": (l.get("Data_Entrega") or "").strip(),
            "url": (l.get("Link_Download") or "").strip(),
        })
    return out


def _paginas_candidatas(pdf_bytes):
    """Texto por página (pypdf) e seleção das páginas com termos de interesse.
    pypdf é dependência opcional do pipeline: sem ela, o coletor registra o
    documento e deixa a extração de texto para a próxima execução."""
    from pypdf import PdfReader  # import tardio: dependência opcional
    reader = PdfReader(io.BytesIO(pdf_bytes))
    candidatas = []
    for i, page in enumerate(reader.pages):
        texto = page.extract_text() or ""
        t = texto.lower()
        if any(term in t for term in TERMOS_CLIENTES):
            candidatas.append((i + 1, texto))
    return len(reader.pages), candidatas


def collect(con, cfg=None):
    _ensure(con)
    results = []
    ano_atual = datetime.now(timezone.utc).year
    ja = {r[0] for r in con.execute("SELECT protocolo FROM rel_docs")}

    candidatos = []
    for ano in range(IPE_PRIMEIRO_ANO, ano_atual + 1):
        try:
            body, meta = common.http_get(IPE.format(ano=ano), timeout=120, accept=None)
            common.save_bronze("releases", f"ipe_{ano}", body, meta)
            candidatos.extend(_docs_do_ipe(body))
        except Exception as e:
            if "404" not in str(e):
                results.append({"key": f"releases:ipe:{ano}", "ok": False, "error": str(e)[:200]})

    # Reentrega do mesmo (banco, período, tipo): fica a mais recente.
    melhores = {}
    for d in sorted(candidatos, key=lambda x: x["entregue_em"]):
        melhores[(d["company_id"], d["periodo_ref"], d["tipo"], d["assunto"])] = d
    substituidos = {d["protocolo"]: m["protocolo"] for chave, m in melhores.items()
                    for d in candidatos
                    if (d["company_id"], d["periodo_ref"], d["tipo"], d["assunto"]) == chave
                    and d["protocolo"] != m["protocolo"]}
    for antigo, novo in substituidos.items():
        con.execute("UPDATE rel_docs SET substituido_por=? WHERE protocolo=?", (novo, antigo))

    novos = [d for d in melhores.values() if d["protocolo"] not in ja]
    for d in novos:
        try:
            body, meta = common.http_get(d["url"], timeout=180, accept=None)
            if body[:4] != b"%PDF":
                raise RuntimeError("resposta não é PDF (portal pode ter mudado)")
            _, sha = common.save_bronze("releases", f"{d['company_id']}_{d['protocolo']}", body, meta)
            n_pag, candidatas = _paginas_candidatas(body)
            for pagina, texto in candidatas:
                con.execute("INSERT OR REPLACE INTO rel_paginas VALUES(?,?,?)",
                            (d["protocolo"], pagina, texto))
            con.execute("INSERT OR REPLACE INTO rel_docs VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                        (d["protocolo"], d["company_id"], d["tipo"], d["assunto"],
                         d["periodo_ref"], d["entregue_em"], d["url"], sha,
                         n_pag, len(candidatas), None, common.now_utc()))
            common.record_lineage(con, "operacional.json", f"release_{d['protocolo']}", sha,
                                  "release RI (via CVM/IPE) -> rel_docs/rel_paginas (páginas candidatas por termo)")
            results.append({"key": f"releases:{d['company_id']}:{d['periodo_ref']}", "ok": True,
                            "paginas": n_pag, "candidatas": len(candidatas)})
        except Exception as e:
            results.append({"key": f"releases:{d['company_id']}:{d['protocolo']}", "ok": False,
                            "error": str(e)[:200]})
    con.commit()
    if not novos:
        results.append({"key": "releases", "ok": True, "novos": 0})
    return results
