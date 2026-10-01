"""Módulo Água e clima (detalhe): armazenamento, afluência, clima e balanço dos reservatórios.

Gold: public/energia/gold/agua_detalhe.json (painéis P017 a P020) e CSVs em
public/energia/series/ (agua_*.csv e clima_diario.csv). Complementa, sem substituir, a
gold de operação hidrologia.json (EAR e ENA por subsistema, construída por
pipeline/energia/gold/hidrologia.py a partir do silver principal).

Fontes (seção "Fontes verificadas" em docs/observatorios/energia/modulos/agua.md):
- ONS: EAR e ENA por REE e por bacia; EAR e ENA por reservatório; dados hidráulicos por
  reservatório (base diária); cadastro de reservatórios; contornos das bacias;
  precipitação diária observada (2020 e 2021, só para conferência); dicionários de dados;
  carga verificada por área geoelétrica (um dia, para conferir estado → subsistema);
- ONS no silver principal (só leitura): EAR e ENA por subsistema; balanço de energia;
- NASA POWER: precipitação IMERG (GPM) e temperatura MERRA-2/GEOS-IT por ponto;
- IBGE: sedes municipais (Localidades 2022) e população do Censo 2022 (SIDRA 4709).

Por que tanto cuidado com unidade e perímetro:
- EAR agregada é soma de energias (MWmês) dividida pela soma das capacidades; média de
  percentuais daria peso igual a um Sul pequeno e a um Sudeste enorme;
- a ENA de 30 dias em % da MLT é razão de somas com a MLT vigente em cada dia; a MLT do
  ONS muda (usinas novas e recálculo da referência), e isso é publicado, não escondido;
- o balanço de um reservatório é feito em hm³ (m³/s × segundos do dia), com o volume do
  cadastro; o resíduo fica visível. A afluência publicada pelo ONS é, na maioria dos
  reservatórios, calculada pelo próprio balanço (defluência + variação do volume): um
  resíduo perto de zero é consequência da construção, não prova independente;
- a variação da EAR de um subsistema é decomposta por reservatório (identidade conferida
  contra o conjunto por subsistema); a ENA aparece ao lado como contexto, nunca como
  explicação única.
"""
import calendar
import hashlib
import json
import math
import os
import sys
import time
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import http_get  # noqa: E402
from pipeline.energia import base  # noqa: E402
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia.fontes import ckan, clima_agua as cl, ons as ons_sm, ons_agua as oa  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "agua_detalhe.json"
FAMILIA = "ons_hidrologia"
PAGINA = [{"rotulo": "Água e clima", "href": "/setor-eletrico/agua-e-clima"}]
REPRODUCAO = "python3 pipeline/energia/executar_modulo.py agua --sem-coleta"

# silver da família ons_hidrologia
DS_EAR_REE = "ons_ear_ree_di"
DS_ENA_REE = "ons_ena_ree_di"
DS_EAR_BACIA = "ons_ear_bacia_di"
DS_ENA_BACIA = "ons_ena_bacia_di"
DS_EAR_RES = "ons_ear_reservatorio_di"
DS_ENA_RES = "ons_ena_reservatorio_di"
DS_HIDRO = "ons_dados_hidrologicos_di"
DS_CAD = "ons_reservatorio_cadastro"
DS_PRECIP_EST = "ons_precipitacao_estacao"
DS_SHP = "ons_bacia_contorno"
DS_DIC = "ons_hidrologia_dicionarios"
DS_AREAS = "ons_carga_areas_verificacao"
DS_IBGE_LOC = "ibge_localidades_2022"
DS_IBGE_POP = "ibge_censo2022_populacao"
DS_POWER_PR = "nasa_power_imerg"
DS_POWER_T = "nasa_power_merra2"
DS_CLIMA_PR = "clima_precipitacao_bacia"
DS_CLIMA_T = "clima_temperatura"
DS_PONTOS_PR = "clima_pontos_precipitacao"
DS_PONTOS_T = "clima_celulas_temperatura"
DS_CONTROLE = "agua_controle"
DS_EAR_SM_CONF = "ons_ear_subsistema_conferencia"   # recaptura do ano corrente e do anterior
DS_ENA_SM_CONF = "ons_ena_subsistema_conferencia"

# silver principal (só leitura)
DS_EAR_SM = "ear_subsistema_di"
DS_ENA_SM = "ena_subsistema_di"
DS_BAL = "balanco_energia_subsistema_ho"

SMS = c.ORDEM_SM
TODOS = SMS + ("SIN",)
ANO_INI_BACIA = 2001        # faixas sazonais: anos completos desde 2001 (mesma base da hidrologia.json)
ANO_INI_REE = 2016          # o conjunto por REE começa em 2016
DIARIO_EAR_RES = "2024-01-01"   # EAR diária por reservatório no silver (janela publicada)
DIARIO_RECORTES = "2022-01-01"  # CSV diário de REE e bacias (o mensal cobre desde 2000)
HIDRO_DESDE = "2025-01-01"      # dados hidráulicos diários no silver (janela publicada)
ANO_MIN_HIDRO = 2025
BASE_CLIMA = (2001, 2025)       # climatologia: anos completos 2001 a 2025
JANELA = 30
UF_DESDE = "2019-01-01"          # temperatura por UF no silver e no CSV

URLS = {k: f"https://dados.ons.org.br/dataset/{v[0]}" for k, v in oa.PACOTES.items()}
URL_POWER = "https://power.larc.nasa.gov/"
URL_LOC = ("https://geoftp.ibge.gov.br/organizacao_do_territorio/estrutura_territorial/localidades/"
           "Localidades_do_Brasil/2022/Localidades_Brasil_shp.zip")
URL_POP_MUN = "https://apisidra.ibge.gov.br/values/t/4709/n6/all/v/93/p/2022"
URL_POP_UF = "https://apisidra.ibge.gov.br/values/t/4709/n3/all/v/93/p/2022"
URL_AREAS = "https://apicarga.ons.org.br/prd/cargaverificada?dat_inicio={d}&dat_fim={d}&cod_areacarga={a}"
DIA_AREAS = "2026-08-10"
LICENCA_POWER = ("Dados abertos da NASA, sem restrição de uso; o projeto POWER pede citação do serviço, da versão "
                 "e da data de acesso (https://power.larc.nasa.gov/docs/referencing/)")
LICENCA_IBGE = ("Uso livre com citação da fonte (IBGE). A página de termos de uso do IBGE não foi relida nesta "
                "integração.")

DS_REGISTRO = [
    ("ONS", "ear-diario-por-ree-reservatorio-equivalente-de-energia", DS_EAR_REE, "EAR diária por REE", "ear_ree"),
    ("ONS", "ena-diario-por-ree-reservatorio-equivalente-de-energia", DS_ENA_REE, "ENA diária por REE", "ena_ree"),
    ("ONS", "ear-diario-por-bacia", DS_EAR_BACIA, "EAR diária por bacia", "ear_bacia"),
    ("ONS", "ena-diario-por-bacia", DS_ENA_BACIA, "ENA diária por bacia", "ena_bacia"),
    ("ONS", "ear-diario-por-reservatorio", DS_EAR_RES, "EAR diária por reservatório", "ear_res"),
    ("ONS", "ena-diario-por-reservatorio", DS_ENA_RES, "ENA diária por reservatório (MLT por usina)", "ena_res"),
    ("ONS", "dados-hidrologicos-res", DS_HIDRO, "Dados hidráulicos por reservatório, base diária", "hidro_res"),
    ("ONS", "reservatorio", DS_CAD, "Cadastro de reservatórios", "cadastro"),
    ("ONS", "precipitacao-estacao", DS_PRECIP_EST, "Precipitação diária observada (2020 e 2021)", "precip_est"),
    ("ONS", "bacia_contorno", DS_SHP, "Contornos das bacias hidrográficas", "bacias_shp"),
]

REGISTRO = {
    "id": "agua", "gold": GOLD, "familia": FAMILIA, "ordem": 20,
    "datasets": [
        *[{"orgao": o, "nome": n, "slug": f"ons-{n}", "dataset_silver": ds, "titulo": t,
           "estado": "UTILIZADO EM INDICADOR", "url": f"https://dados.ons.org.br/dataset/{n}", "licenca": c.LICENCA_ONS,
           "paginas": PAGINA, "downloads": [], "quebras": []} for o, n, ds, t, _k in DS_REGISTRO],
        {"orgao": "NASA", "nome": "power-daily-imerg", "slug": "nasa-power-imerg", "dataset_silver": DS_POWER_PR,
         "titulo": "NASA POWER: precipitação diária IMERG (GPM) por ponto", "estado": "UTILIZADO EM INDICADOR",
         "url": URL_POWER, "licenca": LICENCA_POWER, "paginas": PAGINA,
         "downloads": ["/energia/series/agua_precipitacao_bacias_diario.csv"], "quebras": []},
        {"orgao": "NASA", "nome": "power-daily-merra2", "slug": "nasa-power-merra2", "dataset_silver": DS_POWER_T,
         "titulo": "NASA POWER: temperatura diária MERRA-2/GEOS-IT por ponto", "estado": "UTILIZADO EM INDICADOR",
         "url": URL_POWER, "licenca": LICENCA_POWER, "paginas": PAGINA,
         "downloads": ["/energia/series/clima_diario.csv"], "quebras": []},
        {"orgao": "IBGE", "nome": "localidades-2022", "slug": "ibge-localidades-2022", "dataset_silver": DS_IBGE_LOC,
         "titulo": "IBGE: Localidades do Brasil 2022 (sedes municipais)", "estado": "UTILIZADO EM INDICADOR",
         "url": URL_LOC, "licenca": LICENCA_IBGE, "paginas": PAGINA, "downloads": [], "quebras": []},
        {"orgao": "IBGE", "nome": "sidra-4709", "slug": "ibge-sidra-4709", "dataset_silver": DS_IBGE_POP,
         "titulo": "IBGE: população residente, Censo 2022 (SIDRA 4709)", "estado": "UTILIZADO EM INDICADOR",
         "url": URL_POP_MUN, "licenca": LICENCA_IBGE, "paginas": PAGINA, "downloads": [], "quebras": []},
        {"orgao": "ONS", "nome": "carga-energia-verificada", "slug": "ons-carga-verificada-areas", "dataset_silver": DS_AREAS,
         "titulo": "ONS: carga verificada por área geoelétrica (conferência estado → subsistema)",
         "estado": "UTILIZADO EM INDICADOR", "url": "https://dados.ons.org.br/dataset/carga-energia-verificada",
         "licenca": c.LICENCA_ONS, "paginas": PAGINA, "downloads": [], "quebras": []},
    ],
    "arquivos": {
        "/energia/series/clima_diario.csv": (
            "Temperatura do ar a 2 m por subsistema e SIN, diária desde 2001 (NASA POWER, MERRA-2 e GEOS-IT; ESTIMADO por "
            "reanálise). Colunas: data (AAAA-MM-DD, dia em hora solar local); recorte (SE, S, NE, N, SIN); temp_media_c, "
            "temp_max_c, temp_min_c (°C; média do dia e extremos horários do dia na célula, ponderados pela população); "
            "cobertura_pop_pct (% da população do recorte representada por células com dado no dia); ufs_com_dado; "
            "fonte_versao (MERRA-2 até o fim da série MERRA-2 no POWER; GEOS-IT depois, marcado como preliminar); "
            "preliminar (1 = últimos 60 dias, sujeitos a troca GEOS-IT → MERRA-2). Ausência = campo vazio."),
        "/energia/series/agua_temperatura_uf_diario.csv": (
            "Temperatura do ar a 2 m por unidade da federação, diária desde 2019. Colunas: data; uf; subsistema; temp_media_c; "
            "temp_max_c; temp_min_c; celulas_com_dado; populacao_uf (Censo 2022). ESTIMADO por reanálise."),
        "/energia/series/agua_precipitacao_bacias_diario.csv": (
            "Precipitação média na área de cada bacia hidroenergética do ONS, diária desde 2016 (IMERG via NASA POWER; "
            "ESTIMADO por satélite). Colunas: data (dia UTC); bacia; precip_mm (mm/dia, média ponderada pela área); "
            "cobertura_pct (% do peso da bacia com dado); preliminar (1 = IMERG Late, sem calibração por pluviômetros)."),
        "/energia/series/agua_precipitacao_bacias_mensal.csv": (
            "Precipitação mensal por bacia desde 2001. Colunas: mes (AAAA-MM); bacia; precip_mm (soma dos dias; vazio se "
            "faltar dia); media_2001_2025_mm, p10_mm, p90_mm, anos_base (climatologia do mês); anomalia_pct "
            "(100 × (precip ÷ média − 1)); preliminar (1 = mês com dias IMERG Late)."),
        "/energia/series/agua_clima_pontos.csv": (
            "Manifesto espacial. Colunas: tipo (precipitacao ou temperatura); id; lat; lon; recorte (bacia do ONS ou UF); "
            "subrecorte (polígono do shapefile ou subsistema); passo_grau; peso (área relativa, cos(lat) × passo², ou "
            "população da célula); populacao_recorte."),
        "/energia/series/agua_ear_recortes_diario.csv": (
            "EAR e ENA diárias por REE e por bacia (ONS), desde 2022. Colunas: data; recorte (ree ou bacia); nome; ear_mwmes; "
            "ear_max_mwmes; ear_pct (publicado); ena_bruta_mwmed (MWmed); ena_bruta_pct_mlt; mlt_implicita_mwmed "
            "(ENA ÷ % MLT × 100). Ausência = vazio."),
        "/energia/series/agua_ear_recortes_mensal.csv": (
            "EAR no último dia do mês e ENA mensal por REE e por bacia, desde 2000. Colunas: mes; recorte; nome; dia_ear; "
            "ear_mwmes_fim_mes; ear_max_mwmes_fim_mes; ear_pct_fim_mes; ena_bruta_pct_mlt_mes (Σ ENA ÷ Σ MLT dos dias do mês, "
            "só com o mês completo); dias_ena."),
        "/energia/series/agua_capacidade_eventos.csv": (
            "Mudanças da EAR máxima por subsistema e sua atribuição a reservatórios. Colunas: data; subsistema; "
            "ear_max_antes_mwmes; ear_max_depois_mwmes; variacao_mwmes; cod_reservatorio; reservatorio; parte "
            "(proprio ou jusante); tipo (entrada, saida, alteracao); variacao_reservatorio_mwmes; residuo_evento_mwmes."),
        "/energia/series/agua_mlt_mudancas.csv": (
            "Mudanças da MLT por usina (ONS, ENA por reservatório). Colunas: data; cod_reservatorio; reservatorio; "
            "subsistema; mlt_antes_mwmed; mlt_depois_mwmed; variacao_pct; tipo (revisao_no_mes: mudança fora do dia 1º, "
            "em usina existente). As trocas mensais normais (dia 1º) não entram no arquivo."),
        "/energia/series/agua_reservatorios.csv": (
            "Reservatórios com balanço hídrico da janela de 30 dias. Colunas: id; cod; nome; subsistema; bacia; ree; "
            "tipo; vol_util_total_hm3 (cadastro ONS); vol_util_pct_fim; dv_obs_hm3; afluencia_hm3; defluencia_hm3; "
            "turbinado_hm3; vertido_hm3; outras_estruturas_hm3; defluencia_nao_discriminada_hm3; transferido_hm3; "
            "residuo_hm3 (dv_obs − (afluência − defluência)); residuo_com_transferencia_hm3; dias_com_dado; "
            "delta_ear_mwmes; dias_residuo_dentro_tolerancia_pct."),
        "/energia/series/agua_reservatorios_diario.csv": (
            "Dados hidráulicos diários dos reservatórios com volume útil, últimos 365 dias. Colunas: data; id; "
            "vol_util_pct; dv_hm3; q_afluente, q_defluente, q_turbinada, q_vertida, q_outras, q_transferida, "
            "q_evaporacao, q_natural, q_incremental (m³/s); residuo_hm3. Ausência = vazio."),
    },
}


# ================================================================ utilitários

def _agora():
    return base.agora_utc()


def _ext_de_arquivo(arquivo):
    partes = (arquivo or "").split(".")
    return partes[-2].lower() if len(partes) >= 3 and partes[-1] == "gz" else partes[-1].lower()


def _ano(recurso):
    dig = "".join(ch for ch in recurso[-4:] if ch.isdigit())
    return int(dig) if len(dig) == 4 else None


def _ja_importado(con, vid):
    return con.execute("SELECT 1 FROM registros WHERE dataset=? AND chave=? AND campo='importado_em'",
                       (DS_CONTROLE, vid)).fetchone() is not None


def _marca_importado(con, vid, colunas, extra=None):
    linhas = [(vid, "importado_em", _agora()), (vid, "colunas", ";".join(colunas or []))]
    for k, v in (extra or {}).items():
        linhas.append((vid, k, v))
    base.grava_registros(con, DS_CONTROLE, vid, linhas)


def _series_glob(con, ds, padrao, desde=None):
    """{serie: {ref: valor}} vigente de todas as séries do dataset que casam com o GLOB."""
    filtro, extra = ("AND o.ref >= ?", (desde,)) if desde else ("", ())
    out = defaultdict(dict)
    for s, ref, v in con.execute(
            f"""SELECT o.serie, o.ref, o.valor FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
                WHERE o.dataset=? AND o.serie GLOB ? {filtro} ORDER BY v.capturado_em, o.rowid""",
            (ds, padrao, *extra)):
        out[s][ref] = v
    return out


def _serie(con, ds, serie, desde=None):
    filtro, extra = ("AND o.ref >= ?", (desde,)) if desde else ("", ())
    out = {}
    for ref, v in con.execute(
            f"""SELECT o.ref, o.valor FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
                WHERE o.dataset=? AND o.serie=? {filtro} ORDER BY v.capturado_em, o.rowid""", (ds, serie, *extra)):
        out[ref] = v
    return out


def _md(dia):
    md = dia[5:10]
    return "02-28" if md == "02-29" else md


def _dmenos(dia, n):
    return (c.d(dia) - timedelta(days=n)).isoformat()


def _dias_janela(fim, n=JANELA):
    f = c.d(fim)
    return [(f - timedelta(days=i)).isoformat() for i in range(n - 1, -1, -1)]


def _pearson(xs, ys):
    pares = [(x, y) for x, y in zip(xs, ys) if x is not None and y is not None]
    n = len(pares)
    if n < 10:
        return None, n
    mx = sum(p[0] for p in pares) / n
    my = sum(p[1] for p in pares) / n
    sxx = sum((p[0] - mx) ** 2 for p in pares)
    syy = sum((p[1] - my) ** 2 for p in pares)
    if sxx <= 0 or syy <= 0:
        return None, n
    return sum((p[0] - mx) * (p[1] - my) for p in pares) / math.sqrt(sxx * syy), n


