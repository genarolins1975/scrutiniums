"""Gold de geração verificada por fonte (ONS, Balanço de Energia nos Subsistemas).

Regras publicadas:
- geração diária por fonte (CALCULADO): média das 24 horas verificadas, em MWmed;
- participação: geração da fonte ÷ soma de hidráulica, térmica, eólica e solar
  verificadas (o balanço não inclui a micro e minigeração distribuída);
- "hidráulica, eólica e solar" não é chamada de participação renovável: a térmica do
  balanço agrega fontes que o conjunto não separa (inclusive biomassa);
- despacho térmico em contexto: participação térmica dos últimos 7 dias comparada à
  distribuição das participações térmicas em janelas móveis de 7 dias nos 365 dias
  anteriores (percentil e mediana).
"""
import os
import sys
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

DS = "balanco_energia_subsistema_ho"
FONTES = ("hidraulica", "termica", "eolica", "solar")
NOME_FONTE = {"hidraulica": "Hidráulica", "termica": "Térmica", "eolica": "Eólica", "solar": "Solar"}
REGIOES = ("SIN",) + c.ORDEM_SM
REGRAS = {
    "diaria": "Geração diária por fonte = média das 24 horas verificadas (MWmed). Dias sem as 24 horas não entram.",
    "participacao": "Participação = geração da fonte ÷ soma da geração verificada hidráulica, térmica, eólica e solar. A micro e minigeração distribuída não faz parte do balanço.",
    "hes": "Hidráulica, eólica e solar somadas. Não é chamada de participação renovável porque a térmica do balanço agrega fontes que o conjunto não separa, inclusive biomassa.",
    "termica_contexto": "Participação térmica dos últimos 7 dias comparada às participações térmicas de todas as janelas móveis de 7 dias dos 365 dias anteriores: percentil e mediana.",
}


