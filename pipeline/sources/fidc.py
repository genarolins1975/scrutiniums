"""Conector CVM — informes mensais de FIDC (crédito não bancário).

Fonte: dados.cvm.gov.br/dados/FIDC/DOC/INF_MENSAL/DADOS/inf_mensal_fidc_AAAAMM.zip
(~3,5 MB/mês). Do zip se lêem quatro tabelas, sempre agregadas entre fundos:

- tab_I  (carteira): carteira, créditos a vencer adimplentes (I.2.a.1), a vencer com
  parcelas inadimplentes (I.2.a.2) e créditos inadimplentes (I.2.a.3), separados por
  aquisição substancial de riscos (A) ou não (B). Agregado mensal do sistema em `fidc_agg`.
- tab_II (lastro): carteira por segmento do direito creditório (industrial, imobiliário,
  comercial, serviços, agronegócio, financeiro com oito subitens, cartão de crédito,
  factoring, setor público, ações judiciais, marcas). Uma linha por categoria e mês em
  `fidc_lastro`. Nem todo fundo preenche a tabela: a cobertura (fundos e carteira da tab I
  que eles somam) fica em `fidc_detalhe`.
- tab_X_2 (cotas): quantidade e valor da cota por classe e série. Sênior, mezanino e
  subordinada são lidas do texto da classe; o PL por classe é quantidade × valor. Só entram
  fundos cuja soma das classes fecha com o PL da tab_IV em ±20%: a tabela traz erros
  grosseiros de unidade em poucos fundos (um mezanino de R$ 30 trilhões em 2026-07), e
  um fundo errado não pode contaminar o sistema. Fundo com UMA só classe não tem
  subordinação, seja qual for o rótulo: em 2025-12 a CVM renomeou 670 fundos de classe
  única de "Subordinada" para "Senior", o que derrubaria a subordinação do sistema em 20
  pontos sem nenhuma mudança real. Por isso a abertura por classe só soma fundos com duas
  ou mais classes; os de classe única entram numa linha própria ("monoclasse").
- tab_VI (prazos): direitos creditórios a vencer por faixa de prazo e parcelas
  inadimplentes por faixa de atraso. Cobertura menor (cerca de um quarto dos fundos).

Percentuais calculados no gold. Não se infere perda a partir de atraso: subordinação e
garantias variam por estrutura (nota no gold). Idempotente por mês: o mês só é baixado
quando falta em `fidc_agg` ou quando falta o detalhe (backfill dos meses já agregados).
"""
import csv
import io

csv.field_size_limit(10_000_000)  # listas de cedentes estouram o limite padrão de 128 KB
import zipfile
from datetime import date

from pipeline import common

URL = "https://dados.cvm.gov.br/dados/FIDC/DOC/INF_MENSAL/DADOS/inf_mensal_fidc_{am}.zip"
MESES_HISTORICO = 18
# tolerância entre a soma das classes (tab X.2) e o PL (tab IV) para o fundo entrar na abertura por classe
TOLERANCIA_PL = 0.20