def _faixa(v, p10, p90):
    if v is None or p10 is None or p90 is None:
        return None
    return "abaixo" if v < p10 else ("acima" if v > p90 else "dentro")


def _bandas_do_dia(serie, dia, ano_ini):
    """p10, p50, p90 e n do valor do mesmo dia do calendário nos anos completos de ano_ini
    ao ano anterior ao do dia (29/02 fora da distribuição; como referência usa 28/02)."""
    ano_ref = int(dia[:4])
    md = _md(dia)
    vs = [serie[f"{a}-{md}"] for a in range(ano_ini, ano_ref) if f"{a}-{md}" in serie]
    if not vs:
        return None, None, None, 0, []
    return c.quantil(vs, 0.1), c.quantil(vs, 0.5), c.quantil(vs, 0.9), len(vs), vs


def _fonte_arquivos(orgao, conjunto, url, vintages):
    """Bloco `fonte` da evidência com um ou vários arquivos (vintages do silver)."""
    arqs = [ev.arquivo_de_vintage(v) for v in vintages if v]
    f = {"orgao": orgao, "conjunto": conjunto, "recurso": None, "url": url, "arquivo": None, "sha256": None,
         "capturado_em": None, "publicado_em": None}
    if len(arqs) == 1:
        f.update({k: arqs[0].get(k) for k in ("recurso", "arquivo", "sha256", "capturado_em", "publicado_em")})
    elif arqs:
        f["arquivos"] = arqs
    return f


def _vintage_do_ano(con, ds, prefixo, ano):
    return base.ultima_vintage(con, ds, f"{prefixo}{ano}")


# ================================================================ coleta

def _baixa_pacote_ons(con, chave, ds, hoje, preferir, ano_min, status, anos=None):
    """Baixa os recursos anuais de um conjunto do ONS e devolve [(ano, vintage)]."""
    pacote, _dir, prefixo = oa.PACOTES[chave]
    st = {"conjunto": pacote, "novas": 0, "identicas": 0, "puladas": 0, "falhas": []}
    try:
        pac = ckan.pacote("ONS", pacote)
    except Exception as e:  # pane da API: registrada, a gold usa o que já está no silver
        base.registra_coleta(con, ds, "*", False, f"package_show: {e}")
        st["falhas"].append(f"package_show: {e}")
        status[ds] = st
        return []
    meta = ckan.metadados(pac, "ONS")
    base.escreve_gold(f"_meta_{ds}.json", meta, destino=os.path.join(base.DADOS, "meta"))
    _baixa_dicionarios(con, pac, st)
    if chave in ("cadastro", "bacias_shp"):
        recursos = {}
        for r in pac.get("resources", []):
            arq = (r.get("url") or "").rsplit("/", 1)[-1]
            fmt = (r.get("format") or "").upper()
            if arq.startswith(prefixo) and fmt in preferir:
                recursos.setdefault(0, {})[fmt] = r
        recursos = {0: next(recursos[0][f] for f in preferir if f in recursos.get(0, {}))} if recursos else {}
    else:
        recursos = oa.recursos_anuais(pac, prefixo, preferir)
    out = []
    for ano in sorted(recursos):
        if ano and (ano < ano_min or (anos and ano not in anos)):
            continue
        r = recursos[ano]
        url = r.get("url")
        arq = url.rsplit("/", 1)[-1]
        recurso, _, ext = arq.rpartition(".")
        idade = 1 if ano in (0, hoje.year) else 30
        res = ckan.baixar_recurso(con, orgao="ONS", dataset=ds, recurso=recurso, url=url,
                                  publicado_em=r.get("last_modified"), ext=ext.lower(), max_idade_dias=idade)
        chave_st = {"nova": "novas", "identica": "identicas", "pulada": "puladas"}.get(res["status"])
        if chave_st:
            st[chave_st] += 1
        else:
            st["falhas"].append(f"{recurso}: {res['detalhe']}")
        if res["vintage"]:
            out.append((ano, res["vintage"]))
        if res["status"] in ("nova", "identica"):
            time.sleep(0.3)
    status[ds] = st
    return out


def _baixa_dicionarios(con, pac, st):
    for r in pac.get("resources", []):
        url = r.get("url") or ""
        arq = url.rsplit("/", 1)[-1]
        if "Dicionario" not in arq:
            continue
        recurso, _, ext = arq.rpartition(".")
        res = ckan.baixar_recurso(con, orgao="ONS", dataset=DS_DIC, recurso=f"{recurso}.{ext.lower()}", url=url,
                                  publicado_em=r.get("last_modified"), ext=ext.lower(), max_idade_dias=30)
        if res["status"] == "falha":
            st["falhas"].append(f"{arq}: {res['detalhe']}")


def _importa_ons(con, chave, ds, ano, vint):
    """Importa uma vintage do bronze para o silver (uma vez por vintage)."""
    vid = vint["vintage_id"]
    if _ja_importado(con, vid):
        return None
    ext = _ext_de_arquivo(vint["arquivo"])
    cols = oa.colunas_bronze(vint["arquivo"], ext)
    extra = {}
    if chave in ("ear_ree", "ear_bacia"):
        linhas = oa.parse_ear_agregado(oa.linhas_bronze(vint["arquivo"], ext), "ree" if chave == "ear_ree" else "bacia")
        novas, revs = base.grava_observacoes(con, ds, vid, linhas)
    elif chave in ("ena_ree", "ena_bacia"):
        linhas = oa.parse_ena_agregado(oa.linhas_bronze(vint["arquivo"], ext), "ree" if chave == "ena_ree" else "bacia")
        novas, revs = base.grava_observacoes(con, ds, vid, linhas)
    elif chave == "ear_res":
        res = oa.parse_ear_reservatorio(oa.linhas_bronze(vint["arquivo"], ext, oa.COLS_EAR_RES), DIARIO_EAR_RES)
        obs = list(res["obs"])
        for (sm, ref), (e, m) in res["soma"].items():
            obs.append((f"soma_ear_mwmes.{sm}", ref, e))
            obs.append((f"soma_earmax_mwmes.{sm}", ref, m))
        novas, revs = base.grava_observacoes(con, ds, vid, obs)
        regs = []
        for cod, (p0, p1) in res["presenca"].items():
            regs += [(f"{cod}|{ano}", "primeiro_dia", p0), (f"{cod}|{ano}", "ultimo_dia", p1)]
        for cod, at in res["atributos"].items():
            regs += [(f"{cod}|{ano}", k, v or None) for k, v in at.items()]
        base.grava_registros(con, ds, vid, regs)
    elif chave == "ena_res":
        novas, revs = base.grava_observacoes(con, ds, vid, oa.parse_ena_reservatorio(
            oa.linhas_bronze(vint["arquivo"], ext, oa.COLS_ENA_RES)))
    elif chave == "hidro_res":
        obs, atrib = oa.parse_dados_hidrologicos(oa.linhas_bronze(vint["arquivo"], ext, oa.COLS_HIDRO), HIDRO_DESDE)
        novas, revs = base.grava_observacoes(con, ds, vid, obs)
        base.grava_registros(con, ds, vid, [(rid, k, v or None) for rid, at in atrib.items() for k, v in at.items()])
    elif chave in ("ear_sm", "ena_sm"):
        texto = _le_bronze(vint).decode("utf-8-sig", errors="replace")
        novas, revs = base.grava_observacoes(con, ds, vid, (ons_sm.parse_ear if chave == "ear_sm" else ons_sm.parse_ena)(texto))
    elif chave == "cadastro":
        regs, dup = oa.parse_cadastro(oa.linhas_bronze(vint["arquivo"], ext))
        novas, revs = base.grava_registros(con, ds, vid, regs)
        extra["linhas_repetidas"] = json.dumps(dup, ensure_ascii=False)
    else:
        return None
    _marca_importado(con, vid, cols, extra)
    con.commit()
    return {"recurso": vint["recurso"], "novas": novas, "revisoes": revs}


def _baixa_url(con, orgao, ds, recurso, url, ext, idade, pausa=0.0):
    res = ckan.baixar_recurso(con, orgao=orgao, dataset=ds, recurso=recurso, url=url, ext=ext, max_idade_dias=idade)
    if pausa and res["status"] in ("nova", "identica"):
        time.sleep(pausa)
    return res


def _le_bronze(vint):
    with base.abre_bronze(vint["arquivo"]) as f:
        return f.read()


def _pontos_precipitacao(con, st):
    """Pontos de grade dentro dos polígonos das bacias (registros DS_PONTOS_PR)."""
    v = base.ultima_vintage(con, DS_SHP, "Bacias_Hidrograficas_SIN")
    if not v:
        st["falhas"].append("shapefile de bacias ausente no bronze")
        return []
    bacias = cl.bacias_do_zip(_le_bronze(v))
    regs, pontos = [], []
    for b in bacias:
        passo, pts = cl.pontos_grade(b)
        for p in pts:
            pid = cl.id_ponto_precip(p["lat"], p["lon"])
            ch = f"{b['nome_shape']}|{pid}"
            pontos.append({**p, "id": pid, "bacia_shape": b["nome_shape"], "bacia": b["bacia_ons"], "passo": passo})
            regs += [(ch, "lat", repr(p["lat"])), (ch, "lon", repr(p["lon"])), (ch, "peso", repr(p["peso"])),
                     (ch, "passo", repr(passo)), (ch, "bacia", b["bacia_ons"]), (ch, "ponto", pid)]
    base.grava_registros(con, DS_PONTOS_PR, v["vintage_id"], regs + _remocoes(con, DS_PONTOS_PR, regs))
    con.commit()
    return pontos


def _vigentes(con, ds):
    """Registros vigentes com ao menos um campo (pontos removidos ficam só no histórico)."""
    return {ch: campos for ch, campos in base.registros_como_estavam_em(con, ds).items() if campos}


def _remocoes(con, ds, regs):
    """Linhas (chave, campo, None) para pontos que deixaram de ser escolhidos: o registro
    fica com o campo apagado (histórico preservado) e some da lista vigente."""
    novas = {ch for ch, _c, _v in regs}
    out = []
    for ch, campos in base.registros_como_estavam_em(con, ds).items():
        if ch not in novas:
            out += [(ch, k, None) for k in campos]
    return out


def _celulas_temperatura(con, st):
    vl = base.ultima_vintage(con, DS_IBGE_LOC, "Localidades_Brasil_shp")
    vm = base.ultima_vintage(con, DS_IBGE_POP, "populacao_municipios_2022")
    vu = base.ultima_vintage(con, DS_IBGE_POP, "populacao_ufs_2022")
    if not (vl and vm and vu):
        st["falhas"].append("IBGE (localidades ou população) ausente no bronze")
        return []
    sedes = cl.sedes_municipais(_le_bronze(vl))
    pop_mun = cl.populacao_sidra(_le_bronze(vm))
    pop_uf_cod = cl.populacao_sidra(_le_bronze(vu))
    cod_uf = {}
    for cod, (uf, *_r) in sedes.items():
        cod_uf[cod[:2]] = uf
    pop_uf = {cod_uf[k]: v for k, v in pop_uf_cod.items() if k in cod_uf}
    escolha, cobertura = cl.seleciona_celulas(sedes, pop_mun, pop_uf)
    regs, cels = [], []
    for uf, sel in escolha.items():
        for cel in sel:
            ch = f"{uf}|{cel['id']}"
            regs += [(ch, "lat", repr(cel["lat"])), (ch, "lon", repr(cel["lon"])), (ch, "pop", str(cel["pop"])),
                     (ch, "uf", uf), (ch, "subsistema", cl.UF_SUBSISTEMA.get(uf, "")), (ch, "pop_uf", str(pop_uf.get(uf))),
                     (ch, "cobertura_uf", repr(round(cobertura[uf], 6))), (ch, "celula", cel["id"])]
            cels.append({**cel, "uf": uf})
    base.grava_registros(con, DS_PONTOS_T, vm["vintage_id"], regs + _remocoes(con, DS_PONTOS_T, regs))
    con.commit()
    st["municipios_com_populacao"] = sum(1 for k in sedes if k in pop_mun)
    st["municipios_sedes"] = len(sedes)
    return cels


def _coleta_power(con, pontos, tipo, ds, hoje, prazo, st):
    """Baixa, por ponto, as janelas histórica e recente do POWER. Respeita o prazo (a
    coleta continua na próxima execução) e pausa entre requisições."""
    jan = cl.janelas(hoje)
    ini_hist = cl.PRECIP_INICIO if tipo == "precip" else cl.TEMP_INICIO
    feitos = set()
    for p in pontos:
        if p["id"] in feitos:
            continue
        feitos.add(p["id"])
        for nome_j, (lim, idade) in jan.items():
            if time.time() > prazo:
                st["interrompido_por_prazo"] = True
                return
            ini, fim = (ini_hist, lim) if nome_j == "historico" else (lim, hoje.isoformat())
            url = cl.url_power(tipo, p["lat"], p["lon"], ini, fim)
            res = _baixa_url(con, "NASA", ds, f"{p['id']}_{nome_j}", url, "json", idade, pausa=0.25)
            st[res["status"]] = st.get(res["status"], 0) + 1
            if res["status"] == "falha":
                st.setdefault("falhas", []).append(f"{p['id']}_{nome_j}: {res['detalhe'][:120]}")
                if len(st["falhas"]) > 20:
                    st["interrompido_por_falhas"] = True
                    return


def _serie_ponto(con, ds, pid, parametro, cache):
    """Série diária de um ponto: histórico sobreposto pelo recente. None = ausência."""
    chave = (ds, pid)
    if chave not in cache:
        vh = base.ultima_vintage(con, ds, f"{pid}_historico")
        vr = base.ultima_vintage(con, ds, f"{pid}_recente")
        if not (vh and vr):
            cache[chave] = None
        else:
            dh, _h, _m = cl.le_power(_le_bronze(vh))
            dr, _h, _m = cl.le_power(_le_bronze(vr))
            merged = {}
            for par in set(dh) | set(dr):
                s = dict(dh.get(par, {}))
                s.update({k: v for k, v in dr.get(par, {}).items()})
                merged[par] = s
            cache[chave] = {"dados": merged, "shas": (vh["sha256"], vr["sha256"])}
    x = cache[chave]
    return None if x is None else x["dados"].get(parametro)


def _grava_agregado(con, ds, recurso, manifesto, obs):
    """Registra a vintage de um agregado derivado (manifesto no bronze) e grava as
    observações. Mesmo manifesto (mesmos arquivos de origem) = mesma vintage."""
    corpo = json.dumps(manifesto, ensure_ascii=False, sort_keys=True).encode("utf-8")
    capt = _agora()
    arquivo, sha = base.salva_bronze("derivado", ds, recurso, corpo, "json", capt)
    vid, nova = base.registra_vintage(con, ds, recurso, manifesto.get("origem_url"), capt, None, sha, len(corpo),
                                      "agregacao", arquivo)
    if not nova:
        return 0, 0
    r = base.grava_observacoes(con, ds, vid, obs)
    con.commit()
    return r


def _agrega_precipitacao(con, pontos, st):
    por_bacia = defaultdict(list)
    for p in pontos:
        if p["bacia"]:
            por_bacia[p["bacia"]].append(p)
    cache = {}
    feitas = 0
    for bacia, pts in sorted(por_bacia.items()):
        series, faltam = [], []
        for p in pts:
            s = _serie_ponto(con, DS_POWER_PR, p["id"], "IMERG_PRECTOT", cache)
            if s is None:
                faltam.append(p["id"])
            else:
                series.append((p, s))
        if faltam:
            st.setdefault("bacias_pendentes", []).append(f"{bacia}: {len(faltam)} de {len(pts)} pontos sem as duas janelas")
            continue
        wtot = sum(p["peso"] for p in pts)
        dias_ = sorted(set().union(*(set(s) for _p, s in series)))
        obs = []
        for d in dias_:
            vals = [(s.get(d), p["peso"]) for p, s in series if s.get(d) is not None]
            w = sum(x[1] for x in vals)
            cob = 100.0 * w / wtot if wtot else 0.0
            if cob < 99.9999:
                # cobertura só é guardada quando incompleta: ausência da linha = todos os pontos com dado
                obs.append((f"cobertura_pct.{bacia}", d, cob))
            if cob >= 80.0:
                obs.append((f"precip_mm.{bacia}", d, cl.media_ponderada(vals)))
        manifesto = {"regra": "média ponderada pela área (cos(lat) × passo²) dos pontos com dado; dia publicado só com "
                              "cobertura de ao menos 80% do peso da bacia",
                     "origem_url": cl.POWER, "bacia": bacia,
                     "pontos": [{"id": p["id"], "lat": p["lat"], "lon": p["lon"], "peso": p["peso"],
                                 "poligono": p["bacia_shape"], "vintages": cache[(DS_POWER_PR, p["id"])]["shas"]}
                                for p, _s in series]}
        _grava_agregado(con, DS_CLIMA_PR, f"bacia_{bacia}", manifesto, obs)
        feitas += 1
        cache.clear()
    st["bacias_agregadas"] = feitas


