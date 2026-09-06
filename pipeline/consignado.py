"""Consignado, previdência e envelhecimento — camada gold.

Três bases, três geografias, e uma armadilha metodológica que organiza o módulo inteiro.

**O que é observado e onde:**

* **Censo 2022 (IBGE)** — estrutura etária por grupo quinquenal, massa de rendimento do
  trabalho e composição do rendimento domiciliar, tudo **municipal**. O Censo **não
  separa aposentadoria e pensão das demais rendas**: a tabela 10297 tem exatamente três
  categorias — todas as fontes, todos os trabalhos e *outras fontes* — e esta última
  reúne aposentadoria, pensão, BPC, aluguel, aplicações, seguro-desemprego e demais
  origens. Por isso "outras fontes" é publicado como **teto** do peso dos benefícios,
  nunca como renda previdenciária.

* **SCR.data (BCB)** — consignado por **unidade da federação**, e, no corte triplo
  extraído das linhas-base, consignado **por ocupação × UF**. O grupo
  "Aposentado/pensionista" é a medida pública mais próxima do consignado do INSS, mas é
  mais ampla: inclui aposentados de regimes próprios. Nunca é chamada de consignado INSS.

* **Taxas de juros por instituição (BCB)** — a modalidade "Crédito pessoal consignado
  INSS" existe por instituição, em nível **nacional**. Essa geografia é mantida.

**A armadilha:** não existe carteira municipal pública de consignado. Qualquer número
municipal é alocação de um total estadual. Se essa alocação usa a massa de benefícios
como chave, então a correlação entre dependência previdenciária e consignado municipal é
**mecânica** — foi construída pela fórmula, não observada no mundo. O módulo trata isso
como restrição de primeira ordem: a estimativa municipal existe, é rotulada, e a
hipótese de que dependência previdenciária se associa a mais consignado é testada
**apenas** contra o consignado estadual observado, que não passou pela alocação.

A auditoria completa está em docs/AUDITORIA_CONSIGNADO.md.
"""
import json
import math
import os

from pipeline import common
from pipeline.penetracao import _ols, _quantil, _rows
from pipeline.moradia import REGIAO, REGIOES, UF_NOME, _br, _hhi, _pct, _r

# Grupos quinquenais na ordem etária, com a idade inicial de cada um. A idade inicial é
# usada na interpolação da idade mediana.
GRUPOS = [
    ("0 a 4", 0), ("5 a 9", 5), ("10 a 14", 10), ("15 a 19", 15), ("20 a 24", 20),
    ("25 a 29", 25), ("30 a 34", 30), ("35 a 39", 35), ("40 a 44", 40), ("45 a 49", 45),
    ("50 a 54", 50), ("55 a 59", 55), ("60 a 64", 60), ("65 a 69", 65), ("70 a 74", 70),
    ("75 a 79", 75), ("80 a 84", 80), ("85 a 89", 85), ("90 a 94", 90), ("95 a 99", 95),
    ("100 ou mais", 100),
]
IDX = {g: i for i, (g, _) in enumerate(GRUPOS)}
I_15, I_60, I_65, I_80 = 3, 12, 13, 16   # posições de corte na lista acima
LARGURA = 5                              # amplitude do grupo quinquenal

# O grupo de ocupação do SCR que mais se aproxima do público do consignado do INSS.
# Mais amplo que o INSS: inclui aposentados e pensionistas de regimes próprios.
GRUPO_APOSENTADOS = "Aposentado/pensionista"


def _piramide(d):
    """Indicadores etários a partir do dicionário {grupo: população}.

    A idade mediana é interpolada linearmente dentro do grupo em que a frequência
    acumulada cruza a metade da população — método padrão para dados agrupados. Não é
    a idade mediana que o IBGE publicaria a partir do microdado, e a página diz isso.
    """
    tot = sum(v for v in d.values() if v)
    if not tot:
        return None
    soma = lambda ini, fim=None: sum(d.get(g, 0) or 0 for g, _ in GRUPOS[ini:fim])
    j14, a15_64 = soma(0, I_15), soma(I_15, I_65)
    a60, a65, a80 = soma(I_60), soma(I_65), soma(I_80)

    alvo, ac, mediana = tot / 2.0, 0.0, None
    for g, ini in GRUPOS:
        v = d.get(g, 0) or 0
        if ac + v >= alvo and v:
            mediana = ini + (alvo - ac) / v * LARGURA
            break
        ac += v
    return {
        "tot": tot, "a60": a60, "a65": a65, "a80": a80, "j14": j14, "a15_64": a15_64,
        "p60": _pct(a60, tot), "p65": _pct(a65, tot), "p80": _pct(a80, tot),
        "envelhecimento": _r(100.0 * a60 / j14, 1) if j14 else None,
        "dep_idosa": _r(100.0 * a65 / a15_64, 1) if a15_64 else None,
        "idade_mediana": _r(mediana, 1),
    }


def _scr_consignado(con):
    """Consignado observado no SCR: total por UF, e a fatia de aposentados e pensionistas.

    As duas séries vêm da mesma fonte e da mesma data-base. A segunda é o corte triplo
    uf × ocupação × produto, que existe porque o CSV do SCR vem totalmente cruzado — e
    que reconcilia com o agregado nacional por ocupação com diferença nula.
    """
    db = con.execute("SELECT MAX(data) FROM scr_uf_ocup_produto").fetchone()[0]
    if not db:
        return None

    total_uf = {r["uf"]: r for r in _rows(con, """
        SELECT uf, saldo, n_op, inad, ap, v1590 FROM scr_uf_produto
        WHERE data=? AND cliente='PF' AND produto='Consignado'""", (db,))}
    apos_uf = {r["uf"]: r for r in _rows(con, """
        SELECT uf, saldo, n_op, inad, ap, v1590 FROM scr_uf_ocup_produto
        WHERE data=? AND cliente='PF' AND grupo=? AND produto='Consignado'""",
        (db, GRUPO_APOSENTADOS))}

    serie_tot = _rows(con, """
        SELECT data, SUM(saldo) saldo, SUM(n_op) n_op, SUM(inad) inad, SUM(ap) ap
        FROM scr_uf_produto WHERE cliente='PF' AND produto='Consignado'
        GROUP BY data ORDER BY data""")
    serie_apo = _rows(con, """
        SELECT data, SUM(saldo) saldo, SUM(n_op) n_op, SUM(inad) inad, SUM(ap) ap
        FROM scr_uf_ocup_produto WHERE cliente='PF' AND grupo=? AND produto='Consignado'
        GROUP BY data ORDER BY data""", (GRUPO_APOSENTADOS,))

    # composição do consignado por ocupação, nacional — mostra que o consignado de
    # aposentados é minoria do produto, o que o nome "consignado" costuma esconder
    ocup = _rows(con, """
        SELECT grupo, saldo, n_op, inad FROM scr_ocup_produto
        WHERE data=? AND cliente='PF' AND produto='Consignado'
        ORDER BY saldo DESC""", (db,))

    tot_nac = sum(v["saldo"] for v in total_uf.values())
    apo_nac = sum(v["saldo"] for v in apos_uf.values())
    return {
        "selo": "observado", "data_base": db,
        "total_nacional": _r(tot_nac, 0),
        "aposentados_nacional": _r(apo_nac, 0),
        "part_aposentados": _pct(apo_nac, tot_nac),
        "operacoes_aposentados": int(sum(v["n_op"] for v in apos_uf.values() if v["n_op"] and v["n_op"] > 0)),
        "por_uf": {uf: {
            "total": _r(v["saldo"], 0),
            "aposentados": _r(apos_uf[uf]["saldo"], 0) if uf in apos_uf else None,
            "part_aposentados": _pct(apos_uf[uf]["saldo"], v["saldo"]) if uf in apos_uf else None,
            "operacoes_aposentados": int(apos_uf[uf]["n_op"]) if uf in apos_uf and apos_uf[uf]["n_op"] > 0 else None,
            "inad_aposentados": _pct(apos_uf[uf]["inad"], apos_uf[uf]["saldo"]) if uf in apos_uf else None,
            "inad_total": _pct(v["inad"], v["saldo"]),
        } for uf, v in total_uf.items()},
        "serie_total": [{"d": r["data"], "saldo": _r(r["saldo"] / 1e9, 2),
                         "op": _r(r["n_op"] / 1e6, 2), "inad": _pct(r["inad"], r["saldo"])}
                        for r in serie_tot],
        "serie_aposentados": [{"d": r["data"], "saldo": _r(r["saldo"] / 1e9, 2),
                               "op": _r(r["n_op"] / 1e6, 2), "inad": _pct(r["inad"], r["saldo"])}
                              for r in serie_apo],
        "composicao_ocupacao": [{"grupo": r["grupo"], "saldo": _r(r["saldo"], 0),
                                 "part": _pct(r["saldo"], tot_nac),
                                 "op": int(r["n_op"]) if r["n_op"] > 0 else None,
                                 "inad": _pct(r["inad"], r["saldo"])} for r in ocup],
        "aviso_grupo": (
            "O grupo “Aposentado/pensionista” do SCR é mais amplo que o público do INSS: "
            "inclui aposentados e pensionistas de regimes próprios de previdência. Não é, "
            "e não é chamado aqui de, consignado do INSS."),
    }


