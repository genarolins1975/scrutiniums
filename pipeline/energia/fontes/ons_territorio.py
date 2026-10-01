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
que submercado ela pertence. A camada oficial da EPE "Unidades da federação e Subsistemas
do SIN" (WebMap EPE, camada 24, fontes/epe_territorio.py) diz o subsistema de cada UF; a
soma da carga verificada é a reconciliação independente dessa pertença, área por área. A
hipótese a conferir vem da camada da EPE (ou, sem ela, do mapeamento publicado pelos
módulos Água e Carga); este arquivo não fixa o resultado, só a lista oficial de áreas e a
regra de conferência.

Por que a soma prova a pertença: a carga de cada meia hora do submercado deve ser igual à
soma das áreas geoelétricas da hipótese mais a área de perdas do mesmo submercado naquela
meia hora. Mover uma área para outro submercado, ou trocar duas áreas de submercados
diferentes, desloca o resíduo pela carga (ou pela diferença de carga) dessas áreas. A
hipótese fecha quando a mediana do resíduo absoluto de cada submercado fica dentro da
tolerância, e uma área fica provada quando, além disso, nenhuma alternativa que a envolva
(movê-la para outro submercado ou trocá-la com uma área de outro submercado) também fecha.

Por que a mediana por meia hora e não o resíduo das médias do dia: com as médias do dia,
duas áreas de carga média quase igual no mesmo dia trocam de submercado sem deixar
resíduo. Em 16/09/2026, Rondônia (753,7 MWmed) e Tocantins Norte (745,9 MWmed) trocadas
deixam −7,9 MWmed no Sudeste e 6,9 MWmed no Norte, e Rio Grande do Sul (4.296,0) e
Bahia/Sergipe (4.292,9) trocadas deixam 11,0 MWmed no Nordeste: as duas trocas caberiam na
tolerância e as quatro áreas ficariam ambíguas naquele dia. Meia hora a meia hora, os
perfis diários diferentes deixam medianas de 230,7 e 368,1 MWmed. A troca de Acre e
Roraima, a menor alternativa por meia hora (28,8 e 38,7 MWmed), é reprovada pelas duas
estatísticas (34,1 a 37,8 MWmed nas médias do dia). A mediana também resiste a uma meia
hora ainda em consistência no ONS, que desloca a média do dia inteiro (Sudeste em
13/09/2026: 161 MWmed numa meia hora; resíduo das médias do dia de −3,26 MWmed contra
mediana de 0,19 MWmed). As duas estatísticas são publicadas para a hipótese e para cada
alternativa. Área com carga zero nos dias conferidos (hoje, TOCO) não pode ser provada pela
soma e fica declarada como indeterminada.
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
# 10/08/2026); a menor alternativa possível (troca de Acre e Roraima) deu 28,8 MWmed por
# meia hora (37,4 MWmed no pior submercado pelo resíduo das médias do dia, estatística que
# deixaria passar a troca de Rondônia e Tocantins Norte em 16/09/2026, com 7,9 MWmed). A
# gold publica, para cada dia, o ruído da hipótese e as duas estatísticas de cada
# alternativa: se um dia futuro tiver alternativa abaixo da tolerância (pela mediana por
# meia hora, a estatística da prova), as áreas envolvidas ficam ambíguas.
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
        """(maior mediana |resíduo| por meia hora, maior |resíduo das médias do dia|) entre
        os submercados que a alternativa altera."""
        piores, medias_dia = [], []
        for sm in {s for s in nova if nova[s] != hipotese[s]}:
            est = _estatistica(_residuos(series, sm, nova[sm]))
            piores.append(est if est is not None else float("inf"))
            medias_dia.append(abs(sum(medias[a] for a in nova[sm]) + medias[_perdas_de(sm)] - medias[_api_de(sm)]))
        return (max(piores) if piores else 0.0), (max(medias_dia) if medias_dia else 0.0)

    for a in positivas:
        for outro in NOME_SUBMERCADO:
            if outro == sm_de[a]:
                continue
            nova = {k: list(v) for k, v in hipotese.items()}
            nova[sm_de[a]].remove(a)
            nova[outro].append(a)
            alternativas.append((*fecha_com(nova), (a,), f"{a} no {outro}"))
    for i, a in enumerate(positivas):
        for b in positivas[i + 1:]:
            if sm_de[a] == sm_de[b]:
                continue
            nova = {k: list(v) for k, v in hipotese.items()}
            nova[sm_de[a]].remove(a)
            nova[sm_de[b]].remove(b)
            nova[sm_de[a]].append(b)
            nova[sm_de[b]].append(a)
            alternativas.append((*fecha_com(nova), (a, b), f"troca {a} e {b}"))
    alternativas.sort(key=lambda x: (x[0], x[3]))
    ambiguas = {a for est, _md, envolvidas, _ in alternativas if est <= tolerancia for a in envolvidas}
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
    lista = [{"descricao": d, "envolvidas": list(env), "mediana_abs_mwmed": est, "residuo_medias_dia_mwmed": md}
             for est, md, env, d in alternativas]
    menor = lista[0] if lista else None
    menor_md = min(lista, key=lambda x: (x["residuo_medias_dia_mwmed"], x["descricao"])) if lista else None
    return {"completo": True, "tolerancia_mwmed": tolerancia, "fecha": fecha, "submercados": res, "areas": areas,
            "ruido_mwmed": max(x["mediana_abs_mwmed"] for x in res.values()),
            "ruido_medias_dia_mwmed": max(abs(x["residuo_mwmed"]) for x in res.values()),
            "menor_alternativa": menor, "menor_alternativa_pelas_medias": menor_md,
            "alternativas": lista, "alternativas_avaliadas": len(lista), "medias_mwmed": medias}


def uf_para_submercado(conferencias, hipotese):
    """{uf: {subsistema, estado, areas}} a partir das conferências dos dias. Uma área vale
    como provada quando é provada em todo dia completo em que teve carga: com carga zero
    num dos dias, vale a prova do outro (o dia sem carga não prova nem reprova); com carga
    zero em todos, fica indeterminada. Estados:
    - 'provado': todas as áreas da UF provadas no mesmo submercado, e nenhuma área
      indeterminada;
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
