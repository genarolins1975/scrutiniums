"""Publicação da gold do Observatório de Gás Natural.

Uma gold por página (public/gas/gold/<pagina>.json) e um CSV por série
(public/gas/series/<id>.csv). Toda medida publicada traz rótulo, unidade,
natureza (OBSERVADO ou CALCULADO), fontes, período e, quando calculada, a fórmula.
Ausência é null, nunca zero. Nenhum número é digitado: tudo sai do seed.
"""
import csv
import io
import json
import os
from collections import defaultdict
from statistics import median

from pipeline.gas import base, ler, validacoes
from pipeline.gas.fontes import FONTES

O, C = base.OBSERVADO, base.CALCULADO
# Diferença máxima, em fração da produção, entre a produção e a soma das quatro parcelas do destino.
LIMITE_BALANCO = 0.02


def _r(v, casas=3):
    return None if v is None else round(v, casas)


def _mmd(mil_m3, mes):
    """mil m³ no mês para milhões de m³ por dia (média do mês)."""
    return None if mil_m3 is None else mil_m3 / 1000 / base.dias_no_mes(mes)


def _mmd_janela(mil_m3, meses):
    return mil_m3 / 1000 / sum(base.dias_no_mes(m) for m in meses)


def _meses_ate(fim, n):
    a, m = (int(x) for x in fim.split("-"))
    out = []
    for _ in range(n):
        out.append(f"{a:04d}-{m:02d}")
        m -= 1
        if m == 0:
            a, m = a - 1, 12
    return list(reversed(out))


def _mes_menos(mes, n):
    return _meses_ate(mes, n + 1)[0]


def _var_pct(atual, anterior):
    if atual is None or anterior in (None, 0):
        return None
    return (atual / anterior - 1) * 100


def indicador(rotulo, unidade, natureza, fontes, periodo, valor=None, formula=None, nota=None, recorte=None):
    d = {"rotulo": rotulo, "unidade": unidade, "natureza": natureza, "fontes": fontes, "periodo": periodo, "valor": valor}
    if formula:
        d["formula"] = formula
    if nota:
        d["nota"] = nota
    if recorte:
        d["recorte"] = recorte
    return d


class Saida:
    def __init__(self):
        self.manifesto = base.ler_manifesto()
        self.golds = {}
        self.series = {}

    def gerado_em(self, fontes):
        datas = [self.manifesto[f]["capturado_em"] for f in fontes if f in self.manifesto]
        return max(datas) if datas else None

    def gold(self, nome, fontes, conteudo):
        self.golds[nome] = {
            "dominio": base.DOMINIO, "gold": nome, "versao_pipeline": base.VERSAO_PIPELINE,
            "versao_codigo": base.versao_codigo(), "dados_capturados_em": self.gerado_em(fontes),
            "fontes": fontes, **conteudo,
        }

    def serie(self, nome, colunas, linhas, fontes, descricao):
        self.series[nome] = {"colunas": colunas, "linhas": linhas, "fontes": fontes, "descricao": descricao}


# ------------------------------------------------------------------ produção e aproveitamento

def nota_diferenca(serie_dest, limiar=0.1):
    """Frase sobre a diferença do balanço, montada a partir dos próprios meses: desde quando ela passa de `limiar`% da produção."""
    validos = [x for x in serie_dest if x["situacao"] == "ok"]
    desde = None
    for i in range(len(validos)):
        if all(abs(x["diferenca_pct"]) > limiar for x in validos[i:i + 3]) and all(abs(x["diferenca_pct"]) > limiar / 2 for x in validos[i:]):
            desde = validos[i]["mes"]
            break
    base_txt = "A ANP não publica a identidade entre os cinco conjuntos; a conferência é da Scrutiniums."
    if desde is None:
        return f"{base_txt} Fora dos meses marcados como inconsistentes, a diferença fica abaixo de {str(limiar).replace('.', ',')}% da produção."
    return (f"{base_txt} Desde {base.mes_legivel(desde)}, a soma das parcelas difere da produção em mais de {str(limiar).replace('.', ',')}% em quase todos os meses, "
            "sem explicação nos metadados.")