def _instituicoes(con):
    """Taxas de consignado INSS por instituição, na geografia em que existem: nacional.

    Vem do gold de juros, que já consolida a API de taxas do BCB por janela de
    contratação. Taxa de contratação não é carteira: mede o preço de operações novas,
    não o estoque, e nenhuma participação de mercado é derivada daqui.
    """
    # Numa execução completa do pipeline o gold de juros já foi escrito em data/gold;
    # numa execução parcial ele só existe no diretório publicado. Tenta os dois, porque
    # a dependência é opcional e não deve derrubar o módulo.
    juros = common.ler_gold_opcional("juros.json")
    if not juros:
        caminho = os.path.join(common.ROOT, "public", "obs", "data", "gold", "juros.json")
        if os.path.exists(caminho):
            with open(caminho, encoding="utf-8") as f:
                juros = json.load(f)
    if not juros:
        return None
    mods = [m for m in juros.get("modalidades", []) if "INSS" in (m.get("modalidade") or "")]
    if not mods:
        return None
    m = mods[0]
    return {
        "selo": "observado", "geografia": "nacional",
        "modalidade": m["modalidade"], "janela": m.get("janela"),
        "stats": m.get("stats"), "spread_selic": m.get("spread_selic"),
        "delta_3m": m.get("delta_3m"),
        "ranking": m.get("ranking", []),
        "serie_mensal": m.get("serie_mensal", []),
        "aviso": (
            "Taxa média das operações contratadas na janela divulgada, por instituição. "
            "Não é a carteira da instituição, não permite calcular participação de "
            "mercado e não existe em nível municipal ou estadual."),
    }


# ---------------------------------------------------------------------------
# Chaves de alocação do consignado estadual entre municípios.
#
# A escolha da chave é a decisão metodológica mais consequente do módulo, e o achado da
# auditoria a determina: **o valor dos benefícios é líquido de descontos, e o consignado
# é descontado na folha**. Usar valor como chave significaria distribuir o consignado
# proporcionalmente a um número do qual o próprio consignado já foi subtraído — um
# município com muito consignado teria valor menor e receberia menos alocação, invertendo
# o sinal.
#
# Por isso a chave central é a **quantidade de benefícios elegíveis** (aposentadorias e
# pensões por morte), que não sofre esse desconto. As demais entram como teste de
# sensibilidade e definem a faixa publicada.
CHAVES = [
    ("qtd_elegiveis", "Quantidade de aposentadorias e pensões",
     "Não é afetada pelo desconto do consignado. Chave central."),
    ("valor_elegiveis", "Valor líquido de aposentadorias e pensões",
     "Já teve o consignado descontado; tende a subestimar municípios de alta exposição."),
    ("qtd_total", "Quantidade total de benefícios",
     "Inclui assistenciais, cujo titular tem margem consignável distinta."),
    ("pop60", "População de 60 anos ou mais",
     "Independe do órgão pagador, mas ignora quem recebe benefício antes dos 60."),
]


def _aloca(muns, uf_saldo, chave):
    """Distribui o saldo estadual entre municípios proporcionalmente a uma chave.

    Devolve {cod: valor}. Municípios sem chave positiva não recebem alocação — e ficam
    com nulo, nunca com zero, porque a ausência aqui é de informação, não de crédito.
    """
    por_uf = {}
    for m in muns:
        v = m.get(chave)
        if m.get("uf") and v:
            por_uf[m["uf"]] = por_uf.get(m["uf"], 0.0) + v
    out = {}
    for m in muns:
        v, uf = m.get(chave), m.get("uf")
        tot, saldo = por_uf.get(uf), uf_saldo.get(uf)
        if v and tot and saldo:
            out[m["c"]] = saldo * v / tot
    return out


def _fator_ipca(con, de="2022-08-01", ate=None):
    """Fator acumulado do IPCA entre duas datas, para trazer valores correntes a preços
    da data de referência do Censo.

    A data de referência do Censo 2022 é 31 de julho de 2022 e o rendimento declarado é o
    do mês de julho. Comparar um valor de dezembro de 2025 com uma renda de julho de 2022
    sem deflacionar superestimaria o peso dos benefícios em toda a base.
    """
    linhas = [(d, v) for d, v in con.execute(
        "SELECT ref_date, value FROM series_obs WHERE key='ipca' ORDER BY ref_date")]
    if not linhas:
        return None
    f = 1.0
    for d, v in linhas:
        if d >= de and (ate is None or d <= ate):
            f *= (1.0 + v / 100.0)
    return f


