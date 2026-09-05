"""Conector BNDES — dados abertos (dadosabertos.bndes.gov.br, licença ODbL).

Duas famílias, com réguas distintas:
1. **Estatísticas mensais** (desembolsos, aprovações e consultas) em R$ milhões
   nominais, desde 1995, agregadas pelo próprio BNDES: por porte, por UF, por setor
   (CNAE e BNDES), por subsetor CNAE agrupado, por forma de apoio e produto, mais os
   desembolsos anuais por instituição financeira credenciada e a quantidade anual de
   operações por porte. Cobrem o Sistema BNDES inteiro (direto e indireto, automático
   ou não). Silver em formato longo: bndes_mensal(tabela, mes, chave, valor) e
   bndes_anual(tabela, ano, chave, grupo, valor).
2. **Operações não automáticas** (diretas e indiretas não automáticas), operação a
   operação desde 2002: cliente, CNPJ, UF, município, valor contratado e desembolsado,
   custo financeiro, juros, prazos, produto, setor, porte, natureza, agente e garantia.
   NÃO inclui as operações indiretas automáticas (Finame, BNDES Automático, cartão),
   que respondem pela maior parte do número de operações; o arquivo delas tem 1,2 GB
   e fica fora da Fase 0. Silver: bndes_op.

Complementos: desembolsos FINAME mensais (transporte, demais bens de capital,
agrícola), fontes de recursos (composição anual do passivo) e instituições
credenciadas.

Idempotente por hash de cada CSV: conteúdo inalterado não regrava. Os recursos são
localizados pelo nome no catálogo CKAN a cada execução (as URLs trazem o UUID do
recurso, estável, mas o nome é a chave declarada aqui).
"""
import csv
import io
import json

csv.field_size_limit(10_000_000)

from pipeline import common

CKAN = "https://dadosabertos.bndes.gov.br/api/3/action/package_show?id={pkg}"
# (pacote, nome do recurso no catálogo) -> nome da tabela na silver
RECURSOS_MENSAIS = {
    ("desembolsos", "Por porte de empresa - Desembolsos"): "des_porte",
    ("desembolsos", "Por porte de empresa PF e PJ - Desembolsos"): "des_porte_pfpj",
    ("desembolsos", "Por UF - Desembolsos"): "des_uf",
    ("desembolsos", "Por setor BNDES - Desembolsos"): "des_setor_bndes",
    ("desembolsos", "Por setor CNAE - Desembolsos"): "des_setor_cnae",
    ("desembolsos", "Por subsetor CNAE agrupado - Desembolsos"): "des_subsetor_cnae",
    ("desembolsos", "Por forma de apoio (diretas) e produto - Desembolsos"): "des_diretas",
    ("desembolsos", "Por forma de apoio (indiretas) e produto - Desembolsos"): "des_indiretas",
    ("desembolsos-mpme", "Por UF - Desembolsos MPME"): "des_mpme_uf",
    ("aprovacoes", "Por porte de empresa - Aprovações"): "apr_porte",
    ("aprovacoes", "Por UF - Aprovações"): "apr_uf",
    ("consultas", "Por porte de empresa - Consultas"): "con_porte",
    ("desembolsos-finame", "Desembolsos FINAME Mensal"): "finame_mensal",
}
RECURSOS_ANUAIS = {
    ("desembolsos", "Por instituição financeira credenciada - Desembolsos"): "des_if",
    ("desembolsos", "Por quantidade de operações por porte - Desembolsos"): "des_qtd_porte",
}
RECURSO_OPS = ("operacoes-financiamento", "Operações não automáticas")
RECURSO_FONTES = ("fontes-recursos", "Fontes de recursos do BNDES")
RECURSO_IFS = ("instituicoes-financeiras-credenciadas", "Instituições credenciadas")


def _ensure(con):
    con.execute("CREATE TABLE IF NOT EXISTS bndes_mensal(tabela TEXT, mes TEXT, chave TEXT, valor REAL, PRIMARY KEY(tabela, mes, chave))")
    con.execute("CREATE TABLE IF NOT EXISTS bndes_anual(tabela TEXT, ano TEXT, chave TEXT, grupo TEXT, valor REAL, PRIMARY KEY(tabela, ano, chave))")
    con.execute("""CREATE TABLE IF NOT EXISTS bndes_op(
        seq INTEGER PRIMARY KEY, contrato TEXT, cliente TEXT, cnpj TEXT, uf TEXT, municipio TEXT, cod_mun TEXT, data TEXT,
        contratado REAL, desembolsado REAL, custo TEXT, juros REAL, carencia INTEGER, amortizacao INTEGER,
        modalidade TEXT, forma TEXT, produto TEXT, instrumento TEXT, inovacao INTEGER, setor_cnae TEXT,
        subsetor_cnae TEXT, setor_bndes TEXT, subsetor_bndes TEXT, porte TEXT, natureza TEXT, agente TEXT,
        cnpj_agente TEXT, garantia TEXT, situacao TEXT)""")
    con.execute("CREATE INDEX IF NOT EXISTS ix_bndes_op_data ON bndes_op(data)")
    con.execute("CREATE TABLE IF NOT EXISTS bndes_fontes(data TEXT, chave TEXT, valor REAL, PRIMARY KEY(data, chave))")
    con.execute("CREATE TABLE IF NOT EXISTS bndes_ifs(cnpj TEXT PRIMARY KEY, nome TEXT, site TEXT)")
    con.execute("CREATE TABLE IF NOT EXISTS bndes_coleta(recurso TEXT PRIMARY KEY, sha TEXT, collected_at TEXT, url TEXT)")