def producao_e_aproveitamento(s):
    bal = ler.balanco_producao()
    parcelas = ("producao", "reinjecao", "queima", "consumo_proprio", "disponivel")
    nac = {p: defaultdict(float) for p in parcelas}
    por_local = defaultdict(float)
    por_uf = {p: defaultdict(float) for p in parcelas}
    for p in parcelas:
        for (mes, uf, local), v in bal[p].items():
            nac[p][mes] += v
            por_uf[p][(mes, uf)] += v
            if p == "producao":
                por_local[(mes, local)] += v
    meses = sorted(nac["producao"])
    ultimo = meses[-1]
    janela = _meses_ate(ultimo, 12)
    janela_ant = _meses_ate(_mes_menos(ultimo, 12), 12)

    serie_prod = []
    for m in meses:
        serie_prod.append({"mes": m, "total": _r(_mmd(nac["producao"][m], m)), "mar": _r(_mmd(por_local[(m, "mar")], m)),
                           "terra": _r(_mmd(por_local[(m, "terra")], m))})
    anual = defaultdict(lambda: defaultdict(float))
    n_meses_ano = defaultdict(int)
    for m in meses:
        anual[m[:4]]["total"] += nac["producao"][m]
        anual[m[:4]]["mar"] += por_local[(m, "mar")]
        n_meses_ano[m[:4]] += 1
    serie_anual = [{"ano": a, "bilhoes_m3": _r(anual[a]["total"] / 1e6), "mar_pct": _r(100 * anual[a]["mar"] / anual[a]["total"], 1)}
                   for a in sorted(anual) if n_meses_ano[a] == 12]

    tot12 = sum(nac["producao"][m] for m in janela)
    tot12_ant = sum(nac["producao"].get(m, 0) for m in janela_ant)
    ufs = sorted({uf for (_, uf) in por_uf["producao"]})
    tabela_uf = []
    for uf in ufs:
        v = sum(por_uf["producao"].get((m, uf), 0) for m in janela)
        if v <= 0:
            continue
        mar = sum(bal["producao"].get((m, uf, "mar"), 0) for m in janela)
        ant = sum(por_uf["producao"].get((m, uf), 0) for m in janela_ant)
        tabela_uf.append({"uf": uf, "codigo": base.UF_CODIGO[uf], "nome": base.UF_NOME[uf], "regiao": base.UF_REGIAO[uf],
                          "mmd_12m": _r(_mmd_janela(v, janela)), "participacao_pct": _r(100 * v / tot12, 2),
                          "mar_pct": _r(100 * mar / v, 1), "variacao_12m_pct": _r(_var_pct(v, ant), 1)})
    tabela_uf.sort(key=lambda x: -x["mmd_12m"])

    # séries por UF (as cinco maiores no período mais recente) para pequenos múltiplos
    top = [x["uf"] for x in tabela_uf[:5]]
    serie_uf = [{"mes": m, **{uf: _r(_mmd(por_uf["producao"].get((m, uf), 0), m)) for uf in top}} for m in meses if m >= "2010-01"]

    fp = ["anp_producao"]
    prod_ultimo = _mmd(nac["producao"][ultimo], ultimo)
    prod_ano_ant = _mmd(nac["producao"].get(_mes_menos(ultimo, 12)), _mes_menos(ultimo, 12))
    indicadores = {
        "producao_mes": indicador("Produção de gás natural", "milhões de m³/dia", C, fp, ultimo, _r(prod_ultimo),
                                  "soma da produção mensal das UFs (mil m³) ÷ dias do mês ÷ 1.000",
                                  "Inclui o gás reinjetado, queimado e consumido nas próprias instalações de produção."),
        "producao_mes_ano_anterior": indicador("Produção no mesmo mês do ano anterior", "milhões de m³/dia", C, fp,
                                               _mes_menos(ultimo, 12), _r(prod_ano_ant), "mesma fórmula, mês de comparação"),
        "producao_variacao_anual": indicador("Variação da produção sobre o mesmo mês do ano anterior", "%", C, fp, ultimo,
                                             _r(_var_pct(prod_ultimo, prod_ano_ant), 1), "(produção do mês ÷ produção do mesmo mês do ano anterior − 1) × 100"),
        "producao_12m": indicador("Produção média dos últimos 12 meses", "milhões de m³/dia", C, fp, f"{janela[0]} a {janela[-1]}",
                                  _r(_mmd_janela(tot12, janela)), "soma dos 12 meses (mil m³) ÷ dias dos 12 meses ÷ 1.000"),
        "mar_pct_12m": indicador("Participação da produção no mar", "% da produção", C, fp, f"{janela[0]} a {janela[-1]}",
                                 _r(100 * sum(por_local[(m, 'mar')] for m in janela) / tot12, 1), "produção em mar ÷ produção total × 100, soma dos 12 meses"),
        "ufs_produtoras": indicador("UFs com produção nos últimos 12 meses", "UFs", C, fp, f"{janela[0]} a {janela[-1]}", len(tabela_uf),
                                    "contagem de UFs com produção positiva na janela"),
    }

    # aproveitamento
    serie_dest = []
    meses_inconsistentes = []
    for m in meses:
        p = nac["producao"][m]
        if m < "2000-01" or p <= 0:
            continue
        linha = {"mes": m}
        soma = 0.0
        for k in ("reinjecao", "queima", "consumo_proprio", "disponivel"):
            v = nac[k].get(m)
            linha[k] = _r(_mmd(v, m)) if v is not None else None
            linha[k + "_pct"] = _r(100 * v / p, 2) if v is not None else None
            soma += v or 0
        linha["producao"] = _r(_mmd(p, m))
        linha["diferenca"] = _r(_mmd(p - soma, m), 4)
        linha["diferenca_pct"] = _r(100 * (p - soma) / p, 3)
        linha["situacao"] = "ok"
        if abs(p - soma) / p > LIMITE_BALANCO:
            # a soma das parcelas não fecha com a produção: o mês sai sem as parcelas, com o motivo publicado
            for k in ("reinjecao", "queima", "consumo_proprio", "disponivel"):
                linha[k] = linha[k + "_pct"] = None
            linha["situacao"] = "inconsistente"
            meses_inconsistentes.append({"mes": m, "diferenca_pct": linha["diferenca_pct"],
                                         "motivo": "a soma de reinjeção, queima, consumo próprio e disponível difere da produção em mais de 2%"})
        serie_dest.append(linha)
    tot = {k: sum(nac[k].get(m, 0) for m in janela) for k in parcelas}
    anual_dest = []
    for a in sorted(anual):
        ms = [m for m in meses if m.startswith(a)]
        if len(ms) < 12 or a < "2000":
            continue
        pa = sum(nac["producao"][m] for m in ms)
        anual_dest.append({"ano": a, **{k + "_pct": _r(100 * sum(nac[k].get(m, 0) for m in ms) / pa, 1)
                                        for k in ("reinjecao", "queima", "consumo_proprio", "disponivel")}})
    reinj_uf = []
    for uf in ufs:
        p = sum(por_uf["producao"].get((m, uf), 0) for m in janela)
        if p <= 0:
            continue
        linha = {"uf": uf, "nome": base.UF_NOME[uf], "producao_mmd_12m": _r(_mmd_janela(p, janela))}
        for k in ("reinjecao", "queima", "consumo_proprio", "disponivel"):
            linha[k + "_pct"] = _r(100 * sum(por_uf[k].get((m, uf), 0) for m in janela) / p, 1)
        reinj_uf.append(linha)
    reinj_uf.sort(key=lambda x: -x["producao_mmd_12m"])
    fa = ["anp_producao", "anp_reinjecao", "anp_queima", "anp_consumo_proprio", "anp_disponivel"]
    per12 = f"{janela[0]} a {janela[-1]}"
    ind_dest = {
        k: indicador(rot, "% da produção", C, fa, per12, _r(100 * tot[k] / tot["producao"], 1),
                     f"soma de {rot.lower()} nos 12 meses ÷ soma da produção nos 12 meses × 100")
        for k, rot in (("reinjecao", "Reinjeção"), ("queima", "Queima e perda"), ("consumo_proprio", "Consumo próprio na produção"),
                       ("disponivel", "Gás disponível"))
    }
    for k, rot in (("reinjecao", "Reinjeção"), ("queima", "Queima e perda"), ("consumo_proprio", "Consumo próprio na produção")):
        ind_dest[k + "_mmd_12m"] = indicador(f"{rot}, média dos últimos 12 meses", "milhões de m³/dia", C, fa, per12,
                                             _r(_mmd_janela(tot[k], janela)), f"soma de {rot.lower()} nos 12 meses ÷ dias ÷ 1.000")
    ind_dest["disponivel_mmd_12m"] = indicador("Gás disponível, média dos últimos 12 meses", "milhões de m³/dia", C, fa, per12,
                                               _r(_mmd_janela(tot["disponivel"], janela)), "soma do disponível nos 12 meses ÷ dias ÷ 1.000")
    ind_dest["diferenca_12m"] = indicador("Diferença entre a produção e a soma das quatro parcelas", "% da produção", C, fa, per12,
                                          _r(100 * (tot["producao"] - sum(tot[k] for k in parcelas[1:])) / tot["producao"], 2),
                                          "(produção − reinjeção − queima − consumo próprio − disponível) ÷ produção × 100",
                                          nota_diferenca(serie_dest))
    s.gold("producao", fp, {
        "ultimo_mes": ultimo, "indicadores": indicadores, "serie": serie_prod[-(12 * 30):], "anual": serie_anual,
        "por_uf": tabela_uf, "ufs_serie": top, "serie_uf": serie_uf,
        "notas": ["O conjunto separa produção em terra e no mar, sem distinguir pré-sal e pós-sal.",
                  "Produção é o volume medido na saída do poço; parte dele é reinjetada, queimada ou consumida na própria produção (ver Aproveitamento)."],
    })
    s.gold("aproveitamento", fa, {
        "ultimo_mes": ultimo, "indicadores": ind_dest, "serie": serie_dest, "anual": anual_dest, "por_uf": reinj_uf,
        "meses_inconsistentes": meses_inconsistentes,
    })
    s.serie("producao-gas-natural-mensal", ["mes", "total", "mar", "terra"], [[x["mes"], x["total"], x["mar"], x["terra"]] for x in serie_prod],
            fp, "Produção de gás natural, Brasil, milhões de m³/dia (média do mês), total, mar e terra")
    s.serie("destino-da-producao-mensal", ["mes", "producao", "reinjecao", "queima", "consumo_proprio", "disponivel", "diferenca"],
            [[x["mes"], x["producao"], x["reinjecao"], x["queima"], x["consumo_proprio"], x["disponivel"], x["diferenca"]] for x in serie_dest],
            fa, "Destino do gás produzido, Brasil, milhões de m³/dia (média do mês)")
    s.serie("producao-por-uf-12m", ["uf", "nome", "mmd_12m", "participacao_pct", "mar_pct", "variacao_12m_pct"],
            [[x["uf"], x["nome"], x["mmd_12m"], x["participacao_pct"], x["mar_pct"], x["variacao_12m_pct"]] for x in tabela_uf],
            fp, f"Produção por UF, média de {per12}, milhões de m³/dia")
    return nac, meses


