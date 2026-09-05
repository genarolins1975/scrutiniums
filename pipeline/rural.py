"""Crédito rural — gold rural.json (+ rural_mun.json, separado pelo build).

Fonte única: Matriz de Dados do Crédito Rural (MDCR/Sicor) do BCB, coletada por
pipeline/sources/sicor.py. Tudo aqui é CONTRATAÇÃO (fluxo: valor e quantidade de
cédulas emitidas no mês), nunca saldo. O saldo da carteira rural do sistema vive
no IF.data (aba Produtos, "Crédito rural PF") e no SGS; os dois universos não se
somam nem se dividem um pelo outro.

Regras que sustentam o painel:
1. **Meses parciais são declarados, não escondidos.** Os contratos entram no Sicor
   com atraso e o BCB republica os meses recentes. A janela de 12 meses termina no
   último mês FECHADO (dois meses antes do corrente); os meses posteriores aparecem
   na série com a marca `parcial` e ficam fora de toda razão e ranking.
2. **Safra, não ano civil.** O ano agrícola vai de julho a junho (Plano Safra). As
   séries anuais são por safra ("2024/25"); a safra corrente é marcada como
   incompleta.
3. **Ausência não é zero.** Município sem contratação registrada no período fica
   com valor nulo e é contado à parte; nunca entra como 0 em ranking de intensidade.
4. **Universos declarados.** O recorte por gênero cobre só pessoas físicas com sexo
   informado (a fonte não abre PJ), e a tabela de instituições soma o valor por IF
   contratante, não por conglomerado.
5. **Por habitante é intensidade, não acesso.** Valor contratado ÷ população (Censo
   2022) ordena municípios de porte diferente numa régua comum; não mede produtores
   atendidos nem área financiada por produtor.
"""
from datetime import date

from pipeline import common

FONTE = {
    "nome": "BCB — Matriz de Dados do Crédito Rural (MDCR/Sicor)",
    "url": "https://olinda.bcb.gov.br/olinda/servico/SICOR/versao/v2/odata/",
    "catalogo": "https://dadosabertos.bcb.gov.br/dataset/matrizdadoscreditorural",
    "licenca": "ODbL (Open Data Commons Open Database License)",
    "nivel": "A — dado administrativo oficial (registro obrigatório das cédulas no Sicor)",
}
ATIVIDADE = {"1": "agrícola", "2": "pecuária"}
# cdSexo na MDCR: confirmado pelo subprograma 57 do PRONAF ("MULHER (MCR 10-9)"):
# em 2026-03, 100% dos 1.674 contratos desse subprograma têm cdSexo = 1
# (RegiaoUFGenero, consulta de 05/09/2026) — ver FONTES_OPERACIONAL §42.
SEXO = {"1": "feminino", "2": "masculino"}
FINALIDADES = [("custeio", "vl_c", "qtd_c"), ("investimento", "vl_i", "qtd_i"),
               ("comercializacao", "vl_com", "qtd_com"), ("industrializacao", "vl_ind", "qtd_ind")]
MESES_PARCIAIS = 2   # corrente e anterior
UF_IBGE = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "22": "PI",
           "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES",
           "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF"}
REGIOES = {"AC": "Norte", "AM": "Norte", "AP": "Norte", "PA": "Norte", "RO": "Norte", "RR": "Norte", "TO": "Norte",
           "AL": "Nordeste", "BA": "Nordeste", "CE": "Nordeste", "MA": "Nordeste", "PB": "Nordeste", "PE": "Nordeste",
           "PI": "Nordeste", "RN": "Nordeste", "SE": "Nordeste",
           "ES": "Sudeste", "MG": "Sudeste", "RJ": "Sudeste", "SP": "Sudeste",
           "PR": "Sul", "RS": "Sul", "SC": "Sul",
           "DF": "Centro-Oeste", "GO": "Centro-Oeste", "MS": "Centro-Oeste", "MT": "Centro-Oeste"}

# Famílias de fonte de recursos: o nome da MDCR carrega a natureza
# (DIRECIONADA/CONTROLADA, EQUALIZADA, LIVRE) e a origem. A família é atribuída
# por padrão explícito no nome, na ordem abaixo — o primeiro que casar vale.
FAMILIAS_FONTE = [
    ("Poupança rural", "POUPAN"),
    ("LCA", "LETRA DE CR"),
    ("Exigibilidades (MCR 6.2)", "OBRIGAT"),
    ("Fundos constitucionais (FNE, FNO, FCO)", "FUNDO CONSTITUCIONAL"),
    ("BNDES e Finame", "BNDES"),
    ("Recursos livres", "RECURSOS LIVRES"),
    ("Funcafé", "FUNCAF"),
    ("Tesouro Nacional", "TESOURO"),
    ("Depósitos à vista (MCR 6.2 antigo)", "DEP"),
]


