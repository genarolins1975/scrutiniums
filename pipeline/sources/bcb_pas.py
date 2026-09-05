"""Processos administrativos sancionadores do BCB (Gepad, API Olinda).

Três quadros públicos: penalidades aplicadas em PAS (uma linha por apenado e decisão,
com 1ª e 2ª instâncias, multa, recurso e situação), inabilitados vigentes e proibidos
de atuar vigentes. O quadro de penalidades é o acervo inteiro (decisões desde 2013):
cada coleta substitui a tabela; o hash do payload evita regravar.

Regra editorial do painel que consome isto: nunca ranking por instituição. Volume de
processos não é irregularidade, e a base é de decisões, não de condutas.
"""
import json

from pipeline import common

BASE = "https://olinda.bcb.gov.br/olinda/servico/{svc}/versao/v1/odata/{ent}?$format=json&$top=200000"
RECURSOS = [("Gepad_QuadroPenalidades", "QuadroGeralProcessoAdministrativoSancionador", "bcb_pas_decisao"),
            ("Gepad_QuadrosGeraisInternet", "QuadroGeralInabilitados", "bcb_pas_inabilitado"),
            ("Gepad_QuadrosGeraisInternet", "QuadroGeralProibidos", "bcb_pas_proibido")]


def _ensure(con):
    con.execute("""CREATE TABLE IF NOT EXISTS bcb_pas_decisao(
        seq INTEGER PRIMARY KEY, pas TEXT, nome TEXT, cpf_cnpj TEXT, pessoa TEXT, citacao TEXT, decisao1_num TEXT, decisao1_data TEXT, pena1 TEXT, duracao1 REAL,
        multa1 REAL, recurso TEXT, decisao2_num TEXT, decisao2_data TEXT, pena2 TEXT, duracao2 REAL, multa2 REAL, situacao TEXT)""")
    con.execute("CREATE TABLE IF NOT EXISTS bcb_pas_inabilitado(pas TEXT, nome TEXT, cpf TEXT, penalidade TEXT, prazo_anos REAL, inicio TEXT, fim TEXT, PRIMARY KEY(pas, nome))")
    con.execute("CREATE TABLE IF NOT EXISTS bcb_pas_proibido(pas TEXT, nome TEXT, cpf_cnpj TEXT, penalidade TEXT, prazo_anos REAL, inicio TEXT, fim TEXT, PRIMARY KEY(pas, nome))")
    con.execute("CREATE TABLE IF NOT EXISTS bcb_pas_coleta(tabela TEXT PRIMARY KEY, sha TEXT, collected_at TEXT, n INTEGER)")


def _pessoa(doc):
    d = (doc or "").strip()
    if not d:
        return None
    if "*" in d or len(d.replace(".", "").replace("-", "")) == 11:
        return "PF"
    return "PJ"


def collect(con, cfg=None):
    _ensure(con)
    results = []
    for svc, ent, tabela in RECURSOS:
        key = f"bcb_pas:{tabela}"
        try:
            body, meta = common.http_get(BASE.format(svc=svc, ent=ent), timeout=300)
            dados = json.loads(body)["value"]
            bronze_file, sha = common.save_bronze("bcb_pas", ent, body, meta)
            ja = con.execute("SELECT sha FROM bcb_pas_coleta WHERE tabela=?", (tabela,)).fetchone()
            if ja and ja[0] == sha:
                results.append({"key": key, "ok": True, "nota": "inalterado (hash)"})
                continue
            g = lambda r, k: (r.get(k) if r.get(k) not in ("", None) else None)
            con.execute(f"DELETE FROM {tabela}")
            if tabela == "bcb_pas_decisao":
                # seq = posição no quadro: a mesma pessoa pode ter mais de uma penalidade na mesma decisão (linhas idênticas na chave natural)
                linhas = [(i, g(r, "PAS"), g(r, "Nome"), g(r, "CPF_CNPJ"), _pessoa(g(r, "CPF_CNPJ")), g(r, "Data_da_citacao"), g(r, "Numero_decisao_1_instancia"),
                           g(r, "Data_da_decisao_1_instancia"), g(r, "Tipo_penalidade_1_instancia"), g(r, "Duracao_da_pena_1_instancia"), g(r, "Valor_da_multa_1_instancia"),
                           g(r, "Apresentou_recurso"), g(r, "Numero_decisao_2_instancia"), g(r, "Data_da_decisao_2_instancia"), g(r, "Tipo_penalidade_2_instancia"),
                           g(r, "Duracao_da_pena_2_instancia"), g(r, "Valor_da_multa_2_instancia"), g(r, "Situacao")) for i, r in enumerate(dados)]
                con.executemany("INSERT OR REPLACE INTO bcb_pas_decisao VALUES(" + ",".join("?" * 18) + ")", linhas)
            elif tabela == "bcb_pas_inabilitado":
                linhas = [(g(r, "PAS"), g(r, "Nome"), g(r, "CPF"), g(r, "Penalidade"), g(r, "Prazo_em_anos"), g(r, "Inicio_do_cumprimento"), g(r, "Prazo_final_penalidade")) for r in dados]
                con.executemany("INSERT OR REPLACE INTO bcb_pas_inabilitado VALUES(?,?,?,?,?,?,?)", linhas)
            else:
                linhas = [(g(r, "PAS"), g(r, "Nome"), g(r, "CPF_CNPJ"), g(r, "Penalidade"), g(r, "Prazo_em_anos"), g(r, "Inicio_do_cumprimento"), g(r, "Prazo_final_penalidade")) for r in dados]
                con.executemany("INSERT OR REPLACE INTO bcb_pas_proibido VALUES(?,?,?,?,?,?,?)", linhas)
            con.execute("INSERT OR REPLACE INTO bcb_pas_coleta VALUES(?,?,?,?)", (tabela, sha, common.now_utc(), len(linhas)))
            common.record_lineage(con, "conduta.json", bronze_file, sha, f"BCB/Gepad {ent}: acervo inteiro substituído a cada coleta")
            con.commit()
            results.append({"key": key, "ok": True, "linhas": len(linhas)})
        except Exception as e:
            results.append({"key": key, "ok": False, "error": str(e)[:160]})
    return results
