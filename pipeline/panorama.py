"""Panorama do Crédito — gold panorama.json (+ pano/{uf}.json e explorer.json, lazy).

Base: fatos scr_* (SCR.data v2, ver docs/AUDITORIA_SCR.md) + geo_uf (IBGE).
Conceitos declarados em todo o payload:
- inad = carteira_inadimplencia / carteira (inadimplência ARRASTADA >90d; conceito ≠ SGS 21082);
- atraso15_90 = vencido_de_15_ate_90 / carteira; ap = ativo problemático / carteira;
- saldo médio é POR OPERAÇÃO (nº de clientes não existe na fonte) e é PARCIAL quando
  o grupo contém células com nº de operações suprimido pela fonte (piso declarado);
- taxas suprimidas quando carteira do grupo < R$ 50 mi (proteção nº 2 da auditoria);
- crescimento nominal entre datas-base (estoque; nunca comparar com fluxo).
Síntese e alertas são determinísticos com regras publicadas (persistência de 2
datas-base consecutivas + limiares; nunca um ponto isolado).
"""
import statistics

from pipeline import common

MIN_CARTEIRA_TAXA = 50e6  # R$ — abaixo disso a taxa é suprimida (célula pequena)
LIMIAR_3M_PP = 0.30       # deterioração mínima em 3 datas-base (p.p. de inadimplência)
LIMIAR_12M_PP = 0.75      # deterioração mínima em 12 datas-base
SALDO_MIN_ALERTA = 20e9   # R$ — carteira mínima do grupo para virar cartão de alerta
OSCILACAO_BASE_MAX = 0.30  # variação máxima da carteira na janela (recomposição de base)

RENDA_ORDEM = ["Sem rendimento", "Até 1 salário mínimo", "Mais de 1 a 2 salários mínimos",
               "Mais de 2 a 3 salários mínimos", "Mais de 3 a 5 salários mínimos",
               "Mais de 5 a 10 salários mínimos", "Mais de 10 a 20 salários mínimos",
               "Acima de 20 salários mínimos", "Indisponível"]
PORTE_ORDEM = ["Micro", "Pequeno", "Médio", "Grande", "Indisponível"]


def _taxa(num, den):
    if den is None or den < MIN_CARTEIRA_TAXA or not den:
        return None  # suprimida ou sem denominador — nunca zero
    return round(num / den * 100, 2)


def _linha(saldo, n_op, n_supr, saldo_opv, v1590, v90, inad, ap):
    return {
        "saldo": round(saldo), "n_op": round(n_op) if n_op else None, "n_op_parcial": bool(n_supr),
        "atraso15_90": _taxa(v1590, saldo), "atraso90": _taxa(v90, saldo),
        "inad": _taxa(inad, saldo), "ap": _taxa(ap, saldo),
        "saldo_inad": round(inad),
        # numerador = saldo apenas das células com nº de operações público (sem viés de supressão)
        "saldo_medio_op": round(saldo_opv / n_op) if n_op else None,
    }


def _rows(con, sql, params=()):
    return con.execute(sql, params).fetchall()


def _cresc(atual, anterior):
    if not atual or not anterior:
        return None
    return round((atual / anterior - 1) * 100, 2)


