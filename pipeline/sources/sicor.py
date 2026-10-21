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
- `sicor_if`      ← SegmentoIF, últimos 17 meses, agregado a (mês, IF, programa, atividade);
- `sicor_mun`     ← municipal, últimos 16 meses, grão da fonte (município × programa × fonte × atividade);
- `sicor_produto` ← Custeio/InvestRegiaoUFProduto, últimos 16 meses
  (a janela publicada, de 12 meses fechados, termina dois meses antes do corrente, ou
  mais cedo quando o municipal atrasa; ver MESES_MUN).
Nomes de programa e subprograma vêm de ProgramaSubprogramaRegiaoUF (um mês), em
`sicor_nomes`. Cap e orçamento por execução, separados: pesados primeiro, leves depois. A primeira
carga converge em poucas execuções diárias; falha consome o cap, nunca trava num
mês quebrado.
"""
import hashlib
import json
import time as _time
from datetime import date

from pipeline import common

BASE = "https://olinda.bcb.gov.br/olinda/servico/SICOR/versao/v2/odata"
PRIMEIRO_ANO = 2013
# A janela publicada (12 meses fechados) termina 2 meses antes do corrente, e mais
# cedo quando o recorte municipal da Olinda atrasa em relação ao nacional (em
# 13/10/2026 o municipal devolvia HTTP 500 para 2026-08 e 2026-09 e servia 2026-07).
# Os dois meses extras cobrem esse atraso sem deixar a janela recuada sem dado.
MESES_IF = 17
MESES_MUN = 16
MESES_PRODUTO = 16
MESES_RECOLETA = 2       # mês corrente e anterior: parciais, sempre recoletados
CAP_PESADOS = 40         # requisições pesadas (IF, município, produto) por execução
CAP_LEVES = 200          # requisições leves (UF, fonte, faixa, gênero) por execução
# Orçamentos SEPARADOS, pesados primeiro. Até 13/10/2026 havia um orçamento único
# de 25 min, gasto antes pelos leves; depois da perda do cache em 03/10, a recarga da
# cauda histórica dos leves (2013 em diante, com HTTP 500 recorrente em meses
# antigos) consumiu o orçamento inteiro todos os dias, os pesados nunca rodaram, o
# silver ficou sem sicor_mun e o rural.json saiu sem UFs e municípios, o que
# reprovou a gold do dia nos testes de conteúdo de 04/10 em diante.
# Em 13/10/2026 o municipal falhou nos 16 meses (ver TENTATIVAS_500) e o cache
# ficou sem sicor_mun: a recarga completa custa de 35 a 90 s por mês, cerca de
# 20 min só para o municipal, além de IF e produto. Teto: a coleta inteira levou
# 131 min nesse dia contra os 150 min de run.py (ORCAMENTO_COLETA_MIN), e os
# coletores depois do Sicor seriam pulados se ele tomasse mais.
ORCAMENTO_PESADOS_S = 1500
ORCAMENTO_S = 750        # leves; a Olinda responde em segundos ou em minutos (504 aos 60 s); o resto fica para o dia seguinte

# A Olinda devolve HTTP 500 "Erro desconhecido" em cerca de 1 s, de forma
# intermitente, para consultas que no instante seguinte respondem 200 (medido em
# 13/10/2026: no mesmo mês do municipal, 2 sucessos em 8 tentativas antes de o
# servidor passar a responder do cache; um mês ainda falhou após 15 tentativas em
# 99 s, outro só passou na 8ª). Com 2 tentativas e 6 s de espera, os 16 meses do
# municipal falharam no runner e o rural.json saiu sem UFs e municípios. O 500
# rápido é retentado por até cerca de 3 min por mês; o mês que ainda falhar fica
# para o dia seguinte. Os demais erros seguem com 2 tentativas.
TENTATIVAS_500 = 30
ESPERA_500_S = 3   # somada aos 2 s de http_get e ao ~1 s da resposta: ~6 s por tentativa

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
    erros = 0
    for tentativa in range(1, TENTATIVAS_500 + 1):
        try:
            body, meta = common.http_get(url, timeout=timeout, retries=1)
            break
        except RuntimeError as e:
            if "HTTP Error 500" not in str(e):
                erros += 1
                if erros >= 2:
                    raise
            elif tentativa == TENTATIVAS_500:
                raise RuntimeError(f"{e} (após {TENTATIVAS_500} tentativas)") from e
            _time.sleep(ESPERA_500_S)
    meta["attempt"] = tentativa
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


# Recursos nacionais que precisam ser da mesma fotografia que o municipal do mês:
# o rural.json soma as UFs no municipal e o total no FonteRecursos, e o teste exige
# que fechem ao centavo. Em 14/10/2026 o municipal inteiro foi recoletado (o cache
# estava sem ele), mas o nacional de meses já "fechados" vinha de coletas anteriores;
# o BCB ainda registrava contratos nesses meses e as UFs ficaram R$ 731,8 mi acima
# do total. Coletados na mesma hora, os dois recortes fecham (2026-08: R$ 34.405.907.666,05
# nos dois, medido em 14/10/2026).
# Só o FonteRecursos: a Faixa entra numa reconciliação com tolerância de 0,5%, e na
# primeira execução depois de uma recarga do municipal o realinhamento dos 16 meses
# precisa caber no orçamento dos leves (FonteRecursos: de 1 a 62 s por mês em 14/10/2026).
ALINHADOS_AO_MUN = ("fonte",)


def _desalinhados(con):
    """(recurso, mês) do nacional coletado antes do municipal do mesmo mês, ou ausente,
    dentro da janela móvel do municipal; do mês mais recente para o mais antigo."""
    out = []
    for mes in _meses_atras(MESES_MUN):
        r = con.execute("SELECT coletado_em FROM sicor_coleta WHERE recurso='mun' AND periodo=?", (mes,)).fetchone()
        if not r:
            continue
        for recurso in ALINHADOS_AO_MUN:
            n = con.execute("SELECT coletado_em FROM sicor_coleta WHERE recurso=? AND periodo=?",
                            (recurso, mes)).fetchone()
            if not n or n[0] < r[0]:
                out.append((recurso, mes))
    return out


# Coletar na mesma hora não basta. Em 15/10/2026, na mesma execução e com o nacional
# coletado DEPOIS do municipal, o FonteRecursos de 2026-08 (16:17) veio idêntico ao
# centavo à medição de 14/10 enquanto o municipal (16:00) já somava R$ 71,06 mi a mais,
# e o municipal de 2026-06 é que veio igual ao de 14/10 (FonteRecursos R$ 9,98 mi acima).
# Em 17/10 o municipal de 2026-09 veio byte a byte igual ao de 16/10 (sha256) quatro
# minutos antes de FonteRecursos e Faixa já trazerem a fotografia nova; às 18:53 do mesmo
# dia os três fechavam ao centavo. A prova da mesma fotografia é o valor: mês do
# municipal cujo total difere do FonteRecursos em mais de TOLERANCIA_PAR_RS volta a ser
# coletado (municipal primeiro; o nacional, então anterior, é refeito por _desalinhados).
TOLERANCIA_PAR_RS = 0.05   # por mês; o teste da gold exige R$ 1 na soma dos 12 meses


def _divergentes(con):
    """Meses da janela do municipal em que municipal e FonteRecursos não fecham ao centavo."""
    out = []
    for mes in _meses_atras(MESES_MUN):
        vm = con.execute("SELECT SUM(vl_c+vl_i+vl_com+vl_ind) FROM sicor_mun WHERE mes=?", (mes,)).fetchone()[0]
        vf = con.execute("SELECT SUM(vl_c+vl_i+vl_com+vl_ind) FROM sicor_fonte WHERE mes=?", (mes,)).fetchone()[0]
        if vm is not None and vf is not None and abs(vm - vf) > TOLERANCIA_PAR_RS:
            out.append(mes)
    return out


def _resumo_erro(e, limite=300):
    """Mensagem curta que preserva a causa: a URL da Olinda tem mais de 300
    caracteres e, cortada pelo começo, escondia o "HTTP Error 500" no log."""
    msg = str(e)
    if len(msg) <= limite:
        return msg
    return msg[:100] + " [...] " + msg[-(limite - 107):]


def collect(con, cfg):
    _ensure(con)
    results = []

    def _executa(recurso, fn, mes, lineage):
        key = f"sicor_{recurso}:{mes}"
        try:
            n, meta = fn(con, mes)
            _registra(con, recurso, mes, n)
            common.record_lineage(con, lineage, meta.get("url", ""), meta.get("sha256", "-"), key)
            con.commit()
            results.append({"key": key, "ok": True, "rows": n})
        except Exception as e:
            con.rollback()
            results.append({"key": key, "ok": False, "error": _resumo_erro(e)})

    # 1) pesados, com orçamento próprio: são a janela publicada (UFs, municípios,
    # instituições, produtos) e nunca podem esperar a cauda histórica dos leves.
    # Município primeiro: é o recorte que fecha com o universo nacional.
    t0 = _time.monotonic()
    pesados = [("mun", _coleta_mun, MESES_MUN), ("if", _coleta_if, MESES_IF), ("produto", _coleta_produto, MESES_PRODUTO)]
    gasto = 0
    divergentes = set(_divergentes(con))
    for recurso, fn, n_meses in pesados:
        for mes in _meses_atras(n_meses):
            if gasto >= CAP_PESADOS or _time.monotonic() - t0 > ORCAMENTO_PESADOS_S:
                break
            if _ja_coletado(con, recurso, mes) and not (recurso == "mun" and mes in divergentes):
                continue
            gasto += 1
            _executa(recurso, fn, mes, "rural_mun.json" if recurso == "mun" else "rural.json")

    # 2) leves, mês-maior e recurso-menor: os meses recentes primeiro. Na ordem
    # antiga (recurso-maior) o gênero só era coletado depois de UF, fonte e faixa
    # esgotarem a história, e o runner publicou rural.json com gênero zerado em 07/09/2026.
    t0 = _time.monotonic()
    leves = [("uf", _coleta_uf), ("fonte", _coleta_fonte), ("faixa", _coleta_faixa), ("genero", _coleta_genero)]
    gasto_leve = 0
    # o nacional de cada mês do municipal é recoletado se for de fotografia anterior
    # à dele, antes de qualquer outro leve (ver ALINHADOS_AO_MUN)
    fn_leve = dict(leves)
    for recurso, mes in _desalinhados(con):
        if gasto_leve >= CAP_LEVES or _time.monotonic() - t0 > ORCAMENTO_S:
            break
        gasto_leve += 1
        _executa(recurso, fn_leve[recurso], mes, "rural.json")
    for mes in _meses_historia():
        for recurso, fn in leves:
            if gasto_leve >= CAP_LEVES or _time.monotonic() - t0 > ORCAMENTO_S:
                break
            if _ja_coletado(con, recurso, mes):
                continue
            gasto_leve += 1
            _executa(recurso, fn, mes, "rural.json")
    # nomes de programa/subprograma: do mês anterior (mais completo que o corrente)
    try:
        n, _ = _coleta_nomes(con, _meses_atras(2)[1])
        con.commit()
        results.append({"key": "sicor_nomes", "ok": True, "rows": n})
    except Exception as e:
        con.rollback()
        results.append({"key": "sicor_nomes", "ok": False, "error": str(e)[:300]})
    return results