# ------------------------------------------------------------------ importação

def importacao(s, nac, meses_prod):
    anp = ler.importacao_anp()
    meses = sorted(anp)
    ultimo = meses[-1]
    serie = []
    for m in meses:
        vol, usd = anp[m]
        disp = nac["disponivel"].get(m)
        serie.append({
            "mes": m, "importado": _r(_mmd(vol, m)), "dispendio_musd": _r(usd / 1e6 if usd is not None else None),
            "preco_implicito_usd_mil_m3": _r(usd / vol if vol and usd is not None else None, 1),
            "participacao_pct": _r(100 * vol / (vol + disp), 1) if vol is not None and disp is not None else None,
        })
    janela = _meses_ate(ultimo, 12)
    vol12 = sum(anp[m][0] or 0 for m in janela if m in anp)
    usd12 = sum(anp[m][1] or 0 for m in janela if m in anp)
    disp12 = sum(nac["disponivel"].get(m, 0) for m in janela)
    cobre = all(m in nac["disponivel"] for m in janela)
    per12 = f"{janela[0]} a {janela[-1]}"
    fi = ["anp_importacao"]
    ind = {
        "importado_mes": indicador("Gás natural importado", "milhões de m³/dia", C, fi, ultimo, _r(_mmd(anp[ultimo][0], ultimo)),
                                   "volume importado no mês (mil m³) ÷ dias do mês ÷ 1.000"),
        "importado_12m": indicador("Gás importado, média dos últimos 12 meses", "milhões de m³/dia", C, fi, per12, _r(_mmd_janela(vol12, janela)),
                                   "soma dos 12 meses ÷ dias ÷ 1.000"),
        "dispendio_12m": indicador("Dispêndio com importação nos últimos 12 meses", "US$ milhões", C, fi, per12, _r(usd12 / 1e6, 1),
                                   "soma do dispêndio mensal informado pela ANP"),
        "participacao_12m": indicador("Participação do gás importado na soma com o gás disponível da produção nacional", "%", C,
                                      ["anp_importacao", "anp_disponivel"], per12, _r(100 * vol12 / (vol12 + disp12), 1) if cobre else None,
                                      "importado ÷ (importado + disponível da produção nacional) × 100, soma dos 12 meses",
                                      "Medida de composição da oferta, não de consumo: o gás disponível ainda passa por processamento antes de chegar ao mercado."),
    }
    # comércio exterior por origem
    cx = ler.comex()
    ult_cx = max(m for m, *_ in cx)
    anos = sorted({m[:4] for m, *_ in cx})
    por_ano = defaultdict(lambda: defaultdict(float))
    paises_ano = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0]))
    for m, ncm, pais, kg, fob in cx:
        tipo = "gnl" if ncm == "27111100" else "gasoso"
        por_ano[m[:4]][tipo + "_t"] += kg / 1000
        por_ano[m[:4]][tipo + "_musd"] += fob / 1e6
        paises_ano[m[:4]][pais][0] += kg / 1000
        paises_ano[m[:4]][pais][1] += fob / 1e6
    anual_cx = []
    for a in anos:
        n_meses = len({m for m, *_ in cx if m.startswith(a)})
        d = por_ano[a]
        anual_cx.append({"ano": a, "meses": n_meses, "gasoso_mil_t": _r(d["gasoso_t"] / 1000, 1), "gnl_mil_t": _r(d["gnl_t"] / 1000, 1),
                         "gasoso_musd": _r(d["gasoso_musd"], 1), "gnl_musd": _r(d["gnl_musd"], 1),
                         "paises": len([p for p, v in paises_ano[a].items() if v[0] > 0])})
    jan_cx = _meses_ate(ult_cx, 12)
    origem = defaultdict(lambda: {"gasoso_t": 0.0, "gnl_t": 0.0, "musd": 0.0})
    for m, ncm, pais, kg, fob in cx:
        if m in jan_cx:
            tipo = "gnl_t" if ncm == "27111100" else "gasoso_t"
            origem[pais][tipo] += kg / 1000
            origem[pais]["musd"] += fob / 1e6
    tot_t = sum(v["gasoso_t"] + v["gnl_t"] for v in origem.values())
    tabela_origem = sorted(({"pais": p, "gasoso_mil_t": _r(v["gasoso_t"] / 1000, 1), "gnl_mil_t": _r(v["gnl_t"] / 1000, 1),
                             "musd": _r(v["musd"], 1), "participacao_massa_pct": _r(100 * (v["gasoso_t"] + v["gnl_t"]) / tot_t, 1)}
                            for p, v in origem.items() if v["gasoso_t"] + v["gnl_t"] > 0), key=lambda x: -(x["gasoso_mil_t"] + x["gnl_mil_t"]))
    gnl12 = sum(v["gnl_t"] for v in origem.values())
    ind["gnl_participacao_massa_12m"] = indicador("Participação do GNL na massa importada", "% da massa", C, ["comex_gas"],
                                                  f"{jan_cx[0]} a {jan_cx[-1]}", _r(100 * gnl12 / tot_t, 1),
                                                  "massa líquida de GNL (NCM 2711.11.00) ÷ massa total de gás natural importado × 100",
                                                  "Registro aduaneiro em massa (kg); não é diretamente comparável ao volume em m³ da ANP.")
    ind["paises_origem_12m"] = indicador("Países de origem com importação registrada", "países", C, ["comex_gas"], f"{jan_cx[0]} a {jan_cx[-1]}",
                                         len(tabela_origem), "contagem de países com massa importada positiva")
    s.gold("importacao", ["anp_importacao", "anp_disponivel", "comex_gas"], {
        "ultimo_mes": ultimo, "ultimo_mes_comex": ult_cx, "indicadores": ind, "serie": serie, "comex_anual": anual_cx,
        "origem_12m": tabela_origem, "periodo_origem": f"{jan_cx[0]} a {jan_cx[-1]}",
    })
    s.serie("importacao-gas-natural-mensal", ["mes", "importado_mmd", "dispendio_musd", "preco_implicito_usd_mil_m3", "participacao_pct"],
            [[x["mes"], x["importado"], x["dispendio_musd"], x["preco_implicito_usd_mil_m3"], x["participacao_pct"]] for x in serie],
            ["anp_importacao", "anp_disponivel"], "Importação de gás natural, Brasil: volume (milhões de m³/dia), dispêndio (US$ milhões), preço implícito (US$ por mil m³) e participação na oferta (%)")
    s.serie("importacao-por-origem-12m", ["pais", "gasoso_mil_t", "gnl_mil_t", "musd", "participacao_massa_pct"],
            [[x["pais"], x["gasoso_mil_t"], x["gnl_mil_t"], x["musd"], x["participacao_massa_pct"]] for x in tabela_origem],
            ["comex_gas"], "Importação de gás natural por país de origem, massa (mil t) e valor FOB (US$ milhões), últimos 12 meses do Comex Stat")