def _rows(con, sql, args=()):
    cur = con.execute(sql, args)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def _meses(n_parciais=MESES_PARCIAIS):
    hoje = date.today()
    y, m = hoje.year, hoje.month
    out = []
    for _ in range(n_parciais):
        out.append(f"{y}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return out


def _safra(mes):
    """'2025-03' → '2024/25' (julho a junho)."""
    a, m = int(mes[:4]), int(mes[5:7])
    ini = a if m >= 7 else a - 1
    return f"{ini}/{str(ini + 1)[2:]}"


def _familia_fonte(nome):
    n = (nome or "").upper()
    for fam, pat in FAMILIAS_FONTE:
        if pat in n:
            return fam
    return "Outras fontes"


def _janela12(mes_fim):
    a, m = int(mes_fim[:4]), int(mes_fim[5:7])
    out = []
    for _ in range(12):
        out.append(f"{a}-{m:02d}")
        m -= 1
        if m == 0:
            a, m = a - 1, 12
    return sorted(out)


def _r(v, d=2):
    return None if v is None else round(v, d)


def _share(v, tot):
    return _r(100.0 * v / tot, 2) if tot else None


def _hhi(vals):
    tot = sum(vals)
    return round(sum((100.0 * v / tot) ** 2 for v in vals), 0) if tot else None


def build(con, cfg=None):
    # ---- meses e janelas ----
    # Universo: FonteRecursos (nacional, com finalidade, atividade e programa) e o
    # municipal fecham com o recurso Faixa ao centavo em todos os meses medidos;
    # RegiaoUF fica 2% a 8% abaixo em todos os meses (05/09/2026) e entra só na
    # nota de cobertura. Série nacional = sicor_fonte; recorte por UF = municipal
    # agregado pelo prefixo do código IBGE.
    meses_db = [r["mes"] for r in _rows(con, "SELECT DISTINCT mes FROM sicor_fonte ORDER BY mes")]
    if not meses_db:
        return {"disponivel": False, "motivo": "silver sicor_fonte vazio — coleta ainda não rodou"}
    parciais = [m for m in _meses() if m in meses_db]
    fechados = [m for m in meses_db if m not in parciais]
    mes_recente = meses_db[-1]
    mes_fechado = fechados[-1]
    janela = _janela12(mes_fechado)
    ini, fim = janela[0], janela[-1]
    jan_ant = _janela12(_janela12(ini)[0])  # 12 meses anteriores à janela
    # se a janela anterior escapa da história, encolhe (var 12m fica nula)
    jan_ant = [m for m in jan_ant if m in meses_db]
    in12 = ",".join("?" * len(janela))

    # ---- série mensal nacional por finalidade e atividade ----
    mensal = _rows(con, """SELECT mes, atividade,
        SUM(vl_c) vl_c, SUM(qtd_c) qtd_c, SUM(vl_i) vl_i, SUM(qtd_i) qtd_i,
        SUM(vl_com) vl_com, SUM(qtd_com) qtd_com, SUM(vl_ind) vl_ind, SUM(qtd_ind) qtd_ind
        FROM sicor_fonte GROUP BY mes, atividade ORDER BY mes""")
    por_mes = {}
    for r in mensal:
        p = por_mes.setdefault(r["mes"], {"mes": r["mes"], "custeio": 0.0, "investimento": 0.0, "comercializacao": 0.0,
                                          "industrializacao": 0.0, "qtd": 0, "agricola": 0.0, "pecuaria": 0.0,
                                          "parcial": r["mes"] in parciais})
        for fin, vk, qk in FINALIDADES:
            p[fin] += r[vk] or 0
            p["qtd"] += r[qk] or 0
        tot = sum((r[vk] or 0) for _, vk, _ in FINALIDADES)
        if r["atividade"] == "1":
            p["agricola"] += tot
        else:
            p["pecuaria"] += tot
    serie = []
    for m in sorted(por_mes):
        p = por_mes[m]
        p["valor"] = p["custeio"] + p["investimento"] + p["comercializacao"] + p["industrializacao"]
        for k in ("custeio", "investimento", "comercializacao", "industrializacao", "agricola", "pecuaria", "valor"):
            p[k] = round(p[k], 2)
        serie.append(p)

    # ---- safras ----
    safras = {}
    for p in serie:
        s = safras.setdefault(_safra(p["mes"]), {"safra": _safra(p["mes"]), "valor": 0.0, "qtd": 0, "custeio": 0.0,
                                                  "investimento": 0.0, "comercializacao": 0.0, "industrializacao": 0.0,
                                                  "meses": 0, "incompleta": False})
        for k in ("valor", "custeio", "investimento", "comercializacao", "industrializacao"):
            s[k] += p[k]
        s["qtd"] += p["qtd"]
        s["meses"] += 1
        if p["parcial"]:
            s["incompleta"] = True
    safra_lista = []
    for k in sorted(safras):
        s = safras[k]
        if s["meses"] < 12:
            s["incompleta"] = True
        for kk in ("valor", "custeio", "investimento", "comercializacao", "industrializacao"):
            s[kk] = round(s[kk], 2)
        safra_lista.append(s)

    # ---- totais da janela ----
    def tot_janela(ms):
        if not ms:
            return None
        q = ",".join("?" * len(ms))
        r = _rows(con, f"""SELECT SUM(vl_c+vl_i+vl_com+vl_ind) valor, SUM(qtd_c+qtd_i+qtd_com+qtd_ind) qtd,
            SUM(vl_c) custeio, SUM(vl_i) investimento, SUM(vl_com) comercializacao, SUM(vl_ind) industrializacao,
            SUM(CASE WHEN atividade='1' THEN vl_c+vl_i+vl_com+vl_ind ELSE 0 END) agricola
            FROM sicor_fonte WHERE mes IN ({q})""", ms)[0]
        return r
    T = tot_janela(janela)
    T_ant = tot_janela(jan_ant) if len(jan_ant) == 12 else None
    valor12 = T["valor"] or 0.0
    qtd12 = T["qtd"] or 0

    # ---- programas (12m) ----
    nomes = {(r["tipo"], r["cd"]): r["nome"] for r in _rows(con, "SELECT tipo, cd, nome FROM sicor_nomes")}
    def nome_prog(cd):
        n = nomes.get(("programa", cd)) or f"programa {cd}"
        return n.replace("...", "").strip().split(" - ")[0].title().replace("Pronaf", "PRONAF").replace("Pronamp", "PRONAMP")
    prog = _rows(con, f"""SELECT programa, SUM(vl_c+vl_i+vl_com+vl_ind) valor, SUM(qtd_c+qtd_i+qtd_com+qtd_ind) qtd,
        SUM(CASE WHEN atividade='1' THEN vl_c+vl_i+vl_com+vl_ind ELSE 0 END) agricola,
        SUM(vl_c) custeio, SUM(vl_i) investimento
        FROM sicor_fonte WHERE mes IN ({in12}) GROUP BY programa ORDER BY valor DESC""", janela)
    programas = [{"cd": r["programa"], "nome": nome_prog(r["programa"]), "valor": _r(r["valor"]), "qtd": r["qtd"],
                  "share": _share(r["valor"], valor12), "ticket": _r(r["valor"] / r["qtd"]) if r["qtd"] else None,
                  "agricola_share": _share(r["agricola"], r["valor"]),
                  "custeio_share": _share(r["custeio"], r["valor"])} for r in prog]
    cd_pronaf = next((p["cd"] for p in programas if "PRONAF" in p["nome"].upper()), None)
    cd_pronamp = next((p["cd"] for p in programas if "PRONAMP" in p["nome"].upper()), None)
    pronaf12 = next((p["valor"] for p in programas if p["cd"] == cd_pronaf), 0.0) or 0.0
    # série por safra dos grandes programas
    prog_safra = _rows(con, """SELECT mes, programa, SUM(vl_c+vl_i+vl_com+vl_ind) valor FROM sicor_fonte GROUP BY mes, programa""")
    ps = {}
    for r in prog_safra:
        grupo = "PRONAF" if r["programa"] == cd_pronaf else "PRONAMP" if r["programa"] == cd_pronamp else \
            "Sem programa" if r["programa"] == "0999" else "Demais programas"
        ps.setdefault(_safra(r["mes"]), {}).setdefault(grupo, 0.0)
        ps[_safra(r["mes"])][grupo] += r["valor"] or 0
    programas_safra = [{"safra": k, **{g: round(v, 2) for g, v in ps[k].items()},
                        "incompleta": safras[k]["incompleta"]} for k in sorted(ps)]

    # ---- fontes de recursos (12m, nacional) ----
    fon = _rows(con, f"""SELECT fonte_nome, SUM(vl_c+vl_i+vl_com+vl_ind) valor, SUM(qtd_c+qtd_i+qtd_com+qtd_ind) qtd
        FROM sicor_fonte WHERE mes IN ({in12}) GROUP BY fonte_nome ORDER BY valor DESC""", janela)
    tot_fonte = sum((r["valor"] or 0) for r in fon)
    fontes = []
    fam = {}
    for r in fon:
        n = r["fonte_nome"] or ""
        up = n.upper()
        f = _familia_fonte(n)
        item = {"nome": n.strip(), "familia": f, "valor": _r(r["valor"]), "qtd": r["qtd"], "share": _share(r["valor"], tot_fonte),
                "controlada": "CONTROLADA" in up and "NÃO CONTROLADA" not in up,
                "equalizada": "EQUALIZADA" in up, "livre": up.startswith("RECURSOS LIVRES") or " LIVRE/" in up}
        fontes.append(item)
        g = fam.setdefault(f, {"familia": f, "valor": 0.0, "qtd": 0, "controlada": 0.0, "equalizada": 0.0})
        g["valor"] += r["valor"] or 0
        g["qtd"] += r["qtd"] or 0
        if item["controlada"]:
            g["controlada"] += r["valor"] or 0
        if item["equalizada"]:
            g["equalizada"] += r["valor"] or 0
    familias = sorted([{**g, "valor": _r(g["valor"]), "share": _share(g["valor"], tot_fonte),
                        "controlada_share": _share(g["controlada"], g["valor"]),
                        "equalizada_share": _share(g["equalizada"], g["valor"])} for g in fam.values()],
                      key=lambda x: -(x["valor"] or 0))
    controlada12 = sum(i["valor"] for i in fontes if i["controlada"])
    equalizada12 = sum(i["valor"] for i in fontes if i["equalizada"])
    fon_safra = _rows(con, "SELECT mes, fonte_nome, SUM(vl_c+vl_i+vl_com+vl_ind) valor FROM sicor_fonte GROUP BY mes, fonte_nome")
    fs = {}
    for r in fon_safra:
        fs.setdefault(_safra(r["mes"]), {}).setdefault(_familia_fonte(r["fonte_nome"]), 0.0)
        fs[_safra(r["mes"])][_familia_fonte(r["fonte_nome"])] += r["valor"] or 0
    familias_safra = [{"safra": k, **{f: round(v, 2) for f, v in fs[k].items()}, "incompleta": safras.get(k, {}).get("incompleta", True)}
                      for k in sorted(fs)]

    # ---- faixas de valor (12m) ----
    fx = _rows(con, f"""SELECT idx, MAX(faixa) faixa, SUM(qtd) qtd, SUM(valor) valor FROM sicor_faixa
        WHERE mes IN ({in12}) GROUP BY idx ORDER BY idx""", janela)
    tq = sum(r["qtd"] for r in fx) or 1
    tv = sum(r["valor"] for r in fx) or 1
    faixas = [{"idx": r["idx"], "faixa": r["faixa"], "qtd": r["qtd"], "valor": _r(r["valor"]),
               "share_qtd": _share(r["qtd"], tq), "share_valor": _share(r["valor"], tv),
               "ticket": _r(r["valor"] / r["qtd"]) if r["qtd"] else None} for r in fx]
    acima_1mi_valor = sum(r["valor"] for r in fx if r["idx"] >= 10)
    ate_20mil_qtd = sum(r["qtd"] for r in fx if r["idx"] <= 2)

    # ---- gênero (12m) ----
    gen = _rows(con, f"""SELECT uf, sexo, SUM(vl_c+vl_i+vl_com+vl_ind) valor, SUM(qtd_c+qtd_i+qtd_com+qtd_ind) qtd
        FROM sicor_genero WHERE mes IN ({in12}) GROUP BY uf, sexo""", janela)
    gn = {}
    guf = {}
    for r in gen:
        s = SEXO.get(r["sexo"], "não informado")
        gn.setdefault(s, [0.0, 0]); gn[s][0] += r["valor"] or 0; gn[s][1] += r["qtd"] or 0
        u = guf.setdefault(r["uf"], {})
        u.setdefault(s, [0.0, 0]); u[s][0] += r["valor"] or 0; u[s][1] += r["qtd"] or 0
    gtot_v = sum(v[0] for v in gn.values()) or 1
    gtot_q = sum(v[1] for v in gn.values()) or 1
    fem = gn.get("feminino", [0.0, 0])
    masc = gn.get("masculino", [0.0, 0])
    genero = {
        "janela": {"ini": ini, "fim": fim},
        "universo": "pessoas físicas com sexo informado no Sicor (a MDCR não abre pessoas jurídicas por gênero)",
        "cobertura_valor_pct": _share(gtot_v, valor12),
        "mulheres_share_valor": _share(fem[0], gtot_v), "mulheres_share_qtd": _share(fem[1], gtot_q),
        "ticket_mulheres": _r(fem[0] / fem[1]) if fem[1] else None, "ticket_homens": _r(masc[0] / masc[1]) if masc[1] else None,
        "por_uf": sorted([{"uf": u, "regiao": REGIOES.get(u), "mulheres_share_valor": _share(d.get("feminino", [0, 0])[0], sum(v[0] for v in d.values()) or 1),
                           "mulheres_share_qtd": _share(d.get("feminino", [0, 0])[1], sum(v[1] for v in d.values()) or 1)}
                          for u, d in guf.items() if u], key=lambda x: -(x["mulheres_share_qtd"] or 0)),
    }
    gen_safra = _rows(con, "SELECT mes, sexo, SUM(vl_c+vl_i+vl_com+vl_ind) valor, SUM(qtd_c+qtd_i+qtd_com+qtd_ind) qtd FROM sicor_genero GROUP BY mes, sexo")
    gs = {}
    for r in gen_safra:
        d = gs.setdefault(_safra(r["mes"]), {"v": {}, "q": {}})
        s = SEXO.get(r["sexo"], "ni")
        d["v"][s] = d["v"].get(s, 0.0) + (r["valor"] or 0)
        d["q"][s] = d["q"].get(s, 0) + (r["qtd"] or 0)
    genero["serie_safra"] = [{"safra": k, "mulheres_share_valor": _share(gs[k]["v"].get("feminino", 0), sum(gs[k]["v"].values()) or 1),
                              "mulheres_share_qtd": _share(gs[k]["q"].get("feminino", 0), sum(gs[k]["q"].values()) or 1),
                              "incompleta": safras.get(k, {}).get("incompleta", True)} for k in sorted(gs)]

    # ---- instituições (12m) ----
    meses_if = [r["mes"] for r in _rows(con, "SELECT DISTINCT mes FROM sicor_if")]
    jan_if = [m for m in janela if m in meses_if]
    instituicoes = {"disponivel": False}
    if jan_if:
        qif = ",".join("?" * len(jan_if))
        ifs = _rows(con, f"""SELECT cnpj, MAX(nome) nome, MAX(segmento) segmento, MAX(categoria) categoria,
            SUM(vl_c+vl_i+vl_com+vl_ind) valor, SUM(qtd_c+qtd_i+qtd_com+qtd_ind) qtd,
            SUM(CASE WHEN programa=? THEN vl_c+vl_i+vl_com+vl_ind ELSE 0 END) pronaf
            FROM sicor_if WHERE mes IN ({qif}) GROUP BY cnpj ORDER BY valor DESC""", [cd_pronaf or ""] + jan_if)
        tot_if = sum((r["valor"] or 0) for r in ifs) or 1
        seg_nome = {}
        for r in _rows(con, "SELECT DISTINCT segmento FROM sicor_if"):
            seg_nome[r["segmento"]] = r["segmento"]
        # nomes de segmento vêm do próprio recurso (nomeSegmento) na coleta por IF
        segs = {}
        for r in ifs:
            s = segs.setdefault(r["segmento"], {"segmento": r["segmento"], "valor": 0.0, "qtd": 0, "n": 0})
            s["valor"] += r["valor"] or 0; s["qtd"] += r["qtd"] or 0; s["n"] += 1
        top = ifs[:30]
        instituicoes = {
            "disponivel": True, "janela": {"ini": jan_if[0], "fim": jan_if[-1], "meses": len(jan_if)},
            "n_ifs": len(ifs), "hhi": _hhi([r["valor"] or 0 for r in ifs]),
            "top5_share": _share(sum((r["valor"] or 0) for r in ifs[:5]), tot_if),
            "top": [{"cnpj": r["cnpj"], "nome": (r["nome"] or "").strip(), "segmento": r["segmento"], "categoria": r["categoria"],
                     "valor": _r(r["valor"]), "qtd": r["qtd"], "share": _share(r["valor"], tot_if),
                     "ticket": _r(r["valor"] / r["qtd"]) if r["qtd"] else None,
                     "pronaf_share": _share(r["pronaf"], r["valor"])} for r in top],
            "por_segmento": sorted([{**s, "valor": _r(s["valor"]), "share": _share(s["valor"], tot_if)} for s in segs.values()],
                                   key=lambda x: -(x["valor"] or 0)),
            "nota": ("valor por instituição contratante (CNPJ da IF no Sicor), não por conglomerado; cooperativas singulares "
                     "aparecem uma a uma. HHI sobre o valor contratado no período — concentração de originação, não de carteira."),
        }
    # nome dos segmentos: a coleta guardou o código; o nome vem do recurso SegmentoIF
    # (nomeSegmento) e é conhecido para os códigos frequentes
    SEGMENTOS = {"108": "Banco múltiplo", "109": "Cooperativa de crédito", "101": "Banco comercial",
                 "104": "Banco de desenvolvimento", "105": "Banco de investimento", "110": "Agência de fomento",
                 "111": "Banco cooperativo", "115": "Sociedade de crédito, financiamento e investimento",
                 "117": "Banco de câmbio"}
    if instituicoes.get("disponivel"):
        for s in instituicoes["por_segmento"]:
            s["nome"] = SEGMENTOS.get(s["segmento"], f"segmento {s['segmento']}")
        for t in instituicoes["top"]:
            t["segmento_nome"] = SEGMENTOS.get(t["segmento"], f"segmento {t['segmento']}")
        coop = sum((s["valor"] or 0) for s in instituicoes["por_segmento"] if s["segmento"] in ("109", "111"))
        instituicoes["cooperativas_share"] = _share(coop, sum((s["valor"] or 0) for s in instituicoes["por_segmento"]) or 1)

    # ---- população municipal e por UF (Censo 2022, via gold da penetração) ----
    # no build, penetracao.json ainda carrega o array de municípios (a separação em
    # penetracao_mun.json vem depois); num rebuild avulso, o arquivo separado serve
    pen = common.ler_gold_opcional("penetracao.json") or {}
    lista_mun = pen.get("municipios") or (common.ler_gold_opcional("penetracao_mun.json") or {}).get("municipios") or []
    pop = {}
    nomes_mun = {}
    pop_uf = {}
    for m in lista_mun:
        pop[m["cod"]] = m.get("pop_total")
        nomes_mun[m["cod"]] = (m.get("nome"), m.get("uf"))
        if m.get("uf") and m.get("pop_total"):
            pop_uf[m["uf"]] = pop_uf.get(m["uf"], 0) + m["pop_total"]

    # ---- UFs (12m) ----
    meses_mun = [r["mes"] for r in _rows(con, "SELECT DISTINCT mes FROM sicor_mun")]
    jan_mun = [m for m in janela if m in meses_mun]
    ufs_rows = []
    if len(jan_mun) == 12:
        qm12 = ",".join("?" * len(jan_mun))
        ufs_rows = _rows(con, f"""SELECT SUBSTR(cod_ibge, 1, 2) cod_uf, SUM(vl_c+vl_i+vl_com+vl_ind) valor, SUM(qtd_c+qtd_i+qtd_com+qtd_ind) qtd,
            SUM(vl_c) custeio, SUM(vl_i) investimento, SUM(vl_com) comercializacao, SUM(vl_ind) industrializacao,
            SUM(CASE WHEN atividade='1' THEN vl_c+vl_i+vl_com+vl_ind ELSE 0 END) agricola,
            SUM(CASE WHEN programa=? THEN vl_c+vl_i+vl_com+vl_ind ELSE 0 END) pronaf
            FROM sicor_mun WHERE mes IN ({qm12}) GROUP BY cod_uf ORDER BY valor DESC""", [cd_pronaf or ""] + jan_mun)
        for r in ufs_rows:
            r["uf"] = UF_IBGE.get(r["cod_uf"])
    # cobertura do recurso RegiaoUF (usado pelo BCB para o recorte estadual): fica abaixo do universo
    uf_tot = _rows(con, f"SELECT SUM(vl_c+vl_i+vl_com+vl_ind) v FROM sicor_uf WHERE mes IN ({in12})", janela)[0]["v"]
    cobertura_regiao_uf = _share(uf_tot, valor12) if uf_tot else None
    ufs = [{"uf": r["uf"], "regiao": REGIOES.get(r["uf"]), "valor": _r(r["valor"]), "qtd": r["qtd"], "share": _share(r["valor"], valor12),
            "custeio": _r(r["custeio"]), "investimento": _r(r["investimento"]), "comercializacao": _r(r["comercializacao"]),
            "industrializacao": _r(r["industrializacao"]), "agricola_share": _share(r["agricola"], r["valor"]),
            "pronaf_share": _share(r["pronaf"], r["valor"]), "ticket": _r(r["valor"] / r["qtd"]) if r["qtd"] else None,
            "pop": pop_uf.get(r["uf"]), "valor_hab": _r(r["valor"] / pop_uf[r["uf"]]) if pop_uf.get(r["uf"]) else None}
           for r in ufs_rows if r["uf"]]

    # ---- produtos (12m) ----
    meses_prod = [r["mes"] for r in _rows(con, "SELECT DISTINCT mes FROM sicor_produto")]
    jan_prod = [m for m in janela if m in meses_prod]
    produtos = {"disponivel": False}
    if jan_prod:
        qp = ",".join("?" * len(jan_prod))
        pr = _rows(con, f"""SELECT finalidade, produto, SUM(valor) valor, SUM(qtd) qtd, SUM(area) area
            FROM sicor_produto WHERE mes IN ({qp}) GROUP BY finalidade, produto ORDER BY valor DESC""", jan_prod)
        por_fin = {}
        for r in pr:
            por_fin.setdefault(r["finalidade"], []).append(r)
        def lista(fin, n=15):
            L = por_fin.get(fin, [])
            tot = sum((r["valor"] or 0) for r in L) or 1
            return [{"produto": (r["produto"] or "").title(), "valor": _r(r["valor"]), "qtd": r["qtd"],
                     "area_ha": _r(r["area"], 0) if fin == "custeio" else None, "share": _share(r["valor"], tot),
                     "valor_ha": _r(r["valor"] / r["area"]) if fin == "custeio" and r["area"] else None} for r in L[:n]]
        pu = _rows(con, f"""SELECT uf, finalidade, produto, SUM(valor) valor FROM sicor_produto WHERE mes IN ({qp})
            GROUP BY uf, finalidade, produto ORDER BY valor DESC""", jan_prod)
        por_uf = {}
        for r in pu:
            d = por_uf.setdefault(r["uf"], {"custeio": [], "investimento": []})
            if len(d[r["finalidade"]]) < 5:
                d[r["finalidade"]].append({"produto": (r["produto"] or "").title(), "valor": _r(r["valor"])})
        produtos = {"disponivel": True, "janela": {"ini": jan_prod[0], "fim": jan_prod[-1], "meses": len(jan_prod)},
                    "custeio": lista("custeio"), "investimento": lista("investimento"), "por_uf": por_uf,
                    "nota": ("produto é o item financiado declarado na cédula (custeio: cultura ou criação; investimento: bem "
                             "ou obra). Área financiada só existe no custeio agrícola; valor por hectare é razão sobre a área "
                             "declarada, não custo de produção.")}

    # ---- municípios (12m) ----
    municipios = []
    mun_meta = {"disponivel": False}
    if jan_mun:
        qm = ",".join("?" * len(jan_mun))
        mrows = _rows(con, f"""SELECT cod_ibge, SUM(vl_c+vl_i+vl_com+vl_ind) valor, SUM(qtd_c+qtd_i+qtd_com+qtd_ind) qtd,
            SUM(vl_c) custeio, SUM(vl_i) investimento, SUM(vl_com) comercializacao, SUM(vl_ind) industrializacao,
            SUM(CASE WHEN atividade='1' THEN vl_c+vl_i+vl_com+vl_ind ELSE 0 END) agricola,
            SUM(CASE WHEN programa=? THEN vl_c+vl_i+vl_com+vl_ind ELSE 0 END) pronaf, SUM(area_c) area_c
            FROM sicor_mun WHERE mes IN ({qm}) GROUP BY cod_ibge""", [cd_pronaf or ""] + jan_mun)
        com = {r["cod_ibge"]: r for r in mrows}
        todos = set(nomes_mun) | set(com)
        for cod in sorted(todos):
            r = com.get(cod)
            nm, uf = nomes_mun.get(cod, (None, None))
            if not uf:  # código fora da lista do IBGE (ex.: área especial): a UF vem do prefixo, o nome fica nulo
                uf = UF_IBGE.get(cod[:2])
            p = pop.get(cod)
            if r:
                municipios.append({"cod": cod, "nome": nm, "uf": uf, "regiao": REGIOES.get(uf), "pop": p,
                                   "valor": _r(r["valor"]), "qtd": r["qtd"], "custeio": _r(r["custeio"]), "investimento": _r(r["investimento"]),
                                   "comercializacao": _r(r["comercializacao"]), "industrializacao": _r(r["industrializacao"]),
                                   "agricola_share": _share(r["agricola"], r["valor"]), "pronaf_share": _share(r["pronaf"], r["valor"]),
                                   "valor_hab": _r(r["valor"] / p) if p else None, "ticket": _r(r["valor"] / r["qtd"]) if r["qtd"] else None,
                                   "area_c": _r(r["area_c"], 0)})
            else:
                municipios.append({"cod": cod, "nome": nm, "uf": uf, "regiao": REGIOES.get(uf), "pop": p, "valor": None, "qtd": 0,
                                   "custeio": None, "investimento": None, "comercializacao": None, "industrializacao": None,
                                   "agricola_share": None, "pronaf_share": None, "valor_hab": None, "ticket": None, "area_c": None})
        tot_mun = sum((r["valor"] or 0) for r in mrows)
        com_val = [m for m in municipios if m["valor"]]
        mun_meta = {"disponivel": True, "janela": {"ini": jan_mun[0], "fim": jan_mun[-1], "meses": len(jan_mun)},
                    "n_municipios": len(municipios), "com_contratacao": len(com_val),
                    "sem_contratacao": len([m for m in municipios if not m["valor"]]),
                    "sem_nome": len([m for m in municipios if m["nome"] is None]),
                    "reconciliacao_universo_pct": _share(tot_mun, valor12),
                    "top50_share": _share(sum(m["valor"] for m in sorted(com_val, key=lambda x: -x["valor"])[:50]), tot_mun or 1)}
    rankings = {}
    if municipios:
        com_val = [m for m in municipios if m["valor"]]
        rankings = {
            "maior_valor": [{"cod": m["cod"], "nome": m["nome"], "uf": m["uf"], "valor": m["valor"], "qtd": m["qtd"]}
                            for m in sorted(com_val, key=lambda x: -x["valor"])[:30]],
            "maior_por_habitante": [{"cod": m["cod"], "nome": m["nome"], "uf": m["uf"], "valor_hab": m["valor_hab"], "pop": m["pop"]}
                                    for m in sorted([x for x in com_val if x["pop"] and x["pop"] >= 5000], key=lambda x: -x["valor_hab"])[:30]],
            "maior_pronaf": [{"cod": m["cod"], "nome": m["nome"], "uf": m["uf"], "pronaf_share": m["pronaf_share"], "valor": m["valor"]}
                             for m in sorted([x for x in com_val if x["valor"] >= 50e6], key=lambda x: -(x["pronaf_share"] or 0))[:30]],
            "regra_por_habitante": "só municípios com 5 mil habitantes ou mais (Censo 2022); denominador pequeno fabricaria intensidade",
            "regra_pronaf": "só municípios com ao menos R$ 50 milhões contratados na janela",
        }

    # ---- síntese determinística ----
    def br(v, d=1):
        """número em pt-BR: 1234567.8 → '1.234.567,8' (só o número, nunca a frase)."""
        txt = f"{v:,.{d}f}"
        return txt.replace(",", "X").replace(".", ",").replace("X", ".")
    var12 = _share(valor12 - (T_ant["valor"] or 0), T_ant["valor"]) if T_ant and T_ant.get("valor") else None
    top_uf = ufs[0] if ufs else None
    partes = [f"Entre {ini} e {fim}, o crédito rural somou R$ {br(valor12 / 1e9)} bilhões em {br(qtd12, 0)} contratos"
              + (f" ({'+' if var12 >= 0 else ''}{br(var12)}% sobre os 12 meses anteriores)" if var12 is not None else "") + ".",
              f"Custeio responde por {br(_share(T['custeio'], valor12) or 0, 0)}% do valor e o PRONAF por {br(_share(pronaf12, valor12) or 0, 0)}%;"
              f" {br(_share(controlada12, tot_fonte or 1) or 0, 0)}% vem de fontes com taxa controlada."]
    if top_uf:
        partes.append(f"{top_uf['uf']} concentra {br(top_uf['share'] or 0)}% do valor contratado.")
    sintese = " ".join(partes)

    return {
        "disponivel": True,
        "gerado_em": common.now_utc(),
        "fonte": FONTE,
        "universo": {"serie_nacional": "FonteRecursos (fecha com Faixa ao centavo)", "estadual_e_municipal": "CusteioInvestimentoComercialIndustrialSemFiltros (idem)",
                     "cobertura_regiao_uf_pct": cobertura_regiao_uf},
        "mes_recente": mes_recente, "mes_fechado": mes_fechado,
        "meses_parciais": parciais,
        "janela": {"ini": ini, "fim": fim},
        "janela_anterior": {"ini": jan_ant[0], "fim": jan_ant[-1]} if len(jan_ant) == 12 else None,
        "sintese": sintese,
        "kpis": {
            "valor_12m": _r(valor12), "contratos_12m": qtd12, "ticket_medio": _r(valor12 / qtd12) if qtd12 else None,
            "var_12m_pct": var12, "custeio_share": _share(T["custeio"], valor12), "investimento_share": _share(T["investimento"], valor12),
            "agricola_share": _share(T["agricola"], valor12), "pronaf_share": _share(pronaf12, valor12),
            "controlada_share": _share(controlada12, tot_fonte or 1), "equalizada_share": _share(equalizada12, tot_fonte or 1),
            "mulheres_share_qtd": genero["mulheres_share_qtd"], "mulheres_share_valor": genero["mulheres_share_valor"],
            "cooperativas_share": instituicoes.get("cooperativas_share"),
            "acima_1mi_share_valor": _share(acima_1mi_valor, tv), "ate_20mil_share_qtd": _share(ate_20mil_qtd, tq),
            "municipios_com_contratacao": mun_meta.get("com_contratacao"),
        },
        "serie_mensal": serie,
        "safras": safra_lista,
        "programas": {"janela": {"ini": ini, "fim": fim}, "itens": programas, "por_safra": programas_safra,
                      "nota": "programa é o declarado na cédula; 'Sem programa' agrupa operações fora de programas específicos (a maior parte do custeio empresarial)."},
        "fontes": {"janela": {"ini": ini, "fim": fim}, "itens": fontes, "familias": familias, "por_safra": familias_safra,
                   "nota": ("famílias atribuídas pelo nome da fonte na MDCR; 'controlada' = taxa fixada pelo CMN (recursos "
                            "direcionados), 'equalizada' = Tesouro cobre a diferença entre a taxa do produtor e o custo do funding.")},
        "faixas": {"janela": {"ini": ini, "fim": fim}, "itens": faixas, "nota": "faixa pelo valor da cédula; quantidade de cédulas, não de produtores"},
        "genero": genero,
        "instituicoes": instituicoes,
        "ufs": ufs,
        "produtos": produtos,
        "municipios_meta": mun_meta,
        "rankings": rankings,
        "municipios": municipios,
        "dicionario": {
            "atividade": ATIVIDADE, "sexo": SEXO,
            "finalidade": {"custeio": "despesas do ciclo produtivo (insumos, tratos, colheita)",
                           "investimento": "bens e serviços duráveis (máquinas, benfeitorias, matrizes, correção de solo)",
                           "comercializacao": "estocagem, pré-comercialização e desconto de títulos",
                           "industrializacao": "beneficiamento e industrialização pelo próprio produtor ou cooperativa"},
        },
        "catalogo": [
            {"id": "valor_contratado", "nome": "Valor contratado", "definicao": "soma do valor das cédulas de crédito rural emitidas no mês (fluxo), pela data de emissão",
             "unidade": "R$", "fonte": "MDCR/Sicor", "limitacoes": "contratação, não saldo; não deduz liquidações nem renegociações; meses recentes são parciais"},
            {"id": "contratos", "nome": "Contratos", "definicao": "quantidade de cédulas emitidas", "unidade": "cédulas", "fonte": "MDCR/Sicor",
             "limitacoes": "um produtor pode ter várias cédulas; não é número de produtores"},
            {"id": "ticket", "nome": "Valor médio por contrato", "definicao": "valor contratado ÷ contratos", "unidade": "R$", "fonte": "calculado",
             "limitacoes": "média puxada por poucas cédulas grandes; ver faixas de valor"},
            {"id": "valor_hab", "nome": "Valor por habitante", "definicao": "valor contratado em 12 meses ÷ população residente (Censo 2022)", "unidade": "R$/hab",
             "fonte": "calculado", "limitacoes": "intensidade relativa ao porte do município; não mede produtores atendidos"},
            {"id": "pronaf_share", "nome": "Participação do PRONAF", "definicao": "valor sob o programa PRONAF ÷ valor total", "unidade": "%", "fonte": "calculado",
             "limitacoes": "programa declarado na cédula"},
            {"id": "mulheres_share", "nome": "Participação das mulheres", "definicao": "contratos (ou valor) de pessoas físicas do sexo feminino ÷ total de PF com sexo informado",
             "unidade": "%", "fonte": "calculado", "limitacoes": "universo restrito a PF; PJ e cooperativas fora do denominador"},
            {"id": "area_ha", "nome": "Área financiada (custeio)", "definicao": "área declarada nas cédulas de custeio agrícola", "unidade": "ha", "fonte": "MDCR/Sicor",
             "limitacoes": "só custeio agrícola; pecuária e investimento não declaram área comparável"},
        ],
        "cautelas": [
            "Contratação é fluxo: um mês forte de custeio (plantio) não significa carteira maior; o saldo rural do sistema está no IF.data e no SGS, em outra régua.",
            (f"O recurso RegiaoUF da MDCR cobre {cobertura_regiao_uf}% do universo na janela (fica abaixo em todos os meses medidos); por isso o recorte estadual "
             "desta aba é o municipal agregado pelo código IBGE, que fecha com o universo ao centavo." if cobertura_regiao_uf else
             "O recorte estadual desta aba é o municipal agregado pelo código IBGE, que fecha com o universo (recurso Faixa) ao centavo."),
            f"Os meses {', '.join(parciais)} são parciais (cédulas entram no Sicor com atraso). Ficam fora da janela de 12 meses e de todo ranking.",
            "Programa, fonte e finalidade são os declarados na cédula; reclassificações posteriores não voltam à MDCR.",
            "O recorte por instituição é do CNPJ contratante; cooperativas singulares e bancos do mesmo grupo não são consolidados.",
            "Valor por habitante e valor por hectare são intensidades, não medidas de acesso: não dizem quantos produtores foram atendidos.",
        ],
        "metodo": ("Agregação em Python (stdlib) sobre os recursos OData da MDCR filtrados por ano ou mês de emissão; "
                   "janela de 12 meses fechada no último mês completo; safra = julho a junho; famílias de fonte por padrão "
                   "explícito no nome; sem estimativa, sem interpolação, sem imputação de município ausente."),
    }
