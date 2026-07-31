"""Conector IF.data (interface web) — carteiras de crédito por instituição.

Relatórios da UI (templates trel{AAAAMM}_NNN.json, dados em dados{AAAAMM}_3.json):
    123 = Carteira PF por modalidade e prazo      127 = Carteira PJ por porte do tomador
    128 = Carteira PJ por modalidade e prazo      129 = Carteira PJ por atividade (CNAE)

O template define grupos (modalidade/CNAE) com subcoluna "Total" (lid via info{AAAAMM}.json);
o parser é dinâmico: lê o trel do período e extrai o lid do Total de cada grupo — nada de
ids de categoria hardcoded (sobrevive a mudanças de layout). Valores em R$.
Entidades traduzidas UI→Olinda pela mesma regra do conector de capital.
"""
import json
import re
import unicodedata

from pipeline import common
from pipeline.sources.ifdata_ui import _entity_translation

REPORTS = {
    123: ("cart_pf_mod", "Carteira PF por modalidade"),
    127: ("cart_pj_porte", "Carteira PJ por porte"),
    128: ("cart_pj_mod", "Carteira PJ por modalidade"),
    129: ("cart_pj_cnae", "Carteira PJ por CNAE"),
}
TOTAL_PJ_LID = 24453  # "Total da Carteira de Pessoa Jurídica"

# Qualidade da carteira — relatório por carteiras de instrumentos financeiros (Res. 4.966,
# estrutura vigente desde 2025-03; validado empiricamente: Itaú 2,25%, Caixa 3,68%, BB 5,39%)
QUALIDADE_LIDS = {
    148834: ("qual", "inadimplencia_brl"),          # carteira inadimplente (>90d) em R$
    148833: ("qual", "ativos_problematicos_brl"),   # ativos problemáticos em R$
    24454: ("qual", "carteira_total_geral_brl"),    # total geral da carteira ativa
}
PERDA_ESPERADA_CREDITO_LID = 140202  # Ativo (e2): provisão/perda esperada de op. de crédito (dados_1)


def _slug(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "_", s).strip("_").lower()
    return s[:48]


def _fetch_json(url):
    body, meta = common.http_get(url, timeout=120)
    return json.loads(body), body, meta


def _category_lids(trel, info_by_id, com_vencido=False):
    """Extrai lids dos grupos do template: {lid: (tipo, nome_da_categoria)} com tipo
    'total' (subcoluna Total ou coluna simples) e, quando com_vencido=True, também
    'venc15' (subcoluna 'Vencido a Partir de 15 Dias' — carteira em atraso ≥15d da modalidade)."""
    out = {}
    meta_cols = {"Instituição", "Código", "TCB", "TD", "TC", "SR", "TCip", "Cidade", "UF", "Data"}
    for col in trel.get("c", []):
        it = info_by_id.get(col.get("ifd"), {})
        name = (it.get("n") or "").replace("\n", " ").strip()
        if not name or name in meta_cols:
            continue
        if col.get("sc"):
            for sub in col["sc"]:
                sit = info_by_id.get(sub.get("ifd"), {})
                sname = (sit.get("n") or "").replace("\n", " ").strip()
                if sit.get("lid", -1) <= 0:
                    continue
                if sname == "Total":
                    out[sit["lid"]] = ("total", name)
                elif com_vencido and sname.lower().startswith("vencido a partir de 15"):
                    out[sit["lid"]] = ("venc15", name)
        elif it.get("lid", -1) > 0:
            out[it["lid"]] = ("total", name)
    return out