def build(con, cfg=None):
    ano = con.execute("SELECT MAX(ano) FROM prev_mun").fetchone()[0]
    if not ano:
        return {"ok": False, "motivo": "sem coleta da Previdência"}
    scr = _scr_consignado(con)
    if not scr:
        return {"ok": False, "motivo": "sem coleta do SCR"}

    # ---------- base municipal ----------
    idade = {}
    for cod, g, p in con.execute("SELECT cod_ibge, grupo, pop FROM censo_idade"):
        idade.setdefault(cod, {})[g] = p

    fator = _fator_ipca(con)
    rec_mun, reclamacoes = _reclamacoes(con)
    prev = {r["cod_ibge"]: r for r in _rows(con, """
        SELECT * FROM prev_mun WHERE ano=?""", (ano,))}
    cli = {r["cod_ibge"]: r for r in _rows(con, """
        SELECT * FROM prev_clientela WHERE ano=?""", (ano,))}
    censo = {r["cod_ibge"]: r for r in _rows(con, """
        SELECT c.cod_ibge, c.pop_total, c.renda_dom_mensal, c.urbanizacao,
               t.massa_trabalho, p.pct_outras_fontes, m.dom_total, i.nome, i.uf
        FROM censo_mun c
        LEFT JOIN censo_trabalho t ON t.cod_ibge = c.cod_ibge
        LEFT JOIN censo_composicao p ON p.cod_ibge = c.cod_ibge
        LEFT JOIN censo_moradia m ON m.cod_ibge = c.cod_ibge
        LEFT JOIN ibge_municipios i ON i.cod_ibge = c.cod_ibge""")}

    muns = []
    for cod, c in censo.items():
        pir = _piramide(idade.get(cod, {}))
        p, cl = prev.get(cod), cli.get(cod)
        if not pir:
            continue
        elegiveis = ((p["aposentadorias"] or 0) + (p["pensoes"] or 0)) if p else None
        # Fração do valor líquido atribuível a aposentadorias e pensões, na proporção da
        # quantidade. É uma repartição, não um dado observado: a fonte publica o valor
        # só no total.
        vfrac = None
        if p and p["total"] and p["valor_dez"] and elegiveis:
            vfrac = p["valor_dez"] * elegiveis / p["total"]
        item = {
            "c": cod, "n": c["nome"], "uf": c["uf"], "reg": REGIAO.get(c["uf"]),
            "pop": int(pir["tot"]),
            "a60": int(pir["a60"]), "a65": int(pir["a65"]), "a80": int(pir["a80"]),
            "p60": pir["p60"], "p65": pir["p65"], "p80": pir["p80"],
            "env": pir["envelhecimento"], "dep": pir["dep_idosa"], "imed": pir["idade_mediana"],
            "urb": _r(c["urbanizacao"]),
            "rdom": _r(c["renda_dom_mensal"], 0),
            "rtrab": _r(c["massa_trabalho"], 0),
            "outras": _r(c["pct_outras_fontes"]),
            "dom": int(c["dom_total"]) if c["dom_total"] else None,
            "pop60": pir["a60"],
        }
        if p:
            item.update({
                "ben": int(p["total"]) if p["total"] else None,
                "ben_prev": int(p["total_prev"]) if p["total_prev"] else None,
                "apo": int(p["aposentadorias"]) if p["aposentadorias"] else None,
                "pen": int(p["pensoes"]) if p["pensoes"] else None,
                "aux": int(p["auxilios"]) if p["auxilios"] else None,
                "ass": int(p["assistenciais"]) if p["assistenciais"] else None,
                "vdez": _r(p["valor_dez"], 0),
                "vano": _r(p["valor_ano"], 0),
                "vmed": _r(p["valor_medio"], 0),
                "qtd_elegiveis": elegiveis,
                "valor_elegiveis": vfrac,
                "qtd_total": p["total"],
            })
        if cl:
            item.update({
                "rural": int(cl["qtd_rural"]) if cl["qtd_rural"] else None,
                "urbano": int(cl["qtd_urbano"]) if cl["qtd_urbano"] else None,
                "prural": _pct(cl["qtd_rural"], (cl["qtd_urbano"] or 0) + (cl["qtd_rural"] or 0)),
            })
        muns.append(item)

    # ---------- indicadores derivados ----------
    for m in muns:
        ben, pop, a60 = m.get("ben"), m.get("pop"), m.get("a60")
        m["ben100"] = _r(100.0 * ben / pop, 2) if (ben and pop) else None
        m["ben100_60"] = _r(100.0 * ben / a60, 1) if (ben and a60) else None
        m["v_hab"] = _r(m["vdez"] / pop, 2) if (m.get("vdez") and pop) else None
        m["v_idoso"] = _r(m["vdez"] / a60, 2) if (m.get("vdez") and a60) else None
        m["v_dom"] = _r(m["vdez"] / m["dom"], 2) if (m.get("vdez") and m.get("dom")) else None
        # Peso dos benefícios sobre a renda domiciliar do Censo. Numerador líquido de
        # descontos, denominador de 2022 — a razão é entre bases agregadas de períodos
        # e conceitos distintos, e o nome do indicador diz isso.
        vreal = (m["vdez"] / fator) if (m.get("vdez") and fator) else None
        m["vreal"] = _r(vreal, 0)
        m["peso"] = _pct(vreal, m["rdom"]) if (vreal and m.get("rdom")) else None
        m["peso_trab"] = _pct(vreal, m["rtrab"]) if (vreal and m.get("rtrab")) else None
        # Teste de coerência: o Censo dá, de forma independente, a participação de TODO
        # rendimento que não vem do trabalho. Benefícios previdenciários são parte disso,
        # então o peso calculado não pode ultrapassar esse teto. Quando ultrapassa, a
        # causa conhecida é o município do órgão pagador — a agência local paga
        # beneficiários que moram noutras cidades, e o numerador cobre gente que não está
        # no denominador. O resultado do teste entra no selo em vez de ficar escondido.
        if m["peso"] is not None and m.get("outras"):
            m["coer"] = _r(m["peso"] / m["outras"], 2)
            m["incoerente"] = m["peso"] > m["outras"]
        m["prural_apo"] = m.get("prural")
        m["pass"] = _pct(m.get("ass"), m.get("ben")) if m.get("ass") and m.get("ben") else None

    # selo de confiabilidade: mede o desvio de órgão pagador comparando benefícios por
    # 100 pessoas de 60 anos ou mais com a mediana nacional
    med = _quantil([m["ben100_60"] for m in muns if m.get("ben100_60")], 0.5) or 1.0
    for m in muns:
        r = (m["ben100_60"] / med) if m.get("ben100_60") else None
        m["razao_med"] = _r(r)
        # Dois sinais independentes do desvio de órgão pagador: a razão entre benefícios
        # por idoso e a mediana nacional, e a reprovação no teste de coerência contra o
        # teto do Censo. Basta um para rebaixar.
        if r is None:
            m["sel"] = "sem_dado"
        elif r > 2.0 or r < 0.4 or m.get("incoerente"):
            m["sel"] = "baixa"
        elif r > 1.5 or r < 0.65:
            m["sel"] = "media"
        else:
            m["sel"] = "alta"

    # ---------- alocação municipal do consignado ----------
    uf_apos = {uf: v["aposentados"] for uf, v in scr["por_uf"].items() if v["aposentados"]}
    alocs = {k: _aloca(muns, uf_apos, k) for k, _, _ in CHAVES}
    central = alocs["qtd_elegiveis"]
    for m in muns:
        vals = [a.get(m["c"]) for a in alocs.values() if a.get(m["c"])]
        v = central.get(m["c"])
        if v:
            m["cons"] = _r(v, 0)
            m["cons_lo"] = _r(min(vals), 0)
            m["cons_hi"] = _r(max(vals), 0)
            m["cons_ben"] = _r(v / m["qtd_elegiveis"], 0) if m.get("qtd_elegiveis") else None
            # Serviço da dívida aproximado: parcela mensal implícita de um contrato médio
            # de 84 meses sobre o valor líquido dos benefícios elegíveis. É um cenário
            # aritmético, não uma parcela observada.
            if m.get("valor_elegiveis"):
                m["servico"] = _pct(v / 84.0, m["valor_elegiveis"])

    # ---------- saturação e índice de risco ----------
    def faixa(chave, expr):
        v = sorted(x for x in (expr(m) for m in muns) if x is not None)
        if len(v) < 50:
            return (0.0, 1.0)
        return (_quantil(v, 0.05), _quantil(v, 0.95))

    cortes = {
        "p60": faixa("p60", lambda m: m.get("p60")),
        "peso": faixa("peso", lambda m: m.get("peso")),
        "rendainv": faixa("rendainv", lambda m: -(m.get("rdom") or 0) / max(m.get("pop") or 1, 1)),
        "cons_ben": faixa("cons_ben", lambda m: m.get("cons_ben")),
        "servico": faixa("servico", lambda m: m.get("servico")),
        "pass": faixa("pass", lambda m: m.get("pass")),
        "prural": faixa("prural", lambda m: m.get("prural")),
    }
    for m in muns:
        r = (rec_mun or {}).get(m["c"])
        if r:
            m["rec"] = int(r["t"])
            m["rec_idosos"] = int(r["i"])
            m["rec_100k60"] = _r(100000.0 * r["t"] / m["a60"], 1) if m.get("a60") else None
            m["rec_resol"] = _pct(r["rs"], r["a"]) if r["a"] else None
    for m in muns:
        cls, motivo = _saturacao(m)
        m["sat"], m["sat_motivo"] = cls, motivo
        m.update(_indice_risco(m, cortes))
        # campos auxiliares da alocação saem do payload: servem ao cálculo, não à leitura
        for k in ("qtd_elegiveis", "valor_elegiveis", "qtd_total", "pop60"):
            m.pop(k, None)

    estados, circular = _analise_uf(con, muns, scr, fator)

    # ---------- rankings, separados por natureza do dado ----------
    def rk(chave, n=20, filtro=None, reverso=True):
        v = [m for m in muns if m.get(chave) is not None and (filtro is None or filtro(m))]
        v.sort(key=lambda m: m[chave], reverse=reverso)
        return [{"c": m["c"], "n": m["n"], "uf": m["uf"], "v": m[chave], "sel": m["sel"]}
                for m in v[:n]]

    porte = lambda m: (m.get("pop") or 0) >= 10000
    conf = lambda m: m.get("sel") in ("alta", "media")

    rankings = {
        "observado": {
            "envelhecimento": rk("p60", filtro=porte),
            "indice_envelhecimento": rk("env", filtro=porte),
            "massa_previdenciaria": rk("vdez"),
            "dependencia": rk("peso", filtro=lambda m: porte(m) and conf(m)),
            "beneficios_por_idoso": rk("ben100_60", filtro=lambda m: porte(m) and conf(m)),
            "rural": rk("prural", filtro=porte),
            "assistenciais": rk("pass", filtro=porte),
        },
        "estimado": {
            "exposicao": rk("cons", filtro=conf),
            "exposicao_por_beneficio": rk("cons_ben", filtro=lambda m: porte(m) and conf(m)),
            "servico_da_divida": rk("servico", filtro=lambda m: porte(m) and conf(m)),
            "indice_risco": rk("indice", filtro=lambda m: porte(m) and conf(m)),
        },
    }

    nac = _piramide({g: sum(x for x in
                            [r[1] for r in con.execute(
                                "SELECT cod_ibge, pop FROM censo_idade WHERE grupo=?", (g,))]
                            if x) for g, _ in GRUPOS})
    tot_ben = sum(m.get("ben") or 0 for m in muns)
    tot_v = sum(m.get("vdez") or 0 for m in muns)
    tot_apo = sum(m.get("apo") or 0 for m in muns)
    tot_pen = sum(m.get("pen") or 0 for m in muns)
    tot_ass = sum(m.get("ass") or 0 for m in muns)
    tot_rdom = sum(m.get("rdom") or 0 for m in muns)

    return {
        "ok": True, "gerado_em": common.now_utc(), "ano": ano,
        "fator_ipca": _r(fator, 4),
        "populacao_fonte": "IBGE Censo 2022 (pirâmide etária por município; a página trabalha por faixa etária, que só o Censo traz)",
        "brasil": {
            "selo": "observado",
            "populacao": int(nac["tot"]), "a60": int(nac["a60"]), "a65": int(nac["a65"]),
            "a80": int(nac["a80"]), "p60": nac["p60"], "p65": nac["p65"], "p80": nac["p80"],
            "envelhecimento": nac["envelhecimento"], "dep_idosa": nac["dep_idosa"],
            "idade_mediana": nac["idade_mediana"],
            "beneficios": int(tot_ben), "aposentadorias": int(tot_apo),
            "pensoes": int(tot_pen), "assistenciais": int(tot_ass),
            "valor_dez": _r(tot_v, 0),
            "valor_real": _r(tot_v / fator, 0) if fator else None,
            "valor_medio": _r(tot_v / tot_ben, 2) if tot_ben else None,
            "ben100_60": _r(100.0 * tot_ben / nac["a60"], 1),
            "peso": _pct(tot_v / fator, tot_rdom) if fator else None,
            "piramide": [{"g": g, "pop": int(sum(
                r[0] or 0 for r in con.execute(
                    "SELECT pop FROM censo_idade WHERE grupo=?", (g,))))} for g, _ in GRUPOS],
        },
        "sgs": _sgs(con), "linha_do_tempo": LINHA_DO_TEMPO,
        "reclamacoes": reclamacoes,
        "scr": scr, "estados": estados, "circularidade": circular,
        "municipios": muns, "rankings": rankings,
        "saturacao_criterios": SATURACAO,
        "dicionario": [
            {"t": "Valor líquido de benefícios emitidos", "selo": "observado",
             "d": "Créditos encaminhados à rede bancária, já descontados imposto de renda, "
                  "pensão alimentícia e demais consignações — o empréstimo consignado "
                  "inclusive. Não é o valor bruto do benefício.",
             "f": f"MPS, Estatísticas Municipais da Previdência, dezembro de {ano}.",
             "l": "O consignado já saiu deste número: município com mais consignado aparece "
                  "com valor menor. Nunca é usado como medida de exposição ao crédito."},
            {"t": "Benefícios emitidos", "selo": "observado",
             "d": "Quantidade de créditos emitidos na competência, por grupo de espécie.",
             "f": f"MPS, Estatísticas Municipais da Previdência, dezembro de {ano}.",
             "l": "Conta créditos, não pessoas: um benefício pode gerar mais de um crédito e "
                  "11,1% dos beneficiários acumulam mais de um benefício. O município é o do "
                  "órgão pagador, não o de residência do beneficiário."},
            {"t": "Peso dos benefícios na renda domiciliar", "selo": "calculado",
             "d": "Valor líquido de dezembro, deflacionado pelo IPCA a preços de julho de "
                  "2022, dividido pela massa de renda domiciliar do Censo.",
             "f": "Cálculo sobre MPS e Censo 2022.",
             "l": "Razão entre bases agregadas de universos distintos — quem recebe na "
                  "agência local não é necessariamente quem mora no município. O teto de "
                  "coerência do Censo rebaixa quem ultrapassa a participação de rendas "
                  "não-trabalho."},
            {"t": "Consignado de aposentados e pensionistas", "selo": "observado",
             "d": "Saldo do produto Consignado para o grupo ocupacional Aposentado/pensionista "
                  "no SCR, por unidade da federação.",
             "f": f"BCB, SCR.data, data-base {scr['data_base']}.",
             "l": "Mais amplo que o público do INSS (inclui regimes próprios) e ao mesmo "
                  "tempo cobre só 57% do saldo que o SGS registra como consignado do INSS. "
                  "Nunca é somado nem trocado pela série do SGS."},
            {"t": "Exposição municipal estimada ao consignado", "selo": "estimado",
             "d": "Saldo estadual observado repartido entre municípios na proporção da "
                  "quantidade de aposentadorias e pensões.",
             "f": "Alocação sobre SCR e MPS.",
             "l": "Não é carteira observada — não existe carteira municipal pública. A chave "
                  "usa quantidade e não valor porque o valor é líquido do próprio consignado. "
                  "Correlações com a chave de alocação são mecânicas."},
            {"t": "Reclamações sobre consignado do INSS", "selo": "observado",
             "d": "Reclamações da categoria dedicada a beneficiários do INSS no "
                  "consumidor.gov.br, por município e instituição.",
             "f": "consumidor.gov.br, publicações mensais.",
             "l": "Mede propensão a reclamar, não incidência de problema. Depende de acesso "
                  "digital e do tamanho da base de clientes. Contagem bruta não é ranking "
                  "de conduta."},
        ],
        "instituicoes": _instituicoes(con),
        "totais": {
            "municipios": len(muns),
            "selos": {s: sum(1 for m in muns if m["sel"] == s)
                      for s in ("alta", "media", "baixa", "sem_dado")},
            "incoerentes": sum(1 for m in muns if m.get("incoerente")),
            "saturacao": {k: sum(1 for m in muns if m.get("sat") == k)
                          for k in ("baixa_penetracao", "penetracao_elevada", "possivel_saturacao")},
            "dependencia_acima_50": sum(1 for m in muns if (m.get("peso") or 0) > 50),
            "dependencia_35_50": sum(1 for m in muns if 35 <= (m.get("peso") or 0) <= 50),
        },
    }


