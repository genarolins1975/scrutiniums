"""Módulo Carga (detalhe): nível e crescimento com comparações equivalentes, perfil
horário, pico, MMGD e carga líquida, e decomposição estatística por clima e calendário.

Gold: public/energia/gold/carga_detalhe.json (painéis P025, P026 e P027 e o achado A07)
e CSVs em public/energia/series/carga_*.csv. Complementa, sem substituir, a gold de
operação carga.json (carga diária por subsistema), cujo builder
(pipeline/energia/gold/carga.py) aplica a validação física com quarentena usada aqui.

Fontes (seção "Fontes verificadas" em docs/observatorios/energia/modulos/carga.md):
- ONS, Carga de Energia Diária: silver principal (carga_energia_di), só leitura, com as
  vintages de cada captura (revisões e o valor negativo de 26/09/2026 no NE);
- ONS, Curva de Carga Horária (curva-carga): coletada aqui, família `ons_carga`;
- ONS, Carga de Energia Verificada (API semi-horária): carga global, MMGD e carga
  líquida de MMGD com definições compatíveis; coletada aqui, por mês e submercado;
- NASA POWER (MERRA-2 e GEOS-IT): temperatura diária nas capitais, ponderada pela
  população (IBGE: centroides das capitais e SIDRA 6579), para a decomposição do P027;
- Senado Federal (metadados de legislação): leis dos feriados nacionais.

Por que dois produtos de carga do ONS convivem aqui sem se misturar: a curva horária é o
mesmo produto da carga diária (a média das 24 horas é o valor diário) e inclui a MMGD
estimada desde 29/04/2023 sem publicá-la separada; a carga verificada da API publica a
MMGD separada, mas a carga global dela é outro conceito (maior que a curva, sobretudo
à noite). Carga, MMGD e carga líquida só são decompostas dentro da API; a curva nunca
recebe a MMGD da API subtraída (seria dupla contagem ou mistura de definições).
"""
import math
import os
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia.fontes import calendario_carga as cal  # noqa: E402
from pipeline.energia.fontes import ckan  # noqa: E402
from pipeline.energia.fontes import clima_carga as clima  # noqa: E402
from pipeline.energia.fontes import modelo_carga as modelo  # noqa: E402
from pipeline.energia.fontes import ons_carga as ons  # noqa: E402
from pipeline.energia.gold import carga as gcarga  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "carga_detalhe.json"
FAMILIA = "ons_carga"

DS_CURVA = "ons_curva_carga_ho"          # curva de carga horária (CSV anuais)
DS_API = "ons_carga_verificada_ho"       # carga verificada (API), por hora cheia
DS_POWER = "nasa_power_temperatura"      # temperatura diária nas capitais
DS_IBGE_GEO = "ibge_centroides_capitais" # centroide e nome das capitais (IBGE)
DS_IBGE_POP = "ibge_populacao_uf_6579"   # população estimada por UF (SIDRA 6579)
DS_LEIS = "senado_leis_feriados"         # metadados das leis de feriados (Senado)
DS_CONTROLE = "ons_carga_controle"       # marca de importação e controles de cada vintage
DS_DIARIA = "carga_energia_di"           # silver principal (só leitura)

SMS = ons.SMS
TODOS = SMS + ("SIN",)
SITE = "https://scrutiniums.com/setor-eletrico/carga"
PAGINA = {"rotulo": "Carga", "href": "/setor-eletrico/carga"}
REPRODUCAO = "python3 pipeline/energia/executar_modulo.py carga --sem-coleta"
LIC_ONS = c.LICENCA_ONS

CSV = {
    "horaria": "carga_horaria.csv",
    "verificada_horaria": "carga_verificada_horaria.csv",
    "verificada_diaria": "carga_verificada_diaria.csv",
    "pico": "carga_pico_diario.csv",
    "perfil": "carga_perfil_tipico.csv",
    "comparacoes": "carga_comparacoes.csv",
    "revisoes": "carga_revisoes.csv",
    "modelo": "carga_decomposicao_diaria.csv",
    "backtest": "carga_decomposicao_backtest.csv",
    "temperatura": "carga_temperatura_diaria.csv",
    "calendario": "carga_calendario.csv",
}


def _u(nome):
    return f"/energia/series/{nome}"


REGISTRO = {
    "id": "carga",
    "gold": GOLD,
    "familia": FAMILIA,
    "ordem": 21,
    "datasets": [
        {"orgao": "ONS", "nome": ons.PACOTE_CURVA, "slug": "ons-curva-carga-horaria", "dataset_silver": DS_CURVA,
         "titulo": "Curva de Carga Horária", "estado": "UTILIZADO EM INDICADOR", "url": ons.URL_CURVA, "licenca": LIC_ONS,
         "descricao": "Carga horária por subsistema; a média das 24 horas é a Carga de Energia Diária. Inclui a MMGD estimada desde 29/04/2023, sem separá-la.",
         "paginas": [PAGINA], "downloads": [_u(CSV["horaria"]), _u(CSV["pico"]), _u(CSV["perfil"])],
         "quebras": [{"data": "2021-03-01", "origem": "FONTE", "descricao": "Passa a incluir a previsão de geração de usinas não despachadas pelo ONS (mesma regra da carga diária)."},
                     {"data": "2023-04-29", "origem": "FONTE", "descricao": "Passa a incorporar a estimativa de MMGD com base em dados meteorológicos previstos (mesma regra da carga diária)."}]},
        {"orgao": "ONS", "nome": "carga-energia-verificada", "slug": "ons-carga-verificada-horaria", "dataset_silver": DS_API,
         "titulo": "Carga de Energia Verificada (API semi-horária): carga global, MMGD e carga líquida", "estado": "UTILIZADO EM INDICADOR",
         "url": ons.URL_API_DATASET, "licenca": LIC_ONS,
         "descricao": "Carga global, carga global líquida de MMGD e parcela atendida por MMGD, por submercado e meia hora; agregadas por hora cheia no horário de Brasília.",
         "paginas": [PAGINA], "downloads": [_u(CSV["verificada_horaria"]), _u(CSV["verificada_diaria"])], "quebras": []},
        {"orgao": "NASA", "nome": "power-daily-point", "slug": "nasa-power-temperatura-capitais", "dataset_silver": DS_POWER,
         "titulo": "NASA POWER: temperatura do ar a 2 m (média e máxima diárias) nas capitais", "estado": "UTILIZADO EM MODELO",
         "url": clima.URL_POWER_DOC, "licenca": clima.LICENCA_POWER, "tema": "hidrologia",
         "descricao": "Reanálise MERRA-2 e análise GEOS-IT (natureza estimada, não observação de estação), no centroide do município de cada capital.",
         "paginas": [PAGINA], "downloads": [_u(CSV["temperatura"])], "quebras": []},
        {"orgao": "IBGE", "nome": "sidra-6579", "slug": "ibge-populacao-uf-6579-carga", "dataset_silver": DS_IBGE_POP,
         "titulo": "População residente estimada por UF (SIDRA 6579), peso da temperatura", "estado": "UTILIZADO EM MODELO",
         "url": clima.URL_SIDRA_TABELA, "licenca": clima.LICENCA_IBGE, "tema": "outros",
         "paginas": [PAGINA], "downloads": [_u(CSV["temperatura"])], "quebras": []},
        {"orgao": "Senado Federal", "nome": "legislacao-federal-feriados", "slug": "senado-leis-feriados", "dataset_silver": DS_LEIS,
         "titulo": "Leis federais dos feriados nacionais (metadados de Legislação Federal)", "estado": "UTILIZADO EM MODELO",
         "url": "https://legis.senado.leg.br/", "licenca": cal.LICENCA_SENADO, "tema": "regulacao",
         "paginas": [PAGINA], "downloads": [_u(CSV["calendario"])], "quebras": []},
    ],
    "arquivos": {
        _u(CSV["horaria"]): ("data_hora (início da hora, horário de Brasília); SE, S, NE, N = carga horária da Curva de Carga Horária "
                             "do ONS em MWmed; SIN = soma dos quatro na hora (vazio se algum faltar); regime = 1, 2 ou 3 (mudanças de "
                             "conteúdo do ONS em 01/03/2021 e 29/04/2023). Desde 2019."),
        _u(CSV["verificada_horaria"]): ("data_hora (início da hora, Brasília); global_<sm>, mmgd_<sm>, liquida_<sm> para sm = SE, S, NE, "
                                        "N e SIN, em MWmed = médias das duas meias horas da API de carga verificada; liquida = global − "
                                        "mmgd (identidade publicada pelo ONS, conferida); vazio = hora sem as duas meias horas. Desde 2024."),
        _u(CSV["verificada_diaria"]): ("data; submercado; carga_global_mwmed; mmgd_mwmed; carga_liquida_mwmed; mmgd_pct (100 × MMGD ÷ carga "
                                       "global, mesmas horas); pico_global_mwmed e hora_pico_global; pico_liquida_mwmed e hora_pico_liquida "
                                       "(hora de início, Brasília); horas (horas cheias com os dois campos). Desde 15/02/2019."),
        _u(CSV["pico"]): ("data; submercado (SE, S, NE, N, SIN); media_mwmed (média das 24 horas da curva); pico_mwmed (maior valor "
                          "horário); hora_pico (0 a 23, início da hora); classe_dia (util, sabado, domingo_feriado; vazio antes de "
                          "2003); regime. Desde 2000."),
        _u(CSV["perfil"]): ("mes (AAAA-MM); submercado; classe_dia (util, sabado, domingo_feriado); hora (0 a 23, início); carga_mwmed "
                            "(Curva de Carga Horária); carga_global_mwmed, mmgd_mwmed, carga_liquida_mwmed (API de carga verificada); "
                            "dias_curva e dias_api (dias completos em cada média). Desde 2019."),
        _u(CSV["comparacoes"]): ("submercado; janela (7d, 28d, mes_corrente, ultimo_mes_completo); tipo (mesmas_datas: mesmas datas "
                                 "do ano anterior; equivalente: 364 dias antes, mesmos dias da semana); inicio; fim; inicio_ant; "
                                 "fim_ant; media_mwmed; media_ant_mwmed; variacao_pct (vazio quando os períodos atravessam mudança "
                                 "de regime); mesmo_regime; dias_uteis; dias_uteis_ant; feriados_dia_util; feriados_dia_util_ant."),
        _u(CSV["revisoes"]): ("dataset; serie; ref (dia); capturado_em e capturado_em_ant (UTC, captura que revisou e a anterior); "
                              "valor; valor_anterior; diferenca (MWmed); diferenca_pct (vazio se o anterior não era positivo); situacao "
                              "(revisao ou correcao_de_valor_fora_do_dominio)."),
        _u(CSV["modelo"]): ("data; submercado; real_mwmed; previsto_mwmed (fora da amostra, modelo estimado até o mês anterior); "
                            "p10, p90, p025, p975 (intervalos); residuo_pct; contribuições em log × 100 relativas à média do treino: "
                            "nivel_tendencia, calendario, sazonalidade, temperatura; origem (primeiro dia do mês previsto)."),
        _u(CSV["backtest"]): ("variante; submercado; origem; dias_treino; dias_previstos; mape_pct; vies_pct; fonte_intervalo."),
        _u(CSV["temperatura"]): ("data; submercado (SE, S, NE, N, SIN); temperatura_media_c e temperatura_maxima_c ponderadas pela "
                                 "população das UFs (capitais); fonte_mes (MERRA2 ou GEOSIT, quando identificada). Desde 2019."),
        _u(CSV["calendario"]): "data; nome; categoria (feriado_nacional, paixao, ponto_facultativo); base_legal; dia_semana. 2003 a 2027.",
    },
}


# =====================================================================================
# Coleta
# =====================================================================================

def _dia_brasilia(instante_utc):
    x = datetime.fromisoformat(instante_utc.replace("Z", "+00:00"))
    return (x - timedelta(hours=3)).date().isoformat()


def le_bronze(arquivo):
    """Bytes de um arquivo do bronze. Alguns servidores (IBGE) respondem com gzip mesmo
    sem pedido de compressão, e o download guarda o corpo como veio: desfaz a camada."""
    import gzip
    with base.abre_bronze(arquivo) as f:
        corpo = f.read()
    return gzip.decompress(corpo) if corpo[:2] == b"\x1f\x8b" else corpo


def _importada(con, vid):
    return con.execute("SELECT 1 FROM registros WHERE dataset=? AND chave=? AND campo='importada'",
                       (DS_CONTROLE, vid)).fetchone() is not None


def _registra_controle(con, vid):
    """A marca de importação precisa de uma vintage própria no dataset de controle (a
    tabela registros liga cada linha a uma vintage): usa o mesmo sha256 da vintage."""
    v = con.execute("SELECT recurso, url, capturado_em, publicado_em, sha256, bytes, arquivo FROM vintages WHERE vintage_id=?",
                    (vid,)).fetchone()
    cvid, _ = base.registra_vintage(con, DS_CONTROLE, v[0], v[1], v[2], v[3], v[4], v[5], "controle", v[6])
    return cvid


def importa_curva(con, vint):
    """Grava no silver os agregados de uma vintage da curva de carga (idempotente)."""
    vid = vint["vintage_id"]
    if _importada(con, vid):
        return None
    horario = ons.le_curva(ckan.le_csv_bronze(vint["arquivo"], separador=";"))
    novas, revs = base.grava_observacoes(con, DS_CURVA, vid, ons.agrega_curva(horario))
    cvid = _registra_controle(con, vid)
    base.grava_registros(con, DS_CONTROLE, cvid, [(vid, "importada", "1"), (vid, "linhas", len(horario)),
                                                  (vid, "novas", novas), (vid, "revisoes", revs)])
    con.commit()
    return novas, revs


def coleta_curva(con, status):
    def filtro(r):
        nome = (r.get("url") or "").rsplit("/", 1)[-1]
        return (r.get("format") or "").upper() == "CSV" and nome.startswith("CURVA_CARGA_") and nome[12:16].isdigit()

    st, _meta, vints = ckan.coleta_pacote(con, orgao="ONS", nome=ons.PACOTE_CURVA, dataset=DS_CURVA,
                                          filtro_recurso=filtro, ext_de=lambda r: "csv", max_idade_dias=30)
    status["curva"] = st
    for rec in sorted(vints):
        try:
            importa_curva(con, vints[rec])
        except Exception as e:  # arquivo corrompido não derruba os demais
            status.setdefault("falhas", []).append(f"curva {rec}: {e}"[:300])


def _meses(inicio, fim):
    a, m = int(inicio[:4]), int(inicio[5:7])
    while (a, m) <= (int(fim[:4]), int(fim[5:7])):
        yield f"{a:04d}-{m:02d}"
        a, m = (a + 1, 1) if m == 12 else (a, m + 1)


def _fim_mes(mes):
    a, m = int(mes[:4]), int(mes[5:7])
    return (date(a + (m == 12), m % 12 + 1, 1) - timedelta(days=1)).isoformat()


