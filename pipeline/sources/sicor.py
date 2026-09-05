"""Matriz de Dados do Crédito Rural (MDCR/Sicor) — BCB, dados abertos (ODbL).

Fonte: https://olinda.bcb.gov.br/olinda/servico/SICOR/versao/v2/odata/ (OData 4),
catálogo em https://dadosabertos.bcb.gov.br/dataset/matrizdadoscreditorural.
Contratações de crédito rural registradas no Sicor, agregadas pelo próprio BCB
por mês de emissão e por dimensão (UF, município, programa, fonte de recursos,
faixa de valor, gênero, instituição, produto). Mensal desde 2013.

O que foi medido na API em 05/09/2026, e que sustenta as decisões abaixo:
- `$filter` por AnoEmissao/MesEmissao, `$select` e `$orderby` funcionam;
  `$apply` (agregação no servidor) e `$count` não (o segundo devolve 403).
  Toda agregação é feita aqui, no silver.
- Um mês de RegiaoUF tem ~1,5 mil linhas e responde em 2 s; SegmentoIF ~3,6 mil
  em 29 s; o municipal (CusteioInvestimentoComercialIndustrialSemFiltros) ~35 mil
  linhas, 11 MB, 37 s; os dois recursos de produto por UF ~10 mil linhas, 22 s.
  Não há paginação: a resposta vem inteira.
- O mês corrente e o anterior são PARCIAIS: contratos entram no Sicor com
  atraso e o BCB republica. Por isso os dois últimos meses são recoletados a
  cada execução (REPLACE) e só meses mais antigos são tratados como fechados.

Escopo por recurso (a história inteira onde é leve; janela móvel onde é pesado).
Toda requisição é por MÊS: a consulta por ano devolve 504 (tempo de servidor) em
FonteRecursos e RegiaoUFGenero e trava em anos cheios de RegiaoUF (medido em
05/09/2026); por mês, cada uma responde em segundos.
- `sicor_uf`      ← RegiaoUF, todos os meses desde 2013;
- `sicor_fonte`   ← FonteRecursos (nacional), todos os meses;
- `sicor_faixa`   ← Faixa (nacional, 13 faixas de valor), todos os meses;
- `sicor_genero`  ← RegiaoUFGenero, todos os meses, agregado a (mês, UF, sexo, atividade);
- `sicor_if`      ← SegmentoIF, últimos 13 meses, agregado a (mês, IF, programa, atividade);
- `sicor_mun`     ← municipal, últimos 12 meses, grão da fonte (município × programa × fonte × atividade);
- `sicor_produto` ← Custeio/InvestRegiaoUFProduto, últimos 12 meses.
Nomes de programa e subprograma vêm de ProgramaSubprogramaRegiaoUF (um mês), em
`sicor_nomes`. Cap por execução nos recursos pesados: a primeira carga converge
em poucas execuções diárias; falha consome o cap, nunca trava num mês quebrado.
"""
import hashlib
import json
from datetime import date

from pipeline import common

BASE = "https://olinda.bcb.gov.br/olinda/servico/SICOR/versao/v2/odata"
PRIMEIRO_ANO = 2013
MESES_IF = 13
MESES_MUN = 12
MESES_PRODUTO = 12
MESES_RECOLETA = 2       # mês corrente e anterior: parciais, sempre recoletados
CAP_PESADOS = 40         # requisições pesadas (IF, município, produto) por execução
CAP_LEVES = 200          # requisições leves (UF, fonte, faixa, gênero) por execução

VALORES = ("QtdCusteio", "VlCusteio", "QtdInvestimento", "VlInvestimento",
           "QtdComercializacao", "VlComercializacao", "QtdIndustrializacao", "VlIndustrializacao")