def _num(s):
    s = (s or "").strip()
    if not s or s == "-":
        return None
    try:
        return float(s.replace(".", "").replace(",", ".")) if s.count(",") == 1 and s.count(".") > 1 else float(s.replace(",", "."))
    except ValueError:
        return None


def _decode(body):
    try:
        return body.decode("utf-8-sig")
    except UnicodeDecodeError:
        return body.decode("latin-1")


def _catalogo(pkg, cache):
    if pkg not in cache:
        body, _m = common.http_get(CKAN.format(pkg=pkg), timeout=60)
        cache[pkg] = {(r.get("name") or "").strip(): r.get("url") for r in json.loads(body)["result"]["resources"]}
    return cache[pkg]


def _baixa(con, pkg, nome, cache, timeout=120):
    """Retorna (texto, sha, mudou) ou (None, None, False) se o hash já foi absorvido."""
    url = _catalogo(pkg, cache).get(nome)
    if not url:
        raise KeyError(f"recurso '{nome}' ausente no pacote {pkg}")
    body, meta = common.http_get(url, timeout=timeout, accept="*/*")
    bronze_file, sha = common.save_bronze("bndes", f"{pkg}__{nome[:50].replace(' ', '_').replace('/', '-')}", body, meta)
    ja = con.execute("SELECT sha FROM bndes_coleta WHERE recurso=?", (f"{pkg}:{nome}",)).fetchone()
    if ja and ja[0] == sha:
        return None, sha, False
    con.execute("INSERT OR REPLACE INTO bndes_coleta VALUES(?,?,?,?)", (f"{pkg}:{nome}", sha, common.now_utc(), url))
    common.record_lineage(con, "bndes.json", bronze_file, sha, f"BNDES dados abertos: {pkg} / {nome}")
    return _decode(body), sha, True


def _absorve_mensal(con, tabela, txt):
    rdr = csv.DictReader(io.StringIO(txt), delimiter=";")
    linhas = []
    for r in rdr:
        ano, mes = (r.get("ano") or "").strip(), (r.get("mes") or "").strip()
        if not ano.isdigit() or not mes.isdigit():
            continue
        m = f"{int(ano)}-{int(mes):02d}"
        for c in rdr.fieldnames:
            if c in ("ano", "mes"):
                continue
            v = _num(r.get(c))
            if v is not None:
                linhas.append((tabela, m, c.strip(), v))
    con.execute("DELETE FROM bndes_mensal WHERE tabela=?", (tabela,))
    con.executemany("INSERT OR REPLACE INTO bndes_mensal VALUES(?,?,?,?)", linhas)
    return len(linhas)


def _absorve_anual(con, tabela, txt):
    rdr = csv.DictReader(io.StringIO(txt), delimiter=";")
    linhas = []
    cols = rdr.fieldnames
    if "ano" in cols:                     # ano nas linhas, chaves nas colunas
        for r in rdr:
            ano = (r.get("ano") or "").strip()
            for c in cols:
                if c != "ano" and _num(r.get(c)) is not None:
                    linhas.append((tabela, ano, c.strip(), None, _num(r.get(c))))
    else:                                  # anos nas colunas, chave nas linhas (IF credenciada)
        anos = [c for c in cols if c.strip().isdigit()]
        for r in rdr:
            chave = (r.get("nome_agente_financeiro") or "").strip()
            grupo = (r.get("tipo") or "").strip() or None
            for a in anos:
                v = _num(r.get(a))
                if v is not None:
                    linhas.append((tabela, a.strip(), chave, grupo, v))
    con.execute("DELETE FROM bndes_anual WHERE tabela=?", (tabela,))
    con.executemany("INSERT OR REPLACE INTO bndes_anual VALUES(?,?,?,?,?)", linhas)
    return len(linhas)


