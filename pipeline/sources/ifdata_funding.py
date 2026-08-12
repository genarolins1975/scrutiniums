"""Funding e DRE por conglomerado — custo de captação e modelo de negócio.

Fonte: arquivos da interface do IF.data (mesma infraestrutura do
ifdata_carteiras): `dados{AAAAMM}_1.json` traz, por entidade, o passivo
(depósitos por tipo, captações totais) e a DRE no layout da Res. 4.966
(vigente desde 2025). Valores em R$ (unidades).

Duas semânticas que viajam com o dado, medidas empiricamente (Itaú
prudencial, 2025-12 × 2026-03):

1. **A DRE acumula POR SEMESTRE**: mar = 3 meses, jun = 6, set = 3, dez = 6.
   Qualquer anualização declara os meses do período — nunca um ×4 cego.
2. **Layouts**: os lids da Res. 4.966 (14xxxx) existem de 2025 em diante; o
   layout antigo (78xxx) cobre períodos anteriores. Coletamos com fallback,
   e a métrica no silver é a mesma — o conceito é equivalente e a fronteira
   (troca de plano contábil) fica documentada aqui.

Métricas gravadas em institution_metrics (cod_inst traduzido pelo mesmo
mapa prudencial do ifdata_ui):
  fund:dep_vista, fund:dep_poupanca, fund:dep_prazo, fund:dep_interf,
  fund:dep_outros, fund:dep_total, fund:captacoes,
  dre:despesa_juros_captacoes, dre:resultado_intermediacao,
  dre:serv_pagamentos, dre:tarifas, dre:outras_rendas_servicos
"""
import json

from pipeline import common
from pipeline.sources.ifdata_carteiras import _fetch_json
from pipeline.sources.ifdata_ui import _entity_translation

# (métrica, lid Res. 4.966 [2025+], lid layout antigo [até 2024])
LIDS = [
    ("fund:dep_vista", 140222, 78282),
    ("fund:dep_poupanca", 140223, 78283),
    ("fund:dep_interf", 140224, 78284),
    ("fund:dep_prazo", 140225, 78286),
    ("fund:dep_outros", 140226, 78285),
    ("fund:dep_total", 140221, 78287),
    ("fund:captacoes", 140239, 78185),
    ("dre:despesa_juros_captacoes", 141843, 78209),
    ("dre:resultado_intermediacao", 141851, 78215),
    ("dre:serv_pagamentos", 141852, None),   # rubrica nova da Res. 4.966
    ("dre:tarifas", 141856, 78217),
    ("dre:outras_rendas_servicos", 141857, 78216),
]


def collect(con, cfg):
    c = cfg["ifdata"]
    base = c.get("ui_base", "https://www3.bcb.gov.br/ifdata/rest/arquivos?nomeArquivo=ifdata_2025_2030")
    results = []
    for anomes in c["anomes_candidates"]:
        chave = f"funding:{anomes}"
        ja = con.execute("SELECT 1 FROM institution_metrics WHERE anomes=? AND metric='fund:captacoes' LIMIT 1",
                         (anomes,)).fetchone()
        if ja:
            results.append({"key": chave, "ok": True, "pulado": "período já coletado"})
            continue
        try:
            congl_map = _entity_translation(con, anomes)
            data, body, meta = _fetch_json(f"{base}//{anomes}/dados{anomes}_1.json")
            novo = int(anomes) >= 202501  # layout Res. 4.966
            n = 0
            for row in data.get("values", []):
                e = row["e"]
                if e >= 1_000_000_000:
                    cod = congl_map.get("C%07d" % (e - 1_000_000_000))
                else:
                    cod = "%08d" % e
                if not cod:
                    continue
                vals = {x["i"]: x["v"] for x in row["v"]}
                for metric, lid_novo, lid_velho in LIDS:
                    lid = lid_novo if novo else lid_velho
                    if lid is None or lid not in vals:
                        continue
                    con.execute(
                        "INSERT OR REPLACE INTO institution_metrics VALUES(?,?,?,?,?,?)",
                        (cod, anomes, metric, vals[lid], "ifdata_ui:dados_1", None))
                    n += 1
            _, sha = common.save_bronze("ifdata_funding", f"dados{anomes}_1.json", body, meta)
            common.record_lineage(con, "institutions.json", f"ifdata_funding/dados{anomes}_1.json", sha,
                                  "passivo (depósitos/captações) e DRE (juros de captação, serviços) -> institution_metrics")
            con.commit()
            results.append({"key": chave, "ok": True, "metricas": n})
        except Exception as e:
            results.append({"key": chave, "ok": False, "error": str(e)[:200]})
    return results
