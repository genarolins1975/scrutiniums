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
                if metric is None or row.get("Saldo") is None:
                    continue
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
    if results:
        return results
    return [{"key": "ifdata", "ok": False, "error": f"nenhum AnoMes disponível ({last_err})"}]
