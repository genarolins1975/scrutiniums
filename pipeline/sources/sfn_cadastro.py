"""Cadastro de instituições em funcionamento (BCB/Unicad, Olinda).

Quatro relações públicas, uma por natureza da sede, servidas pela API
`Instituicoes_em_funcionamento`: bancos (múltiplos, comerciais, de câmbio, filiais
estrangeiras, Caixa e BB), cooperativas de crédito (com classe, categoria, critério de
associação e central de filiação), demais sociedades (SCD, SEP, SCFI, corretoras, DTVM,
instituições de pagamento, agências de fomento, bancos de investimento e de
desenvolvimento, companhias hipotecárias, SAM, APE) e administradoras de consórcio.

O cadastro só publica o estado ATUAL, sem data de início nem histórico. Por isso o
silver guarda três camadas:
- `sfn_sedes`: espelho da última coleta (recriado a cada execução);
- `sfn_hist`: append por CNPJ com primeiro e último visto, segmento e nome do último
  visto. Quem some da relação permanece na história com `ultimo_visto` parado: é
  assim que entradas e saídas passam a existir daqui para a frente;
- `sfn_contagem`: contagem por grupo e segmento a cada data de coleta (série própria).

A história anterior ao início da coleta vem de outra fonte, o IF.data trimestral (quem
entrega o resumo em cada trimestre), tratada no builder.
"""
import json

from pipeline import common

BASE = "https://olinda.bcb.gov.br/olinda/servico/Instituicoes_em_funcionamento/versao/v1/odata/{rec}?$format=json&$top=50000"
RECURSOS = [("bancos", "SedesBancoComMultCE"), ("cooperativas", "SedesCooperativas"), ("sociedades", "SedesSociedades"), ("consorcios", "SedesConsorcios")]
GRUPO_SEG = {   # segmento declarado -> grupo do painel
    "Banco Múltiplo": "Bancos", "Banco Comercial": "Bancos", "Banco Comercial Estrangeiro - Filial no país": "Bancos", "Banco de Câmbio": "Bancos",
    "Banco Múltiplo Cooperativo": "Bancos", "Banco do Brasil - Banco Múltiplo": "Bancos", "Caixa Econômica Federal": "Bancos",
    "Banco de Investimento": "Bancos", "Banco de Desenvolvimento": "Fomento e desenvolvimento", "BNDES": "Fomento e desenvolvimento", "Agência de Fomento": "Fomento e desenvolvimento",
    "Sociedade de Crédito Direto": "Fintechs de crédito", "Sociedade de Empréstimo entre Pessoas": "Fintechs de crédito",
    "Instituição de Pagamento": "Instituições de pagamento",
    "Sociedade de Crédito, Financiamento e Investimento": "Financeiras e crédito especializado", "Sociedade de Crédito ao Microempreendedor": "Financeiras e crédito especializado",
    "Sociedade de Arrendamento Mercantil": "Financeiras e crédito especializado", "Companhia Hipotecária": "Financeiras e crédito especializado",
    "Associação de Poupança e Empréstimo": "Financeiras e crédito especializado",
    "Sociedade Corretora de TVM": "Mercado de capitais e câmbio", "Sociedade Distribuidora de TVM": "Mercado de capitais e câmbio", "Sociedade Corretora de Câmbio": "Mercado de capitais e câmbio",
}


def _ensure(con):
    con.execute("""CREATE TABLE IF NOT EXISTS sfn_sedes(
        cnpj8 TEXT PRIMARY KEY, nome TEXT, grupo TEXT, segmento TEXT, uf TEXT, municipio TEXT, cod_mun TEXT,
        carteira_comercial TEXT, classe TEXT, associacao TEXT, categoria TEXT, filiacao TEXT, coletado_em TEXT)""")
    con.execute("""CREATE TABLE IF NOT EXISTS sfn_hist(
        cnpj8 TEXT PRIMARY KEY, nome TEXT, grupo TEXT, segmento TEXT, uf TEXT, primeiro_visto TEXT, ultimo_visto TEXT, segmento_anterior TEXT, mudou_em TEXT)""")
    con.execute("CREATE TABLE IF NOT EXISTS sfn_contagem(data TEXT, grupo TEXT, segmento TEXT, n INTEGER, PRIMARY KEY(data, grupo, segmento))")


