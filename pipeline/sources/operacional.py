"""Fase 0 dos indicadores operacionais — só fontes ESTRUTURADAS, zero PDF, zero LLM.

Três coletas, todas de dados abertos oficiais:

1. **Empregados** — CVM/FRE, tabela `empregado_posicao_local` (item 10.1 do FRE,
   obrigatória desde a Resolução CVM 59; primeiro zip com a tabela: 2023).
   O valor é o DECLARADO pela companhia listada, no escopo que ela declara —
   normalmente difere do conglomerado prudencial do IF.data, e essa diferença
   viaja com o dado até a tela (nunca é "reconciliada" silenciosamente).
2. **Auditores** — CVM/FCA, tabela `auditor`: auditor independente vigente e
   histórico (Data_Inicio/Data_Fim de atuação).
3. **Rede de agências** — ESTBAN municipal (mesma fonte do painel de
   penetração): soma nacional de AGEN_PROCESSADAS por CNPJ-raiz de banco, mais
   contagem de municípios com ao menos uma agência. Guardamos TODOS os bancos
   (não só o piloto): a tabela é pequena e habilita rankings futuros.

Idempotência: FRE/FCA de ano fechado e ESTBAN de mês fechado nunca mudam —
`oper_coleta` registra o que já foi absorvido e a coleta pula. O zip do ano
corrente da CVM é rebaixado a cada execução (companhias retificam o ano todo).
"""
import csv
import hashlib
import io
import json
import zipfile
from datetime import datetime, timezone

from pipeline import common
from pipeline.sources.b3_market import COMPANIES
from pipeline.sources.estban import datas_disponiveis

FRE = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FRE/DADOS/fre_cia_aberta_{ano}.zip"
FCA = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FCA/DADOS/fca_cia_aberta_{ano}.zip"
FRE_PRIMEIRO_ANO = 2023  # a tabela de empregados só existe a partir do FRE/2023
FCA_PRIMEIRO_ANO = 2021


def _fmt_cnpj(c):
    return f"{c[0:2]}.{c[2:5]}.{c[5:8]}/{c[8:12]}-{c[12:14]}"


# Bancos com registro ATIVO na CVM que não fazem parte do piloto de mercado
# (o piloto segue o recorte da B3; a CVM classifica por setor de atividade e
# alcança mais instituições). O critério aqui é objetivo e verificável na
# própria fonte: `Setor_Atividade = "Bancos"` no FCA, registro ativo. Manter a
# lista explícita — em vez de gerar identificadores automaticamente do nome —
# preserva ids estáveis nas URLs; a coleta registra o cadastro inteiro da CVM
# e o gold publica quem ficou de fora, para que a lacuna seja visível.
#
# `cnpj8_rede` é o CNPJ-raiz do banco OPERACIONAL no ESTBAN, que pode diferir
# do CNPJ da companhia registrada (caso do Inter: holding 42737954 na CVM,
# banco 00416968 no ESTBAN). Ausente do ESTBAN → sem rede reportada.
BANCOS_CVM = [
    {"id": "banpara", "cnpj": "04913711000108", "nome": "Banco Do Estado Do Para S.A.",
     "cnpj8_rede": "04913711", "cod_ifdata": "04913711"},
    {"id": "daycoval", "cnpj": "62232889000190", "nome": "Banco Daycoval S.A.",
     "cnpj8_rede": "62232889", "cod_ifdata": "C0051987"},
    {"id": "parana", "cnpj": "14388334000199", "nome": "Parana Banco S.A.",
     "cnpj8_rede": "14388334", "cod_ifdata": "C0030881"},
    {"id": "rci", "cnpj": "62307848000115", "nome": "Banco Rci Brasil S.A.",
     "cnpj8_rede": None, "cod_ifdata": None},
    {"id": "bemge", "cnpj": "01548981000179", "nome": "Investimentos Bemge S.A.",
     "cnpj8_rede": None, "cod_ifdata": None},
    {"id": "mercfin", "cnpj": "33040601000187",
     "nome": "Mercantil Financeira S.A. - Soc. Credito, Financ e Inv",
     "cnpj8_rede": None, "cod_ifdata": None},
    {"id": "pan", "cnpj": "59285411000113", "nome": "Banco Pan S.A.",
     "cnpj8_rede": "59285411", "cod_ifdata": None},
    # Inter & Co já aparecia no painel pela rede do ESTBAN e pelos clientes da
    # SEC; o registro na CVM (holding, CNPJ próprio) traz empregados e auditor.
    {"id": "inter", "cnpj": "42737954000121", "nome": "Inter & Co, Inc. (Banco Inter)",
     "cnpj8_rede": "00416968", "cod_ifdata": "C0051884"},
]

