"""Conector BCB IF.data via API Olinda (OData).

Cadastro + relatório "Resumo" de conglomerados prudenciais e instituições independentes
(TipoInstituicao=2). Valores do campo Saldo em R$ (unidades) — validado empiricamente
contra balanços conhecidos (ex.: carteira da Caixa ≈ 1,3e12). Frequência trimestral,
defasagem típica ~90 dias.
Licença: dados abertos do BCB.

Nota metodológica: o corte TipoInstituicao=2 expõe os relatórios Resumo/Ativo/Passivo/DRE.
O Índice de Basileia (relatório de capital) não está neste corte e fica para a Fase 3;
o score preliminar usa apenas métricas aqui observadas.
"""
import json
import urllib.parse

from pipeline import common


def _odata(base, entity, params, filt=None):
    qs = {f"@{k}": v for k, v in params.items()}
    qs["$format"] = "json"
    if filt:
        qs["$filter"] = filt
    args = ",".join(f"{k}=@{k}" for k in params)
    url = f"{base}/{entity}({args})?" + urllib.parse.urlencode(qs, quote_via=urllib.parse.quote)
    return common.http_get(url, timeout=120)


def _ensure_universo(con):
    """`ifdata_universo`: quem está na LISTA do Resumo em cada trimestre, tenha ou não
    entregado o balanço, com os campos do cadastro do trimestre (situação, data de
    início de atividade, CNPJ líder). É a régua de universo do painel "Quem entra e
    quem sai": uma instituição listada com saldo nulo (atraso, RAET, retardatário)
    não é saída; só deixa o universo quem some da lista."""
    con.execute("""CREATE TABLE IF NOT EXISTS ifdata_universo(
        cod_inst TEXT, anomes TEXT, entregou INTEGER, nome TEXT, tcb TEXT, uf TEXT, sr TEXT, td TEXT,
        situacao TEXT, inicio_atividade TEXT, cnpj_lider TEXT, inicio_lider TEXT, PRIMARY KEY(cod_inst, anomes))""")


def _inicio(v):
    """DataInicioAtividade do cadastro (AAAAMM). 180001 é sentinela do BCB para 'sem data'."""
    if v is None:
        return None
    s = str(v).strip()
    return s if len(s) == 6 and s.isdigit() and s >= "190001" else None


def _gravar_universo(con, anomes, values, cadastro):
    """Uma linha por CodInst presente no Resumo do trimestre; entregou=1 se o Ativo Total
    veio com saldo (mesma régua de `institution_metrics`), 0 se a linha veio nula."""
    _ensure_universo(con)
    cad = {i.get("CodInst"): i for i in cadastro if i.get("CodInst")}
    entregou = {}
    for row in values:
        cod = row.get("CodInst")
        if not cod:
            continue
        entregou.setdefault(cod, 0)
        col = (row.get("NomeColuna") or "").replace("\n", " ").strip()
        if col == "Ativo Total" and row.get("Saldo") is not None:
            entregou[cod] = 1
    linhas = []
    for cod, e in entregou.items():
        i = cad.get(cod) or {}
        lider = (i.get("CnpjInstituicaoLider") or "").strip() or None
        ini_lider = _inicio((cad.get(lider) or {}).get("DataInicioAtividade")) if lider else None
        linhas.append((cod, anomes, e, i.get("NomeInstituicao"), i.get("Tcb"), i.get("Uf"), i.get("Sr"), i.get("Td"),
                       i.get("Situacao"), _inicio(i.get("DataInicioAtividade")), lider, ini_lider))
    con.executemany("INSERT OR REPLACE INTO ifdata_universo VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", linhas)
    return len(linhas)


