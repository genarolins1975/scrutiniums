"""Gold de carga (ONS, Carga de Energia Diária).

Regras publicadas:
- carga do SIN (CALCULADO): soma das cargas dos quatro subsistemas no dia;
- comparação anual: média dos últimos 7 (ou 30) dias contra os mesmos dias do ano
  anterior, SÓ quando os dois períodos estão no mesmo regime metodológico do ONS;
- regimes metodológicos (declarados pelo ONS): até 28/02/2021; de 01/03/2021 a
  28/04/2023 (inclui previsão de usinas não despachadas); desde 29/04/2023 (inclui
  estimativa da micro e minigeração distribuída, MMGD).

Validação física com quarentena (antes de publicar): a captura de 29/09/2026 02:42 UTC
trouxe a carga do Nordeste de 26/09/2026 igual a −668,879 MWmed, e o SIN daquele dia
teria saído com 63.185 MWmed; a captura seguinte (30/09/2026 02:19 UTC) trouxe 13.984,7.
Nada no pipeline impedia a publicação do valor negativo. Agora cada valor diário passa
por três regras antes de entrar na série publicada:

- F1, domínio: o dicionário do ONS (Carga de Energia Diária, v1.2) diz que
  `val_cargaenergiamwmed` não admite nulo, zero nem negativo. Violação = quarentena,
  sempre (não há conferência que torne válido um valor fora do domínio);
- F2, faixa plausível: entre 50% do menor e 150% do maior valor aceito do mesmo
  subsistema nos 1.095 dias anteriores (só com pelo menos 365 dias de histórico);
- F3, salto: desvio maior que 40% da mediana dos 7 dias anteriores aceitos (só com pelo
  menos 5 dias).

Valor atípico não é descartado sem conferência: um valor que viola F2 ou F3 é conferido
contra a média das 24 horas do mesmo dia na Curva de Carga Horária do ONS (outro
arquivo, que o módulo Carga guarda na família `ons_carga`). Se a curva confirma o valor
(diferença até 0,5% ou 5 MWmed), ele é publicado como "atípico conferido", com
ressalva; se não confirma ou a curva não tem o dia, fica em quarentena: fora da série
publicada (ausência, nunca zero nem valor anterior), com o registro visível na gold.
Os limites foram calibrados no histórico inteiro (2000 a 2026): só quatro dias violam F2
ou F3, e os quatro são confirmados pela curva horária (NE em 25/08/2018 e o Sul de 6 a
8/01/2015, depois do feriado de fim de ano).
"""
import os
import statistics
import sys
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

DS = "carga_energia_di"
DS_CURVA = "ons_curva_carga_ho"
FAMILIA_CURVA = "ons_carga"
SMS = c.ORDEM_SM
REGIMES = [
    {"inicio": "2000-01-01", "fim": "2021-02-28",
     "descricao": "Carga atendida por usinas despachadas ou programadas pelo ONS."},
    {"inicio": "2021-03-01", "fim": "2023-04-28",
     "descricao": "Inclui a previsão de geração de usinas não despachadas pelo ONS."},
    {"inicio": "2023-04-29", "fim": None,
     "descricao": "Inclui também a estimativa da micro e minigeração distribuída (MMGD), com base em dados meteorológicos previstos."},
]
REGRAS = {
    "carga_sin": "Carga do SIN = soma das cargas diárias dos quatro subsistemas.",
    "comparacao_anual": "Média dos últimos 7 ou 30 dias contra os mesmos dias do ano anterior, apenas quando os dois períodos estão no mesmo regime metodológico declarado pelo ONS.",
    "extremo_12m": "Maior carga diária dos últimos 365 dias.",
    "validacao_fisica": "Valor diário só é publicado se for positivo (domínio do dicionário do ONS), estiver na faixa plausível do subsistema e não saltar mais de 40% sobre a mediana da semana anterior; atípico é conferido na curva horária antes de ser publicado ou posto em quarentena.",
}

