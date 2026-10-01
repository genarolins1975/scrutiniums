"""ONS, Carga de Energia Verificada por área de carga: prova do vínculo UF → submercado.

Por que existe: o mapa territorial precisa dizer a que submercado pertence um
município, e não há tabela oficial "município → submercado". O que o ONS publica é a
carga por ÁREA DE CARGA (API apicarga.ons.org.br), com a lista oficial de áreas no
dicionário de dados do conjunto "Carga de Energia Verificada" (versão de 30/10/2023):

    Submercado: SECO (Sudeste/C. Oeste), N (Norte), NE (Nordeste), S (Sul)
    Área Geoelétrica: BASE (Bahia/Sergipe), MA (Maranhão), DF (Distrito Federal),
      GO (Goiás), MS (Mato Grosso do Sul), AM (Amazonas), AP (Amapá), RR (Roraima),
      PI (Piauí), TON (Tocantins Norte), AC (Acre), RS (Rio Grande do Sul), SP (São
      Paulo), MT (Mato Grosso), TOCO (Tocantins), BAOE (Bahia Oeste), PBRN (Paraíba/Rio
      Grande do Norte), PR (Paraná), ES (Espírito Santo), MG (Minas Gerais), SC (Santa
      Catarina), CE (Ceará), RO (Rondônia), PA (Pará), RJ (Rio de Janeiro), ALPE
      (Alagoas/Pernambuco)
    Perdas: PEN (Perdas Norte), PES (Perdas Sul), PENE (Perdas Nordeste), PESE
      (Perdas Sudeste)

O dicionário diz a que UF cada área geoelétrica corresponde (pelo nome), mas não diz a
que submercado ela pertence. Essa pertença é PROVADA pelo fechamento: a carga média do
dia do submercado deve ser igual à soma das áreas geoelétricas que o compõem mais a área
de perdas do mesmo submercado. A hipótese a conferir vem do mapeamento publicado pelos
módulos Água e Carga (golds agua_detalhe.json e carga_detalhe.json); este arquivo não
fixa o resultado, só a lista oficial de áreas e a regra de conferência.

Por que a soma prova a pertença: a carga de cada meia hora do submercado deve ser igual à
soma das áreas da hipótese naquela meia hora. Mover uma área para outro submercado, ou
trocar duas áreas de submercados diferentes, desloca o resíduo pela carga (ou pela
diferença de carga) dessas áreas em CADA meia hora; como as áreas têm perfis diários
diferentes, mesmo duas áreas de carga média parecida (Acre e Roraima, por exemplo)
produzem um resíduo que varia ao longo do dia. A prova é feita meia hora a meia hora:
a hipótese fecha quando a mediana do resíduo absoluto de cada submercado fica dentro da
tolerância, e uma área fica provada quando, além disso, nenhuma alternativa que a envolva
(movê-la para outro submercado ou trocá-la com uma área de outro submercado) também
fecha. A mediana resiste a uma meia hora isolada em consistência (vista no Sudeste em
13/09/2026, 161 MWmed numa única meia hora). Área com carga zero nos dias conferidos (hoje,
TOCO) não pode ser provada pela soma e fica declarada como indeterminada.
"""
import json
import math

URL_API = "https://apicarga.ons.org.br/prd/cargaverificada?dat_inicio={d}&dat_fim={d}&cod_areacarga={a}"
URL_DATASET = "https://dados.ons.org.br/dataset/carga-energia-verificada"
URL_DICIONARIO = "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/carga_verificada_tm/DicionarioDados_Carga_Verificada.pdf"
DICIONARIO_VERSAO = "30-10-2023"
# sha256 do dicionário em PDF lido em 01/10/2026 (conferência manual, registrada no documento do módulo)
DICIONARIO_SHA256 = "9912f603b7f442d221fdc4009527a3959f6df28a745f486f0f824e5875c3fe12"