def collect(con, cfg):
    """Coleta todos os períodos configurados (histórico de score e variação trimestral)."""
    c = cfg["ifdata"]
    base = c["base_url"]
    tipo = c["tipo_instituicao"]
    last_err = None
    results = []
    for anomes in c["anomes_candidates"]:
        try:
            body, meta = _odata(base, "IfDataValores",
                                {"AnoMes": anomes, "TipoInstituicao": tipo, "Relatorio": "'T'"},
                                filt="NomeRelatorio eq 'Resumo'")
            values = json.loads(body).get("value", [])
            if not values:
                continue  # período ainda não publicado — tentar anterior (ausência != zero)
            bronze_v, sha_v = common.save_bronze("ifdata", f"resumo_{anomes}_t{tipo}", body, meta)

            body_c, meta_c = _odata(base, "IfDataCadastro", {"AnoMes": anomes})
            cadastro = json.loads(body_c).get("value", [])
            bronze_c, sha_c = common.save_bronze("ifdata", f"cadastro_{anomes}", body_c, meta_c)

            names = {}
            n_uni = _gravar_universo(con, anomes, values, cadastro)
            for inst in cadastro:
                names[inst["CodInst"]] = inst
                con.execute(
                    """INSERT OR REPLACE INTO institutions(cod_inst, name, tcb, uf, municipio, sr, cod_congl_prud, collected_at)
                       VALUES(?,?,?,?,?,?,?,?)""",
                    (inst["CodInst"], inst.get("NomeInstituicao"), inst.get("Tcb"), inst.get("Uf"),
                     inst.get("Municipio"), inst.get("Sr"), inst.get("CodConglomeradoPrudencial"), common.now_utc()),
                )

            col_map = {
                "Ativo Total": "ativo_total",
                "Carteira de Crédito": "carteira_credito",
                "Patrimônio Líquido": "patrimonio_liquido",
                "Lucro Líquido": "lucro_liquido",
                "Captações": "captacoes",
                "Passivo Exigível": "passivo_exigivel",
                "Títulos e Valores Mobiliários": "tvm",
            }
            n = 0
            for row in values:
                col = row["NomeColuna"].replace("\n", " ").strip()
                metric = col_map.get(col)
                if metric is None or row.get("Saldo") is None or not row.get("CodInst"):
                    continue  # linha sem CodInst não identifica instituição: fora (ausência != zero)
                con.execute(
                    """INSERT OR REPLACE INTO institution_metrics(cod_inst, anomes, metric, value, source_report, bronze_sha)
                       VALUES(?,?,?,?,?,?)""",
                    (row["CodInst"], anomes, metric, float(row["Saldo"]), "Resumo", sha_v),
                )
                n += 1
            common.record_lineage(con, f"institutions:{anomes}", bronze_v, sha_v,
                                  "IF.data Olinda Resumo (Saldo em R$); mapeamento de colunas para métricas")
            common.record_lineage(con, f"institutions:{anomes}", bronze_c, sha_c, "IF.data cadastro")
            results.append({"key": f"ifdata:{anomes}", "ok": True, "anomes": anomes, "metricas": n,
                            "instituicoes": len(names), "universo": n_uni})
        except Exception as e:
            last_err = e
    results.extend(_backfill_historico(con, cfg))
    results.extend(_backfill_universo(con, cfg))
    if results:
        return results
    return [{"key": "ifdata", "ok": False, "error": f"nenhum AnoMes disponível ({last_err})"}]


# Colunas do Resumo no plano contábil ANTIGO (até 2024): a carteira é a
# "Classificada" (Res. 2.682) e o passivo tem o nome comprido. O conceito de
# carteira muda na fronteira 2024/2025 (Res. 4.966) — a série histórica
# atravessa a mudança de plano contábil, e isso é DECLARADO no método do
# gold, nunca escondido (o marco está na aba Regulação).
COL_MAP_HISTORICO = {
    "Ativo Total": "ativo_total",
    "Carteira de Crédito Classificada": "carteira_credito",
    "Patrimônio Líquido": "patrimonio_liquido",
    "Lucro Líquido": "lucro_liquido",
    "Captações": "captacoes",
    "Passivo Circulante e Exigível a Longo Prazo e Resultados de Exercícios Futuros": "passivo_exigivel",
}


