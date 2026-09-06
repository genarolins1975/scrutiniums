"""Conector CVM — Composição e diversificação das aplicações dos fundos (CDA), bloco 5.

Fonte: https://dados.cvm.gov.br/dados/FI/DOC/CDA/DADOS/cda_fi_{AAAAMM}.zip (um zip por mês,
16 a 24 MB, com oito blocos). O bloco 5 ("Depósitos a prazo e outros títulos de IF") traz,
posição a posição, os papéis bancários que cada classe de fundo carrega: letra financeira,
CDB/RDB, DPGE e afins, com CNPJ e nome do emissor, vencimento, indexador e se o emissor é
ligado ao gestor. É a única fonte pública que diz QUEM financia cada banco pelo mercado.

O coletor guarda só a agregação por mês × emissor (CNPJ raiz) × tipo de papel × ligado:
valor a mercado, número de posições e de classes, valor vencendo em 12 meses. O nome do
emissor é o mais frequente nas posições (a CVM não normaliza nomes; o builder usa o
cadastro do IF.data pelo CNPJ raiz). Também guarda o PL total e o número de classes do
arquivo PL do mesmo mês, para medir cobertura: o mês corrente entra parcial (os fundos
têm até 10 dias úteis para enviar) e é declarado como tal pelo builder.

Cadência: os últimos MESES_HISTORIA meses, no máximo POR_EXECUCAO downloads por rodada
(retomável); os MESES_JOVENS meses mais novos são recoletados a cada REVISAO_DIAS dias porque
o arquivo cresce com os envios tardios e com a liberação das posições sob sigilo (o gestor
pode adiar a divulgação de uma posição por até 90 dias; nesse período a CVM publica só o
valor por classe, sem emissor, no arquivo CONFID).
"""
import csv
import io
import json
import zipfile
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta

from pipeline import common

BASE = "https://dados.cvm.gov.br/dados/FI/DOC/CDA/DADOS/cda_fi_{mes}.zip"
MESES_HISTORIA = 24
POR_EXECUCAO = 3
REVISAO_DIAS = 7
MESES_JOVENS = 4   # posições sob sigilo são liberadas em até ~90 dias; o arquivo muda até lá


def _ensure(con):
    con.execute("""CREATE TABLE IF NOT EXISTS cda_if(
        mes TEXT, cnpj_raiz TEXT, emissor TEXT, tp_ativo TEXT, ligado TEXT,
        n_classes INTEGER, n_posicoes INTEGER, valor REAL, valor_venc_12m REAL, valor_ligado REAL,
        PRIMARY KEY(mes, cnpj_raiz, tp_ativo, ligado))""")
    con.execute("""CREATE TABLE IF NOT EXISTS cda_coleta(
        mes TEXT PRIMARY KEY, sha TEXT, collected_at TEXT, n_classes_blc5 INTEGER, n_classes_pl INTEGER,
        pl_total REAL, valor_blc5 REAL, tamanho_zip INTEGER, valor_sigilo REAL, sigilo_ate TEXT)""")
    cols = {r[1] for r in con.execute("PRAGMA table_info(cda_coleta)").fetchall()}
    for c, t in (("valor_sigilo", "REAL"), ("sigilo_ate", "TEXT")):
        if c not in cols:
            con.execute(f"ALTER TABLE cda_coleta ADD COLUMN {c} {t}")


