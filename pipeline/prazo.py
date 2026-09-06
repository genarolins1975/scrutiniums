"""Prazo e vencimentos da carteira — gold prazo.json.

Uma fonte, uma régua: o SCR.data do BCB (carteira ativa por UF e por tipo de cliente, com
a carteira A VENCER aberta em seis faixas de prazo remanescente: até 90 dias, 91 a 360,
361 a 1.080, 1.081 a 1.800, 1.801 a 5.400 e acima de 5.400 dias). As faixas já estão no
silver (`scr_uf`, colunas pz*) desde a primeira carga do SCR.data; este builder só as
publica. Responde a rolagem e refinanciamento: quanto da carteira vence em 12 meses, quanto
é longo, como o perfil muda mês a mês e onde é mais curto.

Regras:
- A vencer = soma das seis faixas. Vencido = carteira ativa menos a vencer (o SCR.data
  publica o vencido em duas faixas, 15 a 90 dias e acima de 90, mais a parcela até 14 dias
  que só aparece por diferença). Nada é estimado: cada número é uma soma da fonte.
- Prazo médio residual é APROXIMAÇÃO declarada: ponto médio de cada faixa (45, 225, 720,
  1.440, 3.600 dias) e 7.200 dias (20 anos) para a faixa aberta acima de 5.400. Serve para
  comparar UFs e meses, não como duração contratual.
- Curto prazo = até 360 dias; longo = acima de 1.800 dias (5 anos). Shares sobre a carteira
  a vencer, nunca sobre a carteira ativa, para não misturar vencido com prazo.
- Por UF: domicílio do tomador, como no SCR.data. Posições entre as 27 UFs.
- Sem corte por produto: o silver agrega as faixas só por UF × cliente (a malha completa do
  CSV, por modalidade, não é guardada). Declarado em limitações.
"""
from pipeline import common
from pipeline.fmt import _r, _share, _dec, _mes_menos
from pipeline.ufs import NOMES, REGIOES

FONTE = {"nome": "BCB — SCR.data (carteira ativa por UF, tipo de cliente e faixa de prazo a vencer)",
         "url": "https://dadosabertos.bcb.gov.br/dataset/scr_data",
         "licenca": "dados abertos do BCB", "nivel": "A — registro administrativo do supervisor, mensal"}
# (id, nome, dias_ini, dias_fim, ponto_medio_dias)
FAIXAS = [
    ("ate90", "até 90 dias", 0, 90, 45),
    ("de91a360", "91 a 360 dias", 91, 360, 225),
    ("de361a1080", "1 a 3 anos", 361, 1080, 720),
    ("de1081a1800", "3 a 5 anos", 1081, 1800, 1440),
    ("de1801a5400", "5 a 15 anos", 1801, 5400, 3600),
    ("mais5400", "acima de 15 anos", 5401, None, 7200),
]
COLS = "pz90, pz360, pz1080, pz1800, pz5400, pzmais"
PONTO_MEDIO_ABERTA_DIAS = 7200


def _perfil(saldo, pz):
    av = sum(pz)
    if av <= 0:
        return None
    pm_dias = sum(v * f[4] for f, v in zip(FAIXAS, pz)) / av
    return {
        "saldo": saldo, "a_vencer": av, "vencido": saldo - av if saldo else None, "vencido_pct": _share(saldo - av, saldo) if saldo else None,
        "faixas": {f[0]: v for f, v in zip(FAIXAS, pz)},
        "shares": {f[0]: _share(v, av) for f, v in zip(FAIXAS, pz)},
        "curto_12m_pct": _share(pz[0] + pz[1], av), "medio_1a5_pct": _share(pz[2] + pz[3], av), "longo_5a_pct": _share(pz[4] + pz[5], av),
        "prazo_medio_anos": _r(pm_dias / 365, 2),
    }


def _resumo(p):
    if not p:
        return None
    return {k: p[k] for k in ("a_vencer", "vencido_pct", "curto_12m_pct", "longo_5a_pct", "prazo_medio_anos")}


def _delta(a, b, k):
    return _r(a[k] - b[k]) if a and b and a.get(k) is not None and b.get(k) is not None else None


