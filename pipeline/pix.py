"""Pix e Meios de Pagamento — gold pix.json (+ pix_mun.json lazy).

Fontes e reconciliação em docs/AUDITORIA_PIX.md. Regras estruturais:
- SÉRIES e KPIs de total do Pix usam o MPV mensal (universo doc 1201, inclui
  liquidação fora do SPI); COMPOSIÇÕES (natureza, idade, forma, finalidade,
  região) usam a base transacional (SPI) com a COBERTURA declarada no payload.
- Comparação completa entre instrumentos: apenas TRIMESTRAL; instrumentos
  mensais são agregados por SOMA no trimestre; nada trimestral é interpolado.
- Estoques (usuários DICT, chaves) nunca somados no tempo.
- Valores reais deflacionados pelo IPCA (SGS 433) até o último mês do índice.
- Ausência = null; zeros do MPV pós-descontinuação (DOC/TEC) são zeros reais.
"""
from pipeline import common

INSTRUMENTOS = {
    "Pix": "Pix", "TED": "TED", "Boleto": "Boleto", "Cheque": "Cheque", "DOC": "DOC", "TEC": "TEC",
    "CartaoCredito": "Cartão de crédito", "CartaoDebito": "Cartão de débito", "CartaoPrePago": "Cartão pré-pago",
    "TransIntrabancaria": "Transf. intrabancária", "Convenios": "Convênios", "DebitoDireto": "Débito direto",
    "Saques": "Saques",
}
FORMAS = {"DICT": "Chave Pix (DICT)", "MANU": "Inserção manual", "QRES": "QR Code estático",
          "QRDN": "QR Code dinâmico", "APES": "Pix por aproximação (estático)", "APDN": "Pix por aproximação (dinâmico)",
          "INIC": "Iniciador de pagamento (Open Finance)", "AUTO": "Pix Automático", "Nao disponivel": "Não disponível"}
NATS = ["P2P", "P2B", "B2P", "B2B", "P2G", "G2P", "B2G", "G2B", "G2G"]


def _rows(con, sql, params=()):
    return con.execute(sql, params).fetchall()


def _gold_publicado():
    """Última publicação íntegra do pix.json (o checkout traz o gold do main).

    Existe para o cenário de pane dupla vivido em 07-08/08/2026: o cache do
    Actions se perdeu, o seed não tem as tabelas do Pix, e a fonte trimestral
    do MPV (e o MED) saiu do ar no BCB — o silver reconstruído ficou sem esses
    históricos e o build inteiro estourava, publicando stub de erro. Blocos de
    fonte em pane carregam a última publicação: dado observado da mesma fonte,
    posição declarada nos próprios rótulos, substituído por inteiro na primeira
    coleta que funcionar.
    """
    import json
    from pathlib import Path
    p = Path(__file__).resolve().parent.parent / "public" / "obs" / "data" / "gold" / "pix.json"
    try:
        g = json.loads(p.read_text())
        return g if isinstance(g, dict) and g.get("disponivel") is not False else {}
    except Exception:
        return {}


def _ipca_indice(con):
    """Índice acumulado do IPCA por AAAAMM (base última observação = 1)."""
    obs = common.get_series(con, "ipca")  # var. % mensal
    if not obs:
        return {}
    idx, acc = {}, 1.0
    fatores = []
    for d, v in obs:
        fatores.append((d[:7].replace("-", ""), 1 + (v or 0) / 100))
    for am, f in fatores:
        acc *= f
        idx[am] = acc
    ult = fatores[-1][0]
    base = idx[ult]
    return {am: base / v for am, v in idx.items()}  # multiplicador p/ preços do último mês


