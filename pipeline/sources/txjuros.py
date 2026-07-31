"""Conector BCB txjuros — taxas de juros por instituição × modalidade.

Fonte: Olinda `taxaJuros/versao/v2/odata/TaxasJurosDiariaPorInicioPeriodo`
(taxas médias das operações CONTRATADAS por instituição na janela divulgada,
metodologia BCB; janelas ~semanais; identificação por cnpj8).

Conceito distinto da carteira: a taxa refere-se a NOVAS operações da modalidade
txjuros; a carteira IF.data é o estoque da modalidade contábil. A correspondência
produto×modalidade é explícita em pipeline/products.py (TAXAS_MAP) e nunca mistura
modalidades diferentes numa mesma tabela.

Guarda-se somente a janela mais recente disponível por modalidade (a série
histórica completa tem milhões de linhas; o histórico não é objetivo desta fase).
"""
import json
import urllib.parse

from pipeline import common

BASE = "https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/TaxasJurosDiariaPorInicioPeriodo"

# (segmento, modalidade) efetivamente publicados — censo validado em 2026-07 (22 modalidades)
MODALIDADES = [
    ("PESSOA FÍSICA", "Cartão de crédito - rotativo total - Prefixado"),
    ("PESSOA FÍSICA", "Cartão de crédito - parcelado - Prefixado"),
    ("PESSOA FÍSICA", "Crédito pessoal consignado INSS - Prefixado"),
    ("PESSOA FÍSICA", "Crédito pessoal consignado privado - Prefixado"),
    ("PESSOA FÍSICA", "Crédito pessoal consignado público - Prefixado"),
    ("PESSOA FÍSICA", "Crédito pessoal não consignado - Prefixado"),
    ("PESSOA FÍSICA", "Aquisição de veículos - Prefixado"),
    ("PESSOA FÍSICA", "Cheque especial - Prefixado"),
    ("PESSOA JURÍDICA", "Capital de giro com prazo até 365 dias - Prefixado"),
    ("PESSOA JURÍDICA", "Capital de giro com prazo superior a 365 dias - Prefixado"),
    ("PESSOA JURÍDICA", "Capital de giro com prazo até 365 dias - Pós-fixado referenciado em juros flutuantes"),
    ("PESSOA JURÍDICA", "Capital de giro com prazo superior a 365 dias - Pós-fixado referenciado em juros flutuantes"),
    ("PESSOA JURÍDICA", "Conta garantida - Prefixado"),
    ("PESSOA JURÍDICA", "Conta garantida - Pós-fixado referenciado em juros flutuantes"),
    ("PESSOA JURÍDICA", "Cheque especial - Prefixado"),
    ("PESSOA JURÍDICA", "Desconto de duplicatas - Prefixado"),
    ("PESSOA JURÍDICA", "Desconto de cheques - Prefixado"),
    ("PESSOA JURÍDICA", "Antecipação de faturas de cartão de crédito - Prefixado"),
    ("PESSOA JURÍDICA", "Adiantamento sobre contratos de câmbio (ACC) - Pós-fixado referenciado em moeda estrangeira"),
    ("PESSOA JURÍDICA", "Vendor - Prefixado"),
]


def _ensure_table(con):
    con.execute("""CREATE TABLE IF NOT EXISTS taxas_inst(
        inicio TEXT, fim TEXT, segmento TEXT, modalidade TEXT,
        cnpj8 TEXT, nome TEXT, taxa_am REAL, taxa_aa REAL, posicao INTEGER,
        collected_at TEXT,
        PRIMARY KEY(inicio, segmento, modalidade, cnpj8))""")


def collect(con, cfg):
    _ensure_table(con)
    results = []
    for seg, mod in MODALIDADES:
        key = f"txjuros:{seg[:2]}:{mod[:40]}"
        try:
            # histórico: todas as janelas desde 2023 (semanal ≈ 50–70 IFs/janela);
            # PK dedupe garante idempotência entre execuções diárias
            # InicioPeriodo é string na Olinda: literal de data PRECISA de aspas (sem aspas → HTTP 400)
            filt = f"Segmento eq '{seg}' and Modalidade eq '{mod}' and InicioPeriodo ge '2023-01-01'"
            url = (f"{BASE}?$top=20000&$orderby=InicioPeriodo%20desc"
                   f"&$filter={urllib.parse.quote(filt)}&$format=json")
            body, meta = common.http_get(url, timeout=300)
            rows = json.loads(body).get("value", [])
            if not rows:
                results.append({"key": key, "ok": False, "error": "sem linhas"})
                continue
            bronze_file, sha = common.save_bronze("txjuros", f"{seg[:2]}_{mod[:40].replace(' ', '_')}", body, meta)
            latest = max(r["InicioPeriodo"] for r in rows)
            n = 0
            for r in rows:
                if r.get("TaxaJurosAoAno") is None:
                    continue
                con.execute("""INSERT OR REPLACE INTO taxas_inst
                    (inicio, fim, segmento, modalidade, cnpj8, nome, taxa_am, taxa_aa, posicao, collected_at)
                    VALUES(?,?,?,?,?,?,?,?,?,?)""",
                    (r["InicioPeriodo"], r["FimPeriodo"], seg, mod, r.get("cnpj8"),
                     r.get("InstituicaoFinanceira"), r.get("TaxaJurosAoMes"), r.get("TaxaJurosAoAno"),
                     r.get("Posicao"), common.now_utc()))
                n += 1
            common.record_lineage(con, f"taxas:{seg[:2]}:{mod[:40]}", bronze_file, sha,
                                  "txjuros Olinda v2 — janela mais recente por modalidade, identificação por cnpj8")
            results.append({"key": key, "ok": True, "linhas": n, "janela": latest})
        except Exception as e:
            results.append({"key": key, "ok": False, "error": str(e)})
    return results