# Submercados como o dicionário os codifica, e o código usado no resto do observatório
SUBMERCADOS_API = {"SECO": "SE", "S": "S", "NE": "NE", "N": "N"}
NOME_SUBMERCADO = {"SE": "Sudeste/Centro-Oeste", "S": "Sul", "NE": "Nordeste", "N": "Norte"}

# Áreas geoelétricas do dicionário: código → (nome no dicionário, UFs que o nome designa)
AREAS_GEOELETRICAS = {
    "BASE": ("Bahia/Sergipe", ("BA", "SE")), "MA": ("Maranhão", ("MA",)), "DF": ("Distrito Federal", ("DF",)),
    "GO": ("Goiás", ("GO",)), "MS": ("Mato Grosso do Sul", ("MS",)), "AM": ("Amazonas", ("AM",)),
    "AP": ("Amapá", ("AP",)), "RR": ("Roraima", ("RR",)), "PI": ("Piauí", ("PI",)),
    "TON": ("Tocantins Norte", ("TO",)), "AC": ("Acre", ("AC",)), "RS": ("Rio Grande do Sul", ("RS",)),
    "SP": ("São Paulo", ("SP",)), "MT": ("Mato Grosso", ("MT",)), "TOCO": ("Tocantins", ("TO",)),
    "BAOE": ("Bahia Oeste", ("BA",)), "PBRN": ("Paraíba/Rio Grande do Norte", ("PB", "RN")),
    "PR": ("Paraná", ("PR",)), "ES": ("Espírito Santo", ("ES",)), "MG": ("Minas Gerais", ("MG",)),
    "SC": ("Santa Catarina", ("SC",)), "CE": ("Ceará", ("CE",)), "RO": ("Rondônia", ("RO",)),
    "PA": ("Pará", ("PA",)), "RJ": ("Rio de Janeiro", ("RJ",)), "ALPE": ("Alagoas/Pernambuco", ("AL", "PE")),
}
# Áreas de perdas: o próprio nome no dicionário diz o submercado
AREAS_PERDAS = {"PEN": ("Perdas Norte", "N"), "PES": ("Perdas Sul", "S"), "PENE": ("Perdas Nordeste", "NE"),
                "PESE": ("Perdas Sudeste", "SE")}
TODAS_AS_AREAS = tuple(sorted(set(SUBMERCADOS_API) | set(AREAS_GEOELETRICAS) | set(AREAS_PERDAS)))
UFS = ("AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI",
       "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO")

# Tolerância da prova (mediana do resíduo absoluto por meia hora, MWmed). Fixada pelos
# dados conferidos em 13 e 16/09/2026: com a hipótese, a maior mediana foi 7,9 MWmed (no
# Nordeste, um desvio quase constante ao longo do dia; o módulo Água viu 7,8 MWmed em
# 10/08/2026); a menor alternativa possível (troca de Acre e Roraima) deu 28,8 MWmed. A
# gold publica, para cada dia, o ruído da hipótese e o menor sinal das alternativas: se um
# dia futuro tiver alternativa abaixo da tolerância, as áreas envolvidas ficam ambíguas.
TOLERANCIA_MWMED = 15.0
MIN_MEIAS_HORAS = 40     # meias horas comuns às áreas do submercado para o dia valer
INTERVALOS_DIA = 48


def serie_do_dia(texto):
    """{instante UTC: carga global em MWmed} de uma resposta da API para um dia. Valor
    nulo ou não finito fica fora (ausência não vira zero)."""
    dados = json.loads(texto)
    if not isinstance(dados, list):
        raise ValueError("resposta da API não é lista")
    out = {}
    for x in dados:
        v = x.get("val_cargaglobal")
        t = x.get("din_referenciautc")
        if v is None or not t:
            continue
        v = float(v)
        if math.isfinite(v):
            out[t] = v
    return out


def media_do_dia(texto):
    """(média das meias horas em MWmed, meias horas com valor); (None, 0) sem valor."""
    s = serie_do_dia(texto)
    if not s:
        return None, 0
    return sum(s.values()) / len(s), len(s)