# ------------------------------------------------------------------ preços na cadeia

def precos(s):
    vd = ler.vendas_distribuidoras()
    meses = sorted({m for m, *_ in vd})
    ultimo = meses[-1]
    grupos = sorted({(merc, reg) for _, merc, reg, *_ in vd})
    por = {(m, merc, reg): (p, v) for m, merc, reg, p, v in vd}
    serie = []
    for m in meses:
        linha = {"mes": m}
        for merc in ("Não Térmico", "Térmico"):
            regs = [reg for (mm, reg) in grupos if mm == merc]
            pares = [por.get((m, merc, reg)) for reg in regs]
            completos = [x for x in pares if x and x[0] is not None and x[1]]
            chave = "nao_termico" if merc == "Não Térmico" else "termico"
            if len(completos) == len(regs):
                vol = sum(v for _, v in completos)
                linha[chave] = _r(sum(p * v for p, v in completos) / vol, 2)
                linha[chave + "_volume"] = _r(vol / 1000, 3)
            else:
                linha[chave] = None
                linha[chave + "_volume"] = None
        for merc, reg in grupos:
            x = por.get((m, merc, reg))
            linha[f"{'nt' if merc == 'Não Térmico' else 't'}:{reg}"] = x[0] if x else None
        serie.append(linha)
    regioes = [{"id": f"{'nt' if merc == 'Não Térmico' else 't'}:{reg}", "mercado": merc, "regiao": reg} for merc, reg in grupos]

    ptax = ler.ptax()
    ps = ler.pinksheet()
    inter = []
    for m in sorted(ps):
        if m < "2019-09":
            continue
        nt = next((x["nao_termico"] for x in serie if x["mes"] == m), None)
        inter.append({"mes": m, "henry_hub": _r(ps[m]["henry_hub"], 2), "ttf": _r(ps[m]["ttf"], 2), "gnl_japao": _r(ps[m]["gnl_japao"], 2),
                      "brasil_nao_termico_usd": _r(nt / ptax[m], 2) if nt is not None and m in ptax else None,
                      "ptax": ptax.get(m)})
    ult_inter = max((x["mes"] for x in inter if x["brasil_nao_termico_usd"] is not None), default=None)
    u = next(x for x in serie if x["mes"] == ultimo)
    fv = ["anp_vendas_distribuidoras"]
    ind = {
        "nao_termico_mes": indicador("Preço médio do gás vendido a distribuidoras e consumidores livres, mercado não térmico", "R$/MMBtu", C, fv, ultimo,
                                     u["nao_termico"], "média dos preços das regiões agregadas ponderada pelo volume de cada região",
                                     "Preço de venda com impostos, declarado pelos vendedores à ANP. Não é a tarifa paga pelo consumidor final da distribuidora."),
        "termico_mes": indicador("Preço médio do gás vendido para geração termelétrica", "R$/MMBtu", C, fv, ultimo, u["termico"],
                                 "média ponderada pelo volume das regiões agregadas do mercado térmico"),
        "nao_termico_volume_mes": indicador("Volume vendido ao mercado não térmico", "milhões de m³/dia", C, fv, ultimo, u["nao_termico_volume"],
                                            "soma dos volumes das regiões agregadas ÷ 1.000"),
        "termico_volume_mes": indicador("Volume vendido ao mercado térmico", "milhões de m³/dia", C, fv, ultimo, u["termico_volume"],
                                        "soma dos volumes das regiões agregadas ÷ 1.000"),
    }
    if ult_inter:
        ui = next(x for x in inter if x["mes"] == ult_inter)
        ind["brasil_usd_mes"] = indicador("Preço médio não térmico em dólar", "US$/MMBtu", C, fv + ["bcb_ptax"], ult_inter, ui["brasil_nao_termico_usd"],
                                          "preço médio não térmico (R$/MMBtu) ÷ PTAX média de venda do mesmo mês (R$/US$)",
                                          "Inclui impostos; as referências internacionais não incluem.")
        for k, rot in (("henry_hub", "Henry Hub, Estados Unidos"), ("ttf", "TTF, Países Baixos"), ("gnl_japao", "GNL importado pelo Japão")):
            ind[k + "_mes"] = indicador(rot, "US$/MMBtu", O, ["wb_pinksheet"], ult_inter, ui[k])
            if ui[k]:
                ind["razao_" + k] = indicador(f"Preço não térmico brasileiro em dólar dividido pelo {rot}", "vezes", C, fv + ["bcb_ptax", "wb_pinksheet"], ult_inter,
                                              _r(ui["brasil_nao_termico_usd"] / ui[k], 2), f"preço não térmico em US$/MMBtu ÷ {rot} em US$/MMBtu, mesmo mês",
                                              "Compara preço com impostos (Brasil) e sem impostos (referência).")
    vp = ler.vendas_produtores()
    vc = ler.vendas_comercializadores()
    bacias = sorted({b for _, b, *_ in vp})
    serie_prod = []
    for m in sorted({m for m, *_ in vp}):
        linha = {"mes": m}
        for _, b, p, v in (x for x in vp if x[0] == m):
            linha[b] = p
            linha[b + "_volume"] = _r(v / 1000, 3) if v is not None else None
        serie_prod.append(linha)
    serie_com = [{"mes": m, "preco": p, "volume": _r(v / 1000, 3) if v is not None else None} for m, p, v in sorted(vc)]
    s.gold("precos", ["anp_vendas_distribuidoras", "anp_vendas_produtores", "anp_vendas_comercializadores", "wb_pinksheet", "bcb_ptax"], {
        "ultimo_mes": ultimo, "ultimo_mes_internacional": ult_inter, "indicadores": ind, "serie": serie, "regioes": regioes,
        "internacional": inter, "produtores": serie_prod, "bacias": bacias, "comercializadores": serie_com,
        "atualizado_banco_mundial": s.manifesto.get("wb_pinksheet", {}).get("atualizado_na_fonte"),
    })
    s.serie("preco-venda-distribuidoras-mensal", ["mes", "nao_termico", "nao_termico_volume", "termico", "termico_volume"],
            [[x["mes"], x["nao_termico"], x["nao_termico_volume"], x["termico"], x["termico_volume"]] for x in serie], fv,
            "Preço médio (R$/MMBtu, com impostos) e volume (milhões de m³/dia) do gás vendido a distribuidoras e consumidores livres, Brasil, ponderado por região")
    s.serie("precos-internacionais-mensal", ["mes", "henry_hub", "ttf", "gnl_japao", "brasil_nao_termico_usd", "ptax"],
            [[x["mes"], x["henry_hub"], x["ttf"], x["gnl_japao"], x["brasil_nao_termico_usd"], x["ptax"]] for x in inter],
            ["wb_pinksheet", "anp_vendas_distribuidoras", "bcb_ptax"], "Referências internacionais (US$/MMBtu, Banco Mundial) e preço médio não térmico brasileiro convertido pela PTAX média do mês")