def epae_matriz_te(con):
    """Matriz setor-pagador × setor-recebedor da tabela especial EPAE (SPI).

    Universo DIFERENTE do bloco pix_cnae (EPAE aberta) e nunca somado a ele: a
    tabela especial cobre só o Pix liquidado no SPI, desde nov/2020, e traz o
    que a EPAE aberta não tem — o SETOR do pagador. É ela que preenche a lacuna
    que este painel declarava ("a matriz completa setor-pagador ×
    setor-recebedor não existe").

    Função de módulo, e não bloco inline no build: o build completo exige
    tabelas que só existem no estado do CI, e este pedaço precisa ser
    computável isoladamente — para teste e para injeção no gold publicado sem
    esperar o ciclo diário.
    """
    try:
        te_meses = [r[0] for r in _rows(con, "SELECT DISTINCT data FROM epae_fluxo ORDER BY data")]
    except Exception:
        return {}
    if not te_meses:
        return {}
    rotulo = lambda s2: s2.split(" / ")[0].strip()
    ultimo = te_meses[-1]
    ult12 = te_meses[-13] if len(te_meses) >= 13 else te_meses[0]
    BI = 1e9
    # matriz do último mês, em R$ bi — 23×23 células, pequena e completa
    matriz_te = {}
    for pag, rec, v in _rows(con,
            "SELECT pagador, recebedor, valor FROM epae_fluxo WHERE data=?", (ultimo,)):
        matriz_te.setdefault(rotulo(pag), {})[rotulo(rec)] = round(v / BI, 3)
    # o que cada setor recebe DE PESSOAS FÍSICAS: último mês, 12m atrás e ano fechado
    pf = "Pessoa Fisica / Household"
    de_pf_ult = {rotulo(r): v for r, v in _rows(con,
        "SELECT recebedor, valor FROM epae_fluxo WHERE data=? AND pagador=?", (ultimo, pf))}
    de_pf_12m = {rotulo(r): v for r, v in _rows(con,
        "SELECT recebedor, valor FROM epae_fluxo WHERE data=? AND pagador=?", (ult12, pf))}
    ano_fechado = None
    for a in sorted({m[:4] for m in te_meses}, reverse=True):
        if len([m for m in te_meses if m.startswith(a)]) == 12:
            ano_fechado = a
            break
    de_pf_ano = {}
    if ano_fechado:
        de_pf_ano = {rotulo(r): v for r, v in _rows(con,
            """SELECT recebedor, SUM(valor) FROM epae_fluxo
               WHERE pagador=? AND data LIKE ? GROUP BY recebedor""", (pf, f"{ano_fechado}-%"))}
    recebedores_pf = []
    # denominador exclui PF→PF: a participação publicada é sobre o Pix PF→PJ,
    # o MESMO conceito da coluna "% do Pix PF→PJ" do epae.json — dois números
    # com o mesmo nome e denominadores diferentes seria pedir má leitura
    tot_pf = sum(v for r, v in de_pf_ult.items() if r != "Pessoa Fisica") or 1
    for rec, v in sorted(de_pf_ult.items(), key=lambda kv: -kv[1]):
        if rec == "Pessoa Fisica":
            continue  # P2P fica no capítulo de natureza; aqui é o destino setorial
        va = de_pf_12m.get(rec)
        recebedores_pf.append({
            "setor": rec, "v": round(v / BI, 3), "part": round(v / tot_pf * 100, 2),
            "yoy": round((v / va - 1) * 100, 1) if va else None,
            "ano": round(de_pf_ano.get(rec, 0) / BI, 2) if de_pf_ano else None,
        })
    return {
        "mes": ultimo, "mes_yoy": ult12, "ano_fechado": int(ano_fechado) if ano_fechado else None,
        "universo": ("Pix liquidado no SPI (tabela especial EPAE do BCB): fora ficam transferências "
                     "internas à mesma instituição, devoluções, saques/troco e mesma titularidade. "
                     "Universo DIFERENTE do bloco por natureza acima (Pix_DadosAbertos) — os dois "
                     "nunca se somam, e os totais não têm por que coincidir."),
        "revisao": "o BC revisa os quatro últimos meses a cada divulgação (definitivo em m-4)",
        "recebedores_pf": recebedores_pf,
        "matriz": matriz_te,
        "nota_bets": ("A seção 'Artes, cultura, esporte e recreacao' inclui a divisão de jogos e "
                      "apostas, mas NÃO a isola — a leitura dedicada está no painel de bets."),
    }