def importa_api(con, vint):
    vid = vint["vintage_id"]
    if _importada(con, vid):
        return None
    regs = ons.parse_api(le_bronze(vint["arquivo"]))
    horas, ctl = ons.agrega_api(regs, dia_limite=_dia_brasilia(vint["capturado_em"]))
    novas, revs = base.grava_observacoes(con, DS_API, vid, ons.observacoes_api(horas))
    cvid = _registra_controle(con, vid)
    base.grava_registros(con, DS_CONTROLE, cvid, [(vid, "importada", "1"), (vid, "novas", novas), (vid, "revisoes", revs)]
                         + [(vid, k, v) for k, v in ctl.items()])
    con.commit()
    return novas, revs


def coleta_api(con, status, hoje):
    st = {"novas": 0, "identicas": 0, "puladas": 0, "falhas": []}
    mes_atual = hoje.isoformat()[:7]
    mes_ant = (hoje.replace(day=1) - timedelta(days=1)).isoformat()[:7]
    for mes in _meses(ons.PRIMEIRO_MES_API, mes_atual):
        recente = mes in (mes_atual, mes_ant)
        for sm, area in ons.AREAS.items():
            rec = f"cargaverificada_{area}_{mes}"
            res = ckan.baixar_recurso(con, orgao="ONS", dataset=DS_API, recurso=rec,
                                      url=ons.url_api(area, f"{mes}-01", _fim_mes(mes)), publicado_em=None, ext="json",
                                      max_idade_dias=1 if recente else 30)
            chave = {"nova": "novas", "identica": "identicas", "pulada": "puladas"}.get(res["status"])
            if chave:
                st[chave] += 1
            else:
                st["falhas"].append(f"{rec}: {res['detalhe']}"[:200])
            if res["vintage"]:
                try:
                    importa_api(con, res["vintage"])
                except Exception as e:
                    st["falhas"].append(f"{rec}: importação: {e}"[:200])
    status["api"] = st


def coleta_ibge(con, status):
    """Centroide e nome de cada capital (IBGE) e população estimada por UF (SIDRA 6579)."""
    st = {"ok": True, "falhas": []}
    for uf, (cod, nome) in clima.CAPITAIS.items():
        for tipo, url in (("centroide", clima.URL_CENTROIDE.format(codigo=cod)), ("municipio", clima.URL_MUNICIPIO.format(codigo=cod))):
            res = ckan.baixar_recurso(con, orgao="IBGE", dataset=DS_IBGE_GEO, recurso=f"{tipo}_{cod}", url=url,
                                      publicado_em=None, ext="json", max_idade_dias=30)
            if res["status"] == "falha":
                st["falhas"].append(f"{tipo} {uf}: {res['detalhe']}"[:200])
    res = ckan.baixar_recurso(con, orgao="IBGE", dataset=DS_IBGE_POP, recurso="sidra_6579_uf_ultimo_ano", url=clima.URL_SIDRA_POP,
                              publicado_em=None, ext="json", max_idade_dias=30)
    if res["status"] == "falha":
        st["falhas"].append(f"SIDRA 6579: {res['detalhe']}"[:200])
    if res["vintage"]:
        pop, ano = clima.parse_populacao(le_bronze(res["vintage"]["arquivo"]))
        base.grava_observacoes(con, DS_IBGE_POP, res["vintage"]["vintage_id"], [(f"pop.{uf}", str(ano), v) for uf, v in pop.items()])
    st["ok"] = not st["falhas"]
    status["ibge"] = st
    con.commit()


def centroides(con):
    """{UF: (lat, lon, nome_ibge, codigo)} da última captura; confere código da UF e nome."""
    out = {}
    for uf, (cod, nome) in clima.CAPITAIS.items():
        v = base.ultima_vintage(con, DS_IBGE_GEO, f"centroide_{cod}")
        m = base.ultima_vintage(con, DS_IBGE_GEO, f"municipio_{cod}")
        if not v:
            continue
        lat, lon = clima.parse_centroide(le_bronze(v["arquivo"]))
        nome_ibge = None
        if m:
            import json as _json
            dm = _json.loads(le_bronze(m["arquivo"]).decode("utf-8"))
            nome_ibge = dm.get("nome")
            sigla = (((dm.get("microrregiao") or {}).get("mesorregiao") or {}).get("UF") or {}).get("sigla")
            if sigla and sigla != uf:
                continue  # código não corresponde à UF: fica fora (e aparece na cobertura)
        out[uf] = (lat, lon, nome_ibge or nome, cod, v)
    return out


def coleta_power(con, status, hoje):
    st = {"novas": 0, "identicas": 0, "puladas": 0, "falhas": [], "fontes_por_mes": {}}
    pontos = centroides(con)
    fim = (hoje - timedelta(days=1)).isoformat()
    for uf, (lat, lon, _, _, _) in sorted(pontos.items()):
        rec = f"power_{uf}"
        res = ckan.baixar_recurso(con, orgao="NASA", dataset=DS_POWER, recurso=rec,
                                  url=clima.url_power(lat, lon, clima.PRIMEIRO_DIA, fim), publicado_em=None, ext="json",
                                  max_idade_dias=1)
        chave = {"nova": "novas", "identica": "identicas", "pulada": "puladas"}.get(res["status"])
        if chave:
            st[chave] += 1
        else:
            st["falhas"].append(f"{rec}: {res['detalhe']}"[:200])
        v = res["vintage"]
        if v and not _importada(con, v["vintage_id"]):
            serie, fontes = clima.parse_power(le_bronze(v["arquivo"]))
            linhas = []
            for d, (t, tx) in serie.items():
                linhas.append((f"t2m.{uf}", d, t))
                linhas.append((f"t2m_max.{uf}", d, tx))
            base.grava_observacoes(con, DS_POWER, v["vintage_id"], linhas)
            cvid = _registra_controle(con, v["vintage_id"])
            base.grava_registros(con, DS_CONTROLE, cvid, [(v["vintage_id"], "importada", "1"),
                                                           (v["vintage_id"], "fontes", ",".join(fontes))])
            con.commit()
    # fonte por mês (MERRA-2 ou GEOS-IT): a resposta informa as fontes do período pedido,
    # não de cada dia; um pedido por mês recente num ponto (Brasília) identifica a troca
    if "DF" in pontos:
        lat, lon = pontos["DF"][0], pontos["DF"][1]
        m0 = (hoje.replace(day=1) - timedelta(days=100)).isoformat()[:7]
        for mes in _meses(m0, hoje.isoformat()[:7]):
            fim_m = min(_fim_mes(mes), fim)
            if fim_m < f"{mes}-01":
                continue
            rec = f"power_fonte_{mes}"
            res = ckan.baixar_recurso(con, orgao="NASA", dataset=DS_POWER, recurso=rec,
                                      url=clima.url_power(lat, lon, f"{mes}-01", fim_m), publicado_em=None, ext="json",
                                      max_idade_dias=1)
            if res["vintage"]:
                _, fontes = clima.parse_power(le_bronze(res["vintage"]["arquivo"]))
                st["fontes_por_mes"][mes] = fontes
                base.grava_registros(con, DS_POWER, res["vintage"]["vintage_id"], [(mes, "fontes", ",".join(fontes))])
    status["power"] = st
    con.commit()


def coleta_leis(con, status):
    st = {"ok": True, "falhas": [], "conferidas": 0}
    import json as _json
    for lei in cal.LEIS:
        url = cal.URL_SENADO_LISTA.format(numero=lei["numero"], ano=lei["ano"])
        res = ckan.baixar_recurso(con, orgao="SENADO", dataset=DS_LEIS, recurso=lei["id"], url=url, publicado_em=None,
                                  ext="json", max_idade_dias=30)
        v = res["vintage"]
        if not v:
            st["falhas"].append(f"{lei['id']}: {res['detalhe']}"[:200])
            continue
        try:
            dado = _json.loads(le_bronze(v["arquivo"]).decode("utf-8"))
        except ValueError:
            st["falhas"].append(f"{lei['id']}: resposta não é JSON")
            continue
        ok, ementa, id_senado = cal.confere_senado(lei, dado)
        st["conferidas"] += int(ok)
        base.grava_registros(con, DS_LEIS, v["vintage_id"], [(lei["id"], "norma", lei["norma"]), (lei["id"], "ementa", ementa),
                                                              (lei["id"], "id_senado", id_senado), (lei["id"], "conferida", int(ok))])
    st["ok"] = not st["falhas"]
    status["leis"] = st
    con.commit()


def coletar(con, ctx):
    hoje = ctx.get("hoje") or c.agora_date()
    status = {"ok": True}
    for nome, fn in (("curva", lambda: coleta_curva(con, status)), ("api", lambda: coleta_api(con, status, hoje)),
                     ("ibge", lambda: coleta_ibge(con, status)), ("power", lambda: coleta_power(con, status, hoje)),
                     ("leis", lambda: coleta_leis(con, status))):
        try:
            fn()
        except Exception as e:  # uma fonte fora do ar não impede as outras
            status.setdefault("falhas", []).append(f"{nome}: {e}"[:300])
            base.registra_coleta(con, f"carga_{nome}", "*", False, str(e))
            con.commit()
    status["ok"] = not status.get("falhas")
    return status


# =====================================================================================
# Gold: leitura do silver
# =====================================================================================

# Publicação do diagnóstico de 30/09/2026 (achado A07): a gold carga.json do commit
# d95d8f8b4 (gerada em 2026-09-30T02:20:27Z) exibia +10,5% para o SIN nos 7 dias até
# 28/09/2026 contra os mesmos dias de 2025. É a referência a reproduzir, não um dado: o
# número é recalculado aqui a partir do silver como estava naquele instante.
A07 = {"commit": "d95d8f8b4", "arquivo": "public/energia/gold/carga.json", "gerado_em": "2026-09-30T02:20:27Z",
       "sm": "SIN", "inicio": "2026-09-22", "fim": "2026-09-28", "inicio_anterior": "2025-09-22",
       "fim_anterior": "2025-09-28", "variacao_publicada_pct": 10.5}
CLASSES = ("util", "sabado", "domingo_feriado")
ROTULO_CLASSE = {"util": "dia útil", "sabado": "sábado", "domingo_feriado": "domingo ou feriado"}


def _br(v, casas=0):
    if v is None:
        return None
    txt = f"{abs(v):,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("−" if v < 0 else "") + txt


def _sinal(v, casas=1):
    if v is None:
        return None
    return ("+" if v > 0 else "") + _br(v, casas)


def _dias(ini, fim):
    x, f = date.fromisoformat(ini), date.fromisoformat(fim)
    out = []
    while x <= f:
        out.append(x.isoformat())
        x += timedelta(days=1)
    return out


def _desloca(dias, n):
    return [(date.fromisoformat(d) - timedelta(days=n)).isoformat() for d in dias]


def _ano_antes(dias):
    out = []
    for d in dias:
        x = date.fromisoformat(d)
        try:
            out.append(x.replace(year=x.year - 1).isoformat())
        except ValueError:  # 29/02 não tem par no ano anterior
            return None
    return out


def _soma_sin(por_sm, chaves=None):
    """Soma dos quatro subsistemas nas chaves (dias ou horas) em que os quatro existem."""
    comuns = set.intersection(*(set(por_sm[sm]) for sm in SMS))
    if chaves is not None:
        comuns &= set(chaves)
    return {k: sum(por_sm[sm][k] for sm in SMS) for k in comuns}


def carrega(con, con_p):
    """Séries do silver usadas pela gold (tudo em memória; ~1 milhão de pontos)."""
    val = gcarga.validacao_fisica(con_p, con)
    diaria = {sm: dict(val["aceitos"][sm]) for sm in SMS}
    diaria["SIN"] = _soma_sin(diaria)
    curva_h = {sm: dict(base.serie_vigente(con, DS_CURVA, f"carga_ho.{sm}")) for sm in SMS}
    curva_h["SIN"] = _soma_sin(curva_h)
    curva_d = {sm: {campo: dict(base.serie_vigente(con, DS_CURVA, f"{campo}.{sm}"))
                    for campo in ("media_dia", "pico_dia", "hora_pico", "horas_dia")} for sm in TODOS}
    api_g = {sm: dict(base.serie_vigente(con, DS_API, f"global_ho.{sm}")) for sm in SMS}
    api_m = {sm: dict(base.serie_vigente(con, DS_API, f"mmgd_ho.{sm}")) for sm in SMS}
    api_g["SIN"] = _soma_sin(api_g)
    api_m["SIN"] = _soma_sin(api_m)
    return {"val": val, "diaria": diaria, "curva_h": curva_h, "curva_d": curva_d, "api_g": api_g, "api_m": api_m}


def temperaturas(con):
    """Temperatura média e máxima ponderadas por subsistema e SIN, pesos e cobertura."""
    pop, ano_pop = {}, None
    for uf in clima.CAPITAIS:
        s = base.serie_vigente(con, DS_IBGE_POP, f"pop.{uf}")
        if s:
            ano_pop, pop[uf] = s[-1][0], s[-1][1]
    pesos = clima.pesos(pop)
    tm = {uf: dict(base.serie_vigente(con, DS_POWER, f"t2m.{uf}")) for uf in clima.CAPITAIS}
    tx = {uf: dict(base.serie_vigente(con, DS_POWER, f"t2m_max.{uf}")) for uf in clima.CAPITAIS}
    out = {sm: {"media": clima.temperatura_ponderada(tm, pesos[sm]), "maxima": clima.temperatura_ponderada(tx, pesos[sm])}
           for sm in TODOS}
    identificadas = {}
    for mes, _campo, valor in con.execute(
            """SELECT r.chave, r.campo, r.valor FROM registros r JOIN vintages v ON v.vintage_id=r.vintage_id
               WHERE r.dataset=? AND r.campo='fontes' ORDER BY v.capturado_em""", (DS_POWER,)):
        identificadas[mes] = ",".join(x for x in valor.split(",") if x and x != "POWER")
    # a resposta do POWER informa as fontes do período pedido; os meses recentes são
    # identificados um a um na coleta. O GEOS-IT só cobre o trecho que o MERRA-2 ainda não
    # alcançou, então todo mês anterior ao primeiro mês identificado como MERRA-2 é MERRA-2
    fontes_mes = {}
    merra = sorted(m for m, f in identificadas.items() if f == "MERRA2")
    todos_meses = sorted({d[:7] for sm in out for d in out[sm]["media"]})
    for mes in todos_meses:
        if mes in identificadas:
            fontes_mes[mes] = identificadas[mes]
        elif merra and mes < merra[0]:
            fontes_mes[mes] = "MERRA2"
    return {"series": out, "pesos": pesos, "populacao": pop, "ano_populacao": ano_pop, "fontes_mes": fontes_mes,
            "fontes_identificadas": identificadas,
            "capitais_com_dado": sorted(uf for uf in tm if tm[uf])}


def _vintages(con, ds, prefixo=None):
    vs = base.vintages_do_dataset(con, ds)
    ult = {}
    for v in vs:
        if prefixo and not v["recurso"].startswith(prefixo):
            continue
        ult[v["recurso"]] = v
    return ult


# =====================================================================================
# P025: nível, crescimento, comparações equivalentes e revisões
# =====================================================================================

# Dias entre a data declarada pelo ONS para a inclusão da MMGD na carga (29/04/2023) e a
# data em que ela aparece nos dados (detectada em bloco_a11_carga): nenhum dos dois regimes
# vale para eles com segurança, então comparação que os toca não vira variação.
_TRANSICAO = set()


def _regime(d):
    return "transicao" if d in _TRANSICAO else gcarga.regime_de(d)