def _agrega_temperatura(con, celulas, st):
    por_uf = defaultdict(list)
    for cel in celulas:
        por_uf[cel["uf"]].append(cel)
    pop_uf = {}
    for ch, campos in _vigentes(con, DS_PONTOS_T).items():
        pop_uf[campos.get("uf")] = int(campos["pop_uf"]) if campos.get("pop_uf", "None") != "None" else None
    cache, uf_series, manif = {}, {}, []
    for uf, cels in sorted(por_uf.items()):
        pars = {}
        ok = True
        for par in ("T2M", "T2M_MAX", "T2M_MIN"):
            ss = []
            for cel in cels:
                s = _serie_ponto(con, DS_POWER_T, cel["id"], par, cache)
                if s is None:
                    ok = False
                    break
                ss.append((cel, s))
            if not ok:
                break
            pars[par] = ss
        if not ok:
            st.setdefault("ufs_pendentes", []).append(uf)
            continue
        wt = sum(cel["pop"] for cel in cels)
        out = {}
        for par, ss in pars.items():
            dias_ = set().union(*(set(s) for _c, s in ss))
            serie = {}
            ncel = {}
            for d in dias_:
                vals = [(s.get(d), cel["pop"]) for cel, s in ss if s.get(d) is not None]
                w = sum(x[1] for x in vals)
                if w >= 0.8 * wt:
                    serie[d] = cl.media_ponderada(vals)
                ncel[d] = len(vals)
            out[par] = serie
            out[f"n_{par}"] = ncel
        uf_series[uf] = out
        manif += [{"uf": uf, "id": cel["id"], "lat": cel["lat"], "lon": cel["lon"], "pop": cel["pop"],
                   "vintages": cache[(DS_POWER_T, cel["id"])]["shas"]} for cel in cels]
    if not uf_series:
        return
    obs = []
    for uf, out in uf_series.items():
        for par, nome_s in (("T2M", "t2m_c"), ("T2M_MAX", "t2m_max_c"), ("T2M_MIN", "t2m_min_c")):
            for d, v in out[par].items():
                if d >= UF_DESDE:
                    obs.append((f"{nome_s}.UF_{uf}", d, v))
    # subsistemas e SIN: média dos estados ponderada pela população (Censo 2022); só com
    # todos os estados do recorte coletados, e dia publicado com cobertura ≥ 90% da população
    grupos = {sm: [uf for uf, s in cl.UF_SUBSISTEMA.items() if s == sm] for sm in SMS}
    grupos["SIN"] = list(cl.UF_SUBSISTEMA)
    for rec, ufs in grupos.items():
        if any(uf not in uf_series for uf in ufs):
            st.setdefault("recortes_pendentes", []).append(rec)
            continue
        ptot = sum(pop_uf.get(uf) or 0 for uf in ufs)
        for par, nome_s in (("T2M", "t2m_c"), ("T2M_MAX", "t2m_max_c"), ("T2M_MIN", "t2m_min_c")):
            dias_ = set().union(*(set(uf_series[uf][par]) for uf in ufs))
            for d in dias_:
                vals = [(uf_series[uf][par][d], pop_uf.get(uf) or 0) for uf in ufs if d in uf_series[uf][par]]
                w = sum(x[1] for x in vals)
                if par == "T2M":
                    obs.append((f"cobertura_pop_pct.{rec}", d, 100.0 * w / ptot if ptot else 0.0))
                    obs.append((f"ufs_com_dado.{rec}", d, float(len(vals))))
                if ptot and w >= 0.9 * ptot:
                    obs.append((f"{nome_s}.{rec}", d, cl.media_ponderada(vals)))
    manifesto = {"regra": "UF: média das células ponderada pela população (Censo 2022) das sedes municipais na célula; "
                          "subsistema e SIN: média das UFs ponderada pela população da UF",
                 "origem_url": cl.POWER, "celulas": manif, "uf_subsistema": cl.UF_SUBSISTEMA}
    _grava_agregado(con, DS_CLIMA_T, "temperatura", manifesto, obs)
    st["ufs_agregadas"] = len(uf_series)


def _coleta_areas(con, st):
    """Carga verificada de um dia por área geoelétrica (34 consultas, uma vez): prova do
    mapeamento estado → subsistema usado na temperatura."""
    import re
    areas = sorted({a for lst in cl.AREAS_CARGA.values() for a in lst} | set(cl.COD_AREA_SUBSISTEMA.values()))
    for a in areas:
        url = URL_AREAS.format(d=DIA_AREAS, a=a)
        res = _baixa_url(con, "ONS", DS_AREAS, a, url, "json", 3650, pausa=0.3)
        v = res.get("vintage")
        if res["status"] == "falha" or not v:
            st.setdefault("falhas", []).append(f"área {a}: {res['detalhe'][:100]}")
            continue
        if _ja_importado(con, v["vintage_id"]):
            continue
        txt = _le_bronze(v).decode("utf-8", "replace")
        vals = [float(x) for x in re.findall(r'"val_cargaglobal":\s*(-?[0-9.]+)', txt)]
        obs = [(f"carga_media_mwmed.{a}", DIA_AREAS, sum(vals) / len(vals))] if vals else []
        obs += [(f"intervalos.{a}", DIA_AREAS, float(len(vals)))]
        base.grava_observacoes(con, DS_AREAS, v["vintage_id"], obs)
        _marca_importado(con, v["vintage_id"], ["cod_areacarga", "val_cargaglobal"])
    con.commit()


def coletar(con, ctx):
    """Coleta e importa. Nunca lança por falha de fonte: a falha fica no status e no
    registro de coletas, e a gold usa o que já está no silver."""
    hoje = ctx.get("hoje") or date.today()
    orc = float(os.environ.get("AGUA_ORCAMENTO_S", ctx.get("agua_orcamento_s", 1800)))
    prazo = time.time() + orc
    status = {"importadas": []}
    fontes = [
        ("ear_ree", DS_EAR_REE, ("CSV",), 2016),
        ("ena_ree", DS_ENA_REE, ("CSV",), 2016),
        ("ear_bacia", DS_EAR_BACIA, ("CSV",), 2000),
        ("ena_bacia", DS_ENA_BACIA, ("CSV",), 2000),
        ("ear_res", DS_EAR_RES, ("PARQUET", "CSV"), 2000),
        ("ena_res", DS_ENA_RES, ("PARQUET", "CSV"), 2000),
        ("hidro_res", DS_HIDRO, ("PARQUET", "CSV"), ANO_MIN_HIDRO),
        ("cadastro", DS_CAD, ("CSV",), 0),
        ("precip_est", DS_PRECIP_EST, ("CSV",), 2020),
        ("bacias_shp", DS_SHP, ("ZIP",), 0),
        ("ear_sm", DS_EAR_SM_CONF, ("CSV",), hoje.year - 1),
        ("ena_sm", DS_ENA_SM_CONF, ("CSV",), hoje.year - 1),
    ]
    for chave, ds, pref, ano_min in fontes:
        if time.time() > prazo:
            status["interrompido_por_prazo"] = chave
            break
        vints = _baixa_pacote_ons(con, chave, ds, hoje, pref, ano_min, status)
        for ano, v in sorted(vints, key=lambda x: x[0]):
            try:
                r = _importa_ons(con, chave, ds, ano, v)
            except Exception as e:  # arquivo fora do esquema: registrado, não vira número
                base.registra_coleta(con, ds, v["recurso"], False, f"importação: {e}")
                con.commit()
                status.setdefault("falhas_importacao", []).append(f"{v['recurso']}: {e}")
                continue
            if r:
                status["importadas"].append(r)
    # dicionários dos conjuntos por subsistema (unidade e MLT; os dados vêm do silver principal)
    for pacote in ("ena-diario-por-subsistema", "ear-diario-por-subsistema"):
        try:
            _baixa_dicionarios(con, ckan.pacote("ONS", pacote), status.setdefault("dicionarios", {"falhas": []}))
        except Exception as e:
            status.setdefault("dicionarios", {"falhas": []})["falhas"].append(f"{pacote}: {e}")
    # precipitação observada 2020 e 2021 → média mensal das estações por bacia (conferência)
    st_clima = {}
    status["clima"] = st_clima
    try:
        _importa_precip_estacoes(con, st_clima)
    except Exception as e:
        st_clima.setdefault("falhas", []).append(f"precipitação por estação: {e}")
    # IBGE
    _baixa_url(con, "IBGE", DS_IBGE_LOC, "Localidades_Brasil_shp", URL_LOC, "zip", 365)
    _baixa_url(con, "IBGE", DS_IBGE_POP, "populacao_municipios_2022", URL_POP_MUN, "json", 365)
    _baixa_url(con, "IBGE", DS_IBGE_POP, "populacao_ufs_2022", URL_POP_UF, "json", 365)
    try:
        _coleta_areas(con, st_clima)
    except Exception as e:
        st_clima.setdefault("falhas", []).append(f"áreas de carga: {e}")
    # pontos e POWER
    try:
        pontos = _pontos_precipitacao(con, st_clima)
        celulas = _celulas_temperatura(con, st_clima)
        st_clima["pontos_precipitacao"] = len({p["id"] for p in pontos})
        st_clima["celulas_temperatura"] = len({x["id"] for x in celulas})
        st_t, st_p = {}, {}
        _coleta_power(con, celulas, "temp", DS_POWER_T, hoje, prazo, st_t)
        _coleta_power(con, pontos, "precip", DS_POWER_PR, hoje, prazo, st_p)
        st_clima["power_temperatura"], st_clima["power_precipitacao"] = st_t, st_p
        _agrega_temperatura(con, celulas, st_clima)
        _agrega_precipitacao(con, pontos, st_clima)
    except Exception as e:
        st_clima.setdefault("falhas", []).append(f"clima: {e}")
    con.commit()
    return status


def _importa_precip_estacoes(con, st):
    vshp = base.ultima_vintage(con, DS_SHP, "Bacias_Hidrograficas_SIN")
    if not vshp:
        return
    loc = cl.localizador(cl.bacias_do_zip(_le_bronze(vshp)))
    for v in ckan.vintages_vigentes(con, DS_PRECIP_EST).values():
        if _ja_importado(con, v["vintage_id"]):
            continue
        obs, resumo = oa.parse_precipitacao_estacoes(oa.linhas_bronze(v["arquivo"], "csv"), loc)
        base.grava_observacoes(con, DS_PRECIP_EST, v["vintage_id"], obs)
        _marca_importado(con, v["vintage_id"], oa.colunas_bronze(v["arquivo"], "csv"),
                         {"estacoes": str(resumo["estacoes"]), "estacoes_em_bacia": str(resumo["estacoes_em_bacia"])})
        st.setdefault("precip_estacoes", []).append({v["recurso"]: resumo})
    con.commit()


# ================================================================ construção: P017 armazenamento

def _ear_subsistemas(con_p):
    mw = {sm: _serie(con_p, DS_EAR_SM, f"ear_mwmes.{sm}") for sm in SMS}
    mx = {sm: _serie(con_p, DS_EAR_SM, f"ear_max_mwmes.{sm}") for sm in SMS}
    pct = {sm: _serie(con_p, DS_EAR_SM, f"ear_pct.{sm}") for sm in SMS}
    dias_ = sorted(set.intersection(*(set(mw[sm]) & set(mx[sm]) for sm in SMS)))
    mw["SIN"] = {d: sum(mw[sm][d] for sm in SMS) for d in dias_}
    mx["SIN"] = {d: sum(mx[sm][d] for sm in SMS) for d in dias_}
    pct["SIN"] = {d: 100.0 * mw["SIN"][d] / mx["SIN"][d] for d in dias_ if mx["SIN"][d] > 0}
    return mw, mx, pct, dias_


def _recortes_ear(con, ds):
    """{nome: {"mw": {}, "max": {}, "pct": {}}} do conjunto por REE ou por bacia."""
    out = defaultdict(lambda: {"mw": {}, "max": {}, "pct": {}})
    for prefixo, k in (("ear_mwmes.", "mw"), ("ear_max_mwmes.", "max"), ("ear_pct.", "pct")):
        for s, vals in _series_glob(con, ds, prefixo + "*").items():
            out[s[len(prefixo):]][k] = vals
    return dict(out)


def _recortes_ena(con, ds):
    out = defaultdict(dict)
    for prefixo, k in (("ena_bruta_mwmed.", "mw"), ("ena_bruta_pct_mlt.", "pct"), ("ena_arm_mwmed.", "arm"),
                       ("ena_arm_pct_mlt.", "arm_pct")):
        for s, vals in _series_glob(con, ds, prefixo + "*").items():
            out[s[len(prefixo):]][k] = vals
    for n, d in out.items():
        d["mlt"] = {k: d["mw"][k] / (d["pct"][k] / 100.0) for k in d.get("mw", {}) if d.get("pct", {}).get(k)}
        d["mlt_arm"] = {k: d["arm"][k] / (d["arm_pct"][k] / 100.0) for k in d.get("arm", {}) if d.get("arm_pct", {}).get(k)}
    return dict(out)


def _resumo_ear_recorte(nome_r, s, dia, ano_ini, extra=None):
    v = s["pct"].get(dia)
    mw = s["mw"].get(dia)
    mx = s["max"].get(dia)
    p10, p50, p90, n, _vs = _bandas_do_dia(s["pct"], dia, ano_ini)
    q10, q50, q90, nm, _ = _bandas_do_dia(s["mw"], dia, ano_ini)
    maxs = [s["max"][f"{a}-{_md(dia)}"] for a in range(ano_ini, int(dia[:4])) if f"{a}-{_md(dia)}" in s["max"]]
    d7, d30 = _dmenos(dia, 7), _dmenos(dia, 30)
    return {
        "nome": nome_r, **(extra or {}),
        "dia": dia if v is not None else None,
        "ear_pct": c.r(v, 2), "ear_mwmes": c.r(mw, 1), "ear_max_mwmes": c.r(mx, 1),
        "sem_armazenamento": bool(mx is not None and mx == 0),
        "variacao_7d_pp": c.r(v - s["pct"][d7], 2) if v is not None and d7 in s["pct"] else None,
        "variacao_30d_pp": c.r(v - s["pct"][d30], 2) if v is not None and d30 in s["pct"] else None,
        "variacao_30d_mwmes": c.r(mw - s["mw"][d30], 1) if mw is not None and d30 in s["mw"] else None,
        "p10": c.r(p10, 2), "p50": c.r(p50, 2), "p90": c.r(p90, 2), "anos_na_base": n,
        "periodo_base": f"{ano_ini}-{int(dia[:4]) - 1}" if n else None,
        "p10_mwmes": c.r(q10, 1), "p50_mwmes": c.r(q50, 1), "p90_mwmes": c.r(q90, 1),
        "faixa": _faixa(v, p10, p90),
        "percentil_na_data": c.r(c.percentil_de(v, _vs), 1) if v is not None and _vs else None,
        "ear_max_base_min_mwmes": c.r(min(maxs), 1) if maxs else None,
        "ear_max_base_max_mwmes": c.r(max(maxs), 1) if maxs else None,
        "capacidade_mudou_na_base": bool(maxs and mx is not None and (max(maxs) - min(maxs) > 0.05 * max(mx, 1e-9)
                                                                        or abs(mx - c.quantil(maxs, 0.5)) > 0.05 * max(mx, 1e-9))),
    }


def _semanal(s, dia, ano_ini, semanas=52):
    """Pequenos múltiplos: um ponto a cada 7 dias nas últimas `semanas`, com a faixa da
    data, em colunas (d, v, p10, p50, p90 de mesmo comprimento) para caber na gold."""
    out = {"d": [], "v": [], "p10": [], "p50": [], "p90": []}
    for i in range(semanas - 1, -1, -1):
        d = _dmenos(dia, 7 * i)
        p10, p50, p90, n, _ = _bandas_do_dia(s["pct"], d, ano_ini)
        for k, v in (("d", d), ("v", c.r(s["pct"].get(d), 1)), ("p10", c.r(p10, 1)), ("p50", c.r(p50, 1)), ("p90", c.r(p90, 1))):
            out[k].append(v)
    return out


def _eventos_capacidade(con, con_p, mx):
    """Mudanças da EAR máxima por subsistema e atribuição a reservatórios (entrada, saída
    ou alteração da capacidade de cada um, na parte própria ou a jusante)."""
    steps = {}
    for s, vals in _series_glob(con, DS_EAR_RES, "earmax_*").items():
        steps[s] = sorted(vals.items())
    atrib = defaultdict(dict)
    pres = defaultdict(list)
    for ch, campos in base.registros_como_estavam_em(con, DS_EAR_RES).items():
        cod, ano = ch.split("|")
        atrib[cod][int(ano)] = campos
        if campos.get("primeiro_dia"):
            pres[cod].append((campos["primeiro_dia"], campos.get("ultimo_dia")))
    nomes = {cod: (max(a.items())[1].get("nome") or cod) for cod, a in atrib.items()}

    def valor_em(serie, d):
        """Valor vigente na data d (último degrau com ref <= d); None se não houver."""
        v = None
        for ref, x in steps.get(serie, []):
            if ref > d:
                break
            v = x
        return v

    def presente(cod, d):
        return any(p0 <= d <= (p1 or p0) for p0, p1 in pres.get(cod, []))

    def sub_de(cod, d, parte):
        a = atrib.get(cod, {}).get(int(d[:4])) or atrib.get(cod, {}).get(int(d[:4]) - 1) or {}
        return a.get("subsistema" if parte == "proprio" else "subsistema_jusante") or None

    eventos = []
    for sm in SMS:
        serie = mx[sm]
        ds_ = sorted(serie)
        for a, b in zip(ds_, ds_[1:]):
            delta = serie[b] - serie[a]
            if abs(delta) <= 0.01:
                continue
            itens = []
            for cod in atrib:
                for parte in ("proprio", "jusante"):
                    s_nome = f"earmax_{parte}.{cod}"
                    if s_nome not in steps:
                        continue
                    va = valor_em(s_nome, a) if presente(cod, a) else None
                    vb = valor_em(s_nome, b) if presente(cod, b) else None
                    sa, sb = sub_de(cod, a, parte), sub_de(cod, b, parte)
                    ca = (va or 0.0) if sa == sm else 0.0
                    cb = (vb or 0.0) if sb == sm else 0.0
                    if abs(cb - ca) > 0.001:
                        tipo = "entrada" if ca == 0 and cb != 0 else ("saida" if cb == 0 and ca != 0 else "alteracao")
                        itens.append({"cod": cod, "nome": nomes.get(cod, cod), "parte": parte, "tipo": tipo,
                                      "antes_mwmes": c.r(ca, 3), "depois_mwmes": c.r(cb, 3), "variacao_mwmes": c.r(cb - ca, 3)})
            atribuido = sum(x["variacao_mwmes"] for x in itens)
            eventos.append({"data": b, "sm": sm, "antes_mwmes": c.r(serie[a], 3), "depois_mwmes": c.r(serie[b], 3),
                            "variacao_mwmes": c.r(delta, 3), "atribuido_mwmes": c.r(atribuido, 3),
                            "residuo_mwmes": c.r(delta - atribuido, 3),
                            "reservatorios": sorted(itens, key=lambda x: -abs(x["variacao_mwmes"]))})
    return sorted(eventos, key=lambda e: (e["data"], e["sm"]))