# ------------------------------------------------------------------ consumidor: GLP, GNV e IPCA

def _indice_encadeado(mensal, inicio):
    """Número índice (base 100 no mês anterior a `inicio`) encadeando variações mensais em %."""
    out = {}
    nivel = 100.0
    for m in sorted(mensal):
        if m < inicio:
            continue
        nivel *= 1 + mensal[m] / 100
        out[m] = nivel
    return out


def consumidor(s):
    est = ler.precos_estados()
    br = ler.precos_brasil()
    ip = ler.ipca()
    geral = ip[("geral", "mensal")]
    ult_ipca = max(geral)
    out = {}
    for produto, nome in (("GLP", "glp"), ("GNV", "gnv")):
        serie_br = sorted((x for x in br if x["produto"] == produto), key=lambda x: x["mes"])
        ultimo = serie_br[-1]["mes"]
        # preço em reais do último mês com IPCA (índice geral)
        base_real = min(ultimo, ult_ipca)
        idx = _indice_encadeado(geral, "2013-01")
        def real(v, m):
            if v is None or m not in idx or base_real not in idx:
                return None
            return v * idx[base_real] / idx[m]
        serie = [{"mes": x["mes"], "medio": x["medio"], "minimo": x["minimo"], "maximo": x["maximo"], "postos": x["postos"],
                  "medio_real": _r(real(x["medio"], x["mes"]), 2)} for x in serie_br]
        ufs_ult = [x for x in est if x["produto"] == produto and x["mes"] == ultimo]
        ant = {x["uf"]: x for x in est if x["produto"] == produto and x["mes"] == _mes_menos(ultimo, 12)}
        tabela = sorted(({"uf": x["uf"], "codigo": base.UF_CODIGO[x["uf"]], "nome": base.UF_NOME[x["uf"]], "regiao": base.UF_REGIAO[x["uf"]],
                          "medio": x["medio"], "minimo": x["minimo"], "maximo": x["maximo"], "postos": x["postos"],
                          "medio_ano_anterior": ant.get(x["uf"], {}).get("medio"),
                          "variacao_12m_pct": _r(_var_pct(x["medio"], ant.get(x["uf"], {}).get("medio")), 1)}
                         for x in ufs_ult if x["medio"] is not None), key=lambda x: -x["medio"])
        serie_uf = defaultdict(dict)
        for x in est:
            if x["produto"] == produto and x["mes"] >= "2019-01":
                serie_uf[x["mes"]][x["uf"]] = x["medio"]
        u = serie[-1]
        a12 = next((x for x in serie if x["mes"] == _mes_menos(ultimo, 12)), None)
        unidade = "R$ por botijão de 13 kg" if produto == "GLP" else "R$/m³"
        fp = ["anp_precos_brasil"]
        ind = {
            "medio_mes": indicador("Preço médio de revenda" + (" do GLP em botijão de 13 kg" if produto == "GLP" else " do GNV"), unidade, O, fp, ultimo, u["medio"],
                                   nota="Média da ANP sobre a amostra de revendas pesquisadas no mês."),
            "minimo_mes": indicador("Menor preço encontrado na pesquisa do mês", unidade, O, fp, ultimo, u["minimo"]),
            "maximo_mes": indicador("Maior preço encontrado na pesquisa do mês", unidade, O, fp, ultimo, u["maximo"]),
            "postos_mes": indicador("Revendas pesquisadas no mês", "revendas", O, fp, ultimo, u["postos"]),
            "variacao_12m": indicador("Variação do preço médio em 12 meses", "%", C, fp, f"{_mes_menos(ultimo, 12)} a {ultimo}",
                                      _r(_var_pct(u["medio"], a12["medio"] if a12 else None), 1), "(preço médio do mês ÷ preço médio 12 meses antes − 1) × 100"),
            "ufs_mes": indicador("UFs com preço pesquisado no mês", "UFs", C, ["anp_precos_estados"], ultimo, len(tabela), "contagem de UFs com preço médio publicado"),
        }
        if tabela:
            ind["uf_maior"] = indicador("UF com o maior preço médio", unidade, O, ["anp_precos_estados"], ultimo, tabela[0]["medio"], recorte=tabela[0]["nome"])
            ind["uf_menor"] = indicador("UF com o menor preço médio", unidade, O, ["anp_precos_estados"], ultimo, tabela[-1]["medio"], recorte=tabela[-1]["nome"])
        out[nome] = {"ultimo_mes": ultimo, "mes_base_real": base_real, "indicadores": ind, "serie": serie, "por_uf": tabela,
                     "serie_uf": [{"mes": m, **v} for m, v in sorted(serie_uf.items())]}
    # IPCA dos três subitens e do índice geral
    ipca_serie = []
    meses_ip = sorted(set().union(*(set(ip[(k, "12m")]) for k in ("geral", "botijao", "encanado", "veicular"))))
    for m in meses_ip:
        ipca_serie.append({"mes": m, **{k: ip[(k, "12m")].get(m) for k in ("geral", "botijao", "encanado", "veicular")}})
    indices = {k: _indice_encadeado(ip[(k, "mensal")], "2012-01") for k in ("geral", "botijao", "encanado", "veicular")}
    indice_serie = [{"mes": m, **{k: _r(indices[k].get(m), 2) for k in indices}} for m in sorted(indices["geral"])]
    fi = ["ibge_ipca"]
    ind_ipca = {k: indicador(rot, "% em 12 meses", O, fi, ult_ipca, ip[(k, "12m")].get(ult_ipca))
                for k, rot in (("geral", "IPCA, índice geral"), ("botijao", "IPCA, gás de botijão"), ("encanado", "IPCA, gás encanado"),
                               ("veicular", "IPCA, gás veicular"))}
    for k in ("geral", "botijao", "encanado", "veicular"):
        ind_ipca[k + "_acumulado"] = indicador(f"Variação acumulada desde janeiro de 2012 ({k})", "%", C, fi, f"2012-01 a {ult_ipca}",
                                               _r(indices[k][ult_ipca] - 100, 1), "produto de (1 + variação mensal ÷ 100) desde janeiro de 2012, menos 1, × 100")
    # vendas de GLP por vasilhame
    vas = ler.glp_vasilhame()
    meses_v = sorted({m for m, _, _ in vas})
    ult_v = meses_v[-1]
    jan_v = _meses_ate(ult_v, 12)
    serie_v = [{"mes": m, "ate_p13": _r(sum(v for (mm, _, t), v in vas.items() if mm == m and t == "ate_p13") / 1000, 3),
                "outros": _r(sum(v for (mm, _, t), v in vas.items() if mm == m and t == "outros") / 1000, 3)} for m in meses_v]
    tot_p13 = sum(v for (m, _, t), v in vas.items() if m in jan_v and t == "ate_p13")
    tot_all = sum(v for (m, _, _), v in vas.items() if m in jan_v)
    uf_v = sorted(({"uf": uf, "nome": base.UF_NOME[uf], "ate_p13_mil_m3_12m": _r(sum(vas.get((m, uf, "ate_p13"), 0) for m in jan_v) / 1000, 1),
                    "p13_pct": _r(100 * sum(vas.get((m, uf, "ate_p13"), 0) for m in jan_v) / max(1e-9, sum(vas.get((m, uf, t), 0) for m in jan_v for t in ("ate_p13", "outros"))), 1)}
                   for uf in sorted({uf for _, uf, _ in vas})), key=lambda x: -x["ate_p13_mil_m3_12m"])
    out["glp"]["vendas"] = {"ultimo_mes": ult_v, "serie": serie_v, "por_uf": uf_v, "indicadores": {
        "p13_12m": indicador("Vendas de GLP em vasilhames de até 13 kg, últimos 12 meses", "mil m³", C, ["anp_glp_vasilhame"], f"{jan_v[0]} a {jan_v[-1]}",
                             _r(tot_p13 / 1000, 1), "soma das vendas mensais das UFs ÷ 1.000"),
        "p13_pct_12m": indicador("Participação dos vasilhames de até 13 kg nas vendas de GLP", "% do volume", C, ["anp_glp_vasilhame"],
                                 f"{jan_v[0]} a {jan_v[-1]}", _r(100 * tot_p13 / tot_all, 1), "vendas até P13 ÷ vendas totais de GLP × 100"),
    }}
    s.gold("gas-de-cozinha", ["anp_precos_brasil", "anp_precos_estados", "anp_glp_vasilhame", "ibge_ipca"], {
        **out["glp"], "ipca": {"ultimo_mes": ult_ipca, "indicadores": ind_ipca, "doze_meses": ipca_serie, "indice": indice_serie},
    })
    s.gold("gnv-e-gas-encanado", ["anp_precos_brasil", "anp_precos_estados", "ibge_ipca"], {
        **out["gnv"], "ipca": {"ultimo_mes": ult_ipca, "indicadores": ind_ipca, "doze_meses": ipca_serie, "indice": indice_serie},
    })
    for nome, rot in (("glp", "GLP em botijão de 13 kg (R$/13 kg)"), ("gnv", "GNV (R$/m³)")):
        d = out[nome]
        s.serie(f"preco-{nome}-brasil-mensal", ["mes", "medio", "minimo", "maximo", "postos", "medio_real"],
                [[x["mes"], x["medio"], x["minimo"], x["maximo"], x["postos"], x["medio_real"]] for x in d["serie"]], ["anp_precos_brasil", "ibge_ipca"],
                f"Preço de revenda do {rot}, Brasil, média, mínimo e máximo da pesquisa, revendas pesquisadas e média em reais de {base.mes_legivel(d['mes_base_real'])} (IPCA)")
        s.serie(f"preco-{nome}-por-uf", ["uf", "nome", "medio", "minimo", "maximo", "postos", "medio_ano_anterior", "variacao_12m_pct"],
                [[x["uf"], x["nome"], x["medio"], x["minimo"], x["maximo"], x["postos"], x["medio_ano_anterior"], x["variacao_12m_pct"]] for x in d["por_uf"]],
                ["anp_precos_estados"], f"Preço de revenda do {rot} por UF em {base.mes_legivel(d['ultimo_mes'])}")
    s.serie("ipca-gas-12-meses", ["mes", "geral", "botijao", "encanado", "veicular"],
            [[x["mes"], x["geral"], x["botijao"], x["encanado"], x["veicular"]] for x in ipca_serie], fi,
            "IPCA em 12 meses (%): índice geral, gás de botijão, gás encanado e gás veicular")