def _linhas(rec, dados, hoje):
    g = lambda r, k: (r.get(k) or "").strip() or None
    out = []
    for r in dados:
        cnpj = g(r, "CNPJ")
        if not cnpj:
            continue
        if rec == "cooperativas":
            seg = f"Cooperativa de crédito ({(g(r, 'CLASSE') or 'sem classe').lower()})"
            grupo = "Cooperativas de crédito"
        elif rec == "consorcios":
            seg, grupo = "Administradora de consórcio", "Consórcios"
        else:
            seg = g(r, "SEGMENTO") or "não informado"
            grupo = GRUPO_SEG.get(seg, "Outros")
        out.append((cnpj.zfill(8), g(r, "NOME_INSTITUICAO"), grupo, seg, g(r, "UF"), g(r, "MUNICIPIO"), g(r, "MUNICIPIO_IBGE"),
                    g(r, "CARTEIRA_COMERCIAL"), g(r, "CLASSE"), g(r, "ASSOCIACAO"), g(r, "CATEGCOOPSING"), g(r, "FILIACAO"), hoje))
    return out


def collect(con, cfg=None):
    _ensure(con)
    hoje = common.now_utc()[:10]
    todas, results = [], []
    for rec, ent in RECURSOS:
        try:
            body, meta = common.http_get(BASE.format(rec=ent), timeout=180)
            dados = json.loads(body)["value"]
            bronze_file, sha = common.save_bronze("sfn_cadastro", ent, body, meta)
            common.record_lineage(con, "sfn.json", bronze_file, sha, f"BCB/Unicad {ent}: cadastro de sedes em funcionamento, posição do dia")
            linhas = _linhas(rec, dados, hoje)
            todas.extend(linhas)
            results.append({"key": f"sfn_cadastro:{rec}", "ok": True, "sedes": len(linhas)})
        except Exception as e:
            results.append({"key": f"sfn_cadastro:{rec}", "ok": False, "error": str(e)[:160]})
    if len([r for r in results if r["ok"]]) < len(RECURSOS):
        return results   # cadastro parcial não vira posição: uma relação fora do ar apareceria como onda de saídas
    con.execute("DELETE FROM sfn_sedes")
    con.executemany("INSERT OR REPLACE INTO sfn_sedes VALUES(" + ",".join("?" * 13) + ")", todas)
    for cnpj, nome, grupo, seg, uf, *_r in todas:
        ant = con.execute("SELECT segmento FROM sfn_hist WHERE cnpj8=?", (cnpj,)).fetchone()
        if ant is None:
            con.execute("INSERT INTO sfn_hist VALUES(?,?,?,?,?,?,?,?,?)", (cnpj, nome, grupo, seg, uf, hoje, hoje, None, None))
        elif ant[0] != seg:
            con.execute("UPDATE sfn_hist SET nome=?, grupo=?, segmento=?, uf=?, ultimo_visto=?, segmento_anterior=?, mudou_em=? WHERE cnpj8=?",
                        (nome, grupo, seg, uf, hoje, ant[0], hoje, cnpj))
        else:
            con.execute("UPDATE sfn_hist SET nome=?, grupo=?, uf=?, ultimo_visto=? WHERE cnpj8=?", (nome, grupo, uf, hoje, cnpj))
    con.execute("DELETE FROM sfn_contagem WHERE data=?", (hoje,))
    con.executemany("INSERT OR REPLACE INTO sfn_contagem VALUES(?,?,?,?)",
                    [(hoje, g, s, n) for g, s, n in con.execute("SELECT grupo, segmento, COUNT(*) FROM sfn_sedes GROUP BY grupo, segmento")])
    con.commit()
    return results