SETOR_BANCOS = "Bancos"

# Registros de CVM que pertencem a instituição JÁ coberta por outro CNPJ
# (holding e banco operacional registrados separadamente). Servem apenas à
# contabilidade de cobertura — não entram em CNPJ_CVM, para que as linhas de
# FRE de uma entidade nunca sobrescrevam as da outra sob o mesmo id.
CNPJ_ALIAS = {
    "00.416.968/0001-01": "inter",    # Banco Inter S.A., operacional da holding Inter & Co
    "24.410.913/0001-44": "nubank",   # Nu Holdings Ltd., registro brasileiro do grupo
}

# CNPJs formatados (chave dos CSVs da CVM) → identificador da instituição.
CNPJ_CVM = {_fmt_cnpj(c["cnpj"]): c["company_id"] for c in COMPANIES}
CNPJ_CVM.update({_fmt_cnpj(b["cnpj"]): b["id"] for b in BANCOS_CVM})

# Assinatura do conjunto de instituições cobertas. Ela entra na chave de
# coleta: zip de ano fechado não é rebaixado enquanto o cadastro for o mesmo,
# mas basta incluir uma instituição para que todos os anos sejam reabsorvidos
# uma vez — do contrário a nova instituição nasceria com um único ano de
# série, e a diferença ficaria invisível.
CADASTRO_SHA = hashlib.sha256(
    "|".join(sorted(CNPJ_CVM)).encode("utf-8")).hexdigest()[:8]


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS oper_empregados(
        company_id TEXT, ano_zip INTEGER, data_ref TEXT, versao INTEGER,
        lideranca INTEGER, nao_lideranca INTEGER, total INTEGER, regioes TEXT,
        PRIMARY KEY(company_id, ano_zip));
    CREATE TABLE IF NOT EXISTS oper_auditores(
        company_id TEXT, ano_zip INTEGER, auditor TEXT, cnpj_auditor TEXT,
        inicio TEXT, fim TEXT,
        PRIMARY KEY(company_id, ano_zip, cnpj_auditor, inicio));
    CREATE TABLE IF NOT EXISTS oper_rede(
        data_base TEXT, cnpj8 TEXT, nome TEXT, agencias INTEGER, municipios INTEGER,
        PRIMARY KEY(data_base, cnpj8));
    CREATE TABLE IF NOT EXISTS oper_rede_total(
        data_base TEXT PRIMARY KEY, agencias INTEGER, municipios INTEGER, bancos INTEGER);
    CREATE TABLE IF NOT EXISTS oper_coleta(
        chave TEXT PRIMARY KEY, coletado_em TEXT, sha TEXT, detalhe TEXT);
    CREATE TABLE IF NOT EXISTS oper_cadastro_cvm(
        cnpj TEXT PRIMARY KEY, ano_zip INTEGER, nome TEXT, setor TEXT,
        categoria TEXT, situacao_registro TEXT, situacao_emissor TEXT);
    """)


def _num(v):
    v = str(v or "").strip()
    return int(float(v)) if v.replace(".", "").replace("-", "").isdigit() else 0


def _le_csv_do_zip(body, sufixo):
    zf = zipfile.ZipFile(io.BytesIO(body))
    nome = next((n for n in zf.namelist() if n.endswith(sufixo)), None)
    if not nome:
        return None
    raw = zf.read(nome).decode("latin-1")
    return list(csv.DictReader(io.StringIO(raw), delimiter=";"))


REGIOES = ["Norte", "Nordeste", "Centro_Oeste", "Sudeste", "Sul", "Exterior"]


def _absorve_fre(con, ano, body, sha):
    """Empregados por posição e região; fica a MAIOR versão de cada companhia."""
    linhas = _le_csv_do_zip(body, f"fre_cia_aberta_empregado_posicao_local_{ano}.csv")
    if linhas is None:
        return {"empregados": 0, "aviso": "tabela de empregados ausente no zip"}
    melhor = {}
    for l in linhas:
        cid = CNPJ_CVM.get((l.get("CNPJ_Companhia") or "").strip())
        if not cid:
            continue
        versao = _num(l.get("Versao"))
        reg = melhor.setdefault(cid, {"versao": -1})
        if versao > reg["versao"]:
            melhor[cid] = {"versao": versao, "data_ref": (l.get("Data_Referencia") or "").strip(),
                           "linhas": []}
        if versao == melhor[cid]["versao"]:
            melhor[cid]["linhas"].append(l)
    n = 0
    for cid, reg in melhor.items():
        lid = nao = 0
        regioes = {r: 0 for r in REGIOES}
        for l in reg["linhas"]:
            soma = sum(_num(l.get(f"Quantidade_{r}")) for r in REGIOES)
            for r in REGIOES:
                regioes[r] += _num(l.get(f"Quantidade_{r}"))
            posicao = (l.get("Posicao") or "").strip().lower()
            if posicao.startswith("lider"):
                lid += soma
            else:
                nao += soma
        con.execute("INSERT OR REPLACE INTO oper_empregados VALUES(?,?,?,?,?,?,?,?)",
                    (cid, ano, reg["data_ref"], reg["versao"], lid, nao, lid + nao,
                     json.dumps(regioes, ensure_ascii=False)))
        n += 1
    common.record_lineage(con, "operacional.json", f"fre_cia_aberta_{ano}.zip", sha,
                          "FRE empregado_posicao_local -> oper_empregados (maior versão por companhia)")
    return {"empregados": n}


def _absorve_cadastro(con, ano, body):
    """Cadastro de TODAS as companhias do FCA, com o setor de atividade que a
    própria CVM atribui. Guardar o universo inteiro (e não só as instituições
    do painel) é o que permite publicar, depois, quais bancos com registro
    ativo ainda estão fora da cobertura — lacuna visível em vez de silenciosa."""
    linhas = _le_csv_do_zip(body, f"fca_cia_aberta_geral_{ano}.csv")
    if linhas is None:
        return 0
    melhor = {}
    for l in linhas:
        cnpj = (l.get("CNPJ_Companhia") or "").strip()
        if not cnpj:
            continue
        v = _num(l.get("Versao"))
        if cnpj not in melhor or v >= melhor[cnpj][0]:
            melhor[cnpj] = (v, l)
    for cnpj, (_, l) in melhor.items():
        con.execute("INSERT OR REPLACE INTO oper_cadastro_cvm VALUES(?,?,?,?,?,?,?)",
                    (cnpj, ano, (l.get("Nome_Empresarial") or "").strip(),
                     (l.get("Setor_Atividade") or "").strip(),
                     (l.get("Categoria_Registro_CVM") or "").strip(),
                     (l.get("Situacao_Registro_CVM") or "").strip(),
                     (l.get("Situacao_Emissor") or "").strip()))
    return len(melhor)


def _absorve_fca(con, ano, body, sha):
    cadastradas = _absorve_cadastro(con, ano, body)
    linhas = _le_csv_do_zip(body, f"fca_cia_aberta_auditor_{ano}.csv")
    if linhas is None:
        return {"auditores": 0, "cadastro": cadastradas, "aviso": "tabela de auditores ausente no zip"}
    melhor_versao = {}
    for l in linhas:
        cid = CNPJ_CVM.get((l.get("CNPJ_Companhia") or "").strip())
        if cid:
            melhor_versao[cid] = max(melhor_versao.get(cid, -1), _num(l.get("Versao")))
    n = 0
    for l in linhas:
        cid = CNPJ_CVM.get((l.get("CNPJ_Companhia") or "").strip())
        if not cid or _num(l.get("Versao")) != melhor_versao[cid]:
            continue
        con.execute("INSERT OR REPLACE INTO oper_auditores VALUES(?,?,?,?,?,?)",
                    (cid, ano, (l.get("Auditor") or "").strip(),
                     (l.get("CPF_CNPJ_Auditor") or "").strip(),
                     (l.get("Data_Inicio_Atuacao_Auditor") or "").strip(),
                     (l.get("Data_Fim_Atuacao_Auditor") or "").strip()))
        n += 1
    common.record_lineage(con, "operacional.json", f"fca_cia_aberta_{ano}.zip", sha,
                          "FCA auditor -> oper_auditores; FCA geral -> oper_cadastro_cvm (setor de atividade)")
    return {"auditores": n, "cadastro": cadastradas}


def _absorve_rede(con, data_base, url):
    body, meta = common.http_get(url, timeout=120, accept=None)
    _, sha = common.save_bronze("operacional", f"estban_{data_base}", body, meta)
    zf = zipfile.ZipFile(io.BytesIO(body))
    txt = zf.read(zf.namelist()[0]).decode("latin-1", errors="replace")
    linhas = txt.split("\n")
    cab = linhas[2].strip().lstrip("#").split(";")
    col = {c.strip(): i for i, c in enumerate(cab)}
    for obrig in ("CNPJ", "NOME_INSTITUICAO", "AGEN_PROCESSADAS", "CODMUN"):
        if obrig not in col:
            raise RuntimeError(f"coluna {obrig} ausente — esquema do ESTBAN mudou")
    bancos = {}
    municipios_com_agencia = set()
    for l in linhas[3:]:
        p = l.rstrip("\r").split(";")
        if len(p) < len(cab):
            continue
        ag = _num(p[col["AGEN_PROCESSADAS"]])
        cnpj8 = p[col["CNPJ"]].strip().zfill(8)
        b = bancos.setdefault(cnpj8, {"nome": p[col["NOME_INSTITUICAO"]].strip(), "ag": 0, "mun": 0})
        b["ag"] += ag
        if ag > 0:
            b["mun"] += 1
            municipios_com_agencia.add(p[col["CODMUN"]].strip())
    for cnpj8, b in bancos.items():
        con.execute("INSERT OR REPLACE INTO oper_rede VALUES(?,?,?,?,?)",
                    (data_base, cnpj8, b["nome"], b["ag"], b["mun"]))
    con.execute("INSERT OR REPLACE INTO oper_rede_total VALUES(?,?,?,?)",
                (data_base, sum(b["ag"] for b in bancos.values()),
                 len(municipios_com_agencia), sum(1 for b in bancos.values() if b["ag"] > 0)))
    common.record_lineage(con, "operacional.json", f"estban_{data_base}", sha,
                          "ESTBAN AGEN_PROCESSADAS -> oper_rede (soma nacional por CNPJ-raiz)")
    return {"bancos": len(bancos), "sha": sha}


def collect(con, cfg=None):
    _ensure(con)
    results = []
    ano_atual = datetime.now(timezone.utc).year
    ja = {r[0] for r in con.execute("SELECT chave FROM oper_coleta")}

    # FCA primeiro: além dos auditores, ele traz o cadastro com o setor de
    # atividade de cada companhia, que é a base para saber quais bancos a CVM
    # registra e quais deles o painel ainda não cobre.
    for rotulo, url_tpl, primeiro, absorve in [
        ("fca", FCA, FCA_PRIMEIRO_ANO, _absorve_fca),
        ("fre", FRE, FRE_PRIMEIRO_ANO, _absorve_fre),
    ]:
        for ano in range(primeiro, ano_atual + 1):
            chave = f"{rotulo}:{ano}:{CADASTRO_SHA}"
            # ano fechado já coletado nunca é rebaixado; o ano corrente sempre é
            if chave in ja and ano < ano_atual:
                continue
            try:
                body, meta = common.http_get(url_tpl.format(ano=ano), timeout=180, accept=None)
                _, sha = common.save_bronze("operacional", f"{rotulo}_{ano}", body, meta)
                r = absorve(con, ano, body, sha)
                con.execute("INSERT OR REPLACE INTO oper_coleta VALUES(?,?,?,?)",
                            (chave, common.now_utc(), sha, json.dumps(r, ensure_ascii=False)))
                results.append({"key": f"operacional:{chave}", "ok": True, **r})
            except Exception as e:
                # zip de ano ainda não publicado (404) não é erro de pipeline
                if "404" in str(e):
                    continue
                results.append({"key": f"operacional:{chave}", "ok": False, "error": str(e)[:200]})

    try:
        disponiveis = datas_disponiveis()
    except Exception as e:
        results.append({"key": "operacional:rede", "ok": False, "error": str(e)[:200]})
        return results
    for data_base, url in disponiveis:
        chave = f"rede:{data_base}"
        if chave in ja:
            continue
        try:
            r = _absorve_rede(con, data_base, url)
            con.execute("INSERT OR REPLACE INTO oper_coleta VALUES(?,?,?,?)",
                        (chave, common.now_utc(), r.pop("sha"), json.dumps(r, ensure_ascii=False)))
            results.append({"key": f"operacional:{chave}", "ok": True, **r})
        except Exception as e:
            results.append({"key": f"operacional:{chave}", "ok": False, "error": str(e)[:200]})
    con.commit()
    return results