def _reclamacoes(con):
    """Reclamações sobre consignado de beneficiários do INSS, por município e instituição.

    É a **única** fonte pública com granularidade municipal ligada ao consignado do INSS.
    E mede reclamação, não crédito: contagem alta pode significar problema, mas também
    base de clientes grande, acesso digital melhor ou campanha de mobilização. Por isso a
    comparação entre municípios é sempre normalizada pela população de 60 anos ou mais, e
    a comparação entre instituições publica a taxa de resolução ao lado da contagem.
    """
    comps = [r[0] for r in con.execute(
        "SELECT DISTINCT competencia FROM reclam_consig_mun ORDER BY competencia")]
    if not comps:
        return None, {}
    por_mun = {}
    for r in _rows(con, """SELECT cod_ibge, SUM(total) t, SUM(idosos) i,
                                  SUM(avaliadas) a, SUM(resolvidas) rs
                           FROM reclam_consig_mun GROUP BY cod_ibge"""):
        por_mun[r["cod_ibge"]] = r
    insts = [{
        "nome": r["instituicao"], "total": int(r["t"]), "idosos": int(r["i"]),
        "part_idosos": _pct(r["i"], r["t"]),
        "avaliadas": int(r["a"]),
        "taxa_resolucao": _pct(r["rs"], r["a"]) if r["a"] else None,
        "nota": _r(r["nota"]),
    } for r in _rows(con, """SELECT instituicao, SUM(total) t, SUM(idosos) i,
                                    SUM(avaliadas) a, SUM(resolvidas) rs, AVG(nota) nota
                             FROM reclam_consig_if GROUP BY instituicao
                             HAVING SUM(total) >= 200 ORDER BY t DESC""")]
    serie = [{"d": r["competencia"], "n": int(r["t"])} for r in _rows(
        con, "SELECT competencia, SUM(total) t FROM reclam_consig_mun GROUP BY competencia ORDER BY competencia")]
    total = sum(v["t"] for v in por_mun.values())
    return por_mun, {
        "selo": "observado", "competencias": comps,
        "de": comps[0], "ate": comps[-1],
        "total": int(total), "municipios": len(por_mun),
        "instituicoes": insts, "serie": serie,
        "aviso": (
            "Reclamação registrada no consumidor.gov.br sobre a categoria dedicada a "
            "beneficiários do INSS. Mede propensão a reclamar, não incidência de problema: "
            "depende de acesso digital, de conhecimento do canal e do tamanho da base de "
            "clientes. Contagem bruta não é ranking de conduta."),
    }