def _ensure(con):
    con.executescript("""
        CREATE TABLE IF NOT EXISTS sicor_uf(
            mes TEXT, uf TEXT, programa TEXT, subprograma TEXT, fonte TEXT, atividade TEXT,
            qtd_c INTEGER, vl_c REAL, qtd_i INTEGER, vl_i REAL, qtd_com INTEGER, vl_com REAL,
            qtd_ind INTEGER, vl_ind REAL,
            PRIMARY KEY(mes, uf, programa, subprograma, fonte, atividade));
        CREATE TABLE IF NOT EXISTS sicor_fonte(
            mes TEXT, fonte_nome TEXT, programa TEXT, subprograma TEXT, atividade TEXT,
            qtd_c INTEGER, vl_c REAL, qtd_i INTEGER, vl_i REAL, qtd_com INTEGER, vl_com REAL,
            qtd_ind INTEGER, vl_ind REAL,
            PRIMARY KEY(mes, fonte_nome, programa, subprograma, atividade));
        CREATE TABLE IF NOT EXISTS sicor_faixa(
            mes TEXT, idx INTEGER, faixa TEXT, qtd INTEGER, valor REAL, valor_medio REAL,
            PRIMARY KEY(mes, idx));
        CREATE TABLE IF NOT EXISTS sicor_genero(
            mes TEXT, uf TEXT, sexo TEXT, atividade TEXT,
            qtd_c INTEGER, vl_c REAL, qtd_i INTEGER, vl_i REAL, qtd_com INTEGER, vl_com REAL,
            qtd_ind INTEGER, vl_ind REAL, area_c REAL, area_i REAL,
            PRIMARY KEY(mes, uf, sexo, atividade));
        CREATE TABLE IF NOT EXISTS sicor_if(
            mes TEXT, cnpj TEXT, nome TEXT, segmento TEXT, categoria TEXT, programa TEXT, atividade TEXT,
            qtd_c INTEGER, vl_c REAL, qtd_i INTEGER, vl_i REAL, qtd_com INTEGER, vl_com REAL,
            qtd_ind INTEGER, vl_ind REAL,
            PRIMARY KEY(mes, cnpj, programa, atividade));
        CREATE TABLE IF NOT EXISTS sicor_mun(
            mes TEXT, cod_ibge TEXT, programa TEXT, fonte TEXT, atividade TEXT,
            qtd_c INTEGER, vl_c REAL, qtd_i INTEGER, vl_i REAL, qtd_com INTEGER, vl_com REAL,
            qtd_ind INTEGER, vl_ind REAL, area_c REAL, area_i REAL,
            PRIMARY KEY(mes, cod_ibge, programa, fonte, atividade));
        CREATE TABLE IF NOT EXISTS sicor_produto(
            mes TEXT, uf TEXT, finalidade TEXT, produto TEXT, atividade TEXT,
            qtd INTEGER, valor REAL, area REAL,
            PRIMARY KEY(mes, uf, finalidade, produto, atividade));
        CREATE TABLE IF NOT EXISTS sicor_nomes(tipo TEXT, cd TEXT, nome TEXT, PRIMARY KEY(tipo, cd));
        CREATE TABLE IF NOT EXISTS sicor_coleta(
            recurso TEXT, periodo TEXT, coletado_em TEXT, linhas INTEGER, fechado INTEGER,
            PRIMARY KEY(recurso, periodo));
    """)


def _num(v):
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def _get(recurso, filtro, select=None, timeout=600):
    url = f"{BASE}/{recurso}?$filter={filtro}&$format=json"
    if select:
        url += "&$select=" + ",".join(select)
    url = url.replace(" ", "%20").replace("'", "%27")
    body, meta = common.http_get(url, timeout=timeout, retries=2)
    meta["sha256"] = hashlib.sha256(body).hexdigest()
    return json.loads(body.decode("utf-8")).get("value", []), meta


def _mes(row):
    return f"{row['AnoEmissao']}-{str(row['MesEmissao']).zfill(2)}"


def _filtro_mes(mes):
    ano, m = mes.split("-")
    return f"AnoEmissao eq '{ano}' and MesEmissao eq '{m}'"


def _meses_atras(n):
    """Últimos n meses-calendário, do mais recente para o mais antigo (inclui o corrente)."""
    hoje = date.today()
    out = []
    y, m = hoje.year, hoje.month
    for _ in range(n):
        out.append(f"{y}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return out


def _fechado(mes):
    """Mês já imutável: fora da janela de recoleta dos dois últimos meses."""
    return mes not in _meses_atras(MESES_RECOLETA)


def _meses_historia():
    """Todos os meses de PRIMEIRO_ANO até o corrente, do mais recente para o mais antigo:
    o painel ganha os dados recentes primeiro, e a cauda converge nas execuções seguintes."""
    hoje = date.today()
    out = []
    y, m = hoje.year, hoje.month
    while y >= PRIMEIRO_ANO:
        out.append(f"{y}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return out


def _ja_coletado(con, recurso, periodo):
    r = con.execute("SELECT fechado FROM sicor_coleta WHERE recurso=? AND periodo=?",
                    (recurso, periodo)).fetchone()
    return bool(r and r[0])


def _registra(con, recurso, periodo, linhas):
    con.execute("INSERT OR REPLACE INTO sicor_coleta VALUES(?,?,?,?,?)",
                (recurso, periodo, common.now_utc(), linhas, 1 if _fechado(periodo) else 0))


def _vals(r):
    return [int(_num(r.get("QtdCusteio"))), _num(r.get("VlCusteio")),
            int(_num(r.get("QtdInvestimento"))), _num(r.get("VlInvestimento")),
            int(_num(r.get("QtdComercializacao"))), _num(r.get("VlComercializacao")),
            int(_num(r.get("QtdIndustrializacao"))), _num(r.get("VlIndustrializacao"))]


def _soma(acc, key, vals):
    cur = acc.get(key)
    if cur is None:
        acc[key] = list(vals)
    else:
        for i, v in enumerate(vals):
            cur[i] += v


# ---------------------------------------------------------------------------
# recursos leves: história inteira, uma requisição por mês
# ---------------------------------------------------------------------------
def _coleta_uf(con, mes):
    rows, meta = _get("RegiaoUF", _filtro_mes(mes))
    con.execute("DELETE FROM sicor_uf WHERE mes=?", (mes,))
    con.executemany(
        "INSERT OR REPLACE INTO sicor_uf VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [[_mes(r), r.get("nomeUF"), r.get("cdPrograma"), r.get("cdSubPrograma"),
          r.get("cdFonteRecurso"), r.get("Atividade")] + _vals(r) for r in rows])
    return len(rows), meta