# Limites documentados (ver docstring). Mudar um deles exige recalibrar no histórico.
FAIXA_JANELA_DIAS = 1095
FAIXA_MIN_HISTORICO = 365
FAIXA_FATOR_MIN = 0.5
FAIXA_FATOR_MAX = 1.5
SALTO_JANELA = 7
SALTO_MIN_DIAS = 5
SALTO_LIMITE = 0.40
CONFERENCIA_REL = 0.005
CONFERENCIA_ABS = 5.0
REGRAS_VALIDACAO = [
    {"id": "F1", "tipo": "dominio", "critica": True,
     "descricao": "Carga diária precisa ser positiva: o dicionário de dados do ONS (Carga de Energia Diária, versão 1.2) não admite valor nulo, zero nem negativo em val_cargaenergiamwmed."},
    {"id": "F2", "tipo": "faixa_plausivel", "critica": False,
     "descricao": "Entre 50% do menor e 150% do maior valor aceito do mesmo subsistema nos 1.095 dias anteriores (exige 365 dias de histórico)."},
    {"id": "F3", "tipo": "salto", "critica": False,
     "descricao": "Desvio de até 40% em relação à mediana dos 7 dias anteriores aceitos do mesmo subsistema (exige 5 dias)."},
    {"id": "C1", "tipo": "conferencia", "critica": False,
     "descricao": "Valor que viola F2 ou F3 é conferido na média das 24 horas do mesmo dia da Curva de Carga Horária do ONS: diferença de até 0,5% ou 5 MWmed confirma o valor (publicado com ressalva); sem confirmação, quarentena."},
]


def regime_de(dia):
    for i, rg in enumerate(REGIMES):
        if rg["inicio"] <= dia and (rg["fim"] is None or dia <= rg["fim"]):
            return i
    return None


def _curva_diaria(con_curva, sm):
    if con_curva is None:
        return {}
    try:
        return dict(base.serie_vigente(con_curva, DS_CURVA, f"media_dia.{sm}"))
    except Exception:  # família ainda sem a tabela ou sem o dataset: sem conferência
        return {}


def valida_serie(sm, serie, curva=None):
    """Aplica F1, F2, F3 e a conferência C1 a uma série {dia: valor} de um subsistema.

    Retorna (aceitos {dia: valor}, ocorrencias [...]). A referência de F2 e F3 usa só
    valores já aceitos e anteriores ao dia (nada do futuro)."""
    curva = curva or {}
    aceitos, ocorrencias = {}, []
    hist = []  # (dia, valor) aceitos, em ordem
    for dia in sorted(serie):
        v = serie[dia]
        violadas = []
        if v is None or v <= 0:
            violadas.append("F1")
        else:
            d0 = c.d(dia)
            lim = (d0 - timedelta(days=FAIXA_JANELA_DIAS)).isoformat()
            ref = [x for k, x in hist[-(FAIXA_JANELA_DIAS + 5):] if k >= lim]
            if len(ref) >= FAIXA_MIN_HISTORICO and not (FAIXA_FATOR_MIN * min(ref) <= v <= FAIXA_FATOR_MAX * max(ref)):
                violadas.append("F2")
            prev = [x for _, x in hist[-SALTO_JANELA:]]
            if len(prev) >= SALTO_MIN_DIAS:
                med = statistics.median(prev)
                if med > 0 and abs(v / med - 1) > SALTO_LIMITE:
                    violadas.append("F3")
        if not violadas:
            aceitos[dia] = v
            hist.append((dia, v))
            continue
        cv = curva.get(dia)
        confirma = (cv is not None and v is not None and v > 0
                    and abs(cv - v) <= max(CONFERENCIA_REL * abs(v), CONFERENCIA_ABS))
        situacao = "quarentena" if "F1" in violadas or not confirma else "atipico_conferido"
        ocorrencias.append({"sm": sm, "dia": dia, "valor": v, "regras": violadas, "situacao": situacao,
                            "curva_horaria_media": c.r(cv, 3) if cv is not None else None,
                            "conferencia": ("sem curva horária para o dia" if cv is None else
                                            ("curva confirma o valor" if confirma else "curva não confirma o valor"))})
        if situacao == "atipico_conferido":
            aceitos[dia] = v
            hist.append((dia, v))
    return aceitos, ocorrencias