def _analise_uf(con, muns, scr, fator):
    """Agrega os municípios por unidade da federação e roda o teste de circularidade.

    Este é o único lugar do módulo em que a hipótese "mais dependência previdenciária,
    mais consignado" pode ser testada. No nível municipal ela é **mecânica**: o
    consignado municipal é o estadual repartido por uma chave previdenciária, então a
    correlação entre os dois foi construída pela fórmula. No nível estadual não há
    alocação nenhuma — o consignado de aposentados e pensionistas é observado por
    unidade da federação, no SCR, e a dependência previdenciária é observada nos
    registros da Previdência. Os dois lados são independentes.
    """
    agg = {}
    for m in muns:
        uf = m.get("uf")
        if not uf:
            continue
        a = agg.setdefault(uf, {k: 0.0 for k in
                                ("pop", "a60", "a65", "ben", "apo", "pen", "ass",
                                 "vdez", "rdom", "rtrab", "rural", "urbano")})
        for k, campo in (("pop", "pop"), ("a60", "a60"), ("a65", "a65"), ("ben", "ben"),
                         ("apo", "apo"), ("pen", "pen"), ("ass", "ass"), ("vdez", "vdez"),
                         ("rdom", "rdom"), ("rtrab", "rtrab"), ("rural", "rural"),
                         ("urbano", "urbano")):
            v = m.get(campo)
            if v:
                a[k] += v

    estados = []
    for uf, a in sorted(agg.items()):
        s = scr["por_uf"].get(uf, {})
        vreal = a["vdez"] / fator if fator else None
        elegiveis = a["apo"] + a["pen"]
        estados.append({
            "uf": uf, "nome": UF_NOME.get(uf, uf), "reg": REGIAO.get(uf),
            "pop": int(a["pop"]), "a60": int(a["a60"]), "a65": int(a["a65"]),
            "p60": _pct(a["a60"], a["pop"]),
            "ben": int(a["ben"]), "apo": int(a["apo"]), "pen": int(a["pen"]),
            "ass": int(a["ass"]), "elegiveis": int(elegiveis),
            "vdez": _r(a["vdez"], 0), "vreal": _r(vreal, 0),
            "ben100_60": _r(100.0 * a["ben"] / a["a60"], 1) if a["a60"] else None,
            "peso": _pct(vreal, a["rdom"]) if (vreal and a["rdom"]) else None,
            "prural": _pct(a["rural"], a["rural"] + a["urbano"]) if (a["rural"] + a["urbano"]) else None,
            "pass": _pct(a["ass"], a["ben"]),
            "cons_obs": s.get("aposentados"),
            "cons_total": s.get("total"),
            "part_apos": s.get("part_aposentados"),
            "op_apos": s.get("operacoes_aposentados"),
            "inad_apos": s.get("inad_aposentados"),
        })
    for e in estados:
        if e["cons_obs"] and e["elegiveis"]:
            e["cons_por_elegivel"] = _r(e["cons_obs"] / e["elegiveis"], 0)
        if e["cons_obs"] and e["vreal"]:
            # Razão entre o saldo de consignado e um mês de benefícios líquidos. Não é
            # comprometimento: o saldo é estoque, o benefício é fluxo mensal.
            e["cons_sobre_mes"] = _r(e["cons_obs"] / e["vreal"], 2)
        if e["cons_obs"] and e["op_apos"]:
            e["saldo_por_operacao"] = _r(e["cons_obs"] / e["op_apos"], 0)

    # --- o teste de circularidade, em quatro especificações ---
    #
    # A primeira versão publicava uma correlação só, entre o peso dos benefícios na renda
    # domiciliar e o saldo de consignado por benefício elegível. Dava -0,72 e estava
    # inflada por um defeito de construção que passou pela primeira revisão: a QUANTIDADE
    # de benefícios aparece no numerador do lado esquerdo (valor = quantidade × benefício
    # médio) e no denominador do lado direito (consignado ÷ quantidade). Isso produz
    # correlação negativa por aritmética, independentemente do mundo — é uma versão mais
    # branda da própria circularidade que este módulo existe para evitar.
    #
    # As quatro especificações isolam o problema. A de referência é a que não compartilha
    # termo nenhum: o lado esquerdo vem só do Censo e o direito usa a população de 60 anos
    # ou mais como denominador, também do Censo.
    def correl(xs, ys):
        n = len(xs)
        if n < 8:
            return None
        mx, my = sum(xs) / n, sum(ys) / n
        sx = math.sqrt(sum((x - mx) ** 2 for x in xs))
        sy = math.sqrt(sum((y - my) ** 2 for y in ys))
        if not sx or not sy:
            return None
        return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / (sx * sy)

    def cor(ca, cb):
        par = [(e[ca], e[cb]) for e in estados
               if e.get(ca) is not None and e.get(cb) is not None]
        return correl([a for a, _ in par], [b for _, b in par]), len(par)

    def parcial(a, b, c):
        rab, _ = cor(a, b)
        rac, _ = cor(a, c)
        rbc, _ = cor(b, c)
        if None in (rab, rac, rbc) or abs(rac) >= 1 or abs(rbc) >= 1:
            return None
        return (rab - rac * rbc) / math.sqrt((1 - rac ** 2) * (1 - rbc ** 2))

    # Participação do rendimento de outras fontes por unidade da federação, ponderada pela
    # massa de renda domiciliar. Vem só do Censo e não toca registro da Previdência.
    outras = {}
    for m in muns:
        if m.get("uf") and m.get("outras") is not None and m.get("rdom"):
            a = outras.setdefault(m["uf"], [0.0, 0.0])
            a[0] += m["outras"] * m["rdom"]
            a[1] += m["rdom"]
    for e in estados:
        a = outras.get(e["uf"])
        e["outras_censo"] = _r(a[0] / a[1]) if a and a[1] else None
        if e.get("cons_obs") and e.get("a60"):
            e["cons_por_60"] = _r(e["cons_obs"] / e["a60"], 0)
        if e.get("vreal") and e.get("peso") and e.get("pop"):
            e["renda_por_hab"] = _r(e["vreal"] / (e["peso"] / 100.0) / e["pop"], 0)
        if e.get("vdez") and e.get("ben"):
            e["ben_medio"] = _r(e["vdez"] / e["ben"], 2)
        e["pass_uf"] = e.get("pass")

    ESPECS = [
        ("compartilhada", "Peso dos benefícios × consignado por benefício elegível",
         "peso", "cons_por_elegivel", False,
         "A quantidade de benefícios está no numerador de um lado e no denominador do "
         "outro. Foi a especificação publicada na primeira versão desta página, e "
         "superestima a associação."),
        ("denominador_censo", "Peso dos benefícios × consignado por pessoa de 60 anos ou mais",
         "peso", "cons_por_60", False,
         "Tira a quantidade de benefícios do denominador do lado direito. O lado esquerdo "
         "continua vindo do registro da Previdência."),
        ("esquerdo_censo", "Rendimento de outras fontes × consignado por benefício elegível",
         "outras_censo", "cons_por_elegivel", False,
         "Troca o lado esquerdo por medida exclusivamente do Censo. Sobra a quantidade de "
         "benefícios no denominador do lado direito."),
        ("independente", "Rendimento de outras fontes × consignado por pessoa de 60 anos ou mais",
         "outras_censo", "cons_por_60", True,
         "Nenhum termo compartilhado. É a especificação de referência desta página."),
    ]
    especificacoes = []
    for eid, rot, ce, cd, principal, obs in ESPECS:
        r, n = cor(ce, cd)
        especificacoes.append({"id": eid, "rotulo": rot, "esquerdo": ce, "direito": cd,
                               "r": _r(r, 3) if r is not None else None, "n": n,
                               "referencia": principal, "obs": obs})
    ref = next((x for x in especificacoes if x["referencia"]), None)

    # A mesma correlação no nível municipal, onde ela é mecânica por construção.
    mm = [(m["peso"], m["cons_ben"]) for m in muns
          if m.get("peso") and m.get("cons_ben")]
    r_mec = correl([x for x, _ in mm], [y for _, y in mm])

    controles = [{"variavel": rot,
                  "parcial_referencia": _r(parcial("outras_censo", "cons_por_60", cv), 3),
                  "parcial_compartilhada": _r(parcial("peso", "cons_por_elegivel", cv), 3)}
                 for cv, rot in (("renda_por_hab", "renda domiciliar por habitante"),
                                 ("pass_uf", "participação de benefícios assistenciais"),
                                 ("prural", "participação da clientela rural"))]

    MECANISMOS = [
        ("ben_medio", "valor médio do benefício",
         "Margem consignável é percentual do benefício, então benefício maior comportaria "
         "saldo maior. A associação é fraca demais para sustentar o resultado."),
        ("pass_uf", "participação de benefícios assistenciais",
         "Benefício assistencial tem regra de consignação distinta. A associação tem sinal "
         "oposto ao que a hipótese previa."),
        ("prural", "participação da clientela rural",
         "Aposentadoria rural concentra-se no piso previdenciário. Associação fraca."),
        ("renda_por_hab", "renda domiciliar por habitante",
         "Estados mais pobres teriam menos crédito de qualquer natureza. Explica parte da "
         "associação, não a maior parte."),
    ]
    mecanismo = {
        "estabelecido": False,
        "testados": [{"variavel": rot,
                      "com_consignado_por_60": _r(cor(cv, "cons_por_60")[0], 3),
                      "com_peso": _r(cor(cv, "peso")[0], 3),
                      "leitura": txt} for cv, rot, txt in MECANISMOS],
        "conclusao": (
            "Nenhum dos quatro candidatos explica o resultado. Roraima e Amapá são os casos "
            "que mais contrariam qualquer leitura simples: têm renda domiciliar por habitante "
            "próxima à do Piauí, maioria de clientela rural e a maior participação de "
            "benefícios assistenciais do país, e ainda assim registram consignado por pessoa "
            "idosa duas a três vezes maior. O mecanismo desta associação não está "
            "estabelecido, e a página não propõe um."),
    }

    return estados, {
        "selo": "observado",
        "n_uf": len(estados),
        "referencia": ref["r"] if ref else None,
        "especificacoes": especificacoes,
        "correlacao_mecanica": _r(r_mec, 3) if r_mec is not None else None,
        "controles": controles,
        "mecanismo": mecanismo,
        "explicacao": (
            "Quatro especificações da mesma pergunta. A diferença entre elas não é "
            "estatística, é de construção: a primeira compartilha a quantidade de benefícios "
            "entre os dois lados — ela aparece no numerador da dependência e no denominador "
            "do consignado por benefício — e por isso produz correlação negativa por "
            "aritmética. A última não compartilha termo nenhum. A correlação mecânica, "
            "calculada no nível municipal onde o consignado é o estadual repartido por uma "
            "chave previdenciária, mede a fórmula de alocação e não o mundo."),
        "leitura": (
            "A direção é robusta: negativa em todas as especificações e sob todos os "
            "controles. A magnitude não é — vai de -0,72 na versão com termo compartilhado a "
            "-0,24 na versão independente com controle de renda. O que se pode afirmar é que "
            "a hipótese intuitiva, de que mais dependência previdenciária viria com mais "
            "consignado por beneficiário, não encontra sustentação forte nos dados "
            "observados. Não que exista relação inversa demonstrada."),
        "conclusao_regra": (
            "Nenhuma afirmação sobre a relação entre dependência previdenciária e "
            "consignado nesta página se apoia no indicador municipal estimado."),
    }


