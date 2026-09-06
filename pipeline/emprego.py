"""Emprego formal setorial (Novo Caged) — gold emprego.json.

Duas fontes, duas réguas, declaradas separadamente:
1. **Estoque** de vínculos formais por seção CNAE 2.0 (MTE/Novo Caged, republicado
   pelo BCB/SGS 28763 a 28804, com e sem ajuste sazonal). Saldo do mês = variação do
   estoque; saldo em 12 meses = estoque hoje menos estoque há 12 meses; variação a/a
   = saldo em 12 meses ÷ estoque há 12 meses.
2. **Admissões e desligamentos** por UF (MTE/Novo Caged sem ajuste, republicado pelo
   Ipeadata). Saldo = admissões − desligamentos. O Brasil do Ipeadata fecha com a
   variação do estoque do SGS no mesmo mês; a diferença é publicada, nunca escondida.

O que sai daqui alimenta o score de Risco setorial: para cada seção, o z-score da
variação a/a do estoque contra a própria história desde 2013-01 (a mesma régua dos
demais componentes do score: histórico completo, com a recessão de 2015-16 e a
pandemia dentro da amostra; uma janela curta desde 2022 rotularia como contração
qualquer crescimento abaixo do rebote pós-pandemia). Seção com estoque em queda
fora do padrão puxa "capacidade financeira" para cima no estresse; divisões CNAE
herdam a seção porque o SGS só republica o corte por seção.

Regras: ausência é nulo; o último mês é preliminar (declarações fora do prazo
revisam o estoque e o saldo); o corte por UF não tem estoque, então a régua ali é
saldo e retenção (saldo ÷ admissões), nunca "variação do estoque".
"""
from pipeline import common
from pipeline.ufs import NOMES, REGIOES
from pipeline.fmt import _r, _share, _mes_menos, _mil, _dec

FONTES = {
    "sgs": {"nome": "MTE/Novo Caged — estoque de empregos formais por seção CNAE (republicado pelo BCB/SGS 28763 a 28804)",
            "url": "https://api.bcb.gov.br/dados/serie/bcdata.sgs.28763/dados?formato=json",
            "catalogo": "https://www3.bcb.gov.br/sgspub/",
            "licenca": "dados abertos do BCB", "nivel": "A — registro administrativo (eSocial/Caged), mensal, com ajuste sazonal do BCB"},
    "ipea": {"nome": "MTE/Novo Caged — admissões e desligamentos por UF (republicado pelo Ipeadata, séries ADMISNC e DESLIGNC)",
             "url": "http://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='ADMISNC')",
             "catalogo": "http://www.ipeadata.gov.br/",
             "licenca": "dados abertos do Ipea", "nivel": "A — registro administrativo, mensal desde 2020-01, sem ajuste"},
}
# (chave, nome curto, seções CNAE cobertas, agregado?) — ordem de publicação do BCB
SECOES = [
    ("total", "Total", "todas", True),
    ("A", "Agropecuária", "A", False),
    ("B", "Indústrias extrativas", "B", False),
    ("C", "Indústrias de transformação", "C", False),
    ("SIUP", "Serviços industriais de utilidade pública", "D + E", True),
    ("D", "Eletricidade e gás", "D", False),
    ("E", "Água, esgoto e gestão de resíduos", "E", False),
    ("F", "Construção", "F", False),
    ("G", "Comércio", "G", False),
    ("SERV", "Serviços (total)", "H a S", True),
    ("H", "Transporte, armazenagem e correio", "H", False),
    ("I", "Alojamento e alimentação", "I", False),
    ("J", "Informação e comunicação", "J", False),
    ("K", "Atividades financeiras e seguros", "K", False),
    ("L", "Atividades imobiliárias", "L", False),
    ("M", "Atividades profissionais, científicas e técnicas", "M", False),
    ("N", "Atividades administrativas e serviços complementares", "N", False),
    ("O", "Administração pública, defesa e seguridade social", "O", False),
    ("P", "Educação", "P", False),
    ("Q", "Saúde e serviços sociais", "Q", False),
    ("S", "Outras atividades de serviços", "S", False),
]
INICIO_Z = "2013-01"      # janela do z-score da variação a/a: histórico completo do SGS (declarada no gold)
MIN_OBS_Z = 24
SERIE_MESES = 72


def _sgs(con, key):
    return [(d[:7], v) for d, v in common.get_series(con, key)]


def _z(vals):
    if len(vals) < MIN_OBS_Z:
        return None, None, None
    m = sum(vals) / len(vals)
    s = (sum((v - m) ** 2 for v in vals) / (len(vals) - 1)) ** 0.5
    if s < 1e-9:
        return None, m, s
    return (vals[-1] - m) / s, m, s