def _meses(n):
    hoje = date.today()
    out = []
    y, m = hoje.year, hoje.month
    for _ in range(n):
        out.append(f"{y:04d}{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return out


def _f(v):
    try:
        return float(v) if v not in (None, "") else 0.0
    except ValueError:
        return 0.0


def _agrega(z, mes):
    blc = next((n for n in z.namelist() if f"BLC_5_{mes}" in n), None)
    pl = next((n for n in z.namelist() if f"_PL_{mes}" in n), None)
    if not blc:
        raise ValueError("bloco 5 ausente no zip")
    rows = list(csv.DictReader(io.StringIO(z.read(blc).decode("latin-1")), delimiter=";"))
    agg = {}
    nomes = defaultdict(Counter)
    classes = defaultdict(set)
    for r in rows:
        cnpj = (r.get("CNPJ_EMISSOR") or "").replace(".", "").replace("/", "").replace("-", "")
        raiz = cnpj[:8] if len(cnpj) >= 8 else "00000000"
        tp = (r.get("TP_ATIVO") or "").strip() or "Outros"
        lig = "S" if (r.get("EMISSOR_LIGADO") or "").strip().upper() == "S" else "N"
        v = _f(r.get("VL_MERC_POS_FINAL"))
        k = (raiz, tp, lig)
        a = agg.setdefault(k, {"n_posicoes": 0, "valor": 0.0, "valor_venc_12m": 0.0})
        a["n_posicoes"] += 1
        a["valor"] += v
        try:
            comp = datetime.strptime(r.get("DT_COMPTC")[:10], "%Y-%m-%d").date()
            venc = datetime.strptime(r.get("DT_VENC")[:10], "%Y-%m-%d").date()
            if venc <= comp + timedelta(days=365):
                a["valor_venc_12m"] += v
        except (TypeError, ValueError):
            pass
        classes[k].add(r.get("CNPJ_FUNDO_CLASSE"))
        if r.get("EMISSOR"):
            nomes[raiz][r["EMISSOR"].strip()] += 1
    out = []
    for (raiz, tp, lig), a in agg.items():
        out.append((mes, raiz, nomes[raiz].most_common(1)[0][0] if nomes[raiz] else None, tp, lig,
                    len(classes[(raiz, tp, lig)]), a["n_posicoes"], a["valor"], a["valor_venc_12m"]))
    n_classes_blc5 = len({r.get("CNPJ_FUNDO_CLASSE") for r in rows})
    valor_blc5 = sum(_f(r.get("VL_MERC_POS_FINAL")) for r in rows)
    n_pl, pl_total = None, None
    if pl:
        prow = list(csv.DictReader(io.StringIO(z.read(pl).decode("latin-1")), delimiter=";"))
        n_pl = len({r.get("CNPJ_FUNDO_CLASSE") for r in prow})
        pl_total = sum(_f(r.get("VL_PATRIM_LIQ")) for r in prow)
    # posições sob sigilo (arquivo CONFID): a CVM publica só o valor por classe e tipo de
    # aplicação, sem emissor, até a data de liberação. Guardamos o total do bloco 5 sob
    # sigilo e a última data de liberação: é o que falta no mês, declarado, nunca rateado.
    valor_sigilo, sigilo_ate = 0.0, None
    conf = next((n for n in z.namelist() if f"cda_fi_CONFID_{mes}" in n), None)
    if conf:
        for r in csv.DictReader(io.StringIO(z.read(conf).decode("latin-1")), delimiter=";"):
            if (r.get("TP_APLIC") or "").startswith("Depósitos a prazo"):
                valor_sigilo += _f(r.get("VL_MERC_POS_FINAL"))
                d = (r.get("DT_CONFID_APLIC") or "")[:10]
                if d and (sigilo_ate is None or d > sigilo_ate):
                    sigilo_ate = d
    return out, n_classes_blc5, valor_blc5, n_pl, pl_total, valor_sigilo, sigilo_ate


def collect(con, cfg):
    _ensure(con)
    results = []
    feitos = 0
    meses = _meses(MESES_HISTORIA)
    for i, mes in enumerate(meses):
        ja = con.execute("SELECT collected_at FROM cda_coleta WHERE mes=?", (mes,)).fetchone()
        if ja and not (i < MESES_JOVENS and not common.coletado_recentemente(ja[0], REVISAO_DIAS)):
            continue
        if feitos >= POR_EXECUCAO:
            break
        url = BASE.format(mes=mes)
        try:
            body, meta = common.http_get(url, timeout=900, retries=2, accept="*/*")
        except Exception as e:
            if i == 0:  # o mês corrente pode simplesmente ainda não existir
                results.append({"key": f"cvm_cda:{mes}", "ok": True, "pulado": f"sem arquivo ({str(e)[:60]})"})
                continue
            results.append({"key": f"cvm_cda:{mes}", "ok": False, "error": str(e)[:160]})
            feitos += 1
            continue
        feitos += 1
        try:
            z = zipfile.ZipFile(io.BytesIO(body))
            linhas, n5, v5, n_pl, pl_total, v_sig, sig_ate = _agrega(z, mes)
            recorte = json.dumps({"mes": mes, "fonte": url, "linhas": linhas}, ensure_ascii=False).encode("utf-8")
            bronze_file, sha = common.save_bronze("cvm_cda", f"blc5_{mes}", recorte, meta)
            con.execute("DELETE FROM cda_if WHERE mes=?", (mes,))
            con.executemany("INSERT INTO cda_if(mes, cnpj_raiz, emissor, tp_ativo, ligado, n_classes, n_posicoes, valor, valor_venc_12m, valor_ligado) VALUES(?,?,?,?,?,?,?,?,?,NULL)", linhas)
            con.execute("INSERT OR REPLACE INTO cda_coleta(mes, sha, collected_at, n_classes_blc5, n_classes_pl, pl_total, valor_blc5, tamanho_zip, valor_sigilo, sigilo_ate) VALUES(?,?,?,?,?,?,?,?,?,?)",
                        (mes, sha, common.now_utc(), n5, n_pl, pl_total, v5, len(body), v_sig, sig_ate))
            common.record_lineage(con, "funding.json", bronze_file, sha,
                                  f"CVM CDA {mes}, bloco 5 (depósitos a prazo e outros títulos de IF) agregado por emissor, tipo e vínculo")
            con.commit()
            results.append({"key": f"cvm_cda:{mes}", "ok": True, "emissores": len({l[1] for l in linhas}), "classes": n5, "valor_bi": round(v5 / 1e9, 1), "sigilo_bi": round(v_sig / 1e9, 1), "zip_mb": round(len(body) / 1e6, 1)})
        except Exception as e:
            results.append({"key": f"cvm_cda:{mes}", "ok": False, "error": str(e)[:160]})
    return results or [{"key": "cvm_cda", "ok": True, "nota": "nada a coletar"}]