def _backfill_historico(con, cfg):
    """Backfill do Resumo 2015-2024 (Olinda), CAPADO por execução.

    Idempotente e retomável: pula períodos já no silver e coleta no máximo
    `backfill_por_execucao` por rodada — se o cache do CI expirar, a série
    reconverge em poucas execuções diárias sem estourar o tempo do workflow.
    O cadastro histórico usa INSERT OR IGNORE: instituições extintas entram
    com o nome da época, mas o registro ATUAL nunca é sobrescrito por dado
    antigo (nomes, segmentação e conglomerados seguem os de hoje)."""
    c = cfg["ifdata"]
    historia = c.get("anomes_history") or []
    cap = int(c.get("backfill_por_execucao") or 0)
    if not historia or cap <= 0:
        return []
    results = []
    feitos = 0
    for anomes in historia:
        if feitos >= cap:
            break
        ja = con.execute("SELECT 1 FROM institution_metrics WHERE anomes=? AND metric='ativo_total' LIMIT 1",
                         (anomes,)).fetchone()
        if ja:
            continue
        try:
            body, meta = _odata(c["base_url"], "IfDataValores",
                                {"AnoMes": anomes, "TipoInstituicao": c["tipo_instituicao"], "Relatorio": "'T'"},
                                filt="NomeRelatorio eq 'Resumo'")
            values = json.loads(body).get("value", [])
            if not values:
                results.append({"key": f"ifdata_hist:{anomes}", "ok": True, "pulado": "sem dados na fonte"})
                continue
            _, sha_v = common.save_bronze("ifdata", f"resumo_{anomes}_t{c['tipo_instituicao']}", body, meta)
            body_c, meta_c = _odata(c["base_url"], "IfDataCadastro", {"AnoMes": anomes})
            cadastro_hist = json.loads(body_c).get("value", [])
            _gravar_universo(con, anomes, values, cadastro_hist)
            for inst in cadastro_hist:
                con.execute(
                    """INSERT OR IGNORE INTO institutions(cod_inst, name, tcb, uf, municipio, sr, cod_congl_prud, collected_at)
                       VALUES(?,?,?,?,?,?,?,?)""",
                    (inst["CodInst"], inst.get("NomeInstituicao"), inst.get("Tcb"), inst.get("Uf"),
                     inst.get("Municipio"), inst.get("Sr"), inst.get("CodConglomeradoPrudencial"), common.now_utc()))
            n = 0
            for row in values:
                col = row["NomeColuna"].replace("\n", " ").strip()
                metric = COL_MAP_HISTORICO.get(col)
                if metric is None or row.get("Saldo") is None or not row.get("CodInst"):
                    continue  # linha sem CodInst não identifica instituição: fora (ausência != zero)
                con.execute(
                    """INSERT OR REPLACE INTO institution_metrics(cod_inst, anomes, metric, value, source_report, bronze_sha)
                       VALUES(?,?,?,?,?,?)""",
                    (row["CodInst"], anomes, metric, float(row["Saldo"]), "Resumo", sha_v))
                n += 1
            common.record_lineage(con, f"institutions:{anomes}", f"ifdata/resumo_{anomes}", sha_v,
                                  "IF.data Olinda Resumo histórico (plano contábil antigo; carteira classificada)")
            con.commit()
            feitos += 1
            results.append({"key": f"ifdata_hist:{anomes}", "ok": True, "metricas": n})
        except Exception as e:
            results.append({"key": f"ifdata_hist:{anomes}", "ok": False, "error": str(e)[:200]})
            feitos += 1  # falha também consome o cap: rodada nunca fica presa num período quebrado
    return results


def _backfill_universo(con, cfg):
    """Preenche `ifdata_universo` nos trimestres cujas métricas já estão no silver mas
    que foram coletados antes de a tabela existir. Recoleta Resumo + cadastro do
    trimestre (dois pedidos, ~4 MB) e nada mais: as métricas não são tocadas.
    Capado por execução (`universo_por_execucao`, padrão 48 = a história inteira
    numa rodada, ~6 min) e idempotente: trimestre já preenchido é pulado."""
    c = cfg["ifdata"]
    _ensure_universo(con)
    cap = int(c.get("universo_por_execucao") or 48)
    if cap <= 0:
        return []
    com_metricas = [r[0] for r in con.execute("SELECT DISTINCT anomes FROM institution_metrics WHERE metric='ativo_total' ORDER BY anomes DESC")]
    com_universo = {r[0] for r in con.execute("SELECT DISTINCT anomes FROM ifdata_universo")}
    faltam = [a for a in com_metricas if a not in com_universo][:cap]
    results = []
    for anomes in faltam:
        try:
            body, meta = _odata(c["base_url"], "IfDataValores",
                                {"AnoMes": anomes, "TipoInstituicao": c["tipo_instituicao"], "Relatorio": "'T'"},
                                filt="NomeRelatorio eq 'Resumo'")
            values = json.loads(body).get("value", [])
            if not values:
                results.append({"key": f"ifdata_universo:{anomes}", "ok": True, "pulado": "sem dados na fonte"})
                continue
            body_c, meta_c = _odata(c["base_url"], "IfDataCadastro", {"AnoMes": anomes})
            n = _gravar_universo(con, anomes, values, json.loads(body_c).get("value", []))
            con.commit()
            results.append({"key": f"ifdata_universo:{anomes}", "ok": True, "universo": n})
        except Exception as e:
            results.append({"key": f"ifdata_universo:{anomes}", "ok": False, "error": str(e)[:200]})
    return results