def _faixa(z):
    if z is None:
        return None
    return "contração" if z <= -1 else "fraco" if z < -0.5 else "na média" if z <= 0.5 else "forte" if z < 1 else "aquecido"


def _serie_secao(con, key):
    est = dict(_sgs(con, f"emp_{key}"))
    sa = dict(_sgs(con, f"emp_sa_{key}"))
    meses = sorted(est)
    pts = []
    for mes in meses:
        ant, ant12 = _mes_menos(mes, 1), _mes_menos(mes, 12)
        pts.append({"ref": mes, "estoque": est[mes],
                    "saldo": est[mes] - est[ant] if ant in est else None,
                    "saldo_sa": sa[mes] - sa[ant] if mes in sa and ant in sa else None,
                    "saldo_12m": est[mes] - est[ant12] if ant12 in est else None,
                    "yoy_pct": _r((est[mes] / est[ant12] - 1) * 100, 3) if ant12 in est and est[ant12] else None})
    return pts


def _bloco_secao(key, nome, cnae, agregado, pts, tot_estoque):
    if not pts:
        return None
    u = pts[-1]
    ant = pts[-13] if len(pts) > 13 else None
    yoy_hist = [(p["ref"], p["yoy_pct"]) for p in pts if p["yoy_pct"] is not None and p["ref"] >= INICIO_Z]
    z, media, dp = _z([v for _, v in yoy_hist])
    return {
        "key": key, "nome": nome, "cnae": cnae, "agregado": agregado, "mes": u["ref"],
        "estoque": u["estoque"], "share_pct": None if key == "total" else _share(u["estoque"], tot_estoque),
        "saldo_mes": u["saldo"], "saldo_mes_sa": _r(u["saldo_sa"], 0), "saldo_12m": u["saldo_12m"],
        "saldo_12m_anterior": ant["saldo_12m"] if ant else None,
        "yoy_pct": _r(u["yoy_pct"]), "z": _r(z), "faixa": _faixa(z), "yoy_media_janela": _r(media), "yoy_dp_janela": _r(dp),
        "n_obs_z": len(yoy_hist),
        "serie_yoy": [{"ref": r, "v": _r(v)} for r, v in yoy_hist[-36:]],
        "serie_saldo": [{"ref": p["ref"], "v": p["saldo"]} for p in pts[-36:] if p["saldo"] is not None],
    }


def _ufs(con):
    rows = con.execute("SELECT mes, uf, admissoes, desligamentos FROM caged_uf ORDER BY mes").fetchall()
    if not rows:
        return None, None, None
    por = {}
    for mes, uf, a, d in rows:
        por.setdefault(uf, {})[mes] = (a, d)
    mes = max(m for uf in por for m in por[uf])

    def janela(d, fim, n=12):
        ini = _mes_menos(fim, n - 1)
        sel = [v for m, v in d.items() if ini <= m <= fim and v[0] is not None and v[1] is not None]
        if len(sel) < n:
            return None, None, None
        a, dd = sum(v[0] for v in sel), sum(v[1] for v in sel)
        return a, dd, a - dd

    def bloco(uf, d):
        a, dd = d.get(mes, (None, None))
        a12, d12, s12 = janela(d, mes)
        _a, _d, s12a = janela(d, _mes_menos(mes, 12))
        serie = []
        for m in sorted(d)[-36:]:
            x = d[m]
            if x[0] is not None and x[1] is not None:
                serie.append({"ref": m, "v": x[0] - x[1]})
        return {"uf": uf, "nome": "Brasil" if uf == "BR" else NOMES.get(uf, uf), "regiao": None if uf == "BR" else REGIOES.get(uf), "mes": mes,
                "admissoes_mes": a, "desligamentos_mes": dd, "saldo_mes": a - dd if a is not None and dd is not None else None,
                "admissoes_12m": a12, "desligamentos_12m": d12, "saldo_12m": s12, "saldo_12m_anterior": s12a,
                "retencao_pct": _r(s12 / a12 * 100) if s12 is not None and a12 else None,
                "serie_saldo": serie}
    brasil = bloco("BR", por["BR"]) if "BR" in por else None
    ufs = [bloco(uf, d) for uf, d in sorted(por.items()) if uf != "BR" and uf in NOMES]
    for chave in ("saldo_12m", "retencao_pct", "saldo_mes"):
        ordem = sorted([u for u in ufs if u[chave] is not None], key=lambda u: -u[chave])
        for i, u in enumerate(ordem):
            u.setdefault("posicoes", {})[chave] = i + 1
    return mes, brasil, ufs


def _sinal(v):
    return ("+" if v >= 0 else "") + _mil(v)


