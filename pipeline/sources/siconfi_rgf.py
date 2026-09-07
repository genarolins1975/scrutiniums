"""Conector Tesouro Nacional — Siconfi, Relatório de Gestão Fiscal (RGF), Anexo 02: dívida consolidada dos estados.

Fonte: API ORDS do Tesouro Transparente, https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rgf
(dataset "Relatório de Gestão Fiscal (RGF) dos Entes da Federação", dados abertos). Uma requisição por
estado e exercício, com filtro no Anexo 02 (Demonstrativo da Dívida Consolidada Líquida), poder Executivo,
periodicidade quadrimestral: o relatório do 3º quadrimestre traz as colunas dos três quadrimestres e o
saldo do exercício anterior, então basta o último período publicado de cada exercício. Sondagem de
07/09/2026: as 27 UFs têm o 1º quadrimestre de 2026 e o 3º de 2025; cerca de 1 s por requisição.

Guardam-se só as contas que o painel usa (dívida consolidada, dívida consolidada líquida, receita corrente
líquida ajustada, percentual DCL/RCL, reestruturação da dívida com a União, empréstimos internos e
externos, precatórios, limites do Senado e de alerta). Municípios ficam fora: são 5,5 mil entes com
periodicidade variável, e a pergunta do painel (quanto os estados devem e quanto cabe no limite) é
estadual. Nada é estimado: estado sem entrega no exercício fica sem linha.
"""
import datetime as dt
import json
import urllib.request

from pipeline import common