def areas_por_submercado(uf_subsistema):
    """Hipótese a conferir: {sm: [áreas geoelétricas]} a partir de um mapeamento UF →
    subsistema publicado. Área com UFs de subsistemas diferentes fica em 'conflito'
    (não deveria acontecer; se acontecer, a conferência reprova)."""
    out = {sm: [] for sm in NOME_SUBMERCADO}
    conflitos = []
    for area, (_, ufs) in sorted(AREAS_GEOELETRICAS.items()):
        sms = {uf_subsistema.get(uf) for uf in ufs}
        if len(sms) != 1 or None in sms:
            conflitos.append(area)
            continue
        out[sms.pop()].append(area)
    return out, conflitos


def _perdas_de(sm):
    return next(a for a, (_, s) in AREAS_PERDAS.items() if s == sm)


def _api_de(sm):
    return next(a for a, s in SUBMERCADOS_API.items() if s == sm)


def _residuos(series, sm, areas):
    """Resíduo por meia hora (Σ áreas + perdas − submercado) nas meias horas comuns."""
    membros = list(areas) + [_perdas_de(sm)]
    alvo = series[_api_de(sm)]
    comuns = set(alvo)
    for a in membros:
        comuns &= set(series[a])
    return {t: sum(series[a][t] for a in membros) - alvo[t] for t in sorted(comuns)}