def build(con, cfg=None):
    pts_total = _serie_secao(con, "total")
    if len(pts_total) < 14:
        return {"disponivel": False, "motivo": "séries emp_* do SGS ausentes ou curtas — rode o coletor bcb_sgs"}
    tot_est = pts_total[-1]["estoque"]
    setores = []
    for key, nome, cnae, agregado in SECOES:
        b = _bloco_secao(key, nome, cnae, agregado, pts_total if key == "total" else _serie_secao(con, key), tot_est)
        if b:
            setores.append(b)
    total = next(s for s in setores if s["key"] == "total")
    por_key = {s["key"]: s for s in setores}
    # soma das seções não agregadas vs. total: o BCB não republica R, T e U; a diferença é o "não itemizado"
    soma_secoes = sum(s["estoque"] for s in setores if not s["agregado"])
    nao_itemizado = tot_est - soma_secoes
    # total − (A + B + C + SIUP + F + G + Serviços): vínculos sem seção classificada no SGS (dezenas, não milhares)
    nao_classificado = tot_est - sum(por_key[k]["estoque"] for k in ("A", "B", "C", "SIUP", "F", "G", "SERV") if k in por_key)
    mes_uf, brasil_uf, ufs = _ufs(con)
    # Brasil − soma das 27 UFs no mês: vínculos sem UF identificada no Novo Caged (publicado, nunca rateado)
    ufs_nao_identificado = None
    if brasil_uf and ufs and brasil_uf["admissoes_mes"] is not None:
        ufs_nao_identificado = {"mes": brasil_uf["mes"],
                                "admissoes": brasil_uf["admissoes_mes"] - sum(u["admissoes_mes"] or 0 for u in ufs),
                                "desligamentos": brasil_uf["desligamentos_mes"] - sum(u["desligamentos_mes"] or 0 for u in ufs)}
    recon = None
    if brasil_uf and brasil_uf["mes"] == total["mes"] and brasil_uf["saldo_mes"] is not None and total["saldo_mes"] is not None:
        recon = {"mes": total["mes"], "saldo_sgs": total["saldo_mes"], "saldo_ipea": brasil_uf["saldo_mes"],
                 "diferenca": total["saldo_mes"] - brasil_uf["saldo_mes"]}
    secoes_z = {s["key"]: s["z"] for s in setores if s["z"] is not None and s["key"] != "total"}
    ranking = sorted([s for s in setores if not s["agregado"] and s["z"] is not None], key=lambda s: s["z"])
    piores, melhores = ranking[:3], ranking[-3:][::-1]
    serie = [{"ref": p["ref"], "estoque": p["estoque"], "saldo": p["saldo"], "saldo_sa": _r(p["saldo_sa"], 0), "yoy_pct": _r(p["yoy_pct"])} for p in pts_total[-SERIE_MESES:]]
    saldo_12m = total["saldo_12m"]
    sintese = (f"O Brasil tinha {_mil(tot_est)} vínculos formais em {total['mes']}, {_sinal(saldo_12m)} em 12 meses "
               f"({'+' if total['yoy_pct'] >= 0 else ''}{_dec(total['yoy_pct'])}% a/a) e {_sinal(total['saldo_mes'])} no mês"
               + (f" ({_sinal(total['saldo_mes_sa'])} com ajuste sazonal)" if total["saldo_mes_sa"] is not None else "") + ". ")
    if piores and melhores:
        sintese += (f"Contra a própria história desde {INICIO_Z}, o emprego mais fraco está em {piores[0]['nome'].lower()} "
                    f"(z {_dec(piores[0]['z'])}, {'+' if piores[0]['yoy_pct'] >= 0 else ''}{_dec(piores[0]['yoy_pct'])}% a/a) e o mais forte em "
                    f"{melhores[0]['nome'].lower()} (z {_dec(melhores[0]['z'])}, {'+' if melhores[0]['yoy_pct'] >= 0 else ''}{_dec(melhores[0]['yoy_pct'])}% a/a). ")
    if brasil_uf and ufs:
        top = max(ufs, key=lambda u: u["saldo_12m"] or -1e12)
        sintese += f"Por UF, o maior saldo em 12 meses é {top['nome']} ({_sinal(top['saldo_12m'])} vínculos)."
    return {
        "disponivel": True, "tipo": "DADO OBSERVADO (estoque, admissões, desligamentos) + CALCULADO (saldos, z-scores, posições)",
        "mes": total["mes"], "mes_preliminar": True, "janela_z": {"inicio": INICIO_Z, "min_obs": MIN_OBS_Z},
        "fontes": FONTES,
        "brasil": {"mes": total["mes"], "estoque": tot_est, "saldo_mes": total["saldo_mes"], "saldo_mes_sa": total["saldo_mes_sa"],
                   "saldo_12m": saldo_12m, "saldo_12m_anterior": total["saldo_12m_anterior"], "yoy_pct": total["yoy_pct"],
                   "admissoes_mes": brasil_uf["admissoes_mes"] if brasil_uf else None, "desligamentos_mes": brasil_uf["desligamentos_mes"] if brasil_uf else None,
                   "admissoes_12m": brasil_uf["admissoes_12m"] if brasil_uf else None, "desligamentos_12m": brasil_uf["desligamentos_12m"] if brasil_uf else None,
                   "rotatividade_12m_pct": _r(brasil_uf["desligamentos_12m"] / tot_est * 100) if brasil_uf and brasil_uf["desligamentos_12m"] else None,
                   "nao_itemizado": nao_itemizado, "nao_itemizado_pct": _share(nao_itemizado, tot_est), "nao_classificado": nao_classificado},
        "serie": serie,
        "setores": setores, "secoes_z": secoes_z,
        "ufs": ufs, "ufs_mes": mes_uf, "ufs_nao_identificado": ufs_nao_identificado,
        "reconciliacao": recon,
        "sintese": sintese,
        "metodo": ("Estoque por seção CNAE 2.0 do Novo Caged, republicado pelo BCB/SGS (28763 a 28804). Saldo do mês = variação do estoque; "
                   "saldo em 12 meses = estoque hoje − estoque há 12 meses; variação a/a = saldo em 12 meses ÷ estoque há 12 meses. "
                   f"O z-score compara a variação a/a de cada seção com a própria média e desvio-padrão desde {INICIO_Z} "
                   f"(mínimo {MIN_OBS_Z} observações): abaixo de −1 é contração, acima de +1 é aquecido. Por UF (Ipeadata): "
                   "saldo = admissões − desligamentos; retenção = saldo em 12 meses ÷ admissões em 12 meses. Posições entre as 27 UFs, "
                   "nunca somando réguas. O Brasil do Ipeadata é conferido contra a variação do estoque do SGS no mesmo mês."),
        "limitacoes": ("O último mês é preliminar: declarações fora do prazo revisam estoque e saldo dos meses anteriores. O SGS só republica "
                       "o corte por seção (sem divisão CNAE, sem UF por seção); as seções R, T e U não são itemizadas e aparecem como "
                       "'não itemizado' dentro de Serviços; um resíduo de vínculos sem seção fica fora de todas. No corte por UF, "
                       "admissões e desligamentos sem UF identificada ficam fora das 27 UFs e são publicados como tal. Emprego formal celetista: não cobre estatutários, informais nem MEI. Vínculo não é renda: "
                       "o painel mede quantidade de postos, não massa salarial."),
        "cautelas": [
            "Saldo positivo não é demanda por crédito nem capacidade de pagamento; é um dos insumos do score setorial, com peso declarado.",
            "Comparar seções pelo z-score compara cada uma com a própria história, não uma com a outra em nível.",
            "Sazonalidade: dezembro tem desligamentos concentrados; o saldo com ajuste sazonal do BCB existe só para o total e para as seções publicadas.",
            "Novo Caged desde 2020-01 (eSocial + Caged + Empregador Web); antes disso o BCB encadeia a série com o Caged antigo. O encadeamento é do BCB, não do Observatório, e a série não mostra degrau em 2020-01.",
        ],
        "catalogo": [
            {"nome": "Estoque de vínculos", "definicao": "vínculos formais celetistas ativos no fim do mês, por seção CNAE 2.0", "unidade": "vínculos", "fonte": "MTE/Novo Caged via BCB/SGS", "limitacoes": "preliminar no último mês; sem R, T e U"},
            {"nome": "Saldo do mês", "definicao": "variação do estoque no mês (SGS) ou admissões − desligamentos (Ipeadata)", "unidade": "vínculos", "fonte": "BCB/SGS e Ipeadata", "limitacoes": "as duas fontes fecham no Brasil; diferença publicada"},
            {"nome": "Variação a/a", "definicao": "saldo em 12 meses ÷ estoque há 12 meses", "unidade": "%", "fonte": "calculado", "limitacoes": "sensível a revisões do estoque"},
            {"nome": "z-score", "definicao": f"variação a/a menos a média da própria seção desde {INICIO_Z}, em desvios-padrão", "unidade": "σ", "fonte": "calculado", "limitacoes": f"histórico desde {INICIO_Z}, com recessão e pandemia dentro da amostra; mínimo {MIN_OBS_Z} observações"},
            {"nome": "Retenção (UF)", "definicao": "saldo em 12 meses ÷ admissões em 12 meses", "unidade": "%", "fonte": "calculado", "limitacoes": "não é rotatividade; UF sem estoque no Ipeadata"},
        ],
    }