# ------------------------------------------------------------------ mercado e transporte

def mercado_e_infraestrutura(s):
    mov = ler.movimentacao()
    meses = sorted({x["mes"] for x in mov})
    transp = sorted({x["transportadora"] for x in mov})
    entrega = defaultdict(float)
    for x in mov:
        if x["tipo_ponto"] == "Ponto de Entrega":
            entrega[(x["mes"], x["transportadora"])] += x["volume"]
    flags = validacoes.cobertura_movimentacao(meses, transp, entrega)
    sigla = {t: (t.rsplit(" - ", 1)[-1].strip() if " - " in t else t) for t in transp}
    # nome para leitura: "Nova Transportadora do Sudeste S.A. - NTS" vira "Nova Transportadora do Sudeste S.A. (NTS)"
    nome_legivel = {t: (f"{t.rsplit(' - ', 1)[0].strip()} ({sigla[t]})" if " - " in t else t) for t in transp}
    serie_t = []
    for m in meses:
        linha = {"mes": m, "cobertura": "completa" if not flags.get(m) else "incompleta"}
        for t in transp:
            v = entrega.get((m, t), 0.0)
            problema = (m, t) in flags.get("_pares", set())
            linha[sigla[t]] = None if problema else _r(_mmd(v, m), 3)
        serie_t.append(linha)
    carregadores = []
    for m in meses:
        ativos = {x["carregador_codigo"] for x in mov if x["mes"] == m and x["volume"] > 0 and x["carregador_codigo"]}
        por_t = {sigla[t]: len({x["carregador_codigo"] for x in mov if x["mes"] == m and x["transportadora"] == t and x["volume"] > 0 and x["carregador_codigo"]})
                 for t in transp}
        completa = not flags.get(m)
        carregadores.append({"mes": m, "ativos": len(ativos) if completa else None, "ativos_registrados": len(ativos),
                             **{f"n:{k}": v for k, v in por_t.items()}, "cobertura": "completa" if completa else "incompleta"})
    validos = [x for x in carregadores if x["ativos"] is not None]
    ult = validos[-1]
    primeiro = validos[0]
    fm = ["anp_movimentacao"]
    ind = {
        "carregadores_mes": indicador("Carregadores com gás movimentado na malha de transporte", "carregadores", C, fm, ult["mes"], ult["ativos"],
                                      "contagem de códigos de carregador distintos com volume realizado positivo em pontos de recebimento ou entrega no mês",
                                      "Conta quem movimentou gás, não quem está autorizado. Meses com cobertura incompleta da fonte ficam sem valor."),
        "carregadores_inicio": indicador("Carregadores com gás movimentado no primeiro mês da série", "carregadores", C, fm, primeiro["mes"], primeiro["ativos"],
                                         "mesma contagem"),
        "meses_incompletos": indicador("Meses com cobertura incompleta na fonte", "meses", C, fm, f"{meses[0]} a {meses[-1]}",
                                       len([m for m in meses if flags.get(m)]), "meses em que uma transportadora com mediana de ao menos 5% do total entregue aparece sem volume, abaixo de um décimo ou acima de dez vezes a mediana da própria série"),
    }
    # autorizações
    aut = ler.autorizacoes()
    def grupo(tipo):
        t = tipo.lower()
        if "gnl" in t or "regaseif" in t or "liquef" in t:
            return "GNL"
        if "compress" in t:
            return "Compressão"
        if "ponto de entrega" in t.split(";")[0] or t.startswith("ponto de"):
            return "Pontos de entrega e recebimento"
        if "gasoduto" in t or "ramal" in t:
            return "Gasodutos"
        return "Outras instalações"
    por_ano = defaultdict(lambda: defaultdict(int))
    for a in aut:
        ano = (a.get("DataDaOutorga") or "")[:4]
        if ano.isdigit():
            por_ano[ano][grupo(a["TipoDeInstalacao"])] += 1
    grupos_aut = ["Gasodutos", "Pontos de entrega e recebimento", "Compressão", "GNL", "Outras instalações"]
    serie_aut = [{"ano": a, **{g: por_ano[a].get(g, 0) for g in grupos_aut}} for a in sorted(por_ano)]
    terminais = {}
    for a in aut:
        t = a["TipoDeInstalacao"].lower()
        if ("terminal" in t and "gnl" in t) or ("regaseif" in t and "terminal" in (a.get("NomeDaInstalacao") or "").lower()):
            if not a["TipoDaAutorizacao"].startswith("Operação"):
                continue
            nome = (a.get("NomeDaInstalacao") or "").strip()
            chave = nome[:40].lower()
            reg = {"empresa": a["Empresa"].strip(), "instalacao": nome, "ato": f"{a['TipoDoAto']} {a['NumeroDoAto']}".strip(),
                   "tipo": a["TipoDaAutorizacao"], "data": (a.get("DataDaOutorga") or "")[:10], "capacidade_informada": (a.get("Capacidade") or "").strip() or None}
            if chave not in terminais or reg["data"] > terminais[chave]["data"]:
                terminais[chave] = reg
    tabela_terminais = sorted(terminais.values(), key=lambda x: x["data"], reverse=True)
    datas_aut = sorted(a["DataDaOutorga"][:10] for a in aut if a.get("DataDaOutorga"))
    ind_inf = {
        "atos_total": indicador("Atos de autorização no registro da ANP", "atos", O, ["anp_autorizacoes"], f"{datas_aut[0][:4]} a {datas_aut[-1][:4]}", len(aut)),
        "atos_ultimo": indicador("Data do ato mais recente no registro", "data", O, ["anp_autorizacoes"], datas_aut[-1], datas_aut[-1]),
    }
    vc = ler.vendas_comercializadores()
    vp = ler.vendas_produtores()
    serie_sec = []
    for m in sorted({x[0] for x in vp} | {x[0] for x in vc}):
        com = next((x for x in vc if x[0] == m), None)
        prods = [x for x in vp if x[0] == m]
        vol_p = sum(x[3] for x in prods if x[3] is not None) if prods else None
        serie_sec.append({"mes": m, "comercializadores": _r(com[2] / 1000, 3) if com and com[2] is not None else None,
                          "produtores": _r(vol_p / 1000, 3) if vol_p is not None else None})
    us = serie_sec[-1]
    ind["vendas_comercializadores_mes"] = indicador("Volume vendido entre comercializadores de gás processado", "milhões de m³/dia", C,
                                                    ["anp_vendas_comercializadores"], us["mes"], us["comercializadores"], "volume informado (mil m³/dia) ÷ 1.000",
                                                    "Vendas na saída de processamento, terminais de GNL ou pontos do transporte, exceto a distribuidoras e consumidores livres.")
    ind["vendas_produtores_mes"] = indicador("Volume vendido entre produtores e comercializadores de gás não processado", "milhões de m³/dia", C,
                                             ["anp_vendas_produtores"], us["mes"], us["produtores"], "soma dos volumes das três bacias agregadas (mil m³/dia) ÷ 1.000")
    s.gold("mercado", ["anp_movimentacao", "anp_vendas_comercializadores", "anp_vendas_produtores"], {
        "ultimo_mes": ult["mes"], "indicadores": ind, "carregadores": carregadores, "transportadoras": [sigla[t] for t in transp],
        "secundario": serie_sec,
        "transportadoras_nome": {sigla[t]: nome_legivel[t] for t in transp},
    })
    s.gold("infraestrutura", ["anp_movimentacao", "anp_autorizacoes"], {
        "ultimo_mes": meses[-1], "indicadores": ind_inf, "entregas": serie_t, "transportadoras": [sigla[t] for t in transp],
        "transportadoras_nome": {sigla[t]: nome_legivel[t] for t in transp}, "quebras": validacoes.quebras_de_patamar(meses, transp, entrega, sigla),
        "autorizacoes_por_ano": serie_aut, "grupos_autorizacao": grupos_aut, "terminais_gnl": tabela_terminais,
        "meses_incompletos": [{"mes": m, "motivo": flags[m]} for m in meses if flags.get(m)],
    })
    s.serie("carregadores-ativos-mensal", ["mes", "ativos", "ativos_registrados", "cobertura"] + [f"n:{sigla[t]}" for t in transp],
            [[x["mes"], x["ativos"], x["ativos_registrados"], x["cobertura"]] + [x[f"n:{sigla[t]}"] for t in transp] for x in carregadores], fm,
            "Carregadores com gás movimentado na malha de transporte, no total e por transportadora; total sem valor nos meses de cobertura incompleta")
    s.serie("entregas-por-transportadora-mensal", ["mes", "cobertura"] + [sigla[t] for t in transp],
            [[x["mes"], x["cobertura"]] + [x[sigla[t]] for t in transp] for x in serie_t], fm,
            "Volume entregue por transportadora, milhões de m³/dia; sem valor onde a validação aponta cobertura incompleta")