def _estatistica(res):
    vals = sorted(abs(v) for v in res.values())
    if not vals:
        return None
    n = len(vals)
    return vals[n // 2] if n % 2 else (vals[n // 2 - 1] + vals[n // 2]) / 2


def confere_fechamento(series, hipotese, tolerancia=TOLERANCIA_MWMED):
    """Conferência de um dia. `series` = {área: {instante: MWmed}} das 34 áreas; `hipotese`
    = {sm: [áreas geoelétricas]}. Devolve, por submercado, o resíduo (mediana absoluta,
    média e máximo absoluto por meia hora) e, por área, o veredito: provada,
    indeterminada (carga zero), ambigua (uma alternativa também fecha) ou reprovada."""
    faltam = [a for a in TODAS_AS_AREAS if not series.get(a)]
    if faltam:
        return {"completo": False, "faltam": faltam}
    medias = {a: sum(v.values()) / len(v) for a, v in series.items() if v}
    res = {}
    for sm, lst in hipotese.items():
        r = _residuos(series, sm, lst)
        res[sm] = {"meias_horas": len(r), "mediana_abs_mwmed": _estatistica(r),
                   "media_mwmed": sum(r.values()) / len(r) if r else None,
                   "max_abs_mwmed": max((abs(v) for v in r.values()), default=None),
                   "submercado_mwmed": medias[_api_de(sm)],
                   "soma_areas_mwmed": sum(medias[a] for a in lst) + medias[_perdas_de(sm)],
                   "areas": list(lst), "area_perdas": _perdas_de(sm)}
    if any(x["meias_horas"] < MIN_MEIAS_HORAS for x in res.values()):
        return {"completo": False, "faltam": [], "submercados": res,
                "motivo": f"menos de {MIN_MEIAS_HORAS} meias horas comuns num submercado"}
    for x in res.values():
        x["residuo_mwmed"] = x["soma_areas_mwmed"] - x["submercado_mwmed"]
    fecha = all(x["mediana_abs_mwmed"] <= tolerancia for x in res.values())

    # alternativas: mover uma área com carga ou trocar duas de submercados diferentes
    positivas = [a for sm, lst in hipotese.items() for a in lst if medias[a] > 0]
    sm_de = {a: sm for sm, lst in hipotese.items() for a in lst}
    alternativas = []

    def fecha_com(nova):
        piores = []
        for sm in {s for s in nova if nova[s] != hipotese[s]}:
            est = _estatistica(_residuos(series, sm, nova[sm]))
            piores.append(est if est is not None else float("inf"))
        return max(piores) if piores else 0.0

    for a in positivas:
        for outro in NOME_SUBMERCADO:
            if outro == sm_de[a]:
                continue
            nova = {k: list(v) for k, v in hipotese.items()}
            nova[sm_de[a]].remove(a)
            nova[outro].append(a)
            alternativas.append((fecha_com(nova), (a,), f"{a} no {outro}"))
    for i, a in enumerate(positivas):
        for b in positivas[i + 1:]:
            if sm_de[a] == sm_de[b]:
                continue
            nova = {k: list(v) for k, v in hipotese.items()}
            nova[sm_de[a]].remove(a)
            nova[sm_de[b]].remove(b)
            nova[sm_de[a]].append(b)
            nova[sm_de[b]].append(a)
            alternativas.append((fecha_com(nova), (a, b), f"troca {a} e {b}"))
    alternativas.sort(key=lambda x: x[0])
    ambiguas = {a for est, envolvidas, _ in alternativas if est <= tolerancia for a in envolvidas}
    areas = {}
    for sm, lst in hipotese.items():
        for a in lst:
            if medias[a] <= 0:
                areas[a] = {"submercado": sm, "veredito": "indeterminada", "carga_mwmed": medias[a],
                            "motivo": "carga zero no dia: a soma não distingue o submercado"}
            elif not fecha:
                areas[a] = {"submercado": sm, "veredito": "reprovada", "carga_mwmed": medias[a]}
            elif a in ambiguas:
                areas[a] = {"submercado": sm, "veredito": "ambigua", "carga_mwmed": medias[a]}
            else:
                areas[a] = {"submercado": sm, "veredito": "provada", "carga_mwmed": medias[a]}
    menor = alternativas[0] if alternativas else None
    return {"completo": True, "tolerancia_mwmed": tolerancia, "fecha": fecha, "submercados": res, "areas": areas,
            "ruido_mwmed": max(x["mediana_abs_mwmed"] for x in res.values()),
            "menor_alternativa": {"descricao": menor[2], "mediana_abs_mwmed": menor[0]} if menor else None,
            "alternativas_avaliadas": len(alternativas), "medias_mwmed": medias}


def uf_para_submercado(conferencias, hipotese):
    """{uf: {subsistema, estado, areas}} a partir das conferências dos dias. Estados:
    - 'provado': todas as áreas da UF com carga provadas no mesmo submercado em todos os
      dias completos, e nenhuma área indeterminada;
    - 'provado_com_area_sem_carga': como acima, mas a UF também tem área sem carga nos
      dias conferidos (o submercado dessa área não é provado pela soma);
    - 'nao_provado': área reprovada ou ambígua, ou nenhum dia completo."""
    area_sm = {a: sm for sm, lst in hipotese.items() for a in lst}
    completos = [c for c in conferencias if c.get("completo")]
    out = {}
    for uf in UFS:
        areas = [a for a, (_, ufs) in AREAS_GEOELETRICAS.items() if uf in ufs]
        vereditos = {}
        for a in areas:
            vs = [c["areas"].get(a, {}).get("veredito") for c in completos]
            if not vs or any(v in ("reprovada", "ambigua", None) for v in vs):
                vereditos[a] = next((v for v in vs if v in ("reprovada", "ambigua")), "reprovada")
            elif all(v == "indeterminada" for v in vs):
                vereditos[a] = "indeterminada"
            else:
                # carga positiva num dia e zero no outro: vale a prova do dia com carga
                vereditos[a] = "provada"
        provadas = [a for a in areas if vereditos[a] == "provada"]
        sms = {area_sm.get(a) for a in provadas}
        if not completos or any(v in ("reprovada", "ambigua") for v in vereditos.values()) or len(sms) != 1:
            estado, sm = "nao_provado", None
        elif any(v == "indeterminada" for v in vereditos.values()):
            estado, sm = "provado_com_area_sem_carga", sms.pop()
        else:
            estado, sm = "provado", sms.pop()
        out[uf] = {"subsistema": sm, "estado": estado,
                   "areas": [{"codigo": a, "nome": AREAS_GEOELETRICAS[a][0], "veredito": vereditos[a],
                              "submercado_hipotese": area_sm.get(a)} for a in areas]}
    return out