def _armazenamento(con, con_p, d):
    mw, mx, pct, dias_ = _ear_subsistemas(con_p)
    if not dias_:
        raise RuntimeError("EAR por subsistema ausente no silver principal")
    dia = dias_[-1]
    d["dia_ear"] = dia
    # 1) conferência: percentual publicado × recalculado (MWmês ÷ máxima) em toda a série
    dif_max, n_conf = 0.0, 0
    for sm in SMS:
        for k in dias_:
            if k in pct[sm] and mx[sm][k] > 0:
                dif_max = max(dif_max, abs(pct[sm][k] - 100.0 * mw[sm][k] / mx[sm][k]))
                n_conf += 1
    media_simples = sum(pct[sm][dia] for sm in SMS) / 4.0
    # 2) reconciliação por outros produtos do ONS no mesmo dia: REE, bacia e reservatórios
    ree = _recortes_ear(con, DS_EAR_REE)
    bac = _recortes_ear(con, DS_EAR_BACIA)
    soma_ree = sum(s["mw"].get(dia, 0.0) for s in ree.values()) if ree else None
    soma_bac = sum(s["mw"].get(dia, 0.0) for s in bac.values()) if bac else None
    n_ree_dia = sum(1 for s in ree.values() if dia in s["mw"])
    n_bac_dia = sum(1 for s in bac.values() if dia in s["mw"])
    soma_res = {sm: _serie(con, DS_EAR_RES, f"soma_ear_mwmes.{sm}") for sm in SMS}
    soma_resmax = {sm: _serie(con, DS_EAR_RES, f"soma_earmax_mwmes.{sm}") for sm in SMS}
    # comparação com o subsistema da MESMA captura: nos anos recapturados na família usa-se
    # o arquivo por subsistema baixado junto com os por reservatório; nos demais, o silver
    # principal (arquivos de anos encerrados, que quase não mudam)
    conf_mw = {sm: _serie(con, DS_EAR_SM_CONF, f"ear_mwmes.{sm}") for sm in SMS}
    conf_mx = {sm: _serie(con, DS_EAR_SM_CONF, f"ear_max_mwmes.{sm}") for sm in SMS}
    anos_conf = sorted({k[:4] for sm in SMS for k in conf_mw[sm]})
    ref_mw = {sm: {**mw[sm], **conf_mw[sm]} for sm in SMS}
    ref_mx = {sm: {**mx[sm], **conf_mx[sm]} for sm in SMS}
    # precisão: até 2017 o ONS publica EAR em MWmês inteiros (por reservatório e por
    # subsistema); a soma de ~100 parcelas arredondadas tem desvio-padrão de cerca de
    # 0,29 × √100 ≈ 2,9 MWmês, daí a tolerância de 10 MWmês (≈ 3,4 desvios). Com três casas
    # decimais (desde 2018), 0,05 MWmês.
    inteiro = {}
    for sm in SMS:
        for k, v in mw[sm].items():
            inteiro.setdefault(k[:4], True)
            if abs(v - round(v)) > 1e-9:
                inteiro[k[:4]] = False
    por_ano = defaultdict(lambda: {"dias": 0, "fora": 0, "max": 0.0, "fora_max": 0, "max_max": 0.0})
    for sm in SMS:
        for k, v in soma_res[sm].items():
            if k not in ref_mw[sm]:
                continue
            tol = 10.0 if inteiro.get(k[:4]) else 0.05
            x = por_ano[(k[:4], sm)]
            x["dias"] += 1
            dif = abs(v - ref_mw[sm][k])
            x["max"] = max(x["max"], dif)
            x["fora"] += dif > tol
            if k in soma_resmax[sm] and k in ref_mx[sm]:
                dm = abs(soma_resmax[sm][k] - ref_mx[sm][k])
                x["max_max"] = max(x["max_max"], dm)
                x["fora_max"] += dm > tol
    tabela = [{"ano": int(ano), "sm": sm, "dias": x["dias"], "tolerancia_mwmes": 10.0 if inteiro.get(ano) else 0.05,
               "precisao": "inteiro" if inteiro.get(ano) else "3 casas", "fonte_subsistema": "recaptura" if ano in anos_conf else "silver principal",
               "dias_fora_ear": x["fora"], "max_dif_ear_mwmes": c.r(x["max"], 3),
               "dias_fora_ear_max": x["fora_max"], "max_dif_ear_max_mwmes": c.r(x["max_max"], 3)}
              for (ano, sm), x in sorted(por_ano.items())]
    rec_res = []
    for sm in SMS:
        rec_res.append({"sm": sm, "dia": dia, "soma_reservatorios_mwmes": c.r(soma_res[sm].get(dia), 3),
                        "subsistema_mwmes": c.r(ref_mw[sm].get(dia), 3),
                        "diferenca_mwmes": c.r(soma_res[sm][dia] - ref_mw[sm][dia], 3) if dia in soma_res[sm] and dia in ref_mw[sm] else None,
                        "soma_max_reservatorios_mwmes": c.r(soma_resmax[sm].get(dia), 3),
                        "max_subsistema_mwmes": c.r(ref_mx[sm].get(dia), 3),
                        "fonte_subsistema": "recaptura" if dia[:4] in anos_conf else "silver principal"})
    sin_mesma = sum(ref_mw[sm][dia] for sm in SMS) if all(dia in ref_mw[sm] for sm in SMS) else None
    comparados = sum(x["dias"] for x in tabela)
    fora_tol = sum(x["dias_fora_ear"] for x in tabela)
    d["reconciliacao_ear"] = {
        "dia": dia,
        "pct_publicado_vs_recalculado_max_pp": c.r(dif_max, 5), "pares_conferidos": n_conf,
        "soma_ree_mwmes": c.r(soma_ree, 3), "n_ree": n_ree_dia,
        "soma_bacias_mwmes": c.r(soma_bac, 3), "n_bacias": n_bac_dia,
        "sin_mwmes": c.r(mw["SIN"][dia], 3),
        "sin_mesma_captura_mwmes": c.r(sin_mesma, 3),
        "reservatorios_por_subsistema": rec_res,
        "reservatorios_por_ano": [x for x in tabela if x["dias_fora_ear"] or x["dias_fora_ear_max"]],
        "anos_sem_divergencia": sorted({x["ano"] for x in tabela} - {x["ano"] for x in tabela if x["dias_fora_ear"] or x["dias_fora_ear_max"]}),
        "dias_reservatorios_comparados": comparados, "dias_reservatorios_fora_tolerancia": fora_tol,
        "media_simples_dos_percentuais": c.r(media_simples, 2),
        "diferenca_media_simples_pp": c.r(media_simples - pct["SIN"][dia], 2),
    }
    # 3) resumo por subsistema e SIN
    subs = []
    um_ano = _dmenos(dia, 365)
    for sm in TODOS:
        v, m_, x = pct[sm].get(dia), mw[sm][dia], mx[sm][dia]
        p10, p50, p90, n, vs = _bandas_do_dia(pct[sm], dia, ANO_INI_BACIA)
        q10, q50, q90, _n, _ = _bandas_do_dia(mw[sm], dia, ANO_INI_BACIA)
        subs.append({
            "sm": sm, "nome": c.NOME_SUBMERCADO[sm], "dia": dia,
            "natureza": "CALCULADO" if sm == "SIN" else "OBSERVADO",
            "ear_pct": c.r(v, 2), "ear_mwmes": c.r(m_, 1), "ear_max_mwmes": c.r(x, 1),
            "participacao_capacidade_sin_pct": c.r(100.0 * x / mx["SIN"][dia], 1),
            "participacao_armazenado_sin_pct": c.r(100.0 * m_ / mw["SIN"][dia], 1),
            "variacao_7d_mwmes": c.r(m_ - mw[sm][_dmenos(dia, 7)], 1) if _dmenos(dia, 7) in mw[sm] else None,
            "variacao_30d_mwmes": c.r(m_ - mw[sm][_dmenos(dia, 30)], 1) if _dmenos(dia, 30) in mw[sm] else None,
            "variacao_12m_mwmes": c.r(m_ - mw[sm][um_ano], 1) if um_ano in mw[sm] else None,
            "variacao_30d_pp": c.r(v - pct[sm][_dmenos(dia, 30)], 2) if _dmenos(dia, 30) in pct[sm] else None,
            "p10": c.r(p10, 2), "p50": c.r(p50, 2), "p90": c.r(p90, 2), "anos_na_base": n,
            "periodo_base": f"{ANO_INI_BACIA}-{int(dia[:4]) - 1}",
            "p10_mwmes": c.r(q10, 1), "p50_mwmes": c.r(q50, 1), "p90_mwmes": c.r(q90, 1),
            "faixa": _faixa(v, p10, p90), "percentil_na_data": c.r(c.percentil_de(v, vs), 1),
        })
    d["_ear"] = (mw, mx, pct, dias_)
    # 4) séries: fim de mês (estoque) em MWmês desde 2000 e diária dos últimos 365 dias
    fim_mes = {}
    for k in dias_:
        fim_mes[k[:7]] = k
    mensal = [{"m": m, "d": k, **{sm: c.r(mw[sm][k], 0) for sm in TODOS}, "SIN_max": c.r(mx["SIN"][k], 0)}
              for m, k in sorted(fim_mes.items())]
    ini = _dmenos(dia, 364)
    diaria = [{"d": k, **{sm: c.r(mw[sm][k], 0) for sm in TODOS}} for k in dias_ if k >= ini]
    # 5) capacidade: eventos e atribuição
    eventos = _eventos_capacidade(con, con_p, mx)
    d["_eventos"] = eventos
    cap_anual = []
    for ano in range(int(dias_[0][:4]), int(dia[:4]) + 1):
        k = max((x for x in dias_ if x[:4] == str(ano)), default=None)
        if k:
            cap_anual.append({"ano": ano, "d": k, **{sm: c.r(mx[sm][k], 1) for sm in TODOS}})
    res_evt = [abs(e["residuo_mwmes"]) for e in eventos if e["residuo_mwmes"] is not None]
    d["armazenamento"] = {
        "dia": dia,
        "subsistemas": subs,
        "serie_mensal_mwmes": mensal,
        "serie_diaria_mwmes": diaria,
        "capacidade": {
            "eventos": [{**{k: v for k, v in e.items() if k != "reservatorios"},
                         "reservatorios": e["reservatorios"][:6], "n_reservatorios": len(e["reservatorios"])}
                        for e in eventos],
            "n_eventos": len(eventos),
            "eventos_fechados": sum(1 for x in res_evt if x <= 0.05),
            "maior_residuo_mwmes": c.r(max(res_evt), 3) if res_evt else None,
            "fim_de_ano": cap_anual,
            "variacao_desde_inicio_mwmes": {sm: c.r(mx[sm][dia] - mx[sm][dias_[0]], 1) for sm in TODOS},
            "inicio": dias_[0],
        },
    }
    # 6) REE e bacias
    d["_ree"], d["_bac"] = ree, bac
    lst_ree, lst_bac = [], []
    for n_, s in sorted(ree.items()):
        lst_ree.append({**_resumo_ear_recorte(n_, s, dia, ANO_INI_REE), "semanal": _semanal(s, dia, ANO_INI_REE)})
    for n_, s in sorted(bac.items()):
        lst_bac.append({**_resumo_ear_recorte(n_, s, dia, ANO_INI_BACIA), "semanal": _semanal(s, dia, ANO_INI_BACIA)})
    d["armazenamento"]["ree"] = lst_ree
    d["armazenamento"]["bacias"] = lst_bac
    return d


# ================================================================ construção: P018 afluência

def _ena_subsistemas(con_p):
    out = {}
    for sm in SMS:
        mw = _serie(con_p, DS_ENA_SM, f"ena_bruta_mwmed.{sm}")
        p = _serie(con_p, DS_ENA_SM, f"ena_bruta_pct_mlt.{sm}")
        arm = _serie(con_p, DS_ENA_SM, f"ena_arm_mwmed.{sm}")
        ap = _serie(con_p, DS_ENA_SM, f"ena_arm_pct_mlt.{sm}")
        out[sm] = {"mw": mw, "pct": p, "arm": arm, "arm_pct": ap,
                   "mlt": {k: mw[k] / (p[k] / 100.0) for k in mw if p.get(k)},
                   "mlt_arm": {k: arm[k] / (ap[k] / 100.0) for k in arm if ap.get(k)}}
    dias_ = sorted(set.intersection(*(set(out[sm]["mw"]) & set(out[sm]["mlt"]) for sm in SMS)))
    out["SIN"] = {
        "mw": {k: sum(out[sm]["mw"][k] for sm in SMS) for k in dias_},
        "mlt": {k: sum(out[sm]["mlt"][k] for sm in SMS) for k in dias_},
        "arm": {k: sum(out[sm]["arm"][k] for sm in SMS) for k in dias_ if all(k in out[sm]["arm"] for sm in SMS)},
        "mlt_arm": {k: sum(out[sm]["mlt_arm"][k] for sm in SMS) for k in dias_ if all(k in out[sm]["mlt_arm"] for sm in SMS)},
    }
    out["SIN"]["pct"] = {k: 100.0 * out["SIN"]["mw"][k] / out["SIN"]["mlt"][k] for k in dias_ if out["SIN"]["mlt"][k]}
    return out, dias_


def _ena_janela(s, fim, n=JANELA, chave_mw="mw", chave_mlt="mlt"):
    ks = _dias_janela(fim, n)
    if not all(k in s.get(chave_mw, {}) and k in s.get(chave_mlt, {}) for k in ks):
        return None, None, None
    num = sum(s[chave_mw][k] for k in ks)
    den = sum(s[chave_mlt][k] for k in ks)
    return (100.0 * num / den if den > 0 else None), num, den


def _ena_hist(s, fim, ano_ini):
    vals = []
    for a in range(ano_ini, int(fim[:4])):
        try:
            f = c.d(fim).replace(year=a)
        except ValueError:
            f = c.d(fim).replace(year=a, day=28)
        v, _n, _d = _ena_janela(s, f.isoformat())
        if v is not None:
            vals.append(v)
    return vals


def _resumo_ena(nome_r, s, fim, ano_ini, extra=None):
    v, num, den = _ena_janela(s, fim)
    va, _na, _da = _ena_janela(s, fim, chave_mw="arm", chave_mlt="mlt_arm")
    hist = _ena_hist(s, fim, ano_ini) if v is not None else []
    return {
        "nome": nome_r, **(extra or {}), "dia": fim,
        "pct_mlt_dia": c.r(s.get("pct", {}).get(fim), 1),
        "ena_mwmed_dia": c.r(s.get("mw", {}).get(fim), 1),
        "mlt_mwmed_dia": c.r(s.get("mlt", {}).get(fim), 1),
        "pct_mlt_30d": c.r(v, 1), "ena_30d_soma_mwmed_dia": c.r(num, 1), "mlt_30d_soma_mwmed_dia": c.r(den, 1),
        "pct_mlt_arm_30d": c.r(va, 1),
        "p10_30d": c.r(c.quantil(hist, 0.1), 1), "p50_30d": c.r(c.quantil(hist, 0.5), 1),
        "p90_30d": c.r(c.quantil(hist, 0.9), 1), "anos_na_base_30d": len(hist),
        "periodo_base": f"{ano_ini}-{int(fim[:4]) - 1}" if hist else None,
        "percentil_30d": c.r(c.percentil_de(v, hist), 1) if v is not None and hist else None,
        "faixa_30d": _faixa(v, c.quantil(hist, 0.1), c.quantil(hist, 0.9)) if hist else None,
    }


def _mlt(con, con_p, ena_sm, d):
    """Versão da MLT: mudanças por usina (dentro do mês = revisão da referência; entre
    anos no mesmo mês do calendário = recálculo), e a MLT implícita dos subsistemas."""
    steps = _series_glob(con, DS_ENA_RES, "mlt_mwmed.*")
    cad = base.registros_como_estavam_em(con, DS_CAD)
    atrib_ear = {}
    for ch, campos in base.registros_como_estavam_em(con, DS_EAR_RES).items():
        cod, ano = ch.split("|")
        if int(ano) >= int(atrib_ear.get(cod, ("0", {}))[0]):
            atrib_ear[cod] = (ano, campos)
    nome_de = lambda cod: (cad.get(cod, {}).get("nom_reservatorio") or (atrib_ear.get(cod, ("", {}))[1].get("nome")) or cod)  # noqa: E731
    sm_de = lambda cod: (atrib_ear.get(cod, ("", {}))[1].get("subsistema") or cad.get(cod, {}).get("id_subsistema") or "")  # noqa: E731
    mudancas = []
    por_ano_mes = defaultdict(lambda: {"mudaram": 0, "comparadas": 0})
    for s, vals in steps.items():
        cod = s.split(".", 1)[1]
        itens = sorted((k, v) for k, v in vals.items() if v is not None)
        for (ka, va), (kb, vb) in zip(itens, itens[1:]):
            if va and abs(vb - va) > 1e-6:
                tipo = "virada_de_mes" if kb[8:10] == "01" else "revisao_no_mes"
                mudancas.append({"data": kb, "cod": cod, "nome": nome_de(cod), "sm": sm_de(cod),
                                 "antes": c.r(va, 3), "depois": c.r(vb, 3),
                                 "variacao_pct": c.r(100.0 * (vb / va - 1), 3), "tipo": tipo})
        # mesmo mês do calendário em anos diferentes: MLT vigente no dia 15
        for ano in range(2001, int(d["dia_ena"][:4]) + 1):
            for mes in (1, 7):
                k = f"{ano}-{mes:02d}-15"
                ka = f"{ano - 1}-{mes:02d}-15"
                va, vb = _vigente(itens, ka), _vigente(itens, k)
                if va and vb:
                    x = por_ano_mes[(ano, mes)]
                    x["comparadas"] += 1
                    if abs(vb / va - 1) > 1e-5:
                        x["mudaram"] += 1
    revisoes_no_mes = defaultdict(list)
    for m in mudancas:
        if m["tipo"] == "revisao_no_mes":
            revisoes_no_mes[m["data"]].append(m)
    datas_rev = [{"data": k, "usinas": len(v),
                  "exemplos": sorted(v, key=lambda m: -abs(m["variacao_pct"] or 0))[:5],
                  "variacao_mediana_pct": c.r(c.quantil([m["variacao_pct"] for m in v], 0.5), 3)}
                 for k, v in sorted(revisoes_no_mes.items())]
    tabela_anos = [{"ano": a, "mes": mes, "usinas_comparadas": x["comparadas"], "usinas_com_mlt_diferente": x["mudaram"]}
                   for (a, mes), x in sorted(por_ano_mes.items())]
    # MLT implícita dos subsistemas no dia 15 de janeiro e julho de cada ano
    implicita = []
    for ano in range(2000, int(d["dia_ena"][:4]) + 1):
        for mes in (1, 7):
            k = f"{ano}-{mes:02d}-15"
            if all(k in ena_sm[sm]["mlt"] for sm in SMS):
                implicita.append({"ano": ano, "mes": mes, **{sm: c.r(ena_sm[sm]["mlt"][k], 1) for sm in SMS}})
    # unidade: soma das ENA por reservatório (dicionário: MWmed) × ENA do subsistema
    unid = []
    for sm in SMS:
        soma = _serie(con, DS_ENA_RES, f"soma_ena_bruta_mwmed.{sm}")
        smlt = _serie(con, DS_ENA_RES, f"soma_mlt_mwmed.{sm}")
        # subsistema da mesma captura nos anos recapturados; silver principal nos demais
        cmw = _serie(con, DS_ENA_SM_CONF, f"ena_bruta_mwmed.{sm}")
        cpc = _serie(con, DS_ENA_SM_CONF, f"ena_bruta_pct_mlt.{sm}")
        ref_mw = {**ena_sm[sm]["mw"], **cmw}
        ref_mlt = {**ena_sm[sm]["mlt"], **{k: cmw[k] / (cpc[k] / 100.0) for k in cmw if cpc.get(k)}}
        difs, rel, difm = [], [], []
        for k, v in soma.items():
            e = ref_mw.get(k)
            if e:
                difs.append(abs(v - e))
                rel.append(abs(v - e) / e)
            m = ref_mlt.get(k)
            if m and smlt.get(k):
                difm.append(abs(smlt[k] - m) / m)
        unid.append({"sm": sm, "dias": len(difs),
                     "dias_dentro_0_1pct": sum(1 for x in rel if x <= 0.001),
                     "mediana_dif_mwmed": c.r(c.quantil(difs, 0.5), 3), "max_dif_rel_pct": c.r(100 * max(rel), 3) if rel else None,
                     "mlt_dias": len(difm), "mlt_dias_dentro_0_1pct": sum(1 for x in difm if x <= 0.001),
                     "exemplo": {"dia": d["dia_ena"], "soma_reservatorios_mwmed": c.r(soma.get(d["dia_ena"]), 3),
                                 "subsistema_mwmed": c.r(ref_mw.get(d["dia_ena"]), 3),
                                 "soma_mlt_reservatorios_mwmed": c.r(smlt.get(d["dia_ena"]), 3),
                                 "mlt_implicita_subsistema_mwmed": c.r(ref_mlt.get(d["dia_ena"]), 3)}})
    d["_mlt_mudancas"] = mudancas
    return {"revisoes_no_mes": datas_rev, "anos": tabela_anos, "implicita_subsistemas": implicita,
            "n_mudancas_virada_de_mes": sum(1 for m in mudancas if m["tipo"] == "virada_de_mes"),
            "n_mudancas_no_mes": sum(1 for m in mudancas if m["tipo"] == "revisao_no_mes"),
            "usinas_com_mlt": len(steps), "unidade": unid}


