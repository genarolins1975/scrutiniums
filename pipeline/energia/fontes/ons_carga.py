"""ONS: curva de carga horária (CKAN, CSV anual) e carga verificada semi-horária (API).

Dois produtos do ONS que parecem a mesma coisa e não são (conferido em 30/09/2026):

1. Curva de Carga Horária (dados.ons.org.br/dataset/curva-carga, arquivos
   CURVA_CARGA_AAAA.csv no S3 `curva-carga-ho`). Uma coluna de valor,
   `val_cargaenergiahomwmed` (MWmed na hora; dicionário v1.2 de 06/04/2026: não admite
   nulo nem negativo, admite zero; aqui zero é ausência, ver `le_curva`). A média das 24 horas de um dia é exatamente a Carga de
   Energia Diária (`carga_energia_di`) do mesmo dia: é o mesmo produto em outro grão, com
   as mesmas mudanças de conteúdo de 01/03/2021 e 29/04/2023 (inclusão da estimativa de
   MMGD "com base em dados meteorológicos previstos", segundo as notas do CKAN). O
   componente de MMGD incluído NÃO é publicado separado neste conjunto.
   `din_instante` marca o início da hora local (00:00 a 23:00): a média das 24 horas
   do dia D reproduz o valor diário do dia D.

2. Carga de Energia Verificada (dados.ons.org.br/dataset/carga-energia-verificada): só
   API, `https://apicarga.ons.org.br/prd/cargaverificada?dat_inicio=&dat_fim=&cod_areacarga=`,
   semi-horária por área de carga (dicionário v1.1 de 30/10/2023). Publica a carga global
   (`val_cargaglobal`), a carga global líquida de MMGD (`val_cargaglobalsmmgd`; o
   dicionário a chama de `val_cargaglobalsmmg`), a parcela atendida por MMGD
   (`val_cargammgd`, não admite negativo), as parcelas supervisionada e não
   supervisionada e a consistência feita para os modelos de previsão. É a ÚNICA fonte
   do ONS em que carga, MMGD e carga líquida vêm com definições compatíveis entre si:
   carga global = carga líquida de MMGD + MMGD em cada meia hora (conferido: 1.440 de
   1.440 meias horas de set/2025 no SE/CO fecham a 0,01 MWmed).

   A carga global verificada NÃO é igual à curva de carga: em 20/09/2026 o SE/CO teve
   40.527,5 MWmed na API e 39.166,8 MWmed na curva (a diferença está sobretudo nas horas
   sem sol, na parcela não supervisionada). Subtrair a MMGD da API da curva misturaria
   produtos; por isso a decomposição horária usa só a API.

   `din_referenciautc` é o FIM da meia hora em UTC; o início da meia hora no horário de
   Brasília vem da conversão pelo fuso America/Sao_Paulo (UTC−3, e UTC−2 no horário de
   verão, que vigorou até 16/02/2019). Com a conversão pelo fuso, `dat_referencia` é
   sempre a data local do início da meia hora; com UTC−3 fixo, 94 meias horas de janeiro
   e fevereiro de 2019 cairiam no dia anterior (conferido em 30/09/2026).

Grão guardado no silver (a curva completa e as respostas da API ficam no bronze com
sha256): curva horária desde 2019 e agregados diários de todos os anos (média, pico e
hora do pico, por subsistema e SIN); API por hora cheia (carga global e MMGD; a líquida
é a diferença publicada pelo ONS, com a identidade conferida na ingestão).

Por ser o mesmo produto da carga diária, a curva horária NÃO serve para conferir um
valor diário atípico: se o valor diário está errado, a média das 24 horas repete o erro
(foi o que aconteceu com o Nordeste em 25/08/2018, ver docs/.../modulos/carga.md). A
conferência usa outros dois conjuntos do ONS, lidos aqui:

3. Balanço de Energia nos Subsistemas (dados.ons.org.br/dataset/balanco-energia-subsistema,
   BALANCO_ENERGIA_SUBSISTEMA_AAAA.csv desde 2000): geração hidráulica, térmica, eólica e
   solar, carga e intercâmbio por subsistema e hora. A carga do balanço é a mesma da
   carga diária (carga = Σ geração − intercâmbio), mas os COMPONENTES são outra
   informação: um valor diário que cai porque um componente de geração sumiu do dado
   (lacuna) aparece como um componente que vai a quase zero no dia e volta no seguinte.
   Guardamos a média diária de cada componente.

4. Carga de Energia Diária, arquivo atual da fonte (CARGA_ENERGIA_AAAA.csv): baixado
   para conferir no arquivo original o estado de cada dia ausente da série (célula
   vazia, linha ausente ou valor presente que o silver principal não tem) e para dar à
   evidência um arquivo que ainda se obtém.
"""
import json
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