def build(con, cfg):
    mp = {}
    for am, inst, q, v in _rows(con, "SELECT anomes, instrumento, qtd_mil, valor_mi FROM mp_mensal ORDER BY anomes"):
        mp.setdefault(inst, {})[am] = (q, v)
    if "Pix" not in mp or len(mp["Pix"]) < 13:
        common.write_gold("pix.json", {"disponivel": False, "motivo": "histórico MPV insuficiente"})
        return {"ok": False, "error": "sem MPV"}
    meses_pix = sorted(m for m, (q, v) in mp["Pix"].items() if (q or 0) > 0)
    m0, m12 = meses_pix[-1], meses_pix[-13]
    defl = _ipca_indice(con)

    # ---------- séries mensais (universo MPV) ----------
    def serie(inst):
        out = []
        for am in sorted(mp.get(inst, {})):
            q, v = mp[inst][am]
            qtd = q * 1e3 if q is not None else None       # milhares -> unidades
            val = v * 1e6 if v is not None else None       # R$ mi -> R$
            out.append({"p": f"{am[:4]}-{am[4:6]}", "q": qtd, "v": val,
                        "vr": val * defl.get(am) if val is not None and defl.get(am) else None,
                        "t": round(val / qtd, 2) if qtd and val else None})
        return out
    series_mensais = {inst: serie(inst) for inst in ("Pix", "TED", "Boleto", "Cheque", "DOC", "TEC")}

    q0, v0 = mp["Pix"][m0]
    q12, v12 = mp["Pix"][m12]
    qtd0, val0 = q0 * 1e3, v0 * 1e6
    tick0 = val0 / qtd0
    dict_rows = _rows(con, "SELECT data, pf, pj, total FROM pix_dict ORDER BY data")
    dict_ult = dict_rows[-1] if dict_rows else None

    # ---------- comparação trimestral (todos os instrumentos) ----------
    tris = {}
    for tri, inst, q, v in _rows(con, "SELECT tri, instrumento, qtd_mil, valor_mi FROM mp_trimestral ORDER BY tri"):
        tris.setdefault(str(tri), {})[inst] = {"q": q * 1e3 if q is not None else None,
                                               "v": v * 1e6 if v is not None else None}
    tri_carregado = False
    if not tris:
        # fonte trimestral em pane E silver sem histórico: carrega a última
        # publicação íntegra (mesmas unidades — o gold já guarda q/v finais)
        tris = (_gold_publicado().get("tri") or {}).get("dados") or {}
        tri_carregado = bool(tris)
    tri_keys = sorted(tris)
    if tri_keys:
        # último trimestre com Pix e cartões simultaneamente (evita trimestre parcial)
        tri0 = next((t for t in reversed(tri_keys)
                     if (tris[t].get("Pix", {}).get("q") or 0) > 0 and (tris[t].get("CartaoCredito", {}).get("q") or 0) > 0), tri_keys[-1])
        comp_q = sum(x["q"] or 0 for x in tris[tri0].values())
        part_pix_q = round((tris[tri0]["Pix"]["q"] or 0) / comp_q * 100, 1) if comp_q else None
    else:
        # nem fonte nem publicação anterior: o capítulo declara a ausência
        tri0, part_pix_q = None, None

    # ---------- composições (base transacional, cobertura declarada) ----------
    tx_meses = [r[0] for r in _rows(con, "SELECT DISTINCT anomes FROM pix_tx ORDER BY anomes")]
    if not tx_meses:
        # sem a base transacional não há composição honesta possível: stub com
        # motivo (em vez do IndexError que derrubou o painel em 08/08/2026)
        common.write_gold("pix.json", {"disponivel": False, "motivo": "base transacional (SPI) indisponível"})
        return {"ok": False, "error": "sem pix_tx"}
    t0 = tx_meses[-2] if len(tx_meses) > 1 else tx_meses[-1]  # penúltimo = mês fechado mais estável
    txq0, txv0 = _rows(con, "SELECT SUM(qtd), SUM(valor) FROM pix_tx WHERE anomes=?", (t0,))[0]
    mpq_t0 = (mp["Pix"].get(t0, (None, None))[0] or 0) * 1e3
    cobertura = round(txq0 / mpq_t0 * 100, 1) if mpq_t0 else None

    def comp_tx(dim, meses=None):
        meses = meses or [t0]
        out = {}
        for m in meses:
            for k, q, v in _rows(con, f"SELECT {dim}, SUM(qtd), SUM(valor) FROM pix_tx WHERE anomes=? GROUP BY {dim}", (m,)):
                out.setdefault(k, {})[m] = {"q": q, "v": v}
        return out
    ult12 = tx_meses[-13:-1] if len(tx_meses) > 13 else tx_meses
    nat_serie = comp_tx("natureza", tx_meses)
    forma_serie = comp_tx("forma", tx_meses)
    fin_serie = comp_tx("finalidade", tx_meses)
    idade0 = comp_tx("pag_idade")
    regiao0 = comp_tx("pag_regiao")

    def bloco_atual(d, ordem=None):
        tot_q = sum((x.get(t0) or {}).get("q") or 0 for x in d.values())
        tot_v = sum((x.get(t0) or {}).get("v") or 0 for x in d.values())
        out = []
        for k, x in d.items():
            c = x.get(t0)
            if not c or not c.get("q"):
                continue
            out.append({"k": k, "q": c["q"], "v": c["v"], "t": round(c["v"] / c["q"], 2),
                        "part_q": round(c["q"] / tot_q * 100, 2) if tot_q else None,
                        "part_v": round(c["v"] / tot_v * 100, 2) if tot_v else None})
        if ordem:
            pos = {k: i for i, k in enumerate(ordem)}
            out.sort(key=lambda x: pos.get(x["k"], 99))
        else:
            out.sort(key=lambda x: -(x["q"] or 0))
        return out

    def serie_share(d, chave):
        """participação mensal (%) da categoria `chave` na quantidade."""
        out = []
        for m in tx_meses:
            tot = sum((x.get(m) or {}).get("q") or 0 for x in d.values())
            c = (d.get(chave) or {}).get(m)
            out.append({"p": f"{m[:4]}-{m[4:6]}", "v": round(c["q"] / tot * 100, 3) if c and tot else None,
                        "q": c["q"] if c else None, "vl": c["v"] if c else None})
        return out

    # ---------- usuários e chaves ----------
    chaves_datas = [r[0] for r in _rows(con, "SELECT DISTINCT data FROM pix_chaves ORDER BY data")]
    chaves = {}
    if chaves_datas:
        dch = chaves_datas[-1]
        chaves = {
            "data": dch,
            "total": _rows(con, "SELECT SUM(qtd) FROM pix_chaves WHERE data=?", (dch,))[0][0],
            "por_tipo": [{"k": t, "q": q} for t, q in _rows(con,
                "SELECT tipo, SUM(qtd) FROM pix_chaves WHERE data=? GROUP BY tipo ORDER BY 2 DESC", (dch,))],
            "por_natureza": [{"k": t, "q": q} for t, q in _rows(con,
                "SELECT natureza, SUM(qtd) FROM pix_chaves WHERE data=? GROUP BY natureza", (dch,))],
            "top_participantes": [{"nome": n, "q": q, "seg": s} for n, q, s in _rows(con,
                "SELECT nome, SUM(qtd), MAX(segmento) FROM pix_chaves WHERE data=? GROUP BY nome ORDER BY 2 DESC LIMIT 15", (dch,))],
            "n_participantes": _rows(con, "SELECT COUNT(DISTINCT ispb) FROM pix_chaves WHERE data=?", (dch,))[0][0],
            "anterior": ({"data": chaves_datas[0],
                          "total": _rows(con, "SELECT SUM(qtd) FROM pix_chaves WHERE data=?", (chaves_datas[0],))[0][0]}
                         if len(chaves_datas) > 1 else None),
        }

    # ---------- geografia (municípios -> UF; mapa reusa malha IBGE) ----------
    mun_meses = [r[0] for r in _rows(con, "SELECT DISTINCT anomes FROM pix_mun ORDER BY anomes")]
    g0 = mun_meses[-2] if len(mun_meses) > 1 else (mun_meses[-1] if mun_meses else None)
    g12 = mun_meses[-14] if len(mun_meses) >= 14 else (mun_meses[0] if mun_meses else None)
    geo_uf, mun_top = [], []
    pop = {u: p for u, p in _rows(con, "SELECT uf, populacao FROM geo_uf")}
    nome2sigla = {n.upper(): s for s, n in _rows(con, "SELECT uf, nome FROM geo_uf")}
    if g0:
        cur = {}
        for uf_nome, vpf, qpf, vpj, qpj, vr_pf, qr_pf, vr_pj, qr_pj in _rows(con,
                """SELECT uf, SUM(vl_pag_pf), SUM(qt_pag_pf), SUM(vl_pag_pj), SUM(qt_pag_pj),
                          SUM(vl_rec_pf), SUM(qt_rec_pf), SUM(vl_rec_pj), SUM(qt_rec_pj)
                   FROM pix_mun WHERE anomes=? GROUP BY uf""", (g0,)):
            cur[uf_nome] = (vpf, qpf, vpj, qpj, vr_pf, qr_pf, vr_pj, qr_pj)
        ant = {u: (v or 0, q or 0) for u, v, q in _rows(con,
            "SELECT uf, SUM(vl_pag_pf + vl_pag_pj), SUM(qt_pag_pf + qt_pag_pj) FROM pix_mun WHERE anomes=? GROUP BY uf", (g12,))} if g12 else {}
        for uf_nome, (vpf, qpf, vpj, qpj, vr_pf, qr_pf, vr_pj, qr_pj) in cur.items():
            sig = nome2sigla.get(uf_nome.upper())
            if not sig:  # "não informado" na fonte — fica fora do mapa, permanece no total nacional
                continue
            p = pop.get(sig)
            v_pag, q_pag = (vpf or 0) + (vpj or 0), (qpf or 0) + (qpj or 0)
            a = ant.get(uf_nome)
            geo_uf.append({
                "uf": sig, "nome": uf_nome.title(),
                "v_pag": round(v_pag), "q_pag": round(q_pag),
                "v_rec": round((vr_pf or 0) + (vr_pj or 0)), "q_rec": round((qr_pf or 0) + (qr_pj or 0)),
                "v_pag_pf": round(vpf or 0), "v_pag_pj": round(vpj or 0),
                "t_pag": round(v_pag / q_pag, 2) if q_pag else None,
                "q_hab": round(q_pag / p, 1) if p else None,
                "v_hab": round(v_pag / p) if p else None,
                "yoy_v": round((v_pag / a[0] - 1) * 100, 1) if a and a[0] else None,
            })
        mun_top = [{"cod": c, "mun": mn.title(), "uf": nome2sigla.get(u.upper()), "v_pag": round((vp or 0) + (vj or 0)),
                    "q_pag": round((qp or 0) + (qj or 0)), "pes_pag": round((pp or 0) + (pj2 or 0))}
                   for c, mn, u, vp, vj, qp, qj, pp, pj2 in _rows(con,
                       """SELECT cod_ibge, municipio, uf, vl_pag_pf, vl_pag_pj, qt_pag_pf, qt_pag_pj,
                                 pes_pag_pf, pes_pag_pj FROM pix_mun WHERE anomes=?
                          ORDER BY (vl_pag_pf + vl_pag_pj) DESC LIMIT 4000""", (g0,))]

    # ---------- EPAE (setor do recebedor) ----------
    cn_meses = [r[0] for r in _rows(con, "SELECT DISTINCT anomes FROM pix_cnae ORDER BY anomes")]
    epae = {}
    if cn_meses:
        c0 = cn_meses[-2] if len(cn_meses) > 1 else cn_meses[-1]
        c12 = cn_meses[-14] if len(cn_meses) >= 14 else cn_meses[0]
        tot_v0 = _rows(con, "SELECT SUM(valor) FROM pix_cnae WHERE anomes=?", (c0,))[0][0] or 1
        setores = []
        ant = {s: v for s, v in _rows(con, "SELECT cnssecao, SUM(valor) FROM pix_cnae WHERE anomes=? GROUP BY cnssecao", (c12,))}
        for s, q, v, vc, mei_v in _rows(con,
                """SELECT cnssecao, SUM(qtd), SUM(valor), SUM(vl_compra),
                          SUM(CASE WHEN mei='S' THEN valor ELSE 0 END)
                   FROM pix_cnae WHERE anomes=? GROUP BY cnssecao ORDER BY 3 DESC""", (c0,)):
            setores.append({"setor": s, "q": q, "v": v, "t": round(v / q, 2) if q else None,
                            "part": round(v / tot_v0 * 100, 2),
                            "compra_pct": round(vc / v * 100, 1) if v else None,
                            "mei_pct": round(mei_v / v * 100, 1) if v else None,
                            "yoy": round((v / ant[s] - 1) * 100, 1) if ant.get(s) else None})
        matriz = {}
        for s, nrel, v in _rows(con,
                "SELECT cnssecao, naturezarel, SUM(valor) FROM pix_cnae WHERE anomes=? GROUP BY cnssecao, naturezarel", (c0,)):
            matriz.setdefault(s, {})[nrel] = round(v)
        top5 = sum(x["part"] for x in setores[:5])
        epae = {"mes": f"{c0[:4]}-{c0[4:6]}", "mes_yoy": f"{c12[:4]}-{c12[4:6]}", "setores": setores,
                "matriz_naturezarel": matriz, "concentracao_top5_pct": round(top5, 1),
                "serie": [{"p": f"{m[:4]}-{m[4:6]}", "v": _rows(con, "SELECT SUM(valor) FROM pix_cnae WHERE anomes=?", (m,))[0][0]}
                          for m in cn_meses]}

    epae_matriz = epae_matriz_te(con)

    # ---------- MED ----------
    import json as _json
    med = []
    for am, payload in _rows(con, "SELECT anomes, payload FROM pix_med ORDER BY anomes"):
        d = _json.loads(payload)
        med.append({"p": f"{am[:4]}-{am[4:6]}",
                    "contestados_q": d.get("QtdePixcontestados"), "aceitas_q": d.get("Qtdecontestacoesaceitas"),
                    "aceitas_100mil": d.get("Qtdecontestacoesaceitasacada100mil"),
                    "valor_contestado": d.get("ValorPixcontestadosaceitos"),
                    "dev_integral_q": d.get("QuantidadedevolvidaintegralmentepormeiodoMED"),
                    "dev_integral_v": d.get("ValorPixdevolvidosintegralmente"),
                    "dev_parcial_v": d.get("ValorPixdevolvidosparcialmente"),
                    "pct_devolucao": d.get("PercentualdeDevolucao"),
                    "usuarios_marcados": d.get("QtdeUsuarioscommarcacoesdefraude"),
                    "chaves_marcadas": d.get("QtdeChavesPixcommarcacoesdefraude")})
    med_carregado = False
    if not med:
        # EstatisticasFraudesPix devolvendo zero linhas (pane observada em
        # 08/08/2026): o capítulo do MED carrega a última publicação íntegra
        med = _gold_publicado().get("med") or []
        med_carregado = bool(med)

    # ---------- SPI ----------
    spi_d = [{"p": d, "q": q, "v": v} for d, q, v in _rows(con, "SELECT data, quantidade, total FROM spi_diario ORDER BY data")]
    spi = {
        "diario_ult90": spi_d[-90:],
        "pico": max(spi_d, key=lambda x: x["q"] or 0) if spi_d else None,
        "intradia": [{"h": h, "q": q, "v": v} for h, q, v in _rows(con, "SELECT horario, qtd_media, total_medio FROM spi_intradia ORDER BY horario")],
        "disponibilidade": [{"p": d, "i": i, "min": m} for d, i, m in _rows(con, "SELECT database, indice, minimo FROM spi_disp ORDER BY database")][-24:],
        "nota": "SPI = infraestrutura de liquidação do BCB; exclui transações liquidadas nos livros dos próprios participantes. O universo completo (doc 1201) é a série do MPV.",
    }

    # ---------- síntese automática (determinística, sem linguagem promocional) ----------
    yoy_q = (q0 / q12 - 1) * 100 if q12 else None
    yoy_v = (v0 / v12 - 1) * 100 if v12 else None
    nat0 = bloco_atual(nat_serie, NATS)
    p2b = next((x for x in nat0 if x["k"] == "P2B"), None)
    rot_tri = f"{tri0[:4]}-T{(int(tri0[5:7]) + 2) // 3}" if tri0 else None
    sintese = (f"Em {m0[:4]}-{m0[4:6]}, o Pix registrou {qtd0/1e9:.2f} bilhões de transações "
               f"(+{yoy_q:.1f}% em 12 meses) movimentando R$ {val0/1e12:.2f} trilhões (+{yoy_v:.1f}%), "
               f"com valor médio de R$ {tick0:.0f} por transação. ")
    if rot_tri and part_pix_q is not None:
        sintese += (f"No trimestre {rot_tri}, o Pix respondeu por {part_pix_q}% da quantidade de transações "
                    f"entre os instrumentos comparados. ")
    if p2b:
        sintese += f"Pagamentos de pessoas a empresas (P2B) já são {p2b['part_q']:.0f}% da quantidade na base transacional."

    catalogo = [
        {"id": "pix_qtd", "nome": "Transações Pix (quantidade)", "conceito": "total mensal de transações Pix do universo doc 1201 (inclui liquidação fora do SPI)", "formula": "quantidadePix × 1.000", "unidade": "transações", "periodicidade": "mensal", "fonte": "BCB MPV_DadosAbertos MeiosdePagamentosMensalDA", "inicio": "2020-11", "transformacoes": "unidade original em milhares", "limitacoes": "revisões retroativas da fonte", "versao": "v1"},
        {"id": "pix_valor", "nome": "Valor movimentado (nominal)", "conceito": "valor mensal transacionado", "formula": "valorPix × 1.000.000", "unidade": "R$", "periodicidade": "mensal", "fonte": "idem", "inicio": "2020-11", "transformacoes": "R$ milhões → R$", "limitacoes": "nominal", "versao": "v1"},
        {"id": "pix_valor_real", "nome": "Valor movimentado (real)", "conceito": "valor deflacionado a preços do último mês do IPCA", "formula": "valor × Π(1+IPCA)", "unidade": "R$ constantes", "periodicidade": "mensal", "fonte": "MPV + IBGE/SGS 433", "inicio": "2020-11", "transformacoes": "deflação IPCA", "limitacoes": "IPCA defasa 1 mês", "versao": "v1"},
        {"id": "pix_ticket", "nome": "Valor médio por transação", "conceito": "valor ÷ quantidade", "formula": "valor/qtd", "unidade": "R$", "periodicidade": "mensal", "fonte": "MPV", "inicio": "2020-11", "transformacoes": "—", "limitacoes": "média esconde bimodalidade P2P×B2B", "versao": "v1"},
        {"id": "dict_usuarios", "nome": "Usuários cadastrados no DICT", "conceito": "ESTOQUE de usuários com chave cadastrada; não é 'usuário ativo'", "formula": "—", "unidade": "usuários", "periodicidade": "snapshot", "fonte": "Pix_DadosAbertos PixUsuariosCadastradosDICT", "inicio": "2020-11", "transformacoes": "—", "limitacoes": "chave ≠ usuário; sem definição oficial de atividade", "versao": "v1"},
        {"id": "part_pix_tri", "nome": "Participação do Pix (quantidade, trimestral)", "conceito": "share do Pix na quantidade entre os instrumentos do MPV trimestral", "formula": "qtd_Pix/Σqtd", "unidade": "%", "periodicidade": "trimestral", "fonte": "MPV trimestral", "inicio": "2015", "transformacoes": "mensais somados por trimestre; nada interpolado", "limitacoes": "cartão de crédito inclui financiamento; instrumentos não são substitutos perfeitos", "versao": "v1"},
        {"id": "cobertura_tx", "nome": "Cobertura da base transacional", "conceito": "quanto da quantidade do universo (MPV) está na base transacional usada nas composições", "formula": "qtd_tx/qtd_MPV", "unidade": "%", "periodicidade": "mensal", "fonte": "cálculo próprio", "inicio": "2020-11", "transformacoes": "—", "limitacoes": "gap = liquidação fora do SPI", "versao": "v1"},
        {"id": "med_aceitas_100mil", "nome": "Contestações aceitas por 100 mil transações", "conceito": "incidência oficial do MED; contestação ≠ fraude confirmada", "formula": "campo oficial", "unidade": "por 100 mil", "periodicidade": "mensal", "fonte": "EstatisticasFraudesPix", "inicio": "2021", "transformacoes": "—", "limitacoes": "conceitos do MED, não sentença judicial", "versao": "v1"},
        {"id": "epae_setor", "nome": "Recebimentos Pix por seção CNAE", "conceito": "fluxo financeiro RECEBIDO por setor; NÃO é receita/faturamento/valor adicionado", "formula": "Σ vllanliq", "unidade": "R$", "periodicidade": "mensal", "fonte": "Pix_DadosAbertos CnaePorteRecebedor (EPAE)", "inicio": "2025-01 (recorte carregado)", "transformacoes": "agregação por seção", "limitacoes": "lado pagador só como PF/PJ/G; sinal complementar de atividade", "versao": "v1"},
        {"id": "epae_matriz", "nome": "Matriz setor-pagador × setor-recebedor", "conceito": "fluxo Pix entre seções da CNAE, com o SETOR de quem paga — a dimensão que a EPAE aberta não tem; NÃO é receita nem consumo", "formula": "valor por par pagador×recebedor no mês", "unidade": "R$ bi", "periodicidade": "mensal (revisão até m-4)", "fonte": "BCB, tabela especial EPAE (SPI apenas)", "inicio": "2020-11", "transformacoes": "rótulo PT; participação de PF→setor sobre o Pix PF→PJ (mesmo conceito do painel de bets)", "limitacoes": "universo SPI ≠ EPAE aberta (nunca somados); seção não isola atividade específica (ex.: bets dentro de artes/recreação)", "versao": "v1"},
    ]

    geo_meta = {k: v for k, v in _rows(con, "SELECT k, v FROM geo_meta")}
    common.write_gold("pix.json", {
        "disponivel": True, "gerado_em": common.now_utc(),
        "mes": f"{m0[:4]}-{m0[4:6]}",
        "cobertura_tx_pct": cobertura, "mes_tx": f"{t0[:4]}-{t0[4:6]}",
        "sintese": sintese,
        "kpis": {
            "qtd": {"v": qtd0, "yoy": round(yoy_q, 1)},
            "valor": {"v": val0, "yoy": round(yoy_v, 1), "vr": val0 * defl.get(m0, 1)},
            "ticket": {"v": round(tick0, 2), "yoy": round((tick0 / (v12 * 1e6 / (q12 * 1e3)) - 1) * 100, 1) if q12 and v12 else None},
            "usuarios": {"v": dict_ult[3] if dict_ult else None, "pf": dict_ult[1] if dict_ult else None,
                         "pj": dict_ult[2] if dict_ult else None, "data": dict_ult[0] if dict_ult else None},
            "part_tri": {"v": part_pix_q, "tri": rot_tri},
        },
        "series": series_mensais,
        "tri": {"periodos": tri_keys, "dados": tris, "tri0": tri0, "nomes": INSTRUMENTOS},
        "usuarios_serie": [{"p": d[:7], "pf": pf, "pj": pj, "total": t} for d, pf, pj, t in dict_rows],
        "chaves": chaves,
        "natureza": {"atual": nat0, "serie_p2b": serie_share(nat_serie, "P2B"), "serie_p2p": serie_share(nat_serie, "P2P"),
                     "idade_pagador": bloco_atual(idade0), "regiao_pagador": bloco_atual(regiao0)},
        "formas": {"atual": bloco_atual(forma_serie), "nomes": FORMAS,
                   "serie_auto": serie_share(forma_serie, "AUTO"), "serie_inic": serie_share(forma_serie, "INIC"),
                   "serie_qrdn": serie_share(forma_serie, "QRDN"), "serie_apes": serie_share(forma_serie, "APES"),
                   "serie_apdn": serie_share(forma_serie, "APDN")},
        "finalidades": {"atual": bloco_atual(fin_serie), "serie_saque": serie_share(fin_serie, "Pix Saque"),
                        "serie_troco": serie_share(fin_serie, "Pix Troco")},
        "geografia": {"mes": f"{g0[:4]}-{g0[4:6]}" if g0 else None, "ufs": geo_uf,
                      "geo": {"viewBox": geo_meta.get("viewBox"), "transform": geo_meta.get("transform"),
                              "paths": {s: d for s, d in _rows(con, "SELECT uf, svg_d FROM geo_uf WHERE svg_d IS NOT NULL")}},
                      "nota_perspectiva": "município/UF do PAGADOR e do RECEBEDOR são perspectivas distintas — o mapa permite alternar."},
        "epae": epae,
        "epae_matriz": epae_matriz,
        "med": med,
        "spi": spi,
        "catalogo": catalogo,
        "cautelas": [
            "O Pix não é uma categoria homogênea: inclui transferências pessoais (P2P), pagamentos comerciais (P2B/B2B) e fluxos com o governo — não é substituto direto de um único instrumento.",
            "Cartão de crédito combina pagamento e financiamento; compare quantidade, valor e tíquete separadamente.",
            "A TED tem tíquete muito alto e uso empresarial — a comparação por valor não indica popularidade.",
            "Saques medem retiradas, não o total de transações em dinheiro físico.",
            f"Composições usam a base transacional (liquidação SPI), que cobre {cobertura}% da quantidade do universo (doc 1201) — o restante é liquidado nos livros dos participantes.",
            "Usuários DICT e chaves são ESTOQUES de fim de período (nunca somados no tempo); chave ≠ usuário; não usamos o termo 'usuário ativo' por não haver definição oficial.",
            "EPAE mede fluxo financeiro recebido por setor — não é receita, consumo, faturamento nem valor adicionado.",
            "Contestação via MED não é fraude confirmada; os campos exibidos usam exatamente os conceitos oficiais.",
        ] + ([
            "A fonte trimestral do MPV está fora do ar no BCB; o capítulo de comparação entre instrumentos mantém a última posição publicada até a fonte voltar.",
        ] if tri_carregado else []) + ([
            "A estatística do MED está fora do ar no BCB; o capítulo de devoluções mantém a última posição publicada até a fonte voltar.",
        ] if med_carregado else []),
    })
    common.write_gold("pix_mun.json", {"mes": f"{g0[:4]}-{g0[4:6]}" if g0 else None,
                                       "nota": "valores do mês, perspectiva do PAGADOR (PF+PJ); pes_pag = pessoas distintas pagadoras",
                                       "municipios": mun_top})
    return {"ok": True, "meses_mpv": len(meses_pix), "meses_tx": len(tx_meses), "ufs": len(geo_uf),
            "setores_epae": len(epae.get("setores", [])), "med": len(med), "cobertura": cobertura}