def _absorve_ops(con, txt):
    rdr = csv.DictReader(io.StringIO(txt), delimiter=";")
    g = lambda r, k: (r.get(k) or "").strip() or None
    linhas = []
    for seq, r in enumerate(rdr):
        data = g(r, "data_da_contratacao")
        if not data or len(data) < 10:
            continue
        cod = g(r, "municipio_codigo")
        # seq = posição no arquivo: linhas idênticas (subcréditos do mesmo contrato) são operações distintas
        linhas.append((seq, g(r, "numero_do_contrato"), g(r, "cliente"), g(r, "cnpj"), g(r, "uf"), g(r, "municipio"),
                       cod if cod and len(cod) == 7 and cod != "9999999" else None, data[:10],   # 9999999 = "SEM MUNICÍPIO" _num(r.get("valor_contratado_reais")) or 0.0,
                       _num(r.get("valor_desembolsado_reais")) or 0.0, g(r, "custo_financeiro"), _num(r.get("juros")),
                       int(_num(r.get("prazo_carencia_meses")) or 0), int(_num(r.get("prazo_amortizacao_meses")) or 0),
                       g(r, "modalidade_de_apoio"), g(r, "forma_de_apoio"), g(r, "produto"), g(r, "instrumento_financeiro"),
                       1 if g(r, "inovacao") == "SIM" else 0, g(r, "setor_cnae"), g(r, "subsetor_cnae_agrupado"), g(r, "setor_bndes"),
                       g(r, "subsetor_bndes"), g(r, "porte_do_cliente"), g(r, "natureza_do_cliente"),
                       None if g(r, "instituicao_financeira_credenciada") in (None, "----------") else g(r, "instituicao_financeira_credenciada"),
                       None if g(r, "cnpj_da_instituicao_financeira_credenciada") in (None, "----------") else g(r, "cnpj_da_instituicao_financeira_credenciada"),
                       g(r, "tipo_de_garantia"), g(r, "situacao_do_contrato")))
    con.execute("DELETE FROM bndes_op")
    con.executemany("INSERT OR REPLACE INTO bndes_op VALUES(" + ",".join("?" * 29) + ")", linhas)
    return len(linhas)


def _absorve_fontes(con, txt):
    rdr = csv.DictReader(io.StringIO(txt), delimiter=";")
    linhas = []
    for r in rdr:
        if not (r.get("passivo_total") or "").strip():
            continue   # a linha seguinte a cada data traz participações (%), não valores
        d = (r.get("datas") or "").strip()
        for c in rdr.fieldnames:
            if c != "datas" and _num(r.get(c)) is not None:
                linhas.append((d, c.strip(), _num(r.get(c))))
    con.execute("DELETE FROM bndes_fontes")
    con.executemany("INSERT OR REPLACE INTO bndes_fontes VALUES(?,?,?)", linhas)
    return len(linhas)


def _absorve_ifs(con, txt):
    rdr = csv.DictReader(io.StringIO(txt), delimiter=";")
    linhas = [((r.get("cnpj") or "").strip(), (r.get("razao_social") or "").strip(), (r.get("site") or "").strip()) for r in rdr if (r.get("cnpj") or "").strip()]
    con.execute("DELETE FROM bndes_ifs")
    con.executemany("INSERT OR REPLACE INTO bndes_ifs VALUES(?,?,?)", linhas)
    return len(linhas)


def collect(con, cfg):
    _ensure(con)
    cache, results = {}, []
    tarefas = [((p, n), ("mensal", t)) for (p, n), t in RECURSOS_MENSAIS.items()] + \
              [((p, n), ("anual", t)) for (p, n), t in RECURSOS_ANUAIS.items()] + \
              [(RECURSO_OPS, ("ops", "bndes_op")), (RECURSO_FONTES, ("fontes", "bndes_fontes")), (RECURSO_IFS, ("ifs", "bndes_ifs"))]
    for (pkg, nome), (tipo, tabela) in tarefas:
        key = f"bndes:{tabela}"
        try:
            txt, sha, mudou = _baixa(con, pkg, nome, cache, timeout=300 if tipo == "ops" else 120)
            if not mudou:
                results.append({"key": key, "ok": True, "nota": "inalterado (hash)"})
                continue
            n = {"mensal": lambda: _absorve_mensal(con, tabela, txt), "anual": lambda: _absorve_anual(con, tabela, txt),
                 "ops": lambda: _absorve_ops(con, txt), "fontes": lambda: _absorve_fontes(con, txt), "ifs": lambda: _absorve_ifs(con, txt)}[tipo]()
            con.commit()
            results.append({"key": key, "ok": True, "linhas": n})
        except Exception as e:
            results.append({"key": key, "ok": False, "error": str(e)[:160]})
    return results