def _coleta_fonte(con, mes):
    rows, meta = _get("FonteRecursos", _filtro_mes(mes))
    con.execute("DELETE FROM sicor_fonte WHERE mes=?", (mes,))
    acc = {}
    for r in rows:
        _soma(acc, (_mes(r), r.get("nomeFonteRecurso"), r.get("cdPrograma"), r.get("cdSubPrograma"), r.get("Atividade")), _vals(r))
    con.executemany("INSERT OR REPLACE INTO sicor_fonte VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    [list(k) + v for k, v in acc.items()])
    return len(rows), meta


def _coleta_faixa(con, mes):
    rows, meta = _get("Faixa", _filtro_mes(mes))
    con.execute("DELETE FROM sicor_faixa WHERE mes=?", (mes,))
    con.executemany("INSERT OR REPLACE INTO sicor_faixa VALUES(?,?,?,?,?,?)",
                    [[_mes(r), int(r["idx"]), str(r.get("faixa") or "").strip('"'),
                      int(_num(r.get("Quantidade"))), _num(r.get("Valor")), _num(r.get("ValorMedio"))] for r in rows])
    return len(rows), meta


def _coleta_genero(con, mes):
    rows, meta = _get("RegiaoUFGenero", _filtro_mes(mes))
    con.execute("DELETE FROM sicor_genero WHERE mes=?", (mes,))
    acc = {}
    for r in rows:
        _soma(acc, (_mes(r), r.get("nomeUF"), r.get("cdSexo"), r.get("Atividade")),
              _vals(r) + [_num(r.get("AreaCusteio")), _num(r.get("AreaInvestimento"))])
    con.executemany("INSERT OR REPLACE INTO sicor_genero VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    [list(k) + v for k, v in acc.items()])
    return len(rows), meta


# ---------------------------------------------------------------------------
# recursos pesados: janela móvel, uma requisição por mês
# ---------------------------------------------------------------------------
def _coleta_if(con, mes):
    rows, meta = _get("SegmentoIF", _filtro_mes(mes))
    con.execute("DELETE FROM sicor_if WHERE mes=?", (mes,))
    acc, nomes = {}, {}
    for r in rows:
        k = (mes, r.get("Cnpj"), r.get("cdPrograma"), r.get("Atividade"))
        nomes[r.get("Cnpj")] = (r.get("nomeIF"), r.get("Segmento"), r.get("Categoria"))
        _soma(acc, k, _vals(r))
    con.executemany("INSERT OR REPLACE INTO sicor_if VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    [[k[0], k[1], nomes[k[1]][0], nomes[k[1]][1], nomes[k[1]][2], k[2], k[3]] + v
                     for k, v in acc.items()])
    return len(rows), meta


SELECT_MUN = ["codMunicIbge", "cdPrograma", "cdFonteRecurso", "Atividade", "QtdCusteio", "VlCusteio",
              "QtdInvestimento", "VlInvestimento", "QtdComercializacao", "VlComercializacao",
              "QtdIndustrializacao", "VlIndustrializacao", "AreaCusteio", "AreaInvestimento"]


def _coleta_mun(con, mes):
    rows, meta = _get("CusteioInvestimentoComercialIndustrialSemFiltros", _filtro_mes(mes), SELECT_MUN, timeout=900)
    con.execute("DELETE FROM sicor_mun WHERE mes=?", (mes,))
    acc = {}
    for r in rows:
        cod = str(r.get("codMunicIbge") or "").strip()
        if len(cod) != 7:
            continue  # sem código IBGE válido: fica fora, contado pela diferença de linhas
        _soma(acc, (mes, cod, r.get("cdPrograma"), r.get("cdFonteRecurso"), r.get("Atividade")),
              _vals(r) + [_num(r.get("AreaCusteio")), _num(r.get("AreaInvestimento"))])
    con.executemany("INSERT OR REPLACE INTO sicor_mun VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    [list(k) + v for k, v in acc.items()])
    return len(rows), meta


def _coleta_produto(con, mes):
    total = 0
    con.execute("DELETE FROM sicor_produto WHERE mes=?", (mes,))
    acc = {}
    rows, meta = _get("CusteioRegiaoUFProduto", _filtro_mes(mes))
    total += len(rows)
    for r in rows:
        _soma(acc, (mes, r.get("nomeUF"), "custeio", (r.get("nomeProduto") or "").strip(), r.get("Atividade")),
              [int(_num(r.get("QtdCusteio"))), _num(r.get("VlCusteio")), _num(r.get("AreaCusteio"))])
    rows, meta2 = _get("InvestRegiaoUFProduto", _filtro_mes(mes))
    total += len(rows)
    for r in rows:
        _soma(acc, (mes, r.get("nomeUF"), "investimento", (r.get("nomeProduto") or "").strip(), r.get("Atividade")),
              [int(_num(r.get("QtdInvest"))), _num(r.get("VlInvest")), 0.0])
    con.executemany("INSERT OR REPLACE INTO sicor_produto VALUES(?,?,?,?,?,?,?,?)",
                    [list(k) + v for k, v in acc.items()])
    return total, meta


def _coleta_nomes(con, mes):
    rows, meta = _get("ProgramaSubprogramaRegiaoUF", _filtro_mes(mes))
    for r in rows:
        if r.get("cdPrograma") and r.get("nomePrograma"):
            con.execute("INSERT OR REPLACE INTO sicor_nomes VALUES('programa',?,?)",
                        (r["cdPrograma"], r["nomePrograma"].strip()))
        if r.get("cdSubPrograma") and r.get("nomeSubPrograma"):
            con.execute("INSERT OR REPLACE INTO sicor_nomes VALUES('subprograma',?,?)",
                        (r["cdSubPrograma"], r["nomeSubPrograma"].strip()))
    return len(rows), meta


def collect(con, cfg):
    _ensure(con)
    results = []
    leves = [("uf", _coleta_uf), ("fonte", _coleta_fonte), ("faixa", _coleta_faixa), ("genero", _coleta_genero)]
    gasto_leve = 0
    for recurso, fn in leves:
        for mes in _meses_historia():
            if gasto_leve >= CAP_LEVES:
                break
            key = f"sicor_{recurso}:{mes}"
            if _ja_coletado(con, recurso, mes):
                continue
            gasto_leve += 1
            try:
                n, meta = fn(con, mes)
                _registra(con, recurso, mes, n)
                common.record_lineage(con, "rural.json", meta.get("url", ""), meta.get("sha256", "-"), key)
                con.commit()
                results.append({"key": key, "ok": True, "rows": n})
            except Exception as e:
                con.rollback()
                results.append({"key": key, "ok": False, "error": str(e)[:300]})
    pesados = [("if", _coleta_if, MESES_IF), ("mun", _coleta_mun, MESES_MUN), ("produto", _coleta_produto, MESES_PRODUTO)]
    gasto = 0
    for recurso, fn, n_meses in pesados:
        for mes in _meses_atras(n_meses):
            if gasto >= CAP_PESADOS:
                break
            key = f"sicor_{recurso}:{mes}"
            if _ja_coletado(con, recurso, mes):
                continue
            gasto += 1
            try:
                n, meta = fn(con, mes)
                _registra(con, recurso, mes, n)
                common.record_lineage(con, "rural_mun.json" if recurso == "mun" else "rural.json",
                                      meta.get("url", ""), meta.get("sha256", "-"), key)
                con.commit()
                results.append({"key": key, "ok": True, "rows": n})
            except Exception as e:
                con.rollback()
                results.append({"key": key, "ok": False, "error": str(e)[:300]})
    # nomes de programa/subprograma: do mês anterior (mais completo que o corrente)
    try:
        n, _ = _coleta_nomes(con, _meses_atras(2)[1])
        con.commit()
        results.append({"key": "sicor_nomes", "ok": True, "rows": n})
    except Exception as e:
        con.rollback()
        results.append({"key": "sicor_nomes", "ok": False, "error": str(e)[:300]})
    return results