def collect(con, cfg):
    c = cfg["ifdata"]
    base = c.get("ui_base", "https://www3.bcb.gov.br/ifdata/rest/arquivos?nomeArquivo=ifdata_2025_2030")
    results = []
    anomes_list = c["anomes_candidates"]
    for idx, anomes in enumerate(anomes_list):
        try:
            congl_map = _entity_translation(con, anomes)
            n = 0
            # --- composição (trels 123/127/128/129) em TODOS os períodos: habilita
            #     crescimento por produto × instituição (lids lidos por período — layout pode mudar) ---
            info, _, _ = _fetch_json(f"{base}//{anomes}/info{anomes}.json")
            info_by_id = {x["id"]: x for x in info}
            lid_map = {}
            for rid, (prefix, label) in REPORTS.items():
                trel, body_t, meta_t = _fetch_json(f"{base}//{anomes}/trel{anomes}_{rid}.json")
                common.save_bronze("ifdata_ui", f"trel_{rid}_{anomes}", body_t, meta_t)
                com_venc = rid in (123, 128)  # modalidade × prazo: tem 'Vencido a Partir de 15 Dias'
                for lid, (tipo, name) in _category_lids(trel, info_by_id, com_vencido=com_venc).items():
                    lid_map[lid] = (prefix + ("_venc15" if tipo == "venc15" else ""), name)
            lid_map[TOTAL_PJ_LID] = ("cart_pj", "Total da Carteira de Pessoa Jurídica")
            for lid, (pref, met) in QUALIDADE_LIDS.items():
                lid_map[lid] = (pref, met)

            data, body_d, meta_d = _fetch_json(f"{base}//{anomes}/dados{anomes}_3.json")
            bronze_file, sha = common.save_bronze("ifdata_ui", f"carteiras_{anomes}", body_d, meta_d)
            blk = data if isinstance(data, dict) else data[0]
            for ent in blk.get("values", []):
                e = int(ent["e"])
                cod_inst = (congl_map.get(f"C{e - 1_000_000_000:07d}") if e >= 1_000_000_000
                            else str(e).zfill(8))
                if cod_inst is None:
                    continue
                for it in ent["v"]:
                    hit = lid_map.get(it["i"])
                    if hit is None or it["v"] is None:
                        continue
                    prefix, cat = hit
                    # zero em coluna de categoria = não reportado (ausência ≠ zero);
                    # exceção: 'vencido ≥15d' é subcoluna de grupo reportado — zero é zero real
                    # (sem atraso) e será validado no gold contra o Total da mesma modalidade.
                    if it["v"] == 0 and not prefix.endswith("_venc15"):
                        continue
                    metric = f"{prefix}:{_slug(cat)}" if prefix != "qual" else f"qual:{cat}"
                    con.execute(
                        """INSERT OR REPLACE INTO institution_metrics(cod_inst, anomes, metric, value, source_report, bronze_sha)
                           VALUES(?,?,?,?,?,?)""",
                        (cod_inst, anomes, metric, float(it["v"]), "Carteiras(UI)", sha))
                    n += 1
            # --- provisões de crédito (perda esperada e2) no dados_1 ---
            data1, body1, meta1 = _fetch_json(f"{base}//{anomes}/dados{anomes}_1.json")
            bronze1, sha1 = common.save_bronze("ifdata_ui", f"ativo_{anomes}", body1, meta1)
            blk1 = data1 if isinstance(data1, dict) else data1[0]
            for ent in blk1.get("values", []):
                e = int(ent["e"])
                cod_inst = (congl_map.get(f"C{e - 1_000_000_000:07d}") if e >= 1_000_000_000
                            else str(e).zfill(8))
                if cod_inst is None:
                    continue
                for it in ent["v"]:
                    if it["i"] == PERDA_ESPERADA_CREDITO_LID and it["v"] not in (None, 0):
                        con.execute(
                            """INSERT OR REPLACE INTO institution_metrics(cod_inst, anomes, metric, value, source_report, bronze_sha)
                               VALUES(?,?,?,?,?,?)""",
                            (cod_inst, anomes, "qual:provisao_credito_brl", abs(float(it["v"])), "Carteiras(UI)", sha1))
                        n += 1
            common.record_lineage(con, f"institutions_carteiras:{anomes}", bronze_file, sha,
                                  "IF.data UI dados_3 (categorias + inadimplência lid 148834 + ativos problemáticos 148833) e dados_1 (perda esperada crédito 140202)")
            results.append({"key": f"ifdata_carteiras:{anomes}", "ok": True, "metricas": n})
        except Exception as e:
            results.append({"key": f"ifdata_carteiras:{anomes}", "ok": False, "error": str(e)})
    return results
