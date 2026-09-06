"""Conector BCB IF.data — relatório "Passivo" (funding por instituição), API Olinda.

Mesmo corte do Resumo (TipoInstituicao=2: conglomerados prudenciais e instituições
independentes), mesma frequência trimestral. O relatório abre as captações em
depósitos (à vista, poupança, interfinanceiros, a prazo, outros), operações
compromissadas, títulos emitidos (LCI, LCA, letras financeiras, TVM no exterior,
demais) e obrigações por empréstimos e repasses, mais PL e passivo total.

Os NOMES das colunas mudaram entre planos contábeis (2016, 2023, 2025) e os códigos
entre parênteses mudam de letra para PL e passivo total; o parser casa cada coluna
por prefixo do nome e soma as linhas que o BCB desdobrou ("Outros depósitos" virou
"Conta de pagamento pré-paga" + "Depósitos outros"). Ausência é nulo: coluna que
não existe no período não vira zero.

Silver: ifdata_passivo(anomes, cod_inst, item, value). Histórico capado por execução,
como o Resumo (retomável; pula períodos já gravados).
"""
import json
import re

from pipeline import common
from pipeline.sources.ifdata import _odata

# (prefixo do nome normalizado, chave). Ordem importa: prefixos mais específicos antes.
ITENS = [
    ("Depósitos à Vista", "dep_vista"),
    ("Depósitos de Poupança", "dep_poupanca"),
    ("Depósitos Interfinanceiros", "dep_interfin"),
    ("Depósitos a Prazo", "dep_prazo"),
    ("Outros Depósitos", "dep_outros"),
    ("Depósitos Outros", "dep_outros"),
    ("Conta de Pagamento Pré-Paga", "dep_outros"),
    ("Depósito Total", "depositos"),
    ("Depósitos (a)", "depositos"),
    ("Obrigações por Operações Compromissadas", "compromissadas"),
    ("Letras de Crédito Imobiliário", "lci"),
    ("Letras de Crédito do Agronegócio", "lca"),
    ("Letras Financeiras", "lf"),
    ("Obrigações por Títulos e Valores Mobiliários no Exterior", "tvm_exterior"),
    ("Outros Recursos de Aceites", "outros_titulos"),
    ("Demais instrumentos de dívida", "outros_titulos"),
    ("Recursos de Aceites e Emissão de Títulos", "titulos"),
    ("Outros Instrumentos de Dívida (c)", "titulos"),
    ("Obrigações por Empréstimos e Repasses", "emprestimos_repasses"),
    ("Captações", "captacoes"),
    ("Instrumentos de Dívida Elegíveis a Capital", "divida_capital"),
    ("Patrimônio Líquido", "pl"),
    ("Passivo Total", "passivo_total"),
]


def _ensure(con):
    con.execute("CREATE TABLE IF NOT EXISTS ifdata_passivo(anomes TEXT, cod_inst TEXT, item TEXT, value REAL, PRIMARY KEY(anomes, cod_inst, item))")


def _item(nome):
    col = re.sub(r"\s+", " ", nome or "").strip()
    for prefixo, chave in ITENS:
        if col.startswith(prefixo):
            return chave
    return None


def _coleta_periodo(con, cfg, anomes):
    c = cfg["ifdata"]
    body, meta = _odata(c["base_url"], "IfDataValores",
                        {"AnoMes": anomes, "TipoInstituicao": c["tipo_instituicao"], "Relatorio": "'T'"},
                        filt="NomeRelatorio eq 'Passivo'")
    values = json.loads(body).get("value", [])
    if not values:
        return None
    _, sha = common.save_bronze("ifdata", f"passivo_{anomes}_t{c['tipo_instituicao']}", body, meta)
    acc = {}
    for row in values:
        chave = _item(row.get("NomeColuna"))
        if chave is None or row.get("Saldo") is None:
            continue
        k = (row["CodInst"], chave)
        acc[k] = acc.get(k, 0.0) + float(row["Saldo"])
    con.executemany("INSERT OR REPLACE INTO ifdata_passivo(anomes, cod_inst, item, value) VALUES(?,?,?,?)",
                    [(anomes, cod, item, v) for (cod, item), v in acc.items()])
    common.record_lineage(con, "funding.json", f"ifdata/passivo_{anomes}", sha,
                          "IF.data Olinda, relatório Passivo: captações por instrumento, por instituição (colunas casadas por prefixo do nome)")
    con.commit()
    return len(acc)


def collect(con, cfg):
    _ensure(con)
    c = cfg["ifdata"]
    results = []
    feitos = 0
    cap = int(c.get("backfill_por_execucao") or 10)
    # correntes primeiro (sempre tentados até o primeiro publicado), depois o histórico capado
    for anomes in list(c["anomes_candidates"]) + list(c.get("anomes_history") or []):
        ja = con.execute("SELECT 1 FROM ifdata_passivo WHERE anomes=? LIMIT 1", (anomes,)).fetchone()
        if ja:
            continue
        if feitos >= cap:
            break
        try:
            n = _coleta_periodo(con, cfg, anomes)
            feitos += 1
            results.append({"key": f"ifdata_passivo:{anomes}", "ok": True, "linhas": n} if n else
                           {"key": f"ifdata_passivo:{anomes}", "ok": True, "pulado": "sem dados na fonte"})
        except Exception as e:
            results.append({"key": f"ifdata_passivo:{anomes}", "ok": False, "error": str(e)[:160]})
    return results or [{"key": "ifdata_passivo", "ok": True, "nota": "nada a coletar"}]