# Critérios de saturação. Explícitos e ajustáveis, como o briefing exige, e aplicados
# apenas onde há indicador com base observada suficiente — a classificação nunca é
# atribuída a partir de uma alocação proporcional pura.
SATURACAO = {
    "cons_ben_alto": 6000.0,     # saldo alocado por benefício elegível, em reais
    "cons_ben_medio": 3000.0,
    "servico_alto": 25.0,        # parcela implícita sobre o benefício líquido, em %
    "servico_medio": 15.0,
}


def _saturacao(m):
    """Três faixas, a partir de dois sinais. Devolve (classe, motivo).

    A regra tem uma trava: município cujo selo de confiabilidade é baixo, ou cujo
    consignado é apenas alocação sem nenhum indicador de intensidade, não recebe
    classificação. Rotular de saturado um município que só recebeu uma fatia proporcional
    seria transformar a fórmula em diagnóstico.
    """
    if m.get("sel") == "baixa" or not m.get("cons_ben"):
        return None, "sem base observada suficiente para classificar"
    cb, sv = m["cons_ben"], m.get("servico") or 0
    if cb >= SATURACAO["cons_ben_alto"] or sv >= SATURACAO["servico_alto"]:
        return "possivel_saturacao", "saldo por benefício ou serviço da dívida no topo da distribuição"
    if cb >= SATURACAO["cons_ben_medio"] or sv >= SATURACAO["servico_medio"]:
        return "penetracao_elevada", "acima da mediana em saldo por benefício"
    return "baixa_penetracao", "abaixo da mediana em saldo por benefício"