def build(con, cfg=None):
    try:
        rows = con.execute(f"SELECT data, uf, cliente, saldo, {COLS} FROM scr_uf ORDER BY data").fetchall()
    except Exception as e:
        return {"disponivel": False, "motivo": f"scr_uf indisponível: {e}"}
    if not rows:
        return {"disponivel": False, "motivo": "scr_uf vazia: SCR.data ainda não coletado"}
    agg = {}  # (data, cliente|'total') -> [saldo, pz*6]
    por_uf = {}  # (data, uf, cliente|'total') -> [saldo, pz*6]
    for data, uf, cli, saldo, *pz in rows:
        for chave in (cli, "total"):
            a = agg.setdefault((data, chave), [0.0] * 7)
            u = por_uf.setdefault((data, uf, chave), [0.0] * 7)
            for i, v in enumerate([saldo or 0.0] + [x or 0.0 for x in pz]):
                a[i] += v
                u[i] += v
    datas = sorted({d for d, _ in agg})
    ult = datas[-1]
    d12 = _mes_menos(ult, 12)
    d12 = d12 if d12 in datas else None

    def perfil_de(data, chave):
        a = agg.get((data, chave))
        return _perfil(a[0], a[1:]) if a else None

    brasil = {k: perfil_de(ult, k) for k in ("total", "PF", "PJ")}
    if not brasil["total"]:
        return {"disponivel": False, "motivo": f"faixas de prazo zeradas em {ult}"}
    for k in ("total", "PF", "PJ"):
        antes = perfil_de(d12, k) if d12 else None
        brasil[k]["d12"] = {kk: _delta(brasil[k], antes, kk) for kk in ("curto_12m_pct", "longo_5a_pct", "prazo_medio_anos", "vencido_pct")}
        brasil[k]["d12"]["a_vencer_pct"] = _r((brasil[k]["a_vencer"] / antes["a_vencer"] - 1) * 100) if antes and antes["a_vencer"] else None

    serie = [{"ref": d, **{k: _resumo(perfil_de(d, k)) for k in ("total", "PF", "PJ")}} for d in datas]

    ufs = []
    for uf in sorted({u for _, u, _ in por_uf}):
        tot = por_uf.get((ult, uf, "total"))
        p = _perfil(tot[0], tot[1:]) if tot else None
        if not p:
            continue
        ppf = _perfil(*[por_uf[(ult, uf, "PF")][0]] + [por_uf[(ult, uf, "PF")][1:]]) if (ult, uf, "PF") in por_uf else None
        ppj = _perfil(*[por_uf[(ult, uf, "PJ")][0]] + [por_uf[(ult, uf, "PJ")][1:]]) if (ult, uf, "PJ") in por_uf else None
        antes = por_uf.get((d12, uf, "total")) if d12 else None
        pa = _perfil(antes[0], antes[1:]) if antes else None
        ufs.append({
            "uf": uf, "nome": NOMES.get(uf, uf), "regiao": REGIOES.get(uf),
            "saldo": p["saldo"], "a_vencer": p["a_vencer"], "share_a_vencer": _share(p["a_vencer"], brasil["total"]["a_vencer"]),
            "vencido_pct": p["vencido_pct"], "curto_12m_pct": p["curto_12m_pct"], "medio_1a5_pct": p["medio_1a5_pct"], "longo_5a_pct": p["longo_5a_pct"],
            "prazo_medio_anos": p["prazo_medio_anos"], "shares": p["shares"],
            "pf": _resumo(ppf), "pj": _resumo(ppj),
            "d12_curto_12m_pp": _delta(p, pa, "curto_12m_pct"), "d12_prazo_medio_anos": _delta(p, pa, "prazo_medio_anos"),
        })
    for k in ("curto_12m_pct", "longo_5a_pct", "prazo_medio_anos", "vencido_pct"):
        for i, u in enumerate(sorted(ufs, key=lambda x: -(x[k] if x[k] is not None else -1)), start=1):
            u.setdefault("posicoes", {})[k] = i

    B = brasil["total"]
    mais_curta = max(ufs, key=lambda u: u["curto_12m_pct"] or 0) if ufs else None
    mais_longa = max(ufs, key=lambda u: u["prazo_medio_anos"] or 0) if ufs else None
    dc = B["d12"]["curto_12m_pct"]
    sintese = (f"Em {ult}, R$ {_dec(B['a_vencer'] / 1e12, 2)} trilhões da carteira de crédito do país estão a vencer e R$ {_dec(B['vencido'] / 1e9, 0)} bilhões "
               f"({_dec(B['vencido_pct'])}%) estão vencidos. {_dec(B['curto_12m_pct'], 0)}% do que está a vencer vence em até 12 meses e "
               f"{_dec(B['longo_5a_pct'], 0)}% depois de 5 anos; o prazo médio residual aproximado é de {_dec(B['prazo_medio_anos'])} anos "
               f"(pessoas físicas {_dec(brasil['PF']['prazo_medio_anos'])}, pessoas jurídicas {_dec(brasil['PJ']['prazo_medio_anos'])})."
               + (f" Em doze meses a fatia de curto prazo {'subiu' if dc > 0 else 'caiu'} {_dec(abs(dc))} p.p." if dc is not None else "")
               + (f" A carteira mais curta é {mais_curta['nome']} ({_dec(mais_curta['curto_12m_pct'], 0)}% em 12 meses) e a mais longa, "
                  f"{mais_longa['nome']} ({_dec(mais_longa['prazo_medio_anos'])} anos)." if mais_curta and mais_longa else ""))
    return {
        "disponivel": True, "tipo": "DADO OBSERVADO (SCR.data) + CALCULADO (shares, prazo médio aproximado, variações, posições)",
        "data_base": ult, "data_base_12m": d12, "fonte": FONTE, "gerado_em": common.now_utc(),
        "faixas": [{"id": f[0], "nome": f[1], "dias_ini": f[2], "dias_fim": f[3], "ponto_medio_dias": f[4]} for f in FAIXAS],
        "brasil": brasil, "serie": serie, "ufs": ufs,
        "sintese": sintese,
        "metodo": ("SCR.data do BCB, mensal: carteira ativa por UF e tipo de cliente com a carteira a vencer aberta em seis faixas de prazo "
                   "remanescente. A vencer é a soma das faixas; vencido é a carteira ativa menos a vencer. Shares de prazo são calculados sobre "
                   "a carteira a vencer. Prazo médio residual é o ponto médio de cada faixa ponderado pelo saldo, com 7.200 dias (20 anos) para "
                   "a faixa aberta acima de 5.400 dias: aproximação para comparar UFs e meses, não duração contratual. Variações contra o mesmo "
                   "mês do ano anterior; posições entre as 27 UFs."),
        "limitacoes": ("Sem corte por produto ou modalidade: o silver agrega as faixas de prazo só por UF e tipo de cliente. Prazo remanescente, "
                       "não prazo original de contratação. A parcela vencida até 14 dias só aparece por diferença. O SCR.data reflete o "
                       "domicílio do tomador, não a agência que concedeu."),
        "cautelas": [
            "Carteira curta não é carteira ruim: cartão, capital de giro e cheque especial são curtos por natureza; carteira longa concentra imobiliário e rural.",
            "A faixa aberta (acima de 15 anos) é quase toda crédito imobiliário; o ponto médio de 20 anos é convenção declarada.",
            "Vencido aqui é o total em atraso (inclusive até 14 dias); a inadimplência do Panorama usa só o atraso acima de 90 dias.",
        ],
        "catalogo": [
            {"nome": "Carteira a vencer", "definicao": "soma das seis faixas de prazo remanescente", "unidade": "R$", "fonte": "SCR.data (a_vencer_*)", "limitacoes": "sem corte por produto"},
            {"nome": "Vencido", "definicao": "carteira ativa menos carteira a vencer", "unidade": "R$ e % da carteira ativa", "fonte": "SCR.data (carteira_ativa)", "limitacoes": "inclui atraso até 14 dias"},
            {"nome": "Curto prazo (12 meses)", "definicao": "faixas até 90 e 91 a 360 dias ÷ a vencer", "unidade": "%", "fonte": "calculado", "limitacoes": "prazo remanescente"},
            {"nome": "Longo prazo (acima de 5 anos)", "definicao": "faixas 1.801 a 5.400 e acima de 5.400 dias ÷ a vencer", "unidade": "%", "fonte": "calculado", "limitacoes": "prazo remanescente"},
            {"nome": "Prazo médio residual", "definicao": "ponto médio das faixas ponderado pelo saldo a vencer", "unidade": "anos", "fonte": "calculado", "limitacoes": "aproximação; faixa aberta a 20 anos"},
        ],
    }