def build(con, cfg):
    datas = [r[0] for r in _rows(con, "SELECT DISTINCT data FROM scr_uf ORDER BY data")]
    if len(datas) < 13:
        common.write_gold("panorama.json", {"disponivel": False,
                                            "motivo": f"histórico insuficiente ({len(datas)} datas-base; mínimo 13)"})
        return {"ok": False, "error": "histórico insuficiente"}
    d0, d1m, d3, d12 = datas[-1], datas[-2], datas[-4], datas[-13]
    d6 = datas[-7]
    geo = {r[1]: {"cod": r[0], "nome": r[2], "regiao": r[3], "pop": r[4], "pop_ano": r[5], "d": r[6]}
           for r in _rows(con, "SELECT cod, uf, nome, regiao, populacao, pop_ano, svg_d FROM geo_uf")}
    viewbox = {k: v for k, v in _rows(con, "SELECT k, v FROM geo_meta")}

    # ---------- séries Brasil (todas as datas) ----------
    br = {}
    for d, cli, saldo, v1590, v90, inad, ap in _rows(con,
            "SELECT data, cliente, SUM(saldo), SUM(v1590), SUM(v90), SUM(inad), SUM(ap) FROM scr_uf GROUP BY data, cliente"):
        b = br.setdefault(d, {})
        b[cli] = {"saldo": saldo, "v1590": v1590, "v90": v90, "inad": inad, "ap": ap}
    def brtot(d, campo):
        return sum(v[campo] for v in br[d].values())
    serie_br = [{"p": d, "saldo": round(brtot(d, "saldo")),
                 "inad": _taxa(brtot(d, "inad"), brtot(d, "saldo")),
                 "atraso15_90": _taxa(brtot(d, "v1590"), brtot(d, "saldo")),
                 "ap": _taxa(brtot(d, "ap"), brtot(d, "saldo")),
                 "pf": round(br[d].get("PF", {}).get("saldo", 0)), "pj": round(br[d].get("PJ", {}).get("saldo", 0))}
                for d in datas]

    # ---------- mapa: métricas por UF ----------
    def uf_snapshot(d):
        out = {}
        for uf, saldo, n_op, n_supr, saldo_opv, v1590, v90, inad, ap in _rows(con,
                "SELECT uf, SUM(saldo), SUM(n_op), SUM(n_op_supr), SUM(saldo_opv), SUM(v1590), SUM(v90), SUM(inad), SUM(ap) "
                "FROM scr_uf WHERE data=? GROUP BY uf", (d,)):
            out[uf] = _linha(saldo, n_op, n_supr, saldo_opv, v1590, v90, inad, ap)
        return out
    snap0, snap1m, snap3, snap12 = uf_snapshot(d0), uf_snapshot(d1m), uf_snapshot(d3), uf_snapshot(d12)
    saldo_br = brtot(d0, "saldo")

    # histórico de inad por UF p/ z-score e persistência
    hist_uf = {}
    for d, uf, saldo, inad in _rows(con, "SELECT data, uf, SUM(saldo), SUM(inad) FROM scr_uf GROUP BY data, uf"):
        t = _taxa(inad, saldo)
        if t is not None:
            hist_uf.setdefault(uf, []).append((d, t))

    # produto/renda predominantes por UF (data atual)
    dom_prod, dom_renda = {}, {}
    for uf, produto, saldo in _rows(con,
            "SELECT uf, produto, SUM(saldo) FROM scr_uf_produto WHERE data=? GROUP BY uf, produto", (d0,)):
        if saldo > dom_prod.get(uf, (None, 0))[1]:
            dom_prod[uf] = (produto, saldo)
    for uf, faixa, saldo in _rows(con,
            "SELECT uf, faixa, SUM(saldo) FROM scr_uf_renda WHERE data=? AND cliente='PF' GROUP BY uf, faixa", (d0,)):
        if faixa not in ("Indisponível",) and saldo > dom_renda.get(uf, (None, 0))[1]:
            dom_renda[uf] = (faixa, saldo)

    mapa = []
    for uf, m in sorted(snap0.items()):
        g = geo.get(uf, {})
        zz = [t for _d, t in hist_uf.get(uf, [])]
        z = None
        if len(zz) >= 13 and statistics.pstdev(zz) > 0:
            z = round((zz[-1] - statistics.fmean(zz)) / statistics.pstdev(zz), 2)
        mapa.append({
            "uf": uf, "nome": g.get("nome", uf), "regiao": g.get("regiao"), "cod": g.get("cod"),
            **m,
            "part_br": round(m["saldo"] / saldo_br * 100, 2),
            "per_capita": round(m["saldo"] / g["pop"]) if g.get("pop") else None,
            "cresc3": _cresc(m["saldo"], (snap3.get(uf) or {}).get("saldo")),
            "cresc12": _cresc(m["saldo"], (snap12.get(uf) or {}).get("saldo")),
            "d_inad_3m": round(m["inad"] - snap3[uf]["inad"], 2) if m["inad"] is not None and snap3.get(uf, {}).get("inad") is not None else None,
            "d_inad_12m": round(m["inad"] - snap12[uf]["inad"], 2) if m["inad"] is not None and snap12.get(uf, {}).get("inad") is not None else None,
            "z_inad": z,
            "prod_dominante": dom_prod.get(uf, (None,))[0],
            "renda_dominante": dom_renda.get(uf, (None,))[0],
        })
    inad_br = _taxa(brtot(d0, "inad"), saldo_br)

    # ---------- perfis nacionais (renda, ocupação, produto) ----------
    def perfil(tabela, chave, cliente, ordem=None):
        cur, ant3, ant12 = {}, {}, {}
        for dd, alvo in ((d0, cur), (d3, ant3), (d12, ant12)):
            for k, saldo, n_op, n_supr, saldo_opv, v1590, v90, inad, ap in _rows(con,
                    f"SELECT {chave}, SUM(saldo), SUM(n_op), SUM(n_op_supr), SUM(saldo_opv), SUM(v1590), SUM(v90), SUM(inad), SUM(ap) "
                    f"FROM {tabela} WHERE data=? AND cliente=? GROUP BY {chave}", (dd, cliente)):
                alvo[k] = (saldo, n_op, n_supr, saldo_opv, v1590, v90, inad, ap)
        total_saldo = sum(v[0] for v in cur.values())
        total_inad = sum(v[6] for v in cur.values())
        linhas = []
        for k, v in cur.items():
            li = _linha(*v)
            li["grupo"] = k
            li["part"] = round(v[0] / total_saldo * 100, 2) if total_saldo else None
            li["contrib_inad"] = round(v[6] / total_inad * 100, 2) if total_inad else None
            li["cresc3"] = _cresc(v[0], (ant3.get(k) or (None,))[0])
            li["cresc12"] = _cresc(v[0], (ant12.get(k) or (None,))[0])
            i3 = _taxa(ant3[k][6], ant3[k][0]) if k in ant3 else None
            i12 = _taxa(ant12[k][6], ant12[k][0]) if k in ant12 else None
            li["d_inad_3m"] = round(li["inad"] - i3, 2) if li["inad"] is not None and i3 is not None else None
            li["d_inad_12m"] = round(li["inad"] - i12, 2) if li["inad"] is not None and i12 is not None else None
            linhas.append(li)
        if ordem:
            pos = {k: i for i, k in enumerate(ordem)}
            linhas.sort(key=lambda x: pos.get(x["grupo"], 99))
        else:
            linhas.sort(key=lambda x: -x["saldo"])
        return linhas

    perfis = {
        "renda_pf": perfil("scr_uf_renda", "faixa", "PF", RENDA_ORDEM),
        "porte_pj": perfil("scr_uf_renda", "faixa", "PJ", PORTE_ORDEM),
        "ocupacao_pf": perfil("scr_uf_ocupacao", "grupo", "PF"),
        "setor_pj": perfil("scr_uf_ocupacao", "grupo", "PJ"),
        "produto_pf": perfil("scr_uf_produto", "produto", "PF"),
        "produto_pj": perfil("scr_uf_produto", "produto", "PJ"),
    }

    # matrizes produto × renda e produto × ocupação (nacional, PF)
    def matriz(tabela, dim):
        cel = {}
        for k, produto, saldo, inad in _rows(con,
                f"SELECT {dim}, produto, SUM(saldo), SUM(inad) FROM {tabela} WHERE data=? AND cliente='PF' GROUP BY {dim}, produto", (d0,)):
            cel.setdefault(k, {})[produto] = {"saldo": round(saldo), "inad": _taxa(inad, saldo)}
        return cel
    matriz_renda = matriz("scr_renda_produto", "faixa")
    matriz_ocup = matriz("scr_ocup_produto", "grupo")

    # ---------- alertas com persistência ----------
    alertas = []
    def persistente(hist):  # deterioração em 2 datas-base consecutivas
        return len(hist) >= 3 and hist[-1][1] > hist[-2][1] > hist[-3][1]
    for m in mapa:
        h = hist_uf.get(m["uf"], [])
        if m["d_inad_3m"] is not None and m["d_inad_3m"] >= LIMIAR_3M_PP and persistente(h):
            alertas.append({"tipo": "uf_deterioracao", "grupo": f"{m['nome']} ({m['uf']})",
                            "indicador": "inadimplência (arrastada)", "atual": m["inad"],
                            "anterior": snap3[m["uf"]]["inad"], "delta_pp": m["d_inad_3m"],
                            "periodo": f"{d3} → {d0}", "vs_brasil": round(m["inad"] - inad_br, 2) if m["inad"] is not None and inad_br is not None else None,
                            "regra": "alta em 2 datas-base consecutivas e Δ3m ≥ 0,30 p.p.",
                            "link": {"view": "panorama", "uf": m["uf"]}})
    hist_grupo = {}
    for tabela, chave, cliente, tipo in (("scr_uf_renda", "faixa", "PF", "renda"),
                                         ("scr_uf_ocupacao", "grupo", "PF", "ocupacao"),
                                         ("scr_uf_produto", "produto", "PF", "produto_pf"),
                                         ("scr_uf_produto", "produto", "PJ", "produto_pj")):
        for d, k, saldo, inad in _rows(con,
                f"SELECT data, {chave}, SUM(saldo), SUM(inad) FROM {tabela} WHERE cliente=? GROUP BY data, {chave}", (cliente,)):
            t = _taxa(inad, saldo)
            if t is not None:
                hist_grupo.setdefault((tipo, k), []).append((d, t, saldo))
    # Guardas dos cartões de grupo (aprendizado do falso positivo "Cartão —
    # rotativo" PJ, mai/2026: carteira de R$ 1-4 bi cujo denominador cai pela
    # metade entre datas-base e faz a taxa saltar de 0,9% para 4,8% sem
    # deterioração econômica): (1) carteira mínima; (2) base estável na janela
    # de 3 datas; (3) segmento SEMPRE declarado no rótulo. Supressões são
    # contadas e publicadas — nunca silenciosas.
    alertas_suprimidos = []
    SEG_ROTULO = {"produto_pf": " · PF", "produto_pj": " · PJ", "renda": " · PF", "ocupacao": " · PF"}
    NOTA_PRODUTO = ("Inadimplência arrastada por submodalidade do SCR.data: o ciclo do cartão migra saldos "
                    "entre à vista, rotativo e parcelamento entre datas-base, então o nível por submodalidade "
                    "não é comparável às séries SGS por modalidade.")
    for (tipo, k), h in hist_grupo.items():
        h.sort()
        if len(h) >= 13 and persistente([(d, t) for d, t, _s in h]):
            d3m = round(h[-1][1] - h[-4][1], 2)
            d12m = round(h[-1][1] - h[-13][1], 2)
            if d3m >= LIMIAR_3M_PP or d12m >= LIMIAR_12M_PP:
                saldo_atual, saldo_3m = h[-1][2], h[-4][2]
                rotulo = f"{k}{SEG_ROTULO.get(tipo, '')}"
                if saldo_atual < SALDO_MIN_ALERTA:
                    alertas_suprimidos.append({"grupo": rotulo, "motivo": f"carteira de R$ {saldo_atual/1e9:.1f} bi abaixo do mínimo de R$ {SALDO_MIN_ALERTA/1e9:.0f} bi: taxa volátil demais para manchete", "delta_pp": d3m})
                    continue
                if saldo_3m and abs(saldo_atual / saldo_3m - 1) > OSCILACAO_BASE_MAX:
                    alertas_suprimidos.append({"grupo": rotulo, "motivo": f"carteira variou {abs(saldo_atual/saldo_3m-1)*100:.0f}% na janela: recomposição de base, não deterioração comparável", "delta_pp": d3m})
                    continue
                alertas.append({"tipo": f"{tipo}_deterioracao", "grupo": rotulo,
                                "indicador": "inadimplência (arrastada)", "atual": h[-1][1], "anterior": h[-4][1],
                                "delta_pp": d3m, "delta_12m_pp": d12m, "periodo": f"{h[-4][0]} → {h[-1][0]}",
                                "saldo_grupo": round(saldo_atual),
                                "nota": (NOTA_PRODUTO if tipo.startswith("produto") and "Cartão" in k
                                         else "'Outros' é o agregado residual do SCR (soma do que não cabe nas demais categorias) — a taxa é real, mas não aponta um produto único." if k == "Outros"
                                         else None),
                                "regra": "alta em 2 datas-base consecutivas e (Δ3m ≥ 0,30 p.p. ou Δ12m ≥ 0,75 p.p.), carteira ≥ R$ 20 bi e base estável (±30% em 3 datas)",
                                "link": {"view": "panorama"}})
    melhoras = sorted([m for m in mapa if m["d_inad_12m"] is not None], key=lambda m: m["d_inad_12m"])[:3]
    alertas.sort(key=lambda a: -(a.get("delta_pp") or 0))

    # ---------- síntese determinística ----------
    por_regiao = {}
    for m in mapa:
        por_regiao[m["regiao"]] = por_regiao.get(m["regiao"], 0) + m["saldo"]
    reg_top = sorted(por_regiao.items(), key=lambda x: -x[1])[:2]
    pior_renda = max((x for x in perfis["renda_pf"] if x["d_inad_12m"] is not None and x["grupo"] not in ("Indisponível",)),
                     key=lambda x: x["d_inad_12m"], default=None)
    # "Outros" é agregado residual do SCR — o superlativo da síntese aponta um
    # produto identificável; a deterioração do residual segue visível nos alertas
    pior_prod = max((x for x in perfis["produto_pf"] if x["d_inad_12m"] is not None and x["saldo"] > 50e9
                     and x["grupo"] != "Outros"),
                    key=lambda x: x["d_inad_12m"], default=None)
    pior_ufs = sorted([m for m in mapa if m["d_inad_12m"] is not None], key=lambda m: -m["d_inad_12m"])[:3]
    cresc12_br = _cresc(brtot(d0, "saldo"), brtot(d12, "saldo"))
    sintese = (f"O crédito segue concentrado em {reg_top[0][0]} e {reg_top[1][0]} "
               f"({round((reg_top[0][1] + reg_top[1][1]) / saldo_br * 100)}% da carteira de R$ {saldo_br/1e12:.2f} tri). "
               f"Em 12 meses a carteira cresceu {cresc12_br:.1f}% (nominal) e a inadimplência arrastada está em {inad_br:.1f}%. ")
    if pior_ufs:
        sintese += ("A deterioração recente é maior em " + ", ".join(f"{m['uf']}" for m in pior_ufs) +
                    (f", na faixa de renda '{pior_renda['grupo']}'" if pior_renda else "") +
                    (f" e em {pior_prod['grupo']}" if pior_prod else "") + ".")

    grupo_deterioracao = (f"{pior_renda['grupo']} (PF): {pior_renda['d_inad_12m']:+.2f} p.p. em 12m"
                          if pior_renda else None)

    nop_br = con.execute("SELECT SUM(n_op), SUM(n_op_supr), SUM(saldo_opv) FROM scr_uf WHERE data=?", (d0,)).fetchone()
    kpis = {
        "saldo": {"v": round(saldo_br), "cresc12": cresc12_br, "cresc3": _cresc(brtot(d0, "saldo"), brtot(d3, "saldo")),
                  "cresc6": _cresc(brtot(d0, "saldo"), brtot(d6, "saldo")), "status": "observado"},
        "saldo_medio_op": {"v": round(nop_br[2] / nop_br[0]) if nop_br[0] else None, "parcial": bool(nop_br[1]),
                           "conceito": "saldo por OPERAÇÃO (nº de clientes não é público); denominador é piso — células suprimidas pela fonte ficam de fora",
                           "status": "calculado"},
        "inad": {"v": inad_br, "d12m_pp": round(inad_br - _taxa(brtot(d12, "inad"), brtot(d12, "saldo")), 2),
                 "conceito": "inadimplência arrastada (>90d, operação inteira) — difere do conceito SGS", "status": "calculado"},
        "atraso15_90": {"v": _taxa(brtot(d0, "v1590"), saldo_br), "status": "calculado"},
        "ap": {"v": _taxa(brtot(d0, "ap"), saldo_br), "conceito": "ativo problemático (Res. 4.557): inclui reestruturados e risco E–H", "status": "calculado"},
        "grupo_deterioracao": {"v": grupo_deterioracao, "status": "calculado"},
    }

    common.write_gold("panorama.json", {
        "disponivel": True, "gerado_em": common.now_utc(),
        "fonte": "BCB SCR.data v2 (dados abertos) — agregados públicos protegidos pelo BCB",
        "data_base": d0, "data_base_anterior": d1m, "datas": datas,
        "conceitos": {
            "inad": "carteira_inadimplencia/carteira: operações com parcela vencida >90d contadas por inteiro (arrastada). Não comparável ao SGS 21082.",
            "atraso15_90": "parcelas vencidas de 15 a 90 dias / carteira.",
            "ap": "ativo problemático / carteira (Res. 4.557).",
            "saldo_medio": "saldo por OPERAÇÃO (nº de clientes não é público); parcial quando o grupo contém células suprimidas.",
            "supressao": f"taxas omitidas quando a carteira do grupo é inferior a R$ {MIN_CARTEIRA_TAXA/1e6:.0f} mi; células com nº de operações = -1 preservadas como suprimidas (nunca zero).",
            "crescimento": "variação nominal do estoque entre datas-base; não comparar com concessões (fluxo).",
            "cartao_submodalidades": "o ciclo de cobrança do cartão migra saldos entre as submodalidades (à vista → rotativo → parcelamento) entre datas-base: taxas por submodalidade têm base que se recompõe e NÃO são comparáveis às séries SGS por modalidade (ex.: SGS 21127).",
            "alertas_grupo": f"cartões de 'O que mudou?' exigem carteira ≥ R$ {SALDO_MIN_ALERTA/1e9:.0f} bi e base estável (variação ≤ {OSCILACAO_BASE_MAX*100:.0f}% na janela); grupos suprimidos por essas guardas são publicados em alertas_suprimidos.",
        },
        "sintese": sintese, "kpis": kpis,
        "serie_br": serie_br,
        "mapa": mapa,
        "geo": {"viewBox": viewbox.get("viewBox"), "transform": viewbox.get("transform"),
                "paths": {g["cod"]: g["d"] for g in geo.values() if g.get("d")}},
        "perfis": perfis,
        "matriz_renda_produto": matriz_renda,
        "matriz_ocup_produto": matriz_ocup,
        "alertas": alertas[:20],
        "alertas_suprimidos": alertas_suprimidos,
        "melhoras": [{"uf": m["uf"], "nome": m["nome"], "d_inad_12m": m["d_inad_12m"], "inad": m["inad"]} for m in melhoras],
        "populacao_fonte": f"IBGE SIDRA 6579 ({next((g['pop_ano'] for g in geo.values() if g.get('pop_ano')), '?')})",
    })

    # ---------- pano/{uf}.json (lazy): perfil completo da UF ----------
    for uf, g in geo.items():
        series = [{"p": d, "inad": t} for d, t in hist_uf.get(uf, [])]
        saldos = {d: None for d in datas}
        for d, s in _rows(con, "SELECT data, SUM(saldo) FROM scr_uf WHERE uf=? GROUP BY data", (uf,)):
            saldos[d] = round(s)
        def bloco(tabela, chave, cliente):
            out = []
            tot_s = tot_i = 0.0
            rows = _rows(con, f"SELECT {chave}, SUM(saldo), SUM(n_op), SUM(n_op_supr), SUM(saldo_opv), SUM(v1590), SUM(v90), SUM(inad), SUM(ap) "
                              f"FROM {tabela} WHERE data=? AND uf=? AND cliente=? GROUP BY {chave}", (d0, uf, cliente))
            for r in rows:
                tot_s += r[1]; tot_i += r[6]
            for r in rows:
                li = _linha(*r[1:])
                li["grupo"] = r[0]
                li["part"] = round(r[1] / tot_s * 100, 2) if tot_s else None
                li["contrib_inad"] = round(r[6] / tot_i * 100, 2) if tot_i else None
                out.append(li)
            out.sort(key=lambda x: -x["saldo"])
            return out
        common.write_gold(f"pano/{uf}.json", {
            "uf": uf, "nome": g["nome"], "regiao": g["regiao"], "data_base": d0,
            "serie_inad": series, "serie_saldo": [{"p": d, "v": saldos[d]} for d in datas],
            "produtos_pf": bloco("scr_uf_produto", "produto", "PF"),
            "produtos_pj": bloco("scr_uf_produto", "produto", "PJ"),
            "renda_pf": bloco("scr_uf_renda", "faixa", "PF"),
            "ocupacao_pf": bloco("scr_uf_ocupacao", "grupo", "PF"),
            "setor_pj": bloco("scr_uf_ocupacao", "grupo", "PJ"),
        })

    # ---------- explorer.json (lazy): fatos compactos p/ o explorador ----------
    def dump_fato(tabela, dims):
        # valores ADITIVOS (nunca taxas) para permitir reagrupamento no cliente sem dupla contagem;
        # o front aplica a mesma regra de supressão de taxas (carteira < R$ 50 mi → taxa omitida)
        sel = ", ".join(dims)
        out = []
        for dd in (d0, d3, d12):
            for r in _rows(con, f"SELECT {sel}, ROUND(SUM(saldo)), ROUND(SUM(n_op)), SUM(n_op_supr), ROUND(SUM(saldo_opv)), "
                                f"ROUND(SUM(v1590)), ROUND(SUM(v90)), ROUND(SUM(inad)), ROUND(SUM(ap)) "
                                f"FROM {tabela} WHERE data=? GROUP BY {sel}", (dd,)):
                li = dict(zip([*dims, "saldo", "n_op", "n_op_supr", "saldo_opv", "v1590", "v90", "inad", "ap"], r))
                li["d"] = dd
                out.append(li)
        return out
    common.write_gold("explorer.json", {
        "data_base": d0, "datas_incluidas": [d0, d3, d12],
        "nota": "Fatos separados por granularidade — não somar fatos entre si (dupla contagem). "
                "Cruzamentos ausentes não estão disponíveis na fonte pública.",
        "fatos": {
            "uf_produto": dump_fato("scr_uf_produto", ["uf", "cliente", "produto"]),
            "uf_renda": dump_fato("scr_uf_renda", ["uf", "cliente", "faixa"]),
            "uf_ocupacao": dump_fato("scr_uf_ocupacao", ["uf", "cliente", "grupo"]),
            "renda_produto": dump_fato("scr_renda_produto", ["cliente", "faixa", "produto"]),
            "ocup_produto": dump_fato("scr_ocup_produto", ["cliente", "grupo", "produto"]),
            "uf_origem": [dict(zip(["uf", "cliente", "origem", "saldo", "saldo_inad", "d"], (*r, dd)))
                          for dd in (d0, d12) for r in _rows(con,
                              "SELECT uf, cliente, origem, ROUND(SUM(saldo)), ROUND(SUM(inad)) FROM scr_uf_origem WHERE data=? GROUP BY uf, cliente, origem", (dd,))],
        },
    })
    return {"ok": True, "datas": len(datas), "ufs": len(mapa), "alertas": len(alertas)}