def _indice_risco(m, cortes):
    """Índice transparente, em quatro dimensões separadas e depois combinadas.

    Cada dimensão é a posição normalizada do município na distribuição nacional do
    indicador, de 0 a 100. A soma é simples e sem pesos escondidos: quem quiser outro
    peso tem as quatro parcelas publicadas. O índice mede **sensibilidade do contexto**,
    não conduta de morador nem de instituição.
    """
    def pos(v, chave):
        if v is None:
            return None
        lo, hi = cortes[chave]
        if hi <= lo:
            return None
        return max(0.0, min(100.0, 100.0 * (v - lo) / (hi - lo)))

    vuln = [pos(m.get("p60"), "p60"), pos(m.get("peso"), "peso"),
            pos(-(m.get("rdom") or 0) / max(m.get("pop") or 1, 1), "rendainv")]
    expo = [pos(m.get("cons_ben"), "cons_ben"), pos(m.get("servico"), "servico")]
    conc = [pos(m.get("pass"), "pass"), pos(m.get("prural"), "prural")]

    def media(xs):
        v = [x for x in xs if x is not None]
        return _r(sum(v) / len(v), 1) if v else None

    d1, d2, d3 = media(vuln), media(expo), media(conc)
    partes = [x for x in (d1, d2, d3) if x is not None]
    return {
        "vulnerabilidade": d1, "exposicao": d2, "perfil_beneficio": d3,
        "indice": _r(sum(partes) / len(partes), 1) if partes else None,
    }