# ------------------------------------------------------------------ meta e escrita

def meta(s):
    fontes = []
    for fid, f in FONTES.items():
        m = s.manifesto.get(fid, {})
        fontes.append({"id": fid, "orgao": f["orgao"], "conjunto": f["conjunto"], "pagina": f["pagina"], "url": m.get("url") or f["url"],
                       "licenca": f["licenca"], "frequencia": f["frequencia"], "unidade": f["unidade"], "nota": f.get("nota"),
                       "recorte": f.get("recorte"), "capturado_em": m.get("capturado_em"), "sha256_original": m.get("sha256_original"),
                       "bytes_original": m.get("bytes_original"), "seed": f["seed"],
                       "arquivos_origem": len(m.get("arquivos_origem", [])) or None})
    ultimos = {nome: g.get("ultimo_mes") for nome, g in s.golds.items()}
    s.golds["meta"] = {"dominio": base.DOMINIO, "gold": "meta", "versao_pipeline": base.VERSAO_PIPELINE, "versao_codigo": base.versao_codigo(),
                       "dados_capturados_em": s.gerado_em(list(FONTES)), "fontes": fontes, "ultimos_meses": ultimos,
                       "series": [{"id": k, "arquivo": f"/gas/series/{k}.csv", "descricao": v["descricao"], "fontes": v["fontes"], "linhas": len(v["linhas"])}
                                  for k, v in sorted(s.series.items())]}


def escrever(s):
    os.makedirs(base.GOLD, exist_ok=True)
    os.makedirs(base.SERIES, exist_ok=True)
    for nome, g in s.golds.items():
        with open(os.path.join(base.GOLD, f"{nome}.json"), "w", encoding="utf-8") as f:
            json.dump(g, f, ensure_ascii=False, separators=(",", ":"), sort_keys=False)
            f.write("\n")
    for nome, sr in s.series.items():
        buf = io.StringIO()
        w = csv.writer(buf, delimiter=";", lineterminator="\n")
        w.writerow(sr["colunas"])
        for l in sr["linhas"]:
            w.writerow(["" if v is None else (str(v).replace(".", ",") if isinstance(v, float) else v) for v in l])
        with open(os.path.join(base.SERIES, f"{nome}.csv"), "w", encoding="utf-8") as f:
            f.write(buf.getvalue())


def construir():
    s = Saida()
    nac, meses = producao_e_aproveitamento(s)
    importacao(s, nac, meses)
    precos(s)
    consumidor(s)
    mercado_e_infraestrutura(s)
    meta(s)
    validacoes.conferir(s)
    escrever(s)
    return s
