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
from datetime import date, datetime, timedelta, timezone

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
        _u(CSV["verificada_horaria"]): ("data_hora (início da hora, Brasília); submercado (SE, S, NE, N, SIN); carga_global_mwmed, "
                                        "mmgd_mwmed, carga_liquida_mwmed = médias das duas meias horas da API de carga verificada; "
                                        "carga_liquida = carga_global − mmgd (identidade publicada pelo ONS, conferida). Desde 2024."),
        _u(CSV["verificada_diaria"]): ("data; submercado; carga_global_mwmed; mmgd_mwmed; carga_liquida_mwmed; mmgd_pct (100 × MMGD ÷ carga "
                                       "global, mesmas horas); pico_global_mwmed e hora_pico_global; pico_liquida_mwmed e hora_pico_liquida "
                                       "(hora de início, Brasília); horas (horas cheias com os dois campos). Desde 15/02/2019."),
        _u(CSV["pico"]): ("data; submercado (SE, S, NE, N, SIN); media_mwmed (média das 24 horas da curva); pico_mwmed (maior valor "
                          "horário); hora_pico (0 a 23, início da hora); classe_dia (util, sabado, domingo_feriado; vazio antes de "
                          "2003); regime. Desde 2000."),
        _u(CSV["perfil"]): ("produto (curva: Curva de Carga Horária; verificada: API); mes (AAAA-MM); submercado; classe_dia; hora (0 a "
                            "23); serie (carga, carga_global, mmgd, carga_liquida); media_mwmed; dias (dias completos na média)."),
        _u(CSV["comparacoes"]): ("submercado; janela (7d, 28d, mes_corrente, ultimo_mes_completo); tipo (mesmas_datas: mesmas datas "
                                 "do ano anterior; equivalente: 364 dias antes, mesmos dias da semana); inicio; fim; inicio_ant; "
                                 "fim_ant; media_mwmed; media_ant_mwmed; variacao_pct (vazio quando os períodos atravessam mudança "
                                 "de regime); mesmo_regime; dias_uteis; dias_uteis_ant; feriados_dia_util; feriados_dia_util_ant."),
        _u(CSV["revisoes"]): ("dataset; serie; ref; capturado_em (UTC) de cada vintage; valor; valor_anterior; diferenca; "
                              "diferenca_pct; situacao (revisao ou quarentena)."),
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


def construir(con, ctx):
    return c.stub(GOLD, "construção ainda não implementada")