def construir(con):
    horario = {(f, rg): base.serie_vigente(con, DS, f"{f}.{rg}") for f in FONTES for rg in REGIOES}
    if not all(horario[(f, "SIN")] for f in FONTES):
        return c.stub("geracao.json", "balanço de energia ausente no silver")
    snap = c.snapshot_de(con, DS)
    diario = {k: c.agrega_diario(v) for k, v in horario.items()}
    dias = sorted(set.intersection(*(set(diario[(f, "SIN")]) for f in FONTES)))
    dia_ref = dias[-1]
    fim = c.d(dia_ref)

    def janela(n, fim_=None):
        f = fim_ or fim
        return [(f - timedelta(days=i)).isoformat() for i in range(n)]

    def mix(rg, ks):
        if not all(all(k in diario[(f, rg)] for f in FONTES) for k in ks):
            return None
        mw = {f: c.media([diario[(f, rg)][k] for k in ks]) for f in FONTES}
        tot = sum(mw.values())
        return {
            "inicio": min(ks), "fim": max(ks),
            "mwmed": {f: c.r(mw[f], 0) for f in FONTES},
            "total_mwmed": c.r(tot, 0),
            "participacao": {f: c.r(100 * mw[f] / tot, 1) for f in FONTES},
            "hes": c.r(100 * (mw["hidraulica"] + mw["eolica"] + mw["solar"]) / tot, 1),
        }

    janelas = {"dia": [dia_ref], "7d": janela(7), "30d": janela(30), "12m": janela(365)}
    regioes = []
    for rg in REGIOES:
        regioes.append({"rg": rg, "nome": c.NOME_SUBMERCADO[rg],
                        **{j: mix(rg, ks) for j, ks in janelas.items()}})

    # mesmas janelas nos anos anteriores (SIN)
    comparacao_anual = []
    for a in range(int(dia_ref[:4]) - 1, 2020, -1):
        try:
            fa = fim.replace(year=a)
        except ValueError:
            fa = fim.replace(year=a, day=28)
        m7, m30 = mix("SIN", janela(7, fa)), mix("SIN", janela(30, fa))
        if m7 or m30:
            comparacao_anual.append({"ano": a, "7d": m7, "30d": m30})

    # participação térmica em janelas móveis de 7 dias nos 365 dias anteriores
    # sem arredondar antes da estatística: percentil e quantis sobre o valor bruto
    def part_termica_7d(fim_):
        ks = janela(7, fim_)
        if not all(all(k in diario[(f, "SIN")] for f in FONTES) for k in ks):
            return None
        mw = {f: c.media([diario[(f, "SIN")][k] for k in ks]) for f in FONTES}
        return 100 * mw["termica"] / sum(mw.values())
    hist = [part_termica_7d(fim - timedelta(days=i)) for i in range(7, 372)]
    hist = [x for x in hist if x is not None]
    atual_term = part_termica_7d(fim)
    termica_ctx = {
        "participacao_7d": c.r(atual_term, 1),
        "mediana_365d": c.r(c.quantil(hist, 0.5), 1),
        "p10_365d": c.r(c.quantil(hist, 0.1), 1), "p90_365d": c.r(c.quantil(hist, 0.9), 1),
        "percentil": c.r(c.percentil_de(atual_term, hist), 1), "n_janelas": len(hist),
    }
    # série da própria participação de 7 dias (o que o painel descreve), último ano
    serie_termica_7d = []
    for i in range(371, -1, -1):
        f_ = fim - timedelta(days=i)
        v = part_termica_7d(f_)
        if v is not None:
            serie_termica_7d.append({"d": f_.isoformat(), "termica_7d": c.r(v, 2)})

    perfil = []
    horas_ref = {f: {ref: v for ref, v in horario[(f, "SIN")] if ref[:10] == dia_ref} for f in FONTES}
    for h in sorted(horas_ref["hidraulica"]):
        perfil.append({"h": h[11:16], **{f: c.r(horas_ref[f].get(h), 0) for f in FONTES}})

    serie = [{"d": k, **{f: c.r(diario[(f, "SIN")][k], 0) for f in FONTES}} for k in dias]
    base.escreve_csv("geracao_diaria.csv", ["data"] + [f"{f}_{rg}" for rg in REGIOES for f in FONTES],
                     [[k] + [diario[(f, rg)].get(k) for rg in REGIOES for f in FONTES] for k in dias])
    meta = c.meta_ons(DS)
    lim = [
        "A térmica do balanço agrega todas as usinas térmicas despachadas pelo ONS; o conjunto não separa combustível (gás, carvão, óleo, nuclear, biomassa). A separação exige o conjunto Geração por Usina, catalogado e ainda não integrado.",
        "A micro e minigeração distribuída não está na geração verificada do balanço.",
        "Dados em processo de consistência recorrente do ONS, sujeitos a revisão.",
    ]
    prov = c.proveniencia(
        indicador="Geração verificada por fonte", natureza="CALCULADO",
        fonte=c.fonte_ons("balanco-energia-subsistema", DS, "Balanço de Energia nos Subsistemas"),
        unidade="MWmed e % da geração verificada", frequencia="horária, agregada por dia",
        periodo={"inicio": dias[0], "fim": dia_ref}, cobertura={"inicio": dias[0], "fim": dia_ref},
        capturado_em=c.ultima_captura(snap), snapshot=snap,
        publicado_em=max((x["publicado_em"] or "" for x in snap["capturas"]), default=None) or None,
        transformacoes=["média diária das 24 horas por fonte", "participação sobre a soma das quatro fontes"],
        formula="participação(f) = G(f) ÷ [G(hidráulica) + G(térmica) + G(eólica) + G(solar)] × 100",
        limitacoes=lim, download="/energia/series/geracao_diaria.csv", notas_fonte=meta.get("notas"),
    )
    prov_termica = c.proveniencia(
        indicador="Participação térmica em janelas móveis de 7 dias (SIN)", natureza="CALCULADO",
        fonte=c.fonte_ons("balanco-energia-subsistema", DS, "Balanço de Energia nos Subsistemas"),
        unidade="% da geração verificada", frequencia="diária (janela móvel de 7 dias)",
        periodo={"inicio": serie_termica_7d[0]["d"] if serie_termica_7d else dia_ref, "fim": dia_ref},
        cobertura={"inicio": dias[0], "fim": dia_ref}, capturado_em=c.ultima_captura(snap), snapshot=snap,
        transformacoes=["média de 7 dias da geração diária por fonte", "participação térmica sobre a soma das quatro fontes",
                        "percentil e quantis sobre as janelas terminadas de 7 a 371 dias antes do dia de referência"],
        formula="térmica_7d(t) = Σ G_térmica(d) ÷ Σ [G_hidráulica + G_térmica + G_eólica + G_solar](d) × 100, d ∈ (t − 6, …, t)",
        limitacoes=lim, download="/energia/series/geracao_diaria.csv",
    )
    return {
        **c.cabecalho("geracao.json"),
        "dia_referencia": dia_ref, "fontes": [{"id": f, "nome": NOME_FONTE[f]} for f in FONTES],
        "regras": REGRAS, "regioes": regioes, "comparacao_anual": comparacao_anual,
        "termica_contexto": termica_ctx, "serie_termica_7d": serie_termica_7d,
        "perfil_horario_sin": perfil, "serie_sin": serie,
        "proveniencia": {"geracao": prov, "termica_7d": prov_termica}, "fonte_notas": meta.get("notas"),
        "downloads": [{"rotulo": "Geração diária por fonte e subsistema (CSV)", "url": "/energia/series/geracao_diaria.csv"}],
    }