def comparacao(serie, dias_a, dias_b, tipo):
    """Média de dois conjuntos de dias e variação, só no mesmo regime e com todos os dias."""
    if dias_b is None or not all(d in serie for d in dias_a + dias_b):
        return None
    regs = {_regime(d) for d in dias_a + dias_b}
    mesmo = len(regs) == 1
    ma = sum(serie[d] for d in dias_a) / len(dias_a)
    mb = sum(serie[d] for d in dias_b) / len(dias_b)
    ca, cb = cal.composicao(dias_a), cal.composicao(dias_b)
    return {
        "tipo": tipo, "inicio": dias_a[0], "fim": dias_a[-1], "inicio_ant": dias_b[0], "fim_ant": dias_b[-1],
        "dias": len(dias_a), "media": c.r(ma, 1), "media_ant": c.r(mb, 1),
        "variacao_pct": c.r(100 * (ma / mb - 1), 2) if mesmo and mb else None,
        "mesmo_regime": mesmo,
        "calendario_equivalente": ca["classes"] == cb["classes"] and ca["dias_semana"] == cb["dias_semana"],
        "classes": ca["classes"], "classes_ant": cb["classes"],
        "eventos": ca["eventos"], "eventos_ant": cb["eventos"],
    }


def janelas(dia_ref):
    f = date.fromisoformat(dia_ref)
    out = {}
    out["7d"] = _dias((f - timedelta(days=6)).isoformat(), dia_ref)
    out["28d"] = _dias((f - timedelta(days=27)).isoformat(), dia_ref)
    out["mes_corrente"] = _dias(f.replace(day=1).isoformat(), dia_ref)
    ini_ult = (f.replace(day=1) - timedelta(days=1)).replace(day=1)
    out["ultimo_mes_completo"] = _dias(ini_ult.isoformat(), (f.replace(day=1) - timedelta(days=1)).isoformat())
    out["52_semanas"] = _dias((f - timedelta(days=363)).isoformat(), dia_ref)
    return out


ROTULO_JANELA = {"7d": "últimos 7 dias", "28d": "últimos 28 dias (4 semanas)", "mes_corrente": "mês corrente até o último dia",
                 "ultimo_mes_completo": "último mês completo", "52_semanas": "últimas 52 semanas"}


def _num_comp(x):
    if not x:
        return None
    return {"inicio_ant": x["inicio_ant"], "fim_ant": x["fim_ant"], "media": x["media"], "media_ant": x["media_ant"],
            "variacao_pct": x["variacao_pct"], "mesmo_regime": x["mesmo_regime"]}


def _eventos_curtos(evs):
    return [[e["data"], e["nome"], e["categoria"]] for e in evs]


def bloco_comparacoes(diaria, dia_ref):
    """Janelas (composição de calendário uma vez, é nacional) e números por subsistema."""
    js = janelas(dia_ref)
    meta, por_sm, csv = [], [], []
    for jid, dias_a in js.items():
        mesmas = _ano_antes(dias_a)
        equiv = _desloca(dias_a, 364)
        ca, cb, ce = cal.composicao(dias_a), cal.composicao(mesmas) if mesmas else None, cal.composicao(equiv)
        meta.append({"id": jid, "rotulo": ROTULO_JANELA[jid], "inicio": dias_a[0], "fim": dias_a[-1], "dias": len(dias_a),
                     "classes": ca["classes"], "classes_mesmas_datas": cb["classes"] if cb else None, "classes_equivalente": ce["classes"],
                     "calendario_equivalente_mesmas_datas": bool(cb) and ca["classes"] == cb["classes"] and ca["dias_semana"] == cb["dias_semana"],
                     "calendario_equivalente_364d": ca["classes"] == ce["classes"] and ca["dias_semana"] == ce["dias_semana"],
                     "eventos": _eventos_curtos(ca["eventos"]), "eventos_mesmas_datas": _eventos_curtos(cb["eventos"]) if cb else [],
                     "eventos_equivalente": _eventos_curtos(ce["eventos"])})
    for sm in TODOS:
        item = {"sm": sm, "janelas": {}}
        for jid, dias_a in js.items():
            bruta = comparacao(diaria[sm], dias_a, _ano_antes(dias_a), "mesmas_datas")
            equiv = comparacao(diaria[sm], dias_a, _desloca(dias_a, 364), "equivalente")
            item["janelas"][jid] = {"mesmas_datas": _num_comp(bruta), "equivalente": _num_comp(equiv)}
            for x in (bruta, equiv):
                if x:
                    csv.append([sm, jid, x["tipo"], x["inicio"], x["fim"], x["inicio_ant"], x["fim_ant"], x["media"], x["media_ant"],
                                x["variacao_pct"], int(x["mesmo_regime"]), x["classes"]["util"], x["classes_ant"]["util"],
                                len(cal.feriados_em_dia_util(_dias(x["inicio"], x["fim"]))),
                                len(cal.feriados_em_dia_util(_dias(x["inicio_ant"], x["fim_ant"])))])
        por_sm.append(item)
    return {"janelas": meta, "subsistemas": por_sm}, csv


def bloco_anual(diaria, dia_ref):
    """Média anual por subsistema; variação só entre anos completos do mesmo regime. O
    ano corrente entra como acumulado até o último dia contra o mesmo período do ano
    anterior deslocado 364 dias (mesmos dias da semana)."""
    out = []
    anos = sorted({d[:4] for d in diaria["SIN"]})
    medias = {}
    for a in anos:
        n_ano = 366 if int(a) % 4 == 0 else 365
        dias = [d for d in diaria["SIN"] if d[:4] == a]
        completo = len(dias) == n_ano
        regs = sorted({gcarga.regime_de(d) for d in dias})
        if any(d in _TRANSICAO for d in dias):
            regs = sorted(set(regs) | {-1})  # ano com dias de transição: sem variação
        linha = {"ano": int(a), "dias": len(dias), "completo": completo, "regimes": [r + 1 for r in regs if r >= 0]}
        for sm in TODOS:
            ds = [d for d in diaria[sm] if d[:4] == a]
            linha[sm] = c.r(sum(diaria[sm][d] for d in ds) / len(ds), 1) if ds else None
        medias[a] = (linha, regs)
        ant = medias.get(str(int(a) - 1))
        linha["variacao_pct"] = None
        if completo and ant and ant[0]["completo"] and len(regs) == 1 and ant[1] == regs:
            linha["variacao_pct"] = {sm: c.r(100 * (linha[sm] / ant[0][sm] - 1), 2) for sm in TODOS if linha[sm] and ant[0][sm]}
        out.append(linha)
    f = date.fromisoformat(dia_ref)
    ytd = _dias(f.replace(month=1, day=1).isoformat(), dia_ref)
    acum = {"inicio": ytd[0], "fim": ytd[-1], "inicio_ant": _desloca(ytd, 364)[0], "fim_ant": _desloca(ytd, 364)[-1], "sm": {}}
    for sm in TODOS:
        x = comparacao(diaria[sm], ytd, _desloca(ytd, 364), "equivalente")
        acum["sm"][sm] = {"media": x["media"], "media_ant": x["media_ant"], "variacao_pct": x["variacao_pct"],
                          "mesmo_regime": x["mesmo_regime"]} if x else None
    return out, acum


def bloco_mensal(diaria, dia_ref, meses=36):
    """Últimos meses completos: média por subsistema e variação contra o mesmo mês do
    ano anterior (datas do calendário), com a contagem de dias úteis dos dois meses."""
    ult = date.fromisoformat(dia_ref)
    fim_completo = ult if (ult + timedelta(days=1)).day == 1 else ult.replace(day=1) - timedelta(days=1)
    lista = []
    m = fim_completo.replace(day=1)
    for _ in range(meses):
        lista.append(m.isoformat()[:7])
        m = (m - timedelta(days=1)).replace(day=1)
    out = []
    for mes in sorted(lista):
        dias = _dias(f"{mes}-01", _fim_mes(mes))
        ant = _ano_antes(dias) or [d for d in _ano_antes([x for x in dias if x[5:] != "02-29"]) or []]
        linha = {"m": mes, "dias_uteis": cal.composicao(dias)["classes"]["util"],
                 "dias_uteis_ant": cal.composicao(ant)["classes"]["util"] if ant else None}
        for sm in TODOS:
            if not all(d in diaria[sm] for d in dias):
                linha[sm] = None
                continue
            ma = sum(diaria[sm][d] for d in dias) / len(dias)
            linha[sm] = c.r(ma, 1)
            if ant and all(d in diaria[sm] for d in ant) and len({_regime(d) for d in dias + ant}) == 1:
                mb = sum(diaria[sm][d] for d in ant) / len(ant)
                linha[f"var_{sm}"] = c.r(100 * (ma / mb - 1), 2)
            else:
                linha[f"var_{sm}"] = None
        out.append(linha)
    return out