URL = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rgf"
EXERCICIO_INICIAL = 2015
CONTAS = {
    "DividaConsolidada": "dc", "DividaConsolidadaLiquida": "dcl", "RGF2ReceitaCorrenteLiquida": "rcl",
    "ReceitaCorrenteLiquidaAjustadaParaCalculoDosLimitesDeEndividamento": "rcl_ajustada",
    "PercentualDaDCSobreARCL": "dc_rcl_pct", "PercentualDaDCLSobreARCL": "dcl_rcl_pct",
    "DividaContratual": "contratual", "DividaMobiliaria": "mobiliaria",
    "RGF2Emprestimos": "emprestimos", "RGF2EmprestimosInternos": "emprestimos_internos", "RGF2EmprestimosExternos": "emprestimos_externos",
    "RGF2ReestruturacaoDaDividaDeEstadosEMunicipios": "reestruturacao_uniao",
    "RGF2ParcelamentoERenegociacaoDeDividas": "parcelamentos",
    "PrecatoriosPosterioresA05052000VencidosENaoPagos": "precatorios_vencidos",
    "DeducoesDaDividaConsolidada": "deducoes", "RGF2DisponibilidadeDeCaixa": "disponibilidade_caixa",
    "LimiteDefinidoPorResolucaoDoSenadoFederal": "limite_senado", "LimiteDeAlerta": "limite_alerta",
    "DividaContratualDePPP": "ppp", "RGF2DividaConsolidadaPrevidenciariaPassivoAtuarial": "passivo_atuarial",
}
COLUNAS = {"SALDO DO EXERCÍCIO ANTERIOR": 0, "Até o 1º Quadrimestre": 1, "Até o 2º Quadrimestre": 2, "Até o 3º Quadrimestre": 3}


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS siconfi_rgf2(cod_ibge INTEGER, uf TEXT, exercicio INTEGER, quadrimestre INTEGER, conta TEXT, valor REAL,
        PRIMARY KEY(cod_ibge, exercicio, quadrimestre, conta));
    CREATE TABLE IF NOT EXISTS siconfi_coleta(cod_ibge INTEGER, exercicio INTEGER, periodo_publicado INTEGER, linhas INTEGER, coletado_em TEXT,
        PRIMARY KEY(cod_ibge, exercicio));
    """)


def _busca(cod, exercicio, periodo):
    u = (f"{URL}?an_exercicio={exercicio}&in_periodicidade=Q&nr_periodo={periodo}&co_tipo_demonstrativo=RGF"
         f"&no_anexo=RGF-Anexo%2002&co_poder=E&id_ente={cod}&limit=5000")
    body, _ = common.http_get(u, timeout=120)
    return json.loads(body).get("items") or []


def collect(con, cfg):
    _ensure(con)
    key = "siconfi_rgf:anexo02"
    try:
        entes = con.execute("SELECT cod, uf FROM geo_uf ORDER BY cod").fetchall()
        if len(entes) < 27:
            return [{"key": key, "ok": False, "error": "geo_uf sem as 27 UFs: o coletor geo_ibge precisa rodar antes"}]
        ano = dt.date.today().year
        feitos = {(r[0], r[1]): r[2] for r in con.execute("SELECT cod_ibge, exercicio, periodo_publicado FROM siconfi_coleta").fetchall()}
        req, novos, ufs_ok = 0, 0, set()
        for cod, uf in entes:
            cod = int(cod)
            for ex in range(EXERCICIO_INICIAL, ano + 1):
                # exercício fechado (3º quadrimestre já guardado) e anterior ao ano passado não muda mais
                if feitos.get((cod, ex)) == 3 and ex < ano - 1:
                    continue
                itens, per_pub = [], None
                for per in (3, 2, 1):
                    itens = _busca(cod, ex, per)
                    req += 1
                    if itens:
                        per_pub = per
                        break
                if not itens:
                    continue
                linhas = []
                for x in itens:
                    c = CONTAS.get(x.get("cod_conta"))
                    q = COLUNAS.get(x.get("coluna"))
                    if c is None or q is None or not isinstance(x.get("valor"), (int, float)):
                        continue
                    linhas.append((cod, x.get("uf") or uf, ex, q, c, float(x["valor"])))
                if not linhas:
                    continue
                con.execute("DELETE FROM siconfi_rgf2 WHERE cod_ibge=? AND exercicio=?", (cod, ex))
                con.executemany("INSERT OR REPLACE INTO siconfi_rgf2 VALUES(?,?,?,?,?,?)", linhas)
                con.execute("INSERT OR REPLACE INTO siconfi_coleta VALUES(?,?,?,?,?)", (cod, ex, per_pub, len(linhas), common.now_utc()))
                novos += 1
                ufs_ok.add(uf)
        con.commit()
        ult = con.execute("SELECT exercicio, MAX(quadrimestre) FROM siconfi_rgf2 WHERE exercicio=(SELECT MAX(exercicio) FROM siconfi_rgf2)").fetchone()
        n = con.execute("SELECT COUNT(*) FROM siconfi_rgf2").fetchone()[0]
        extrato = "\n".join(";".join(str(v) for v in r) for r in con.execute(
            "SELECT * FROM siconfi_rgf2 WHERE exercicio>=? ORDER BY exercicio, cod_ibge, quadrimestre, conta", (ano - 1,)).fetchall())
        bronze_file, sha = common.save_bronze("siconfi_rgf", f"anexo02_{ult[0]}q{ult[1]}", extrato.encode(),
                                              {"url": URL, "nota": "RGF Anexo 02 (DCL) do poder Executivo dos 27 estados e DF, dois últimos exercícios; contas selecionadas"})
        common.record_lineage(con, f"siconfi_rgf2:{ult[0]}q{ult[1]}", bronze_file, sha,
                              "Tesouro Nacional, API Siconfi tt/rgf: RGF Anexo 02 (dívida consolidada líquida) por estado e exercício, último período publicado")
        return [{"key": key, "ok": True, "requisicoes": req, "exercicios_gravados": novos, "linhas": n, "ufs": len(ufs_ok),
                 "ultimo": f"{ult[0]}q{ult[1]}"}]
    except Exception as e:
        return [{"key": key, "ok": False, "error": str(e)[:160]}]