def historico_violacoes(con):
    """Valores fora do domínio (≤ 0) em QUALQUER vintage do silver, com a revisão
    posterior da fonte quando houve: é o registro de que o ONS publicou e corrigiu."""
    rows = con.execute(
        """SELECT o.serie, o.ref, o.valor, v.capturado_em, v.vintage_id, v.recurso FROM observacoes o
           JOIN vintages v ON v.vintage_id = o.vintage_id
           WHERE o.dataset=? AND o.valor <= 0 ORDER BY o.ref, o.serie""", (DS,)).fetchall()
    out = []
    for serie, ref, valor, cap, vid, rec in rows:
        depois = con.execute(
            """SELECT o.valor, v.capturado_em FROM observacoes o JOIN vintages v ON v.vintage_id = o.vintage_id
               WHERE o.dataset=? AND o.serie=? AND o.ref=? AND v.capturado_em > ? ORDER BY v.capturado_em LIMIT 1""",
            (DS, serie, ref, cap)).fetchone()
        out.append({"sm": serie.split(".")[-1], "dia": ref, "valor": valor, "capturado_em": cap, "vintage": vid,
                    "recurso": rec, "revisado_para": depois[0] if depois else None,
                    "revisado_em": depois[1] if depois else None,
                    "situacao": "revisado_pela_fonte" if depois and depois[0] > 0 else "vigente_em_quarentena"})
    return out


def validacao_fisica(con, con_curva=None):
    """Séries aceitas por subsistema e o registro publicado da validação."""
    brutas = {sm: dict(base.serie_vigente(con, DS, f"carga_mwmed.{sm}")) for sm in SMS}
    aceitos, ocorrencias = {}, []
    for sm in SMS:
        a, o = valida_serie(sm, brutas[sm], _curva_diaria(con_curva, sm))
        aceitos[sm] = a
        ocorrencias += o
    return {
        "aceitos": aceitos, "brutas": brutas,
        "registro": {
            "regras": REGRAS_VALIDACAO,
            "quarentena": [o for o in ocorrencias if o["situacao"] == "quarentena"],
            "atipicos_conferidos": [o for o in ocorrencias if o["situacao"] == "atipico_conferido"],
            "historico_fora_do_dominio": historico_violacoes(con),
            "valores_verificados": sum(len(s) for s in brutas.values()),
        },
    }


def _br(v, casas):
    """Número no formato brasileiro (milhar com ponto, decimal com vírgula, menos tipográfico)."""
    txt = f"{abs(v):,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("\u2212" if v < 0 else "") + txt


def _texto_ocorrencia(h):
    txt = (f"A captura de {c.carimbo_br(h['capturado_em'])} trouxe a carga do {c.NOME_SUBMERCADO[h['sm']]} de {c.data_br(h['dia'])} "
           f"igual a {_br(h['valor'], 3)} MWmed, fora do domínio do dicionário do ONS; o valor não entra na publicação")
    if h["revisado_para"] is not None:
        txt += f", e a fonte o revisou para {_br(h['revisado_para'], 1)} MWmed na captura de {c.carimbo_br(h['revisado_em'])}."
    else:
        txt += " e segue em quarentena."
    return txt


