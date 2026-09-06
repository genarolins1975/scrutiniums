"""Conector IF.data (interface web) — Informações de Capital.

A API Olinda NÃO expõe o relatório de capital (verificado: tipos 1–4 retornam apenas
Resumo/Ativo/Passivo/DRE). A interface www3.bcb.gov.br/ifdata consome arquivos JSON
pré-gerados; o arquivo `dados{AAAAMM}_5.json` traz, por CodInst (campo `e`, inteiro):

    79649 = Patrimônio de Referência (R$)     79650 = RWA — Ativos Ponderados (R$)
    79659 = Índice de Capital Principal (fração)   79660 = Índice de Capital Nível I (fração)
    79664 = Índice de Basileia (fração)            79661 = Razão de Alavancagem (fração)
    79662 = Índice de Imobilização (fração)

Mapeamento validado empiricamente (2026-07): Itaú 14,77%, BB 14,23%, Bradesco 14,90%,
Caixa 15,13%, BNDES 24,09% — consistentes com divulgações públicas.
ATENÇÃO: o prefixo de janela (`ifdata_2025_2030`) muda por período; datas anteriores a 2025
usam outra janela (index2024) — documentado como limitação.
"""
import json

from pipeline import common

CAPITAL_LIDS = {
    79649: "patrimonio_referencia",
    79650: "rwa",
    79659: "indice_capital_principal",
    79660: "indice_capital_nivel1",
    79664: "indice_basileia",
    79661: "razao_alavancagem",
    79662: "indice_imobilizacao",
}


def _entity_translation(con, anomes):
    """Traduz o id de entidade da UI para o cod_inst usado nas métricas da Olinda.

    Regra validada empiricamente: e >= 1e9 => conglomerado PRUDENCIAL nº (e - 1e9),
    formato Olinda 'C%07d' (ex.: 1000080099 -> C0080099 = Itaú prudencial). O Resumo da
    Olinda usa o cod_inst do conglomerado FINANCEIRO/instituição-cabeça; ligamos via
    institutions.cod_congl_prud, preferindo o membro com maior ativo no período.
    e < 1e9 => CNPJ8 direto (instituições independentes)."""
    rows = con.execute(
        """SELECT i.cod_congl_prud, i.cod_inst, COALESCE(m.value, 0)
           FROM institutions i
           LEFT JOIN institution_metrics m
             ON m.cod_inst = i.cod_inst AND m.anomes = ? AND m.metric = 'ativo_total'
           WHERE i.cod_congl_prud IS NOT NULL AND i.cod_congl_prud != ''""", (anomes,)).fetchall()
    best = {}
    for congl, cod, ativo in rows:
        if congl not in best or ativo > best[congl][1]:
            best[congl] = (cod, ativo)
    return {congl: cod for congl, (cod, _) in best.items()}


def collect(con, cfg):
    c = cfg["ifdata"]
    base = c.get("ui_base", "https://www3.bcb.gov.br/ifdata/rest/arquivos?nomeArquivo=ifdata_2025_2030")
    results = []
    for anomes in c["anomes_candidates"]:
        url = f"{base}//{anomes}/dados{anomes}_5.json"
        try:
            body, meta = common.http_get(url, timeout=90)
            data = json.loads(body)
            blk = data if isinstance(data, dict) else data[0]
            values = blk.get("values", [])
            if not values:
                results.append({"key": f"ifdata_capital:{anomes}", "ok": False, "error": "sem valores"})
                continue
            bronze_file, sha = common.save_bronze("ifdata_ui", f"capital_{anomes}", body, meta)
            congl_map = _entity_translation(con, anomes)
            n = 0
            for ent in values:
                e = int(ent["e"])
                if e >= 1_000_000_000:
                    cod_inst = congl_map.get(f"C{e - 1_000_000_000:07d}")
                    if cod_inst is None:
                        continue  # conglomerado sem correspondente no Resumo do período
                else:
                    cod_inst = str(e).zfill(8)
                m = {it["i"]: it["v"] for it in ent["v"]}
                for lid, metric in CAPITAL_LIDS.items():
                    v = m.get(lid)
                    if v is None or v == 0:
                        continue  # zero neste arquivo indica não reportado — ausência, não valor
                    con.execute(
                        """INSERT OR REPLACE INTO institution_metrics(cod_inst, anomes, metric, value, source_report, bronze_sha)
                           VALUES(?,?,?,?,?,?)""",
                        (cod_inst, anomes, metric, float(v), "InformacoesCapital(UI)", sha))
                    n += 1
            common.record_lineage(con, f"institutions_capital:{anomes}", bronze_file, sha,
                                  "IF.data UI dados_5.json; lids 79649/50/59/60/61/62/64 -> métricas de capital; zeros tratados como ausência")
            results.append({"key": f"ifdata_capital:{anomes}", "ok": True, "metricas": n})
        except json.JSONDecodeError:
            # o REST do IF.data responde HTTP 200 com o texto 'Erro interno' para
            # período ainda não publicado (202606 em 06/09/2026): ausência, não pane
            results.append({"key": f"ifdata_capital:{anomes}", "ok": True, "pulado": "período ainda não publicado na fonte"})
            continue
        except Exception as e:
            results.append({"key": f"ifdata_capital:{anomes}", "ok": False, "error": str(e)})
    return results