FUSO = ZoneInfo("America/Sao_Paulo")

PACOTE_CURVA = "curva-carga"
URL_CURVA = "https://dados.ons.org.br/dataset/curva-carga"
S3_CURVA = "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/curva-carga-ho/"
URL_DIC_CURVA = S3_CURVA + "DicionarioDados_CurvaCarga.pdf"
URL_API = "https://apicarga.ons.org.br/prd/cargaverificada"
URL_API_DATASET = "https://dados.ons.org.br/dataset/carga-energia-verificada"
URL_DIC_API = "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/carga_verificada_tm/DicionarioDados_Carga_Verificada.pdf"
URL_DIARIA = "https://dados.ons.org.br/dataset/carga-energia"

SMS = ("SE", "S", "NE", "N")
# Áreas de carga do tipo submercado na API (SE = Sudeste/Centro-Oeste, "SECO").
AREAS = {"SE": "SECO", "S": "S", "NE": "NE", "N": "N"}
SM_DA_AREA = {v: k for k, v in AREAS.items()}
PRIMEIRO_ANO_HORARIO = 2019   # curva horária guardada no silver a partir deste ano
PRIMEIRO_MES_API = "2019-01"  # antes de 15/02/2019 a MMGD vem vazia na API
TOL_IDENTIDADE = 0.01         # MWmed: a API publica três casas decimais

_VAZIO = re.compile(r":\s*(?=[,}\]])")


# ---------------------------------------------------------------- curva de carga (CSV)

def hora_curva(din_instante):
    """'2026-09-29 23:00:00' → '2026-09-29T23:00' (início da hora local)."""
    s = (din_instante or "").strip()
    if len(s) < 13:
        return None
    return s[:10] + "T" + s[11:13] + ":00"


def le_curva(linhas, descartados=None):
    """Linhas do CSV (dicts) → {(sm, hora): valor}. Valor vazio ou não numérico é
    ausência; linha repetida (mesmo subsistema e hora) fica com a última ocorrência.

    Valor zero ou negativo também é ausência, e vai para `descartados` (lista de
    (sm, hora, texto original)) quando ela é passada. O dicionário admite zero, mas a
    carga de um subsistema inteiro numa hora não é zero: no início do horário de verão,
    a hora das 00h não existe no relógio local, e o ONS marca essa hora com célula vazia
    no SE, no NE e no N e com "0E-8" no Sul (CURVA_CARGA_2018.csv, 04/11/2018 00h; único
    zero nos 27 arquivos, conferido em 01/10/2026). Lido como carga, o zero dava ao Sul
    um dia de 24 horas com média 4,2% abaixo da Carga de Energia Diária do mesmo dia
    (7.968,2 contra 8.314,6 MWmed, que é a soma das 23 horas reais dividida por 23)."""
    out = {}
    for r in linhas:
        sm = (r.get("id_subsistema") or "").strip().upper()
        h = hora_curva(r.get("din_instante"))
        v = (r.get("val_cargaenergiahomwmed") or "").strip()
        if sm not in SMS or not h or not v:
            continue
        try:
            x = float(v.replace(",", "."))
        except ValueError:
            continue
        if not x > 0:
            if descartados is not None:
                descartados.append((sm, h, v))
            continue
        out[(sm, h)] = x
    return out