def _vigente(itens, d):
    v = None
    for k, x in itens:
        if k > d:
            break
        v = x
    return v


def _afluencia(con, con_p, d):
    ena_sm, dias_ = _ena_subsistemas(con_p)
    if not dias_:
        raise RuntimeError("ENA por subsistema ausente no silver principal")
    fim = dias_[-1]
    d["dia_ena"] = fim
    d["_ena_sm"] = ena_sm
    subs = [{"sm": sm, **_resumo_ena(c.NOME_SUBMERCADO[sm], ena_sm[sm], fim, ANO_INI_BACIA),
             "natureza": "CALCULADO"} for sm in TODOS]
    # média simples dos percentuais diários (o que NÃO se publica) para o teste de contraste
    ks = _dias_janela(fim)
    d["_ena_media_simples_sin"] = sum(ena_sm["SIN"]["pct"][k] for k in ks) / len(ks)
    ree = _recortes_ena(con, DS_ENA_REE)
    bac = _recortes_ena(con, DS_ENA_BACIA)
    d["_ena_ree"], d["_ena_bac"] = ree, bac
    fim_ree = max((max(s["mw"]) for s in ree.values() if s.get("mw")), default=None)
    fim_bac = max((max(s["mw"]) for s in bac.values() if s.get("mw")), default=None)
    lst_ree = [_resumo_ena(n_, s, fim_ree, ANO_INI_REE) for n_, s in sorted(ree.items())] if fim_ree else []
    lst_bac = [_resumo_ena(n_, s, fim_bac, ANO_INI_BACIA) for n_, s in sorted(bac.items())] if fim_bac else []
    # conferência: soma das bacias × soma dos subsistemas (ENA bruta, mesmo dia)
    conf = None
    if fim_bac:
        sb = sum(s["mw"].get(fim_bac, 0.0) for s in bac.values())
        ss = ena_sm["SIN"]["mw"].get(fim_bac)
        conf = {"dia": fim_bac, "soma_bacias_mwmed": c.r(sb, 3), "sin_mwmed": c.r(ss, 3),
                "diferenca_mwmed": c.r(sb - ss, 3) if ss is not None else None}
    # série de 30 dias (% MLT, razão de somas) dos últimos 18 meses, a cada 7 dias
    serie = []
    for i in range(77, -1, -1):
        k = _dmenos(fim, 7 * i)
        serie.append({"d": k, **{sm: c.r(_ena_janela(ena_sm[sm], k)[0], 1) for sm in TODOS}})
    d["afluencia"] = {
        "dia": fim, "subsistemas": subs, "ree": lst_ree, "bacias": lst_bac, "dia_ree": fim_ree, "dia_bacias": fim_bac,
        "serie_30d_semanal": serie, "conferencia_bacias_sin": conf,
        "mlt": _mlt(con, con_p, ena_sm, d),
    }
    return d


# ================================================================ construção: P019 clima

def _mensal_de_diario(serie, soma=True):
    """{AAAA-MM: valor} só para meses completos (todos os dias com dado)."""
    por = defaultdict(list)
    for k, v in serie.items():
        por[k[:7]].append(v)
    out = {}
    for m, vs in por.items():
        n = calendar.monthrange(int(m[:4]), int(m[5:7]))[1]
        if len(vs) == n:
            out[m] = sum(vs) if soma else sum(vs) / n
    return out


def _clima(con, d):
    pr = _series_glob(con, DS_CLIMA_PR, "precip_mm.*")
    cob = _series_glob(con, DS_CLIMA_PR, "cobertura_pct.*")
    t = _series_glob(con, DS_CLIMA_T, "t2m*")
    if not pr and not t:
        raise RuntimeError("clima ausente no silver (coleta do POWER ainda não concluída)")
    hoje = c.agora_date()
    corte_final = (hoje - timedelta(days=110)).isoformat()   # IMERG Final: ~3,5 meses de atraso
    corte_merra = (hoje - timedelta(days=60)).isoformat()    # MERRA-2: cerca de um mês; margem de 60 dias
    a0, a1 = BASE_CLIMA
    bacias = []
    mensal_csv = []
    ena_bac = d.get("_ena_bac", {})
    for s_nome, serie in sorted(pr.items()):
        b = s_nome.split(".", 1)[1]
        mens = _mensal_de_diario(serie)
        clim = defaultdict(list)
        for m, v in mens.items():
            if a0 <= int(m[:4]) <= a1:
                clim[m[5:7]].append(v)
        meses = sorted(mens)
        # último mês completo
        ult = meses[-1] if meses else None
        linhas = []
        for m in meses:
            cm = clim.get(m[5:7], [])
            media = sum(cm) / len(cm) if cm else None
            pre = 1 if f"{m}-{calendar.monthrange(int(m[:4]), int(m[5:7]))[1]:02d}" > corte_final else 0
            mensal_csv.append([m, b, mens[m], media, c.quantil(cm, 0.1), c.quantil(cm, 0.9), len(cm),
                               100.0 * (mens[m] / media - 1) if media else None, pre])
            linhas.append({"m": m, "mm": c.r(mens[m], 1), "media": c.r(media, 1), "p10": c.r(c.quantil(cm, 0.1), 1),
                           "p90": c.r(c.quantil(cm, 0.9), 1), "anomalia_pct": c.r(100.0 * (mens[m] / media - 1), 1) if media else None,
                           "preliminar": bool(pre)})
        # últimos 30 dias com dado × mesma janela nos anos da base
        fim = max(serie)
        ks = _dias_janela(fim)
        tot = sum(serie[k] for k in ks) if all(k in serie for k in ks) else None
        hist = []
        for a in range(a0, a1 + 1):
            try:
                f = c.d(fim).replace(year=a)
            except ValueError:
                f = c.d(fim).replace(year=a, day=28)
            kk = _dias_janela(f.isoformat())
            if all(k in serie for k in kk):
                hist.append(sum(serie[k] for k in kk))
        # associação mensal chuva × ENA da bacia (razão de somas no mês), 2001 a 2025
        assoc = None
        e = ena_bac.get(b)
        if e and e.get("mw"):
            ena_m = {}
            por = defaultdict(lambda: [0.0, 0.0, 0])
            for k, v in e["mw"].items():
                if k in e["mlt"]:
                    x = por[k[:7]]
                    x[0] += v
                    x[1] += e["mlt"][k]
                    x[2] += 1
            for m, (nn, dd, n) in por.items():
                if n == calendar.monthrange(int(m[:4]), int(m[5:7]))[1] and dd > 0:
                    ena_m[m] = 100.0 * nn / dd
            ms = [m for m in meses if a0 <= int(m[:4]) <= a1]
            anom = {m: 100.0 * (mens[m] / (sum(clim[m[5:7]]) / len(clim[m[5:7]])) - 1) for m in ms if clim.get(m[5:7])}
            r0, n0 = _pearson([anom.get(m) for m in ms], [ena_m.get(m) for m in ms])
            prox = {m: _mes_seguinte(m) for m in ms}
            r1, n1 = _pearson([anom.get(m) for m in ms], [ena_m.get(prox[m]) for m in ms])
            assoc = {"r_mesmo_mes": c.r(r0, 2), "n_mesmo_mes": n0, "r_mes_seguinte": c.r(r1, 2), "n_mes_seguinte": n1,
                     "periodo": f"{a0}-{a1}"}
        bacias.append({
            "bacia": b, "dia": fim, "ultimo_mes_completo": ult,
            "mm_30d": c.r(tot, 1), "media_30d_base": c.r(sum(hist) / len(hist), 1) if hist else None,
            "p10_30d": c.r(c.quantil(hist, 0.1), 1), "p90_30d": c.r(c.quantil(hist, 0.9), 1), "anos_base_30d": len(hist),
            "anomalia_30d_pct": c.r(100.0 * (tot / (sum(hist) / len(hist)) - 1), 1) if tot is not None and hist and sum(hist) > 0 else None,
            "percentil_30d": c.r(c.percentil_de(tot, hist), 1) if tot is not None and hist else None,
            "preliminar_30d": fim > corte_final,
            "cobertura_media_pct": c.r(c.media([cob.get(f"cobertura_pct.{b}", {}).get(k) for k in ks]), 1),
            "mensal": linhas[-24:], "associacao_ena": assoc,
        })
    d["_precip"] = pr
    # temperatura
    temp = []
    t2m = {k.split(".", 1)[1]: v for k, v in t.items() if k.startswith("t2m_c.")}
    tmax = {k.split(".", 1)[1]: v for k, v in t.items() if k.startswith("t2m_max_c.")}
    tmin = {k.split(".", 1)[1]: v for k, v in t.items() if k.startswith("t2m_min_c.")}
    for rec in TODOS:
        s = t2m.get(rec)
        if not s:
            continue
        fim = max(s)
        ks = _dias_janela(fim)
        m30 = sum(s[k] for k in ks) / len(ks) if all(k in s for k in ks) else None
        hist = []
        for a in range(a0, a1 + 1):
            try:
                f = c.d(fim).replace(year=a)
            except ValueError:
                f = c.d(fim).replace(year=a, day=28)
            kk = _dias_janela(f.isoformat())
            if all(k in s for k in kk):
                hist.append(sum(s[k] for k in kk) / len(kk))
        mens = _mensal_de_diario(s, soma=False)
        clim = defaultdict(list)
        for m, v in mens.items():
            if a0 <= int(m[:4]) <= a1:
                clim[m[5:7]].append(v)
        ms = sorted(mens)[-24:]
        ini = _dmenos(fim, 119)
        diaria = []
        for k in sorted(x for x in s if x >= ini):
            vs = [s.get(f"{a}-{_md(k)}") for a in range(a0, a1 + 1)]
            vs = [v for v in vs if v is not None]
            diaria.append({"d": k, "t": c.r(s[k], 1), "tmax": c.r(tmax.get(rec, {}).get(k), 1),
                           "tmin": c.r(tmin.get(rec, {}).get(k), 1), "p10": c.r(c.quantil(vs, 0.1), 1),
                           "p50": c.r(c.quantil(vs, 0.5), 1), "p90": c.r(c.quantil(vs, 0.9), 1)})
        temp.append({
            "recorte": rec, "nome": c.NOME_SUBMERCADO[rec], "dia": fim,
            "media_30d_c": c.r(m30, 2), "media_30d_base_c": c.r(sum(hist) / len(hist), 2) if hist else None,
            "anomalia_30d_c": c.r(m30 - sum(hist) / len(hist), 2) if m30 is not None and hist else None,
            "p10_30d_c": c.r(c.quantil(hist, 0.1), 2), "p90_30d_c": c.r(c.quantil(hist, 0.9), 2), "anos_base": len(hist),
            "percentil_30d": c.r(c.percentil_de(m30, hist), 1) if m30 is not None and hist else None,
            "preliminar_30d": fim > corte_merra,
            "mensal": [{"m": m, "t": c.r(mens[m], 2),
                        "media": c.r(sum(clim[m[5:7]]) / len(clim[m[5:7]]), 2) if clim.get(m[5:7]) else None,
                        "anomalia_c": c.r(mens[m] - sum(clim[m[5:7]]) / len(clim[m[5:7]]), 2) if clim.get(m[5:7]) else None}
                       for m in ms],
            "diaria": diaria,
        })
    d["_temp"] = (t2m, tmax, tmin)
    d["_corte_final"], d["_corte_merra"] = corte_final, corte_merra
    d["_mensal_precip_csv"] = mensal_csv
    # validação: IMERG × estações (2020 e 2021)
    val = []
    est = _series_glob(con, DS_PRECIP_EST, "precip_estacoes_mm_mes.*")
    nest = _series_glob(con, DS_PRECIP_EST, "n_estacoes.*")
    todas_x, todas_y = [], []
    for s_nome, vals in sorted(est.items()):
        b = s_nome.split(".", 1)[1]
        mens = _mensal_de_diario(pr.get(f"precip_mm.{b}", {}))
        pares = [(mens[m], v, nest.get(f"n_estacoes.{b}", {}).get(m)) for m, v in sorted(vals.items()) if m in mens]
        if not pares:
            continue
        xs, ys = [p[0] for p in pares], [p[1] for p in pares]
        todas_x += xs
        todas_y += ys
        r_, n_ = _pearson(xs, ys)
        val.append({"bacia": b, "meses": len(pares), "estacoes_mediana": c.r(c.quantil([p[2] for p in pares if p[2]], 0.5), 0),
                    "imerg_mm": c.r(sum(xs), 1), "estacoes_mm": c.r(sum(ys), 1),
                    "vies_pct": c.r(100.0 * (sum(xs) / sum(ys) - 1), 1) if sum(ys) > 0 else None,
                    "correlacao": c.r(r_, 2)})
    rg, ng = _pearson(todas_x, todas_y)
    d["_validacao"] = {"bacias": val, "correlacao_geral": c.r(rg, 2), "pares": ng,
                       "vies_geral_pct": c.r(100.0 * (sum(todas_x) / sum(todas_y) - 1), 1) if todas_y and sum(todas_y) > 0 else None}
    # cobertura espacial
    pts = _vigentes(con, DS_PONTOS_PR)
    por_b = defaultdict(lambda: {"pontos": 0, "passos": set(), "poligonos": set(), "peso": 0.0})
    for ch, campos in pts.items():
        b = campos.get("bacia")
        if not b:
            continue
        x = por_b[b]
        x["pontos"] += 1
        x["passos"].add(float(campos["passo"]))
        x["poligonos"].add(ch.split("|")[0])
        x["peso"] += float(campos["peso"])
    cels = _vigentes(con, DS_PONTOS_T)
    por_uf = defaultdict(lambda: {"celulas": 0, "pop": 0, "pop_uf": None, "cobertura": None, "sm": None})
    for ch, campos in cels.items():
        x = por_uf[campos["uf"]]
        x["celulas"] += 1
        x["pop"] += int(campos["pop"])
        x["pop_uf"] = int(campos["pop_uf"]) if campos.get("pop_uf") not in (None, "None") else None
        x["cobertura"] = float(campos["cobertura_uf"])
        x["sm"] = campos.get("subsistema")
    d["_pontos"] = (pts, cels)
    d["dias_ref_pr"] = max((max(v) for v in pr.values() if v), default=None)
    d["dias_ref_t"] = max((max(v) for k, v in t.items() if v and k.startswith("t2m_c.")), default=None)
    d["clima"] = {
        "precipitacao_bacias": bacias,
        "temperatura": temp,
        "validacao_estacoes": d["_validacao"],
        "cobertura_precipitacao": [{"bacia": b, "pontos": x["pontos"], "passos_grau": sorted(x["passos"]),
                                    "poligonos": sorted(x["poligonos"])} for b, x in sorted(por_b.items())],
        "cobertura_temperatura": [{"uf": uf, "subsistema": x["sm"], "celulas": x["celulas"], "populacao_uf": x["pop_uf"],
                                   "populacao_nas_celulas": x["pop"], "cobertura_pct": c.r(100 * x["cobertura"], 1)}
                                  for uf, x in sorted(por_uf.items())],
        "totais": {"pontos_precipitacao": len({v["ponto"] for v in pts.values()}), "celulas_temperatura": len({v["celula"] for v in cels.values()})},
        "corte_imerg_final": corte_final, "corte_merra2": corte_merra,
        "base_climatologica": f"{a0}-{a1}",
        "separacao": {
            "observacao": "Precipitação medida em estações (ONS, 2020 e 2021) usada só para conferir a estimativa por satélite.",
            "estimativa": "Precipitação IMERG (satélite calibrado por pluviômetros; versão Late nos últimos meses, sem calibração) e temperatura MERRA-2/GEOS-IT (reanálise).",
            "previsao": "Não integrada: nenhuma previsão meteorológica é publicada nesta página.",
            "cenario": "Não integrado: nenhum cenário climático é publicado nesta página.",
        },
    }
    return d


def _mes_seguinte(m):
    a, mm = int(m[:4]), int(m[5:7])
    return f"{a + (mm == 12)}-{(mm % 12) + 1:02d}"


# ================================================================ construção: P020 reservatórios e balanço