# categorias da tabela II, na ordem e com os nomes do dicionário da CVM (meta_inf_mensal_fidc_tab_II)
LASTRO = [
    ("A", "TAB_II_A_VL_INDUST", "Industrial", None),
    ("B", "TAB_II_B_VL_IMOBIL", "Mercado imobiliário (não financeiro)", None),
    ("C", "TAB_II_C_VL_COMERC", "Comercial", None),
    ("C1", "TAB_II_C1_VL_COMERC", "Comercial", "C"),
    ("C2", "TAB_II_C2_VL_VAREJO", "Comercial: varejo", "C"),
    ("C3", "TAB_II_C3_VL_ARREND", "Arrendamento mercantil", "C"),
    ("D", "TAB_II_D_VL_SERV", "Serviços", None),
    ("D1", "TAB_II_D1_VL_SERV", "Serviços", "D"),
    ("D2", "TAB_II_D2_VL_SERV_PUBLICO", "Serviços públicos (eletricidade, telefonia, transporte, saneamento)", "D"),
    ("D3", "TAB_II_D3_VL_SERV_EDUC", "Serviços educacionais", "D"),
    ("D4", "TAB_II_D4_VL_ENTRET", "Entretenimento", "D"),
    ("E", "TAB_II_E_VL_AGRONEG", "Agronegócio", None),
    ("F", "TAB_II_F_VL_FINANC", "Financeiro", None),
    ("F1", "TAB_II_F1_VL_CRED_PESSOA", "Crédito pessoal", "F"),
    ("F2", "TAB_II_F2_VL_CRED_PESSOA_CONSIG", "Crédito pessoal consignado", "F"),
    ("F3", "TAB_II_F3_VL_CRED_CORP", "Crédito corporativo", "F"),
    ("F4", "TAB_II_F4_VL_MIDMARKET", "Middle market", "F"),
    ("F5", "TAB_II_F5_VL_VEICULO", "Veículos", "F"),
    ("F6", "TAB_II_F6_VL_IMOBIL_EMPRESA", "Imobiliário empresarial", "F"),
    ("F7", "TAB_II_F7_VL_IMOBIL_RESID", "Imobiliário residencial", "F"),
    ("F8", "TAB_II_F8_VL_OUTRO", "Outros financeiros", "F"),
    ("G", "TAB_II_G_VL_CREDITO", "Cartão de crédito", None),
    ("H", "TAB_II_H_VL_FACTOR", "Factoring", None),
    ("H1", "TAB_II_H1_VL_PESSOA", "Factoring: pessoal", "H"),
    ("H2", "TAB_II_H2_VL_CORP", "Factoring: corporativo", "H"),
    ("I", "TAB_II_I_VL_SETOR_PUBLICO", "Setor público", None),
    ("I1", "TAB_II_I1_VL_PRECAT", "Precatórios", "I"),
    ("I2", "TAB_II_I2_VL_TRIBUT", "Créditos tributários", "I"),
    ("I3", "TAB_II_I3_VL_ROYALTIES", "Royalties", "I"),
    ("I4", "TAB_II_I4_VL_OUTRO", "Setor público: outros", "I"),
    ("J", "TAB_II_J_VL_JUDICIAL", "Ações judiciais", None),
    ("K", "TAB_II_K_VL_MARCA", "Propriedade intelectual, marcas e patentes", None),
]
# faixas da tabela VI (a vencer e inadimplentes), em dias
PRAZOS = [("30", 30), ("60", 60), ("90", 90), ("120", 120), ("150", 150), ("180", 180), ("360", 360), ("720", 720), ("1080", 1080), ("MAIOR_1080", None)]


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS fidc_agg(
        anomes TEXT PRIMARY KEY, n_fundos INTEGER, carteira REAL,
        venc_inad REAL, venc_ad REAL, collected_at TEXT);
    CREATE TABLE IF NOT EXISTS fidc_lastro(anomes TEXT, cat TEXT, valor REAL, PRIMARY KEY(anomes, cat));
    CREATE TABLE IF NOT EXISTS fidc_classe(anomes TEXT, classe TEXT, pl REAL, n_fundos INTEGER, PRIMARY KEY(anomes, classe));
    -- classe = senior | mezanino | subordinada | unica | outra (só fundos com 2+ classes) ou monoclasse (fundos de uma classe)
    CREATE TABLE IF NOT EXISTS fidc_prazo(anomes TEXT, faixa TEXT, a_vencer REAL, inad REAL, antecipado REAL, PRIMARY KEY(anomes, faixa));
    CREATE TABLE IF NOT EXISTS fidc_detalhe(anomes TEXT PRIMARY KEY, n_fundos_tab1 INTEGER, carteira_tab1 REAL,
        n_fundos_lastro INTEGER, carteira_lastro REAL, carteira_tab1_com_lastro REAL,
        n_fundos_pl INTEGER, pl_total REAL, n_fundos_classe_ok INTEGER, pl_classe_ok REAL,
        n_fundos_prazo INTEGER, a_vencer_prazo REAL, collected_at TEXT);
    """)
    # Dicionário da CVM (meta_inf_mensal_fidc_tab_I): I.2.a.1 é "a vencer e adimplentes", I.2.a.2 é "a vencer
    # com parcelas inadimplentes" e I.2.a.3 é "créditos existentes inadimplentes". As duas primeiras já eram
    # somadas em venc_ad e venc_inad (nomes herdados, mantidos por compatibilidade); a terceira, que é a
    # inadimplência propriamente dita, entra em cred_inad. Mês com cred_inad nulo é rebaixado uma vez.
    cols = {r[1] for r in con.execute("PRAGMA table_info(fidc_agg)").fetchall()}
    if "cred_inad" not in cols:
        con.execute("ALTER TABLE fidc_agg ADD COLUMN cred_inad REAL")


def _meses(n):
    hoje = date.today()
    y, m = hoje.year, hoje.month
    out = []
    for _ in range(n):
        m -= 1
        if m == 0:
            y, m = y - 1, 12
        out.append(f"{y}{m:02d}")
    return out


def _num(row, col):
    return float((row.get(col) or "0").replace(",", ".") or 0)


def classe_de(texto):
    """Sênior, mezanino, subordinada ou única, pelo texto da classe/série da tab X.2."""
    t = (texto or "").lower()
    if "mezanino" in t:
        return "mezanino"
    if "subordinad" in t:
        return "subordinada"
    if "senior" in t or "sênior" in t:
        return "senior"
    if "unica" in t or "única" in t:
        return "unica"
    return "outra"


def _tab(zf, sufixo):
    """DictReader da tabela do zip cujo nome contém `_tab_{sufixo}_`, ou None."""
    name = next((n for n in zf.namelist() if f"_tab_{sufixo}_" in n), None)
    if not name:
        return None
    return csv.DictReader(io.TextIOWrapper(zf.open(name), encoding="latin-1"), delimiter=";")


def _agrega_tab1(zf):
    rdr = _tab(zf, "I")
    if rdr is None:
        raise ValueError("tab_I ausente")
    n_f, cart, vi, va, ci, por_fundo = 0, 0.0, 0.0, 0.0, 0.0, {}
    for row in rdr:
        c = _num(row, "TAB_I2_VL_CARTEIRA")
        if c <= 0:
            continue
        n_f += 1
        cart += c
        por_fundo[row["CNPJ_FUNDO_CLASSE"]] = c
        vi += _num(row, "TAB_I2A2_VL_CRED_VENC_INAD") + _num(row, "TAB_I2B2_VL_CRED_VENC_INAD")   # a vencer com parcelas inadimplentes
        va += _num(row, "TAB_I2A1_VL_CRED_VENC_AD") + _num(row, "TAB_I2B1_VL_CRED_VENC_AD")       # a vencer e adimplentes
        ci += _num(row, "TAB_I2A3_VL_CRED_INAD") + _num(row, "TAB_I2B3_VL_CRED_INAD")             # créditos existentes inadimplentes
    return n_f, cart, vi, va, ci, por_fundo


def _agrega_detalhe(zf, cart_por_fundo):
    """Lastro (tab II), classes (tab X.2 contra tab IV) e prazos (tab VI), agregados entre fundos."""
    # ---- lastro
    lastro = {cat: 0.0 for cat, *_ in LASTRO}
    n_lastro, cart_lastro, cart_tab1_com_lastro = 0, 0.0, 0.0
    rdr = _tab(zf, "II")
    if rdr is not None:
        for row in rdr:
            tot = _num(row, "TAB_II_VL_CARTEIRA")
            if tot <= 0:
                continue
            n_lastro += 1
            cart_lastro += tot
            cart_tab1_com_lastro += cart_por_fundo.get(row["CNPJ_FUNDO_CLASSE"], 0.0)
            for cat, col, _nome, _pai in LASTRO:
                lastro[cat] += _num(row, col)
    # ---- classes: soma por fundo e por classe, validada contra o PL
    pl = {}
    rdr = _tab(zf, "IV")
    if rdr is not None:
        for row in rdr:
            v = _num(row, "TAB_IV_A_VL_PL")
            if v > 0:
                pl[row["CNPJ_FUNDO_CLASSE"]] = v
    por_fundo_classe, por_fundo_total = {}, {}
    rdr = _tab(zf, "X_2")
    if rdr is not None:
        for row in rdr:
            f = row["CNPJ_FUNDO_CLASSE"]
            v = _num(row, "TAB_X_QT_COTA") * _num(row, "TAB_X_VL_COTA")
            if v <= 0:
                continue
            k = classe_de(row.get("TAB_X_CLASSE_SERIE"))
            por_fundo_classe.setdefault(f, {}).setdefault(k, 0.0)
            por_fundo_classe[f][k] += v
            por_fundo_total[f] = por_fundo_total.get(f, 0.0) + v
    classes, fundos_por_classe = {}, {}
    n_ok, pl_ok = 0, 0.0
    for f, tot in por_fundo_total.items():
        p = pl.get(f)
        if not p or not (1 - TOLERANCIA_PL) <= tot / p <= (1 + TOLERANCIA_PL):
            continue
        n_ok += 1
        pl_ok += p
        if len(por_fundo_classe[f]) == 1:
            classes["monoclasse"] = classes.get("monoclasse", 0.0) + tot
            fundos_por_classe["monoclasse"] = fundos_por_classe.get("monoclasse", 0) + 1
            continue
        for k, v in por_fundo_classe[f].items():
            classes[k] = classes.get(k, 0.0) + v
            fundos_por_classe[k] = fundos_por_classe.get(k, 0) + 1
    # ---- prazos
    prazos = {faixa: [0.0, 0.0, 0.0] for faixa, _ in PRAZOS}
    n_prazo, a_vencer_prazo = 0, 0.0
    rdr = _tab(zf, "VI")
    if rdr is not None:
        for row in rdr:
            av = _num(row, "TAB_VI_A_VL_DIRCRED_PRAZO")
            if av <= 0:
                continue
            n_prazo += 1
            a_vencer_prazo += av
            for i, (faixa, _dias) in enumerate(PRAZOS, start=1):
                prazos[faixa][0] += _num(row, f"TAB_VI_A{i}_VL_PRAZO_VENC_{faixa}")
                prazos[faixa][1] += _num(row, f"TAB_VI_B{i}_VL_INAD_{faixa}")
                prazos[faixa][2] += _num(row, f"TAB_VI_C{i}_VL_ANTECIPADO_{faixa}")
    return {
        "lastro": lastro, "n_lastro": n_lastro, "cart_lastro": cart_lastro, "cart_tab1_com_lastro": cart_tab1_com_lastro,
        "classes": classes, "fundos_por_classe": fundos_por_classe, "n_pl": len(pl), "pl_total": sum(pl.values()),
        "n_classe_ok": n_ok, "pl_classe_ok": pl_ok,
        "prazos": prazos, "n_prazo": n_prazo, "a_vencer_prazo": a_vencer_prazo,
    }


def _grava_detalhe(con, am, n_f, cart, det):
    con.execute("DELETE FROM fidc_lastro WHERE anomes=?", (am,))
    con.executemany("INSERT INTO fidc_lastro VALUES(?,?,?)", [(am, cat, v) for cat, v in det["lastro"].items()])
    con.execute("DELETE FROM fidc_classe WHERE anomes=?", (am,))
    con.executemany("INSERT INTO fidc_classe VALUES(?,?,?,?)",
                    [(am, k, v, det["fundos_por_classe"].get(k, 0)) for k, v in det["classes"].items()])
    con.execute("DELETE FROM fidc_prazo WHERE anomes=?", (am,))
    con.executemany("INSERT INTO fidc_prazo VALUES(?,?,?,?,?)", [(am, faixa, *vals) for faixa, vals in det["prazos"].items()])
    con.execute("INSERT OR REPLACE INTO fidc_detalhe VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (am, n_f, cart, det["n_lastro"], det["cart_lastro"], det["cart_tab1_com_lastro"], det["n_pl"], det["pl_total"],
                 det["n_classe_ok"], det["pl_classe_ok"], det["n_prazo"], det["a_vencer_prazo"], common.now_utc()))


def collect(con, cfg):
    _ensure(con)
    results = []
    for am in _meses(MESES_HISTORICO):
        key = f"fidc:{am}"
        tem_agg = con.execute("SELECT cred_inad FROM fidc_agg WHERE anomes=?", (am,)).fetchone()
        tem_det = con.execute("SELECT 1 FROM fidc_detalhe WHERE anomes=?", (am,)).fetchone()
        if tem_agg and tem_agg[0] is not None and tem_det:
            continue  # idempotente: mês já agregado (com créditos inadimplentes) e detalhado
        try:
            body, meta = common.http_get(URL.format(am=am), timeout=300)
            zf = zipfile.ZipFile(io.BytesIO(body))
            n_f, cart, vi, va, ci, por_fundo = _agrega_tab1(zf)
            det = _agrega_detalhe(zf, por_fundo)
            extrato = f"{am};{n_f};{cart};{vi};{va}"
            bronze_file, sha = common.save_bronze("cvm_fidc", f"agg_{am}", extrato.encode(),
                                                  {"url": URL.format(am=am), "nota": "agregado tab_I: soma entre fundos com carteira > 0; "
                                                   "detalhe por lastro (tab II), classe (tab X.2 × tab IV) e prazo (tab VI) no silver"})
            if not tem_agg:
                con.execute("INSERT OR REPLACE INTO fidc_agg(anomes, n_fundos, carteira, venc_inad, venc_ad, cred_inad, collected_at) VALUES(?,?,?,?,?,?,?)",
                            (am, n_f, cart, vi, va, ci, common.now_utc()))
            else:
                # mês já agregado antes da coluna existir: só a inadimplência entra; os totais herdados ficam
                # (o informe é revisado pela CVM e reprocessar mudaria a série publicada sem aviso)
                con.execute("UPDATE fidc_agg SET cred_inad=? WHERE anomes=?", (ci, am))
            _grava_detalhe(con, am, n_f, cart, det)
            common.record_lineage(con, f"fidc_agg:{am}", bronze_file, sha,
                                  "CVM informe mensal FIDC: tab_I (carteira e vencidos), tab_II (lastro), tab_X.2 e tab_IV (classes de cota), tab_VI (prazos), agregados do sistema")
            results.append({"key": key, "ok": True, "fundos": n_f, "carteira_bi": round(cart / 1e9, 1), "inad_pct": round(ci / cart * 100, 2) if cart else None,
                            "lastro_fundos": det["n_lastro"], "classe_fundos_ok": det["n_classe_ok"], "prazo_fundos": det["n_prazo"],
                            "backfill": bool(tem_agg)})
        except Exception as e:
            results.append({"key": key, "ok": False, "error": str(e)[:120]})
    return results