def agrega_curva(horario, ano_horario_min=PRIMEIRO_ANO_HORARIO):
    """Observações (serie, ref, valor) do silver a partir de {(sm, hora): MWmed}.

    - `carga_ho.<sm>`: valor horário, só para anos >= ano_horario_min;
    - `media_dia.<sm>`, `pico_dia.<sm>`, `hora_pico.<sm>`, `horas_dia.<sm>`: dia local;
      a média e o pico só existem em dia com as 24 horas (dia incompleto não é média);
    - o mesmo para o SIN, somando os quatro subsistemas hora a hora (só horas com os
      quatro): o pico do SIN é o máximo da soma, não a soma dos picos.
    Empate no pico fica com a primeira hora do dia."""
    por_dia = defaultdict(dict)
    for (sm, h), v in horario.items():
        por_dia[(sm, h[:10])][int(h[11:13])] = v
        if int(h[:4]) >= ano_horario_min:
            yield f"carga_ho.{sm}", h, v
    dias = sorted({d for (_, d) in por_dia})
    for d in dias:
        sin = {}
        completos = [sm for sm in SMS if len(por_dia.get((sm, d), {})) == 24]
        for sm in SMS:
            hs = por_dia.get((sm, d))
            if not hs:
                continue
            yield f"horas_dia.{sm}", d, float(len(hs))
            if len(hs) != 24:
                continue
            yield f"media_dia.{sm}", d, sum(hs.values()) / 24.0
            hp = min(hs, key=lambda k: (-hs[k], k))
            yield f"pico_dia.{sm}", d, hs[hp]
            yield f"hora_pico.{sm}", d, float(hp)
        if len(completos) == 4:
            for hr in range(24):
                sin[hr] = sum(por_dia[(sm, d)][hr] for sm in SMS)
            yield "horas_dia.SIN", d, 24.0
            yield "media_dia.SIN", d, sum(sin.values()) / 24.0
            hp = min(sin, key=lambda k: (-sin[k], k))
            yield "pico_dia.SIN", d, sin[hp]
            yield "hora_pico.SIN", d, float(hp)


# ---------------------------------------------------------------- carga verificada (API)

def url_api(area, inicio, fim):
    return f"{URL_API}?dat_inicio={inicio}&dat_fim={fim}&cod_areacarga={area}"


def parse_api(texto):
    """Lista de dicts da resposta. A API emite campo vazio como `"campo": ,` (JSON
    inválido): o vazio vira null, isto é, ausência, nunca zero."""
    if isinstance(texto, bytes):
        texto = texto.decode("utf-8")
    dados = json.loads(_VAZIO.sub(": null", texto))
    if not isinstance(dados, list):
        raise ValueError("resposta da API não é lista")
    return dados


def inicio_local(din_referenciautc):
    """Fim da meia hora em UTC → início da meia hora no horário de Brasília (fuso
    America/Sao_Paulo, com o horário de verão de antes de 2019), sem fuso no resultado."""
    s = din_referenciautc.replace("Z", "").split(".")[0]
    fim = datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
    return (fim - timedelta(minutes=30)).astimezone(FUSO).replace(tzinfo=None)


def agrega_api(registros, dia_limite=None):
    """Registros semi-horários → ({(sm, hora_local): {...}}, controles).

    Por hora cheia local: soma das duas meias horas de carga global e de MMGD (MWmed ×
    0,5 h = MWh) e contagem de meias horas com valor em cada campo. A hora só vira
    observação quando as duas meias horas existem (hora incompleta não é média).
    `dia_limite` (AAAA-MM-DD, data de Brasília da captura): dias a partir dele são
    descartados, porque a API devolve o dia em curso com zeros nas horas que ainda não
    aconteceram (visto em 30/09/2026 pelo módulo Transição). Controles: meias horas
    lidas, repetidas, datas divergentes, identidade global = líquida + MMGD."""
    unicos = {}
    ctl = {"meias_horas": 0, "repetidas": 0, "data_divergente": 0, "identidade_conferida": 0,
           "identidade_falha": 0, "mmgd_negativa": 0, "descartadas_dia_em_curso": 0,
           "din_atualizacao_max": None, "din_atualizacao_min": None}
    for x in registros:
        chave = (x.get("cod_areacarga"), x.get("din_referenciautc"))
        if not chave[0] or not chave[1]:
            continue
        if chave in unicos:
            ctl["repetidas"] += 1
        unicos[chave] = x
    out = defaultdict(lambda: {"global_mwh": 0.0, "mmgd_mwh": 0.0, "n_global": 0, "n_mmgd": 0})
    for (area, ref), x in unicos.items():
        sm = SM_DA_AREA.get(area)
        if not sm:
            continue
        ini = inicio_local(ref)
        dia = ini.date().isoformat()
        if dia_limite and dia >= dia_limite:
            ctl["descartadas_dia_em_curso"] += 1
            continue
        ctl["meias_horas"] += 1
        if (x.get("dat_referencia") or "")[:10] != dia:
            ctl["data_divergente"] += 1
        atu = x.get("din_atualizacao")
        if atu:
            ctl["din_atualizacao_max"] = max(ctl["din_atualizacao_max"] or atu, atu)
            ctl["din_atualizacao_min"] = min(ctl["din_atualizacao_min"] or atu, atu)
        g, liq, m = x.get("val_cargaglobal"), x.get("val_cargaglobalsmmgd"), x.get("val_cargammgd")
        if g is not None and liq is not None and m is not None:
            ctl["identidade_conferida"] += 1
            if abs(float(g) - float(liq) - float(m)) > TOL_IDENTIDADE:
                ctl["identidade_falha"] += 1
        if m is not None and float(m) < 0:
            ctl["mmgd_negativa"] += 1
        hora = ini.replace(minute=0).strftime("%Y-%m-%dT%H:00")
        a = out[(sm, hora)]
        if g is not None:
            a["global_mwh"] += float(g) * 0.5
            a["n_global"] += 1
        if m is not None:
            a["mmgd_mwh"] += float(m) * 0.5
            a["n_mmgd"] += 1
    return dict(out), ctl