def _reservatorios(con, con_p, d):
    q = {}
    for campo in oa.CAMPOS_HIDRO:
        for s, vals in _series_glob(con, DS_HIDRO, f"{campo}.*").items():
            q.setdefault(s.split(".", 1)[1], {})[campo] = vals
    if not q:
        raise RuntimeError("dados hidráulicos ausentes no silver")
    atrib = base.registros_como_estavam_em(con, DS_HIDRO)
    cad = base.registros_como_estavam_em(con, DS_CAD)
    cad_por_resid = {v.get("res_id"): k for k, v in cad.items() if v.get("res_id")}
    # fim da janela: último dia em que ao menos 90% dos reservatórios com volume têm volume e vazões
    com_vol = [rid for rid, x in q.items() if x.get("vol_util_pct")]
    contagem = defaultdict(int)
    for rid in com_vol:
        x = q[rid]
        for k in x["vol_util_pct"]:
            if k in x.get("q_afluente", {}) and k in x.get("q_defluente", {}):
                contagem[k] += 1
    dias_ok = sorted(k for k, n in contagem.items() if n >= 0.9 * len(com_vol))
    if not dias_ok:
        raise RuntimeError("sem dia com dados hidráulicos completos")
    fim = dias_ok[-1]
    janela = _dias_janela(fim)
    d0 = _dmenos(janela[0], 1)
    lista, diario_csv = [], []
    ini_csv = _dmenos(fim, 364)
    nao_casados = []
    for rid, x in sorted(q.items()):
        at = atrib.get(rid, {})
        cod = at.get("cod_usina") or None
        ccad = cad.get(cod) if cod and cod in cad else (cad.get(cad_por_resid.get(rid)) if rid in cad_por_resid else None)
        if ccad is None:
            nao_casados.append(rid)
        vut = oa.num((ccad or {}).get("val_volutiltot"))
        vol = x.get("vol_util_pct", {})
        tem_vol = bool(vut and vut > 0 and vol)
        # resíduo diário (hm³) em todo o período do silver e fração dentro da tolerância de arredondamento
        tol = (0.0001 * vut + 0.002) if tem_vol else None
        dentro_tol, n_res = 0, 0
        residuos = {}
        if tem_vol:
            for k in sorted(vol):
                ka = _dmenos(k, 1)
                if ka in vol and k in x.get("q_afluente", {}) and k in x.get("q_defluente", {}):
                    dv = (vol[k] - vol[ka]) / 100.0 * vut
                    r_ = dv - (x["q_afluente"][k] - x["q_defluente"][k]) * 0.0864
                    residuos[k] = (dv, r_)
                    n_res += 1
                    dentro_tol += abs(r_) <= tol
        # janela de 30 dias
        comp = {}
        completos = all(k in x.get("q_afluente", {}) and k in x.get("q_defluente", {}) for k in janela)
        for campo in ("q_afluente", "q_defluente", "q_turbinada", "q_vertida", "q_outras", "q_transferida",
                      "q_evaporacao", "q_natural", "q_incremental"):
            vals = [x.get(campo, {}).get(k) for k in janela]
            n_ = sum(1 for v in vals if v is not None)
            # soma só com os 30 dias informados: parcial não vira total, ausência não vira zero
            comp[campo] = sum(v * 0.0864 for v in vals) if completos and n_ == JANELA else None
            comp[f"n_{campo}"] = n_
        dv_obs = ((vol[fim] - vol[d0]) / 100.0 * vut) if tem_vol and fim in vol and d0 in vol else None
        balanco_ok = dv_obs is not None and completos
        defl_disc = None
        if comp["q_defluente"] is not None and comp["q_turbinada"] is not None and comp["q_vertida"] is not None:
            # o que a defluência publicada tem além das parcelas discriminadas (outras estruturas
            # só entram quando informadas nos 30 dias; se não, ficam dentro do não discriminado)
            defl_disc = comp["q_defluente"] - comp["q_turbinada"] - comp["q_vertida"] - (comp["q_outras"] or 0.0)
        residuo = dv_obs - (comp["q_afluente"] - comp["q_defluente"]) if balanco_ok else None
        residuo_t = (residuo + comp["q_transferida"]) if residuo is not None and comp["q_transferida"] is not None else None
        item = {
            "id": rid, "cod": cod, "nome": at.get("nome") or rid, "subsistema": at.get("subsistema"),
            "bacia": at.get("bacia"), "ree": at.get("ree"), "tipo": at.get("tipo"),
            "usina": (ccad or {}).get("nom_usina"), "rio": (ccad or {}).get("nom_rio"),
            "vol_util_total_hm3": c.r(vut, 2), "vol_util_pct_fim": c.r(vol.get(fim), 2),
            "vol_util_pct_inicio": c.r(vol.get(d0), 2),
            "dv_obs_hm3": c.r(dv_obs, 2),
            "afluencia_hm3": c.r(comp["q_afluente"], 2), "defluencia_hm3": c.r(comp["q_defluente"], 2),
            "turbinado_hm3": c.r(comp["q_turbinada"], 2), "vertido_hm3": c.r(comp["q_vertida"], 2),
            "outras_estruturas_hm3": c.r(comp["q_outras"], 2), "defluencia_nao_discriminada_hm3": c.r(defl_disc, 2),
            "transferido_hm3": c.r(comp["q_transferida"], 2),
            "evaporacao_hm3": c.r(comp["q_evaporacao"], 2),
            "natural_hm3": c.r(comp["q_natural"], 2),
            "residuo_hm3": c.r(residuo, 2), "residuo_com_transferencia_hm3": c.r(residuo_t, 2),
            "tolerancia_dia_hm3": c.r(tol, 3),
            "dias_residuo_dentro_tolerancia_pct": c.r(100.0 * dentro_tol / n_res, 1) if n_res else None,
            "dias_residuo_avaliados": n_res,
            "balanco_calculado": balanco_ok,
            "motivo_sem_balanco": None if balanco_ok else (
                "sem volume útil no cadastro" if not tem_vol else "dia sem vazão ou volume na janela"),
        }
        lista.append(item)
        if tem_vol:
            for k in sorted(vol):
                if k < ini_csv:
                    continue
                dv, r_ = residuos.get(k, (None, None))
                diario_csv.append([k, rid, vol.get(k), dv] + [x.get(f, {}).get(k) for f in (
                    "q_afluente", "q_defluente", "q_turbinada", "q_vertida", "q_outras", "q_transferida",
                    "q_evaporacao", "q_natural", "q_incremental")] + [r_])
    d["_res_lista"], d["_res_diario_csv"], d["_res_fim"], d["_res_q"] = lista, diario_csv, fim, q
    # decomposição da variação da EAR por reservatório (MWmês), janela de 30 dias até o dia da EAR
    mw = d["_ear"][0]
    dia_ear = d["dia_ear"]
    ini_ear = _dmenos(dia_ear, JANELA)
    ep = _series_glob(con, DS_EAR_RES, "ear_proprio.*", desde=ini_ear)
    ej = _series_glob(con, DS_EAR_RES, "ear_jusante.*", desde=ini_ear)
    atr_ear = {}
    for ch, campos in base.registros_como_estavam_em(con, DS_EAR_RES).items():
        cod, ano = ch.split("|")
        if int(ano) == int(dia_ear[:4]):
            atr_ear[cod] = campos
    contrib = defaultdict(list)
    for s, vals in ep.items():
        cod = s.split(".", 1)[1]
        a = atr_ear.get(cod, {})
        if dia_ear in vals and ini_ear in vals and a.get("subsistema"):
            contrib[a["subsistema"]].append({"cod": cod, "nome": a.get("nome"), "parte": "proprio",
                                             "delta_mwmes": vals[dia_ear] - vals[ini_ear]})
    for s, vals in ej.items():
        cod = s.split(".", 1)[1]
        a = atr_ear.get(cod, {})
        if dia_ear in vals and ini_ear in vals and a.get("subsistema_jusante"):
            dlt = vals[dia_ear] - vals[ini_ear]
            if abs(dlt) > 0:
                contrib[a["subsistema_jusante"]].append({"cod": cod, "nome": a.get("nome"), "parte": "jusante",
                                                         "delta_mwmes": dlt})
    ena_sm = d["_ena_sm"]
    bal = {sm: _serie(con_p, DS_BAL, f"hidraulica.{sm}", desde=ini_ear) for sm in SMS}
    decomp = []
    for sm in SMS:
        itens = contrib.get(sm, [])
        soma = sum(x["delta_mwmes"] for x in itens)
        dsm = mw[sm][dia_ear] - mw[sm][ini_ear] if ini_ear in mw[sm] else None
        ks = [k for k in _dias_janela(dia_ear) if k in ena_sm[sm]["mw"]]
        hs = [v for k, v in bal[sm].items() if ini_ear < k[:10] <= dia_ear]
        decomp.append({
            "sm": sm, "inicio": ini_ear, "fim": dia_ear,
            "delta_ear_mwmes": c.r(dsm, 1), "soma_reservatorios_mwmes": c.r(soma, 1),
            "residuo_mwmes": c.r(dsm - soma, 3) if dsm is not None else None,
            "n_reservatorios": len(itens),
            "maiores_quedas": [{**x, "delta_mwmes": c.r(x["delta_mwmes"], 1)} for x in sorted(itens, key=lambda x: x["delta_mwmes"])[:5] if x["delta_mwmes"] < 0],
            "maiores_altas": [{**x, "delta_mwmes": c.r(x["delta_mwmes"], 1)} for x in sorted(itens, key=lambda x: -x["delta_mwmes"])[:5] if x["delta_mwmes"] > 0],
            "contexto": {
                "ena_bruta_media_mwmed": c.r(sum(ena_sm[sm]["mw"][k] for k in ks) / len(ks), 1) if ks else None,
                "ena_armazenavel_media_mwmed": c.r(c.media([ena_sm[sm]["arm"].get(k) for k in ks]), 1) if ks else None,
                "geracao_hidraulica_media_mwmed": c.r(sum(hs) / len(hs), 1) if len(hs) >= 24 * 28 else None,
                "horas_geracao": len(hs),
                "comparavel_com_delta_ear": False,
            },
        })
    # séries diárias (90 dias) dos 10 reservatórios de maior volume útil
    top = sorted((x for x in lista if x["vol_util_total_hm3"]), key=lambda x: -x["vol_util_total_hm3"])[:10]
    ini90 = _dmenos(fim, 89)
    series = []
    for x in top:
        qq = q[x["id"]]
        ks = [k for k in sorted(qq["vol_util_pct"]) if ini90 <= k <= fim]
        series.append({"id": x["id"], "nome": x["nome"], "d": ks,
                       "vol": [c.r(qq["vol_util_pct"].get(k), 2) for k in ks],
                       "afl": [c.r(qq.get("q_afluente", {}).get(k), 0) for k in ks],
                       "defl": [c.r(qq.get("q_defluente", {}).get(k), 0) for k in ks],
                       "turb": [c.r(qq.get("q_turbinada", {}).get(k), 0) for k in ks],
                       "vert": [c.r(qq.get("q_vertida", {}).get(k), 0) for k in ks]})
    calc = [x for x in lista if x["balanco_calculado"]]
    fecha = [x for x in calc if x["dias_residuo_dentro_tolerancia_pct"] is not None and x["dias_residuo_dentro_tolerancia_pct"] >= 95]
    d["reservatorios"] = {
        "inicio": janela[0], "fim": fim, "volume_inicial_em": d0,
        "lista": [{k: v for k, v in x.items() if k not in CAMPOS_SO_CSV}
                  for x in sorted(lista, key=lambda x: -(x["vol_util_total_hm3"] or 0)) if x["vol_util_total_hm3"]],
        "n_sem_volume_util": sum(1 for x in lista if not x["vol_util_total_hm3"]),
        "n_reservatorios": len(lista), "n_com_balanco": len(calc),
        "n_fecham_por_construcao": len(fecha),
        "sem_cadastro": nao_casados,
        "decomposicao_ear": decomp,
        "series_principais": series,
    }
    return d


# ================================================================ proveniência, evidências e CSVs

def _prov(indicador, natureza, fonte, unidade, frequencia, periodo, snapshot, limitacoes, formula=None,
          transformacoes=(), download=None, notas=None):
    return c.proveniencia(indicador=indicador, natureza=natureza, fonte=fonte, unidade=unidade, frequencia=frequencia,
                          periodo=periodo, cobertura=periodo, capturado_em=c.ultima_captura(snapshot), snapshot=snapshot,
                          limitacoes=limitacoes, formula=formula, transformacoes=transformacoes, download=download,
                          notas_fonte=notas)


def _fonte_ons(chave, titulo, recurso):
    pac, dir_, pref = oa.PACOTES[chave]
    return {"orgao": "ONS", "dataset": titulo, "recurso": recurso, "url_dataset": f"https://dados.ons.org.br/dataset/{pac}",
            "url_primaria": f"{oa.S3}{dir_}/", "licenca": c.LICENCA_ONS}


# campos que ficam só no CSV de reservatórios (a gold leva o essencial para a página)
CAMPOS_SO_CSV = ("usina", "rio", "vol_util_pct_inicio", "tolerancia_dia_hm3", "evaporacao_hm3", "motivo_sem_balanco", "cod")

LIM_ONS = ("O ONS informa que os dados fazem parte de um processo de consistência recorrente e podem ser atualizados "
           "após a publicação; revisões entram como novas vintages.")


def _escreve(d, nome, cab, linhas):
    return base.escreve_csv(nome, cab, linhas, destino=d.get("destino_csv"))


def _csvs(d):
    downloads = []
    # temperatura por subsistema (clima_diario.csv) e por UF
    t2m, tmax, tmin = d.get("_temp", ({}, {}, {}))
    if t2m:
        cob = d.get("_temp_cob", {})
        linhas = []
        for rec in TODOS:
            s = t2m.get(rec, {})
            for k in sorted(s):
                if k < cl.TEMP_INICIO:
                    continue
                pre = 1 if k > d["_corte_merra"] else 0
                linhas.append([k, rec, s[k], tmax.get(rec, {}).get(k), tmin.get(rec, {}).get(k),
                               cob.get(f"cobertura_pop_pct.{rec}", {}).get(k), _int(cob.get(f"ufs_com_dado.{rec}", {}).get(k)),
                               "GEOS-IT ou MERRA-2 (POWER)" if pre else "MERRA-2 (POWER)", pre])
        _escreve(d, "clima_diario.csv", ["data", "recorte", "temp_media_c", "temp_max_c", "temp_min_c", "cobertura_pop_pct",
                                         "ufs_com_dado", "fonte_versao", "preliminar"], sorted(linhas))
        downloads.append({"rotulo": "Temperatura diária por subsistema e SIN (CSV)", "url": "/energia/series/clima_diario.csv"})
        pop = {}
        for campos in d["_pontos"][1].values():
            pop[campos["uf"]] = campos.get("pop_uf")
        linhas = []
        ncel = d.get("_temp_ncel", {})
        for rec, s in t2m.items():
            if not rec.startswith("UF_"):
                continue
            uf = rec[3:]
            for k in sorted(s):
                if k >= "2019-01-01":
                    linhas.append([k, uf, cl.UF_SUBSISTEMA.get(uf), s[k], tmax.get(rec, {}).get(k), tmin.get(rec, {}).get(k),
                                   _int(ncel.get(f"n_celulas.{rec}", {}).get(k)), pop.get(uf)])
        _escreve(d, "agua_temperatura_uf_diario.csv", ["data", "uf", "subsistema", "temp_media_c", "temp_max_c", "temp_min_c",
                                                       "celulas_com_dado", "populacao_uf"], sorted(linhas))
        downloads.append({"rotulo": "Temperatura diária por UF, desde 2019 (CSV)", "url": "/energia/series/agua_temperatura_uf_diario.csv"})
    pr = d.get("_precip", {})
    if pr:
        cobp = d.get("_precip_cob", {})
        linhas = []
        for s_nome, serie in pr.items():
            b = s_nome.split(".", 1)[1]
            for k in sorted(serie):
                if k >= "2016-01-01":
                    linhas.append([k, b, serie[k], cobp.get(f"cobertura_pct.{b}", {}).get(k), 1 if k > d["_corte_final"] else 0])
        _escreve(d, "agua_precipitacao_bacias_diario.csv", ["data", "bacia", "precip_mm", "cobertura_pct", "preliminar"], sorted(linhas))
        _escreve(d, "agua_precipitacao_bacias_mensal.csv", ["mes", "bacia", "precip_mm", "media_2001_2025_mm", "p10_mm", "p90_mm",
                                                            "anos_base", "anomalia_pct", "preliminar"], sorted(d["_mensal_precip_csv"]))
        downloads += [{"rotulo": "Precipitação diária por bacia, desde 2016 (CSV)", "url": "/energia/series/agua_precipitacao_bacias_diario.csv"},
                      {"rotulo": "Precipitação mensal por bacia e climatologia (CSV)", "url": "/energia/series/agua_precipitacao_bacias_mensal.csv"}]
    if d.get("_pontos"):
        pts, cels = d["_pontos"]
        linhas = []
        for ch, x in sorted(pts.items()):
            linhas.append(["precipitacao", x["ponto"], x["lat"], x["lon"], x.get("bacia"), ch.split("|")[0], x["passo"], x["peso"], ""])
        for ch, x in sorted(cels.items()):
            linhas.append(["temperatura", x["celula"], x["lat"], x["lon"], x["uf"], x.get("subsistema"), "", x["pop"], x.get("pop_uf")])
        _escreve(d, "agua_clima_pontos.csv", ["tipo", "id", "lat", "lon", "recorte", "subrecorte", "passo_grau", "peso",
                                              "populacao_recorte"], linhas)
        downloads.append({"rotulo": "Manifesto espacial dos pontos de clima (CSV)", "url": "/energia/series/agua_clima_pontos.csv"})
    # EAR e ENA por REE e bacia: diária desde 2022 e mensal desde 2000 (o diário completo
    # passaria de 15 MB; o histórico diário integral fica no silver e no bronze)
    linhas, mensal = [], []
    for rec, ear, ena in (("ree", d.get("_ree", {}), d.get("_ena_ree", {})), ("bacia", d.get("_bac", {}), d.get("_ena_bac", {}))):
        for n_ in sorted(set(ear) | set(ena)):
            e, a = ear.get(n_, {"mw": {}, "max": {}, "pct": {}}), ena.get(n_, {})
            ks = sorted(set(e.get("mw", {})) | set(a.get("mw", {})))
            for k in ks:
                if k >= DIARIO_RECORTES:
                    linhas.append([k, rec, n_, e["mw"].get(k), e["max"].get(k), e["pct"].get(k), a.get("mw", {}).get(k),
                                   a.get("pct", {}).get(k), a.get("mlt", {}).get(k)])
            por_mes = defaultdict(list)
            for k in ks:
                por_mes[k[:7]].append(k)
            for m, kk in sorted(por_mes.items()):
                ult = max(k for k in kk if k in e["mw"]) if any(k in e["mw"] for k in kk) else None
                n_mes = calendar.monthrange(int(m[:4]), int(m[5:7]))[1]
                com = [k for k in kk if k in a.get("mw", {}) and k in a.get("mlt", {})]
                ena_m = (100.0 * sum(a["mw"][k] for k in com) / sum(a["mlt"][k] for k in com)
                         if len(com) == n_mes and sum(a["mlt"][k] for k in com) > 0 else None)
                mensal.append([m, rec, n_, ult, e["mw"].get(ult) if ult else None, e["max"].get(ult) if ult else None,
                               e["pct"].get(ult) if ult else None, ena_m, len(com)])
    _escreve(d, "agua_ear_recortes_diario.csv", ["data", "recorte", "nome", "ear_mwmes", "ear_max_mwmes", "ear_pct",
                                                 "ena_bruta_mwmed", "ena_bruta_pct_mlt", "mlt_implicita_mwmed"], linhas)
    _escreve(d, "agua_ear_recortes_mensal.csv", ["mes", "recorte", "nome", "dia_ear", "ear_mwmes_fim_mes", "ear_max_mwmes_fim_mes",
                                                 "ear_pct_fim_mes", "ena_bruta_pct_mlt_mes", "dias_ena"], mensal)
    downloads += [{"rotulo": "EAR e ENA diárias por REE e por bacia, desde 2022 (CSV)", "url": "/energia/series/agua_ear_recortes_diario.csv"},
                  {"rotulo": "EAR no fim do mês e ENA mensal por REE e por bacia, desde 2000 (CSV)", "url": "/energia/series/agua_ear_recortes_mensal.csv"}]
    # capacidade
    linhas = []
    for e in d.get("_eventos", []):
        base_l = [e["data"], e["sm"], e["antes_mwmes"], e["depois_mwmes"], e["variacao_mwmes"]]
        if not e["reservatorios"]:
            linhas.append(base_l + ["", "", "", "", "", e["residuo_mwmes"]])
        for x in e["reservatorios"]:
            linhas.append(base_l + [x["cod"], x["nome"], x["parte"], x["tipo"], x["variacao_mwmes"], e["residuo_mwmes"]])
    _escreve(d, "agua_capacidade_eventos.csv", ["data", "subsistema", "ear_max_antes_mwmes", "ear_max_depois_mwmes", "variacao_mwmes",
                                                "cod_reservatorio", "reservatorio", "parte", "tipo", "variacao_reservatorio_mwmes",
                                                "residuo_evento_mwmes"], linhas)
    downloads.append({"rotulo": "Mudanças da capacidade de armazenamento (CSV)", "url": "/energia/series/agua_capacidade_eventos.csv"})
    linhas = [[m["data"], m["cod"], m["nome"], m["sm"], m["antes"], m["depois"], m["variacao_pct"], m["tipo"]]
              for m in sorted(d.get("_mlt_mudancas", []), key=lambda m: (m["data"], m["cod"]))
              if m["tipo"] != "virada_de_mes"]
    _escreve(d, "agua_mlt_mudancas.csv", ["data", "cod_reservatorio", "reservatorio", "subsistema", "mlt_antes_mwmed",
                                          "mlt_depois_mwmed", "variacao_pct", "tipo"], linhas)
    downloads.append({"rotulo": "Mudanças da MLT por usina (CSV)", "url": "/energia/series/agua_mlt_mudancas.csv"})
    if d.get("_res_lista"):
        cols = ["id", "cod", "nome", "subsistema", "bacia", "ree", "tipo", "vol_util_total_hm3", "vol_util_pct_fim", "dv_obs_hm3",
                "afluencia_hm3", "defluencia_hm3", "turbinado_hm3", "vertido_hm3", "outras_estruturas_hm3",
                "defluencia_nao_discriminada_hm3", "transferido_hm3", "residuo_hm3", "residuo_com_transferencia_hm3",
                "dias_residuo_avaliados", "dias_residuo_dentro_tolerancia_pct"]
        _escreve(d, "agua_reservatorios.csv", cols, [[x.get(k) for k in cols] for x in d["_res_lista"]])
        _escreve(d, "agua_reservatorios_diario.csv", ["data", "id", "vol_util_pct", "dv_hm3", "q_afluente", "q_defluente",
                                                      "q_turbinada", "q_vertida", "q_outras", "q_transferida", "q_evaporacao",
                                                      "q_natural", "q_incremental", "residuo_hm3"], sorted(d["_res_diario_csv"]))
        downloads += [{"rotulo": "Balanço de 30 dias por reservatório (CSV)", "url": "/energia/series/agua_reservatorios.csv"},
                      {"rotulo": "Dados hidráulicos diários por reservatório, 365 dias (CSV)", "url": "/energia/series/agua_reservatorios_diario.csv"}]
    return downloads