# Linha do tempo regulatória do consignado do INSS. Cada item traz norma, órgão e data,
# porque marcar um evento numa série sem a norma que o produziu convida à leitura causal
# automática — que a página proíbe explicitamente. Itens sem norma localizada não entram.
LINHA_DO_TEMPO = [
    {"d": "2003-10-22", "t": "Criação do consignado em benefício",
     "norma": "Lei 10.820/2003 e Decreto 4.862/2003", "tipo": "margem",
     "o": "Margem consignável de 30%, integralmente para empréstimo."},
    {"d": "2004-09-28", "t": "Consolidação da margem em lei",
     "norma": "Lei 10.953/2004", "tipo": "margem", "o": "Mantém os 30%."},
    {"d": "2015-07-10", "t": "Margem sobe para 35%",
     "norma": "MP 681/2015, convertida na Lei 13.172/2015", "tipo": "margem",
     "o": "30% para empréstimo e 5% reservados ao cartão consignado."},
    {"d": "2020-10-02", "t": "Margem temporária de 40%",
     "norma": "MP 1.006/2020", "tipo": "margem",
     "o": "Elevação com prazo até 31 de dezembro de 2020; reverte automaticamente."},
    {"d": "2021-03-31", "t": "Nova elevação temporária a 40%",
     "norma": "Lei 14.131/2021", "tipo": "margem",
     "o": "Vigência até 31 de dezembro de 2021, com reversão automática."},
    {"d": "2022-03-18", "t": "Margem de 40% restabelecida",
     "norma": "MP 1.106/2022", "tipo": "margem",
     "o": "35% para empréstimo mais 5% divididos entre cartão de crédito e cartão de benefício."},
    {"d": "2022-08-04", "t": "Margem chega a 45%",
     "norma": "Lei 14.431/2022", "tipo": "margem",
     "o": "35% de empréstimo, 5% de cartão de crédito consignado e 5% de cartão de benefício."},
    {"d": "2023-03-13", "t": "Teto de juros cortado para 1,70% ao mês",
     "norma": "Resolução CNPS 1.350/2023", "tipo": "teto",
     "o": "Instituições suspendem a oferta; o impasse dura quinze dias."},
    {"d": "2023-03-28", "t": "Teto acordado em 1,97% ao mês",
     "norma": "Resolução CNPS 1.351/2023", "tipo": "teto",
     "o": "Encerra a suspensão da oferta."},
    {"d": "2025-02-01", "t": "Prazo máximo passa a 96 meses",
     "norma": "Instrução Normativa INSS 181/2025", "tipo": "prazo",
     "o": "Antes eram 84 meses."},
    {"d": "2025-03-26", "t": "Teto de juros fixado em 1,85% ao mês",
     "norma": "Resolução CNPS 1.368/2025", "tipo": "teto",
     "o": "Reverte a trajetória de queda que havia chegado a 1,66%."},
    {"d": "2025-04-28", "t": "Suspensão dos descontos associativos",
     "norma": "Despacho Decisório PRES/INSS 65/2025", "tipo": "fraude",
     "o": "Suspende acordos de cooperação, repasses e os próprios descontos em benefício."},
    {"d": "2025-05-07", "t": "Bloqueio do consignado por padrão",
     "norma": "Despacho Decisório PRES/INSS 67/2025", "tipo": "fraude",
     "o": "Todos os benefícios passam a nascer bloqueados para empréstimo; liberar exige ato do titular."},
    {"d": "2025-05-12", "t": "Regras de ressarcimento",
     "norma": "Instrução Normativa INSS 186/2025", "tipo": "fraude",
     "o": "Prazo de quinze dias úteis para a entidade comprovar a autorização; devolução corrigida pelo IPCA."},
    {"d": "2025-05-16", "t": "Biometria obrigatória",
     "norma": "Despacho Decisório PRES/INSS 75/2025", "tipo": "fraude",
     "o": "Exigência de biometria no Meu INSS a partir de 23 de maio."},
    {"d": "2025-10-01", "t": "Suspensões de instituições",
     "norma": "Despachos Decisórios INSS 226, 227, 228 e 230/2025", "tipo": "sancao",
     "o": "Quatro instituições suspensas da oferta de consignado em benefício."},
    {"d": "2026-01-06", "t": "Proibição absoluta do desconto associativo",
     "norma": "Lei 15.327/2026", "tipo": "fraude",
     "o": "Veda o desconto ainda que haja autorização expressa; exige biometria e assinatura "
          "eletrônica qualificada para desbloquear, e rebloqueia após cada contratação."},
    {"d": "2026-05-19", "t": "Margem cai para 40%, com redução programada",
     "norma": "Medida Provisória 1.355/2026, artigo 23", "tipo": "margem",
     "o": "Queda de dois pontos percentuais ao ano a partir de 2027 até chegar a 30%, e extinção "
          "dos sublimites de cartão de crédito e de cartão de benefício. Contratos vigentes preservados."},
    {"d": "2026-05-01", "t": "Prazo máximo passa a 108 meses",
     "norma": "Instrução Normativa INSS 204/2026", "tipo": "prazo",
     "o": "Terceira ampliação em pouco mais de um ano."},
]

SGS_CONSIGNADO = {
    "inss": {"saldo": "consig_inss_saldo", "conc": "consig_inss_conc", "taxa": "consig_inss_taxa",
             "prazo_conc": "consig_inss_prazo_conc", "prazo_cart": "consig_inss_prazo_cart",
             "atraso": "consig_inss_atraso", "inad": "consig_inss_inad", "icc": "consig_inss_icc"},
    "privado": {"saldo": "consig_priv_saldo", "inad": "consig_priv_inad"},
    "publico": {"saldo": "consig_pub_saldo", "inad": "consig_pub_inad"},
    "total": {"saldo": "consig_total_saldo", "inad": "consig_total_inad", "taxa": "consig_total_taxa"},
}


def _sgs(con):
    """Séries nacionais do consignado por vínculo do tomador.

    Esta é a medida **direta** de consignado do INSS, e substitui o grupo de ocupação do
    SCR como número de referência nacional. A diferença é grande e precisa estar visível:
    o grupo "Aposentado/pensionista" do SCR cobre cerca de dois terços do saldo que o SGS
    registra como consignado do INSS, porque a classificação por ocupação do tomador não
    é a mesma coisa que a averbação em benefício. O SCR continua sendo usado só onde é
    insubstituível — o recorte por unidade da federação, que o SGS não tem.
    """
    out, series = {}, {}
    for bloco, campos in SGS_CONSIGNADO.items():
        out[bloco] = {}
        for campo, chave in campos.items():
            linhas = [(d, v) for d, v in con.execute(
                "SELECT ref_date, value FROM series_obs WHERE key=? ORDER BY ref_date", (chave,))]
            if not linhas:
                continue
            out[bloco][campo] = linhas[-1][1]
            series.setdefault(campo, {}).setdefault(bloco, linhas)
    if not out.get("inss"):
        return None
    ult = con.execute(
        "SELECT MAX(ref_date) FROM series_obs WHERE key='consig_inss_saldo'").fetchone()[0]

    def serie(campo, blocos):
        base = {}
        for b in blocos:
            for d, v in series.get(campo, {}).get(b, []):
                base.setdefault(d[:7], {})[b] = v
        return [{"d": d, **base[d]} for d in sorted(base)]

    return {
        "selo": "observado", "data_base": ult,
        "unidade_saldo": "R$ milhões",
        "atual": out,
        "series": {
            "saldo": serie("saldo", ["inss", "publico", "privado"]),
            "inad": serie("inad", ["inss", "publico", "privado", "total"]),
            "taxa": serie("taxa", ["inss", "total"]),
            "conc": serie("conc", ["inss"]),
            "prazo": serie("prazo_conc", ["inss"]),
        },
        "aviso_proxy": (
            "O saldo de consignado do INSS aqui é o do Banco Central por vínculo do tomador, "
            "medida direta e nacional. O grupo “Aposentado/pensionista” do SCR, usado adiante "
            "para o recorte por unidade da federação, cobre cerca de dois terços deste valor: "
            "classificar pela ocupação declarada não é o mesmo que identificar a averbação em "
            "benefício. Os dois números não são somados nem intercambiados."),
    }