def observacoes_api(horas):
    """Observações do silver: `global_ho.<sm>` e `mmgd_ho.<sm>` em MWmed da hora
    (MWh da hora ÷ 1 h), só com as duas meias horas do campo."""
    for (sm, hora), a in horas.items():
        if a["n_global"] == 2:
            yield f"global_ho.{sm}", hora, round(a["global_mwh"], 4)
        if a["n_mmgd"] == 2:
            yield f"mmgd_ho.{sm}", hora, round(a["mmgd_mwh"], 4)


# ---------------------------------------------------------------- balanço de energia (CSV)

PACOTE_BALANCO = "balanco-energia-subsistema"
URL_BALANCO = "https://dados.ons.org.br/dataset/balanco-energia-subsistema"
URL_DIC_BALANCO = ("https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/balanco_energia_subsistema_ho/"
                   "DicionarioDados_Balanco_Energia_Subsistema.pdf")
# componente publicado → coluna do CSV (dicionário do balanço; MWmed na hora)
COMPONENTES_BALANCO = (("hidraulica", "val_gerhidraulica"), ("termica", "val_gertermica"),
                       ("eolica", "val_gereolica"), ("solar", "val_gersolar"),
                       ("carga", "val_carga"), ("intercambio", "val_intercambio"))
GERACAO_BALANCO = ("hidraulica", "termica", "eolica", "solar")


def _num(v):
    s = (v or "").strip()
    if not s:
        return None
    try:
        return float(s.replace(",", "."))
    except ValueError:
        return None


def agrega_balanco(linhas):
    """Linhas do CSV do balanço (dicts) → observações diárias por subsistema:
    `<componente>_dia.<sm>` = média das horas com valor no dia (MWmed) e
    `horas_<componente>.<sm>` = quantas horas tinham valor. Célula vazia é ausência
    (não entra na média nem vira zero). Só os quatro subsistemas (o arquivo não traz SIN)."""
    acc = defaultdict(lambda: [0.0, 0])
    for r in linhas:
        sm = (r.get("id_subsistema") or "").strip().upper()
        inst = (r.get("din_instante") or "").strip()
        if sm not in SMS or len(inst) < 10:
            continue
        dia = inst[:10]
        for comp, col in COMPONENTES_BALANCO:
            v = _num(r.get(col))
            if v is None:
                continue
            a = acc[(comp, sm, dia)]
            a[0] += v
            a[1] += 1
    for (comp, sm, dia), (soma, n) in acc.items():
        yield f"{comp}_dia.{sm}", dia, soma / n
        yield f"horas_{comp}.{sm}", dia, float(n)


# ---------------------------------------------------------------- carga diária (arquivo da fonte)

URL_S3_DIARIA = "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/carga_energia_di/"


def le_diaria_fonte(linhas):
    """Linhas do CARGA_ENERGIA_AAAA.csv → ({(sm, dia): valor}, {(sm, dia)} com célula
    vazia). Distingue valor ausente na linha (célula vazia) de linha inexistente, que é
    o que a conferência de ausência precisa publicar. O arquivo de 2013 tem uma linha
    extra do Sul em "2013-02-02 00:00:01" com valor vazio, além da linha das 00:00:00 com
    valor: célula vazia só conta quando o dia não tem nenhuma linha com valor."""
    valores, vazias = {}, set()
    for r in linhas:
        sm = (r.get("id_subsistema") or "").strip().upper()
        dia = (r.get("din_instante") or "").strip()[:10]
        if sm not in SMS or len(dia) != 10:
            continue
        v = _num(r.get("val_cargaenergiamwmed"))
        if v is None:
            vazias.add((sm, dia))
        else:
            valores[(sm, dia)] = v
    return valores, {k for k in vazias if k not in valores}