def construir(con):
    con_curva = None
    try:
        caminho = os.path.join(base.SILVER, f"{FAMILIA_CURVA}.db")
        if os.path.exists(caminho):
            con_curva = base.conecta_familia(FAMILIA_CURVA)
        val = validacao_fisica(con, con_curva)
    finally:
        if con_curva is not None:
            con_curva.close()
    carga = val["aceitos"]
    if not all(carga.values()):
        return c.stub("carga.json", "carga ausente no silver para algum subsistema")
    snap = c.snapshot_de(con, DS)
    todos_dias = sorted(set.union(*(set(s) for s in carga.values())))
    dias_sin = [k for k in todos_dias if all(k in carga[sm] for sm in SMS)]
    carga["SIN"] = {k: sum(carga[sm][k] for sm in SMS) for k in dias_sin}
    dia_ref = dias_sin[-1]
    fim = c.d(dia_ref)
    todos = SMS + ("SIN",)

    def janela(n, ano_desloc=0):
        ks = []
        for i in range(n):
            x = fim - timedelta(days=i)
            if ano_desloc:
                try:
                    x = x.replace(year=x.year - ano_desloc)
                except ValueError:
                    return None
            ks.append(x.isoformat())
        return ks

    def comparacao(sm, n):
        atual, ant = janela(n), janela(n, 1)
        if ant is None or not all(k in carga[sm] for k in atual + ant):
            return None
        mesmo = regime_de(min(ant)) == regime_de(max(atual)) and regime_de(min(atual)) == regime_de(max(ant))
        ma, mb = c.media([carga[sm][k] for k in atual]), c.media([carga[sm][k] for k in ant])
        return {
            "media": c.r(ma, 0), "media_ano_anterior": c.r(mb, 0),
            "variacao_pct": c.r(100 * (ma / mb - 1), 1) if mesmo and mb else None,
            "mesmo_regime": mesmo,
            "inicio": min(atual), "fim": max(atual), "inicio_anterior": min(ant), "fim_anterior": max(ant),
        }

    subs = []
    for sm in todos:
        ult365 = [(k, carga[sm][k]) for k in janela(365) if k in carga[sm]]
        kmax, vmax = max(ult365, key=lambda x: x[1])
        subs.append({
            "sm": sm, "nome": c.NOME_SUBMERCADO[sm],
            "natureza": "CALCULADO" if sm == "SIN" else "OBSERVADO",
            "dia": c.r(carga[sm][dia_ref], 0),
            "ult7": comparacao(sm, 7),
            "ult30": comparacao(sm, 30),
            "max_12m": {"valor": c.r(vmax, 0), "dia": kmax},
        })
    ini = (fim - timedelta(days=3 * 365)).isoformat()
    # dia em quarentena num subsistema: o subsistema fica vazio e o SIN também (ausência)
    serie = [{"d": k, **{sm: c.r(carga[sm].get(k), 0) for sm in todos}} for k in todos_dias if ini <= k <= dia_ref]
    mensal = {}
    for k in todos_dias:
        if k <= dia_ref:
            mensal.setdefault(k[:7], []).append(k)
    serie_mensal = [{"m": m, "dias": sum(1 for k in ks if k in carga["SIN"]),
                     **{sm: c.r(c.media([carga[sm][k] for k in ks if k in carga[sm]]), 0) for sm in todos}}
                    for m, ks in sorted(mensal.items())]
    base.escreve_csv("carga_diaria.csv", ["data", "SE", "S", "NE", "N", "SIN_calculado"],
                     [[k] + [carga[sm].get(k) for sm in todos] for k in todos_dias])
    meta = c.meta_ons(DS)
    reg = val["registro"]
    lim = [
        "O ONS mudou o conteúdo da série em 01/03/2021 e em 29/04/2023 (inclusão da estimativa de MMGD); comparações que atravessam essas datas não são homogêneas e não são exibidas como variação.",
        "Dados em processo de consistência recorrente do ONS, sujeitos a revisão após a publicação.",
    ]
    ressalvas = [_texto_ocorrencia(h) for h in reg["historico_fora_do_dominio"]]
    for q in reg["quarentena"]:
        ressalvas.append(f"Em quarentena: carga do {c.NOME_SUBMERCADO[q['sm']]} em {c.data_br(q['dia'])} ({_br(q['valor'], 3)} MWmed), regras "
                         f"{', '.join(q['regras'])}; {q['conferencia']}. O dia fica sem valor para o subsistema e para o SIN.")
    if reg["atipicos_conferidos"]:
        ressalvas.append(f"{len(reg['atipicos_conferidos'])} valores atípicos (regras F2 ou F3) foram publicados porque a curva horária do ONS "
                         "confirma o mesmo valor: " + "; ".join(f"{a['sm']} em {c.data_br(a['dia'])}" for a in reg["atipicos_conferidos"]) + ".")
    prov = c.proveniencia(
        indicador="Carga de energia diária por subsistema", natureza="OBSERVADO",
        fonte=c.fonte_ons("carga-energia", DS, "Carga de Energia Diária"),
        unidade="MWmed", frequencia="diária", periodo={"inicio": todos_dias[0], "fim": dia_ref},
        cobertura={"inicio": todos_dias[0], "fim": dia_ref}, capturado_em=c.ultima_captura(snap), snapshot=snap,
        publicado_em=max((x["publicado_em"] or "" for x in snap["capturas"]), default=None) or None,
        transformacoes=["validação física antes da publicação (domínio, faixa plausível, salto) com conferência na curva horária e quarentena"],
        limitacoes=lim + ressalvas, download="/energia/series/carga_diaria.csv", notas_fonte=meta.get("notas"),
    )
    prov_sin = c.proveniencia(
        indicador="Carga do SIN e variação anual", natureza="CALCULADO",
        fonte=c.fonte_ons("carga-energia", DS, "Carga de Energia Diária"),
        unidade="MWmed e %", frequencia="diária", periodo={"inicio": todos_dias[0], "fim": dia_ref},
        cobertura={"inicio": todos_dias[0], "fim": dia_ref}, capturado_em=c.ultima_captura(snap), snapshot=snap,
        transformacoes=["soma dos quatro subsistemas (só em dia com os quatro aceitos pela validação física)",
                        "médias móveis de 7 e 30 dias", "comparação com os mesmos dias do ano anterior"],
        formula="variação = média(últimos n dias) ÷ média(mesmos n dias do ano anterior) − 1",
        limitacoes=lim + ressalvas + ["Temperatura, dias úteis e feriados afetam a carga e não são ajustados aqui; comparações com os mesmos dias da semana e a decomposição por clima e calendário estão em carga_detalhe.json."],
    )
    prov_mensal = c.proveniencia(
        indicador="Carga média mensal do SIN e dos subsistemas", natureza="CALCULADO",
        fonte=c.fonte_ons("carga-energia", DS, "Carga de Energia Diária"),
        unidade="MWmed", frequencia="mensal", periodo={"inicio": todos_dias[0][:7], "fim": dia_ref[:7]},
        cobertura={"inicio": todos_dias[0], "fim": dia_ref}, capturado_em=c.ultima_captura(snap), snapshot=snap,
        transformacoes=["média aritmética dos valores diários aceitos do mês", "SIN: soma dos quatro subsistemas em cada dia"],
        formula="carga_mensal(s, m) = média de carga(s, d) para os dias d do mês m com dado aceito; o mês corrente é parcial",
        limitacoes=lim + ressalvas + ["Médias de meses em regimes metodológicos diferentes não são comparáveis diretamente."],
    )
    return {
        **c.cabecalho("carga.json"),
        "dia_referencia": dia_ref, "unidade": "MWmed",
        "regras": REGRAS, "regimes": REGIMES,
        "subsistemas": subs, "serie": serie, "mensal": serie_mensal,
        "validacao": {k: v for k, v in reg.items()},
        "proveniencia": {"carga": prov, "sin": prov_sin, "mensal": prov_mensal},
        "fonte_notas": meta.get("notas"),
        "downloads": [{"rotulo": "Carga diária por subsistema e SIN (CSV)", "url": "/energia/series/carga_diaria.csv"}],
    }