def _int(v):
    return None if v is None else int(round(v))


# ================================================================ construir

def construir(con, ctx):
    con_p = ctx.get("con_principal") or base.conecta()
    d = {"destino_csv": ctx.get("destino_csv")}
    faltas = []
    for etapa in (_armazenamento, _afluencia):
        etapa(con, con_p, d)
    try:
        _clima(con, d)
        d["_temp_cob"] = _series_glob(con, DS_CLIMA_T, "cobertura_pop_pct.*")
        d["_temp_cob"].update(_series_glob(con, DS_CLIMA_T, "ufs_com_dado.*"))
        d["_temp_ncel"] = _series_glob(con, DS_CLIMA_T, "n_celulas.*")
        d["_precip_cob"] = _series_glob(con, DS_CLIMA_PR, "cobertura_pct.*")
    except RuntimeError as e:
        faltas.append(f"clima: {e}")
    try:
        _reservatorios(con, con_p, d)
    except RuntimeError as e:
        faltas.append(f"reservatórios: {e}")
    problemas = _valida(d)
    criticos = [p for p in problemas if p.startswith("CRÍTICO")]
    if criticos:
        return c.stub(GOLD, "; ".join(criticos)[:300])
    downloads = _csvs(d)
    prov, evid = _proveniencias_e_evidencias(con, con_p, d, downloads)
    gold = {
        **c.cabecalho(GOLD),
        "dias_referencia": {"ear": d["dia_ear"], "ena": d["dia_ena"],
                            "ree": d["afluencia"].get("dia_ree"), "bacias": d["afluencia"].get("dia_bacias"),
                            "reservatorios": d.get("reservatorios", {}).get("fim"),
                            "precipitacao": max((b["dia"] for b in d.get("clima", {}).get("precipitacao_bacias", [])), default=None),
                            "temperatura": max((t["dia"] for t in d.get("clima", {}).get("temperatura", [])), default=None)},
        "regras": REGRAS,
        "armazenamento": d["armazenamento"],
        "reconciliacao_ear": d["reconciliacao_ear"],
        "afluencia": d["afluencia"],
        "clima": d.get("clima"),
        "reservatorios": d.get("reservatorios"),
        "pendencias": faltas,
        "ressalvas": [p for p in problemas if not p.startswith("CRÍTICO")],
        "proveniencia": prov,
        "evidencias": evid,
        "downloads": downloads,
    }
    return gold


REGRAS = {
    "ear_agregada": "EAR de um agregado (SIN) = soma das EAR verificadas em MWmês ÷ soma das EAR máximas em MWmês × 100. Nunca a média dos percentuais.",
    "ear_absoluta": "Energia armazenada em MWmês (energia que os reservatórios produziriam em um mês à potência média de 1 MW por MWmês), publicada pelo ONS por subsistema, REE, bacia e reservatório.",
    "capacidade": "Mudança de capacidade = variação diária da EAR máxima do subsistema acima de 0,01 MWmês; atribuída aos reservatórios cuja EAR máxima (parte própria no subsistema da usina, parte a jusante no subsistema a jusante) mudou, entrou ou saiu no mesmo dia. O resíduo do evento é publicado.",
    "faixa_sazonal": "Mediana, 10º e 90º percentis do valor do mesmo dia do calendário nos anos completos anteriores (subsistemas e bacias desde 2001; REE desde 2016). 29/02 fica fora da distribuição e, como dia de referência, usa 28/02.",
    "ena_30d": "ENA de 30 dias em % da MLT = soma da ENA bruta diária (MWmed) nos 30 dias ÷ soma da MLT vigente em cada dia (MLT implícita = ENA ÷ percentual da MLT × 100) × 100.",
    "mlt": "A MLT não é fixa: muda quando usinas entram ou saem e quando o ONS recalcula a referência. Mudança dentro do mês, em usina existente, é tratada como revisão da referência.",
    "precipitacao": "Precipitação da bacia = média ponderada pela área (cos(lat) × passo²) dos pontos de grade dentro do polígono do ONS; dia publicado só com ao menos 80% do peso com dado. Mês só com todos os dias.",
    "temperatura": "Temperatura da UF = média das células MERRA-2 mais populosas (até metade da população do estado, no máximo 6), ponderada pela população das sedes; subsistema e SIN = média das UFs ponderada pela população (Censo 2022); dia publicado com ao menos 90% da população coberta.",
    "anomalia": "Anomalia = valor ÷ média do mesmo mês (ou mesma janela) em 2001 a 2025 − 1, em %, para a chuva; diferença em °C para a temperatura.",
    "balanco_reservatorio": "ΔV observado (hm³) = (volume útil % do fim − do início) ÷ 100 × volume útil total do cadastro; fluxos em hm³ = vazão (m³/s) × 86.400 s ÷ 10⁶; resíduo = ΔV observado − (afluência − defluência). Transferência publicada à parte, com resíduo alternativo.",
    "decomposicao_ear": "Variação da EAR do subsistema em 30 dias = soma das variações por reservatório (parte própria no subsistema da usina; parte a jusante no subsistema a jusante). A ENA, a geração hidráulica e a chuva aparecem como contexto e não fecham balanço com a EAR.",
}


def _valida(d):
    """Validação física e de esquema antes de publicar (seção 5.2 do contrato)."""
    p = []
    hoje = c.agora_date().isoformat()
    a = d["armazenamento"]
    for s in a["subsistemas"]:
        if s["ear_mwmes"] is None or s["ear_mwmes"] < 0 or s["ear_max_mwmes"] is None or s["ear_max_mwmes"] <= 0:
            p.append(f"CRÍTICO: EAR inválida em {s['sm']}")
        if s["ear_pct"] is not None and not (0 <= s["ear_pct"] <= 100.5):
            p.append(f"CRÍTICO: EAR fora de 0 a 100% em {s['sm']}")
    if d["dia_ear"] > hoje or d["dia_ena"] > hoje:
        p.append("CRÍTICO: data de referência no futuro")
    rec = d["reconciliacao_ear"]
    if rec["pct_publicado_vs_recalculado_max_pp"] is not None and rec["pct_publicado_vs_recalculado_max_pp"] > 0.01:
        p.append(f"percentual publicado difere do recalculado em até {rec['pct_publicado_vs_recalculado_max_pp']} p.p.")
    for r in rec["reservatorios_por_subsistema"]:
        if r["diferenca_mwmes"] is not None and abs(r["diferenca_mwmes"]) > 0.05:
            p.append(f"soma dos reservatórios difere da EAR do {r['sm']} em {r['diferenca_mwmes']} MWmês")
    ref_sin = rec["sin_mesma_captura_mwmes"] if rec["sin_mesma_captura_mwmes"] is not None else rec["sin_mwmes"]
    if rec["soma_bacias_mwmes"] is not None and abs(rec["soma_bacias_mwmes"] - ref_sin) > 0.05:
        p.append(f"soma das bacias difere da EAR do SIN da mesma captura em {c.r(rec['soma_bacias_mwmes'] - ref_sin, 3)} MWmês")
    for x in rec["reservatorios_por_ano"]:
        p.append(f"{x['ano']} {x['sm']}: soma dos reservatórios difere do subsistema além de {x['tolerancia_mwmes']} MWmês em "
                 f"{x['dias_fora_ear']} dias (EAR, até {x['max_dif_ear_mwmes']}) e {x['dias_fora_ear_max']} dias (EAR máxima, até {x['max_dif_ear_max_mwmes']})")
    for b in a["bacias"] + a["ree"]:
        if b["ear_pct"] is not None and b["ear_pct"] < 0:
            p.append(f"CRÍTICO: EAR negativa em {b['nome']}")
    for s in d["afluencia"]["subsistemas"]:
        if s["pct_mlt_30d"] is not None and s["pct_mlt_30d"] < 0:
            p.append(f"CRÍTICO: ENA negativa em {s['sm']}")
    cl_ = d.get("clima") or {}
    for b in cl_.get("precipitacao_bacias", []):
        for m in b["mensal"]:
            if m["mm"] is not None and m["mm"] < 0:
                p.append(f"CRÍTICO: precipitação negativa em {b['bacia']} {m['m']}")
    for t in cl_.get("temperatura", []):
        if t["media_30d_c"] is not None and not (-5 <= t["media_30d_c"] <= 40):
            p.append(f"CRÍTICO: temperatura fora do intervalo físico em {t['recorte']}")
    return p


def _proveniencias_e_evidencias(con, con_p, d, downloads):
    snap_ear = c.snapshot_de(con_p, DS_EAR_SM)
    snap_ena = c.snapshot_de(con_p, DS_ENA_SM)
    snap_ree = c.snapshot_de(con, DS_EAR_REE)
    snap_bac = c.snapshot_de(con, DS_EAR_BACIA)
    snap_ena_ree = c.snapshot_de(con, DS_ENA_REE)
    snap_ena_bac = c.snapshot_de(con, DS_ENA_BACIA)
    snap_res = c.snapshot_de(con, DS_EAR_RES)
    snap_ena_res = c.snapshot_de(con, DS_ENA_RES)
    snap_hidro = c.snapshot_de(con, DS_HIDRO)
    snap_pr = c.snapshot_de(con, DS_CLIMA_PR)
    snap_t = c.snapshot_de(con, DS_CLIMA_T)
    dia, fim_ena = d["dia_ear"], d["dia_ena"]
    a = d["armazenamento"]
    ini = a["capacidade"]["inicio"]
    fonte_ear_sm = c.fonte_ons("ear-diario-por-subsistema", DS_EAR_SM, "EAR Diário por Subsistema")
    fonte_ena_sm = c.fonte_ons("ena-diario-por-subsistema", DS_ENA_SM, "ENA Diário por Subsistema")
    prov = {
        "ear_sin": _prov("EAR do SIN em MWmês e em % da EAR máxima", "CALCULADO", fonte_ear_sm, "MWmês e % da EAR máxima",
                         "diária", {"inicio": ini, "fim": dia}, snap_ear, [LIM_ONS,
                         "O Sudeste/Centro-Oeste concentra cerca de 70% da capacidade e domina o agregado."],
                         formula="EAR_SIN% = Σ EAR(s) ÷ Σ EARmax(s) × 100, s ∈ {SE, S, NE, N}",
                         transformacoes=["soma das EAR e das EAR máximas dos quatro subsistemas"]),
        "capacidade": _prov("Mudanças da EAR máxima e atribuição por reservatório", "CALCULADO",
                            _fonte_ons("ear_res", "EAR Diário por Reservatório", "EAR_DIARIO_RESERVATORIOS_2000 a 2026 (Parquet)"),
                            "MWmês", "por evento", {"inicio": ini, "fim": dia}, snap_res,
                            [LIM_ONS, "A EAR máxima do ONS é uma capacidade em energia: muda com a entrada de usinas a jusante "
                             "(produtibilidade acumulada) mesmo sem mudança no volume do reservatório."],
                            formula="evento = EARmax(s, d) − EARmax(s, d−1); atribuição = Σ variações por reservatório no mesmo dia; resíduo = evento − atribuição",
                            download="/energia/series/agua_capacidade_eventos.csv"),
        "ear_ree": _prov("EAR por REE", "OBSERVADO", _fonte_ons("ear_ree", "EAR Diário por REE", "EAR_DIARIO_REE_2016 a 2026 (CSV)"),
                         "MWmês e %", "diária", {"inicio": "2016-01-01", "fim": dia}, snap_ree,
                         [LIM_ONS, "O conjunto começa em 2016: a faixa sazonal por REE tem no máximo 10 anos na base.",
                          "REE sem armazenamento (ITAIPU) têm EAR máxima zero e não têm percentual significativo."],
                         download="/energia/series/agua_ear_recortes_diario.csv"),
        "ear_bacia": _prov("EAR por bacia", "OBSERVADO", _fonte_ons("ear_bacia", "EAR Diário por Bacia", "EAR_DIARIO_BACIAS_2000 a 2026 (CSV)"),
                           "MWmês e %", "diária", {"inicio": "2000-01-01", "fim": dia}, snap_bac,
                           [LIM_ONS, "Bacias com EAR máxima zero (só usinas a fio d'água) aparecem sem percentual."],
                           download="/energia/series/agua_ear_recortes_diario.csv"),
        "ena_30d": _prov("ENA de 30 dias em % da MLT (subsistemas, REE e bacias)", "CALCULADO", fonte_ena_sm, "% da MLT",
                         "diária (janela de 30 dias)", {"inicio": _dmenos(fim_ena, 29), "fim": fim_ena}, snap_ena,
                         [LIM_ONS, "A MLT muda ao longo do tempo (usinas novas e recálculo); a razão usa a MLT vigente em cada dia.",
                          "A unidade das colunas _mwmed é MWmed (média do dia), conferida pela soma das usinas; o dicionário por subsistema diz MWmês."],
                         formula="ENA30 = Σ ENA(d) ÷ Σ MLT(d) × 100; MLT(d) = ENA(d) ÷ %MLT(d) × 100",
                         transformacoes=["MLT implícita diária", "soma de 30 dias do numerador e do denominador"]),
        "ena_recortes": _prov("ENA por REE e por bacia", "OBSERVADO",
                              _fonte_ons("ena_bacia", "ENA Diário por Bacia e por REE", "ENA_DIARIO_BACIAS e ENA_DIARIO_REE (CSV)"),
                              "MWmed e % da MLT", "diária", {"inicio": "2000-01-01", "fim": d["afluencia"].get("dia_bacias") or fim_ena},
                              snap_ena_bac, [LIM_ONS, "O arquivo por REE nomeia a coluna do REE como nom_reservatorioee (o dicionário diz nom_ree)."],
                              download="/energia/series/agua_ear_recortes_diario.csv"),
        "mlt": _prov("Mudanças da MLT por usina", "OBSERVADO",
                     _fonte_ons("ena_res", "ENA Diário por Reservatório", "ENA_DIARIO_RESERVATORIOS_2000 a 2026 (CSV até 2020, Parquet desde 2021)"),
                     "MWmed", "por evento", {"inicio": "2000-01-01", "fim": fim_ena}, snap_ena_res,
                     [LIM_ONS, "O ONS não informa, nos dicionários nem nas notas dos conjuntos, o período histórico usado no cálculo da MLT: "
                      "a versão é inferida das mudanças observadas nos arquivos."],
                     download="/energia/series/agua_mlt_mudancas.csv"),
    }
    if d.get("reservatorios"):
        r = d["reservatorios"]
        prov["balanco"] = _prov("Balanço hídrico de 30 dias por reservatório", "CALCULADO",
                                _fonte_ons("hidro_res", "Dados Hidráulicos por Reservatório, base diária", "DADOS_HIDROLOGICOS_RES_2025 e 2026 (Parquet)"),
                                "hm³", "janela de 30 dias", {"inicio": r["inicio"], "fim": r["fim"]}, snap_hidro,
                                [LIM_ONS, "A afluência publicada pelo ONS é, na maioria dos reservatórios, calculada pelo balanço "
                                 "(defluência + variação do volume): resíduo perto de zero decorre da construção, não confirma a medição.",
                                 "A convenção de sinal da vazão transferida não está no dicionário; o resíduo com transferência é publicado à parte.",
                                 "Volume útil total vem do cadastro atual do ONS e é aplicado a toda a janela."],
                                formula="resíduo = (V%fim − V%início) ÷ 100 × Vútil − Σ (Qafl − Qdefl) × 0,0864",
                                download="/energia/series/agua_reservatorios.csv")
    if d.get("clima"):
        fonte_pr = {"orgao": "NASA", "dataset": "POWER Daily API, parâmetro IMERG_PRECTOT", "recurso": "um arquivo JSON por ponto e janela",
                    "url_dataset": cl.POWER_DOCS, "url_primaria": cl.POWER, "licenca": LICENCA_POWER}
        fonte_t = {"orgao": "NASA", "dataset": "POWER Daily API, parâmetros T2M, T2M_MAX, T2M_MIN", "recurso": "um arquivo JSON por célula e janela",
                   "url_dataset": cl.POWER_DOCS, "url_primaria": cl.POWER, "licenca": LICENCA_POWER}
        prov["precipitacao"] = _prov("Precipitação média por bacia hidroenergética", "ESTIMADO", fonte_pr, "mm/dia",
                                     "diária (dia UTC)", {"inicio": cl.PRECIP_INICIO, "fim": d["dias_ref_pr"] if d.get("dias_ref_pr") else hoje_iso()},
                                     snap_pr, ["Estimativa por satélite (IMERG), não medição em estação.",
                                               "Os últimos ~3,5 meses usam a versão Late do IMERG, sem calibração por pluviômetros (marcados como preliminares).",
                                               "A média da bacia é estimada por amostragem em grade (1°, adensada em bacias pequenas), não pela integral da área."],
                                     formula="P(bacia, d) = Σ w_i P_i(d) ÷ Σ w_i, w_i = cos(lat_i) × passo²",
                                     download="/energia/series/agua_precipitacao_bacias_diario.csv")
        prov["temperatura"] = _prov("Temperatura do ar por subsistema e SIN", "ESTIMADO", fonte_t, "°C", "diária (hora solar local)",
                                    {"inicio": cl.TEMP_INICIO, "fim": d.get("dias_ref_t") or hoje_iso()}, snap_t,
                                    ["Reanálise (MERRA-2) e análise operacional (GEOS-IT nos meses mais recentes), não medição em estação.",
                                     "O mapeamento UF → subsistema é o de 2026 (conferido contra a carga por área do ONS) e é aplicado a toda a série; "
                                     "Acre, Rondônia, Amazonas, Amapá e Roraima entraram no SIN depois de 2001.",
                                     "Temperatura das células mais populosas, não média da área do estado."],
                                    formula="T(UF) = Σ pop_c T_c ÷ Σ pop_c; T(s) = Σ pop_UF T(UF) ÷ Σ pop_UF",
                                    download="/energia/series/clima_diario.csv")
    return prov, _evidencias(con, con_p, d, downloads)