def bloco_revisoes(con_p, dados):
    """Revisões da carga diária entre as vintages do silver principal, e a diferença
    entre a curva horária (captura mais nova) e a carga diária nos últimos dias."""
    linhas = []
    for sm in SMS:
        for ref, hist in base.revisoes_da_serie(con_p, DS_DIARIA, f"carga_mwmed.{sm}"):
            for (cap0, v0), (cap1, v1) in zip(hist, hist[1:]):
                linhas.append({"sm": sm, "dia": ref, "capturado_em": cap1, "capturado_em_ant": cap0, "valor": v1, "valor_ant": v0,
                               "diferenca": c.r(v1 - v0, 3), "diferenca_pct": c.r(100 * (v1 / v0 - 1), 3) if v0 and v0 > 0 else None,
                               "situacao": "correcao_de_valor_fora_do_dominio" if v0 is not None and v0 <= 0 else "revisao"})
    vints = _vintages(con_p, DS_DIARIA)
    caps = sorted({v["capturado_em"] for v in vints.values()})
    difs = [abs(x["diferenca_pct"]) for x in linhas if x["diferenca_pct"] is not None and x["situacao"] == "revisao"]
    # curva horária (captura mais recente) contra a carga diária vigente, dia a dia
    curva_vs = []
    for sm in SMS:
        cu = dados["curva_d"][sm]["media_dia"]
        di = dados["val"]["brutas"][sm]
        for d in sorted(set(cu) & set(di)):
            if abs(cu[d] - di[d]) > 0.01:
                curva_vs.append({"sm": sm, "dia": d, "curva": c.r(cu[d], 3), "diaria": c.r(di[d], 3), "diferenca": c.r(cu[d] - di[d], 3)})
    n_comuns = sum(len(set(dados["curva_d"][sm]["media_dia"]) & set(dados["val"]["brutas"][sm])) for sm in SMS)
    return {
        "capturas_diaria": caps,
        "total": len(linhas), "dias_revisados": len({(x["sm"], x["dia"]) for x in linhas}),
        "mediana_abs_pct": c.r(sorted(difs)[len(difs) // 2], 3) if difs else None,
        "max_abs_pct": c.r(max(difs), 3) if difs else None,
        "linhas": linhas,
        "curva_contra_diaria": {"dias_comparados": n_comuns, "dias_diferentes": len(curva_vs),
                                "tolerancia": "0,01 MWmed", "exemplos": curva_vs[-40:],
                                "leitura": ("A média das 24 horas da curva horária reproduz a carga diária em quase todos os dias; "
                                            "as diferenças ficam num trecho de 2017 e 2018 (SE e S), em dias de mudança do horário de verão "
                                            "e nos dias mais recentes, que o ONS revisou depois da captura diária.")},
    }


# =====================================================================================
# P026: curva horária, pico, MMGD e carga líquida
# =====================================================================================

def _dia_completo(horas_dict, dia):
    return all(f"{dia}T{h:02d}:00" in horas_dict for h in range(24))


def perfis(dados, meses, sms=TODOS):
    """Perfil horário típico: média por hora dos dias completos de cada classe do mês.
    Curva (carga) e API (carga global, MMGD, carga líquida) em dias completos próprios."""
    out = []
    for mes in meses:
        dias = _dias(f"{mes}-01", _fim_mes(mes))
        for sm in sms:
            ch, g, m = dados["curva_h"][sm], dados["api_g"][sm], dados["api_m"][sm]
            for cl in CLASSES:
                dcl = [d for d in dias if cal.classifica(d) == cl]
                dc = [d for d in dcl if _dia_completo(ch, d)]
                da = [d for d in dcl if _dia_completo(g, d) and _dia_completo(m, d)]
                if not dc and not da:
                    continue
                serie = {"carga": [], "global": [], "mmgd": [], "liquida": []}
                for h in range(24):
                    hh = f"T{h:02d}:00"
                    carga = sum(ch[d + hh] for d in dc) / len(dc) if dc else None
                    gl = sum(g[d + hh] for d in da) / len(da) if da else None
                    mm = sum(m[d + hh] for d in da) / len(da) if da else None
                    serie["carga"].append(c.r(carga, 0))
                    serie["global"].append(c.r(gl, 0))
                    serie["mmgd"].append(c.r(mm, 0))
                    serie["liquida"].append(c.r(gl - mm, 0) if gl is not None and mm is not None else None)
                out.append({"mes": mes, "sm": sm, "classe": cl, "dias_curva": len(dc), "dias_api": len(da), **serie})
    return out


def bloco_p026(dados, dia_ref):
    ch_sin = dados["curva_h"]["SIN"]
    g_sin, m_sin = dados["api_g"]["SIN"], dados["api_m"]["SIN"]
    dias_curva = sorted({h[:10] for h in ch_sin})
    ult_curva = next((d for d in reversed(dias_curva) if _dia_completo(ch_sin, d)), None)
    dias_api = sorted({h[:10] for h in g_sin})
    ult_api = next((d for d in reversed(dias_api) if _dia_completo(g_sin, d) and _dia_completo(m_sin, d)), None)
    if not ult_curva or not ult_api:
        raise ValueError("curva horária ou carga verificada sem dia completo")
    ult = min(ult_curva, ult_api)
    # curvas dos últimos 7 dias completos
    ini7 = (date.fromisoformat(ult) - timedelta(days=6)).isoformat()
    recente = []
    for d in _dias(ini7, ult):
        for h in range(24):
            k = f"{d}T{h:02d}:00"
            row = {"h": k}
            for sm in TODOS:
                row[sm] = c.r(dados["curva_h"][sm].get(k), 0)
            gv, mv = g_sin.get(k), m_sin.get(k)
            row["global"] = c.r(gv, 0)
            row["mmgd"] = c.r(mv, 0)
            row["liquida"] = c.r(gv - mv, 0) if gv is not None and mv is not None else None
            recente.append(row)
    # perfis: 12 meses completos para o SIN; último mês completo para cada subsistema;
    # o mesmo mês do calendário em cada ano desde 2019 (evolução)
    fim_m = date.fromisoformat(ult)
    fim_completo = fim_m if (fim_m + timedelta(days=1)).day == 1 else fim_m.replace(day=1) - timedelta(days=1)
    meses12 = []
    x = fim_completo.replace(day=1)
    for _ in range(12):
        meses12.append(x.isoformat()[:7])
        x = (x - timedelta(days=1)).replace(day=1)
    meses12.sort()
    perf_sin = [p for p in perfis(dados, meses12, ("SIN",)) if p["classe"] != "sabado" or p["mes"] == meses12[-1]]
    perf_sm = perfis(dados, [meses12[-1]], SMS)
    mes_cal = meses12[-1][5:]
    anos_evol = [f"{a}-{mes_cal}" for a in range(2019, int(meses12[-1][:4]) + 1)]
    perf_evol = [p for p in perfis(dados, anos_evol, ("SIN",)) if p["classe"] == "util"]
    # pico diário: curva (carga) e API (global e líquida), SIN nos últimos 365 dias
    ini365 = (date.fromisoformat(ult) - timedelta(days=364)).isoformat()
    ini90 = (date.fromisoformat(ult) - timedelta(days=89)).isoformat()
    picos = []
    for d in _dias(ini90, ult):
        cd = dados["curva_d"]["SIN"]
        linha = {"d": d, "pico": c.r(cd["pico_dia"].get(d), 0), "hora": int(cd["hora_pico"][d]) if d in cd["hora_pico"] else None,
                 "pico_liquida": None, "hora_liquida": None}
        if _dia_completo(g_sin, d) and _dia_completo(m_sin, d):
            liq = {h: g_sin[f"{d}T{h:02d}:00"] - m_sin[f"{d}T{h:02d}:00"] for h in range(24)}
            hl = min(liq, key=lambda k: (-liq[k], k))
            linha.update({"pico_liquida": c.r(liq[hl], 0), "hora_liquida": hl})
        picos.append(linha)
    # distribuição da hora do pico por ano (dias úteis e demais juntos; contagem de dias)
    dist = {}
    for sm in TODOS:
        hp = dados["curva_d"][sm]["hora_pico"]
        por_ano = defaultdict(lambda: [0] * 24)
        for d, h in hp.items():
            por_ano[d[:4]][int(h)] += 1
        dist[sm] = [{"ano": int(a), "dias": sum(v), "contagem": v, "regimes": sorted({gcarga.regime_de(f"{a}-01-01") + 1, gcarga.regime_de(f"{a}-12-31") + 1})}
                    for a, v in sorted(por_ano.items()) if sm == "SIN" or int(a) >= 2019]
    dist_liq = []
    por_ano_l = defaultdict(lambda: [0] * 24)
    por_ano_g = defaultdict(lambda: [0] * 24)
    for d in dias_api:
        if not (_dia_completo(g_sin, d) and _dia_completo(m_sin, d)):
            continue
        liq = {h: g_sin[f"{d}T{h:02d}:00"] - m_sin[f"{d}T{h:02d}:00"] for h in range(24)}
        gl = {h: g_sin[f"{d}T{h:02d}:00"] for h in range(24)}
        por_ano_l[d[:4]][min(liq, key=lambda k: (-liq[k], k))] += 1
        por_ano_g[d[:4]][min(gl, key=lambda k: (-gl[k], k))] += 1
    for a in sorted(por_ano_l):
        dist_liq.append({"ano": int(a), "dias": sum(por_ano_l[a]), "contagem_liquida": por_ano_l[a], "contagem_global": por_ano_g[a]})
    # maior carga horária de cada ano (curva) por subsistema
    recordes = []
    for sm in TODOS:
        pdia = dados["curva_d"][sm]["pico_dia"]
        por_ano = {}
        for d, v in pdia.items():
            if d[:4] not in por_ano or v > por_ano[d[:4]][1]:
                por_ano[d[:4]] = (d, v)
        for a, (d, v) in sorted(por_ano.items()):
            recordes.append({"sm": sm, "ano": int(a), "dia": d, "hora": int(dados["curva_d"][sm]["hora_pico"][d]), "pico": c.r(v, 0)})
    # MMGD mensal (API): média em dias completos, participação na carga global
    mensal = []
    for sm in TODOS:
        g, m = dados["api_g"][sm], dados["api_m"][sm]
        por_mes = defaultdict(lambda: [0.0, 0.0, 0])
        for d in sorted({h[:10] for h in m}):
            if not (_dia_completo(g, d) and _dia_completo(m, d)):
                continue
            ks = [f"{d}T{h:02d}:00" for h in range(24)]
            x = por_mes[d[:7]]
            x[0] += sum(g[k] for k in ks)
            x[1] += sum(m[k] for k in ks)
            x[2] += 1
        for mes, (sg, sm_, n) in sorted(por_mes.items()):
            if sm != "SIN" and mes < meses12[0]:
                continue  # subsistemas: 12 meses na gold; o histórico inteiro está no CSV diário
            mensal.append({"m": mes, "sm": sm, "dias": n, "dias_no_mes": len(_dias(f"{mes}-01", _fim_mes(mes))),
                           "global": c.r(sg / (24 * n), 0), "mmgd": c.r(sm_ / (24 * n), 0), "mmgd_pct": c.r(100 * sm_ / sg, 2)})
    # compatibilidade: carga global (API) contra a curva, mesmas horas
    compat = []
    for sm in TODOS:
        ch, g = dados["curva_h"][sm], dados["api_g"][sm]
        por_ano = defaultdict(lambda: [0.0, 0.0, 0])
        for k, v in g.items():
            if k in ch:
                x = por_ano[k[:4]]
                x[0] += v
                x[1] += ch[k]
                x[2] += 1
        for a, (sg, sc, n) in sorted(por_ano.items()):
            compat.append({"sm": sm, "ano": int(a), "horas": n, "global_mwmed": c.r(sg / n, 0), "curva_mwmed": c.r(sc / n, 0),
                           "diferenca_pct": c.r(100 * (sg / sc - 1), 2)})
    por_hora = []
    for h in range(24):
        sg = sc = 0.0
        n = 0
        for d in _dias(ini365, ult):
            k = f"{d}T{h:02d}:00"
            if k in g_sin and k in ch_sin:
                sg += g_sin[k]
                sc += ch_sin[k]
                n += 1
        por_hora.append({"hora": h, "horas": n, "diferenca_mwmed": c.r((sg - sc) / n, 0) if n else None,
                         "diferenca_pct": c.r(100 * (sg / sc - 1), 2) if n and sc else None})
    return {
        "ultimo_dia": ult, "ultimo_dia_curva": ult_curva, "ultimo_dia_api": ult_api,
        "recente": recente, "perfil_sin_12m": perf_sin, "perfil_subsistemas": perf_sm, "perfil_evolucao": perf_evol,
        "meses_perfil": meses12, "picos_90d": picos, "hora_pico_por_ano": dist, "hora_pico_api_sin_por_ano": dist_liq,
        "recordes_anuais": recordes, "mmgd_mensal": mensal,
        "compatibilidade": {"por_ano": compat, "por_hora_sin_365d": por_hora,
                            "conclusao": ("A carga global da API de carga verificada não é a mesma grandeza da curva de carga: "
                                          "difere ano a ano e hora a hora (mais à noite). Carga, MMGD e carga líquida só são "
                                          "decompostas dentro da API; a MMGD da API nunca é subtraída da curva.")},
    }


# =====================================================================================
# P027: decomposição estatística por clima e calendário (fora da amostra)
# =====================================================================================

def roda_modelos(dados, temps, inicio_regime=modelo.INICIO_REGIME):
    """{sm: {variante: resultado}} (ver fontes/modelo_carga.avaliar)."""
    out = {}
    for sm in TODOS:
        t = temps["series"][sm]
        out[sm] = {}
        for var in modelo.VARIANTES:
            out[sm][var] = modelo.avaliar(dados["diaria"][sm], t["media"], t["maxima"], var,
                                          inicio_regime=inicio_regime, excluir=sorted(_TRANSICAO))
    return out


# =====================================================================================
# A11 (parte de carga): data em que a MMGD entra na carga, conferida nos dados
# =====================================================================================

def _salto(serie, dias_busca, antes=3, depois=3):
    """Dia de maior degrau: média de `depois` dias a partir do dia menos a média dos
    `antes` dias anteriores. Retorna (dia, degrau) ou (None, None)."""
    melhor = (None, None)
    for d in dias_busca:
        x = date.fromisoformat(d)
        ant = [serie.get((x - timedelta(days=i)).isoformat()) for i in range(1, antes + 1)]
        dep = [serie.get((x + timedelta(days=i)).isoformat()) for i in range(depois)]
        if None in ant or None in dep:
            continue
        deg = sum(dep) / depois - sum(ant) / antes
        if melhor[1] is None or deg > melhor[1]:
            melhor = (d, deg)
    return melhor


def bloco_a11_carga(con_p, dados, declarado="2023-04-29", raio=10):
    """Compara, dia a dia, a carga diária do SIN com a carga global e a MMGD da API (outro
    produto do ONS, que traz a MMGD separada desde 2019): se a carga passa a incluir a
    MMGD, a diferença carga − carga global sobe de degrau no dia da inclusão, e ao meio-dia
    o degrau tem o tamanho da MMGD daquela hora. A geração solar do balanço (silver
    principal) é olhada na mesma janela, só como contexto (é do módulo Geração)."""
    g, m, di = dados["api_g"]["SIN"], dados["api_m"]["SIN"], dados["diaria"]["SIN"]
    ch = dados["curva_h"]["SIN"]
    x0 = date.fromisoformat(declarado)
    janela = [(x0 + timedelta(days=i)).isoformat() for i in range(-raio - 5, raio + 6)]
    dif, meio, mm, solar = {}, {}, {}, {}
    bal = {sm: dict(base.serie_vigente(con_p, "balanco_energia_subsistema_ho", f"solar.{sm}")) for sm in SMS}
    for d in janela:
        ks = [f"{d}T{h:02d}:00" for h in range(24)]
        if d in di and all(k in g for k in ks):
            dif[d] = di[d] - sum(g[k] for k in ks) / 24
        k12 = f"{d}T12:00"
        if k12 in ch and k12 in g and k12 in m:
            meio[d] = ch[k12] - g[k12]
            mm[d] = m[k12]
        if all(all(k in bal[sm] for k in ks) for sm in SMS):
            solar[d] = sum(bal[sm][k] for sm in SMS for k in ks) / 24
    busca = [(x0 + timedelta(days=i)).isoformat() for i in range(-raio, raio + 1)]
    d_carga, deg_carga = _salto(dif, busca)
    d_meio, deg_meio = _salto(meio, busca)
    d_solar, deg_solar = _salto(solar, busca)
    textos = []
    if d_carga and d_meio:
        textos.append(f"O ONS declara a inclusão da MMGD estimada na carga a partir de {c.data_br(declarado)}. Na carga diária e na curva "
                      f"horária, o degrau aparece em {c.data_br(d_carga)} (carga − carga global da API: {_sinal(deg_carga, 0)} MWmed no dia; "
                      f"às 12h, {_sinal(deg_meio, 0)} MWmed, quando a MMGD estimada pela API às 12h teve média de "
                      f"{_br(sum(mm.values()) / len(mm), 0) if mm else 'sem dado'} MWmed na janela analisada).")
    if d_solar:
        textos.append(f"A geração solar do balanço de energia (outro conjunto do ONS) sobe de degrau em {c.data_br(d_solar)} "
                      f"({_sinal(deg_solar, 0)} MWmed no dia).")
    if d_carga and d_solar and d_carga != d_solar:
        textos.append("Entre as duas datas, a MMGD já aparece na geração do balanço e ainda não na carga: comparações de carga que "
                      "tocam esses dias não são publicadas como variação, e o modelo estatístico começa no dia observado.")
    return {
        "declarado": declarado, "observado_carga": d_carga, "observado_meio_dia": d_meio, "observado_solar_balanco": d_solar,
        "degrau_carga_menos_global_mwmed": c.r(deg_carga, 0), "degrau_meio_dia_mwmed": c.r(deg_meio, 0),
        "degrau_solar_balanco_mwmed": c.r(deg_solar, 0),
        "mmgd_meio_dia_media_mwmed": c.r(sum(mm.values()) / len(mm), 0) if mm else None,
        "dias": [{"d": d, "carga_menos_global": c.r(dif.get(d), 0), "meio_dia_curva_menos_global": c.r(meio.get(d), 0),
                  "mmgd_meio_dia": c.r(mm.get(d), 0), "solar_balanco": c.r(solar.get(d), 0)} for d in janela],
        "regra": ("Dia de maior degrau (média dos 3 dias a partir do dia menos a média dos 3 dias anteriores) num raio de 10 dias "
                  "em torno da data declarada, em três séries: carga diária − carga global da API; curva − carga global da API às 12h; "
                  "geração solar do balanço."),
        "textos": textos,
    }



def _metricas_pub(m):
    return {k: (c.r(v, 3) if isinstance(v, float) else v) for k, v in m.items()}


def bloco_p027(res, temps, dia_ref):
    principal = {sm: res[sm]["principal"] for sm in TODOS}
    if not all(principal.values()):
        return None
    metricas = {sm: _metricas_pub(principal[sm]["metricas"]) for sm in TODOS}
    sens = []
    for sm in TODOS:
        for var, r in res[sm].items():
            if r:
                sens.append({"sm": sm, "variante": var, "rotulo": r["rotulo"], **_metricas_pub(r["metricas"])})
    ps = principal["SIN"]["previsoes"]
    ini = (date.fromisoformat(ps[-1]["d"]) - timedelta(days=89)).isoformat()
    recente = [{"d": x["d"], "real": c.r(x["real"], 0), "previsto": c.r(x["previsto"], 0), "p10": c.r(x["p10"], 0),
                "p90": c.r(x["p90"], 0), "p025": c.r(x["p025"], 0), "p975": c.r(x["p975"], 0),
                "residuo_pct": c.r(100 * (x["real"] / x["previsto"] - 1), 2),
                **{g: c.r(100 * v, 2) for g, v in x["contrib_log"].items()}, "origem": x["origem"]}
               for x in ps if x["d"] >= ini]
    por_origem = [{"origem": o["origem"], "dias_treino": o["dias_treino"], "dias": o["dias_previstos"],
                   "mape_pct": c.r(o["mape_pct"], 2), "vies_pct": c.r(o["vies_pct"], 2), "fonte_intervalo": o["fonte_intervalo"]}
                  for o in principal["SIN"]["por_origem"]]
    resposta = {}
    for sm in TODOS:
        ts = [v for v in temps["series"][sm]["media"].values()]
        lo, hi = math.floor(modelo.quantil(ts, 0.01)), math.ceil(modelo.quantil(ts, 0.99))
        curva = modelo.resposta_temperatura(principal[sm], [float(t) for t in range(lo, hi + 1)])
        resposta[sm] = {"faixa_observada": [lo, hi], "nos": principal[sm]["nos_temperatura"],
                        "pontos": [[t, c.r(v, 2)] for t, v in curva]}
    u = principal["SIN"]["ultimo_ajuste"]
    coef = [{"variavel": n, "grupo": g, "coeficiente": c.r(u["beta"][j], 6), "ativa": j in u["ativas"]}
            for j, (n, g) in enumerate(zip(principal["SIN"]["_nomes"], principal["SIN"]["_grupos"]))]
    erros = sorted(100 * (x["real"] / x["previsto"] - 1) for x in ps)
    return {
        "natureza": "ESTIMADO",
        "nome": "Decomposição estatística da carga diária (não causal)",
        "especificacao": {
            "alvo": "ln(carga diária em MWmed), por subsistema e SIN",
            "estimador": "mínimos quadrados ordinários",
            "variaveis": principal["SIN"]["variaveis"],
            "nos_temperatura": {sm: principal[sm]["nos_temperatura"] for sm in TODOS},
            "inicio_treino": principal["SIN"]["inicio_treino"], "primeira_origem": modelo.PRIMEIRA_ORIGEM,
            "origens": "primeiro dia de cada mês; o modelo usa só dias anteriores à origem e prevê o mês com temperatura e calendário realizados",
            "intervalo": f"quantis empíricos dos erros fora da amostra de origens anteriores (mínimo de {modelo.MIN_ERROS_INTERVALO} dias); antes disso, dos resíduos do treino",
            "contribuicoes": "β × (x − média de x no treino), somadas por grupo, em log × 100 (aproximadamente pontos percentuais)",
            "temperatura": "média diária a 2 m (NASA POWER) nas capitais, ponderada pela população da UF (IBGE); dobras nos tercis da primeira janela de treino; temperatura do dia anterior",
        },
        "metricas": metricas, "sensibilidade": sens, "por_origem_sin": por_origem,
        "erros_sin_pct": {"p05": c.r(modelo.quantil(erros, 0.05), 2), "p25": c.r(modelo.quantil(erros, 0.25), 2),
                          "mediana": c.r(modelo.quantil(erros, 0.5), 2), "p75": c.r(modelo.quantil(erros, 0.75), 2),
                          "p95": c.r(modelo.quantil(erros, 0.95), 2)},
        "recente_sin": recente, "resposta_temperatura": resposta, "coeficientes_sin": coef,
        "ultimo_ajuste_sin": {"origem": u["origem"], "dias_treino": u["n_treino"], "ultimo_dia_treino": u["ultimo_dia_treino"],
                              "dp_residuo_treino_log100": c.r(100 * u["residuos_treino_dp"], 3)},
        "leitura": ("Contribuição é a mudança da previsão do modelo associada a cada grupo de variáveis, com o resto fixo; não "
                    "é efeito causal nem parcela 'explicada'. O resíduo é o que o modelo não reproduz."),
    }


# =====================================================================================
# A07: +10,5% em sete dias, reproduzido com datas, versão e calendário
# =====================================================================================

def bloco_a07(con_p, dados, temps, res):
    ref = A07
    dias_a = _dias(ref["inicio"], ref["fim"])
    dias_b = _dias(ref["inicio_anterior"], ref["fim_anterior"])
    dias_e = _desloca(dias_a, 364)
    # 1) reprodução: silver como estava no instante em que a gold foi gerada
    como = {sm: dict(base.como_estava_em(con_p, DS_DIARIA, f"carga_mwmed.{sm}", ref["gerado_em"])) for sm in SMS}
    como["SIN"] = _soma_sin(como)
    rep = comparacao(como["SIN"], dias_a, dias_b, "mesmas_datas")
    vints = [v for v in base.vintages_do_dataset(con_p, DS_DIARIA) if v["capturado_em"] <= ref["gerado_em"]
             and v["recurso"] in ("CARGA_ENERGIA_2025", "CARGA_ENERGIA_2026")]
    usadas = {}
    for v in vints:
        usadas[v["recurso"]] = v
    # 2) valores da janela em cada captura do arquivo de 2026 (revisões)
    por_captura = []
    for v in sorted((x for x in base.vintages_do_dataset(con_p, DS_DIARIA) if x["recurso"] == "CARGA_ENERGIA_2026"),
                    key=lambda x: x["capturado_em"]):
        s = {sm: dict(base.como_estava_em(con_p, DS_DIARIA, f"carga_mwmed.{sm}", v["capturado_em"])) for sm in SMS}
        linha = {"capturado_em": v["capturado_em"], "sha256": v["sha256"], "dias": []}
        for d in dias_a:
            vals = {sm: s[sm].get(d) for sm in SMS}
            linha["dias"].append({"d": d, **{sm: c.r(x, 3) for sm, x in vals.items()},
                                  "SIN": c.r(sum(vals.values()), 3) if all(x is not None for x in vals.values()) else None,
                                  "fora_do_dominio": [sm for sm, x in vals.items() if x is not None and x <= 0]})
        cmp_ = comparacao(_soma_sin(s), dias_a, dias_b, "mesmas_datas")
        linha["variacao_pct"] = cmp_["variacao_pct"] if cmp_ else None
        linha["janela_completa"] = cmp_ is not None
        por_captura.append(linha)
    # 3) comparações equivalentes com a série vigente (validada)
    comps = []
    for sm in TODOS:
        b = comparacao(dados["diaria"][sm], dias_a, dias_b, "mesmas_datas")
        e = comparacao(dados["diaria"][sm], dias_a, dias_e, "equivalente")
        cu = dados["curva_d"][sm]["media_dia"]
        cb = comparacao(cu, dias_a, dias_b, "mesmas_datas")
        comps.append({"sm": sm, "mesmas_datas": b, "equivalente": e,
                      "curva_horaria_mesmas_datas": cb["variacao_pct"] if cb else None})
    # 4) MMGD e carga líquida (API), mesmas janelas: identidade contábil, não causa
    mmgd = []
    for sm in TODOS:
        g, m = dados["api_g"][sm], dados["api_m"][sm]
        def med(serie, dias):
            ks = [f"{d}T{h:02d}:00" for d in dias for h in range(24)]
            if not all(k in serie for k in ks):
                return None
            return sum(serie[k] for k in ks) / len(ks)
        linha = {"sm": sm}
        for nome, dias in (("a", dias_a), ("b", dias_b), ("e", dias_e)):
            gg, mm = med(g, dias), med(m, dias)
            linha[nome] = {"global": c.r(gg, 1), "mmgd": c.r(mm, 1), "liquida": c.r(gg - mm, 1) if gg is not None and mm is not None else None}
        for nome in ("b", "e"):
            a_, b_ = linha["a"], linha[nome]
            if None in (a_["global"], b_["global"], a_["mmgd"], b_["mmgd"]):
                linha[f"var_{nome}"] = None
                continue
            dg = a_["global"] - b_["global"]
            linha[f"var_{nome}"] = {
                "global_pct": c.r(100 * (a_["global"] / b_["global"] - 1), 2),
                "liquida_pct": c.r(100 * (a_["liquida"] / b_["liquida"] - 1), 2),
                "mmgd_pct": c.r(100 * (a_["mmgd"] / b_["mmgd"] - 1), 2) if b_["mmgd"] else None,
                "delta_global": c.r(dg, 1), "delta_mmgd": c.r(a_["mmgd"] - b_["mmgd"], 1),
                "delta_liquida": c.r(a_["liquida"] - b_["liquida"], 1),
                "mmgd_na_variacao_pct_pontos": c.r(100 * (a_["mmgd"] - b_["mmgd"]) / b_["global"], 2),
            }
        mmgd.append(linha)
    # 5) temperatura média ponderada nas janelas; a fonte publica com alguns dias de
    # defasagem, então a janela com temperatura pode ser um prefixo da janela do achado
    t_sin = temps["series"]["SIN"]["media"]
    k_temp = 0
    for d in dias_a:
        ant = (date.fromisoformat(d) - timedelta(days=1)).isoformat()
        if d in t_sin and ant in t_sin:
            k_temp += 1
        else:
            break
    clima_j = []
    for sm in TODOS:
        t = temps["series"][sm]["media"]
        tx = temps["series"][sm]["maxima"]
        def mt(serie, dias):
            vs = [serie.get(d) for d in dias]
            return c.r(sum(vs) / len(vs), 2) if dias and all(v is not None for v in vs) else None
        k = k_temp
        clima_j.append({"sm": sm, "dias": k, "a": mt(t, dias_a[:k]), "b": mt(t, dias_b[:k]), "e": mt(t, dias_e[:k]),
                        "a_max": mt(tx, dias_a[:k]), "b_max": mt(tx, dias_b[:k]), "e_max": mt(tx, dias_e[:k])})
    fontes_a = sorted({temps["fontes_mes"].get(d[:7]) or "" for d in dias_a} - {""})
    fontes_b = sorted({temps["fontes_mes"].get(d[:7]) or "" for d in dias_b} - {""})
    janela_modelo = {"inicio": dias_a[0], "fim": dias_a[k_temp - 1] if k_temp else None, "dias": k_temp, "dias_janela": len(dias_a),
                     "motivo": (None if k_temp == len(dias_a) else
                                f"a temperatura de {c.data_br(dias_a[k_temp])} ainda não estava publicada pela NASA POWER na última captura")}
    # 6) decomposição estatística das duas comparações (modelo estimado antes da janela),
    # no maior prefixo da janela com todas as variáveis
    decomp = []
    for sm in TODOS:
        for var, r in res[sm].items():
            if not r:
                continue
            for nome, dias in (("mesmas_datas", dias_b), ("equivalente", dias_e)):
                x, k = None, len(dias_a)
                while k > 0 and x is None:
                    x = modelo.contribuicoes_diferenca(r, dias_a[:k], dias[:k])
                    if x is None:
                        k -= 1
                if x:
                    decomp.append({"sm": sm, "variante": var, "comparacao": nome, "origem_modelo": r["ultimo_ajuste"]["origem"],
                                   "ultimo_dia_treino": r["ultimo_ajuste"]["ultimo_dia_treino"],
                                   "inicio": dias_a[0], "fim": dias_a[k - 1], "inicio_ant": dias[0], "fim_ant": dias[k - 1], "dias": k,
                                   **{kk: (c.r(v, 2) if isinstance(v, float) else {g: c.r(z, 2) for g, z in v.items()}) for kk, v in x.items()}})
    # 7) quanto cada janela ficou acima ou abaixo do modelo, fora da amostra (cada dia
    # previsto pelo modelo estimado até o fim do mês anterior)
    residuos = []
    for sm in TODOS:
        r = res[sm]["principal"]
        if not r:
            continue
        prev = {x["d"]: x for x in r["previsoes"]}
        for nome, dias in (("2026", dias_a), ("2025_mesmas_datas", dias_b), ("2025_equivalente", dias_e)):
            xs = [prev[d] for d in dias if d in prev]
            if not xs:
                continue
            real = sum(x["real"] for x in xs) / len(xs)
            pv = sum(x["previsto"] for x in xs) / len(xs)
            residuos.append({"sm": sm, "janela": nome, "dias": len(xs), "dias_janela": len(dias), "inicio": xs[0]["d"], "fim": xs[-1]["d"],
                             "real": c.r(real, 0), "previsto": c.r(pv, 0), "residuo_pct": c.r(100 * (real / pv - 1), 2),
                             "dias_acima_p90": sum(1 for x in xs if x["real"] > x["p90"]),
                             "dias_abaixo_p10": sum(1 for x in xs if x["real"] < x["p10"]),
                             "origens": sorted({x["origem"] for x in xs})})
    cal_a, cal_b, cal_e = cal.composicao(dias_a), cal.composicao(dias_b), cal.composicao(dias_e)
    sin_b = next(x for x in comps if x["sm"] == "SIN")
    principal = next((x for x in decomp if x["sm"] == "SIN" and x["variante"] == "principal" and x["comparacao"] == "mesmas_datas"), None)
    mm_sin = next(x for x in mmgd if x["sm"] == "SIN")
    tj = next(x for x in clima_j if x["sm"] == "SIN")
    textos = [
        (f"A variação publicada de {_sinal(ref['variacao_publicada_pct'])}% reproduz-se com a carga diária como estava no silver em "
         f"{c.carimbo_br(ref['gerado_em'])}: {_sinal(rep['variacao_pct'], 2)}% (média de {_br(rep['media'])} MWmed de "
         f"{c.data_br(ref['inicio'])} a {c.data_br(ref['fim'])} contra {_br(rep['media_ant'])} MWmed de {c.data_br(ref['inicio_anterior'])} "
         f"a {c.data_br(ref['fim_anterior'])}).") if rep else "A janela do diagnóstico não está completa no silver.",
        (f"As duas janelas têm sete dias seguidos, portanto um de cada dia da semana; nenhuma tem feriado nacional nem ponto "
         f"facultativo; as duas estão no mesmo regime do ONS (desde 29/04/2023). Com os mesmos dias da semana deslocados 364 dias "
         f"({c.data_br(dias_e[0])} a {c.data_br(dias_e[-1])}), a variação é {_sinal(sin_b['equivalente']['variacao_pct'], 2)}%.")
        if (sin_b["equivalente"] and not cal_a["eventos"] and not cal_b["eventos"] and not cal_e["eventos"]) else
        "O calendário das janelas não é equivalente; ver composição publicada.",
    ]
    if mm_sin.get("var_b"):
        v = mm_sin["var_b"]
        textos.append(f"Na carga verificada da API do ONS (outro produto, que separa a MMGD), a carga global do SIN variou "
                      f"{_sinal(v['global_pct'], 2)}%, a MMGD estimada {_sinal(v['mmgd_pct'], 1)}% e a carga líquida de MMGD "
                      f"{_sinal(v['liquida_pct'], 2)}%; o aumento da MMGD equivale a {_br(v['mmgd_na_variacao_pct_pontos'], 2)} ponto percentual "
                      f"da carga global da semana de 2025. É identidade contábil da fonte, não explicação causal.")
    if tj["a"] is not None and tj["b"] is not None:
        per = ("na janela inteira" if tj["dias"] == len(dias_a) else
               f"de {c.data_br(dias_a[0])} a {c.data_br(dias_a[tj['dias'] - 1])} ({janela_modelo['motivo']})")
        textos.append(f"A temperatura média ponderada do SIN (NASA POWER, capitais) foi {_br(tj['a'], 1)} °C em 2026 e "
                      f"{_br(tj['b'], 1)} °C nos mesmos dias de 2025, {per}; a fonte é {', '.join(fontes_a) or 'não identificada'} em 2026 "
                      f"e {', '.join(fontes_b) or 'não identificada'} em 2025.")
    # com a janela reduzida pela falta de temperatura, só a comparação de 364 dias mantém
    # os mesmos dias da semana; ela é a lida no texto (as duas ficam na tabela)
    eq = next((x for x in decomp if x["sm"] == "SIN" and x["variante"] == "principal" and x["comparacao"] == "equivalente"), None)
    lido = principal if principal and principal["dias"] == len(dias_a) else eq
    if lido:
        cb = lido["contribuicoes_log100"]
        per = (f"de {c.data_br(lido['inicio'])} a {c.data_br(lido['fim'])} contra {c.data_br(lido['inicio_ant'])} a "
               f"{c.data_br(lido['fim_ant'])}")
        textos.append(f"Na decomposição estatística ({per}; modelo estimado até {c.data_br(lido['ultimo_dia_treino'])}, fora da amostra "
                      f"em 2026), a diferença de {_br(lido['real_log100'], 1)} pontos de log se divide em calendário "
                      f"{_br(cb['calendario'], 1)}, temperatura {_br(cb['temperatura'], 1)}, sazonalidade {_br(cb['sazonalidade'], 1)}, "
                      f"nível e tendência {_br(cb['nivel_tendencia'], 1)} e resíduo {_br(lido['residuo_log100'], 1)}. "
                      "É associação estatística, não causa: o resíduo é a parte que o modelo não reproduz.")
    r26 = next((x for x in residuos if x["sm"] == "SIN" and x["janela"] == "2026"), None)
    r25 = next((x for x in residuos if x["sm"] == "SIN" and x["janela"] == "2025_mesmas_datas"), None)
    if r26 and r25:
        textos.append(f"Fora da amostra, a carga do SIN ficou {_sinal(r26['residuo_pct'], 1)}% em relação ao previsto de "
                      f"{c.data_br(r26['inicio'])} a {c.data_br(r26['fim'])} ({r26['dias_acima_p90']} de {r26['dias']} dias acima do "
                      f"intervalo de 80%) e {_sinal(r25['residuo_pct'], 1)}% nos mesmos dias de 2025 ({r25['dias_abaixo_p10']} de "
                      f"{r25['dias']} dias abaixo do intervalo).")
    textos.append("Nada aqui atribui a variação à atividade econômica: não há, neste módulo, dado de atividade que sustente essa leitura.")
    return {
        "referencia": ref,
        "reproducao": {**(rep or {}), "vintages": [{"recurso": v["recurso"], "capturado_em": v["capturado_em"], "sha256": v["sha256"]}
                                                    for v in usadas.values()],
                       "confere_publicado": rep is not None and abs(round(rep["variacao_pct"], 1) - ref["variacao_publicada_pct"]) < 1e-9},
        "por_captura_2026": por_captura,
        "comparacoes": comps,
        "calendario": {"a": cal_a, "b": cal_b, "e": cal_e, "dias_equivalentes": dias_e},
        "mmgd": mmgd, "temperatura": clima_j, "fonte_temperatura": {"2026": fontes_a, "2025": fontes_b},
        "janela_modelo": janela_modelo, "residuos_fora_da_amostra": residuos,
        "decomposicao": decomp,
        "textos": textos,
    }


# =====================================================================================
# Arquivos para download
# =====================================================================================

def escreve_csvs(dados, temps, res, comps_csv, revis, calendario_anos):
    ch = dados["curva_h"]
    horas = sorted(ch["SE"])
    base.escreve_csv(CSV["horaria"], ["data_hora", "SE", "S", "NE", "N", "SIN", "regime"],
                     [[h] + [c.r(ch[sm].get(h), 3) for sm in TODOS] + [gcarga.regime_de(h[:10]) + 1] for h in horas])
    g, m = dados["api_g"], dados["api_m"]
    hs = sorted(k for k in g["SIN"] if k >= "2024-01-01")
    cab = ["data_hora"] + [f"{x}_{sm}" for sm in TODOS for x in ("global", "mmgd", "liquida")]
    linhas = []
    for h in hs:
        row = [h]
        for sm in TODOS:
            gv, mv = g[sm].get(h), m[sm].get(h)
            row += [c.r(gv, 3), c.r(mv, 3), c.r(gv - mv, 3) if gv is not None and mv is not None else None]
        linhas.append(row)
    base.escreve_csv(CSV["verificada_horaria"], cab, linhas)
    linhas = []
    for sm in TODOS:
        dias = sorted({k[:10] for k in m[sm]})
        for d in dias:
            if not (_dia_completo(g[sm], d) and _dia_completo(m[sm], d)):
                continue
            ks = [f"{d}T{h:02d}:00" for h in range(24)]
            gg = {h: g[sm][k] for h, k in enumerate(ks)}
            ll = {h: g[sm][k] - m[sm][k] for h, k in enumerate(ks)}
            sg, sm_ = sum(gg.values()), sum(m[sm][k] for k in ks)
            hg, hl = min(gg, key=lambda k: (-gg[k], k)), min(ll, key=lambda k: (-ll[k], k))
            linhas.append([d, sm, c.r(sg / 24, 3), c.r(sm_ / 24, 3), c.r((sg - sm_) / 24, 3), c.r(100 * sm_ / sg, 3),
                           c.r(gg[hg], 3), hg, c.r(ll[hl], 3), hl, 24])
    base.escreve_csv(CSV["verificada_diaria"], ["data", "submercado", "carga_global_mwmed", "mmgd_mwmed", "carga_liquida_mwmed", "mmgd_pct",
                                                "pico_global_mwmed", "hora_pico_global", "pico_liquida_mwmed", "hora_pico_liquida", "horas"],
                     linhas)
    linhas = []
    for sm in TODOS:
        cd = dados["curva_d"][sm]
        for d in sorted(cd["media_dia"]):
            linhas.append([d, sm, c.r(cd["media_dia"][d], 3), c.r(cd["pico_dia"].get(d), 3),
                           int(cd["hora_pico"][d]) if d in cd["hora_pico"] else None, cal.classifica(d), gcarga.regime_de(d) + 1])
    base.escreve_csv(CSV["pico"], ["data", "submercado", "media_mwmed", "pico_mwmed", "hora_pico", "classe_dia", "regime"], linhas)
    meses = sorted({h[:7] for h in ch["SIN"]} | {h[:7] for h in g["SIN"]})
    linhas = []
    for p in perfis(dados, meses):
        for h in range(24):
            linhas.append([p["mes"], p["sm"], p["classe"], h, p["carga"][h], p["global"][h], p["mmgd"][h], p["liquida"][h],
                           p["dias_curva"], p["dias_api"]])
    base.escreve_csv(CSV["perfil"], ["mes", "submercado", "classe_dia", "hora", "carga_mwmed", "carga_global_mwmed", "mmgd_mwmed",
                                     "carga_liquida_mwmed", "dias_curva", "dias_api"], linhas)
    base.escreve_csv(CSV["comparacoes"], ["submercado", "janela", "tipo", "inicio", "fim", "inicio_ant", "fim_ant", "media_mwmed",
                                          "media_ant_mwmed", "variacao_pct", "mesmo_regime", "dias_uteis", "dias_uteis_ant",
                                          "feriados_dia_util", "feriados_dia_util_ant"], comps_csv)
    base.escreve_csv(CSV["revisoes"], ["dataset", "serie", "ref", "capturado_em", "capturado_em_ant", "valor", "valor_anterior",
                                       "diferenca", "diferenca_pct", "situacao"],
                     [[DS_DIARIA, f"carga_mwmed.{x['sm']}", x["dia"], x["capturado_em"], x["capturado_em_ant"], x["valor"],
                       x["valor_ant"], x["diferenca"], x["diferenca_pct"], x["situacao"]] for x in revis["linhas"]])
    linhas = []
    for sm in TODOS:
        r = res[sm]["principal"]
        if not r:
            continue
        for x in r["previsoes"]:
            linhas.append([x["d"], sm, c.r(x["real"], 3), c.r(x["previsto"], 3), c.r(x["p10"], 3), c.r(x["p90"], 3),
                           c.r(x["p025"], 3), c.r(x["p975"], 3), c.r(100 * (x["real"] / x["previsto"] - 1), 3)]
                          + [c.r(100 * x["contrib_log"][gr], 3) for gr in modelo.GRUPOS] + [x["origem"]])
    base.escreve_csv(CSV["modelo"], ["data", "submercado", "real_mwmed", "previsto_mwmed", "p10", "p90", "p025", "p975", "residuo_pct"]
                     + list(modelo.GRUPOS) + ["origem"], linhas)
    linhas = []
    for sm in TODOS:
        for var, r in res[sm].items():
            if not r:
                continue
            for o in r["por_origem"]:
                linhas.append([var, sm, o["origem"], o["dias_treino"], o["dias_previstos"], c.r(o["mape_pct"], 3), c.r(o["vies_pct"], 3),
                               o["fonte_intervalo"]])
    base.escreve_csv(CSV["backtest"], ["variante", "submercado", "origem", "dias_treino", "dias_previstos", "mape_pct", "vies_pct",
                                       "fonte_intervalo"], linhas)
    linhas = []
    for sm in TODOS:
        t = temps["series"][sm]
        for d in sorted(t["media"]):
            fonte = temps["fontes_mes"].get(d[:7])
            linhas.append([d, sm, c.r(t["media"][d], 3), c.r(t["maxima"].get(d), 3), fonte or None])
    base.escreve_csv(CSV["temperatura"], ["data", "submercado", "temperatura_media_c", "temperatura_maxima_c", "fonte_mes"], linhas)
    linhas = []
    for a in calendario_anos:
        for d, nome, cat, lei in cal.eventos_do_ano(a):
            linhas.append([d.isoformat(), nome, cat, lei, cal.NOMES_DIA[d.weekday()]])
    base.escreve_csv(CSV["calendario"], ["data", "nome", "categoria", "base_legal", "dia_semana"], linhas)


# =====================================================================================
# Fontes, proveniência e evidências
# =====================================================================================

def _fonte(orgao, conjunto, recurso, url, licenca, url_primaria=None):
    return {"orgao": orgao, "dataset": conjunto, "recurso": recurso, "url_dataset": url, "url_primaria": url_primaria or url,
            "licenca": licenca}


FONTE_DIARIA = c.fonte_ons("carga-energia", DS_DIARIA, "Carga de Energia Diária")
FONTE_CURVA = _fonte("ONS", "Curva de Carga Horária", "curva-carga-ho (CURVA_CARGA_AAAA.csv, 2000 a 2026)", ons.URL_CURVA, LIC_ONS, ons.S3_CURVA)
FONTE_API = _fonte("ONS", "Carga de Energia Verificada", "API cargaverificada, áreas SECO, S, NE e N, pedidos mensais desde 01/2019",
                   ons.URL_API_DATASET, LIC_ONS, ons.URL_API)
FONTE_TEMP = _fonte("NASA", "POWER, API diária por ponto (MERRA-2 e GEOS-IT)", "T2M e T2M_MAX nos centroides das 27 capitais",
                    clima.URL_POWER_DOC, clima.LICENCA_POWER, "https://power.larc.nasa.gov/api/temporal/daily/point")


def _leis(con):
    regs = base.registros_como_estavam_em(con, DS_LEIS)
    out = []
    for lei in cal.LEIS:
        r = regs.get(lei["id"], {})
        v = base.ultima_vintage(con, DS_LEIS, lei["id"])
        out.append({"id": lei["id"], "norma": lei["norma"], "estabelece": lei["estabelece"], "ementa_senado": r.get("ementa"),
                    "id_senado": r.get("id_senado"), "conferida": r.get("conferida") == "1",
                    "url": cal.URL_SENADO_LISTA.format(numero=lei["numero"], ano=lei["ano"]),
                    "capturado_em": v["capturado_em"] if v else None, "sha256": v["sha256"] if v else None})
    return out


def fontes(con, con_p, dados, temps):
    vd = _vintages(con_p, DS_DIARIA)
    vc = _vintages(con, DS_CURVA)
    va = _vintages(con, DS_API)
    vp = _vintages(con, DS_POWER, "power_")
    ctl = base.registros_como_estavam_em(con, DS_CONTROLE)
    ident = sum(int(ctl.get(v["vintage_id"], {}).get("identidade_conferida", 0) or 0) for v in va.values())
    falhas = sum(int(ctl.get(v["vintage_id"], {}).get("identidade_falha", 0) or 0) for v in va.values())
    atual = [ctl.get(v["vintage_id"], {}).get("din_atualizacao_max") for v in va.values()]
    atual = sorted(x for x in atual if x)
    meta_c = ckan.meta_local(DS_CURVA)
    return [
        {"id": "diaria", "orgao": "ONS", "conjunto": "Carga de Energia Diária", "recurso": "CARGA_ENERGIA_AAAA.csv (silver principal)",
         "url": ons.URL_DIARIA, "licenca": LIC_ONS, "grao": "dia, subsistema", "unidade": "MWmed",
         "periodo": {"inicio": min(dados["val"]["brutas"]["SE"]), "fim": max(dados["val"]["brutas"]["SE"])},
         "capturas": len(base.vintages_do_dataset(con_p, DS_DIARIA)), "arquivos": len(vd),
         "ultima_captura": max(v["capturado_em"] for v in vd.values()),
         "dicionario": "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/carga_energia_di/DicionarioDados_Carga_Energia_Diaria.pdf (v1.2)"},
        {"id": "curva", "orgao": "ONS", "conjunto": "Curva de Carga Horária", "recurso": "CURVA_CARGA_AAAA.csv", "url": ons.URL_CURVA,
         "licenca": LIC_ONS, "grao": "hora, subsistema", "unidade": "MWmed",
         "periodo": {"inicio": min(dados["curva_d"]["SE"]["media_dia"]), "fim": max(dados["curva_d"]["SE"]["media_dia"])},
         "capturas": len(base.vintages_do_dataset(con, DS_CURVA)), "arquivos": len(vc),
         "ultima_captura": max(v["capturado_em"] for v in vc.values()), "dicionario": ons.URL_DIC_CURVA + " (v1.2, 06/04/2026)",
         "frequencia_declarada": "diária, às 12h e 19h (CKAN)", "modificado_na_fonte": meta_c.get("modificado")},
        {"id": "api", "orgao": "ONS", "conjunto": "Carga de Energia Verificada (API)", "recurso": "cargaverificada por submercado e mês",
         "url": ons.URL_API_DATASET, "licenca": LIC_ONS, "grao": "meia hora, área de carga (agregada por hora cheia)", "unidade": "MWmed",
         "periodo": {"inicio": min(k[:10] for k in dados["api_g"]["SE"]), "fim": max(k[:10] for k in dados["api_g"]["SE"])},
         "capturas": len(base.vintages_do_dataset(con, DS_API)), "arquivos": len(va),
         "ultima_captura": max(v["capturado_em"] for v in va.values()), "dicionario": ons.URL_DIC_API + " (v1.1, 30/10/2023)",
         "identidade_conferida_meias_horas": ident, "identidade_falhas": falhas,
         "atualizacao_na_fonte": {"mais_antiga": atual[0] if atual else None, "mais_recente": atual[-1] if atual else None}},
        {"id": "temperatura", "orgao": "NASA", "conjunto": "POWER, API diária por ponto", "recurso": "T2M e T2M_MAX nas 27 capitais",
         "url": clima.URL_POWER_DOC, "licenca": clima.LICENCA_POWER, "grao": "dia, ponto (centroide da capital)", "unidade": "°C",
         "periodo": {"inicio": clima.PRIMEIRO_DIA, "fim": max(max(temps["series"][sm]["media"]) for sm in TODOS)},
         "capturas": len(vp), "arquivos": len(vp), "ultima_captura": max(v["capturado_em"] for v in vp.values()) if vp else None,
         "capitais_com_dado": temps["capitais_com_dado"]},
        {"id": "populacao", "orgao": "IBGE", "conjunto": "Estimativas de população (SIDRA 6579)", "recurso": clima.URL_SIDRA_POP,
         "url": clima.URL_SIDRA_TABELA, "licenca": clima.LICENCA_IBGE, "grao": "UF, ano", "unidade": "pessoas",
         "periodo": {"inicio": temps["ano_populacao"], "fim": temps["ano_populacao"]}},
        {"id": "centroides", "orgao": "IBGE", "conjunto": "API de malhas v3 (metadados: centroide) e localidades v1",
         "recurso": "municípios das 27 capitais", "url": "https://servicodados.ibge.gov.br/api/docs/malhas?versao=3",
         "licenca": clima.LICENCA_IBGE, "grao": "município", "unidade": "graus decimais"},
        {"id": "leis", "orgao": "Senado Federal", "conjunto": "Legislação Federal, metadados abertos",
         "recurso": "dadosabertos/legislacao/lista.json", "url": "https://legis.senado.leg.br/dadosabertos/",
         "licenca": cal.LICENCA_SENADO, "grao": "lei", "leis": _leis(con)},
    ]


def _arq(v):
    return ev.arquivo_de_vintage(v) if v else None


def evidencias(con, con_p, dados, a07, comps, p026, p027, dia_ref):
    out = {}
    rep = a07["reproducao"]
    if rep.get("media") is not None:
        usadas = {x["recurso"]: x for x in rep["vintages"]}
        arquivos = []
        for rec in ("CARGA_ENERGIA_2025", "CARGA_ENERGIA_2026"):
            v = next((x for x in base.vintages_do_dataset(con_p, DS_DIARIA) if x["recurso"] == rec and x["sha256"] == usadas.get(rec, {}).get("sha256")), None)
            if v:
                arquivos.append(_arq(v))
        fonte = ev.fonte_de_vintage("ONS", "Carga de Energia Diária", ons.URL_DIARIA,
                                    next((x for x in base.vintages_do_dataset(con_p, DS_DIARIA)
                                          if x["sha256"] == usadas.get("CARGA_ENERGIA_2026", {}).get("sha256")), None))
        fonte["arquivos"] = arquivos
        ref = a07["referencia"]
        out["a07_reproducao"] = ev.construir(
            indicador="Variação da carga do SIN em 7 dias contra os mesmos dias do ano anterior (reprodução do diagnóstico)",
            valor_exibido=f"{_sinal(rep['variacao_pct'], 1)}%", valor_calculo=100 * (rep["media"] / rep["media_ant"] - 1), unidade="%",
            periodo={"inicio": ref["inicio"], "fim": ref["fim"]}, entidade="SIN (soma de SE/CO, S, NE e N)",
            universo="carga diária dos quatro subsistemas, 7 dias em 2026 e os mesmos 7 dias de 2025",
            filtros=[f"silver como estava em {ref['gerado_em']} (instante da gold do diagnóstico)"], fonte=fonte,
            chaves_origem=[f"carga_mwmed.<SE,S,NE,N> em {d}" for d in _dias(ref["inicio"], ref["fim"]) + _dias(ref["inicio_anterior"], ref["fim_anterior"])],
            consulta=f"base.como_estava_em(con, 'carga_energia_di', 'carga_mwmed.<sm>', '{ref['gerado_em']}')",
            formula="100 × (média dos 7 dias de 2026 ÷ média dos mesmos 7 dias de 2025 − 1), SIN = soma dos quatro subsistemas no dia",
            numerador={"descricao": "média do SIN de 22 a 28/09/2026 (MWmed)", "valor": rep["media"]},
            denominador={"descricao": "média do SIN de 22 a 28/09/2025 (MWmed)", "valor": rep["media_ant"]},
            cobertura="7 de 7 dias nos dois períodos, quatro subsistemas", tratamento_ausencia="janela com dia ausente não tem variação",
            revisoes=f"{len(a07['por_captura_2026'])} capturas do arquivo de 2026 comparadas; a de 29/09/2026 não tinha a janela completa e trazia −668,879 MWmed no NE em 26/09.",
            testes=[ev.teste("mesmo regime metodológico", "aprovado" if rep["mesmo_regime"] else "reprovado", "as duas janelas estão depois de 29/04/2023"),
                    ev.teste("mesmos dias da semana", "aprovado" if rep["calendario_equivalente"] else "ressalva", "sete dias seguidos em cada janela"),
                    ev.teste("feriados", "aprovado" if not rep["eventos"] and not rep["eventos_ant"] else "ressalva", "nenhum feriado nacional nem ponto facultativo nas janelas")],
            reconciliacao=ev.reconciliacao(f"Valor publicado pela gold carga.json do commit {ref['commit']} ({ref['gerado_em']}): {_sinal(ref['variacao_publicada_pct'])}%.",
                                           "aprovado" if rep["confere_publicado"] else "reprovado", "0,05 ponto percentual (a gold publicava uma casa decimal)"),
            download=[{"rotulo": "Comparações de carga (CSV)", "url": _u(CSV["comparacoes"])}, {"rotulo": "Revisões da carga diária (CSV)", "url": _u(CSV["revisoes"])}],
            reproducao=REPRODUCAO)
    sin = next(x for x in comps["subsistemas"] if x["sm"] == "SIN")
    e = sin["janelas"]["7d"]["equivalente"]
    j7 = next(j for j in comps["janelas"] if j["id"] == "7d")
    if e:
        e = {**e, "inicio": j7["inicio"], "fim": j7["fim"], "classes": j7["classes"], "classes_ant": j7["classes_equivalente"],
             "calendario_equivalente": j7["calendario_equivalente_364d"]}
    if e and e["variacao_pct"] is not None:
        vd = _vintages(con_p, DS_DIARIA)
        recs = sorted({f"CARGA_ENERGIA_{d[:4]}" for d in (e["inicio"], e["fim"], e["inicio_ant"], e["fim_ant"])})
        fonte = ev.fonte_de_vintage("ONS", "Carga de Energia Diária", ons.URL_DIARIA, vd.get(recs[-1]))
        fonte["arquivos"] = [_arq(vd[r]) for r in recs if r in vd]
        dias_a, dias_b = _dias(e["inicio"], e["fim"]), _dias(e["inicio_ant"], e["fim_ant"])
        ma = sum(dados["diaria"]["SIN"][d] for d in dias_a) / 7
        mb = sum(dados["diaria"]["SIN"][d] for d in dias_b) / 7
        out["p025_7d_equivalente"] = ev.construir(
            indicador="Variação da carga do SIN nos últimos 7 dias contra os mesmos dias da semana 52 semanas antes",
            valor_exibido=f"{_sinal(100 * (ma / mb - 1), 1)}%", valor_calculo=100 * (ma / mb - 1), unidade="%",
            periodo={"inicio": e["inicio"], "fim": e["fim"]}, entidade="SIN", universo="quatro subsistemas, dias aceitos pela validação física",
            fonte=fonte, chaves_origem=[f"carga_mwmed.<SE,S,NE,N> em {d}" for d in dias_a + dias_b],
            formula="100 × (média dos 7 dias ÷ média dos 7 dias deslocados 364 dias − 1)",
            numerador={"descricao": f"média do SIN de {c.data_br(e['inicio'])} a {c.data_br(e['fim'])} (MWmed)", "valor": ma},
            denominador={"descricao": f"média do SIN de {c.data_br(e['inicio_ant'])} a {c.data_br(e['fim_ant'])} (MWmed)", "valor": mb},
            cobertura="7 de 7 dias nos dois períodos", tratamento_ausencia="dia em quarentena ou ausente anula a comparação",
            revisoes=c.snapshot_de(con_p, DS_DIARIA).get("revisoes"),
            testes=[ev.teste("mesmo regime", "aprovado" if e["mesmo_regime"] else "reprovado", "janelas no mesmo regime do ONS"),
                    ev.teste("mesma composição de dias", "aprovado" if e["calendario_equivalente"] else "ressalva",
                             f"dias úteis {e['classes']['util']} contra {e['classes_ant']['util']}")],
            download=[{"rotulo": "Comparações de carga (CSV)", "url": _u(CSV["comparacoes"])}], reproducao=REPRODUCAO)
    # MMGD no último mês completo (API), com coerência contra o arquivo do módulo Transição
    mm = [x for x in p026["mmgd_mensal"] if x["sm"] == "SIN" and x["dias"] == x["dias_no_mes"]]
    if mm:
        ult = mm[-1]
        mes = ult["m"]
        va = [base.ultima_vintage(con, DS_API, f"cargaverificada_{a}_{mes}") for a in ons.AREAS.values()]
        fonte = ev.fonte_de_vintage("ONS", "Carga de Energia Verificada", ons.URL_API_DATASET, va[0])
        fonte["arquivos"] = [_arq(v) for v in va if v]
        g, m = dados["api_g"]["SIN"], dados["api_m"]["SIN"]
        ks = [f"{d}T{h:02d}:00" for d in _dias(f"{mes}-01", _fim_mes(mes)) for h in range(24)]
        sg, sm_ = sum(g[k] for k in ks), sum(m[k] for k in ks)
        coer = _coerencia_transicao(dados, mes)
        out["p026_mmgd_mes"] = ev.construir(
            indicador="Parcela da carga global do SIN atendida por MMGD (estimativa do ONS), último mês completo",
            valor_exibido=f"{_br(100 * sm_ / sg, 1)}%", valor_calculo=100 * sm_ / sg, unidade="% da carga global",
            periodo={"inicio": f"{mes}-01", "fim": _fim_mes(mes)}, entidade="SIN", universo="submercados SE/CO, S, NE e N da API de carga verificada",
            filtros=["horas cheias com as duas meias horas de carga global e de MMGD nos quatro submercados"], fonte=fonte,
            chaves_origem=[ons.url_api(a, f"{mes}-01", _fim_mes(mes)) for a in ons.AREAS.values()],
            formula="100 × Σ MMGD (MWh) ÷ Σ carga global (MWh), mesmas horas",
            numerador={"descricao": "energia de MMGD estimada no mês (MWh)", "valor": sm_},
            denominador={"descricao": "carga global verificada no mês (MWh)", "valor": sg},
            cobertura=f"{ult['dias']} de {ult['dias_no_mes']} dias", tratamento_ausencia="hora sem as duas meias horas fica fora; dia em curso na captura não entra",
            revisoes=c.snapshot_de(con, DS_API).get("revisoes"),
            testes=[ev.teste("identidade carga global = líquida + MMGD", "aprovado", "conferida em cada meia hora na ingestão (tolerância 0,01 MWmed)"),
                    ev.teste("MMGD não negativa", "aprovado" if all(v >= 0 for v in m.values()) else "reprovado", "o dicionário do ONS não admite MMGD negativa")],
            reconciliacao=coer, download=[{"rotulo": "Carga verificada diária (CSV)", "url": _u(CSV["verificada_diaria"])}],
            reproducao=REPRODUCAO)
    # pico do SIN no último dia da carga diária
    cd = dados["curva_d"]["SIN"]
    if dia_ref in cd["pico_dia"]:
        vc = _vintages(con, DS_CURVA)
        v = next((x for r, x in vc.items() if r.endswith(dia_ref[:4])), None)
        fonte = ev.fonte_de_vintage("ONS", "Curva de Carga Horária", ons.URL_CURVA, v)
        media = cd["media_dia"][dia_ref]
        diaria = dados["diaria"]["SIN"].get(dia_ref)
        ok = diaria is not None and abs(media - diaria) <= max(0.005 * diaria, 5)
        out["p026_pico_sin"] = ev.construir(
            indicador="Pico horário da carga do SIN no dia", valor_exibido=f"{_br(cd['pico_dia'][dia_ref])} MWmed às {int(cd['hora_pico'][dia_ref])}h",
            valor_calculo=cd["pico_dia"][dia_ref], unidade="MWmed", periodo={"inicio": dia_ref, "fim": dia_ref}, entidade="SIN",
            universo="soma dos quatro subsistemas hora a hora", fonte=fonte,
            chaves_origem=[f"{sm} {dia_ref} {h:02d}:00" for sm in SMS for h in range(24)][:48],
            consulta=f"maior soma horária de SE, S, NE e N em {dia_ref} no arquivo CURVA_CARGA_{dia_ref[:4]}.csv",
            formula="max_h (Σ_subsistemas carga(h)); hora = início da hora local do máximo (empate: a primeira)",
            cobertura="24 de 24 horas nos quatro subsistemas", tratamento_ausencia="dia sem as 24 horas não tem pico",
            revisoes=c.snapshot_de(con, DS_CURVA).get("revisoes"),
            testes=[ev.teste("24 horas", "aprovado", "dia completo nos quatro subsistemas")],
            reconciliacao=ev.reconciliacao(f"Média das 24 horas da curva ({_br(media, 1)} MWmed) contra a Carga de Energia Diária do mesmo dia "
                                           f"({_br(diaria, 1) if diaria else 'sem dado'} MWmed).", "aprovado" if ok else "ressalva",
                                           "0,5% ou 5 MWmed (a curva é capturada depois e pode trazer revisão)"),
            download=[{"rotulo": "Pico diário (CSV)", "url": _u(CSV["pico"])}], reproducao=REPRODUCAO)
    if p027:
        mt = p027["metricas"]["SIN"]
        vd = _vintages(con_p, DS_DIARIA)
        fonte = ev.fonte_de_vintage("ONS", "Carga de Energia Diária", ons.URL_DIARIA, vd.get(f"CARGA_ENERGIA_{dia_ref[:4]}"))
        out["p027_mape_sin"] = ev.construir(
            indicador="Erro percentual absoluto médio da decomposição estatística, fora da amostra (SIN)",
            valor_exibido=f"{_br(mt['mape_pct'], 2)}%", valor_calculo=mt["mape_pct"], unidade="%",
            periodo={"inicio": modelo.PRIMEIRA_ORIGEM, "fim": dia_ref}, entidade="SIN",
            universo=f"{mt['dias']} dias previstos em {mt['origens']} origens mensais", fonte=fonte,
            chaves_origem=[f"origem {o['origem']}" for o in p027["por_origem_sin"]],
            formula="média de |real ÷ previsto − 1| × 100 nos dias previstos fora da amostra",
            cobertura=f"{mt['dias']} dias", tratamento_ausencia="dia sem temperatura (ou sem a do dia anterior) fica fora do modelo",
            revisoes="A série é reavaliada a cada publicação com a carga e a temperatura vigentes.",
            testes=[ev.teste("cobertura do intervalo de 80%", "aprovado" if mt["cobertura_80_pct"] >= 75 else "ressalva",
                             f"{_br(mt['cobertura_80_pct'], 1)}% dos dias dentro do intervalo"),
                    ev.teste("cobertura do intervalo de 95%", "aprovado" if mt["cobertura_95_pct"] >= 90 else "ressalva",
                             f"{_br(mt['cobertura_95_pct'], 1)}% dos dias dentro do intervalo"),
                    ev.teste("melhor que a referência ingênua", "aprovado" if mt["mape_referencia_364d_pct"] and mt["mape_pct"] < mt["mape_referencia_364d_pct"] else "ressalva",
                             f"mesmo dia da semana 364 dias antes: {_br(mt['mape_referencia_364d_pct'], 2)}%")],
            download=[{"rotulo": "Decomposição diária (CSV)", "url": _u(CSV["modelo"])}, {"rotulo": "Backtest por origem (CSV)", "url": _u(CSV["backtest"])}],
            reproducao=REPRODUCAO)
    return out


def _coerencia_transicao(dados, mes):
    """Conferência com o arquivo publicado pelo módulo Transição (mesma API, código
    independente): energia diária de MMGD e carga global por submercado no mês."""
    caminho = os.path.join(base.SERIES, "transicao_ons_mmgd_diario.csv")
    if not os.path.exists(caminho):
        return ev.reconciliacao("Arquivo transicao_ons_mmgd_diario.csv do módulo Transição ausente nesta publicação.", "ressalva", "0,1 MWh por dia")
    import csv as _csv
    n, falhas = 0, 0
    with open(caminho, encoding="utf-8") as f:
        for r in _csv.DictReader(f, delimiter=";"):
            if not r["data"].startswith(mes) or r["submercado"] not in SMS:
                continue
            sm, d = r["submercado"], r["data"]
            ks = [f"{d}T{h:02d}:00" for h in range(24)]
            if not all(k in dados["api_m"][sm] and k in dados["api_g"][sm] for k in ks) or not r.get("carga_global_mwh"):
                continue
            n += 1
            mm = sum(dados["api_m"][sm][k] for k in ks)
            gg = sum(dados["api_g"][sm][k] for k in ks)
            if abs(mm - float(r["mmgd_mwh"])) > 0.1 or abs(gg - float(r["carga_global_mwh"])) > 0.1:
                falhas += 1
    return ev.reconciliacao(f"Energia diária de MMGD e carga global por submercado no mês, contra transicao_ons_mmgd_diario.csv "
                            f"(módulo Transição, mesma API lida por outro código): {n - falhas} de {n} dias por submercado coincidem.",
                            "aprovado" if n and not falhas else "ressalva", "0,1 MWh por dia (o arquivo do módulo Transição tem uma casa decimal)")


# =====================================================================================
# Gold
# =====================================================================================

LIM_REGIME = ("O ONS mudou o conteúdo da carga em 01/03/2021 (previsão de usinas não despachadas) e em 29/04/2023 (estimativa de "
              "MMGD com dados meteorológicos previstos); variação que atravessa essas datas não é publicada.")
LIM_REVISAO = "Os dados do ONS passam por consistência recorrente e são revisados depois da publicação; os dias mais recentes mudam."
LIM_CAUSA = "Variação da carga é observação; atribuí-la à atividade econômica exigiria outra evidência, que este módulo não tem."


def construir(con, ctx):
    con_p = ctx.get("con_principal")
    if con_p is None:
        return c.stub(GOLD, "silver principal indisponível")
    if not base.vintages_do_dataset(con, DS_CURVA) or not base.vintages_do_dataset(con, DS_API):
        return c.stub(GOLD, "curva horária ou carga verificada ausente no silver da família ons_carga")
    dados = carrega(con, con_p)
    if not dados["diaria"]["SIN"] or not dados["curva_h"]["SIN"] or not dados["api_g"]["SIN"]:
        return c.stub(GOLD, "séries de carga vazias depois da validação")
    temps = temperaturas(con)
    dia_ref = max(dados["diaria"]["SIN"])
    a11 = bloco_a11_carga(con_p, dados)
    _TRANSICAO.clear()
    inicio_regime = modelo.INICIO_REGIME
    obs = a11["observado_carga"]
    if obs and obs > a11["declarado"] and a11["observado_meio_dia"] == obs:
        # as duas séries da carga concordam num dia posterior ao declarado: os dias entre
        # a data declarada e a observada ficam fora de comparações e do treino
        _TRANSICAO.update(_dias(a11["declarado"], (date.fromisoformat(obs) - timedelta(days=1)).isoformat()))
        inicio_regime = obs
    a11["transicao"] = sorted(_TRANSICAO)
    a11["inicio_regime_usado"] = inicio_regime
    comps, comps_csv = bloco_comparacoes(dados["diaria"], dia_ref)
    anual, acumulado = bloco_anual(dados["diaria"], dia_ref)
    mensal = bloco_mensal(dados["diaria"], dia_ref)
    revis = bloco_revisoes(con_p, dados)
    p026 = bloco_p026(dados, dia_ref)
    res = roda_modelos(dados, temps, inicio_regime)
    p027 = bloco_p027(res, temps, dia_ref)
    a07 = bloco_a07(con_p, dados, temps, res)
    escreve_csvs(dados, temps, res, comps_csv, revis, range(2003, int(dia_ref[:4]) + 2))

    snap_d = c.snapshot_de(con_p, DS_DIARIA)
    snap_c = c.snapshot_de(con, DS_CURVA)
    snap_a = c.snapshot_de(con, DS_API)
    snap_t = c.snapshot_de(con, DS_POWER)
    ini_d = min(dados["diaria"]["SIN"])
    prov = {
        "comparacoes": c.proveniencia(
            indicador="Carga diária: comparações com os mesmos dias da semana e com as mesmas datas do ano anterior", natureza="CALCULADO",
            fonte=FONTE_DIARIA, unidade="MWmed e %", frequencia="diária", periodo={"inicio": ini_d, "fim": dia_ref},
            cobertura={"inicio": ini_d, "fim": dia_ref}, capturado_em=c.ultima_captura(snap_d), snapshot=snap_d,
            transformacoes=["validação física com quarentena (pipeline/energia/gold/carga.py)", "SIN = soma dos quatro subsistemas no dia",
                            "janela equivalente = mesmos dias deslocados 364 dias (mesmos dias da semana)",
                            "composição de dias pelo calendário oficial (feriados por lei federal, Paixão e pontos facultativos à parte)"],
            formula="variação = 100 × (média da janela ÷ média da janela de comparação − 1), só com todos os dias e no mesmo regime",
            limitacoes=[LIM_REGIME, LIM_REVISAO, LIM_CAUSA,
                        "Mesmos dias da semana não igualam temperatura, chuva nem eventos locais; a decomposição estatística trata a temperatura."],
            download=_u(CSV["comparacoes"])),
        "curva": c.proveniencia(
            indicador="Curva de carga horária, pico diário e perfil típico", natureza="OBSERVADO", fonte=FONTE_CURVA, unidade="MWmed",
            frequencia="horária", periodo={"inicio": min(dados["curva_d"]["SE"]["media_dia"]), "fim": p026["ultimo_dia_curva"]},
            cobertura={"inicio": min(dados["curva_d"]["SE"]["media_dia"]), "fim": p026["ultimo_dia_curva"]},
            capturado_em=c.ultima_captura(snap_c), snapshot=snap_c,
            transformacoes=["SIN horário = soma dos quatro subsistemas na hora", "pico = maior valor horário do dia; hora = início da hora local",
                            "perfil típico = média por hora dos dias completos de cada classe (útil, sábado, domingo ou feriado) no mês",
                            "série horária no silver desde 2019; agregados diários de todos os anos"],
            limitacoes=[LIM_REGIME, LIM_REVISAO,
                        "Desde 29/04/2023 a carga inclui uma estimativa de MMGD que o ONS não publica separada neste conjunto: é valor publicado pelo ONS, com componente estimado.",
                        "Antes de 2019 o horário de verão desloca a hora local; dias de mudança de horário ficam sem média e sem pico (23 horas)."],
            download=_u(CSV["horaria"])),
        "api": c.proveniencia(
            indicador="Carga global, MMGD estimada e carga líquida de MMGD (carga verificada)", natureza="ESTIMADO", fonte=FONTE_API,
            unidade="MWmed", frequencia="semi-horária na fonte; horária e diária aqui",
            periodo={"inicio": min(k[:10] for k in dados["api_g"]["SE"]), "fim": p026["ultimo_dia_api"]},
            cobertura={"inicio": min(k[:10] for k in dados["api_g"]["SE"]), "fim": p026["ultimo_dia_api"]},
            capturado_em=c.ultima_captura(snap_a), snapshot=snap_a,
            transformacoes=["hora cheia = média das duas meias horas (início da meia hora no fuso America/Sao_Paulo)",
                            "carga líquida = carga global − MMGD (identidade publicada pelo ONS, conferida em cada meia hora)",
                            "SIN = soma dos quatro submercados nas horas com os quatro"],
            formula="participação da MMGD = 100 × Σ MMGD ÷ Σ carga global, mesmas horas",
            limitacoes=["A MMGD é estimativa do ONS, não medição: a micro e minigeração não é supervisionada.",
                        "A carga global desta API não é a mesma grandeza da curva de carga (é maior, sobretudo à noite); as duas não se misturam.",
                        "Antes de 15/02/2019 a MMGD vem vazia (ausência, não zero).", LIM_REVISAO],
            download=_u(CSV["verificada_diaria"]), notas_fonte="Natureza ESTIMADO: a MMGD é estimativa publicada pelo próprio ONS."),
        "temperatura": c.proveniencia(
            indicador="Temperatura diária ponderada pela população, por subsistema", natureza="ESTIMADO", fonte=FONTE_TEMP, unidade="°C",
            frequencia="diária", periodo={"inicio": clima.PRIMEIRO_DIA, "fim": max(temps["series"]["SIN"]["media"])},
            cobertura={"inicio": clima.PRIMEIRO_DIA, "fim": max(temps["series"]["SIN"]["media"])},
            capturado_em=c.ultima_captura(snap_t), snapshot=snap_t,
            transformacoes=["um ponto por UF: centroide do município da capital (IBGE)",
                            f"peso = população residente estimada da UF em {temps['ano_populacao']} (IBGE, SIDRA 6579)",
                            "dia publicado só com pelo menos 95% do peso com valor"],
            formula="T(subsistema, dia) = Σ peso_UF × T(capital da UF, dia) ÷ Σ pesos com valor",
            limitacoes=["Reanálise (MERRA-2) e análise (GEOS-IT) de modelo, não observação de estação: o INMET não respondeu e o Open-Meteo recusou por limite diário em 30/09/2026.",
                        "A troca de MERRA-2 para GEOS-IT no trecho recente pode deslocar o nível da temperatura; o mês de cada fonte é publicado.",
                        "A capital representa a UF, e a população não é a distribuição da carga."],
            download=_u(CSV["temperatura"])),
        "modelo": c.proveniencia(
            indicador="Decomposição estatística da carga diária por calendário, temperatura, sazonalidade e tendência", natureza="ESTIMADO",
            fonte={**FONTE_DIARIA, "recurso": FONTE_DIARIA["recurso"] + "; temperatura: " + FONTE_TEMP["recurso"]},
            unidade="MWmed, % e log × 100", frequencia="diária", periodo={"inicio": modelo.PRIMEIRA_ORIGEM, "fim": dia_ref},
            cobertura={"inicio": modelo.INICIO_REGIME, "fim": dia_ref}, capturado_em=c.ultima_captura(snap_d), snapshot=snap_d,
            transformacoes=["mínimos quadrados em ln(carga) com as variáveis publicadas", "estimação só com dias anteriores a cada origem mensal",
                            "intervalos pelos quantis dos erros fora da amostra de origens anteriores"],
            formula="ln(carga) = constante + tendência + dia da semana + feriados e pontos facultativos + sazonalidade + temperatura (dobras) + temperatura do dia anterior + erro",
            limitacoes=["Decomposição estatística: associação, não causa; não há 'percentual explicado' pela temperatura.",
                        "A temperatura realizada é usada na avaliação (ex post): não é previsão de carga.",
                        "Treino só desde 29/04/2023 (regime atual); a variante com janela longa usa degrau no regime.",
                        "Os intervalos são empíricos; a cobertura observada fica abaixo da nominal em alguns subsistemas e é publicada."],
            download=_u(CSV["modelo"])),
    }
    ev_ = evidencias(con, con_p, dados, a07, comps, p026, p027, dia_ref)
    downloads = [{"rotulo": r, "url": _u(CSV[k])} for k, r in (
        ("comparacoes", "Comparações de carga equivalentes (CSV)"), ("revisoes", "Revisões da carga diária (CSV)"),
        ("horaria", "Curva de carga horária desde 2019 (CSV)"), ("pico", "Pico diário desde 2000 (CSV)"),
        ("perfil", "Perfil horário típico por mês (CSV)"), ("verificada_diaria", "Carga verificada, MMGD e carga líquida por dia (CSV)"),
        ("verificada_horaria", "Carga verificada, MMGD e carga líquida por hora desde 2024 (CSV)"),
        ("modelo", "Decomposição estatística diária (CSV)"), ("backtest", "Backtest por origem e variante (CSV)"),
        ("temperatura", "Temperatura ponderada por subsistema (CSV)"), ("calendario", "Calendário oficial de feriados (CSV)"))]
    return {
        **c.cabecalho(GOLD),
        "dia_referencia": dia_ref, "unidade": "MWmed", "regimes": gcarga.REGIMES,
        "p025": {"comparacoes": comps, "anual": anual, "acumulado_ano": acumulado, "mensal": mensal, "revisoes": revis,
                 "validacao": {k: v for k, v in dados["val"]["registro"].items()},
                 "serie_diaria": {"arquivo": "/energia/series/carga_diaria.csv", "gold": "carga.json"}},
        "a07": a07,
        "a11_carga": a11,
        "p026": {**p026, "conceitos": CONCEITOS},
        "p027": p027,
        "calendario": {"leis": _leis(con), "categorias": {"feriado_nacional": "feriado por lei federal", "paixao": "Sexta-feira da Paixão (Lei nº 9.093/1995)",
                                                        "ponto_facultativo": "ponto facultativo federal (portaria anual), não feriado"},
                       "eventos_12m": [{"data": d.isoformat(), "nome": n, "categoria": ct, "base": b}
                                       for a in (int(dia_ref[:4]) - 1, int(dia_ref[:4]), int(dia_ref[:4]) + 1)
                                       for d, n, ct, b in cal.eventos_do_ano(a)
                                       if (date.fromisoformat(dia_ref) - timedelta(days=365)) <= d <= (date.fromisoformat(dia_ref) + timedelta(days=90))]},
        "temperatura": {"pesos": {sm: {u: c.r(w, 4) for u, w in p.items()} for sm, p in temps["pesos"].items()},
                        "ano_populacao": temps["ano_populacao"], "fontes_por_mes": temps["fontes_mes"],
                        "capitais": {uf: {"codigo_ibge": cod, "nome": nome} for uf, (cod, nome) in clima.CAPITAIS.items()},
                        "ufs_por_subsistema": {sm: list(u) for sm, u in clima.UFS_DO_SM.items()}},
        "fontes": fontes(con, con_p, dados, temps),
        "proveniencia": prov,
        "evidencias": ev_,
        "downloads": downloads,
    }


CONCEITOS = {
    "carga_curva": ("Carga de energia da Curva de Carga Horária (e da Carga de Energia Diária, que é a média das 24 horas): carga atendida "
                    "pelas usinas despachadas ou programadas pelo ONS, mais a previsão de usinas não despachadas (desde 01/03/2021) e a "
                    "estimativa de MMGD com dados meteorológicos previstos (desde 29/04/2023). A MMGD está dentro, mas não aparece separada."),
    "carga_global": ("Carga global da API de carga verificada: parcela supervisionada pelo ONS (geração tipo I, IIA, IIB, IIC e intercâmbios) "
                     "mais a não supervisionada, medida pela CCEE (geração tipo III), mais a parcela atendida por MMGD."),
    "mmgd": ("Carga atendida por micro e minigeração distribuída: estimativa do ONS (a MMGD não é supervisionada). É energia consumida "
             "junto da carga e suprida pelos painéis e pequenas usinas dos próprios consumidores."),
    "carga_liquida": ("Carga global líquida de MMGD: carga global menos a MMGD, isto é, o que o sistema precisa suprir com as usinas "
                      "supervisionadas e as medidas pela CCEE. Publicada pelo ONS; conferida como carga global − MMGD em cada meia hora."),
    "dupla_contagem": ("Somar a MMGD da API à curva de carga contaria a MMGD duas vezes (a curva já a inclui desde 29/04/2023); subtraí-la da "
                       "curva misturaria dois produtos com definições diferentes. Por isso a decomposição horária usa só a API."),
}
