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
                            "instituicoes": len(names)})
        except Exception as e:
            last_err = e
    results.extend(_backfill_historico(con, cfg))
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
            for inst in json.loads(body_c).get("value", []):
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