def hoje_iso():
    return c.agora_date().isoformat()


def _evidencias(con, con_p, d, downloads):
    out = {}
    dia = d["dia_ear"]
    a = d["armazenamento"]
    sin = next(s for s in a["subsistemas"] if s["sm"] == "SIN")
    mw, mx, pct, _ = d["_ear"]
    v26 = base.ultima_vintage(con_p, DS_EAR_SM, f"EAR_DIARIO_SUBSISTEMA_{dia[:4]}")
    rec = d["reconciliacao_ear"]
    testes = [
        ev.teste("SIN recalculado pelos quatro subsistemas", "aprovado",
                 f"Σ EAR = {sum(mw[sm][dia] for sm in SMS):.3f} MWmês; Σ EARmax = {sum(mx[sm][dia] for sm in SMS):.3f} MWmês"),
        ev.teste("Percentual publicado = EAR ÷ EARmax (todos os dias e subsistemas)",
                 "aprovado" if rec["pct_publicado_vs_recalculado_max_pp"] <= 0.01 else "ressalva",
                 f"maior diferença {rec['pct_publicado_vs_recalculado_max_pp']} p.p. em {rec['pares_conferidos']} pares"),
        ev.teste("Média simples dos percentuais não é usada", "aprovado",
                 f"média simples daria {rec['media_simples_dos_percentuais']}%, {rec['diferenca_media_simples_pp']} p.p. de diferença"),
    ]
    ref_sin = rec["sin_mesma_captura_mwmes"] if rec["sin_mesma_captura_mwmes"] is not None else rec["sin_mwmes"]
    dif_bac = None if rec["soma_bacias_mwmes"] is None else rec["soma_bacias_mwmes"] - ref_sin
    recon = ev.reconciliacao(
        f"Soma das EAR das {rec['n_bacias']} bacias (conjunto EAR por bacia do ONS) = {rec['soma_bacias_mwmes']} MWmês; "
        f"soma dos {rec['n_ree']} REE = {rec['soma_ree_mwmes']} MWmês; SIN pelos subsistemas da mesma captura = {ref_sin} MWmês "
        f"(no silver principal, capturado antes, {rec['sin_mwmes']} MWmês: a diferença é revisão do ONS entre as capturas)",
        "aprovado" if dif_bac is not None and abs(dif_bac) <= 0.05 else "ressalva", "0,05 MWmês (arredondamento a 3 casas de até 23 parcelas)")
    out["ear_sin"] = ev.construir(
        indicador="EAR do SIN", valor_exibido=f"{sin['ear_pct']:.1f}%".replace(".", ","), valor_calculo=100.0 * mw["SIN"][dia] / mx["SIN"][dia],
        unidade="% da EAR máxima", periodo={"inicio": dia, "fim": dia}, entidade="Sistema Interligado Nacional",
        universo="4 subsistemas (SE/CO, S, NE, N)", fonte=_fonte_arquivos("ONS", "EAR Diário por Subsistema",
                                                                         "https://dados.ons.org.br/dataset/ear-diario-por-subsistema", [v26]),
        chaves_origem=[f"{DS_EAR_SM}:ear_mwmes.{sm}@{dia}" for sm in SMS] + [f"{DS_EAR_SM}:ear_max_mwmes.{sm}@{dia}" for sm in SMS],
        formula="Σ EAR(s) ÷ Σ EARmax(s) × 100",
        numerador={"descricao": "soma das EAR verificadas (MWmês)", "valor": mw["SIN"][dia]},
        denominador={"descricao": "soma das EAR máximas (MWmês)", "valor": mx["SIN"][dia]},
        pesos="capacidade de armazenamento (EAR máxima) de cada subsistema", cobertura="4 de 4 subsistemas no dia",
        tratamento_ausencia="dia sem algum subsistema não tem SIN", revisoes=c.snapshot_de(con_p, DS_EAR_SM).get("revisoes"),
        testes=testes, reconciliacao=recon,
        download=[{"rotulo": "EAR diária por subsistema e SIN (CSV)", "url": "/energia/series/ear_diario.csv"}] + downloads[:0],
        reproducao=REPRODUCAO)
    out["ear_sin_mwmes"] = ev.construir(
        indicador="Energia armazenada no SIN", valor_exibido=f"{mw['SIN'][dia]:,.0f} MWmês".replace(",", "."),
        valor_calculo=mw["SIN"][dia], unidade="MWmês", periodo={"inicio": dia, "fim": dia}, entidade="Sistema Interligado Nacional",
        universo="4 subsistemas", fonte=_fonte_arquivos("ONS", "EAR Diário por Subsistema",
                                                        "https://dados.ons.org.br/dataset/ear-diario-por-subsistema", [v26]),
        chaves_origem=[f"{DS_EAR_SM}:ear_mwmes.{sm}@{dia}" for sm in SMS], formula="Σ EAR(s)",
        cobertura="4 de 4 subsistemas", tratamento_ausencia="dia sem algum subsistema não tem SIN",
        revisoes=c.snapshot_de(con_p, DS_EAR_SM).get("revisoes"), testes=testes[:1], reconciliacao=recon,
        download=[{"rotulo": "Série mensal e diária em MWmês (gold)", "url": "/energia/gold/agua_detalhe.json"},
                  {"rotulo": "EAR por REE e bacia (CSV)", "url": "/energia/series/agua_ear_recortes_diario.csv"}],
        reproducao=REPRODUCAO)
    cap = a["capacidade"]
    vs = [base.ultima_vintage(con, DS_EAR_RES, f"EAR_DIARIO_RESERVATORIOS_{ano}") for ano in (int(dia[:4]) - 1, int(dia[:4]))]
    out["capacidade"] = ev.construir(
        indicador="Mudanças da capacidade de armazenamento (EAR máxima) desde 2000", valor_exibido=f"{cap['n_eventos']} mudanças",
        valor_calculo=float(cap["n_eventos"]), unidade="eventos", periodo={"inicio": cap["inicio"], "fim": dia},
        entidade="subsistemas do SIN", universo="dias com variação da EAR máxima acima de 0,01 MWmês",
        fonte=_fonte_arquivos("ONS", "EAR Diário por Reservatório", "https://dados.ons.org.br/dataset/ear-diario-por-reservatorio", vs),
        consulta=f"variações de ear_max_mwmes.<s> em {DS_EAR_SM}; atribuição por earmax_proprio/jusante.<cod> em {DS_EAR_RES}",
        formula="evento = EARmax(s,d) − EARmax(s,d−1); resíduo = evento − Σ variações dos reservatórios",
        cobertura=f"{cap['eventos_fechados']} de {cap['n_eventos']} eventos com resíduo até 0,05 MWmês",
        tratamento_ausencia="reservatório ausente do arquivo não contribui para a EAR máxima (entrada e saída explícitas)",
        revisoes=c.snapshot_de(con, DS_EAR_RES).get("revisoes"),
        testes=[ev.teste("Eventos atribuídos a reservatórios", "aprovado" if cap["eventos_fechados"] == cap["n_eventos"] else "ressalva",
                         f"{cap['eventos_fechados']} de {cap['n_eventos']} fecham; maior resíduo {cap['maior_residuo_mwmes']} MWmês")],
        download=[{"rotulo": "Mudanças da capacidade (CSV)", "url": "/energia/series/agua_capacidade_eventos.csv"}],
        reproducao=REPRODUCAO)
    # ENA 30 dias do SIN
    fim = d["dia_ena"]
    ena = d["_ena_sm"]["SIN"]
    v, num, den = _ena_janela(d["_ena_sm"]["SIN"], fim)
    ve = base.ultima_vintage(con_p, DS_ENA_SM, f"ENA_DIARIO_SUBSISTEMA_{fim[:4]}")
    ve_ant = base.ultima_vintage(con_p, DS_ENA_SM, f"ENA_DIARIO_SUBSISTEMA_{_dmenos(fim, 29)[:4]}")
    unid = d["afluencia"]["mlt"]["unidade"]
    out["ena_30d_sin"] = ev.construir(
        indicador="ENA bruta de 30 dias do SIN", valor_exibido=None if v is None else f"{v:.1f}% da MLT".replace(".", ","),
        valor_calculo=v, unidade="% da MLT", periodo={"inicio": _dmenos(fim, 29), "fim": fim}, entidade="Sistema Interligado Nacional",
        universo="4 subsistemas × 30 dias", fonte=_fonte_arquivos("ONS", "ENA Diário por Subsistema",
                                                                 "https://dados.ons.org.br/dataset/ena-diario-por-subsistema",
                                                                 [ve] if ve_ant is None or ve_ant["vintage_id"] == (ve or {}).get("vintage_id") else [ve_ant, ve]),
        consulta=f"ena_bruta_mwmed.<s> e ena_bruta_pct_mlt.<s> em {DS_ENA_SM}, d de {_dmenos(fim, 29)} a {fim}",
        formula="Σ ENA(d) ÷ Σ MLT(d) × 100, MLT(d) = ENA(d) ÷ %MLT(d) × 100",
        numerador={"descricao": "soma das ENA brutas diárias dos 4 subsistemas (MWmed·dia)", "valor": num},
        denominador={"descricao": "soma das MLT implícitas diárias (MWmed·dia)", "valor": den},
        pesos="MLT de cada dia e subsistema (razão de somas)", cobertura="30 de 30 dias, 4 de 4 subsistemas",
        tratamento_ausencia="janela com dia ausente não é calculada", revisoes=c.snapshot_de(con_p, DS_ENA_SM).get("revisoes"),
        testes=[ev.teste("Razão de somas, não média de percentuais", "aprovado",
                         f"média simples dos % diários daria {d['_ena_media_simples_sin']:.2f}%"),
                ev.teste("Unidade MWmed conferida pela soma das usinas", "aprovado" if all(u["dias"] and u["dias_dentro_0_1pct"] / u["dias"] >= 0.9 for u in unid) else "ressalva",
                         "; ".join(f"{u['sm']}: {u['dias_dentro_0_1pct']} de {u['dias']} dias até 0,1%" for u in unid))],
        download=[{"rotulo": "ENA diária por subsistema (CSV)", "url": "/energia/series/ena_diario.csv"},
                  {"rotulo": "Mudanças da MLT por usina (CSV)", "url": "/energia/series/agua_mlt_mudancas.csv"}],
        reproducao=REPRODUCAO)
    # clima
    cli = d.get("clima")
    if cli and cli["temperatura"]:
        t = next((x for x in cli["temperatura"] if x["recorte"] == "SIN"), None)
        vt = base.ultima_vintage(con, DS_CLIMA_T, "temperatura")
        if t and vt:
            out["temperatura_sin_30d"] = ev.construir(
                indicador="Anomalia da temperatura do SIN em 30 dias", valor_exibido=None if t["anomalia_30d_c"] is None else
                f"{t['anomalia_30d_c']:+.1f} °C".replace(".", ","), valor_calculo=t["anomalia_30d_c"], unidade="°C",
                periodo={"inicio": _dmenos(t["dia"], 29), "fim": t["dia"]}, entidade="SIN (27 UF, ponderadas pela população)",
                universo=f"{cli['totais']['celulas_temperatura']} células MERRA-2", fonte=_fonte_arquivos(
                    "NASA", "POWER Daily API (T2M), agregado pela Scrutiniums", cl.POWER, [vt]),
                consulta=f"t2m_c.SIN em {DS_CLIMA_T}; manifesto do agregado lista as células e o sha256 de cada arquivo",
                formula="média dos 30 dias − média da mesma janela em 2001 a 2025",
                cobertura=f"{t['anos_base']} anos na base", tratamento_ausencia="dia com menos de 90% da população coberta fica sem valor",
                revisoes=c.snapshot_de(con, DS_CLIMA_T).get("revisoes"),
                testes=[ev.teste("Intervalo físico", "aprovado", "média de 30 dias entre −5 e 40 °C"),
                        ev.teste("Validação contra estação", "ressalva", "INMET inacessível em 30/09/2026: sem conferência com observação")],
                download=[{"rotulo": "Temperatura diária por subsistema (CSV)", "url": "/energia/series/clima_diario.csv"},
                          {"rotulo": "Manifesto espacial (CSV)", "url": "/energia/series/agua_clima_pontos.csv"}],
                reproducao=REPRODUCAO)
    if cli and cli["precipitacao_bacias"]:
        maior = max(a["bacias"], key=lambda b: b["ear_max_mwmes"] or 0)["nome"]
        b = next((x for x in cli["precipitacao_bacias"] if x["bacia"] == maior), None)
        vb = base.ultima_vintage(con, DS_CLIMA_PR, f"bacia_{maior}")
        if b and vb:
            val = cli["validacao_estacoes"]
            out["precipitacao_maior_bacia_30d"] = ev.construir(
                indicador=f"Chuva de 30 dias na bacia {maior}", valor_exibido=None if b["mm_30d"] is None else f"{b['mm_30d']:.0f} mm",
                valor_calculo=b["mm_30d"], unidade="mm", periodo={"inicio": _dmenos(b["dia"], 29), "fim": b["dia"]},
                entidade=f"bacia {maior} (maior EAR máxima)", universo="pontos de grade dentro do polígono do ONS",
                fonte=_fonte_arquivos("NASA", "POWER Daily API (IMERG_PRECTOT), agregado pela Scrutiniums", cl.POWER, [vb]),
                consulta=f"precip_mm.{maior} em {DS_CLIMA_PR}", formula="Σ dos 30 dias de P(bacia, d)",
                cobertura=f"cobertura média {b['cobertura_media_pct']}% do peso da bacia",
                tratamento_ausencia="dia com menos de 80% do peso com dado fica sem valor; janela incompleta não soma",
                revisoes=c.snapshot_de(con, DS_CLIMA_PR).get("revisoes"),
                testes=[ev.teste("Conferência com estações (2020 e 2021)", "ressalva",
                                 f"correlação mensal {val['correlacao_geral']} em {val['pares']} pares bacia-mês; viés {val['vies_geral_pct']}%")],
                download=[{"rotulo": "Precipitação diária por bacia (CSV)", "url": "/energia/series/agua_precipitacao_bacias_diario.csv"}],
                reproducao=REPRODUCAO)
    res = d.get("reservatorios")
    if res and d.get("_res_lista"):
        x = next((r for r in sorted(d["_res_lista"], key=lambda r: -(r["vol_util_total_hm3"] or 0)) if r["balanco_calculado"]), None)
        vh = base.ultima_vintage(con, DS_HIDRO, f"DADOS_HIDROLOGICOS_RES_{res['fim'][:4]}")
        if x and vh:
            out["balanco_maior_reservatorio"] = ev.construir(
                indicador=f"Resíduo do balanço de 30 dias em {x['nome']}", valor_exibido=f"{x['residuo_hm3']:.2f} hm³".replace(".", ","),
                valor_calculo=x["residuo_hm3"], unidade="hm³", periodo={"inicio": res["inicio"], "fim": res["fim"]},
                entidade=f"reservatório {x['nome']} ({x['id']})", universo="maior volume útil do cadastro com balanço calculado",
                fonte=_fonte_arquivos("ONS", "Dados Hidráulicos por Reservatório", URLS["hidro_res"], [vh]),
                chaves_origem=[f"{DS_HIDRO}:{s}.{x['id']}@{res['inicio']}..{res['fim']}" for s in ("vol_util_pct", "q_afluente", "q_defluente")],
                formula=(f"ΔV observado ({x['dv_obs_hm3']} hm³) − (Σ afluência {x['afluencia_hm3']} hm³ − "
                         f"Σ defluência {x['defluencia_hm3']} hm³)"),
                cobertura=f"{JANELA} de {JANELA} dias", tratamento_ausencia="dia sem vazão ou volume impede o balanço (sem preenchimento)",
                revisoes=c.snapshot_de(con, DS_HIDRO).get("revisoes"),
                testes=[ev.teste("Fechamento diário dentro do arredondamento", "aprovado" if (x["dias_residuo_dentro_tolerancia_pct"] or 0) >= 95 else "ressalva",
                                 f"{x['dias_residuo_dentro_tolerancia_pct']}% de {x['dias_residuo_avaliados']} dias com |resíduo| ≤ {x['tolerancia_dia_hm3']} hm³")],
                download=[{"rotulo": "Balanço por reservatório (CSV)", "url": "/energia/series/agua_reservatorios.csv"}],
                reproducao=REPRODUCAO)
    return out
