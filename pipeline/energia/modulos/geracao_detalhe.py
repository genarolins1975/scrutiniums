"""Módulo Geração (detalhe): matriz efetiva por combustível, despacho térmico por motivo,
renováveis restringidas e capacidade e utilização (painéis P021 a P024).

Gold: public/energia/gold/geracao_detalhe.json e CSVs em public/energia/series/geracao_*.csv.
Complementa, sem substituir, a gold de operação geracao.json (Balanço de Energia nos
Subsistemas, quatro fontes por subsistema), que continua sendo construída por
pipeline/energia/gold/geracao.py a partir do silver principal.

Fontes (seção "Fontes verificadas" em docs/observatorios/energia/modulos/geracao.md), todas
do portal de dados abertos do ONS, licença CC-BY, coletadas no Parquet oficial (mesmo
conteúdo do CSV do recurso) para a família de silver `ons_geracao`:
- Geração por Usina em Base Horária (geracao-usina-2): 2021 em diante;
- Geração Térmica por Motivo de Despacho (geracao-termica-despacho-2): 2013 em diante;
- CVU das Usinas Térmicas (cvu-usitermica): semanas operativas de 2005 em diante;
- Restrição de Operação por Constrained-off de Usinas Eólicas (restricao_coff_eolica_usi) e
  Fotovoltaicas (restricao_coff_fotovoltaica), e os detalhamentos por usina dos dois
  (últimos três meses publicados);
- Capacidade Instalada de Geração (capacidade-geracao), Modalidade de Operação de Usinas
  (modalidade-usina) e Relacionamento entre Conjuntos e Usinas (usina_conjunto): retratos do dia;
- Fator de Capacidade de Geração Eólica e Solar (fator-capacidade-2): 2022 em diante, usado
  como conferência do fator de capacidade calculado aqui e como fonte de coordenadas;
- dicionários de dados em PDF de cada conjunto (achado A11 e permissões de nulo e zero);
- Balanço de Energia nos Subsistemas: silver principal (só leitura), para a reconciliação.

Achado A11 (quebra de 29/04/2023): fechado com a fonte primária estruturada. No conjunto
Geração por Usina, a modalidade "Pequenas Usinas (MMGD)" (usinas FOTOVOLTAICA com
identificador PQU_<UF>_GD) aparece pela primeira vez na hora 00:00 de 29/04/2023, e a solar
do Balanço é igual, dia a dia, à soma das usinas fotovoltaicas desse conjunto incluindo os
grupos de MMGD. O dicionário da Geração por Usina declara que os grupos de pequenas usinas
"são referentes a previsões de geração". Tratamento: a MMGD é uma categoria própria
("Solar MMGD, estimativa do ONS"), separada da solar centralizada; comparações que
atravessam a data usam o perímetro sem MMGD, que este conjunto permite montar.
"""
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import time
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia.fontes import ckan  # noqa: E402
from pipeline.energia.fontes import ons_geracao as og  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "geracao_detalhe.json"
FAMILIA = "ons_geracao"
META_DIR = os.path.join(base.DADOS, "meta")
SITE = "https://scrutiniums.com/setor-eletrico/geracao"
PAGINA = {"rotulo": "Geração", "href": "/setor-eletrico/geracao"}
REPRODUCAO = "python3 pipeline/energia/executar_modulo.py geracao --sem-coleta"

# silver principal (só leitura)
DS_BAL = "balanco_energia_subsistema_ho"
DS_CONTROLE = "ons_geracao_controle"
DS_DIC = "ons_geracao_dicionarios"

# Conjuntos do ONS integrados. `selecao` decide quais arquivos do pacote entram:
# - usina: 2021 (arquivo anual) e meses de 2022 em diante (arquivos mensais);
# - termica: anos de 2013 a 2021 e meses de 2022 em diante. Os arquivos anuais de 2022 e
#   2023 repetem os mensais (conferido: janeiro de 2022 do anual difere do mensal em
#   5,2 MWh no mês, revisão entre as duas publicações) e ficam de fora para não somar duas vezes;
# - fc: só os mensais (2022 em diante); os anuais 2009 a 2021 não entram;
# - detalhamentos: os três meses mais recentes publicados.
CONJUNTOS = {
    "usina": {"pacote": "geracao-usina-2", "ds": "ons_geracao_usina", "s3": "geracao_usina_2_ho",
              "prefixos": ("GERACAO_USINA-2_",), "titulo": "Geração por Usina em Base Horária",
              "desde": "2021"},
    "termica": {"pacote": "geracao-termica-despacho-2", "ds": "ons_geracao_termica_motivo", "s3": "geracao_termica_despacho_2_ho",
                "prefixos": ("GERACAO_TERMICA_DESPACHO-2_", "GERACAO_TERMICA_DESPACHO_"),
                "titulo": "Geração Térmica por Motivo de Despacho", "desde": "2013", "anual_ate": 2021},
    "cvu": {"pacote": "cvu-usitermica", "ds": "ons_cvu_termica", "s3": "cvu_usitermica_se",
            "prefixos": ("CVU_USINA_TERMICA_",), "titulo": "CVU das Usinas Térmicas", "desde": "2005"},
    "coff_eolica": {"pacote": "restricao_coff_eolica_usi", "ds": "ons_coff_eolica", "s3": "restricao_coff_eolica_tm",
                    "prefixos": ("RESTRICAO_COFF_EOLICA_2",),
                    "titulo": "Restrição de Operação por Constrained-off de Usinas Eólicas", "desde": "2021"},
    "coff_solar": {"pacote": "restricao_coff_fotovoltaica", "ds": "ons_coff_fotovoltaica", "s3": "restricao_coff_fotovoltaica_tm",
                   "prefixos": ("RESTRICAO_COFF_FOTOVOLTAICA_2",),
                   "titulo": "Restrição de Operação por Constrained-off de Usinas Fotovoltaicas", "desde": "2024"},
    "coff_eolica_det": {"pacote": "restricao_coff_eolica_detail", "ds": "ons_coff_eolica_detalhe",
                        "s3": "restricao_coff_eolica_detail_tm", "prefixos": ("RESTRICAO_COFF_EOLICA_DETAIL_",),
                        "titulo": "Restrição por Constrained-off de Usinas Eólicas: detalhamento por usina",
                        "ultimos": 3},
    "coff_solar_det": {"pacote": "restricao_coff_fotovoltaica_detail", "ds": "ons_coff_fotovoltaica_detalhe",
                       "s3": "restricao_coff_fotovoltaica_detail_tm", "prefixos": ("RESTRICAO_COFF_FOTOVOLTAICA_DETAIL_",),
                       "titulo": "Restrição por Constrained-off de Usinas Fotovoltaicas: detalhamento por usina",
                       "ultimos": 3},
    "fc": {"pacote": "fator-capacidade-2", "ds": "ons_fator_capacidade", "s3": "fator_capacidade_2_di",
           "prefixos": ("FATOR_CAPACIDADE-2_",), "titulo": "Fator de Capacidade de Geração Eólica e Solar", "desde": "2022"},
    "capacidade": {"pacote": "capacidade-geracao", "ds": "ons_capacidade_geracao", "s3": "capacidade-geracao",
                   "arquivo": "CAPACIDADE_GERACAO.parquet", "titulo": "Capacidade Instalada de Geração"},
    "modalidade": {"pacote": "modalidade-usina", "ds": "ons_modalidade_usina", "s3": "modalidade_usina",
                   "arquivo": "MODALIDADE_USINA.parquet", "titulo": "Modalidade de Operação de Usinas"},
    "conjunto": {"pacote": "usina_conjunto", "ds": "ons_usina_conjunto", "s3": "usina_conjunto",
                 "arquivo": "RELACIONAMENTO_USINA_CONJUNTO.parquet", "titulo": "Relacionamento entre Conjuntos e Usinas"},
}
# Série histórica oficial da ANEEL da capacidade em operação por tipo de geração (a mesma
# base do SIGA): anual até 2022 e trimestral desde 2023. É o "SIGA por data" do P024: o
# retrato do SIGA não tem histórico no portal, mas esta série tem.
ANEEL_HIST = {"pacote": "empreendimentos-em-operacao", "ds": "aneel_empreendimentos_operacao",
              "arquivo": "empreendimento-operacao-historico.csv",
              "titulo": "Quantidade de empreendimentos de geração de energia em operação"}
# tipo de geração da ANEEL → grupo comparável com as categorias do ONS (térmicas juntas: a
# série da ANEEL não separa combustível)
TIPO_ANEEL_GRUPO = {"UHE": "hidraulica", "PCH": "hidraulica", "CGH": "hidraulica", "EOL": "eolica",
                    "UFV": "solar_centralizada", "UTN": "nuclear", "UTE": "termica"}
GRUPO_ONS_CATS = {"hidraulica": ("hidraulica",), "eolica": ("eolica",), "solar_centralizada": ("solar_centralizada",),
                  "nuclear": ("nuclear",), "termica": ("gas", "carvao", "oleo", "biomassa", "outros")}

# dicionários também do Balanço (achado A11: o dicionário do balanço não menciona MMGD)
PACOTES_DICIONARIO = tuple(cfg["pacote"] for cfg in CONJUNTOS.values()) + ("balanco-energia-subsistema",)
ORDEM_IMPORTACAO = ("usina", "termica", "cvu", "coff_eolica", "coff_solar", "coff_eolica_det", "coff_solar_det", "fc",
                    "capacidade", "modalidade", "conjunto")

INICIO_MMGD = "2023-04-29"  # primeira data com o grupo "Pequenas Usinas (MMGD)": conferida no dado a cada construção


def _url(k):
    return og.PORTAL + CONJUNTOS[k]["pacote"]


def _ds(k):
    return CONJUNTOS[k]["ds"]


def _dataset_registro(k, estado, downloads, descricao, quebras=()):
    cfg = CONJUNTOS[k]
    return {"orgao": "ONS", "nome": cfg["pacote"], "slug": "ons-" + cfg["pacote"].replace("_", "-"), "dataset_silver": cfg["ds"],
            "titulo": cfg["titulo"], "estado": estado, "url": _url(k), "licenca": c.LICENCA_ONS, "tema": "geracao",
            "formatos": ["PARQUET"], "descricao": descricao, "paginas": [PAGINA], "downloads": list(downloads),
            "quebras": list(quebras)}


CSV = {
    "matriz_diaria": "/energia/series/geracao_matriz_diaria.csv",
    "matriz_horaria": "/energia/series/geracao_matriz_horaria_12m.csv",
    "rotulos": "/energia/series/geracao_rotulos_fonte.csv",
    "a11": "/energia/series/geracao_a11_conferencia.csv",
    "reconciliacao": "/energia/series/geracao_reconciliacao_balanco.csv",
    "termica_mensal": "/energia/series/geracao_termica_motivo_mensal.csv",
    "termica_usina": "/energia/series/geracao_termica_usina_mensal.csv",
    "cvu": "/energia/series/geracao_cvu_semanal.csv",
    "restricao_diaria": "/energia/series/geracao_restricao_diaria.csv",
    "restricao_usina": "/energia/series/geracao_restricao_usina_mensal.csv",
    "capacidade_unidades": "/energia/series/geracao_capacidade_unidades.csv",
    "capacidade_usina": "/energia/series/geracao_capacidade_usina_mensal.csv",
    "capacidade_fonte": "/energia/series/geracao_capacidade_fonte_mensal.csv",
}

REGISTRO = {
    "id": "geracao",
    "gold": GOLD,
    "familia": FAMILIA,
    "ordem": 22,
    "datasets": [
        _dataset_registro("usina", "UTILIZADO EM INDICADOR", [CSV["matriz_diaria"], CSV["matriz_horaria"], CSV["rotulos"], CSV["a11"],
                                                              CSV["reconciliacao"], CSV["capacidade_usina"]],
                          "Geração verificada por usina, conjunto e grupo de pequenas usinas, hora a hora; os grupos de pequenas usinas e de MMGD são previsões do ONS.",
                          quebras=[{"data": INICIO_MMGD, "origem": "FONTE",
                                    "descricao": "Aparece a modalidade 'Pequenas Usinas (MMGD)' (fotovoltaica, previsão do ONS); a solar do Balanço de Energia passa a incluí-la."}]),
        _dataset_registro("termica", "UTILIZADO EM INDICADOR", [CSV["termica_mensal"], CSV["termica_usina"]],
                          "Geração programada e verificada das térmicas despachadas pelo ONS, por motivo de despacho, hora a hora."),
        _dataset_registro("cvu", "UTILIZADO EM INDICADOR", [CSV["cvu"]],
                          "Custo variável unitário das térmicas por semana operativa do PMO (vigência de sábado a sexta)."),
        _dataset_registro("coff_eolica", "UTILIZADO EM INDICADOR", [CSV["restricao_diaria"], CSV["restricao_usina"]],
                          "Restrições de operação por constrained-off de eólicas Tipo I, II-B e II-C, por usina ou conjunto e meia hora."),
        _dataset_registro("coff_solar", "UTILIZADO EM INDICADOR", [CSV["restricao_diaria"], CSV["restricao_usina"]],
                          "Restrições de operação por constrained-off de fotovoltaicas Tipo I, II-B e II-C, por usina ou conjunto e meia hora."),
        _dataset_registro("coff_eolica_det", "UTILIZADO EM INDICADOR", [],
                          "Detalhamento por usina dos conjuntos eólicos restringidos: universo de usinas e conferência da soma."),
        _dataset_registro("coff_solar_det", "UTILIZADO EM INDICADOR", [],
                          "Detalhamento por usina dos conjuntos fotovoltaicos restringidos: universo de usinas e conferência da soma."),
        _dataset_registro("fc", "UTILIZADO EM INDICADOR", [CSV["capacidade_fonte"]],
                          "Fator de capacidade horário publicado pelo ONS para eólicas e solares despachadas: conferência e coordenadas."),
        _dataset_registro("capacidade", "UTILIZADO EM INDICADOR", [CSV["capacidade_unidades"], CSV["capacidade_fonte"]],
                          "Potência nominal das unidades geradoras despachadas pelo ONS, com datas de entrada em operação comercial e desativação."),
        _dataset_registro("modalidade", "INTEGRADO", [],
                          "Modalidade de operação de cada usina (Tipo I, II-A, II-B, II-C e III)."),
        _dataset_registro("conjunto", "UTILIZADO EM INDICADOR", [],
                          "Usinas Tipo II-C que compõem cada conjunto, com início e fim do relacionamento."),
        {"orgao": "ANEEL", "nome": ANEEL_HIST["pacote"], "slug": "aneel-empreendimentos-operacao", "dataset_silver": ANEEL_HIST["ds"],
         "titulo": ANEEL_HIST["titulo"], "estado": "UTILIZADO EM INDICADOR", "url": "https://dadosabertos.aneel.gov.br/dataset/" + ANEEL_HIST["pacote"],
         "licenca": ckan.LICENCA_ANEEL, "tema": "geracao", "formatos": ["CSV"],
         "descricao": "Potência instalada em operação por tipo de geração (base do SIGA) em datas de referência: capacidade da ANEEL ao lado da potência do ONS no P024.",
         "paginas": [PAGINA], "downloads": [], "quebras": []},
    ],
    "arquivos": {
        CSV["matriz_diaria"]: (
            "data; regiao (SE, S, NE, N, SIN); horas = instantes horários distintos no arquivo do ONS; colunas por categoria "
            "(hidraulica, eolica, solar_centralizada, solar_mmgd, nuclear, gas, carvao, oleo, biomassa, outros, "
            "termica_sem_combustivel, nao_mapeada) em MWh no dia; total_mwh; total_sem_mmgd_mwh. Vazio = sem dado."),
        CSV["matriz_horaria"]: "hora (local, início do intervalo); colunas por categoria em MWmed no SIN; últimos 366 dias.",
        CSV["rotulos"]: ("ano; tipo_usina, combustivel e modalidade como o ONS escreve; categoria publicada; natureza "
                         "(verificada, grupo_tipo3, grupo_mmgd); mwh no ano."),
        CSV["a11"]: ("data; balanco_solar_sin_mwh (Balanço de Energia); usinas_solar_mwh (soma das usinas FOTOVOLTAICA da "
                     "Geração por Usina); usinas_mmgd_mwh (vazio antes de 29/04/2023: o grupo MMGD não existe na fonte, ausência e "
                     "não zero); usinas_solar_sem_mmgd_mwh; diferenca_mwh = balanço − usinas."),
        CSV["reconciliacao"]: ("mes; fonte do balanço (hidraulica, termica com nuclear, eolica, solar); balanco_mwh; usinas_mwh; "
                               "diferenca_mwh = balanço − usinas; roraima_excluida_mwh (térmica das usinas de Roraima nos dias em que "
                               "o balanço as exclui); diferenca_sem_roraima_mwh = diferença + Roraima excluída; dias; subsistema_dias; "
                               "subsistema_dias_conciliados (|diferença ajustada| ≤ 1 MWh)."),
        CSV["termica_mensal"]: ("mes; regiao; total_mwh (geração verificada); uma coluna por motivo em MWh (partição sem "
                                "dupla contagem); nao_classificado_mwh = total − soma dos motivos; constrained_off_mwh "
                                "(restrição, não geração); horas."),
        CSV["termica_usina"]: ("mes; usina (identidade: chave mais recente da usina, ligando CEGs com o mesmo número de "
                               "empreendimento e elo publicado pelo ONS); nome_usina; chave_fonte (CEG ou código do ONS como a fonte "
                               "publicou no mês); nome_na_fonte (último nom_usina do CEG, pode ser o de uma parcela); subsistema; "
                               "combustivel (rótulo); categoria; origem_combustivel; total_mwh e uma coluna por motivo em MWh. Só "
                               "linhas com algum valor diferente de zero."),
        CSV["cvu"]: ("semana_inicio; semana_fim; pmo (ano-mês de referência e revisão); cod_usina (código do ONS nos modelos); "
                     "usina (nome no CVU); usina_termica (identidade na térmica por motivo; vazio = sem par ou código ambíguo); "
                     "subsistema; categoria; cvu_rs_mwh. De 2021 em diante."),
        CSV["restricao_diaria"]: ("data; fonte (eolica, solar); regiao; razao (REL, CNF, ENE, PAR, SEM); origem (LOC, SIS); "
                                  "energia_nao_gerada_mwh (estimada: referência − verificada nas meias horas limitadas); "
                                  "gnra_fonte_mwh (campo publicado pelo ONS, quando existe); meias_horas_limitadas; e, na linha "
                                  "razao = TOTAL, geracao_verificada_mwh, meias_horas e potencia_max_cortada_mw."),
        CSV["restricao_usina"]: ("mes; fonte; id_ons; nome; subsistema; uf; geracao_verificada_mwh; energia não gerada estimada "
                                 "por razão (eng_REL, eng_CNF, eng_ENE, eng_PAR, eng_SEM, em MWh); meias_horas; meias_horas_limitadas."),
        CSV["capacidade_unidades"]: ("cod_equipamento; usina; ceg; tipo; combustivel (rótulo da unidade); categoria (a da usina "
                                     "na Geração por Usina, a mesma do fator de capacidade); origem_categoria (geracao_por_usina, "
                                     "geracao_por_usina_ceg_base, conjunto, rotulo_da_unidade, demais_unidades_do_ceg); modalidade; "
                                     "subsistema; uf; potencia_mw; entrada_teste; entrada_operacao; desativacao (retrato do dia da captura)."),
        CSV["capacidade_usina"]: ("mes; grupo (ceg:<CEG>, base:<CEG sem versão> ou cju:<conjunto>); identificadores (id_ons da "
                                  "Geração por Usina somados no grupo); nome; categoria; geracao_mwh; horas_com_valor; "
                                  "potencia_operacional_mw (média do mês pelas datas de entrada e desativação das unidades); "
                                  "fator_capacidade_pct; casamento. Últimos 24 meses, só grupos pareados."),
        CSV["capacidade_fonte"]: ("mes; categoria; potencia_operacional_mw (todas as unidades do retrato em operação no mês); "
                                  "geracao_pareada_mwh; capacidade_hora_pareada_mwh; fator_capacidade_pct; cobertura_pct; "
                                  "fc_ons_pct (eólica e solar, conjunto Fator de Capacidade do ONS)."),
    },
}


# ================================================================ coleta

def _espera_memoria(minimo_gb=3.0, limite_s=600):
    """Antes de ler um arquivo grande, espera haver memória livre (a máquina é compartilhada
    com outros processamentos). Sem /proc/meminfo, segue."""
    t0 = time.time()
    while time.time() - t0 < limite_s:
        try:
            with open("/proc/meminfo") as f:
                livre = next(int(l.split()[1]) for l in f if l.startswith("MemAvailable")) / 1024 / 1024
        except Exception:
            return
        if livre >= minimo_gb:
            return
        time.sleep(20)


def _max_idade(periodo, hoje):
    """Mês corrente e anterior (ou ano corrente) mudam todo dia; o resto só é baixado de
    novo quando o last_modified muda ou a cada 30 dias."""
    if not periodo:
        return 0.4
    ano = int(periodo[:4])
    if len(periodo) >= 7:
        idx = ano * 12 + int(periodo[5:7])
        return 0.4 if (hoje.year * 12 + hoje.month) - idx <= 1 else 30
    return 0.4 if ano >= hoje.year else 30


def selecionar(k, recursos):
    """{recurso: info} dos arquivos que entram, pela regra de CONJUNTOS[k]."""
    cfg = CONJUNTOS[k]
    out = {}
    for nome, info in recursos.items():
        p = info.get("periodo")
        if not p:
            continue
        if cfg.get("desde") and p[:4] < cfg["desde"]:
            continue
        if len(p) == 4 and cfg.get("anual_ate") is not None and int(p) > cfg["anual_ate"]:
            continue
        out[nome] = info
    if cfg.get("ultimos"):
        mensais = sorted((info["periodo"], nome) for nome, info in out.items() if len(info["periodo"]) == 7)
        manter = {nome for _, nome in mensais[-cfg["ultimos"]:]}
        out = {n: i for n, i in out.items() if n in manter}
    return out


def _controle(con):
    return base.registros_como_estavam_em(con, DS_CONTROLE)


# Versão da importação por dataset. Registro não se reescreve dentro da mesma vintage
# (chave primária inclui a vintage), então uma mudança no que a importação grava (nova
# agregação) sobe a versão e a marca passa a ser "importado@<versão>": as vintages
# vigentes são relidas do bronze na próxima coleta.
# Versão 3 da térmica: parcelas (todos os códigos do ONS de cada CEG no arquivo) e geração
# por parcela. Versão 2 das restrições: soma das referências na meia hora do maior corte.
VERSAO_IMPORTACAO = {"ons_geracao_usina": 2, "ons_geracao_termica_motivo": 3, "ons_coff_eolica": 2,
                     "ons_coff_fotovoltaica": 2}


def _campo(vid, nome):
    ver = VERSAO_IMPORTACAO.get(vid.split(":", 1)[0], 1)
    return nome if ver == 1 else f"{nome}@{ver}"


def _importado(ctrl, vid):
    return bool(ctrl.get(vid, {}).get(_campo(vid, "importado")))


def _marca_importado(con, vid, relatorio, manifesto=None):
    linhas = [(vid, _campo(vid, "importado"), json.dumps(relatorio, ensure_ascii=False, sort_keys=True, default=str))]
    if manifesto is not None:
        linhas.append((vid, _campo(vid, "manifesto"), json.dumps(sorted(manifesto), ensure_ascii=False)))
    base.grava_registros(con, DS_CONTROLE, vid, linhas)


def _parquet_temporario(vintage):
    """Bronze (gzip) → arquivo temporário descomprimido, legível pelo pyarrow."""
    fd, tmp = tempfile.mkstemp(prefix="geracao-", suffix=".parquet")
    os.close(fd)
    with base.abre_bronze(vintage["arquivo"]) as f, open(tmp, "wb") as g:
        shutil.copyfileobj(f, g, 1 << 20)
    return tmp


def _r(v, casas=4):
    return None if v is None else round(v, casas)


def _importa_usina(con, v, periodo):
    tmp = _parquet_temporario(v)
    try:
        a = og.agrega_geracao_usina(og.lotes(tmp, og.COLS_USINA))
    finally:
        os.remove(tmp)
    ds = _ds("usina")
    obs, manif = [], set()
    nval, nlin = defaultdict(int), defaultdict(int)
    for (dia, sm, ti, co, mo), (mwh, cnt, lin) in a["diario"].items():
        s = f"d|{sm}|{ti}|{co}|{mo}"
        manif.add(s)
        if cnt:
            obs.append((s, dia, _r(mwh)))
        nval[(dia, sm)] += cnt
        nlin[(dia, sm)] += lin
    for (dia, sm), n in nval.items():
        obs.append((f"nval|{sm}", dia, float(n)))
        obs.append((f"nlin|{sm}", dia, float(nlin[(dia, sm)])))
        manif.update((f"nval|{sm}", f"nlin|{sm}"))
    for (dia, sm), n in a["horas_dia"].items():
        obs.append((f"nh|{sm}", dia, float(n)))
        manif.add(f"nh|{sm}")
    for (hora, cat), mwh in a["horario"].items():
        obs.append((f"h|{cat}", hora, _r(mwh)))
        manif.add(f"h|{cat}")
    for (mes, ido), (mwh, cnt, lin) in a["usina_mes"].items():
        manif.update((f"u|{ido}", f"un|{ido}"))
        if cnt:
            obs.append((f"u|{ido}", mes, _r(mwh)))
        obs.append((f"un|{ido}", mes, float(cnt)))
    for (mes, uf, ti, co, mo), mwh in a["uf_mes"].items():
        s = f"f|{uf}|{ti}|{co}|{mo}"
        manif.add(s)
        obs.append((s, mes, _r(mwh)))
    for (dia, ti), mwh in a["roraima_dia"].items():
        s = f"rr|{ti}"
        manif.add(s)
        obs.append((s, dia, _r(mwh)))
    novas, revs = base.grava_observacoes(con, ds, v["vintage_id"], obs)
    regs = [(ido, campo, val) for ido, cad in a["cadastro"].items() for campo, val in cad.items() if val not in (None, "")]
    base.grava_registros(con, ds, v["vintage_id"], regs)
    rel = {**a["rel"], "periodo": periodo, "observacoes": len(obs), "novas": novas, "revisoes": revs, "usinas": len(a["cadastro"])}
    _marca_importado(con, v["vintage_id"], rel, manif)
    return rel


def _importa_termica(con, v, periodo):
    tmp = _parquet_temporario(v)
    try:
        cols = og.colunas_do_arquivo(tmp)
        a = og.agrega_termica(og.lotes(tmp, og.COLS_TERMICA))
    finally:
        os.remove(tmp)
    ds = _ds("termica")
    obs, manif = [], set()
    for (dia, sm, m), mwh in a["diario"].items():
        s = f"t|{sm}|{m}"
        manif.add(s)
        obs.append((s, dia, _r(mwh)))
    for (mes, ch, m), mwh in a["usina_mes"].items():
        s = f"tu|{ch}|{m}"
        manif.add(s)
        obs.append((s, mes, _r(mwh)))
    for (mes, ch, cod), mwh in a["parcela_mes"].items():
        s = f"tp|{ch}|{cod}"
        manif.add(s)
        obs.append((s, mes, _r(mwh)))
    for dia, n in a["horas_dia"].items():
        obs.append(("tnh", dia, float(n)))
    manif.add("tnh")
    novas, revs = base.grava_observacoes(con, ds, v["vintage_id"], obs)
    # `parcelas` vai como JSON: o histórico de registros guarda cada conjunto de códigos que
    # o arquivo trouxe para o CEG, e a união dos históricos dá todos os códigos da usina
    regs = [(ch, campo, json.dumps(val, ensure_ascii=False) if campo == "parcelas" else val)
            for ch, cad in a["cadastro"].items() for campo, val in cad.items() if val not in (None, "", [])]
    base.grava_registros(con, ds, v["vintage_id"], regs)
    rel = {**a["rel"], "periodo": periodo, "observacoes": len(obs), "novas": novas, "revisoes": revs,
           "usinas": len(a["cadastro"]), "presentes": a["presentes"],
           "colunas_ausentes": sorted(set(og.COLS_TERMICA) - set(cols))}
    _marca_importado(con, v["vintage_id"], rel, manif)
    return rel


def _importa_cvu(con, v, periodo):
    tmp = _parquet_temporario(v)
    try:
        a = og.le_cvu(og.lotes(tmp, og.COLS_CVU))
    finally:
        os.remove(tmp)
    ds = _ds("cvu")
    obs, regs, manif = [], [], set()
    semanas = {}
    for (ini, cod), reg in a["linhas"].items():
        s = f"cvu|{cod}"
        manif.add(s)
        if reg["cvu"] is not None:
            obs.append((s, ini, reg["cvu"]))
        semanas[ini] = reg
        regs += [(f"usi|{cod}", "nome", reg["nome"]), (f"usi|{cod}", "sm", reg["sm"])]
    for ini, reg in semanas.items():
        regs += [(f"sem|{ini}", "fim", reg["fim"]), (f"sem|{ini}", "ano_ref", reg["ano_ref"]),
                 (f"sem|{ini}", "mes_ref", reg["mes_ref"]), (f"sem|{ini}", "revisao", reg["revisao"]),
                 (f"sem|{ini}", "estudo", reg["estudo"])]
    novas, revs = base.grava_observacoes(con, ds, v["vintage_id"], obs)
    base.grava_registros(con, ds, v["vintage_id"], [r_ for r_ in regs if r_[2] not in (None, "")])
    rel = {"periodo": periodo, "lidas": a["lidas"], "linhas": len(a["linhas"]), "repetidas_identicas": a["repetidas"],
           "conflitos": a["conflitos"][:20], "n_conflitos": len(a["conflitos"]), "novas": novas, "revisoes": revs,
           "semanas": len(semanas)}
    _marca_importado(con, v["vintage_id"], rel, manif)
    return rel


def _importa_coff(con, k, v, periodo):
    tmp = _parquet_temporario(v)
    try:
        a = og.agrega_restricao(og.lotes(tmp, og.COLS_COFF))
    finally:
        os.remove(tmp)
    ds = _ds(k)
    obs, manif = [], set()

    def add(s, ref, val):
        manif.add(s)
        if val is not None:
            obs.append((s, ref, _r(val)))

    for (dia, sm), x in a["diario_sm"].items():
        add(f"g|{sm}", dia, x["ger"])
        add(f"r|{sm}", dia, x["ref"])
        add(f"m|{sm}", dia, float(x["meias"]))
        add(f"l|{sm}", dia, float(x["lim"]))
        add(f"lsr|{sm}", dia, float(x["lim_sem_ref"]))
        add(f"gn|{sm}", dia, float(x["ger_nula"]))
    for (dia, sm, raz, orig), x in a["diario_razao"].items():
        add(f"e|{sm}|{raz}|{orig}", dia, x["eng"])
        add(f"lm|{sm}|{raz}|{orig}", dia, float(x["meias"]))
        if x["gnra_n"]:
            add(f"a|{sm}|{raz}|{orig}", dia, x["gnra"])
    regs = []
    for (dia, sm), (mw, inst, ref) in a["pot_max"].items():
        add(f"p|{sm}", dia, mw)
        add(f"pr|{sm}", dia, ref)
        regs.append((f"p|{sm}|{dia}", "instante", inst))
    for (mes, ido), x in a["usina_mes"].items():
        for campo, val in x.items():
            add(f"u{campo}|{ido}", mes, float(val))
    por_mes = defaultdict(list)
    for (mes, desc), eng in a["descricoes_mes"].items():
        por_mes[mes].append((eng, desc))
    for mes, xs in por_mes.items():
        top = [[d_, round(e_, 3)] for e_, d_ in sorted(xs, reverse=True)[:20]]
        regs.append((f"desc|{mes}", "top", json.dumps(top, ensure_ascii=False)))
        regs.append((f"desc|{mes}", "n_descricoes", len(xs)))
    regs += [(ido, campo, val) for ido, cad in a["cadastro"].items() for campo, val in cad.items() if val not in (None, "")]
    novas, revs = base.grava_observacoes(con, ds, v["vintage_id"], obs)
    base.grava_registros(con, ds, v["vintage_id"], regs)
    rel = {**a["rel"], "periodo": periodo, "observacoes": len(obs), "novas": novas, "revisoes": revs,
           "usinas": len(a["cadastro"])}
    _marca_importado(con, v["vintage_id"], rel, manif)
    return rel


def _importa_coff_det(con, k, v, periodo):
    tmp = _parquet_temporario(v)
    try:
        a = og.agrega_restricao_detalhe(og.lotes(tmp, og.COLS_COFF_DET))
    finally:
        os.remove(tmp)
    ds = _ds(k)
    obs, manif = [], set()
    for mes, x in a["mes"].items():
        for campo, val in x.items():
            obs.append((f"det|{campo}", mes, float(val)))
            manif.add(f"det|{campo}")
    for (mes, conj), ger in a["conjunto_mes"].items():
        obs.append((f"dc|{conj}", mes, _r(ger)))
        manif.add(f"dc|{conj}")
    novas, revs = base.grava_observacoes(con, ds, v["vintage_id"], obs)
    rel = {"periodo": periodo, "observacoes": len(obs), "novas": novas, "revisoes": revs,
           "mes": {m: {kk: (round(vv, 3) if isinstance(vv, float) else vv) for kk, vv in x.items()} for m, x in a["mes"].items()}}
    _marca_importado(con, v["vintage_id"], rel, manif)
    return rel


def _importa_fc(con, v, periodo):
    tmp = _parquet_temporario(v)
    try:
        a = og.agrega_fator_capacidade(og.lotes(tmp, og.COLS_FC))
    finally:
        os.remove(tmp)
    ds = _ds("fc")
    obs, manif = [], set()
    for (mes, ido), (g, cap, h) in a["usina_mes"].items():
        for pre, val in (("fg", g), ("fc", cap), ("fh", float(h))):
            obs.append((f"{pre}|{ido}", mes, _r(val)))
            manif.add(f"{pre}|{ido}")
    for (mes, sm, tipo), (g, cap, h) in a["tipo_mes"].items():
        for pre, val in (("tg", g), ("tc", cap), ("th", float(h))):
            obs.append((f"{pre}|{sm}|{tipo}", mes, _r(val)))
            manif.add(f"{pre}|{sm}|{tipo}")
    regs = [(ido, campo, val) for ido, cad in a["cadastro"].items() for campo, val in cad.items() if val not in (None, "")]
    novas, revs = base.grava_observacoes(con, ds, v["vintage_id"], obs)
    base.grava_registros(con, ds, v["vintage_id"], regs)
    rel = {**a["rel"], "periodo": periodo, "observacoes": len(obs), "novas": novas, "revisoes": revs, "usinas": len(a["cadastro"])}
    _marca_importado(con, v["vintage_id"], rel, manif)
    return rel


COLS_CAP = ["id_subsistema", "id_estado", "nom_modalidadeoperacao", "nom_tipousina", "nom_usina", "ceg", "cod_equipamento",
            "nom_combustivel", "dat_entradateste", "dat_entradaoperacao", "dat_desativacao", "val_potenciaefetiva",
            "nom_agenteproprietario", "id_ons"]


def _importa_capacidade(con, v):
    tmp = _parquet_temporario(v)
    try:
        cols = og.colunas_do_arquivo(tmp)
        unidades, rel = og.le_capacidade(og.lotes(tmp, COLS_CAP))
    finally:
        os.remove(tmp)
    regs = [(cod, campo, val) for cod, u in unidades.items() for campo, val in u.items() if val not in (None, "")]
    # unidade que some do retrato fica registrada como apagada pela fonte (grava_registros)
    antigas = base.registros_como_estavam_em(con, _ds("capacidade"))
    for cod, campos in antigas.items():
        if cod not in unidades:
            regs += [(cod, campo, None) for campo in campos]
    base.grava_registros(con, _ds("capacidade"), v["vintage_id"], regs)
    rel = {**rel, "unidades": len(unidades), "tem_id_ons": "id_ons" in cols, "colunas": cols,
           "sumiram_do_retrato": sum(1 for cod in antigas if cod not in unidades)}
    _marca_importado(con, v["vintage_id"], rel)
    return rel


def _importa_tabela(con, k, v, chave_de):
    tmp = _parquet_temporario(v)
    try:
        linhas = og.le_tabela(og.lotes(tmp, og.colunas_do_arquivo(tmp)))
    finally:
        os.remove(tmp)
    regs, chaves = [], Counter()
    for l_ in linhas:
        ch = chave_de(l_)
        chaves[ch] += 1
        regs += [(ch, campo, val) for campo, val in l_.items() if val not in (None, "")]
    base.grava_registros(con, _ds(k), v["vintage_id"], regs)
    rel = {"linhas": len(linhas), "chaves": len(chaves), "chaves_repetidas": sum(1 for n in chaves.values() if n > 1)}
    _marca_importado(con, v["vintage_id"], rel)
    return rel


def _chave_modalidade(l_):
    return l_.get("ceg") or f"sem_ceg:{l_.get('nom_usina')}"


def _chave_conjunto(l_):
    return f"{l_.get('id_ons_conjunto')}|{l_.get('ceg') or l_.get('id_ons_usina')}|{l_.get('dat_iniciorelacionamento')}"


def texto_pdf(caminho_relativo):
    """Texto de um PDF do bronze pelo pdftotext -layout; None sem a ferramenta."""
    exe = shutil.which("pdftotext")
    if not exe:
        return None
    fd, tmp = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    try:
        with base.abre_bronze(caminho_relativo) as f, open(tmp, "wb") as g:
            g.write(f.read())
        return subprocess.run([exe, "-layout", tmp, "-"], capture_output=True, text=True, timeout=60).stdout
    finally:
        os.remove(tmp)


def leitura_dicionario(txt):
    """Data do documento, versões declaradas e permissões (nulo, zerado, negativo) de cada
    campo numérico, a partir do texto do dicionário do ONS."""
    import re
    if txt is None:
        return None
    versoes = [{"versao": v_, "descricao": " ".join(t_.split())[:400]}
               for v_, t_ in re.findall(r"Vers[ãa]o?p?\s+(\d+\.\d+)\s+(.*?)(?=\n\s*(?:\d{2}[-/]\d{2}[-/]\d{4}\s+)?Vers|\n\s*\d{2}[-/]\d{2}[-/]\d{4}\s+Vers|\Z)", txt, flags=re.S)]
    datas = re.findall(r"Data:\s*(\d{2}-\d{2}-\d{4})", txt)
    perm = {}
    for cod, tipo, nulo, zero, neg in re.findall(r"\b((?:val|num|flg)_\w+)\s+(FLOAT|INTEIRO|INTEGER|DECIMAL)\s+(?:\S+\s+){0,3}?(Sim|Não)\s+(Sim|Não|-+)\s+(Sim|Não|-+)", txt):
        perm[cod] = {"nulo": nulo == "Sim", "zerado": zero == "Sim", "negativo": neg == "Sim"}
    return {"data_documento": datas[0] if datas else None, "versoes": versoes, "permissoes": perm,
            "menciona_mmgd": "MMGD" in txt.upper() or "MICRO E MINIGERA" in txt.upper(),
            "texto": " ".join(txt.split())[:6000]}


def _coleta_dicionarios(con, pacotes, status):
    for pac_nome, pac in pacotes.items():
        if not pac:
            continue
        d = og.dicionario_pdf(pac)
        if not d:
            status["falhas"].append(f"{pac_nome}: dicionário em PDF não encontrado no pacote")
            continue
        res = ckan.baixar_recurso(con, orgao="ONS", dataset=DS_DIC, recurso=pac_nome, url=d["url"],
                                  publicado_em=d.get("last_modified"), ext="pdf", max_idade_dias=7)
        status["dicionarios"][pac_nome] = res["status"]
        v = res.get("vintage")
        if res["status"] == "falha":
            status["falhas"].append(f"dicionário {pac_nome}: {res['detalhe']}")
        if v and not _importado(_controle(con), v["vintage_id"]):
            leitura = leitura_dicionario(texto_pdf(v["arquivo"]))
            base.grava_registros(con, DS_DIC, v["vintage_id"],
                                 [(pac_nome, "leitura", json.dumps(leitura, ensure_ascii=False)), (pac_nome, "url", d["url"])])
            _marca_importado(con, v["vintage_id"], {"pacote": pac_nome, "lido": leitura is not None})
            con.commit()


# Descrições oficiais dos conjuntos (campo "notes" do package_show do portal do ONS) que
# fundamentam o achado A11: a da Carga de Energia declara a inclusão da MMGD em 29/04/2023;
# a da Geração por Usina declara que os grupos de pequenas usinas são previsões; a do
# Balanço não menciona a MMGD. O JSON da API é guardado no bronze com sha256.
PACOTES_NOTAS = ("carga-energia", "geracao-usina-2", "balanco-energia-subsistema")


def _coleta_notas(con, status):
    for nome in PACOTES_NOTAS:
        url = f"{ckan.PORTAIS['ONS']}/api/3/action/package_show?id={nome}"
        res = ckan.baixar_recurso(con, orgao="ONS", dataset=DS_DIC, recurso=f"pacote_{nome}", url=url, ext="json",
                                  max_idade_dias=7)
        status["dicionarios"][f"pacote_{nome}"] = res["status"]
        v = res.get("vintage")
        if res["status"] == "falha":
            status["falhas"].append(f"descrição {nome}: {res['detalhe']}")
        if v and not _importado(_controle(con), v["vintage_id"]):
            try:
                with base.abre_bronze(v["arquivo"]) as f:
                    pac = json.loads(f.read().decode("utf-8"))["result"]
                base.grava_registros(con, DS_DIC, v["vintage_id"], [
                    (f"pacote_{nome}", "notas", (pac.get("notes") or "").strip()),
                    (f"pacote_{nome}", "titulo", pac.get("title")),
                    (f"pacote_{nome}", "metadata_modified", pac.get("metadata_modified")),
                    (f"pacote_{nome}", "url", ckan.url_dataset("ONS", nome))])
                _marca_importado(con, v["vintage_id"], {"pacote": nome})
            except Exception as e:  # JSON truncado ou sem result: registrado
                status["falhas"].append(f"descrição {nome}: {e}")
            con.commit()


def importa_pendentes(con, k, alvo, status):
    """Importa do bronze as vintages vigentes do conjunto `k` ainda não importadas na versão
    atual da importação (inclui as puladas na coleta). `alvo` vazio = todas as vigentes;
    sem rede, isto basta para reler o bronze depois de uma mudança de versão."""
    cfg = CONJUNTOS[k]
    ds = cfg["ds"]
    ctrl = _controle(con)
    vig = ckan.vintages_vigentes(con, ds)
    for recurso, v in sorted(vig.items(), key=lambda x: og.periodo_do_arquivo(x[0] + ".parquet") or ""):
        if _importado(ctrl, v["vintage_id"]):
            continue
        if not cfg.get("arquivo") and recurso not in alvo and alvo:
            continue  # arquivo que saiu da seleção (ex.: detalhamento mais antigo)
        periodo = og.periodo_do_arquivo(recurso + ".parquet")
        _espera_memoria()
        try:
            if k == "usina":
                rel = _importa_usina(con, v, periodo)
            elif k == "termica":
                rel = _importa_termica(con, v, periodo)
            elif k == "cvu":
                rel = _importa_cvu(con, v, periodo)
            elif k in ("coff_eolica", "coff_solar"):
                rel = _importa_coff(con, k, v, periodo)
            elif k in ("coff_eolica_det", "coff_solar_det"):
                rel = _importa_coff_det(con, k, v, periodo)
            elif k == "fc":
                rel = _importa_fc(con, v, periodo)
            elif k == "capacidade":
                rel = _importa_capacidade(con, v)
            elif k == "modalidade":
                rel = _importa_tabela(con, k, v, _chave_modalidade)
            else:
                rel = _importa_tabela(con, k, v, _chave_conjunto)
            status["importacoes"][recurso] = {kk: rel.get(kk) for kk in ("linhas", "observacoes", "novas", "revisoes")}
            base.registra_coleta(con, ds, recurso, True, f"importação: {rel.get('observacoes', rel.get('linhas'))}")
        except Exception as e:  # arquivo ilegível ou formato novo: registrado, sem número
            base.registra_coleta(con, ds, recurso, False, f"importação: {e}")
            status["falhas"].append(f"{recurso} importação: {e}")
        con.commit()


def _coleta_aneel_historico(con, status):
    """Série histórica da capacidade em operação por tipo de geração (ANEEL), CSV pequeno."""
    try:
        pac = ckan.pacote("ANEEL", ANEEL_HIST["pacote"])
        base.escreve_gold(f"_meta_{ANEEL_HIST['ds']}.json", ckan.metadados(pac, "ANEEL"), destino=META_DIR)
    except Exception as e:
        status["falhas"].append(f"{ANEEL_HIST['pacote']} package_show: {e}")
        return
    rec = next((r for r in pac.get("resources", []) if (r.get("url") or "").endswith(ANEEL_HIST["arquivo"])), None)
    if not rec:
        status["falhas"].append(f"{ANEEL_HIST['pacote']}: recurso {ANEEL_HIST['arquivo']} não encontrado")
        return
    res = ckan.baixar_recurso(con, orgao="ANEEL", dataset=ANEEL_HIST["ds"], recurso=ANEEL_HIST["arquivo"], url=rec["url"],
                              publicado_em=rec.get("last_modified"), ext="csv", max_idade_dias=7)
    status["conjuntos"]["aneel_historico"] = res["status"]
    if res["status"] == "falha":
        status["falhas"].append(f"{ANEEL_HIST['arquivo']}: {res['detalhe']}")
    v = res.get("vintage")
    if v and not _importado(_controle(con), v["vintage_id"]):
        try:
            rel = importa_aneel_historico(con, v)
            status["importacoes"][ANEEL_HIST["arquivo"]] = rel
        except Exception as e:  # formato novo: registrado, sem número
            status["falhas"].append(f"{ANEEL_HIST['arquivo']} importação: {e}")
    con.commit()


def le_aneel_historico(linhas):
    """Linhas do CSV (DatGeracaoConjuntoDados; SigTipoGeracao; QtdUsinasPeriodo;
    MdaPotenciaInstaladaKW; MesReferencia; AnoReferencia) → {(tipo, 'AAAA-MM'): (kW, usinas)}
    e a data de geração do arquivo. Mês com espaço ('5 ') é aparado; vazio é ausência."""
    out, data_geracao, invalidas = {}, None, 0
    for r in linhas:
        t = (r.get("SigTipoGeracao") or "").strip().upper()
        ano, mes = (r.get("AnoReferencia") or "").strip(), (r.get("MesReferencia") or "").strip()
        if not (t and ano.isdigit() and mes.isdigit()):
            invalidas += 1
            continue
        out[(t, f"{ano}-{int(mes):02d}")] = (ckan.numero_br(r.get("MdaPotenciaInstaladaKW")), ckan.numero_br(r.get("QtdUsinasPeriodo")))
        data_geracao = (r.get("DatGeracaoConjuntoDados") or "").strip() or data_geracao
    return out, data_geracao, invalidas


def importa_aneel_historico(con, v):
    dados, data_geracao, invalidas = le_aneel_historico(ckan.le_csv_bronze(v["arquivo"]))
    obs = []
    for (t, ref), (kw, n) in dados.items():
        if kw is not None:
            obs.append((f"emp_op.kw.{t}", ref, kw))
        if n is not None:
            obs.append((f"emp_op.n.{t}", ref, n))
    novas, revs = base.grava_observacoes(con, ANEEL_HIST["ds"], v["vintage_id"], obs)
    base.grava_registros(con, ANEEL_HIST["ds"], v["vintage_id"], [("arquivo", "data_geracao", data_geracao)])
    rel = {"linhas": len(dados), "invalidas": invalidas, "observacoes": len(obs), "novas": novas, "revisoes": revs,
           "data_geracao": data_geracao}
    _marca_importado(con, v["vintage_id"], rel)
    return rel


def coletar(con, ctx):
    """Coleta do módulo. Nunca lança por falha de fonte: cada falha vira registro em
    `coletas` e item em `falhas`; a gold anterior fica no ar pela sentinela."""
    hoje = ctx.get("hoje") or date.today()
    status = {"ok": True, "falhas": [], "conjuntos": {}, "importacoes": {}, "dicionarios": {}}
    pacotes = {}
    # ctx["somente"]: subconjunto de CONJUNTOS (execução por partes, em primeiro plano)
    for k in [x for x in ORDEM_IMPORTACAO if x in (ctx.get("somente") or ORDEM_IMPORTACAO)]:
        cfg = CONJUNTOS[k]
        ds = cfg["ds"]
        st = status["conjuntos"].setdefault(k, {"novas": 0, "identicas": 0, "puladas": 0, "falhas": 0})
        try:
            pac = ckan.pacote("ONS", cfg["pacote"])
            pacotes[cfg["pacote"]] = pac
            base.escreve_gold(f"_meta_{ds}.json", ckan.metadados(pac, "ONS"), destino=META_DIR)
        except Exception as e:  # pane da API: registrada, sem dado inventado
            base.registra_coleta(con, ds, "*", False, f"package_show: {e}")
            status["falhas"].append(f"{cfg['pacote']} package_show: {e}")
            continue
        if cfg.get("arquivo"):
            info = og.recurso_unico(pac, cfg["arquivo"])
            alvo = {cfg["arquivo"][:-8]: {**info, "periodo": None}} if info else {}
            if not info:
                status["falhas"].append(f"{cfg['pacote']}: recurso {cfg['arquivo']} não encontrado")
        else:
            alvo = selecionar(k, og.recursos_parquet(pac, cfg["prefixos"]))
        for recurso, info in sorted(alvo.items(), key=lambda x: x[1].get("periodo") or ""):
            res = ckan.baixar_recurso(con, orgao="ONS", dataset=ds, recurso=recurso, url=info["url"],
                                      publicado_em=info.get("last_modified"), ext="parquet",
                                      max_idade_dias=_max_idade(info.get("periodo"), hoje))
            chave = {"nova": "novas", "identica": "identicas", "pulada": "puladas"}.get(res["status"], "falhas")
            st[chave] += 1
            if res["status"] == "falha":
                status["falhas"].append(f"{recurso}: {res['detalhe']}")
        importa_pendentes(con, k, alvo, status)
    if not ctx.get("somente") or "aneel_historico" in ctx["somente"]:
        _coleta_aneel_historico(con, status)
    if ctx.get("somente") and "dicionarios" not in ctx["somente"]:
        status["ok"] = not status["falhas"]
        return status
    for k in ORDEM_IMPORTACAO:
        if CONJUNTOS[k]["pacote"] not in pacotes:
            try:
                pacotes[CONJUNTOS[k]["pacote"]] = ckan.pacote("ONS", CONJUNTOS[k]["pacote"])
            except Exception as e:
                status["falhas"].append(f"{CONJUNTOS[k]['pacote']} package_show: {e}")
    try:
        pacotes["balanco-energia-subsistema"] = ckan.pacote("ONS", "balanco-energia-subsistema")
    except Exception as e:
        status["falhas"].append(f"balanco-energia-subsistema package_show: {e}")
    _coleta_dicionarios(con, pacotes, status)
    _coleta_notas(con, status)
    status["ok"] = not status["falhas"]
    return status


# ================================================================ leitura do silver

def vigentes(con, ds, prefixo=None):
    """{(serie, ref): valor} vigente (última captura) das séries que começam por `prefixo`
    (None = todas as séries do dataset)."""
    if prefixo:
        fim = prefixo[:-1] + chr(ord(prefixo[-1]) + 1)
        filtro, extra = "AND o.serie >= ? AND o.serie < ?", (prefixo, fim)
    else:
        filtro, extra = "", ()
    out = {}
    for serie, ref, valor in con.execute(
            f"""SELECT o.serie, o.ref, o.valor FROM observacoes o JOIN vintages v ON v.vintage_id = o.vintage_id
               WHERE o.dataset = ? {filtro} ORDER BY v.capturado_em, o.rowid""", (ds, *extra)):
        out[(serie, ref)] = valor
    return out


def manifestos(con, ds):
    """{periodo do arquivo: set(séries)} das vintages vigentes do dataset. Uma série que
    sumiu de um arquivo republicado (rótulo renomeado pela fonte) não é somada de novo."""
    ctrl = _controle(con)
    out = {}
    for recurso, v in ckan.vintages_vigentes(con, ds).items():
        man = ctrl.get(v["vintage_id"], {}).get(_campo(v["vintage_id"], "manifesto"))
        per = og.periodo_do_arquivo(recurso + ".parquet")
        if man is not None and per:
            out[per] = set(json.loads(man))
    return out


def filtra_manifesto(obs, man):
    """Mantém (serie, ref) só quando a série consta do manifesto do arquivo que cobre a
    referência (arquivo mensal AAAA-MM, senão o anual AAAA)."""
    out = {}
    for (serie, ref), v in obs.items():
        m = man.get(ref[:7])
        if m is None:
            m = man.get(ref[:4])
        if m is not None and serie in m:
            out[(serie, ref)] = v
    return out


def relatorios(con, ds):
    """{recurso: relatório de importação} das vintages vigentes."""
    ctrl = _controle(con)
    out = {}
    for recurso, v in ckan.vintages_vigentes(con, ds).items():
        x = ctrl.get(v["vintage_id"], {}).get(_campo(v["vintage_id"], "importado"))
        out[recurso] = json.loads(x) if x else None
    return out


# ================================================================ gold

SM = c.ORDEM_SM
REGIOES = ("SIN",) + SM
CATS = [k for k, _ in og.CATEGORIAS]
ROTULO_CAT = dict(og.CATEGORIAS)
MOTIVOS = [m for m, _, _ in og.MOTIVOS]
ROTULO_MOTIVO = {m: r_ for m, _, r_ in og.MOTIVOS}
NATUREZAS = ("verificada", "grupo_tipo3", "grupo_mmgd")
ROTULO_NATUREZA = {
    "verificada": "Geração verificada (usinas e conjuntos com relacionamento com o ONS)",
    "grupo_tipo3": "Previsão do ONS para grupos de pequenas usinas Tipo III",
    "grupo_mmgd": "Estimativa do ONS para a micro e minigeração distribuída (MMGD)",
}
# Tolerância da reconciliação diária com o Balanço, por subsistema, fonte e dia: 1 MWh.
# O balanço publica MWmed com três casas por subsistema e hora; a Geração por Usina, com
# três a oito casas por usina e hora. O erro de arredondamento esperado da soma de um dia
# (até 24 × 700 parcelas de ±0,0005) tem desvio-padrão de cerca de 0,04 MWh; 1 MWh é 25
# desvios, e qualquer diferença de definição (uma usina a mais ou a menos) passa disso.
TOL_DIA_MWH = 1.0
# Fator de capacidade mensal acima de 100% numa usina é fisicamente impossível com a
# potência certa: indica potência do cadastro menor que a real no mês (unidade em teste
# gerando antes da operação comercial, repotenciação não registrada). Fica na conta e é
# contado nos controles, nunca descartado em silêncio.
FC_MAX_PLAUSIVEL = 100.0
GRUPO_FC = {"Eólica": "eolica", "Solar": "solar_centralizada"}


def _n(v, casas=0):
    if v is None:
        return "sem dado"
    s = f"{abs(v):,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("−" if v < 0 else "") + s


def _pct(v, casas=1):
    return "sem dado" if v is None else _n(v, casas) + "%"


def _mes_seguinte(m):
    a, b = int(m[:4]), int(m[5:7])
    return f"{a + (b == 12)}-{(b % 12) + 1:02d}"


def _meses_entre(ini, fim):
    out, m = [], ini
    while m <= fim:
        out.append(m)
        m = _mes_seguinte(m)
    return out


def _div(a, b):
    return None if a is None or not b else a / b


def _fonte(k, recurso):
    cfg = CONJUNTOS[k]
    return {"orgao": "ONS", "dataset": cfg["titulo"], "recurso": recurso, "url_dataset": _url(k),
            "url_primaria": og.S3 + cfg["s3"] + "/", "licenca": c.LICENCA_ONS}


def _arquivos(con, ds, periodos=None):
    """Arquivos vigentes (vintages) do dataset, opcionalmente só dos períodos pedidos."""
    out = []
    for recurso, v in sorted(ckan.vintages_vigentes(con, ds).items()):
        per = og.periodo_do_arquivo(recurso + ".parquet")
        if periodos is not None and per not in periodos:
            continue
        out.append(ev.arquivo_de_vintage(v))
    return out


def _periodos_arquivo(meses):
    """Períodos de arquivo (AAAA-MM ou AAAA) que cobrem os meses pedidos."""
    return set(meses) | {m[:4] for m in meses}


def texto_recursos(recursos):
    """Recursos de vários arquivos para a citação, agrupados por conjunto: 'X_2025_09 a
    X_2026_08 (12 arquivos) e CAPACIDADE_GERACAO'."""
    import re
    grupos = defaultdict(list)
    for r_ in sorted({x for x in recursos if x}):
        grupos[re.sub(r"_\d{4}(_\d{2})?$", "", r_)].append(r_)
    partes = []
    for _, rs in sorted(grupos.items(), key=lambda x: -len(x[1])):
        partes.append(rs[0] if len(rs) == 1 else (" e ".join(rs) if len(rs) == 2 else f"{rs[0]} a {rs[-1]} ({len(rs)} arquivos)"))
    return " e ".join(partes)


def _evidencia(*, indicador, valor_exibido, valor, unidade, periodo, entidade, universo, fonte_k, arquivos, consulta,
               formula, cobertura, tratamento_ausencia, revisoes, testes, reconciliacao, download, filtros=(),
               numerador=None, denominador=None, exclusoes=(), pesos=None, chaves=()):
    cfg = CONJUNTOS[fonte_k]
    f = {"orgao": "ONS", "conjunto": cfg["titulo"], "recurso": None, "url": _url(fonte_k),
         "arquivo": None, "sha256": None, "capturado_em": None, "publicado_em": None}
    if len(arquivos) == 1:
        f.update({k: arquivos[0].get(k) for k in ("recurso", "arquivo", "sha256", "capturado_em", "publicado_em")})
    elif arquivos:
        f["arquivos"] = arquivos
    e = ev.construir(indicador=indicador, valor_exibido=valor_exibido, valor_calculo=valor, unidade=unidade,
                     periodo=periodo, entidade=entidade, universo=universo, filtros=list(filtros), fonte=f,
                     chaves_origem=list(chaves), consulta=consulta, formula=formula, numerador=numerador,
                     denominador=denominador, pesos=pesos, exclusoes=list(exclusoes), cobertura=cobertura,
                     tratamento_ausencia=tratamento_ausencia, revisoes=revisoes, testes=testes,
                     reconciliacao=reconciliacao, download=download, reproducao=REPRODUCAO, endereco=SITE)
    if len(arquivos) > 1:
        # número que usa vários arquivos: a citação nomeia os recursos de fonte.arquivos (o
        # campo único fonte.recurso fica nulo, porque não há um recurso só)
        texto_rec = texto_recursos([a.get("recurso") for a in arquivos])
        caps = [a.get("capturado_em") for a in arquivos if a.get("capturado_em")]
        e["citacao"] = ev.citacao(indicador=indicador, valor_exibido=e["valor_exibido"], unidade=unidade, entidade=entidade,
                                  periodo=e["periodo"], fonte={**f, "recurso": texto_rec, "capturado_em": max(caps) if caps else None},
                                  versao=e["versao"], endereco=SITE)
        problemas = ev.validar(e)
        if problemas:
            raise ev.EvidenciaInvalida(problemas)
    return e


def _quantis(xs):
    xs = sorted(x for x in xs if x is not None)
    if not xs:
        return None
    return {"n": len(xs), "min": c.r(xs[0], 2), "p10": c.r(c.quantil(xs, 0.1), 2), "p25": c.r(c.quantil(xs, 0.25), 2),
            "p50": c.r(c.quantil(xs, 0.5), 2), "p75": c.r(c.quantil(xs, 0.75), 2), "p90": c.r(c.quantil(xs, 0.9), 2),
            "max": c.r(xs[-1], 2)}


def _controle_item(nome, resultado, detalhe, critico=False):
    return {"nome": nome, "resultado": resultado, "detalhe": detalhe, "critico": critico}


# ---------------------------------------------------------------- dados da geração por usina

def carrega_usina(con):
    ds = _ds("usina")
    man = manifestos(con, ds)
    tudo = filtra_manifesto(vigentes(con, ds), man)
    D = defaultdict(dict)
    for (serie, ref), v in tudo.items():
        D[serie.split("|", 1)[0]][(serie, ref)] = v
    D["cadastro"] = base.registros_como_estavam_em(con, ds)
    D["historico_cadastro"] = historico_cadastro(con, ds)
    D["manifestos"] = man
    return D


def matriz_diaria(D):
    """{(dia, regiao, categoria): MWh}, {(dia, regiao, natureza): MWh}, {(rótulos): {ano: MWh}}
    e horas por (dia, regiao) a partir das séries diárias por rótulo da fonte."""
    cat_dia = defaultdict(float)
    nat_dia = defaultdict(float)
    rotulos = defaultdict(lambda: defaultdict(float))
    cache = {}
    for (serie, dia), mwh in D["d"].items():
        _, sm, ti, co, mo = serie.split("|", 4)
        k = (ti, co, mo)
        if k not in cache:
            cache[k] = (og.categoria(ti, co, mo), og.natureza_modalidade(mo))
        cat, nat = cache[k]
        for rg in (sm, "SIN"):
            cat_dia[(dia, rg, cat)] += mwh
            nat_dia[(dia, rg, nat)] += mwh
        rotulos[k][dia[:4]] += mwh
    horas = {}
    for (serie, dia), n in D["nh"].items():
        horas[(dia, serie.split("|")[1])] = n
    return cat_dia, nat_dia, rotulos, horas, cache


def dias_completos(horas):
    """Dias com 24 instantes horários distintos no SIN e em cada subsistema."""
    dias = sorted({d for d, rg in horas if rg == "SIN"})
    return [d for d in dias if horas.get((d, "SIN")) == 24 and all(horas.get((d, sm)) == 24 for sm in SM)]


def soma_presente(cat_dia, rg, cat, dias):
    """(MWh, dias com linha) de uma categoria numa região. Categoria sem nenhuma linha com
    valor nos dias pedidos é AUSENTE: devolve (None, 0), nunca zero (antes de 29/04/2023 não
    existe o grupo MMGD; antes de 03/2021, os grupos Tipo III térmicos)."""
    vals = [cat_dia[(d, rg, cat)] for d in dias if (d, rg, cat) in cat_dia]
    return (sum(vals) if vals else None), len(vals)


def mix(cat_dia, horas, rg, dias, mmgd_valida=True, nat_dia=None):
    """Composição de uma janela de dias completos numa região: MWmed por categoria
    (Σ MWh ÷ Σ horas) e participação no total com e sem MMGD. Categoria ausente no período
    fica nula (MWmed e participação); presente só em parte dos dias, entra com a energia dos
    dias em que existe e a contagem de dias sai em `dias_com_linha` (presença parcial)."""
    hs = sum(horas.get((d, rg), 0) for d in dias)
    if not dias or not hs:
        return None
    mwh, presenca = {}, {}
    for cat in CATS:
        mwh[cat], presenca[cat] = soma_presente(cat_dia, rg, cat, dias)
    tot = sum(v for v in mwh.values() if v is not None)
    tot_sem = tot - (mwh["solar_mmgd"] or 0.0)
    out = {
        "inicio": min(dias), "fim": max(dias), "dias": len(dias), "horas": hs,
        "mwmed": {cat: c.r(mwh[cat] / hs, 1) if mwh[cat] is not None else None for cat in CATS},
        "total_mwmed": c.r(tot / hs, 1), "total_sem_mmgd_mwmed": c.r(tot_sem / hs, 1),
        "participacao": {cat: c.r(100 * mwh[cat] / tot, 2) if tot and mwh[cat] is not None else None for cat in CATS},
        "participacao_sem_mmgd": {cat: (None if cat == "solar_mmgd" or mwh[cat] is None
                                        else (c.r(100 * mwh[cat] / tot_sem, 2) if tot_sem else None))
                                  for cat in CATS},
        "mmgd_no_periodo": mmgd_valida,
        # categorias com linha em só parte dos dias do período (ex.: MMGD na janela que cruza 29/04/2023)
        "dias_com_linha": {cat: presenca[cat] for cat in CATS if 0 < presenca[cat] < len(dias)},
        "_mwh": mwh, "_tot": tot, "_tot_sem": tot_sem,
    }
    if nat_dia is not None:
        nt = {nat: soma_presente(nat_dia, rg, nat, dias)[0] for nat in NATUREZAS}
        tn = sum(v for v in nt.values() if v is not None)
        # fração da energia do período por natureza do dado (verificada, previsão Tipo III,
        # estimativa MMGD); natureza sem linha no período fica nula
        out["natureza_pct"] = {nat: c.r(100 * nt[nat] / tn, 2) if tn and nt[nat] is not None else None for nat in NATUREZAS}
    return out


def _sem_privados(x):
    if isinstance(x, dict):
        return {k: _sem_privados(v) for k, v in x.items() if not k.startswith("_")}
    if isinstance(x, list):
        return [_sem_privados(v) for v in x]
    return x


def balanco_diario(con_p, dias):
    """Balanço de Energia nos Subsistemas (silver principal, só leitura): {(dia, fonte, sm):
    (MWh, horas)} somando as horas do dia."""
    out = defaultdict(lambda: [0.0, 0])
    if con_p is None:
        return {}
    ds = set(dias)
    for f in ("hidraulica", "termica", "eolica", "solar"):
        for sm in SM:
            for ref, v in base.serie_vigente(con_p, DS_BAL, f"{f}.{sm}"):
                if ref[:10] in ds:
                    x = out[(ref[:10], f, sm)]
                    x[0] += v
                    x[1] += 1
    return {k: tuple(v) for k, v in out.items()}


def usinas_por_grupo_balanco(D):
    out = defaultdict(float)
    for (serie, dia), mwh in D["d"].items():
        _, sm, ti, co, mo = serie.split("|", 4)
        g = og.grupo_balanco(ti)
        if g:
            out[(dia, g, sm)] += mwh
    return out


def roraima_termica(D):
    out = defaultdict(float)
    for (serie, dia), mwh in D["rr"].items():
        if og.grupo_balanco(serie.split("|", 1)[1]) == "termica":
            out[dia] += mwh
    return out


def reconcilia_balanco(bal, us, rr, dias):
    """Diferença diária Balanço − soma das usinas por subsistema e fonte, com a térmica do
    Norte decomposta em Roraima (o balanço exclui as térmicas de Roraima até a interligação)."""
    linhas = []
    for d in dias:
        for f in ("hidraulica", "termica", "eolica", "solar"):
            for sm in SM:
                b = bal.get((d, f, sm))
                if not b or b[1] != 24:
                    continue
                u = us.get((d, f, sm), 0.0)
                r_ = rr.get(d, 0.0) if (f == "termica" and sm == "N") else 0.0
                dif = b[0] - u
                # o balanço exclui Roraima no dia quando a diferença é exatamente a térmica de RR
                exclui_rr = r_ > TOL_DIA_MWH and abs(dif + r_) <= TOL_DIA_MWH
                linhas.append({"d": d, "f": f, "sm": sm, "bal": b[0], "us": u, "rr": r_, "dif": dif,
                               "dif_ajustada": dif + r_ if exclui_rr else dif, "exclui_rr": exclui_rr})
    return linhas


# ---------------------------------------------------------------- A11

def _trecho(texto, chave, janela=260):
    """Frase do texto oficial que contém `chave` (para citação literal), ou None."""
    if not texto:
        return None
    t = " ".join(texto.split())
    i = t.lower().find(chave.lower())
    if i < 0:
        return None
    ini = max(t.rfind(". ", 0, i) + 2, 0)
    fim = t.find(".", i)
    return t[ini:(fim + 1 if fim > 0 else min(len(t), i + janela))].strip()


def _mmgd_transicao(caminho=None):
    """MMGD mensal do SIN estimada pela API de carga verificada do ONS, como o módulo
    Transição publica (transicao_ons_mmgd_mensal.csv). Leitura do arquivo publicado; sem
    o arquivo, a comparação fica ausente."""
    caminho = caminho or os.path.join(base.SERIES, "transicao_ons_mmgd_mensal.csv")
    if not os.path.exists(caminho):
        return None
    out = {}
    with open(caminho, encoding="utf-8") as f:
        cab = f.readline().strip().split(";")
        for linha in f:
            x = dict(zip(cab, linha.rstrip("\n").split(";")))
            if x.get("submercado") == "SIN" and x.get("mmgd_mwmed"):
                try:
                    out[x["mes"]] = float(x["mmgd_mwmed"])
                except ValueError:
                    continue
    return out


def bloco_a11(con, D, cat_dia, horas, rec, dias_ok, mmgd_api):
    dic = base.registros_como_estavam_em(con, DS_DIC)
    notas_carga = (dic.get("pacote_carga-energia") or {}).get("notas")
    notas_usina = (dic.get("pacote_geracao-usina-2") or {}).get("notas")
    notas_bal = (dic.get("pacote_balanco-energia-subsistema") or {}).get("notas")
    leitura_bal = json.loads((dic.get("balanco-energia-subsistema") or {}).get("leitura") or "null") or {}
    leitura_usina = json.loads((dic.get("geracao-usina-2") or {}).get("leitura") or "null") or {}
    h_mmgd = sorted(ref for (s, ref) in D["h"] if s == "h|solar_mmgd")
    dias_mmgd = sorted({dia for (s, dia), v in D["d"].items() if og.norm(s.split("|", 4)[4]) == og.MOD_MMGD})
    primeiro_dia = dias_mmgd[0] if dias_mmgd else None
    # solar dia a dia: balanço × soma das usinas FOTOVOLTAICA (com e sem o grupo MMGD)
    sol = {}
    for x in rec:
        if x["f"] == "solar":
            a = sol.setdefault(x["d"], {"bal": 0.0, "us": 0.0, "n": 0, "ok": 0})
            a["bal"] += x["bal"]
            a["us"] += x["us"]
            a["n"] += 1
            a["ok"] += abs(x["dif"]) <= TOL_DIA_MWH
    tabela = []
    if primeiro_dia:
        p = c.d(primeiro_dia)
        for i in range(-7, 8):
            d = (p + timedelta(days=i)).isoformat()
            s_ = sol.get(d)
            # antes da quebra não há linha da modalidade MMGD: ausência (nula), não zero
            tem_mm = (d, "SIN", "solar_mmgd") in cat_dia
            mm = cat_dia.get((d, "SIN", "solar_mmgd"), 0.0)
            cent = cat_dia.get((d, "SIN", "solar_centralizada"), 0.0)
            h = horas.get((d, "SIN")) or None
            tabela.append({"d": d, "balanco_solar_mwmed": c.r(s_["bal"] / 24, 1) if s_ and s_["n"] == 4 else None,
                           "usinas_solar_mwmed": c.r((mm + cent) / h, 1) if h else None,
                           "usinas_mmgd_mwmed": c.r(mm / h, 1) if h and tem_mm else None,
                           "usinas_sem_mmgd_mwmed": c.r(cent / h, 1) if h else None,
                           "diferenca_mwh": c.r(s_["bal"] - (mm + cent), 3) if s_ and s_["n"] == 4 else None})
    dias_sol = [d for d in sorted(sol) if sol[d]["n"] == 4]
    # conciliação no SIN (soma dos quatro subsistemas): diferenças de alocação entre
    # subsistemas não mudam a solar do SIN
    conciliados = sum(1 for d in dias_sol if abs(sol[d]["bal"] - sol[d]["us"]) <= TOL_DIA_MWH)
    janela_quebra = [t for t in tabela if t["diferenca_mwh"] is not None]
    quebra_ok = bool(janela_quebra) and all(abs(t["diferenca_mwh"]) <= TOL_DIA_MWH for t in janela_quebra)
    antes = next((t for t in tabela if t["d"] == (c.d(primeiro_dia) - timedelta(days=1)).isoformat()), None) if primeiro_dia else None
    depois = next((t for t in tabela if t["d"] == primeiro_dia), None) if primeiro_dia else None
    # MMGD da Geração por Usina × MMGD da API de carga verificada (módulo Transição)
    comparacao = []
    if mmgd_api is not None:
        por_mes = defaultdict(lambda: [0.0, 0])
        for d in dias_ok:
            if d >= (primeiro_dia or "9999"):
                por_mes[d[:7]][0] += cat_dia.get((d, "SIN", "solar_mmgd"), 0.0)
                por_mes[d[:7]][1] += 24
        for mes in sorted(por_mes):
            mwh, hs = por_mes[mes]
            if og.dias_do_mes(mes) * 24 != hs:
                continue  # mês incompleto em dias completos: comparação só de meses inteiros
            api = mmgd_api.get(mes)
            u = mwh / hs
            comparacao.append({"mes": mes, "usina_mwmed": c.r(u, 1), "api_mwmed": c.r(api, 1),
                               "razao_usina_api": c.r(u / api, 3) if api else None})
    razoes = [x["razao_usina_api"] for x in comparacao if x["razao_usina_api"] is not None]
    trecho_carga = _trecho(notas_carga, "29/04/2023")
    trecho_usina = _trecho(notas_usina, "previsões de geração")
    evid_doc = [
        {"orgao": "ONS", "documento": "Descrição do conjunto Carga de Energia (portal de dados abertos)",
         "url": ckan.url_dataset("ONS", "carga-energia"), "trecho": trecho_carga,
         "capturado_em": _captura_dic(con, "pacote_carga-energia")},
        {"orgao": "ONS", "documento": "Descrição do conjunto Geração por Usina em Base Horária (portal de dados abertos)",
         "url": ckan.url_dataset("ONS", "geracao-usina-2"), "trecho": trecho_usina,
         "capturado_em": _captura_dic(con, "pacote_geracao-usina-2")},
        {"orgao": "ONS", "documento": "Dicionário de dados da Geração por Usina em Base Horária (PDF)",
         "url": (dic.get("geracao-usina-2") or {}).get("url"),
         "trecho": _trecho(leitura_usina.get("texto"), "previsões de geração"),
         "versao": (leitura_usina.get("versoes") or [{}])[-1].get("versao"), "data_documento": leitura_usina.get("data_documento"),
         "capturado_em": _captura_dic(con, "geracao-usina-2")},
        {"orgao": "ONS", "documento": "Dicionário de dados e descrição do Balanço de Energia nos Subsistemas",
         "url": (dic.get("balanco-energia-subsistema") or {}).get("url"),
         "trecho": _trecho(notas_bal, "A oferta é representada"),
         "versao": (leitura_bal.get("versoes") or [{}])[-1].get("versao"), "data_documento": leitura_bal.get("data_documento"),
         "capturado_em": _captura_dic(con, "balanco-energia-subsistema")},
    ]
    # constatação da plataforma (não é citação): o que os textos oficiais dizem ou não dizem
    for e in evid_doc:
        e.setdefault("versao", None)
        e.setdefault("data_documento", None)
    evid_doc[3]["constatacao"] = (
        "Nem o dicionário nem a descrição do conjunto mencionam a MMGD." if leitura_bal and not leitura_bal.get("menciona_mmgd")
        and notas_bal and "MMGD" not in notas_bal.upper() else None)
    for e in evid_doc[:3]:
        e["constatacao"] = None
    # Confirmação: modalidade MMGD começa em 29/04/2023, a documentação oficial declara a
    # inclusão e a natureza de previsão, e a solar do balanço fecha com a soma das usinas
    # em todos os dias da janela de 7 dias antes a 7 dias depois da quebra
    confirmado = bool(primeiro_dia == INICIO_MMGD and trecho_carga and trecho_usina and quebra_ok)
    conclusao = None
    if primeiro_dia:
        conclusao = (
            f"Confirmado na fonte primária. No conjunto Geração por Usina do ONS, a modalidade \"Pequenas Usinas (MMGD)\" "
            f"(usinas fotovoltaicas com identificador PQU_<UF>_GD) aparece pela primeira vez em {c.data_br(primeiro_dia)}, "
            f"na hora {(h_mmgd[0][11:16] if h_mmgd else 'sem registro')}. A solar do Balanço de Energia é igual à soma das usinas "
            f"fotovoltaicas desse conjunto, incluindo a MMGD, em todos os {len(janela_quebra)} dias de {c.data_br(janela_quebra[0]['d'])} a "
            f"{c.data_br(janela_quebra[-1]['d'])} e em {conciliados} de {len(dias_sol)} dias desde {c.data_br(dias_sol[0]) if dias_sol else 'sem dado'} "
            f"(tolerância de {_n(TOL_DIA_MWH)} MWh por dia no SIN; as divergências fora da janela estão na reconciliação com o balanço). "
            + (f"De {c.data_br(antes['d'])} para {c.data_br(depois['d'])}, a solar das usinas sem MMGD vai de "
               f"{_n(antes['usinas_sem_mmgd_mwmed'])} para {_n(depois['usinas_sem_mmgd_mwmed'])} MWmed e a MMGD entra com "
               f"{_n(depois['usinas_mmgd_mwmed'])} MWmed. " if antes and depois and antes["usinas_sem_mmgd_mwmed"] is not None else "")
            + "A descrição do conjunto Carga de Energia declara a inclusão do valor estimado da MMGD a partir de 29/04/2023, "
              "e a da Geração por Usina declara que os grupos de pequenas usinas são previsões de geração. O dicionário do "
              "Balanço não trata do tema; a equivalência com a soma das usinas é o que liga a quebra do balanço à MMGD.")
    return {
        "estado": "confirmado" if confirmado else "pendente",
        "conclusao": conclusao,
        "primeiro_dia_mmgd": primeiro_dia,
        "primeira_hora_mmgd": h_mmgd[0] if h_mmgd else None,
        "dias_conferidos": len(dias_sol), "dias_conciliados": conciliados, "janela_da_quebra_conciliada": quebra_ok,
        "evidencias_documentais": evid_doc,
        "tabela": tabela,
        "comparacao_api_transicao": comparacao,
        "razao_usina_api": _quantis(razoes),
        "tratamento": [
            "A MMGD é a categoria \"Solar MMGD (estimativa do ONS)\", separada da solar centralizada, com natureza estimada.",
            "Participações são publicadas em dois perímetros: com MMGD (total da Geração por Usina, igual ao do Balanço) e sem MMGD.",
            f"Comparações que atravessam {c.data_br(INICIO_MMGD)} usam o perímetro sem MMGD; a MMGD só é comparada com ela mesma, a partir dessa data.",
            "A MMGD da Geração por Usina e a da API de carga verificada (publicada pelo módulo Transição) são estimativas de processos diferentes do ONS; a razão entre elas é publicada, sem tratar uma como medição da outra.",
            "A capacidade da MMGD (cadastro da ANEEL, módulo Transição) não entra no fator de capacidade: a capacidade do ONS só cobre usinas despachadas e a geração estimada da MMGD fica fora do numerador.",
        ],
    }


def _captura_dic(con, recurso):
    v = base.ultima_vintage(con, DS_DIC, recurso)
    return v["capturado_em"] if v else None


# ---------------------------------------------------------------- P021 matriz efetiva

# Regras de universo (identificadores com dado por categoria e mês), publicadas em
# matriz.universo.regra e usadas nas ressalvas de cada janela, mês e ano.
SALTO_MIN_ANTES = 5          # salto só com ao menos 5 identificadores no mês anterior
SALTO_VARIACAO = 0.25        # variação de 25% ou mais entre meses seguidos
REDUZIDO_FRACAO = 0.75       # universo reduzido: até 75% do maior número dos 12 meses anteriores
ZERO_MESES_ROTULO = 3        # rótulo com todas as horas exatamente zero por 3 meses seguidos
ZERO_MESES_ID = 6            # identificador com todas as horas exatamente zero por 6 meses seguidos


def _meses_antes(mes, n):
    out, a, b = [], int(mes[:4]), int(mes[5:7])
    for _ in range(n):
        a, b = (a - 1, 12) if b == 1 else (a, b - 1)
        out.append(f"{a}-{b:02d}")
    return out


def universo_identificadores(D, meses):
    """Identificadores (id_ons) da Geração por Usina por categoria, região e mês, na
    categoria do último rótulo publicado. Grupos de pequenas usinas e MMGD ficam fora (são
    previsões por UF, não usinas). Três estados por mês:
    - com valor: ao menos uma hora com valor (zero publicado conta como valor);
    - sem valor: linhas na fonte, todas vazias;
    - sem linhas: o identificador teve valor em algum dos 12 meses anteriores e não tem
      nenhuma linha no mês (deixou de constar do arquivo)."""
    cad = D["cadastro"]
    meses_set = set(meses)
    linhas, valor, mwh = defaultdict(set), defaultdict(set), {}
    for (serie, mes), n_ in D["un"].items():
        ido = serie[3:]
        if mes not in meses_set or ido == "sem_id_ons" or og.natureza_modalidade(cad.get(ido, {}).get("mod")) != "verificada":
            continue
        linhas[ido].add(mes)
        if n_:
            valor[ido].add(mes)
    for (serie, mes), v in D["u"].items():
        mwh[(serie[2:], mes)] = v
    uni, vazios, saidas = defaultdict(set), defaultdict(set), defaultdict(set)
    cat_id = {}
    for ido in set(linhas) | set(valor):
        r_ = cad.get(ido, {})
        cat = og.categoria(r_.get("tipo"), r_.get("comb"), r_.get("mod"))
        cat_id[ido] = cat
        rgs = ("SIN", (r_.get("sm") or "").upper())
        for mes in meses:
            if mes in valor[ido]:
                alvo = uni
            elif mes in linhas[ido]:
                alvo = vazios
            elif any(m in valor[ido] for m in _meses_antes(mes, 12)):
                alvo = saidas
            else:
                continue
            for rg in rgs:
                alvo[(mes, cat, rg)].add(ido)
    return {"uni": uni, "vazios": vazios, "saidas": saidas, "cat_id": cat_id, "mwh": mwh, "valor": valor, "linhas": linhas}


def contagem(sets, meses, rg="SIN"):
    """{"meses": [...], categoria: [n por mês]} só das categorias que aparecem."""
    return {"meses": meses, **{cat: [len(sets.get((m, cat, rg), ())) for m in meses] for cat in CATS
                                if any((m, cat, rg) in sets for m in meses)}}


def saltos_universo(U, meses, rg="SIN"):
    """Saltos de universo: variação de 25% ou mais, com ao menos 5 identificadores com valor
    no mês anterior, entre meses seguidos."""
    out = []
    for cat in CATS:
        xs = [len(U["uni"].get((m, cat, rg), ())) for m in meses]
        for i in range(1, len(xs)):
            antes, depois = xs[i - 1], xs[i]
            if antes >= SALTO_MIN_ANTES and abs(depois - antes) / antes >= SALTO_VARIACAO:
                out.append({"mes": meses[i], "categoria": cat, "identificadores_antes": antes, "identificadores_depois": depois})
    return out


def ressalvas_universo(U, meses, saltos_rg, ini, fim, rg="SIN", mensal=False):
    """Categorias cuja participação no período não é comparável por mudança do universo da
    fonte, com o motivo:
    - salto_no_periodo: salto de universo com data dentro do período (num mês da série
      mensal, salto em relação ao mês anterior);
    - universo_reduzido: identificadores com valor no último mês do período até 75% do maior
      número dos 12 meses anteriores ao início do período (ao menos 5 nessa referência).
    A participação continua publicada; a ressalva vai junto dela."""
    meses_set = set(meses)
    m_ini, m_fim = ini[:7], fim[:7]
    ref_meses = [m for m in _meses_antes(m_ini, 12) if m in meses_set]
    out = {}
    for cat in CATS:
        n_fim = len(U["uni"].get((m_fim, cat, rg), ()))
        nmax = max((len(U["uni"].get((m, cat, rg), ())) for m in ref_meses), default=0)
        if mensal:
            datas = [f"{x['mes']}-01" for x in saltos_rg if x["categoria"] == cat and x["mes"] == m_ini]
        else:
            datas = [f"{x['mes']}-01" for x in saltos_rg if x["categoria"] == cat and ini < f"{x['mes']}-01" <= fim]
        motivos = (["salto_no_periodo"] if datas else []) + \
                  (["universo_reduzido"] if nmax >= SALTO_MIN_ANTES and n_fim <= REDUZIDO_FRACAO * nmax else [])
        if motivos:
            out[cat] = {"motivos": motivos, "identificadores_com_valor_no_ultimo_mes": n_fim,
                        "maior_numero_12_meses_antes": nmax, "saltos": datas}
    return out


def rotulos_por_mes(D):
    """Por rótulo (tipo, combustível, modalidade): meses com linhas (manifesto do arquivo
    mensal; no arquivo anual de 2021, os meses com valor), meses com valor e energia mensal."""
    linhas, valor, mwh = defaultdict(set), defaultdict(set), defaultdict(float)
    for (serie, dia), v in D["d"].items():
        _, sm, ti, co, mo = serie.split("|", 4)
        valor[(ti, co, mo)].add(dia[:7])
        linhas[(ti, co, mo)].add(dia[:7])
        mwh[((ti, co, mo), dia[:7])] += v
    for per, series in (D.get("manifestos") or {}).items():
        if len(per) != 7:
            continue
        for s in series:
            if s.startswith("d|"):
                _, sm, ti, co, mo = s.split("|", 4)
                linhas[(ti, co, mo)].add(per)
    return linhas, valor, mwh


def sequencias_zero_rotulo(valor, mwh, cache, U=None, cad=None):
    """Rótulos cujas horas com valor são todas exatamente zero por ZERO_MESES_ROTULO meses
    seguidos ou mais, logo depois de um mês com ao menos 1 MWh (seção 11.7: sequência longa
    repetida). Pode ser parada real ou falha da fonte; a fonte não distingue. Com `U`, conta
    os identificadores do rótulo que tinham valor no mês anterior e não têm linha no primeiro
    mês da sequência: zero que aparece porque as usinas que produziam saíram do arquivo."""
    rot_id = defaultdict(set)
    if U is not None:
        for ido in U["cat_id"]:
            r_ = (cad or {}).get(ido, {})
            rot_id[(r_.get("tipo") or "", r_.get("comb") or "", r_.get("mod") or "")].add(ido)
    out = []
    for k_, ms in valor.items():
        ms = sorted(ms)
        i = 0
        while i < len(ms):
            if abs(mwh[(k_, ms[i])]) > 1e-9:
                i += 1
                continue
            j = i
            while j + 1 < len(ms) and ms[j + 1] == _mes_seguinte(ms[j]) and abs(mwh[(k_, ms[j + 1])]) <= 1e-9:
                j += 1
            n = j - i + 1
            ant = _meses_antes(ms[i], 1)[0]
            if n >= ZERO_MESES_ROTULO and mwh.get((k_, ant), 0.0) >= 1.0:
                sairam = sorted(i_ for i_ in rot_id.get(k_, ()) if ant in U["valor"].get(i_, ()) and ms[i] not in U["linhas"].get(i_, ()))
                out.append({"tipo": k_[0], "combustivel": k_[1], "modalidade": k_[2] or None, "categoria": cache[k_][0],
                            "inicio": ms[i], "fim": ms[j], "meses": n, "mes_anterior": ant,
                            "mwh_mes_anterior": c.r(mwh[(k_, ant)], 1), "ultimo_mes_com_valor": ms[-1],
                            "identificadores_que_sairam": len(sairam),
                            "mwh_mes_anterior_dos_que_sairam": c.r(sum(U["mwh"].get((i_, ant), 0.0) for i_ in sairam), 1) if sairam else None})
            i = j + 1
    return sorted(out, key=lambda x: (x["inicio"], x["tipo"], x["combustivel"]))


def sequencias_zero_identificadores(U, meses, cad):
    """Identificadores com todas as horas com valor exatamente zero por ZERO_MESES_ID meses
    seguidos ou mais depois de um mês com geração positiva. Térmicas sem despacho e usinas
    paradas produzem isso de verdade; a lista é controle (seção 11.7), não exclusão."""
    out = []
    for ido, ms_valor in U["valor"].items():
        seq = []
        for m in meses:
            v = U["mwh"].get((ido, m)) if m in ms_valor else None
            seq.append(v)
        i = 0
        while i < len(seq):
            if seq[i] is None or abs(seq[i]) > 1e-9:
                i += 1
                continue
            j = i
            while j + 1 < len(seq) and seq[j + 1] is not None and abs(seq[j + 1]) <= 1e-9:
                j += 1
            n = j - i + 1
            if n >= ZERO_MESES_ID and i > 0 and seq[i - 1] and seq[i - 1] > 0:
                r_ = cad.get(ido, {})
                out.append({"id": ido, "nome": r_.get("nome"), "categoria": U["cat_id"].get(ido), "modalidade": r_.get("mod"),
                            "inicio": meses[i], "fim": meses[j], "meses": n, "mwh_mes_anterior": c.r(seq[i - 1], 1),
                            "continua": j == len(seq) - 1 or seq[j + 1] is None})
            i = j + 1
    return sorted(out, key=lambda x: (-x["meses"], x["id"]))


def outros_por_ceg(D, U, meses12):
    """Decomposição da categoria 'outros' (rótulos 'Resíduos Industriais' e 'Multi-Combustível
    Gás/Diesel' do ONS) pelo código de combustível do CEG de cada identificador, nos 12 meses
    completos: mostra quanto é gás de siderurgia (CM), licor negro de celulose (FL, biomassa
    florestal na ANEEL), petróleo (PE) e conjuntos sem CEG."""
    cad = D["cadastro"]
    agg = defaultdict(lambda: {"mwh": 0.0, "ids": set(), "nomes": Counter()})
    horas = sum(og.dias_do_mes(m) * 24 for m in meses12)
    for ido, cat in U["cat_id"].items():
        if cat != "outros":
            continue
        cod = og.codigo_combustivel_ceg(cad.get(ido, {}).get("ceg")) or "sem_ceg"
        v = sum(U["mwh"].get((ido, m), 0.0) for m in meses12 if m in U["valor"].get(ido, ()))
        if not v:
            continue
        a = agg[cod]
        a["mwh"] += v
        a["ids"].add(ido)
        a["nomes"][cad.get(ido, {}).get("nome") or ido] += v
    tot = sum(a["mwh"] for a in agg.values())
    out = []
    for cod, a in sorted(agg.items(), key=lambda x: -x[1]["mwh"]):
        out.append({"codigo_ceg": None if cod == "sem_ceg" else cod,
                    "fonte_aneel": og.CEG_FONTE_ANEEL.get(cod, "Conjunto de usinas sem CEG próprio" if cod == "sem_ceg" else "código não tabelado"),
                    "mwh": c.r(a["mwh"], 1), "mwmed": c.r(a["mwh"] / horas, 1) if horas else None,
                    "pct_da_categoria": c.r(100 * a["mwh"] / tot, 2) if tot else None, "identificadores": len(a["ids"]),
                    "maiores": [n for n, _ in a["nomes"].most_common(6)]})
    return {"inicio": meses12[0], "fim": meses12[-1], "itens": out,
            "regra": ("Identificadores da categoria 'outros' (Geração por Usina, natureza verificada) somados pelo código de combustível "
                      "do CEG (segundo campo: CM, FL, PE...); a fonte da ANEEL de cada código foi conferida no SIGA. A categoria "
                      "publicada continua a do ONS; a decomposição só mostra o que ela reúne.")} if meses12 else None


def bloco_matriz(con, D, cat_dia, nat_dia, rotulos, horas, cache, rec, ok, hoje):
    dia_ref = ok[-1]
    fim = c.d(dia_ref)
    oks = set(ok)
    primeiro_mes, ultimo_mes = ok[0][:7], dia_ref[:7]
    meses = _meses_entre(primeiro_mes, ultimo_mes)
    cad = D["cadastro"]
    # universo da fonte primeiro: as ressalvas das janelas dependem dele
    U = universo_identificadores(D, meses)
    saltos_rg = {rg: saltos_universo(U, meses, rg) for rg in REGIOES}
    saltos = saltos_rg["SIN"]

    def janela(n, fim_=None):
        f_ = fim_ or fim
        return [x for x in ((f_ - timedelta(days=i)).isoformat() for i in range(n)) if x in oks]

    janelas = {}
    for rg in REGIOES:
        janelas[rg] = {}
        for nome, n in (("dia", 1), ("7d", 7), ("30d", 30), ("12m", 365)):
            if rg != "SIN" and nome in ("dia", "7d"):
                continue  # recortes curtos só no SIN (os subsistemas estão no CSV diário)
            ks = janela(n)
            m = mix(cat_dia, horas, rg, ks, mmgd_valida=min(ks) >= INICIO_MMGD if ks else False, nat_dia=nat_dia)
            if m:
                m["dias_no_periodo"] = n
                m["ressalvas_universo"] = ressalvas_universo(U, meses, saltos_rg[rg], m["inicio"], m["fim"], rg)
            janelas[rg][nome] = m
    # 12 meses anteriores (365 dias), mesmo perímetro
    ant = janela(365, fim - timedelta(days=365))
    m_ant = mix(cat_dia, horas, "SIN", ant, mmgd_valida=bool(ant) and min(ant) >= INICIO_MMGD)
    m_at = janelas["SIN"]["12m"]
    comparacao_12m = None
    if m_ant and m_at:
        def var(cat):
            a_, b_ = m_at["_mwh"][cat], m_ant["_mwh"][cat]
            if a_ is None or b_ is None or b_ <= 0 or (cat == "solar_mmgd" and not m_ant["mmgd_no_periodo"]):
                return None  # categoria ausente ou sem base em um dos períodos
            return c.r(100 * (a_ / m_at["horas"]) / (b_ / m_ant["horas"]) - 100, 1)
        comparacao_12m = {"atual": {"inicio": m_at["inicio"], "fim": m_at["fim"], "dias": m_at["dias"]},
                          "anterior": {"inicio": m_ant["inicio"], "fim": m_ant["fim"], "dias": m_ant["dias"]},
                          "mesmo_regime_mmgd": m_at["mmgd_no_periodo"] and m_ant["mmgd_no_periodo"],
                          "variacao_pct": {cat: var(cat) for cat in CATS},
                          "variacao_total_sem_mmgd_pct": c.r(100 * (m_at["_tot_sem"] / m_at["horas"]) / (m_ant["_tot_sem"] / m_ant["horas"]) - 100, 1),
                          "anterior_mwmed": {cat: c.r(m_ant["_mwh"][cat] / m_ant["horas"], 1) if m_ant["_mwh"][cat] is not None else None
                                             for cat in CATS},
                          # médias sem arredondar, só para o total das categorias comparáveis (campos privados não vão à gold)
                          "_mwmed_atual": {cat: m_at["_mwh"][cat] / m_at["horas"] if m_at["_mwh"][cat] is not None else None for cat in CATS},
                          "_mwmed_anterior": {cat: m_ant["_mwh"][cat] / m_ant["horas"] if m_ant["_mwh"][cat] is not None else None for cat in CATS}}
    # série mensal do SIN (só dias completos). Categoria sem linha no mês é nula (ausência,
    # nunca zero); com linha em parte dos dias, a contagem sai em dias_com_linha
    por_mes = defaultdict(list)
    for d in ok:
        por_mes[d[:7]].append(d)
    mensal = {"meses": meses, "dias_completos": [], "dias_no_mes": [], "parcial": [], "total_mwmed": [],
              "total_sem_mmgd_mwmed": [], **{cat: [] for cat in CATS}}
    presenca_mes = {cat: [] for cat in CATS}
    natureza_mensal = {"meses": meses, **{nat: [] for nat in NATUREZAS}}
    ress_mes = defaultdict(list)
    for mes in meses:
        ds_ = por_mes.get(mes, [])
        hs = 24 * len(ds_)
        mensal["dias_completos"].append(len(ds_))
        mensal["dias_no_mes"].append(og.dias_do_mes(mes))
        mensal["parcial"].append(len(ds_) < og.dias_do_mes(mes))
        tot = 0.0
        mm = None
        for cat in CATS:
            v, n_ = soma_presente(cat_dia, "SIN", cat, ds_)
            presenca_mes[cat].append(n_)
            if v is not None:
                tot += v
            if cat == "solar_mmgd":
                mm = v
            mensal[cat].append(c.r(v / hs, 1) if hs and v is not None else None)
        mensal["total_mwmed"].append(c.r(tot / hs, 1) if hs else None)
        mensal["total_sem_mmgd_mwmed"].append(c.r((tot - (mm or 0.0)) / hs, 1) if hs else None)
        nt = {nat: soma_presente(nat_dia, "SIN", nat, ds_)[0] for nat in NATUREZAS}
        tn = sum(v for v in nt.values() if v is not None)
        for nat in NATUREZAS:
            natureza_mensal[nat].append(c.r(100 * nt[nat] / tn, 2) if tn and nt[nat] is not None else None)
        if ds_:
            for cat in ressalvas_universo(U, meses, saltos, f"{mes}-01", ds_[-1], "SIN", mensal=True):
                ress_mes[cat].append(mes)
    # só os meses com presença parcial: {categoria: {mês: dias com linha}}
    mensal["dias_com_linha"] = {cat: {m: n_ for m, n_, d_ in zip(meses, xs, mensal["dias_completos"]) if 0 < n_ < d_}
                                for cat, xs in presenca_mes.items() if any(0 < n_ < d_ for n_, d_ in zip(xs, mensal["dias_completos"]))}
    mensal["ressalvas_universo"] = dict(ress_mes)
    # anos civis, perímetro sem MMGD e a MMGD à parte
    anual = []
    for ano in sorted({d[:4] for d in ok}):
        ds_ = [d for d in ok if d[:4] == ano]
        m = mix(cat_dia, horas, "SIN", ds_, mmgd_valida=min(ds_) >= INICIO_MMGD, nat_dia=nat_dia)
        dias_ano = 366 if int(ano) % 4 == 0 else 365
        anual.append({"ano": int(ano), "dias": len(ds_), "parcial": len(ds_) < dias_ano,
                      "mwmed": m["mwmed"], "total_sem_mmgd_mwmed": m["total_sem_mmgd_mwmed"],
                      "participacao_sem_mmgd": m["participacao_sem_mmgd"], "natureza_pct": m["natureza_pct"],
                      "dias_com_linha": m["dias_com_linha"],
                      "ressalvas_universo": ressalvas_universo(U, meses, saltos, ds_[0], ds_[-1], "SIN"),
                      "mmgd_dias": sum(1 for d in ds_ if d >= INICIO_MMGD)})
    # diário recente (60 dias) e horário dos últimos 3 dias, SIN; categoria sem linha no dia ou
    # na hora fica nula (ausência); zero publicado pela fonte fica zero
    recentes = [d for d in ok if d > (fim - timedelta(days=60)).isoformat()]
    presentes = [cat for cat in CATS if any((d, "SIN", cat) in cat_dia for d in recentes)]
    diario = {"dias": recentes, "categorias": presentes,
              **{cat: [c.r(cat_dia[(d, "SIN", cat)] / 24, 1) if (d, "SIN", cat) in cat_dia else None for d in recentes]
                 for cat in presentes}}
    ult = [d for d in ok if d > (fim - timedelta(days=3)).isoformat()]
    horas_rec = [f"{d}T{h:02d}:00" for d in ult for h in range(24)]
    pres_h = [cat for cat in CATS if any((f"h|{cat}", h) in D["h"] for h in horas_rec)]
    horario = {"horas": horas_rec, "categorias": pres_h, **{cat: [c.r(D["h"].get((f"h|{cat}", h)), 1) for h in horas_rec] for cat in pres_h}}
    # rótulos da fonte → categoria (auditoria e categorias desconhecidas explícitas)
    ini12 = (fim - timedelta(days=364)).isoformat()
    rot12 = defaultdict(float)
    for (serie, dia), mwh in D["d"].items():
        if ini12 <= dia <= dia_ref:
            _, sm, ti, co, mo = serie.split("|", 4)
            rot12[(ti, co, mo)] += mwh
    tab_rot = []
    for (ti, co, mo), anos in sorted(rotulos.items(), key=lambda x: -sum(x[1].values())):
        cat, nat = cache[(ti, co, mo)]
        tab_rot.append({"tipo": ti, "combustivel": co, "modalidade": mo or None, "categoria": cat, "natureza": nat,
                        "mwh_12m": c.r(rot12.get((ti, co, mo)), 1), "mwh_desde_inicio": c.r(sum(anos.values()), 1)})
    nao_map = [r_ for r_ in tab_rot if r_["categoria"] == "nao_mapeada"]
    # mudanças de rótulo na fonte: aparece (primeiro mês com geração positiva), deixa de ter
    # valor (as linhas continuam, vazias) e deixa de ter linhas (some do arquivo)
    rot_linhas, rot_valor, rot_mwh = rotulos_por_mes(D)
    mudancas = []
    prim_pos = {}
    for (k_, m), v in rot_mwh.items():
        if v > 0 and (k_ not in prim_pos or m < prim_pos[k_]):
            prim_pos[k_] = m
    for k_ in sorted(rot_linhas, key=lambda x: (prim_pos.get(x) or min(rot_linhas[x]), x)):
        if k_ not in cache:
            continue
        a_ = prim_pos.get(k_) or min(rot_linhas[k_])
        ult_l = max(rot_linhas[k_])
        ult_v = max(rot_valor[k_]) if rot_valor.get(k_) else None
        sem_valor_desde = _mes_seguinte(ult_v) if ult_v and ult_v < ult_l else None
        if a_ > primeiro_mes or ult_l < ultimo_mes or sem_valor_desde:
            mudancas.append({"tipo": k_[0], "combustivel": k_[1], "modalidade": k_[2] or None, "categoria": cache[k_][0],
                             "natureza": cache[k_][1], "aparece_em": a_ if a_ > primeiro_mes else None,
                             "ultimo_mes_com_linhas": ult_l if ult_l < ultimo_mes else None,
                             "ultimo_mes_com_valor": ult_v if sem_valor_desde else None})
    zeros_rotulo = sequencias_zero_rotulo(rot_valor, rot_mwh, cache, U, cad)
    zeros_id = sequencias_zero_identificadores(U, meses, cad)
    universo = contagem(U["uni"], meses)
    sem_valor = contagem(U["vazios"], meses)
    sem_linhas = contagem(U["saidas"], meses)
    # lacuna do último mês completo: identificadores com linhas e sem nenhuma hora com valor e
    # identificadores que tiveram valor nos 12 meses anteriores e não têm linha no mês. Não
    # se estima o que falta: a geração publicada pelos mesmos identificadores no mesmo mês do
    # ano anterior é referência observada, publicada à parte e nunca somada aos totais
    meses_ok = [m for m in meses if sum(1 for d in ok if d[:7] == m) == og.dias_do_mes(m)]
    lacuna = None
    if meses_ok:
        mref = meses_ok[-1]
        m_ano = _meses_antes(mref, 12)[-1]
        ids_v = sorted({i for (m, cat, rg), ids in U["vazios"].items() if m == mref and rg == "SIN" for i in ids})
        ids_s = sorted({i for (m, cat, rg), ids in U["saidas"].items() if m == mref and rg == "SIN" for i in ids})
        por_cat = {}
        for cat in CATS:
            v_ = [i for i in ids_v if U["cat_id"].get(i) == cat]
            s_ = [i for i in ids_s if U["cat_id"].get(i) == cat]
            if not v_ and not s_:
                continue
            ref = sum(U["mwh"].get((i, m_ano), 0.0) for i in v_ + s_ if m_ano in U["valor"].get(i, ()))
            por_cat[cat] = {"sem_valor": len(v_), "sem_linhas": len(s_),
                            "com_valor_no_mes": len(U["uni"].get((mref, cat, "SIN"), ())),
                            "com_valor_mesmo_mes_ano_anterior": len(U["uni"].get((m_ano, cat, "SIN"), ())),
                            "mwh_dos_ausentes_mesmo_mes_ano_anterior": c.r(ref, 1)}
        lacuna = {"mes": mref, "mes_ano_anterior": m_ano, "identificadores_sem_valor": len(ids_v),
                  "identificadores_sem_linhas": len(ids_s),
                  "por_categoria": {cat: x["sem_valor"] for cat, x in por_cat.items() if x["sem_valor"]},
                  "detalhe_por_categoria": por_cat,
                  "exemplos": [cad.get(i, {}).get("nome") or i for i in ids_v[:15]],
                  "exemplos_sem_linhas": [cad.get(i, {}).get("nome") or i for i in ids_s[:15]],
                  "nota": ("mwh_dos_ausentes_mesmo_mes_ano_anterior é a geração que a própria fonte publicou para os mesmos "
                           "identificadores um ano antes: ordem de grandeza do que deixou de constar, não estimativa nem correção.")}
    rels_u = relatorios(con, _ds("usina"))
    sem_id = {og.periodo_do_arquivo(r_ + ".parquet"): x.get("sem_id_ons") for r_, x in rels_u.items() if x and x.get("sem_id_ons")}
    outros = outros_por_ceg(D, U, meses_ok[-12:])

    # reconciliação com o Balanço: mensal por fonte (SIN) e dias conciliados
    rec_mes = defaultdict(lambda: {"bal": 0.0, "us": 0.0, "rr_excluida": 0.0, "dias": set(), "ok": 0, "n": 0})
    for x in rec:
        a = rec_mes[(x["d"][:7], x["f"])]
        a["bal"] += x["bal"]
        a["us"] += x["us"]
        if x["exclui_rr"]:
            a["rr_excluida"] += x["rr"]
        a["dias"].add(x["d"])
        a["n"] += 1
        a["ok"] += abs(x["dif_ajustada"]) <= TOL_DIA_MWH
    rec_mensal = []
    for (mes, f), a in sorted(rec_mes.items()):
        rec_mensal.append({"mes": mes, "fonte": f, "balanco_mwh": c.r(a["bal"], 1), "usinas_mwh": c.r(a["us"], 1),
                           "diferenca_mwh": c.r(a["bal"] - a["us"], 1), "roraima_excluida_mwh": c.r(a["rr_excluida"], 1),
                           "diferenca_sem_roraima_mwh": c.r(a["bal"] - a["us"] + a["rr_excluida"], 1),
                           "diferenca_pct": c.r(100 * (a["bal"] - a["us"]) / a["us"], 3) if a["us"] else None,
                           "dias": len(a["dias"]), "subsistema_dias": a["n"], "subsistema_dias_conciliados": a["ok"]})
    rr_dias = sorted({x["d"] for x in rec if x["f"] == "termica" and x["sm"] == "N" and x["rr"] > TOL_DIA_MWH})
    rr_excl = [x["d"] for x in rec if x["f"] == "termica" and x["sm"] == "N" and x["exclui_rr"]]
    rr_incl = [x["d"] for x in rec if x["f"] == "termica" and x["sm"] == "N" and x["rr"] > TOL_DIA_MWH
               and abs(x["dif"]) <= TOL_DIA_MWH]
    rr_outros = [x["d"] for x in rec if x["f"] == "termica" and x["sm"] == "N" and x["rr"] > TOL_DIA_MWH
                 and not x["exclui_rr"] and abs(x["dif"]) > TOL_DIA_MWH]
    sin_dia = defaultdict(lambda: [0.0, 0])
    for x in rec:
        a = sin_dia[(x["d"], x["f"])]
        a[0] += x["dif_ajustada"]
        a[1] += 1
    por_fonte = {}
    for f in ("hidraulica", "termica", "eolica", "solar"):
        xs = [x for x in rec if x["f"] == f]
        ds_ = [v[0] for (d, f_), v in sin_dia.items() if f_ == f and v[1] == 4]
        por_fonte[f] = {"subsistema_dias": len(xs), "conciliados": sum(1 for x in xs if abs(x["dif_ajustada"]) <= TOL_DIA_MWH),
                        "pct_conciliados": c.r(100 * sum(1 for x in xs if abs(x["dif_ajustada"]) <= TOL_DIA_MWH) / len(xs), 2) if xs else None,
                        "sin_dias": len(ds_), "sin_dias_conciliados": sum(1 for v in ds_ if abs(v) <= TOL_DIA_MWH),
                        "pct_sin_dias_conciliados": c.r(100 * sum(1 for v in ds_ if abs(v) <= TOL_DIA_MWH) / len(ds_), 2) if ds_ else None,
                        "soma_diferencas_mwh": c.r(sum(x["dif_ajustada"] for x in xs), 1),
                        "soma_balanco_mwh": c.r(sum(x["bal"] for x in xs), 1)}
    maiores = sorted(rec, key=lambda x: -abs(x["dif_ajustada"]))[:15]
    reconciliacao = {
        "tolerancia_mwh_por_subsistema_dia": TOL_DIA_MWH,
        "por_fonte": por_fonte,
        "roraima": {"dias_com_termica_rr": len(rr_dias), "dias_balanco_exclui": len(rr_excl),
                    "dias_balanco_inclui_integral": len(rr_incl), "dias_outra_diferenca": len(rr_outros),
                    "ultimo_dia_excluida": max(rr_excl) if rr_excl else None,
                    "primeiro_dia_sem_exclusao_apos": min((d for d in rr_dias if rr_excl and d > max(rr_excl)), default=None),
                    "regra": ("Dia em que o balanço exclui Roraima: diferença balanço − usinas no Norte igual, dentro da tolerância, "
                              "à térmica das usinas de Roraima (UF RR) na Geração por Usina. Só nesses dias a diferença é ajustada.")},
        "maiores_divergencias": [{"d": x["d"], "fonte": x["f"], "sm": x["sm"], "balanco_mwh": c.r(x["bal"], 1),
                                  "usinas_mwh": c.r(x["us"], 1), "diferenca_mwh": c.r(x["dif_ajustada"], 1)} for x in maiores],
        "mensal_ultimos_6": [x for x in rec_mensal if x["mes"] >= _meses_entre(ok[0][:7], dia_ref[:7])[-6]],
        "_mensal": rec_mensal,
    }
    return {
        "dia_referencia": dia_ref, "primeiro_dia": ok[0], "dias_completos": len(ok),
        "janelas": _sem_privados(janelas), "comparacao_12m": comparacao_12m, "mensal_sin": mensal,
        "natureza_mensal_sin": natureza_mensal, "anual_sin": anual, "diario_sin_recente": diario, "horario_sin_recente": horario,
        "rotulos": tab_rot, "nao_mapeadas": nao_map, "outros_por_ceg": outros, "reconciliacao_balanco": reconciliacao,
        "universo": {"identificadores_por_categoria": {k: (v[-24:] if isinstance(v, list) else v) for k, v in universo.items()},
                     "identificadores_sem_valor_por_categoria": {k: (v[-24:] if isinstance(v, list) else v) for k, v in sem_valor.items()},
                     "identificadores_sem_linhas_por_categoria": {k: (v[-24:] if isinstance(v, list) else v) for k, v in sem_linhas.items()},
                     "_sem_valor": sem_valor,
                     "lacuna_ultimo_mes": lacuna, "linhas_sem_id_ons_por_arquivo": sem_id,
                     "mudancas_de_rotulo": mudancas, "saltos_de_universo": saltos,
                     "sequencias_zero_rotulo": zeros_rotulo,
                     "sequencias_zero_identificadores": {"n": len(zeros_id), "continuam_no_ultimo_mes": sum(1 for x in zeros_id if x["continua"]),
                                                         "por_categoria": dict(Counter(x["categoria"] for x in zeros_id)),
                                                         "lista": zeros_id[:10]},
                     "regra": ("Identificador = usina, conjunto ou grupo (id_ons) da natureza verificada, na categoria do último rótulo "
                               "publicado. Com valor: ao menos uma hora com valor no mês (zero publicado conta). Sem valor: linhas, todas "
                               "vazias. Sem linhas: teve valor em algum dos 12 meses anteriores e não consta do arquivo no mês. Salto = "
                               f"variação de {int(100 * SALTO_VARIACAO)}% ou mais entre meses seguidos, com ao menos {SALTO_MIN_ANTES} "
                               "identificadores com valor no mês anterior."),
                     "regra_ressalvas": ("Cada janela, mês e ano leva em ressalvas_universo as categorias com salto de universo dentro do "
                                         "período (no mês, salto em relação ao mês anterior) ou com universo reduzido: identificadores com "
                                         f"valor no último mês do período até {int(100 * REDUZIDO_FRACAO)}% do maior número dos 12 meses "
                                         f"anteriores ao início (com ao menos {SALTO_MIN_ANTES} nessa referência). A participação continua "
                                         "publicada; a ressalva diz que ela não é comparável com períodos de outro universo."),
                     "regra_sequencias_zero": (f"Rótulo: todas as horas com valor exatamente zero por {ZERO_MESES_ROTULO} meses seguidos ou "
                                               f"mais depois de um mês com geração positiva. Identificador: o mesmo por {ZERO_MESES_ID} meses. "
                                               "Pode ser parada real (térmica sem despacho, usina desligada) ou falha da fonte; a fonte "
                                               "não distingue, e nada é excluído.")},
        "_janelas": janelas,
    }


# ---------------------------------------------------------------- P022 despacho térmico

def historico_cadastro(con, ds):
    """{chave: [estado, ...]}: cada estado distinto que o registro teve, na ordem das
    capturas. grava_registros só guarda o que muda, e cada arquivo é uma vintage; o estado
    depois de cada vintage que tocou a chave é o que aquele arquivo publicou. É assim que
    se recuperam todos os CEGs que um identificador já teve (o cadastro vigente guarda só o
    último)."""
    estado, hist = {}, defaultdict(list)
    tocadas, vid_atual = set(), None

    def fecha():
        for ch in tocadas:
            st = {k: v for k, v in estado[ch].items() if v != ""}
            if not hist[ch] or hist[ch][-1] != st:
                hist[ch].append(st)
        tocadas.clear()

    for ch, campo, valor, vid in con.execute(
            """SELECT r.chave, r.campo, r.valor, r.vintage_id FROM registros r JOIN vintages v ON v.vintage_id = r.vintage_id
               WHERE r.dataset = ? ORDER BY v.capturado_em, r.rowid""", (ds,)):
        if vid != vid_atual:
            fecha()
            vid_atual = vid
        estado.setdefault(ch, {})[campo] = valor
        tocadas.add(ch)
    fecha()
    return dict(hist)


def ceg_para_ids(hist_u, cad_u):
    """{CEG: {id_ons}} com todos os CEGs que cada identificador da Geração por Usina já
    publicou (histórico) e os do cadastro vigente."""
    out = defaultdict(set)
    for ido, estados in (hist_u or {}).items():
        for st in estados:
            ceg = og.ceg_valido(st.get("ceg"))
            if ceg:
                out[ceg].add(ido)
    for ido, r_ in (cad_u or {}).items():
        ceg = og.ceg_valido(r_.get("ceg"))
        if ceg:
            out[ceg].add(ido)
    return out


def mapa_combustivel(cad_t, cad_u, unidades, hist_u=None, identidade=None):
    """Combustível de cada usina da térmica por motivo, por ordem de autoridade:
    1. campo nom_combustivel do próprio conjunto (só existe nos arquivos de 2026);
    2. mesmo CEG na Geração por Usina (nom_tipocombustivel), com TODOS os CEGs que cada
       identificador já publicou (`hist_u`), não só o último: a usina Do Atlântico publicou
       UTE.PE.RJ.029587-6.01 com "Resíduos Industriais" até 10/2025 e UTE.CM depois;
    3. mesmo CEG na Capacidade Instalada (nom_combustivel da unidade; a turbina a vapor de
       ciclo combinado não é combustível e não decide);
    4. o mesmo nas duas fontes pelo CEG sem o sufixo de versão;
    5. outra chave da mesma usina (`identidade`: CEG com o mesmo número e o mesmo código do
       ONS ou o mesmo identificador da Geração por Usina);
    sem nenhum: "não mapeada", explícita. Nunca por semelhança de nome."""
    por_ceg_u, por_base_u, por_ceg_c, por_base_c = {}, {}, {}, {}

    def rot_u(r_):
        return "Nuclear" if og.norm(r_.get("tipo")) == "NUCLEAR" else r_.get("comb")

    estados = [st for est in (hist_u or {}).values() for st in est] + list(cad_u.values())
    for r_ in estados:  # do mais antigo ao vigente: o rótulo mais recente de cada CEG prevalece
        ceg = og.ceg_valido(r_.get("ceg"))
        if ceg and og.grupo_balanco(r_.get("tipo")) == "termica" and rot_u(r_):
            por_ceg_u[ceg] = rot_u(r_)
            por_base_u[og.ceg_base(ceg)] = rot_u(r_)
    for cod, u in unidades.items():
        ceg = (u.get("ceg") or "").strip()
        if ceg and og.grupo_balanco(u.get("tipo")) == "termica" and og.norm(u.get("combustivel")) != og.COMBUSTIVEL_CICLO_COMBINADO:
            rot = "Nuclear" if og.norm(u.get("tipo")) == "NUCLEAR" else u.get("combustivel")
            por_ceg_c.setdefault(ceg, rot)
            por_base_c.setdefault(og.ceg_base(ceg), rot)
    out = {}
    for ch, r_ in cad_t.items():
        ceg = og.ceg_valido(r_.get("ceg")) or (ch if not ch.startswith(("cod:", "sem_")) else "")
        for origem, rot in (("termica_por_motivo", r_.get("combustivel")),
                            ("geracao_por_usina", por_ceg_u.get(ceg)),
                            ("capacidade_instalada", por_ceg_c.get(ceg)),
                            ("geracao_por_usina_ceg_base", por_base_u.get(og.ceg_base(ceg)) if ceg else None),
                            ("capacidade_instalada_ceg_base", por_base_c.get(og.ceg_base(ceg)) if ceg else None)):
            if rot:
                out[ch] = {"rotulo": rot, "categoria": og.categoria_combustivel(rot), "origem": origem}
                break
        else:
            out[ch] = {"rotulo": None, "categoria": "nao_mapeada", "origem": "nao_identificado"}
    if identidade:
        membros = defaultdict(list)
        for ch, rep in identidade.items():
            membros[rep].append(ch)
        for ch, x in list(out.items()):
            if x["categoria"] != "nao_mapeada" or ch not in identidade:
                continue
            outras = [out[o] for o in membros[identidade[ch]] if o != ch and o in out and out[o]["categoria"] != "nao_mapeada"]
            if outras:
                out[ch] = {"rotulo": outras[0]["rotulo"], "categoria": outras[0]["categoria"], "origem": "mesma_usina"}
    return out


def codigos_termicos(hist_t, cad_t):
    """{chave: {códigos do ONS}} com todos os códigos que cada CEG já teve: o campo `cod`
    (último código de cada arquivo) e as parcelas (todas as linhas de cada arquivo)."""
    out = defaultdict(set)
    for ch, estados in list((hist_t or {}).items()) + [(ch, [r_]) for ch, r_ in cad_t.items()]:
        for st in estados:
            if st.get("cod") not in (None, ""):
                out[ch].add(int(float(st["cod"])))
            for cod, _ in json.loads(st.get("parcelas") or "[]"):
                out[ch].add(int(cod))
    return out


def nomes_parcelas(hist_t, cad_t):
    """{(chave, código): nome} da parcela, pelo último arquivo que a trouxe."""
    out = {}
    for ch, estados in list((hist_t or {}).items()) + [(ch, [r_]) for ch, r_ in cad_t.items()]:
        for st in estados:
            for cod, nome in json.loads(st.get("parcelas") or "[]"):
                out[(ch, int(cod))] = nome
    return out


def identidades_termicas(chaves, cad_t, cods, ceg_ids, ultimo_mes_de):
    """Liga as chaves da térmica por motivo que são a mesma usina: CEGs com o mesmo número
    de empreendimento (a ANEEL corrigiu só o código de combustível ou a UF) E um elo
    publicado pelo ONS, o mesmo código nos modelos ou o mesmo identificador na Geração por
    Usina. Representante = a chave com o mês mais recente com dado. Nunca por nome."""
    pai = {ch: ch for ch in chaves}

    def raiz(x):
        while pai[x] != x:
            pai[x] = pai[pai[x]]
            x = pai[x]
        return x

    por_nucleo = defaultdict(list)
    for ch in chaves:
        n_ = og.nucleo_ceg(og.ceg_valido(cad_t.get(ch, {}).get("ceg")) or ch)
        if n_:
            por_nucleo[n_].append(ch)
    for n_, chs in por_nucleo.items():
        for i in range(len(chs)):
            for j in range(i + 1, len(chs)):
                a, b = chs[i], chs[j]
                ceg_a = og.ceg_valido(cad_t.get(a, {}).get("ceg")) or a
                ceg_b = og.ceg_valido(cad_t.get(b, {}).get("ceg")) or b
                if (cods.get(a, set()) & cods.get(b, set())) or (ceg_ids.get(ceg_a, set()) & ceg_ids.get(ceg_b, set())):
                    pai[raiz(a)] = raiz(b)
    grupos = defaultdict(list)
    for ch in chaves:
        grupos[raiz(ch)].append(ch)
    out = {}
    for chs in grupos.values():
        rep = max(chs, key=lambda x: (ultimo_mes_de.get(x) or "", x))
        for ch in chs:
            out[ch] = rep
    return out


def nome_identidade(rep, membros, cad_t, ceg_ids, cad_u, unidades):
    """Nome da usina (não da última parcela): com uma parcela só, o nome da térmica por
    motivo; com várias, o nome da usina na Geração por Usina (mesmo CEG), senão o da
    Capacidade Instalada, senão os nomes das parcelas juntos."""
    parc = json.loads(cad_t.get(rep, {}).get("parcelas") or "[]")
    if len(parc) <= 1:
        return (parc[0][1] if parc else cad_t.get(rep, {}).get("nome")), "termica_por_motivo"
    cegs = {og.ceg_valido(cad_t.get(ch, {}).get("ceg")) or ch for ch in membros}
    nomes = sorted({cad_u.get(i, {}).get("nome") for ceg in cegs for i in ceg_ids.get(ceg, ()) if cad_u.get(i, {}).get("nome")})
    if nomes:
        return " + ".join(nomes), "geracao_por_usina"
    cap = sorted({u.get("usina") for u in unidades.values() if (u.get("ceg") or "").strip() in cegs and u.get("usina")})
    if cap:
        return " + ".join(cap), "capacidade_instalada"
    return " + ".join(sorted({n for _, n in parc})), "termica_por_motivo"


def _meses_completos(dias_por_mes, ate_mes):
    return [m for m in sorted(dias_por_mes) if m < ate_mes and dias_por_mes[m] == og.dias_do_mes(m)]


# A gold leva a térmica mensal de 2019 em diante (crise hídrica de 2021 incluída); o CSV
# geracao_termica_motivo_mensal.csv tem a série inteira, de 2013 em diante.
MES_INICIAL_GOLD_TERMICA = "2019-01"
USINAS_GOLD_TERMICA = 40
USINAS_GOLD_RESTRICAO = {"coff_eolica": 60, "coff_solar": 40}


def bloco_termica(con, D_u, unidades, hoje):
    ds = _ds("termica")
    man = manifestos(con, ds)
    tudo = filtra_manifesto(vigentes(con, ds), man)
    cad_t = base.registros_como_estavam_em(con, ds)
    hist_t = historico_cadastro(con, ds)
    hist_u = D_u.get("historico_cadastro") or {}
    cad_u = D_u["cadastro"]
    diario, usina_mes, parcela_mes, horas = defaultdict(float), defaultdict(float), defaultdict(float), {}
    for (serie, ref), v in tudo.items():
        p = serie.split("|")
        if p[0] == "t":
            diario[(ref[:7], p[1], p[2])] += v
            diario[(ref[:7], "SIN", p[2])] += v
        elif p[0] == "tu":
            usina_mes[(ref, p[1], p[2])] += v
        elif p[0] == "tp":
            parcela_mes[(ref, p[1], int(p[2]))] += v
        elif p[0] == "tnh":
            horas[ref] = v
    # dia completo: 23 a 25 instantes (dias de troca do horário de verão, até 2019, têm 23 ou 25)
    dias_mes = Counter(d[:7] for d, n in horas.items() if n >= 23)
    horas_mes = defaultdict(float)
    for d, n in horas.items():
        horas_mes[d[:7]] += n
    meses_todos = sorted(dias_mes)
    meses = [m for m in meses_todos if m >= MES_INICIAL_GOLD_TERMICA]
    hoje_mes = hoje.isoformat()[:7]
    completos = _meses_completos(dias_mes, hoje_mes)
    if not completos:
        return None
    ult12 = completos[-12:]
    presentes_t = sorted({ch for (_, ch, _) in usina_mes})
    ultimo_mes_de = {}
    for (mes, ch, med), v in usina_mes.items():
        if med == "total" and mes > ultimo_mes_de.get(ch, ""):
            ultimo_mes_de[ch] = mes
    cods = codigos_termicos(hist_t, cad_t)
    cegs_gu = ceg_para_ids(hist_u, cad_u)
    ident = identidades_termicas(presentes_t, cad_t, cods, cegs_gu, ultimo_mes_de)
    membros = defaultdict(list)
    for ch, rep in ident.items():
        membros[rep].append(ch)
    nome_id = {rep: nome_identidade(rep, chs, cad_t, cegs_gu, cad_u, unidades) for rep, chs in membros.items()}
    comb = mapa_combustivel({ch: r_ for ch, r_ in cad_t.items() if ch in ident}, cad_u, unidades, hist_u=hist_u, identidade=ident)
    # série mensal do SIN por motivo (MWmed = MWh ÷ horas do mês no arquivo)
    mensal = {"meses": meses, "horas": [horas_mes[m] for m in meses],
              "parcial": [dias_mes[m] < og.dias_do_mes(m) for m in meses], "total_mwmed": [],
              **{m: [] for m in MOTIVOS}, "nao_classificado_mwmed": [], "constrained_off_mwmed": []}
    for mes in meses:
        hs = horas_mes[mes]
        tot = diario.get((mes, "SIN", "total"))
        mensal["total_mwmed"].append(c.r(_div(tot, hs), 1))
        partes = {m: diario.get((mes, "SIN", m)) for m in MOTIVOS}
        for m in MOTIVOS:
            mensal[m].append(c.r(_div(partes[m], hs), 1))
        res = None if tot is None else tot - sum(v for v in partes.values() if v is not None)
        mensal["nao_classificado_mwmed"].append(c.r(_div(res, hs), 2))
        mensal["constrained_off_mwmed"].append(c.r(_div(diario.get((mes, "SIN", "constrained_off")), hs), 1))
    # últimos 12 meses completos: combustível × motivo, a partir das séries por usina
    horas12 = sum(horas_mes[m] for m in ult12)
    por_comb = defaultdict(lambda: defaultdict(float))
    por_usina = defaultdict(lambda: defaultdict(float))
    for (mes, ch, med), v in usina_mes.items():
        if mes in ult12:
            por_comb[comb.get(ch, {}).get("categoria", "nao_mapeada")][med] += v
            por_usina[ident.get(ch, ch)][med] += v
    tot12 = sum(x.get("total", 0.0) for x in por_comb.values())
    motivos12 = {m: sum(x.get(m, 0.0) for x in por_comb.values()) for m in MOTIVOS}
    res12 = tot12 - sum(motivos12.values())
    por_combustivel = []
    for cat in og.COMBUSTIVEIS:
        x = por_comb.get(cat)
        if not x:
            continue
        t_ = x.get("total", 0.0)
        por_combustivel.append({"categoria": cat, "rotulo": ROTULO_CAT[cat], "mwh": c.r(t_, 1), "mwmed": c.r(t_ / horas12, 1),
                                "pct_total": c.r(100 * t_ / tot12, 2) if tot12 else None,
                                "motivos_mwh": {m: c.r(x.get(m), 1) for m in MOTIVOS},
                                "motivos_pct": {m: (c.r(100 * x.get(m, 0.0) / t_, 2) if t_ else None) for m in MOTIVOS},
                                "nao_classificado_mwh": c.r(t_ - sum(x.get(m, 0.0) for m in MOTIVOS), 1)})
    # série mensal por combustível desde o início
    comb_mes = defaultdict(float)
    for (mes, ch, med), v in usina_mes.items():
        if med == "total":
            comb_mes[(mes, comb.get(ch, {}).get("categoria", "nao_mapeada"))] += v
    mensal_comb = {"meses": meses, **{cat: [c.r(_div(comb_mes.get((m, cat)), horas_mes[m]), 1) if (m, cat) in comb_mes else None
                                            for m in meses] for cat in og.COMBUSTIVEIS}}
    # CVU vigente: código do ONS → usina (identidade), com todos os códigos de todas as chaves
    cod_ident = defaultdict(set)
    for ch, cs in cods.items():
        if ch in ident:
            for cod in cs:
                cod_ident[cod].add(ident[ch])
    nomes_p = nomes_parcelas(hist_t, cad_t)
    cvu = bloco_cvu(con, comb, hoje, cod_ident, nome_id)
    cvu_por_cod = {x["cod"]: x for x in (cvu or {}).get("usinas", [])}
    parc12 = defaultdict(float)
    for (mes, ch, cod), v in parcela_mes.items():
        if mes in ult12 and ch in ident:
            parc12[(ident[ch], cod)] += v
    usinas = []
    for rep, x in por_usina.items():
        t_ = x.get("total", 0.0)
        r_ = cad_t.get(rep, {})
        chs = sorted(membros.get(rep, [rep]))
        cods_rep = sorted({cod for ch in chs for cod in cods.get(ch, ())})
        parcelas = []
        for cod in cods_rep:
            mwh_p = parc12.get((rep, cod))
            cv = cvu_por_cod.get(cod)
            if not mwh_p and not (cv and cv.get("id_termica") == rep):
                continue  # parcela sem geração no período e sem CVU na semana (contada em parcelas_omitidas)
            nome_p = next((nomes_p[(ch, cod)] for ch in [rep] + chs if (ch, cod) in nomes_p), None)
            parcelas.append({"cod": cod, "nome": nome_p, "mwh": c.r(mwh_p, 1),
                             "cvu_semana_vigente": cv["cvu"] if cv and cv.get("id_termica") == rep else None})
        omitidas = len(cods_rep) - len(parcelas)
        com_cvu = [p_["cvu_semana_vigente"] for p_ in parcelas if p_["cvu_semana_vigente"] is not None]
        usinas.append({"id": rep, "nome": nome_id[rep][0], "origem_nome": nome_id[rep][1], "sm": r_.get("sm"),
                       "ceg": og.ceg_valido(r_.get("ceg")) or None,
                       "chaves_na_fonte": chs,
                       "combustivel": comb.get(rep, {}).get("rotulo"), "categoria": comb.get(rep, {}).get("categoria", "nao_mapeada"),
                       "origem_combustivel": comb.get(rep, {}).get("origem", "nao_identificado"),
                       "mwh": c.r(t_, 1), "mwmed": c.r(t_ / horas12, 2),
                       "motivos_pct": {m: c.r(100 * x[m] / t_, 1) for m in MOTIVOS if t_ > 0 and x.get(m)},
                       "constrained_off_mwh": c.r(x.get("constrained_off"), 1),
                       "parcelas": parcelas, "parcelas_omitidas": omitidas,
                       # um valor só quando a usina tem uma parcela com CVU; com várias, o CVU de cada uma está em parcelas
                       "cvu_semana_vigente": com_cvu[0] if len(com_cvu) == 1 else None})
    usinas.sort(key=lambda u: -(u["mwh"] or 0))
    n_usinas_12m = sum(1 for u in usinas if (u["mwh"] or 0) > 0)
    cob_top = c.r(100 * sum(u["mwh"] or 0 for u in usinas[:USINAS_GOLD_TERMICA]) / tot12, 2) if tot12 else None
    origens = Counter(v["origem"] for v in comb.values())
    nao_id = [{"id": ch, "nome": cad_t.get(ch, {}).get("nome"),
               "mwh_12m": c.r(sum(v for (m, ch_, med), v in usina_mes.items() if ch_ == ch and med == "total" and m in ult12), 1)}
              for ch, v in comb.items() if v["categoria"] == "nao_mapeada"]
    ligadas = [{"usina": rep, "nome": nome_id[rep][0], "chaves": sorted(chs)} for rep, chs in sorted(membros.items()) if len(chs) > 1]
    universo = universo_termica(D_u, usina_mes, cad_t, ident, cegs_gu, completos)
    rels = relatorios(con, ds)
    negativos = sum((r_ or {}).get("negativos", 0) for r_ in rels.values())
    return {
        "motivos": [{"id": m, "rotulo": ROTULO_MOTIVO[m], "campo": col} for m, col, _ in og.MOTIVOS],
        "ultimo_mes_completo": completos[-1], "primeiro_mes": meses_todos[0], "primeiro_mes_na_gold": meses[0],
        "mensal_sin": mensal,
        "ultimos_12m": {"inicio": ult12[0], "fim": ult12[-1], "horas": horas12, "total_mwh": c.r(tot12, 1),
                        "total_mwmed": c.r(tot12 / horas12, 1),
                        "por_motivo": [{"motivo": m, "rotulo": ROTULO_MOTIVO[m], "mwh": c.r(motivos12[m], 1),
                                        "pct": c.r(100 * motivos12[m] / tot12, 2) if tot12 else None} for m in MOTIVOS],
                        "nao_classificado_mwh": c.r(res12, 1), "nao_classificado_pct": c.r(100 * res12 / tot12, 3) if tot12 else None,
                        "por_combustivel": por_combustivel, "_motivos": motivos12, "_tot": tot12},
        "mensal_combustivel": mensal_comb,
        "usinas_12m": usinas[:USINAS_GOLD_TERMICA],
        "usinas_12m_resumo": {"usinas_com_geracao": n_usinas_12m, "publicadas": min(len(usinas), USINAS_GOLD_TERMICA),
                              "cobertura_da_energia_pct": cob_top, "lista_completa": CSV["termica_usina"]},
        "mapa_combustivel": {"usinas": len(comb), "por_origem": dict(origens), "nao_identificadas": nao_id,
                             "nao_identificadas_mwh_12m": c.r(sum(x["mwh_12m"] or 0 for x in nao_id), 1),
                             "nao_identificadas_pct_12m": c.r(100 * sum(x["mwh_12m"] or 0 for x in nao_id) / tot12, 3) if tot12 else None},
        "identidade": {"usinas_com_mais_de_uma_chave": ligadas,
                       "regra": ("Chaves da fonte (CEG) ligadas como a mesma usina quando o número do empreendimento no CEG é o mesmo "
                                 "(a ANEEL corrigiu só o código de combustível ou a UF) e o ONS publica um elo: o mesmo código nos "
                                 "modelos ou o mesmo identificador na Geração por Usina. A usina leva a chave mais recente e o nome da "
                                 "usina (com várias parcelas, o da Geração por Usina); cada parcela, seu código e seu CVU.")},
        "universo": universo,
        "cvu": cvu,
        "controles": {"valores_negativos_na_fonte": negativos},
        "_usina_mes": usina_mes, "_comb": comb, "_cad": cad_t, "_horas_mes": horas_mes, "_ult12": ult12, "_diario": diario,
        "_meses_todos": meses_todos, "_ident": ident, "_nome_id": nome_id,
    }


def universo_termica(D_u, usina_mes, cad_t, ident, cegs_gu, completos):
    """A térmica por motivo cobre as térmicas despachadas pelo ONS. Conferência por outro
    caminho: as mesmas usinas (mesma identidade: CEGs com o mesmo número e elo publicado)
    somadas na Geração por Usina, mês a mês, cada identificador uma vez; e a cobertura em
    relação a todas as térmicas e nucleares Tipo I e II-A da Geração por Usina."""
    cad_u = D_u["cadastro"]
    u_mes = defaultdict(float)
    for (serie, mes), v in D_u["u"].items():
        u_mes[(serie[2:], mes)] = v
    meses = [m for m in completos if m >= min(m_ for (_, m_) in u_mes)] if u_mes else []
    ids_de = defaultdict(set)
    for ch, rep in ident.items():
        ids_de[rep] |= cegs_gu.get(og.ceg_valido(cad_t.get(ch, {}).get("ceg")) or ch, set())
    tot_por_mes = defaultdict(lambda: defaultdict(float))
    for (m, ch, med), v in usina_mes.items():
        if med == "total":
            tot_por_mes[m][ident.get(ch, ch)] += v
    linhas = []
    for mes in meses[-12:]:
        term_tot = sum(tot_por_mes.get(mes, {}).values())
        mesmas_t = mesmas_u = 0.0
        pares = sem_par = 0
        for rep, v in tot_por_mes.get(mes, {}).items():
            ids = ids_de.get(rep)
            if ids:
                pares += 1
                mesmas_t += v
                mesmas_u += sum(u_mes.get((i, mes), 0.0) for i in ids)
            else:
                sem_par += 1
        tipo12 = sum(v for (i, m), v in u_mes.items() if m == mes and og.grupo_balanco(cad_u.get(i, {}).get("tipo")) == "termica"
                     and og.norm(cad_u.get(i, {}).get("mod")) in ("TIPO I", "TIPO II-A"))
        linhas.append({"mes": mes, "termica_por_motivo_mwh": c.r(term_tot, 1),
                       "usinas_pareadas": pares, "usinas_sem_par": sem_par,
                       "pareadas_termica_mwh": c.r(mesmas_t, 1), "pareadas_geracao_usina_mwh": c.r(mesmas_u, 1),
                       "diferenca_pareadas_pct": c.r(100 * (mesmas_t - mesmas_u) / mesmas_u, 3) if mesmas_u else None,
                       "geracao_usina_tipo_i_iia_mwh": c.r(tipo12, 1),
                       "cobertura_tipo_i_iia_pct": c.r(100 * term_tot / tipo12, 2) if tipo12 else None})
    return {"mensal": linhas,
            "regra": ("Pareamento pelo CEG da ANEEL, com todos os CEGs que cada identificador da Geração por Usina já publicou e "
                      "as chaves da mesma usina ligadas: a mesma usina nos dois conjuntos, cada identificador somado uma vez. A "
                      "cobertura compara o total da térmica por motivo com todas as térmicas e nucleares de modalidade Tipo I e "
                      "II-A da Geração por Usina, inclusive as de Roraima, que só entram no SIN com a interligação.")}


def bloco_cvu(con, comb, hoje, cod_ident, nome_id):
    ds = _ds("cvu")
    man = manifestos(con, ds)
    obs = filtra_manifesto(vigentes(con, ds), man)
    reg = base.registros_como_estavam_em(con, ds)
    if not obs:
        return None
    por_sem = defaultdict(dict)
    for (serie, ini), v in obs.items():
        por_sem[ini][int(serie.split("|")[1])] = v
    semanas = sorted(s for s in por_sem if s <= hoje.isoformat())
    if not semanas:
        return None
    sem = semanas[-1]
    info = reg.get(f"sem|{sem}", {})
    # código do ONS → usina da térmica por motivo. Os códigos de cada usina são os de todas
    # as linhas de todos os arquivos (parcelas), de todas as chaves ligadas à mesma usina;
    # código que leva a mais de uma usina fica sem par (nenhuma escolha em silêncio)
    cod_ch = {cod: next(iter(reps)) for cod, reps in cod_ident.items() if len(reps) == 1}
    ambiguos = {cod: sorted(reps) for cod, reps in cod_ident.items() if len(reps) > 1}

    def cat_cod(cod):
        ch = cod_ch.get(cod)
        return (comb.get(ch) or {}).get("categoria", "nao_mapeada") if ch else "nao_mapeada"
    usinas = []
    for cod, v in sorted(por_sem[sem].items(), key=lambda x: x[1]):
        r_ = reg.get(f"usi|{cod}", {})
        ch = cod_ch.get(cod)
        usinas.append({"cod": cod, "nome": r_.get("nome"), "sm": r_.get("sm"), "cvu": c.r(v, 2), "categoria": cat_cod(cod),
                       "id_termica": ch, "usina": (nome_id.get(ch) or (None,))[0] if ch else None})
    por_cat = defaultdict(list)
    for u in usinas:
        por_cat[u["categoria"]].append(u["cvu"])
    dist = [{"categoria": cat, "rotulo": ROTULO_CAT[cat], **_quantis(vs)} for cat, vs in sorted(por_cat.items())]
    # mediana mensal por combustível (todas as usinas e semanas com início no mês), 2021 em diante
    mens = defaultdict(list)
    for ini in semanas:
        if ini < "2021-01-01":
            continue
        for cod, v in por_sem[ini].items():
            mens[(ini[:7], cat_cod(cod))].append(v)
    meses_cvu = sorted({m for m, _ in mens})
    hist = {"meses": meses_cvu, **{cat: [c.r(c.quantil(mens[(m, cat)], 0.5), 2) if mens.get((m, cat)) else None for m in meses_cvu]
                                   for cat in og.COMBUSTIVEIS if any((m, cat) in mens for m in meses_cvu)}}
    rels = relatorios(con, ds)
    conflitos = sum((r_ or {}).get("n_conflitos", 0) for r_ in rels.values())
    repetidas = sum((r_ or {}).get("repetidas_identicas", 0) for r_ in rels.values())
    return {"semana": {"inicio": sem, "fim": info.get("fim"), "estudo": info.get("estudo"),
                       "pmo": f"{info.get('ano_ref')}-{int(float(info.get('mes_ref'))):02d}" if info.get("mes_ref") else None,
                       "revisao": int(float(info["revisao"])) if info.get("revisao") not in (None, "") else None},
            "usinas": usinas, "por_combustivel": dist, "mediana_mensal": hist,
            "cobertura": {"usinas_com_cvu": len(usinas), "pareadas_com_termica": sum(1 for u in usinas if u["id_termica"]),
                          "sem_par": [u["nome"] for u in usinas if not u["id_termica"]][:40],
                          "codigos_ambiguos": [{"cod": cod, "usinas": reps} for cod, reps in sorted(ambiguos.items())][:20]},
            "controles": {"conflitos_mesma_semana_usina": conflitos, "linhas_repetidas_identicas": repetidas},
            "_por_sem": por_sem, "_reg": reg, "_cod_ch": cod_ch}


# ---------------------------------------------------------------- P023 renováveis restringidas

RAZOES = ("REL", "CNF", "ENE", "PAR", "SEM")


def bloco_restricao(con, k, k_det, fc_cad, hoje):
    ds = _ds(k)
    man = manifestos(con, ds)
    tudo = filtra_manifesto(vigentes(con, ds), man)
    if not tudo:
        return None
    cad = base.registros_como_estavam_em(con, ds)
    sm_dia = defaultdict(lambda: defaultdict(float))
    raz_dia = defaultdict(float)
    pot, pot_ref = {}, {}
    usina = defaultdict(dict)
    for (serie, ref), v in tudo.items():
        p = serie.split("|")
        pre = p[0]
        if pre in ("g", "r", "m", "l", "lsr", "gn"):
            sm_dia[(ref, p[1])][pre] += v
        elif pre in ("e", "a", "lm"):
            raz_dia[(ref, p[1], p[2], p[3], pre)] += v
        elif pre == "p":
            pot[(ref, p[1])] = v
        elif pre == "pr":
            pot_ref[(ref, p[1])] = v
        elif pre.startswith("u"):
            usina[(ref, p[1])][pre[1:]] = v
    dias = sorted({d for d, _ in sm_dia})
    # dia completo: meias horas no SIN de pelo menos 95% da mediana do mês (um último dia
    # publicado pela metade não completa o mês)
    meias_dia = defaultdict(float)
    for (d, sm), x in sm_dia.items():
        meias_dia[d] += x.get("m", 0.0)
    med_mes = {m: c.quantil([v for d, v in meias_dia.items() if d[:7] == m], 0.5) for m in {d[:7] for d in dias}}
    dias_mes = Counter(d[:7] for d in dias if meias_dia[d] >= 0.95 * (med_mes[d[:7]] or 0))
    meses = sorted(dias_mes)
    completos = _meses_completos(dias_mes, hoje.isoformat()[:7])
    ult12 = completos[-12:]
    por_mes_raz = defaultdict(float)
    por_mes_orig = defaultdict(float)
    por_mes = defaultdict(lambda: defaultdict(float))
    for (d, sm, raz, orig, med), v in raz_dia.items():
        if med == "e":
            por_mes_raz[(d[:7], raz)] += v
            por_mes_orig[(d[:7], raz, orig)] += v
            por_mes[(d[:7], sm)]["eng"] += v
            por_mes[(d[:7], "SIN")]["eng"] += v
        elif med == "a":
            por_mes[(d[:7], "SIN")]["gnra"] += v
            por_mes[(d[:7], "SIN")]["gnra_eng"] += raz_dia.get((d, sm, raz, orig, "e"), 0.0)
        elif med == "lm":
            por_mes[(d[:7], "SIN")]["lim"] += v
    for (d, sm), x in sm_dia.items():
        for rg in (sm, "SIN"):
            por_mes[(d[:7], rg)]["ger"] += x.get("g", 0.0)
            por_mes[(d[:7], rg)]["meias"] += x.get("m", 0.0)
            por_mes[(d[:7], rg)]["lsr"] += x.get("lsr", 0.0)
            por_mes[(d[:7], rg)]["gn"] += x.get("gn", 0.0)
    pot_mes = {}
    for (d, rg), v in pot.items():
        if rg == "SIN" and (d[:7] not in pot_mes or v > pot_mes[d[:7]][0]):
            pot_mes[d[:7]] = (v, d)
    usinas_mes = Counter(m for (m, ido), x in usina.items() if "ger" in x)
    mensal = {"meses": meses, "parcial": [dias_mes[m] < og.dias_do_mes(m) for m in meses],
              "energia_nao_gerada_mwh": {raz: [c.r(por_mes_raz.get((m, raz)), 1) if (m, raz) in por_mes_raz else 0.0 for m in meses]
                                         for raz in RAZOES},
              "energia_nao_gerada_total_mwh": [c.r(por_mes[(m, "SIN")].get("eng", 0.0), 1) for m in meses],
              "geracao_verificada_mwh": [c.r(por_mes[(m, "SIN")].get("ger"), 1) for m in meses],
              "taxa_pct": [c.r(_div(100 * por_mes[(m, "SIN")].get("eng", 0.0), por_mes[(m, "SIN")].get("ger", 0.0) + por_mes[(m, "SIN")].get("eng", 0.0)), 2)
                           for m in meses],
              "potencia_max_cortada_mw": [c.r(pot_mes[m][0], 1) if m in pot_mes else 0.0 for m in meses],
              "usinas": [usinas_mes.get(m, 0) for m in meses],
              "meias_horas_limitadas": [int(por_mes[(m, "SIN")].get("lim", 0)) for m in meses]}
    # últimos 12 meses completos
    def soma12(rg, campo):
        return sum(por_mes[(m, rg)].get(campo, 0.0) for m in ult12)
    eng12, ger12 = soma12("SIN", "eng"), soma12("SIN", "ger")
    por_razao = []
    for raz in RAZOES:
        v = sum(por_mes_raz.get((m, raz), 0.0) for m in ult12)
        por_razao.append({"razao": raz, "rotulo": og.ROTULO_RAZAO[raz], "mwh": c.r(v, 1),
                          "pct": c.r(100 * v / eng12, 2) if eng12 else None,
                          "origens_mwh": {o: c.r(sum(por_mes_orig.get((m, raz, o), 0.0) for m in ult12), 1) for o in ("LOC", "SIS", "")
                                          if any((m, raz, o) in por_mes_orig for m in ult12)}})
    por_sm = []
    for sm in SM:
        e_, g_ = soma12(sm, "eng"), soma12(sm, "ger")
        if g_ or e_:
            por_sm.append({"sm": sm, "energia_nao_gerada_mwh": c.r(e_, 1), "geracao_verificada_mwh": c.r(g_, 1),
                           "taxa_pct": c.r(_div(100 * e_, g_ + e_), 2)})
    pmax = max(((pot_mes[m][0], m) for m in ult12 if m in pot_mes), default=(None, None))
    quando = None
    if pmax[1]:
        dia_max = pot_mes[pmax[1]][1]
        quando = base.registros_como_estavam_em(con, ds).get(f"p|SIN|{dia_max}", {}).get("instante") or dia_max
    # usinas (12 meses): energia não gerada, taxa, razão principal e coordenadas do ONS
    u12 = defaultdict(lambda: defaultdict(float))
    for (m, ido), x in usina.items():
        if m in ult12:
            for campo, v in x.items():
                u12[ido][campo] += v
    universo = len(u12)
    usinas = []
    for ido, x in u12.items():
        eng = sum(v for kk, v in x.items() if kk.startswith("eng_"))
        if eng <= 0:
            continue
        r_ = cad.get(ido, {})
        f_ = fc_cad.get(ido, {})
        raz_p = max(((x.get(f"eng_{r}", 0.0), r) for r in RAZOES))[1]
        # coordenada da subestação coletora; sem ela, a do ponto de conexão, com a origem registrada
        if f_.get("lat") not in (None, "") and f_.get("lon") not in (None, ""):
            lat, lon, origem_c = f_.get("lat"), f_.get("lon"), "subestacao_coletora"
        elif f_.get("lat_pc") not in (None, "") and f_.get("lon_pc") not in (None, ""):
            lat, lon, origem_c = f_.get("lat_pc"), f_.get("lon_pc"), "ponto_de_conexao"
        else:
            lat = lon = origem_c = None
        usinas.append({"id": ido, "nome": r_.get("nome"), "sm": r_.get("sm"), "uf": r_.get("uf"),
                       "lat": c.r(float(lat), 4) if lat not in (None, "") else None,
                       "lon": c.r(float(lon), 4) if lon not in (None, "") else None,
                       "origem_coordenada": origem_c,
                       "energia_nao_gerada_mwh": c.r(eng, 1), "geracao_verificada_mwh": c.r(x.get("ger"), 1),
                       "taxa_pct": c.r(_div(100 * eng, x.get("ger", 0.0) + eng), 2), "razao_principal": raz_p})
    usinas.sort(key=lambda u: -u["energia_nao_gerada_mwh"])
    n_pub = USINAS_GOLD_RESTRICAO.get(k, 60)
    tot_u = sum(u["energia_nao_gerada_mwh"] for u in usinas)
    resumo_usinas = {"usinas_com_restricao": len(usinas), "publicadas": min(len(usinas), n_pub),
                     "cobertura_da_energia_pct": c.r(100 * sum(u["energia_nao_gerada_mwh"] for u in usinas[:n_pub]) / tot_u, 2) if tot_u else None,
                     "com_coordenadas": sum(1 for u in usinas[:n_pub] if u["lat"] is not None),
                     "coordenadas_por_origem": dict(Counter(u["origem_coordenada"] or "sem_coordenada" for u in usinas[:n_pub])),
                     "lista_completa": CSV["restricao_usina"]}
    # causas detalhadas (texto do ONS) no último mês completo
    desc = None
    if completos:
        reg = cad.get(f"desc|{completos[-1]}", {})
        if reg.get("top"):
            desc = {"mes": completos[-1], "n_descricoes": int(float(reg.get("n_descricoes") or 0)),
                    "itens": [{"descricao": d_, "mwh": c.r(e_, 1)} for d_, e_ in json.loads(reg["top"])[:10]]}
    # diário recente (90 dias) no SIN
    rec = dias[-60:]
    eng_dia = defaultdict(float)
    for (d, sm, raz, orig, med), v in raz_dia.items():
        if med == "e" and d in set(rec):
            eng_dia[(d, raz)] += v
    diario = {"dias": rec, "energia_nao_gerada_mwh": {raz: [c.r(eng_dia.get((d, raz), 0.0), 1) for d in rec] for raz in RAZOES},
              "geracao_verificada_mwh": [c.r(sum(sm_dia[(d, sm)].get("g", 0.0) for sm in SM if (d, sm) in sm_dia), 1) for d in rec],
              "potencia_max_cortada_mw": [c.r(pot.get((d, "SIN")), 1) if (d, "SIN") in pot else 0.0 for d in rec]}
    # campo GNRa publicado pelo ONS × regra aplicada aqui
    gn_meses = [m for m in meses if por_mes[(m, "SIN")].get("gnra")]
    dif_gnra = max((abs(por_mes[(m, "SIN")]["gnra"] - por_mes[(m, "SIN")]["gnra_eng"]) for m in gn_meses), default=None)
    detalhe = bloco_detalhe(con, k_det, usina)
    rels = relatorios(con, ds)
    ctrl = {"linhas": sum((r_ or {}).get("linhas", 0) for r_ in rels.values()),
            "valores_negativos_na_fonte": sum((r_ or {}).get("negativos", 0) for r_ in rels.values()),
            "limitadas_sem_referencia": int(sum(x.get("lsr", 0.0) for (m, rg), x in por_mes.items() if rg == "SIN")),
            "razao_fora_do_dominio": sum((r_ or {}).get("razao_desconhecida", 0) for r_ in rels.values()),
            "gnra_divergente_da_regra": sum((r_ or {}).get("gnra_diverge", 0) for r_ in rels.values()),
            "meias_horas_com_gnra": sum((r_ or {}).get("com_gnra", 0) for r_ in rels.values()),
            # corte simultâneo × soma das referências das mesmas linhas na meia hora: na importação,
            # todas as meias horas com corte (por subsistema); no silver, o maior corte de cada dia
            "meias_horas_com_corte": sum((r_ or {}).get("meias_com_corte", 0) for r_ in rels.values()),
            "meias_horas_corte_acima_da_referencia": sum((r_ or {}).get("meias_corte_acima_da_referencia", 0) for r_ in rels.values()),
            "arquivos_sem_controle_de_referencia": sum(1 for r_ in rels.values() if r_ is None or "meias_corte_acima_da_referencia" not in r_),
            "dias_maior_corte_acima_da_referencia": sum(1 for k_, v in pot.items() if k_ in pot_ref and v > pot_ref[k_] + 1e-6),
            "dias_maior_corte_sem_referencia": sum(1 for k_, v in pot.items() if v > 0 and k_ not in pot_ref)}
    return {
        "fonte": "eolica" if k == "coff_eolica" else "solar", "primeiro_mes": meses[0], "ultimo_mes_completo": completos[-1] if completos else None,
        "mensal_sin": mensal,
        "ultimos_12m": {"inicio": ult12[0], "fim": ult12[-1], "energia_nao_gerada_mwh": c.r(eng12, 1),
                        "geracao_verificada_mwh": c.r(ger12, 1), "taxa_pct": c.r(_div(100 * eng12, ger12 + eng12), 2),
                        "por_razao": por_razao, "por_subsistema": por_sm,
                        "potencia_max_cortada_mw": c.r(pmax[0], 1), "quando_potencia_max": quando,
                        "usinas_no_universo": universo, "usinas_com_restricao": len(usinas)} if ult12 else None,
        "usinas_12m": usinas[:n_pub],
        "usinas_12m_resumo": resumo_usinas,
        "descricoes_ultimo_mes": desc,
        "diario_recente": diario,
        "gnra": {"meses_com_campo": len(gn_meses), "primeiro_mes_com_campo": gn_meses[0] if gn_meses else None,
                 "maior_diferenca_mensal_mwh": c.r(dif_gnra, 3)},
        "detalhe": detalhe,
        "controles": ctrl,
        "_por_mes": por_mes, "_raz_dia": raz_dia, "_sm_dia": sm_dia, "_usina": usina, "_cad": cad, "_ult12": ult12, "_pot": pot,
    }


def bloco_detalhe(con, k, usina_principal):
    """Detalhamento por usina (três meses mais recentes): usinas individuais dentro dos
    conjuntos e conferência da soma das usinas com a geração do conjunto no arquivo principal."""
    ds = _ds(k)
    man = manifestos(con, ds)
    tudo = filtra_manifesto(vigentes(con, ds), man)
    if not tudo:
        return None
    det = defaultdict(dict)
    dc = defaultdict(float)
    for (serie, mes), v in tudo.items():
        p = serie.split("|", 1)
        if p[0] == "det":
            det[mes][p[1]] = v
        elif p[0] == "dc":
            dc[(mes, p[1])] = v
    out = []
    for mes in sorted(det):
        x = det[mes]
        soma_d = soma_p = 0.0
        n = 0
        for (m, conj), v in dc.items():
            if m != mes:
                continue
            g_p = usina_principal.get((mes, conj), {}).get("ger")
            if g_p is None:
                continue
            n += 1
            soma_d += v
            soma_p += g_p
        out.append({"mes": mes, "usinas": int(x.get("usinas", 0)), "conjuntos": int(x.get("conjuntos", 0)),
                    "geracao_verificada_mwh": c.r(x.get("ger"), 1), "geracao_estimada_mwh": c.r(x.get("est"), 1),
                    "meias_horas_restritas": int(x.get("meias_restritas", 0)),
                    "conferencia": {"conjuntos_e_usinas_comparados": n, "soma_detalhe_mwh": c.r(soma_d, 1),
                                    "soma_arquivo_principal_mwh": c.r(soma_p, 1),
                                    "diferenca_pct": c.r(100 * (soma_d - soma_p) / soma_p, 3) if soma_p else None}})
    return out


# ---------------------------------------------------------------- P024 capacidade e utilização

GRUPOS_CAP = ("hidraulica", "eolica", "solar_centralizada", "nuclear", "gas", "carvao", "oleo", "biomassa", "outros")
SIGA_PARA_CAT = {"Potencial hidráulico": "hidraulica", "Cinética do vento": "eolica", "Radiação solar": "solar_centralizada",
                 "Gás natural": "gas", "Petróleo": "oleo", "Carvão mineral": "carvao", "Urânio": "nuclear"}
SIGA_ORIGEM_PARA_CAT = {"Biomassa": "biomassa"}


def unidades_capacidade(con):
    """Unidades geradoras do retrato vigente (registros do silver), com potência numérica.
    `categoria` aqui é a do rótulo da própria unidade; a categoria publicada vem de
    categorias_das_unidades (a da usina na Geração por Usina)."""
    out = {}
    for cod, r_ in base.registros_como_estavam_em(con, _ds("capacidade")).items():
        try:
            p = float(r_.get("potencia_mw")) if r_.get("potencia_mw") not in (None, "") else None
        except ValueError:
            p = None
        u = dict(r_)
        u["_cod"] = cod
        u["potencia_mw"] = p
        u["categoria_propria"] = og.categoria(r_.get("tipo"), r_.get("combustivel"), "")
        u["categoria"] = u["categoria_propria"]
        out[cod] = u
    return out


def categorias_das_unidades(unidades, cad_u, cegs_gu, relacoes, dia):
    """Categoria publicada de cada unidade geradora = a categoria da usina na Geração por
    Usina, a mesma que entra no numerador do fator de capacidade:
    1. identificadores da Geração por Usina com o mesmo CEG (todos os CEGs que já publicaram);
    2. o mesmo pelo CEG sem versão;
    3. conjunto de usinas com relacionamento vigente no dia que contém o CEG;
    4. o rótulo da própria unidade;
    5. turbina a vapor de ciclo combinado sem par: a categoria das demais unidades do CEG.
    Sem isso, a unidade "Resíduo Ciclo Combinado" de uma usina a gás ia para "outros" no
    retrato e para o gás no denominador do fator de capacidade (Termorio, GNA II)."""
    cat_id = {ido: og.categoria(r_.get("tipo"), r_.get("comb"), r_.get("mod")) for ido, r_ in cad_u.items()
              if og.natureza_modalidade(r_.get("mod")) == "verificada"}
    por_ceg, por_base = defaultdict(Counter), defaultdict(Counter)
    for ceg, ids in cegs_gu.items():
        for i in ids:
            if i in cat_id:
                por_ceg[ceg][cat_id[i]] += 1
                por_base[og.ceg_base(ceg)][cat_id[i]] += 1
    conj_de = {}
    for r_ in relacoes:
        ini, fim = r_.get("dat_iniciorelacionamento"), r_.get("dat_fimrelacionamento")
        if ini and ini <= dia and (not fim or dia <= fim) and r_.get("id_ons_conjunto") in cat_id:
            conj_de[(r_.get("ceg") or "").strip()] = r_.get("id_ons_conjunto")
    irmas = defaultdict(Counter)
    for u in unidades.values():
        if u.get("categoria_propria") not in (None, "nao_mapeada") and u.get("potencia_mw"):
            irmas[(u.get("ceg") or "").strip()][u["categoria_propria"]] += u["potencia_mw"]
    out = {}
    for cod, u in unidades.items():
        ceg = (u.get("ceg") or "").strip()
        if ceg and por_ceg.get(ceg):
            out[cod] = (por_ceg[ceg].most_common(1)[0][0], "geracao_por_usina")
        elif ceg and por_base.get(og.ceg_base(ceg)):
            out[cod] = (por_base[og.ceg_base(ceg)].most_common(1)[0][0], "geracao_por_usina_ceg_base")
        elif ceg in conj_de:
            out[cod] = (cat_id[conj_de[ceg]], "conjunto")
        elif u.get("categoria_propria") not in (None, "nao_mapeada"):
            out[cod] = (u["categoria_propria"], "rotulo_da_unidade")
        elif og.norm(u.get("combustivel")) == og.COMBUSTIVEL_CICLO_COMBINADO and irmas.get(ceg):
            out[cod] = (irmas[ceg].most_common(1)[0][0], "demais_unidades_do_ceg")
        else:
            out[cod] = ("nao_mapeada", "nao_identificado")
    return out


def pareamento(cad_u, unidades, relacoes):
    """Para cada identificador da Geração por Usina, como achar as unidades da Capacidade
    Instalada: pelo CEG exato, pelo CEG sem versão, ou pelos CEGs das usinas do conjunto
    (relacionamento com vigência). Grupos de pequenas usinas e MMGD não têm capacidade no
    conjunto do ONS e ficam de fora (sem dupla contagem com a capacidade da MMGD)."""
    por_ceg, por_base = defaultdict(list), defaultdict(list)
    for u in unidades.values():
        ceg = (u.get("ceg") or "").strip()
        if ceg:
            por_ceg[ceg].append(u)
            por_base[og.ceg_base(ceg)].append(u)
    rel_por_conj = defaultdict(list)
    for r_ in relacoes:
        rel_por_conj[r_.get("id_ons_conjunto")].append(r_)
    out = {}
    for ido, r_ in cad_u.items():
        nat = og.natureza_modalidade(r_.get("mod"))
        if nat != "verificada":
            out[ido] = {"casamento": "grupo_sem_capacidade", "unidades": None}
            continue
        ceg = og.ceg_valido(r_.get("ceg"))
        if ceg:
            if por_ceg.get(ceg):
                out[ido] = {"casamento": "ceg", "unidades": por_ceg[ceg]}
            elif por_base.get(og.ceg_base(ceg)):
                out[ido] = {"casamento": "ceg_base", "unidades": por_base[og.ceg_base(ceg)]}
            else:
                out[ido] = {"casamento": "sem_unidades", "unidades": None}
        elif rel_por_conj.get(ido):
            out[ido] = {"casamento": "conjunto", "relacoes": rel_por_conj[ido], "unidades": None}
        else:
            out[ido] = {"casamento": "sem_unidades", "unidades": None}
    return out, por_ceg, por_base


def unidades_no_mes(par, mes, por_ceg, por_base):
    if par["casamento"] in ("ceg", "ceg_base"):
        return par["unidades"]
    if par["casamento"] == "conjunto":
        dia = f"{mes}-15"
        us = []
        for r_ in par["relacoes"]:
            ini, fim = r_.get("dat_iniciorelacionamento"), r_.get("dat_fimrelacionamento")
            if ini and ini <= dia and (not fim or dia <= fim):
                ceg = (r_.get("ceg") or "").strip()
                us += por_ceg.get(ceg) or por_base.get(og.ceg_base(ceg)) or []
        return us
    return None


def mmgd_mensal(mensal_tr, matriz):
    """Potência de MMGD cadastrada na ANEEL ao fim de cada mês (acumulado do cadastro atual
    pela data de conexão, módulo Transição) ao lado da energia de MMGD estimada pelo ONS na
    Geração por Usina no mesmo mês. Dois produtos de natureza diferente, lado a lado, nunca
    somados à capacidade do ONS nem divididos um pelo outro: a estimativa do ONS usa
    previsão meteorológica e potência própria, não a deste cadastro."""
    if not mensal_tr or not matriz:
        return None
    ms = matriz["mensal_sin"]
    ger = {m: (v, d_ == n_) for m, v, d_, n_ in zip(ms["meses"], ms["solar_mmgd"], ms["dias_completos"], ms["dias_no_mes"])}
    cad = {x.get("m"): x for x in mensal_tr if x.get("m")}
    meses = [m for m in sorted(cad) if m in ger and m > INICIO_MMGD[:7] and ger[m][0] is not None]
    if not meses:
        return None
    return {"meses": meses,
            "potencia_cadastrada_mw": [c.r(cad[m].get("acumulado_mw"), 1) for m in meses],
            "cadastro_provisorio": [bool(cad[m].get("provisorio")) for m in meses],
            "geracao_estimada_ons_mwmed": [ger[m][0] for m in meses],
            "mes_completo_na_geracao": [ger[m][1] for m in meses],
            "regra": ("Potência: soma da potência das unidades do cadastro atual da ANEEL com conexão até o fim do mês (unidades "
                      "retiradas do cadastro não aparecem). Geração: categoria Solar MMGD da Geração por Usina (estimativa do ONS) "
                      "nos dias completos do mês, a partir do primeiro mês inteiro depois de 29/04/2023. Nada é somado à "
                      "capacidade do ONS, e a razão entre os dois não é publicada como fator de capacidade.")}


def siga_historico(con, unidades, primeiro_mes):
    """Capacidade em operação da ANEEL (série histórica por tipo de geração, base do SIGA)
    nas datas de referência publicadas, ao lado da potência do ONS em operação comercial no
    último dia do mesmo mês (unidades do retrato pela data de entrada e de desativação). Dois
    universos diferentes (a ANEEL inclui usinas não despachadas pelo ONS, sistemas isolados
    e autoprodução), lado a lado na mesma data; nada é somado. Térmicas juntas: a série da
    ANEEL não separa combustível."""
    obs = vigentes(con, ANEEL_HIST["ds"], "emp_op.kw.")
    if not obs:
        return None
    por_ref, fora = defaultdict(lambda: defaultdict(float)), Counter()
    for (serie, ref), kw in obs.items():
        t = serie.rsplit(".", 1)[1]
        g = TIPO_ANEEL_GRUPO.get(t)
        if g:
            por_ref[ref][g] += kw / 1000
        else:
            fora[t] += 1
    refs = sorted(r for r in por_ref if r >= primeiro_mes)
    if not refs:
        return None
    grupos = {}
    for g, cats in GRUPO_ONS_CATS.items():
        aneel, ons = [], []
        for ref in refs:
            dia = f"{ref}-{og.dias_do_mes(ref):02d}"
            aneel.append(c.r(por_ref[ref].get(g), 1) if g in por_ref[ref] else None)
            ons.append(c.r(sum(u["potencia_mw"] for u in unidades.values() if u.get("potencia_mw") and u.get("categoria") in cats
                               and og.unidade_opera_em(u, dia)), 1))
        grupos[g] = {"aneel_mw": aneel, "ons_mw": ons,
                     "ons_pct_da_aneel": [c.r(100 * o / a, 1) if a and o is not None else None for a, o in zip(aneel, ons)]}
    reg = base.registros_como_estavam_em(con, ANEEL_HIST["ds"]).get("arquivo", {})
    v = base.ultima_vintage(con, ANEEL_HIST["ds"], ANEEL_HIST["arquivo"])
    return {"datas": refs, "grupos": grupos, "data_geracao_arquivo": reg.get("data_geracao"),
            "capturado_em": v["capturado_em"] if v else None, "tipos_fora_dos_grupos": dict(fora),
            "fonte": f"ANEEL, {ANEEL_HIST['titulo']} ({ANEEL_HIST['arquivo']})",
            "regra": ("ANEEL: potência instalada em operação por tipo de geração na data de referência (UHE, PCH e CGH em "
                      "hidráulica; EOL; UFV; UTN; UTE em térmica). ONS: soma das unidades do retrato atual da Capacidade "
                      "Instalada em operação comercial no último dia do mês, pela categoria da usina. Universos diferentes, "
                      "lado a lado; ons_pct_da_aneel é a parcela da capacidade da ANEEL que o retrato do ONS cobre na data, "
                      "não fator de capacidade.")}


def bloco_capacidade(con, D_u, hoje, ctx, ok, matriz=None):
    unidades = unidades_capacidade(con)
    if not unidades:
        return None
    v_cap = base.ultima_vintage(con, _ds("capacidade"), "CAPACIDADE_GERACAO")
    data_retrato = ev._dia_brasilia(v_cap["capturado_em"]) if v_cap else hoje.isoformat()
    relacoes = list(base.registros_como_estavam_em(con, _ds("conjunto")).values())
    cad_u = D_u["cadastro"]
    cegs_gu = ceg_para_ids(D_u.get("historico_cadastro"), cad_u)
    for cod, (cat, origem) in categorias_das_unidades(unidades, cad_u, cegs_gu, relacoes, data_retrato).items():
        unidades[cod]["categoria"], unidades[cod]["origem_categoria"] = cat, origem
    par, por_ceg, por_base = pareamento(cad_u, unidades, relacoes)
    # retrato atual por categoria
    retrato = defaultdict(lambda: {"mw": 0.0, "unidades": 0, "usinas": set()})
    for u in unidades.values():
        if og.unidade_opera_em(u, data_retrato) and u.get("potencia_mw"):
            x = retrato[u["categoria"]]
            x["mw"] += u["potencia_mw"]
            x["unidades"] += 1
            x["usinas"].add(u.get("ceg"))
    total_mw = sum(x["mw"] for x in retrato.values())
    # meses completos da geração por usina
    dias_mes = Counter(d[:7] for d in ok)
    meses = [m for m in sorted(dias_mes) if dias_mes[m] == og.dias_do_mes(m)]
    ult12 = meses[-12:]
    # fator de capacidade por grupo de pareamento e mês (só pares com geração e potência).
    # Identificadores que levam às mesmas unidades formam um grupo: Itaipu 50 Hz e 60 Hz,
    # Belo Monte e Pimental, Simplício e Anta têm o mesmo CEG na Geração por Usina; a
    # potência entra uma vez e a geração dos identificadores é somada. Unidade já usada
    # por um grupo de CEG não entra de novo num conjunto do mesmo mês.
    u_mwh = {(s[2:], m): v for (s, m), v in D_u["u"].items()}
    u_h = {(s[3:], m): v for (s, m), v in D_u["un"].items()}
    meses_set = set(meses)
    por_cat = defaultdict(lambda: {"mwh_par": 0.0, "cap_h": 0.0, "mwh_todos": 0.0, "usinas_par": 0})
    casamentos = Counter()
    grupos = defaultdict(lambda: {"ids": [], "mwh": 0.0, "h": 0.0, "cat": Counter(), "nomes": []})
    for (ido, m), mwh in u_mwh.items():
        if m not in meses_set:
            continue
        r_ = cad_u.get(ido, {})
        if og.natureza_modalidade(r_.get("mod")) != "verificada":
            continue
        cat = og.categoria(r_.get("tipo"), r_.get("comb"), r_.get("mod"))
        por_cat[(m, cat)]["mwh_todos"] += mwh
        p = par.get(ido, {"casamento": "sem_cadastro"})
        casamentos[p["casamento"]] += 1
        if p["casamento"] == "ceg":
            k = "ceg:" + og.ceg_valido(r_.get("ceg"))
        elif p["casamento"] == "ceg_base":
            k = "base:" + og.ceg_base(og.ceg_valido(r_.get("ceg")))
        elif p["casamento"] == "conjunto":
            k = "cju:" + ido
        else:
            continue
        gm = grupos[(m, k)]
        gm["ids"].append(ido)
        gm["mwh"] += mwh
        gm["h"] = max(gm["h"], u_h.get((ido, m)) or 0)
        gm["cat"][cat] += mwh
        gm["nomes"].append(r_.get("nome") or ido)
    linhas_usina, acima = [], []
    fc12 = defaultdict(lambda: [0.0, 0.0, 0, 0.0])
    nomes_grupo, cat_grupo = {}, {}
    usadas = defaultdict(set)
    cat_usada = {}
    dup_evitadas = 0
    for (m, k) in sorted(grupos, key=lambda x: (x[0], not x[1].startswith(("ceg:", "base:")), x[1])):
        gm = grupos[(m, k)]
        p = par[gm["ids"][0]]
        us = unidades_no_mes(p, m, por_ceg, por_base) or []
        dup_evitadas += sum(1 for u in us if u["_cod"] in usadas[m])
        us = [u for u in {u["_cod"]: u for u in us}.values() if u["_cod"] not in usadas[m]]
        usadas[m].update(u["_cod"] for u in us)
        pot = og.potencia_operacional_media(us, m) if us else 0.0
        cat = gm["cat"].most_common(1)[0][0]
        for u in us:
            cat_usada[(m, u["_cod"])] = cat
        nome = " + ".join(sorted(set(n for n in gm["nomes"] if n)))
        nomes_grupo[k], cat_grupo[k] = nome, cat
        if pot <= 0 or gm["h"] <= 0:
            continue
        cap_h = pot * gm["h"]
        fc = 100 * gm["mwh"] / cap_h
        x = por_cat[(m, cat)]
        x["mwh_par"] += gm["mwh"]
        x["cap_h"] += cap_h
        x["usinas_par"] += 1
        if fc > FC_MAX_PLAUSIVEL:
            acima.append({"id": k, "nome": nome, "mes": m, "fc_pct": c.r(fc, 1), "potencia_mw": c.r(pot, 1), "categoria": cat})
        if m in ult12:
            a = fc12[k]
            a[0] += gm["mwh"]
            a[1] += cap_h
            a[2] += 1
            a[3] += pot
        if m >= (meses[-24] if len(meses) >= 24 else meses[0]):
            linhas_usina.append([m, k, "+".join(sorted(gm["ids"])), nome, cat, c.r(gm["mwh"], 3), int(gm["h"]), c.r(pot, 3), c.r(fc, 2), p["casamento"]])
    # potência operacional média do mês por categoria (todas as unidades do retrato). A
    # unidade usada por um grupo de pareamento no mês entra na categoria do grupo; as demais,
    # na categoria da usina (categorias_das_unidades): potência mostrada e denominador do
    # fator de capacidade usam a mesma classificação
    pot_cat = defaultdict(float)
    for u in unidades.values():
        if not u.get("potencia_mw") or not u.get("entrada_operacao"):
            continue
        for m in meses:
            if u["entrada_operacao"] > f"{m}-31" or (u.get("desativacao") and u["desativacao"] < f"{m}-01"):
                continue
            pot_cat[(m, cat_usada.get((m, u["_cod"]), u["categoria"]))] += og.potencia_operacional_media([u], m)
    # fator de capacidade do ONS (eólica e solar) para conferência
    fc_ons = defaultdict(lambda: [0.0, 0.0])
    ds_fc = _ds("fc")
    tudo_fc = filtra_manifesto(vigentes(con, ds_fc, "t"), manifestos(con, ds_fc))
    for (serie, m), v in tudo_fc.items():
        p_ = serie.split("|")
        cat = GRUPO_FC.get(p_[2])
        if not cat:
            continue
        if p_[0] == "tg":
            fc_ons[(m, cat)][0] += v
        elif p_[0] == "tc":
            fc_ons[(m, cat)][1] += v
    mensal = {"meses": meses,
              "potencia_operacional_mw": {cat: [c.r(pot_cat.get((m, cat)), 1) for m in meses] for cat in GRUPOS_CAP},
              "fator_capacidade_pct": {cat: [c.r(_div(100 * por_cat[(m, cat)]["mwh_par"], por_cat[(m, cat)]["cap_h"]), 2) for m in meses]
                                       for cat in GRUPOS_CAP},
              "fc_ons_pct": {cat: [c.r(_div(100 * fc_ons[(m, cat)][0], fc_ons[(m, cat)][1]), 2) if (m, cat) in fc_ons else None
                                   for m in meses] for cat in ("eolica", "solar_centralizada")}}
    # 12 meses por categoria e distribuição por usina (usinas com os 12 meses pareados)
    doze = []
    for cat in GRUPOS_CAP:
        mwh_p = sum(por_cat[(m, cat)]["mwh_par"] for m in ult12)
        cap_h = sum(por_cat[(m, cat)]["cap_h"] for m in ult12)
        tod = sum(por_cat[(m, cat)]["mwh_todos"] for m in ult12)
        ons_g = sum(fc_ons[(m, cat)][0] for m in ult12 if (m, cat) in fc_ons)
        ons_c = sum(fc_ons[(m, cat)][1] for m in ult12 if (m, cat) in fc_ons)
        fcs = []
        for k_, (mw_, ch_, n, pot_soma) in fc12.items():
            if n == len(ult12) and cat_grupo.get(k_) == cat:
                fcs.append((100 * mw_ / ch_, k_, nomes_grupo.get(k_), pot_soma / n))
        fcs.sort()
        bins = Counter(min(int(f_ // 10), 10) for f_, *_ in fcs)
        pot_h = sum(pot_cat.get((m, cat), 0.0) * 24 * og.dias_do_mes(m) for m in ult12)
        h12 = sum(24 * og.dias_do_mes(m) for m in ult12)
        doze.append({"categoria": cat, "rotulo": ROTULO_CAT[cat],
                     "potencia_atual_mw": c.r(retrato.get(cat, {}).get("mw"), 1),
                     # média dos 12 meses da potência em operação (todas as unidades da categoria): o
                     # denominador do fator de capacidade (só grupos pareados, horas com dado) não passa dela
                     "potencia_media_12m_mw": c.r(pot_h / h12, 1) if h12 else None,
                     "capacidade_hora_media_mw": c.r(cap_h / h12, 1) if h12 else None,
                     "geracao_pareada_mwh": c.r(mwh_p, 1), "capacidade_hora_mwh": c.r(cap_h, 1),
                     "fator_capacidade_pct": c.r(_div(100 * mwh_p, cap_h), 2),
                     "cobertura_pct": c.r(_div(100 * mwh_p, tod), 2),
                     "fc_ons_pct": c.r(_div(100 * ons_g, ons_c), 2) if ons_c else None,
                     "distribuicao_usinas": _quantis([f_ for f_, *_ in fcs]),
                     "histograma_10pp": [bins.get(i, 0) for i in range(11)],
                     "menores": [{"id": i, "nome": n_, "fc_pct": c.r(f_, 1), "potencia_media_mw": c.r(p_, 1)} for f_, i, n_, p_ in fcs[:5]],
                     "maiores": [{"id": i, "nome": n_, "fc_pct": c.r(f_, 1), "potencia_media_mw": c.r(p_, 1)} for f_, i, n_, p_ in fcs[-5:][::-1]]})
    # contexto regulatório: SIGA (módulo Expansão) e MMGD (módulo Transição), nunca somados
    golds = ctx.get("golds") or {}
    siga = None
    ci = ((golds.get("expansao.json") or {}).get("capacidade_instalada") or {})
    if ci.get("por_fonte"):
        siga_cat = defaultdict(float)
        nao_map = []
        for x in ci["por_fonte"]:
            cat = SIGA_PARA_CAT.get(x.get("fonte")) or SIGA_ORIGEM_PARA_CAT.get(x.get("origem"))
            if cat:
                siga_cat[cat] += x.get("mw_fiscalizado") or 0.0
            else:
                nao_map.append({"origem": x.get("origem"), "fonte": x.get("fonte"), "mw": x.get("mw_fiscalizado")})
                siga_cat["outros"] += x.get("mw_fiscalizado") or 0.0
        siga = {"data_referencia": ci.get("data_referencia"), "total_mw": (ci.get("total") or {}).get("mw_fiscalizado"),
                "por_categoria_mw": {k: c.r(v, 1) for k, v in siga_cat.items()}, "fontes_em_outros": nao_map,
                "fonte": "ANEEL, SIGA (capacidade fiscalizada em operação), como publicado em expansao.json"}
    if siga is not None:
        siga["serie_temporal"] = "contexto.siga_historico"
        siga["nota_temporal"] = (
            "O SIGA por usina e combustível é um retrato do dia (o portal da ANEEL não publica retratos anteriores, e a "
            "reconstituição pela data de entrada da usina atribuiria a potência atual inteira à data da primeira unidade). "
            "A correspondência temporal usa a série histórica oficial da ANEEL por tipo de geração (contexto.siga_historico), "
            "que não separa combustível.")
    mmgd = None
    tr = (golds.get("transicao.json") or {}).get("mmgd") or {}
    if (tr.get("resumo") or {}).get("potencia_mw") is not None:
        mmgd = {"potencia_mw": tr["resumo"]["potencia_mw"], "data_cadastro": tr.get("data_cadastro"),
                "fonte": "ANEEL, relação de empreendimentos de MMGD, como publicado em transicao.json"}
        mmgd["mensal"] = mmgd_mensal(tr.get("mensal") or [], matriz)
    return {
        "retrato": {"data": data_retrato, "total_mw": c.r(total_mw, 1),
                    "por_categoria": [{"categoria": cat, "rotulo": ROTULO_CAT[cat], "mw": c.r(retrato[cat]["mw"], 1),
                                       "unidades": retrato[cat]["unidades"], "usinas": len(retrato[cat]["usinas"]),
                                       "pct": c.r(100 * retrato[cat]["mw"] / total_mw, 2) if total_mw else None}
                                      for cat in GRUPOS_CAP if cat in retrato],
                    "nao_mapeadas_mw": c.r(sum(x["mw"] for k_, x in retrato.items() if k_ not in GRUPOS_CAP), 1),
                    "unidades_desativadas_no_retrato": sum(1 for u in unidades.values() if u.get("desativacao"))},
        "mensal": mensal,
        "ultimos_12m": {"inicio": ult12[0], "fim": ult12[-1], "por_categoria": doze} if ult12 else None,
        "pareamento": {"usina_meses_por_casamento": dict(casamentos), "unidades_repetidas_evitadas": dup_evitadas,
                       "fc_acima_de_100": {"n": len(acima), "ultimos_12m": sum(1 for x in acima if x["mes"] in ult12),
                                           "por_categoria": dict(Counter(x["categoria"] for x in acima)),
                                           "exemplos": sorted(acima, key=lambda x: -x["fc_pct"])[:15]},
                       "regra": ("Grupo de pareamento: identificadores da Geração por Usina com o mesmo CEG (ou CEG sem versão) "
                                 "somam a geração e usam as unidades uma vez; conjuntos usam as unidades das usinas com "
                                 "relacionamento vigente no dia 15 do mês. Unidade já atribuída a um grupo de CEG não entra num conjunto.")},
        "contexto": {"siga": siga, "siga_historico": siga_historico(con, unidades, meses[0] if meses else "2021-01"), "mmgd": mmgd},
        "_linhas_usina": linhas_usina, "_pot_cat": pot_cat, "_por_cat": por_cat, "_fc_ons": fc_ons, "_unidades": unidades,
    }


# ---------------------------------------------------------------- CSV de download

def _csv(ctx, nome, cab, linhas):
    """CSV de download; ctx["destino_csv"] desvia a escrita (testes e ensaios)."""
    return base.escreve_csv(nome, cab, linhas, destino=ctx.get("destino_csv"))


def escreve_csvs(ctx, D_u, cat_dia, horas, rotulos, cache, bal, matriz, termica, eol, sol, cap):
    nome = lambda url: url.rsplit("/", 1)[-1]  # noqa: E731
    dias = sorted({d for d, rg in horas if rg == "SIN"})
    linhas = []
    for d in dias:
        for rg in REGIOES:
            vals = [cat_dia.get((d, rg, cat)) for cat in CATS]
            if all(v is None for v in vals):
                continue
            tot = sum(v for v in vals if v is not None)
            mm = cat_dia.get((d, rg, "solar_mmgd")) or 0.0
            h_ = horas.get((d, rg))
            linhas.append([d, rg, int(h_) if h_ is not None else None] + [c.r(v, 3) for v in vals] + [c.r(tot, 3), c.r(tot - mm, 3)])
    _csv(ctx, nome(CSV["matriz_diaria"]), ["data", "regiao", "horas"] + CATS + ["total_mwh", "total_sem_mmgd_mwh"], linhas)
    hs = sorted({h for (_, h) in D_u["h"]})
    corte = (c.d(matriz["dia_referencia"]) - timedelta(days=365)).isoformat()
    hs = [h for h in hs if h[:10] > corte and h[:10] <= matriz["dia_referencia"]]
    _csv(ctx, nome(CSV["matriz_horaria"]), ["hora"] + CATS,
         [[h] + [c.r(D_u["h"].get((f"h|{cat}", h)), 3) for cat in CATS] for h in hs])
    anos = sorted({a for v in rotulos.values() for a in v})
    _csv(ctx, nome(CSV["rotulos"]), ["ano", "tipo_usina", "combustivel", "modalidade", "categoria", "natureza", "mwh"],
         [[a, ti, co, mo, cache[(ti, co, mo)][0], cache[(ti, co, mo)][1], c.r(v.get(a), 3)]
          for (ti, co, mo), v in sorted(rotulos.items()) for a in anos if a in v])
    a11 = []
    for d in dias:
        b = [bal.get((d, "solar", sm)) for sm in SM]
        bs = sum(x[0] for x in b) if all(x and x[1] == 24 for x in b) else None
        # sem linha do grupo MMGD (antes de 29/04/2023) a coluna fica vazia: ausência, não zero
        mm = cat_dia.get((d, "SIN", "solar_mmgd"))
        ce = cat_dia.get((d, "SIN", "solar_centralizada"))
        us_ = None if mm is None and ce is None else (mm or 0.0) + (ce or 0.0)
        a11.append([d, c.r(bs, 3), c.r(us_, 3), c.r(mm, 3), c.r(ce, 3),
                    c.r(bs - us_, 3) if bs is not None and us_ is not None else None])
    _csv(ctx, nome(CSV["a11"]), ["data", "balanco_solar_sin_mwh", "usinas_solar_mwh", "usinas_mmgd_mwh", "usinas_solar_sem_mmgd_mwh",
                                 "diferenca_mwh"], a11)
    _csv(ctx, nome(CSV["reconciliacao"]), ["mes", "fonte", "balanco_mwh", "usinas_mwh", "diferenca_mwh", "roraima_excluida_mwh",
                                           "diferenca_sem_roraima_mwh", "dias", "subsistema_dias", "subsistema_dias_conciliados"],
         [[x["mes"], x["fonte"], x["balanco_mwh"], x["usinas_mwh"], x["diferenca_mwh"], x["roraima_excluida_mwh"],
           x["diferenca_sem_roraima_mwh"], x["dias"], x["subsistema_dias"], x["subsistema_dias_conciliados"]]
          for x in matriz["reconciliacao_balanco"]["_mensal"]])
    if termica:
        hm = termica["_horas_mes"]
        dm = termica["_diario"]
        lin = []
        for mes in termica["_meses_todos"]:
            for rg in REGIOES:
                tot = dm.get((mes, rg, "total"))
                if tot is None:
                    continue
                partes = [dm.get((mes, rg, m)) for m in MOTIVOS]
                lin.append([mes, rg, hm.get(mes), c.r(tot, 3)] + [c.r(v, 3) for v in partes] +
                           [c.r(tot - sum(v for v in partes if v is not None), 3), c.r(dm.get((mes, rg, "constrained_off")), 3)])
        _csv(ctx, nome(CSV["termica_mensal"]), ["mes", "regiao", "horas", "total_mwh"] + [f"{m}_mwh" for m in MOTIVOS] +
             ["nao_classificado_mwh", "constrained_off_mwh"], lin)
        um = termica["_usina_mes"]
        chaves = sorted({(m, ch) for (m, ch, _) in um})
        lin = []
        for m, ch in chaves:
            vals = [um.get((m, ch, x)) for x in ["total"] + MOTIVOS + ["constrained_off"]]
            if not any(v for v in vals if v):
                continue
            r_ = termica["_cad"].get(ch, {})
            cb = termica["_comb"].get(ch, {})
            rep = termica["_ident"].get(ch, ch)
            lin.append([m, rep, (termica["_nome_id"].get(rep) or (None,))[0], ch, r_.get("nome"), r_.get("sm"), cb.get("rotulo"),
                        cb.get("categoria"), cb.get("origem")] + [c.r(v, 3) for v in vals])
        _csv(ctx, nome(CSV["termica_usina"]), ["mes", "usina", "nome_usina", "chave_fonte", "nome_na_fonte", "subsistema", "combustivel",
                                               "categoria", "origem_combustivel", "total_mwh"] + [f"{m}_mwh" for m in MOTIVOS] +
             ["constrained_off_mwh"], lin)
        cv = termica.get("cvu")
        if cv:
            lin = []
            for ini in sorted(cv["_por_sem"]):
                if ini < "2021-01-01":
                    continue
                info = cv["_reg"].get(f"sem|{ini}", {})
                for cod, v in sorted(cv["_por_sem"][ini].items()):
                    r_ = cv["_reg"].get(f"usi|{cod}", {})
                    ch = cv["_cod_ch"].get(cod)
                    cat = (termica["_comb"].get(ch) or {}).get("categoria", "nao_mapeada") if ch else "nao_mapeada"
                    pmo = f"{info.get('ano_ref')}-{int(float(info['mes_ref'])):02d} rev {info.get('revisao')}" if info.get("mes_ref") else None
                    lin.append([ini, info.get("fim"), pmo, cod, r_.get("nome"), ch, r_.get("sm"), cat, c.r(v, 2)])
            _csv(ctx, nome(CSV["cvu"]), ["semana_inicio", "semana_fim", "pmo", "cod_usina", "usina", "usina_termica", "subsistema",
                                         "categoria", "cvu_rs_mwh"], lin)
    lin_d, lin_u = [], []
    for fonte, b in (("eolica", eol), ("solar", sol)):
        if not b:
            continue
        for (d, sm, raz, orig, med), v in sorted(b["_raz_dia"].items()):
            if med != "e":
                continue
            lin_d.append([d, fonte, sm, raz, orig, c.r(v, 3), c.r(b["_raz_dia"].get((d, sm, raz, orig, "a")), 3),
                          int(b["_raz_dia"].get((d, sm, raz, orig, "lm"), 0)), None, None, None])
        eng_tot = defaultdict(float)
        for (d, sm, raz, orig, med), v in b["_raz_dia"].items():
            if med == "e":
                eng_tot[(d, sm)] += v
        for (d, sm), x in sorted(b["_sm_dia"].items()):
            lin_d.append([d, fonte, sm, "TOTAL", "", c.r(eng_tot.get((d, sm), 0.0), 3), None, int(x.get("l", 0)), c.r(x.get("g"), 3),
                          int(x.get("m", 0)), c.r(b["_pot"].get((d, sm)), 3) if (d, sm) in b["_pot"] else 0.0])
        for (m, ido), x in sorted(b["_usina"].items()):
            r_ = b["_cad"].get(ido, {})
            lin_u.append([m, fonte, ido, r_.get("nome"), r_.get("sm"), r_.get("uf"), c.r(x.get("ger"), 3)] +
                         [c.r(x.get(f"eng_{r}", 0.0), 3) for r in RAZOES] + [int(x.get("meias", 0)), int(x.get("lim", 0))])
    _csv(ctx, nome(CSV["restricao_diaria"]), ["data", "fonte", "regiao", "razao", "origem", "energia_nao_gerada_mwh", "gnra_fonte_mwh",
                                              "meias_horas_limitadas", "geracao_verificada_mwh", "meias_horas",
                                              "potencia_max_cortada_mw"], lin_d)
    _csv(ctx, nome(CSV["restricao_usina"]), ["mes", "fonte", "id_ons", "nome", "subsistema", "uf", "geracao_verificada_mwh"] +
         [f"eng_{r}_mwh" for r in RAZOES] + ["meias_horas", "meias_horas_limitadas"], lin_u)
    if cap:
        us = cap["_unidades"]
        _csv(ctx, nome(CSV["capacidade_unidades"]), ["cod_equipamento", "usina", "ceg", "tipo", "combustivel", "categoria",
                                                     "origem_categoria", "modalidade", "subsistema", "uf", "potencia_mw", "entrada_teste",
                                                     "entrada_operacao", "desativacao"],
             [[cod, u.get("usina"), u.get("ceg"), u.get("tipo"), u.get("combustivel"), u.get("categoria"), u.get("origem_categoria"),
               u.get("modalidade"), u.get("sm"), u.get("uf"), u.get("potencia_mw"), u.get("entrada_teste"), u.get("entrada_operacao"),
               u.get("desativacao")]
              for cod, u in sorted(us.items())])
        _csv(ctx, nome(CSV["capacidade_usina"]), ["mes", "grupo", "identificadores", "nome", "categoria", "geracao_mwh", "horas_com_valor",
                                                  "potencia_operacional_mw", "fator_capacidade_pct", "casamento"],
             sorted(cap["_linhas_usina"], key=lambda x: (x[0], x[1])))
        lin = []
        for m in cap["mensal"]["meses"]:
            for cat in GRUPOS_CAP:
                x = cap["_por_cat"].get((m, cat)) or {}
                fo = cap["_fc_ons"].get((m, cat))
                lin.append([m, cat, c.r(cap["_pot_cat"].get((m, cat)), 3), c.r(x.get("mwh_par"), 3), c.r(x.get("cap_h"), 3),
                            c.r(_div(100 * x.get("mwh_par", 0.0), x.get("cap_h")), 3), c.r(_div(100 * x.get("mwh_par", 0.0), x.get("mwh_todos")), 3),
                            c.r(_div(100 * fo[0], fo[1]), 3) if fo else None])
        _csv(ctx, nome(CSV["capacidade_fonte"]), ["mes", "categoria", "potencia_operacional_mw", "geracao_pareada_mwh",
                                                  "capacidade_hora_pareada_mwh", "fator_capacidade_pct", "cobertura_pct", "fc_ons_pct"], lin)


# ---------------------------------------------------------------- proveniência, evidências e controles

LIMITACOES_USINA = [
    "Os grupos de pequenas usinas Tipo III e de MMGD são previsões e estimativas do ONS, não medição; a natureza de cada parcela é publicada separadamente.",
    "Desde 29/04/2023 a Geração por Usina inclui a estimativa de MMGD (fotovoltaica); comparações que atravessam a data usam o perímetro sem MMGD.",
    "O tipo da usina define a fonte (como no Balanço): conjuntos híbridos rotulados com combustível fotovoltaico dentro de usinas eólicas contam como eólica.",
    "Os grupos térmicos Tipo III ('Outras Multi-Combustível') não têm combustível identificado na fonte e ficam numa categoria própria, explícita; a categoria Biomassa cobre só as usinas com combustível declarado.",
    "A categoria 'outras térmicas' segue o rótulo 'Resíduos Industriais' do ONS, que reúne gases de siderurgia (CEG UTE.CM, carvão mineral na ANEEL), licor negro de celulose (CEG UTE.FL, biomassa florestal na ANEEL) e resíduos de petróleo (UTE.PE): comparada ao SIGA, a biomassa daqui fica menor e 'outras' maior. A parcela de cada código está em matriz.outros_por_ceg.",
    "Mudanças de universo na fonte (rótulos que aparecem, deixam de ter valor ou somem, saltos no número de usinas com dado, identificadores vazios ou que deixam de constar do arquivo, sequências longas de zero exato) estão em 'quebras' e em matriz.universo; cada janela, mês e ano leva em ressalvas_universo as categorias afetadas, e a variação de 12 meses dessas categorias é suprimida.",
    "Natureza mista: o total soma geração verificada (medição), previsões do ONS para grupos Tipo III e estimativa do ONS para a MMGD; a fração de cada natureza sai em natureza_pct de cada janela e ano e em natureza_mensal_sin.",
    "Dados em processo de consistência recorrente do ONS, sujeitos a revisão; revisões entre capturas são detectadas e publicadas.",
]


def _prov(con, k, *, indicador, natureza, recurso, unidade, frequencia, periodo, cobertura, transformacoes, formula, limitacoes, download):
    snap = c.snapshot_de(con, _ds(k))
    meta = ckan.meta_local(_ds(k))
    return c.proveniencia(indicador=indicador, natureza=natureza, fonte=_fonte(k, recurso), unidade=unidade, frequencia=frequencia,
                          periodo=periodo, cobertura=cobertura, capturado_em=c.ultima_captura(snap), snapshot=snap,
                          transformacoes=transformacoes, formula=formula, limitacoes=limitacoes, download=download,
                          notas_fonte=(meta.get("notas") or None))


def _rev(con, k):
    return ev.texto_revisoes(c.revisoes_do_dataset(con, _ds(k)))


def evidencias(con, matriz, a11, termica, eol, sol, cap, rec):
    out = {}
    d_ref = matriz["dia_referencia"]
    m30 = matriz["_janelas"]["SIN"]["30d"]
    arq30 = _arquivos(con, _ds("usina"), _periodos_arquivo(sorted({m30["inicio"][:7], m30["fim"][:7]})))
    teste_comp = ev.teste("Participações somam 100% no perímetro com MMGD", "aprovado" if abs(sum(m30["participacao"][k] or 0 for k in CATS) - 100) < 0.05 else "reprovado",
                          f"soma = {_n(sum(m30['participacao'][k] or 0 for k in CATS), 2)}%")
    pf = matriz["reconciliacao_balanco"]["por_fonte"]
    conc = sum(x["conciliados"] for x in pf.values())
    tot_sd = sum(x["subsistema_dias"] for x in pf.values())
    rec_txt = ev.reconciliacao(
        f"Soma das usinas por tipo comparada ao Balanço de Energia nos Subsistemas, por subsistema e dia: {conc} de {tot_sd} "
        f"subsistema-dias conciliados desde {c.data_br(matriz['primeiro_dia'])}, depois de descontar as térmicas de Roraima nos dias em que o balanço as exclui.",
        "aprovado" if tot_sd and conc / tot_sd >= 0.95 else "ressalva", f"{_n(TOL_DIA_MWH)} MWh por subsistema, fonte e dia")
    tot_mwh = m30["_tot"]
    for cat in ("total", "eolica", "solar_mmgd", "gas"):
        if cat == "total":
            out["matriz_30d_total"] = _evidencia(
                indicador="Geração do SIN nos últimos 30 dias (todas as categorias, com MMGD)", valor_exibido=f"{_n(m30['total_mwmed'])} MWmed",
                valor=tot_mwh / m30["horas"], unidade="MWmed", periodo={"inicio": m30["inicio"], "fim": m30["fim"]}, entidade="SIN",
                universo="usinas, conjuntos e grupos de pequenas usinas da Geração por Usina do ONS", fonte_k="usina", arquivos=arq30,
                consulta=f"séries d|<subsistema>|<tipo>|<combustível>|<modalidade> de {m30['inicio']} a {m30['fim']} no silver ons_geracao",
                formula="MWmed = Σ energia horária das usinas (MWh) ÷ horas dos dias completos", numerador={"descricao": "energia no período (MWh)", "valor": tot_mwh},
                denominador={"descricao": "horas dos dias completos", "valor": m30["horas"]},
                cobertura=f"{m30['dias']} dias completos de 30", tratamento_ausencia="dia sem as 24 horas em todos os subsistemas fica fora do numerador e do denominador",
                revisoes=_rev(con, "usina"), testes=[teste_comp], reconciliacao=rec_txt,
                download=[{"rotulo": "Matriz diária por categoria (CSV)", "url": CSV["matriz_diaria"]}])
            continue
        v = m30["_mwh"][cat]
        out[f"matriz_30d_{cat}"] = _evidencia(
            indicador=f"Participação de {ROTULO_CAT[cat]} na geração do SIN, últimos 30 dias", valor_exibido=_pct(m30["participacao"][cat], 1),
            valor=100 * v / tot_mwh, unidade="% da geração (perímetro com MMGD)", periodo={"inicio": m30["inicio"], "fim": m30["fim"]},
            entidade="SIN", universo="usinas, conjuntos e grupos de pequenas usinas da Geração por Usina do ONS", fonte_k="usina", arquivos=arq30,
            consulta=f"categoria {cat}: rótulos da fonte mapeados em geracao_rotulos_fonte.csv",
            formula="participação = energia da categoria ÷ energia de todas as categorias × 100",
            numerador={"descricao": f"energia de {ROTULO_CAT[cat]} (MWh)", "valor": v},
            denominador={"descricao": "energia de todas as categorias (MWh)", "valor": tot_mwh},
            cobertura=f"{m30['dias']} dias completos de 30",
            tratamento_ausencia="dia incompleto fica fora; categoria sem nenhuma linha no período fica nula (ausência) e não entra no total",
            revisoes=_rev(con, "usina"), testes=[teste_comp], reconciliacao=rec_txt,
            download=[{"rotulo": "Matriz diária por categoria (CSV)", "url": CSV["matriz_diaria"]}])
    # A11: MMGD no primeiro dia
    t0 = next((t for t in a11["tabela"] if t["d"] == a11["primeiro_dia_mmgd"]), None)
    if t0 and t0["usinas_mmgd_mwmed"] is not None:
        out["a11_mmgd_primeiro_dia"] = _evidencia(
            indicador="MMGD estimada pelo ONS no primeiro dia em que aparece na Geração por Usina", valor_exibido=f"{_n(t0['usinas_mmgd_mwmed'])} MWmed",
            valor=t0["usinas_mmgd_mwmed"], unidade="MWmed", periodo={"inicio": t0["d"], "fim": t0["d"]}, entidade="SIN",
            universo="grupos 'Pequenas Usinas (MMGD)' da Geração por Usina", fonte_k="usina",
            arquivos=_arquivos(con, _ds("usina"), {t0["d"][:7]}),
            consulta="séries d|<subsistema>|FOTOVOLTAICA|Fotovoltaica|Pequenas Usinas (MMGD) do dia",
            formula="MWmed = Σ energia horária dos grupos MMGD ÷ 24 h", cobertura="24 horas, quatro subsistemas",
            tratamento_ausencia="sem linha da modalidade antes de 29/04/2023: ausência, não zero",
            revisoes=_rev(con, "usina"),
            testes=[ev.teste("Primeiro dia com a modalidade MMGD", "aprovado" if a11["primeiro_dia_mmgd"] == INICIO_MMGD else "ressalva",
                             f"primeiro dia observado: {a11['primeiro_dia_mmgd']}")],
            reconciliacao=ev.reconciliacao(
                f"Solar do Balanço igual à soma das usinas fotovoltaicas com MMGD em {a11['dias_conciliados']} de {a11['dias_conferidos']} dias",
                "aprovado" if a11["dias_conferidos"] and a11["dias_conciliados"] / a11["dias_conferidos"] >= 0.95 else "ressalva",
                f"{_n(TOL_DIA_MWH)} MWh por subsistema e dia"),
            download=[{"rotulo": "Conferência diária da solar (CSV)", "url": CSV["a11"]}])
    if termica:
        u12 = termica["ultimos_12m"]
        arq = _arquivos(con, _ds("termica"), _periodos_arquivo(termica["_ult12"]))
        res_pct = u12["nao_classificado_pct"]
        teste_part = ev.teste("Partição por motivo fecha com a geração verificada", "aprovado" if res_pct is not None and abs(res_pct) <= 0.5 else "ressalva",
                              f"não classificado = {_n(res_pct, 3)}% do total")
        teste_univ = None
        uni = [x for x in termica["universo"]["mensal"] if x["mes"] in termica["_ult12"] and x["diferenca_pareadas_pct"] is not None]
        if uni:
            pior = max(abs(x["diferenca_pareadas_pct"]) for x in uni)
            teste_univ = ev.teste("Mesmas usinas (CEG) na Geração por Usina", "aprovado" if pior <= 1 else "ressalva",
                                  f"maior diferença mensal = {_n(pior, 3)}%")
        rec_t = ev.reconciliacao("Soma por usina pareada pelo CEG comparada à Geração por Usina, mês a mês",
                                 "aprovado" if teste_univ and teste_univ["resultado"] == "aprovado" else "ressalva", "1% da energia mensal das usinas pareadas")
        testes_t = [teste_part] + ([teste_univ] if teste_univ else [])
        out["termica_12m_total"] = _evidencia(
            indicador="Geração térmica despachada pelo ONS, últimos 12 meses completos", valor_exibido=f"{_n(u12['total_mwmed'])} MWmed",
            valor=u12["_tot"] / u12["horas"], unidade="MWmed", periodo={"inicio": u12["inicio"], "fim": u12["fim"]}, entidade="SIN",
            universo="térmicas e nucleares da Geração Térmica por Motivo de Despacho", fonte_k="termica", arquivos=arq,
            consulta="séries tu|<usina>|total dos meses do período", formula="MWmed = Σ geração verificada (MWh) ÷ horas dos meses",
            numerador={"descricao": "energia verificada (MWh)", "valor": u12["_tot"]}, denominador={"descricao": "horas", "valor": u12["horas"]},
            cobertura="12 meses completos", tratamento_ausencia="usina sem linha no mês não soma; vazio da fonte é ausência",
            revisoes=_rev(con, "termica"), testes=testes_t, reconciliacao=rec_t,
            download=[{"rotulo": "Térmica por usina e motivo (CSV)", "url": CSV["termica_usina"]}])
        for m in ("inflexibilidade",):
            v = u12["_motivos"].get(m) or 0.0
            out[f"termica_12m_{m}"] = _evidencia(
                indicador=f"Parcela da geração térmica por {ROTULO_MOTIVO[m].lower()}, últimos 12 meses completos",
                valor_exibido=_pct(100 * v / u12["_tot"] if u12["_tot"] else None, 1), valor=100 * v / u12["_tot"] if u12["_tot"] else None,
                unidade="% da geração térmica verificada", periodo={"inicio": u12["inicio"], "fim": u12["fim"]}, entidade="SIN",
                universo="térmicas e nucleares da Geração Térmica por Motivo de Despacho", fonte_k="termica", arquivos=arq,
                consulta=f"séries tu|<usina>|{m} e tu|<usina>|total", formula=f"parcela = Σ {dict((a, b) for a, b, _ in og.MOTIVOS)[m]} ÷ Σ val_verifgeracao × 100",
                numerador={"descricao": f"geração por {ROTULO_MOTIVO[m].lower()} (MWh)", "valor": v},
                denominador={"descricao": "geração verificada total (MWh)", "valor": u12["_tot"]},
                cobertura="12 meses completos", tratamento_ausencia="motivo sem coluna no período é 'não se aplica', não zero",
                revisoes=_rev(con, "termica"), testes=testes_t, reconciliacao=rec_t,
                download=[{"rotulo": "Térmica por motivo, mensal (CSV)", "url": CSV["termica_mensal"]}])
    for nome, b, k in (("eolica", eol, "coff_eolica"), ("solar", sol, "coff_solar")):
        if not b or not b.get("ultimos_12m"):
            continue
        u12 = b["ultimos_12m"]
        arq = _arquivos(con, _ds(k), _periodos_arquivo(b["_ult12"]))
        eng = sum(b["_por_mes"][(m, "SIN")].get("eng", 0.0) for m in b["_ult12"])
        ger = sum(b["_por_mes"][(m, "SIN")].get("ger", 0.0) for m in b["_ult12"])
        gn = b["gnra"]
        t_ = [ev.teste("Energia não gerada igual ao GNRa publicado pelo ONS", "aprovado" if b["controles"]["gnra_divergente_da_regra"] == 0 else "ressalva",
                       f"{b['controles']['gnra_divergente_da_regra']} meias horas divergentes em {b['controles']['meias_horas_com_gnra']} com o campo"),
              ev.teste("Meia hora limitada sem geração de referência", "aprovado" if b["controles"]["limitadas_sem_referencia"] == 0 else "ressalva",
                       f"{b['controles']['limitadas_sem_referencia']} meias horas (ficam fora da soma)")]
        rec_r = ev.reconciliacao(f"Regra aplicada (referência menos verificada nas meias horas limitadas) comparada ao campo GNRa do ONS em {gn['meses_com_campo']} meses",
                                 "aprovado" if b["controles"]["gnra_divergente_da_regra"] == 0 else "ressalva", "0,001 MWmed por meia hora")
        rot = "eólicas" if nome == "eolica" else "fotovoltaicas"
        comum_ev = dict(periodo={"inicio": u12["inicio"], "fim": u12["fim"]}, entidade="SIN",
                        universo=f"{u12['usinas_no_universo']} usinas e conjuntos {rot} Tipo I, II-B e II-C com linha no período", fonte_k=k,
                        arquivos=arq, cobertura="12 meses completos",
                        tratamento_ausencia="meia hora sem limitação não tem corte; limitada sem referência fica fora e é contada",
                        revisoes=_rev(con, k), testes=t_, reconciliacao=rec_r,
                        download=[{"rotulo": "Restrições por usina e mês (CSV)", "url": CSV["restricao_usina"]}])
        out[f"restricao_{nome}_12m_energia"] = _evidencia(
            indicador=f"Energia não gerada estimada por restrição de operação ({rot}), últimos 12 meses completos",
            valor_exibido=f"{_n(eng / 1000)} GWh", valor=eng, unidade="MWh", consulta="séries e|<subsistema>|<razão>|<origem> do período",
            formula="Σ max(geração de referência − geração verificada, 0) × 0,5 h nas meias horas com geração limitada pelo ONS", **comum_ev)
        out[f"restricao_{nome}_12m_taxa"] = _evidencia(
            indicador=f"Taxa de restrição ({rot}), últimos 12 meses completos", valor_exibido=_pct(u12["taxa_pct"], 1),
            valor=100 * eng / (ger + eng) if ger + eng else None, unidade="% da geração possível estimada",
            consulta="séries e|... e g|<subsistema> do período", formula="taxa = energia não gerada ÷ (geração verificada + energia não gerada) × 100",
            numerador={"descricao": "energia não gerada estimada (MWh)", "valor": eng},
            denominador={"descricao": "geração verificada + energia não gerada (MWh)", "valor": ger + eng}, **comum_ev)
    if cap and cap.get("ultimos_12m"):
        arq = _arquivos(con, _ds("usina"), _periodos_arquivo([m for m in cap["mensal"]["meses"][-12:]])) + \
            _arquivos(con, _ds("capacidade"))
        for x in cap["ultimos_12m"]["por_categoria"]:
            if x["categoria"] not in ("eolica", "solar_centralizada") or x["fator_capacidade_pct"] is None:
                continue
            testes_c = [ev.teste("Fator de capacidade mensal acima de 100% numa usina", "aprovado" if cap["pareamento"]["fc_acima_de_100"]["n"] == 0 else "ressalva",
                                 f"{cap['pareamento']['fc_acima_de_100']['n']} usina-meses em todas as categorias (ficam na conta)")]
            rec_c = None
            if x["fc_ons_pct"] is not None:
                dif = x["fator_capacidade_pct"] - x["fc_ons_pct"]
                rec_c = ev.reconciliacao(f"Fator de capacidade publicado pelo ONS no conjunto Fator de Capacidade: {_pct(x['fc_ons_pct'], 2)} (diferença de {_n(dif, 2)} ponto percentual)",
                                         "aprovado" if abs(dif) <= 2 else "ressalva", "2 pontos percentuais")
            out[f"capacidade_12m_fc_{x['categoria']}"] = _evidencia(
                indicador=f"Fator de capacidade de {ROTULO_CAT[x['categoria']]}, últimos 12 meses completos", valor_exibido=_pct(x["fator_capacidade_pct"], 1),
                valor=x["fator_capacidade_pct"], unidade="%", periodo={"inicio": cap["ultimos_12m"]["inicio"], "fim": cap["ultimos_12m"]["fim"]},
                entidade="SIN", universo="usinas e conjuntos despachados pareados com a Capacidade Instalada do ONS", fonte_k="usina", arquivos=arq,
                consulta="séries u|<usina> e un|<usina> com as unidades do mesmo CEG (ou das usinas do conjunto)",
                formula="FC = Σ geração (MWh) ÷ Σ (potência em operação comercial média do mês × horas com dado) × 100",
                numerador={"descricao": "geração das usinas pareadas (MWh)", "valor": x["geracao_pareada_mwh"]},
                denominador={"descricao": "capacidade-hora das mesmas usinas (MWh)", "valor": x["capacidade_hora_mwh"]},
                cobertura=f"{_pct(x['cobertura_pct'], 1)} da geração verificada da categoria", tratamento_ausencia="usina sem unidade pareada fica fora do numerador e do denominador",
                revisoes=_rev(con, "usina"), testes=testes_c, reconciliacao=rec_c,
                download=[{"rotulo": "Capacidade e fator de capacidade por fonte (CSV)", "url": CSV["capacidade_fonte"]}])
        r_ = cap["retrato"]
        out["capacidade_retrato_total"] = _evidencia(
            indicador="Potência instalada das usinas despachadas pelo ONS em operação comercial", valor_exibido=f"{_n(r_['total_mw'])} MW",
            valor=r_["total_mw"], unidade="MW", periodo={"inicio": r_["data"], "fim": r_["data"]}, entidade="SIN",
            universo="unidades geradoras de usinas Tipo I, II-A, II-B e II-C", fonte_k="capacidade", arquivos=_arquivos(con, _ds("capacidade")),
            consulta="unidades do retrato com entrada em operação comercial até a data e sem desativação",
            formula="Σ val_potenciaefetiva das unidades em operação", cobertura="retrato do dia da captura (o conjunto não tem histórico)",
            tratamento_ausencia="unidade sem data de entrada em operação comercial fica fora", revisoes=_rev(con, "capacidade"),
            testes=[teste_potencia(con)],
            reconciliacao=None, download=[{"rotulo": "Unidades geradoras (CSV)", "url": CSV["capacidade_unidades"]}])
    return out


def teste_potencia(con):
    """Potência positiva em todas as unidades: resultado lido do relatório gravado na
    importação do retrato (contagem `potencia_invalida`), não fixado aqui."""
    rels = [r_ for r_ in relatorios(con, _ds("capacidade")).values() if r_]
    if not rels:
        return ev.teste("Potência positiva em todas as unidades", "ressalva", "relatório da importação do retrato ausente")
    inval = sum(r_.get("potencia_invalida", 0) for r_ in rels)
    linhas = sum(r_.get("linhas", 0) for r_ in rels)
    return ev.teste("Potência positiva em todas as unidades", "aprovado" if inval == 0 else "ressalva",
                    f"{inval} de {linhas} unidades com potência nula ou não positiva na importação (o dicionário não admite)")


def controles(matriz, termica, eol, sol, cap, hoje):
    out = []
    dref = matriz["dia_referencia"]
    out.append(_controle_item("Dia de referência não futuro", "aprovado" if dref <= hoje.isoformat() else "reprovado", dref, critico=True))
    for rg, js in matriz["_janelas"].items():
        for nome, m in js.items():
            if not m:
                continue
            s_ = sum(v for v in m["participacao"].values() if v is not None)
            if abs(s_ - 100) > 0.05:
                out.append(_controle_item(f"Participações somam 100% ({rg}, {nome})", "reprovado", _n(s_, 3), critico=True))
            if any(v is not None and v < -1e-6 for v in m["_mwh"].values()):
                out.append(_controle_item(f"Energia não negativa por categoria ({rg}, {nome})", "reprovado",
                                          ", ".join(k for k, v in m["_mwh"].items() if v is not None and v < 0), critico=True))
    out.append(_controle_item("Participações somam 100% em todas as janelas e regiões", "aprovado", "tolerância 0,05 ponto percentual"))
    nm = matriz["nao_mapeadas"]
    out.append(_controle_item("Rótulos da fonte sem categoria", "aprovado" if not nm else "ressalva",
                              f"{len(nm)} combinações de tipo, combustível e modalidade" + (": " + "; ".join(f"{x['tipo']}/{x['combustivel']}/{x['modalidade']}" for x in nm[:5]) if nm else "")))
    pf = matriz["reconciliacao_balanco"]["por_fonte"]
    for f, x in pf.items():
        out.append(_controle_item(f"Reconciliação diária com o Balanço ({f})", "aprovado" if (x["pct_sin_dias_conciliados"] or 0) >= 95 else "ressalva",
                                  f"{x['sin_dias_conciliados']} de {x['sin_dias']} dias no SIN e {x['conciliados']} de {x['subsistema_dias']} "
                                  f"subsistema-dias dentro de {_n(TOL_DIA_MWH)} MWh"))
    if termica:
        out.append(_controle_item("Valores negativos na térmica por motivo (fonte)", "aprovado" if not termica["controles"]["valores_negativos_na_fonte"] else "ressalva",
                                  f"{termica['controles']['valores_negativos_na_fonte']} células negativas em motivos ou no total (mantidas como publicadas)"))
        mc = termica["mapa_combustivel"]
        nid = mc["nao_identificadas"]
        out.append(_controle_item("Térmicas sem combustível identificado", "aprovado" if not nid else "ressalva",
                                  f"{len(nid)} chaves da fonte, {_n(mc['nao_identificadas_pct_12m'], 3)}% da energia térmica dos 12 meses"
                                  + (": " + "; ".join(f"{x['id']} ({x['nome']})" for x in nid[:6]) if nid else "")))
        cv = termica.get("cvu")
        if cv:
            amb = cv["cobertura"]["codigos_ambiguos"]
            out.append(_controle_item("Código do CVU ligado a uma só usina da térmica por motivo", "aprovado" if not amb else "ressalva",
                                      f"{len(amb)} códigos ligados a mais de uma usina (ficam sem par); "
                                      f"{cv['cobertura']['pareadas_com_termica']} de {cv['cobertura']['usinas_com_cvu']} usinas do CVU pareadas"))
    for nome, b in (("eólica", eol), ("solar", sol)):
        if b:
            ct = b["controles"]
            out.append(_controle_item(f"GNRa do ONS igual à regra ({nome})", "aprovado" if ct["gnra_divergente_da_regra"] == 0 else "ressalva",
                                      f"{ct['gnra_divergente_da_regra']} divergências em {ct['meias_horas_com_gnra']} meias horas"))
            out.append(_controle_item(f"Razões dentro do domínio do dicionário ({nome})", "aprovado" if ct["razao_fora_do_dominio"] == 0 else "ressalva",
                                      f"{ct['razao_fora_do_dominio']} meias horas com razão fora de REL, CNF, ENE, PAR"))
            out.append(_controle_item(f"Valores negativos ({nome})", "aprovado" if ct["valores_negativos_na_fonte"] == 0 else "ressalva",
                                      f"{ct['valores_negativos_na_fonte']} células negativas na fonte (o dicionário não admite)"))
            viol = ct["meias_horas_corte_acima_da_referencia"] + ct["dias_maior_corte_acima_da_referencia"]
            out.append(_controle_item(f"Corte simultâneo não excede a soma das referências da meia hora ({nome})",
                                      "aprovado" if viol == 0 and ct["arquivos_sem_controle_de_referencia"] == 0 and ct["dias_maior_corte_sem_referencia"] == 0
                                      else "ressalva",
                                      f"{ct['meias_horas_corte_acima_da_referencia']} de {ct['meias_horas_com_corte']} meias horas com corte (por subsistema) "
                                      f"acima da soma das referências; {ct['dias_maior_corte_acima_da_referencia']} dias com o maior corte acima dela; "
                                      f"{ct['arquivos_sem_controle_de_referencia']} arquivos sem o controle"))
    if cap:
        n = cap["pareamento"]["fc_acima_de_100"]["n"]
        out.append(_controle_item("Fator de capacidade mensal acima de 100% numa usina", "aprovado" if n == 0 else "ressalva",
                                  f"{n} usina-meses; indicam potência cadastrada menor que a real no mês e não são descartados"))
        if cap.get("ultimos_12m"):
            # coerência entre a potência mostrada e o denominador do fator de capacidade: as
            # unidades pareadas são parte das unidades da categoria, então a capacidade-hora
            # média não pode passar da potência média (passaria com unidade classificada numa
            # categoria no retrato e em outra no fator de capacidade)
            inc = [x for x in cap["ultimos_12m"]["por_categoria"]
                   if x["capacidade_hora_media_mw"] is not None and x["potencia_media_12m_mw"] is not None
                   and x["capacidade_hora_media_mw"] > x["potencia_media_12m_mw"] + 0.05]
            out.append(_controle_item("Potência da categoria cobre o denominador do fator de capacidade", "aprovado" if not inc else "reprovado",
                                      "capacidade-hora média ≤ potência média em operação nos 12 meses, em todas as categorias" if not inc else
                                      "; ".join(f"{x['categoria']}: {_n(x['capacidade_hora_media_mw'], 1)} MW contra {_n(x['potencia_media_12m_mw'], 1)} MW" for x in inc),
                                      critico=True))
    uni = matriz["universo"]
    zr = uni["sequencias_zero_rotulo"]
    zi = uni["sequencias_zero_identificadores"]
    out.append(_controle_item("Sequências longas de zero exato depois de produção positiva", "aprovado" if not zr and not zi["n"] else "ressalva",
                              f"{len(zr)} rótulos com {ZERO_MESES_ROTULO} meses ou mais e {zi['n']} identificadores com {ZERO_MESES_ID} meses ou mais "
                              f"({zi['continuam_no_ultimo_mes']} até o último mês); rótulos e os {len(zi['lista'])} identificadores com sequência mais longa "
                              "em matriz.universo, nada excluído"))
    lac = uni.get("lacuna_ultimo_mes")
    if lac:
        out.append(_controle_item("Identificadores sem valor ou sem linhas no último mês completo",
                                  "aprovado" if not lac["identificadores_sem_valor"] and not lac["identificadores_sem_linhas"] else "ressalva",
                                  f"{c.mes_br(lac['mes'])}: {lac['identificadores_sem_valor']} com linhas vazias e {lac['identificadores_sem_linhas']} "
                                  "que tiveram valor nos 12 meses anteriores e não constam do arquivo"))
    return out


def quebras(con, a11, matriz):
    """Quebras e mudanças de universo, em ordem de data, com a origem: FONTE quando a
    documentação do ONS declara a mudança (trecho citado), DADO quando só o dado a mostra
    (regra de detecção publicada em matriz.universo.regra)."""
    dic = base.registros_como_estavam_em(con, DS_DIC)
    notas_carga = (dic.get("pacote_carga-energia") or {}).get("notas")
    uni = matriz["universo"]
    out = []
    novos, fim_, sem_val = defaultdict(list), defaultdict(list), defaultdict(list)
    for x in uni["mudancas_de_rotulo"]:
        rot = f"{x['tipo']} / {x['combustivel']} / {x['modalidade'] or 'sem modalidade'}"
        if x["aparece_em"]:
            novos[x["aparece_em"]].append((rot, x["categoria"]))
        if x["ultimo_mes_com_linhas"]:
            fim_[x["ultimo_mes_com_linhas"]].append((rot, x["categoria"]))
        if x.get("ultimo_mes_com_valor"):
            sem_val[x["ultimo_mes_com_valor"]].append((rot, x["categoria"]))
    t_2021 = _trecho(notas_carga, "março/2021")
    for mes, rots in sorted(novos.items()):
        doc = t_2021 if mes == "2021-03" else (_trecho(notas_carga, "29/04/2023") if mes == INICIO_MMGD[:7] else None)
        out.append({"data": f"{mes}-01" if mes != INICIO_MMGD[:7] else (a11.get("primeiro_dia_mmgd") or f"{mes}-01"),
                    "tipo": "rotulo_novo", "origem": "FONTE" if doc else "DADO", "trecho_fonte": doc,
                    "categorias": sorted({c_ for _, c_ in rots}),
                    "descricao": "Passam a constar da Geração por Usina: " + "; ".join(r_ for r_, _ in rots) + "."})
    for mes, rots in sorted(fim_.items()):
        out.append({"data": f"{_mes_seguinte(mes)}-01", "tipo": "rotulo_encerrado", "origem": "DADO", "trecho_fonte": None,
                    "categorias": sorted({c_ for _, c_ in rots}),
                    "descricao": f"Deixam de ter linhas no arquivo depois de {c.mes_br(mes)}: " + "; ".join(r_ for r_, _ in rots) + "."})
    for mes, rots in sorted(sem_val.items()):
        out.append({"data": f"{_mes_seguinte(mes)}-01", "tipo": "rotulo_sem_valor", "origem": "DADO", "trecho_fonte": None,
                    "categorias": sorted({c_ for _, c_ in rots}),
                    "descricao": (f"Deixam de ter valor depois de {c.mes_br(mes)} (as linhas continuam no arquivo, todas vazias): "
                                  + "; ".join(r_ for r_, _ in rots) + ".")})
    # sequência de zero exato num rótulo vira quebra quando coincide com a saída das usinas
    # que produziam (mudança de universo); as demais (térmica sem despacho por meses) ficam
    # só na lista de controle em matriz.universo.sequencias_zero_rotulo
    for x in uni.get("sequencias_zero_rotulo") or []:
        if not x.get("identificadores_que_sairam"):
            continue
        rot = f"{x['tipo']} / {x['combustivel']} / {x['modalidade'] or 'sem modalidade'}"
        out.append({"data": f"{x['inicio']}-01", "tipo": "sequencia_zero", "origem": "DADO", "trecho_fonte": None,
                    "categorias": [x["categoria"]],
                    "descricao": (f"{rot}: todas as horas com valor são exatamente zero de {c.mes_br(x['inicio'])} a {c.mes_br(x['fim'])} "
                                  f"({x['meses']} meses), depois de {_n(x['mwh_mes_anterior'])} MWh em {c.mes_br(x['mes_anterior'])}. "
                                  f"Os {x['identificadores_que_sairam']} identificadores que produziam ({_n(x['mwh_mes_anterior_dos_que_sairam'])} MWh "
                                  f"em {c.mes_br(x['mes_anterior'])}) deixam de constar do arquivo, e os que restam publicam zero. "
                                  "A fonte não diz se as usinas pararam ou se o dado falta.")})
    rr = matriz["reconciliacao_balanco"]["roraima"]
    if rr.get("primeiro_dia_sem_exclusao_apos"):
        out.append({"data": rr["primeiro_dia_sem_exclusao_apos"], "tipo": "roraima", "origem": "DADO", "trecho_fonte": None,
                    "categorias": ["gas", "oleo", "biomassa"],
                    "descricao": (f"O Balanço de Energia deixa de excluir as térmicas de Roraima: até {c.data_br(rr['ultimo_dia_excluida'])} "
                                  "a térmica do Norte no balanço é igual à soma das usinas menos as de Roraima; a partir do dia seguinte, não.")})
    sv = uni["_sem_valor"]
    tot_sv = [sum(sv[k][i] for k in sv if k != "meses") for i in range(len(sv["meses"]))]
    for i, n_ in enumerate(tot_sv):
        if n_ >= 10 and (i == 0 or tot_sv[i - 1] < 10):
            out.append({"data": f"{sv['meses'][i]}-01", "tipo": "identificadores_sem_valor", "origem": "DADO", "trecho_fonte": None,
                        "categorias": sorted(k for k in sv if k != "meses" and sv[k][i]),
                        "descricao": (f"{n_} identificadores passam a vir com todas as horas vazias em {c.mes_br(sv['meses'][i])}: "
                                      "ausência na fonte, fora dos totais. Podem ser identificadores substituídos por outros ou "
                                      "usinas sem dado; a fonte não diz qual. Só a contagem de identificadores com valor "
                                      "(saltos de universo) suspende comparações.")})
    for x in uni["saltos_de_universo"]:
        out.append({"data": f"{x['mes']}-01", "tipo": "salto_de_universo", "origem": "DADO", "trecho_fonte": None, "categorias": [x["categoria"]],
                    "descricao": f"{ROTULO_CAT[x['categoria']]}: usinas com dado passam de {x['identificadores_antes']} para {x['identificadores_depois']} em {c.mes_br(x['mes'])}."})
    return sorted(out, key=lambda x: (x["data"], x["tipo"]))


def construir(con, ctx):
    hoje = ctx.get("hoje") or date.today()
    D_u = carrega_usina(con)
    if not D_u.get("d"):
        return c.stub(GOLD, "geração por usina ausente no silver da família ons_geracao")
    cat_dia, nat_dia, rotulos, horas, cache = matriz_diaria(D_u)
    ok = dias_completos(horas)
    if not ok:
        return c.stub(GOLD, "nenhum dia completo na geração por usina")
    con_p = ctx.get("con_principal")
    bal = balanco_diario(con_p, ok)
    rec = reconcilia_balanco(bal, usinas_por_grupo_balanco(D_u), roraima_termica(D_u), ok)
    matriz = bloco_matriz(con, D_u, cat_dia, nat_dia, rotulos, horas, cache, rec, ok, hoje)
    a11 = bloco_a11(con, D_u, cat_dia, horas, rec, ok, _mmgd_transicao(ctx.get("caminho_mmgd_transicao")))
    unidades = unidades_capacidade(con)
    termica = bloco_termica(con, D_u, unidades, hoje)
    fc_cad = base.registros_como_estavam_em(con, _ds("fc"))
    eol = bloco_restricao(con, "coff_eolica", "coff_eolica_det", fc_cad, hoje)
    sol = bloco_restricao(con, "coff_solar", "coff_solar_det", fc_cad, hoje)
    cap = bloco_capacidade(con, D_u, hoje, ctx, ok, matriz=matriz)
    ctrl = controles(matriz, termica, eol, sol, cap, hoje)
    criticos = [x for x in ctrl if x["critico"] and x["resultado"] == "reprovado"]
    if criticos:
        return c.stub(GOLD, "controle crítico reprovado: " + "; ".join(f"{x['nome']} ({x['detalhe']})" for x in criticos))
    escreve_csvs(ctx, D_u, cat_dia, horas, rotulos, cache, bal, matriz, termica, eol, sol, cap)
    evid = evidencias(con, matriz, a11, termica, eol, sol, cap, rec)
    dref = matriz["dia_referencia"]
    prov = {
        "matriz": _prov(con, "usina", indicador="Matriz efetiva por fonte e combustível", natureza="CALCULADO",
                        recurso="GERACAO_USINA-2_<ano ou ano_mês>.parquet (2021 em diante)", unidade="MWh, MWmed e % da geração",
                        frequencia="horária, agregada por dia, mês e janela", periodo={"inicio": matriz["primeiro_dia"], "fim": dref},
                        cobertura={"inicio": matriz["primeiro_dia"], "fim": dref},
                        transformacoes=["soma da geração horária por subsistema, rótulo de tipo, combustível e modalidade",
                                        "classificação dos rótulos em categorias por tabela explícita (pipeline/energia/fontes/ons_geracao.py)",
                                        "MWmed = MWh ÷ horas dos dias completos", "participação com e sem MMGD"],
                        formula="participação(c) = Σ MWh(c) ÷ Σ MWh(todas as categorias) × 100", limitacoes=LIMITACOES_USINA,
                        download=CSV["matriz_diaria"]),
        "a11": _prov(con, "usina", indicador="Quebra de 29/04/2023: MMGD na geração solar", natureza="CALCULADO",
                     recurso="GERACAO_USINA-2_2023_04.parquet e seguintes; Balanço de Energia nos Subsistemas (silver principal)",
                     unidade="MWh e MWmed", frequencia="diária", periodo={"inicio": matriz["primeiro_dia"], "fim": dref},
                     cobertura={"inicio": matriz["primeiro_dia"], "fim": dref},
                     transformacoes=["soma diária das usinas FOTOVOLTAICA com e sem a modalidade Pequenas Usinas (MMGD)",
                                     "diferença com a solar do Balanço por subsistema e dia"],
                     formula="diferença = solar do Balanço − Σ usinas fotovoltaicas (MWh por dia)",
                     limitacoes=["A MMGD da Geração por Usina é estimativa do ONS com base em previsão meteorológica; difere da MMGD da API de carga verificada, que é outro processo do ONS."],
                     download=CSV["a11"]),
    }
    if termica:
        prov["termica"] = _prov(con, "termica", indicador="Geração térmica por combustível e motivo de despacho", natureza="CALCULADO",
                                recurso="GERACAO_TERMICA_DESPACHO_<ano>.parquet (2013 a 2021) e GERACAO_TERMICA_DESPACHO-2_<ano_mês>.parquet (2022 em diante)",
                                unidade="MWh, MWmed e %", frequencia="horária, agregada por dia e mês",
                                periodo={"inicio": termica["primeiro_mes"], "fim": termica["ultimo_mes_completo"]},
                                cobertura={"inicio": termica["primeiro_mes"], "fim": termica["ultimo_mes_completo"]},
                                transformacoes=["soma da geração verificada por motivo, usina e mês",
                                                "partição sem dupla contagem: mérito acima da inflexibilidade + inflexibilidade + demais motivos",
                                                "combustível pela própria fonte ou pelo mesmo CEG na Geração por Usina e na Capacidade Instalada"],
                                formula="não classificado = geração verificada − Σ motivos da partição",
                                limitacoes=["O combustível só vem no próprio conjunto a partir de 2026; antes, é atribuído pelo CEG da usina em outros conjuntos do ONS.",
                                            "O motivo é a classificação do ONS; não é inferido do PLD nem do CMO.",
                                            "Constrained-off térmico é restrição de geração por ordem de mérito, não geração, e é publicado à parte.",
                                            "Há valores negativos em anos antigos da fonte (o dicionário não os admite): mantidos e contados nos controles."],
                                download=CSV["termica_mensal"])
        if termica.get("cvu"):
            cv = termica["cvu"]
            prov["cvu"] = _prov(con, "cvu", indicador="CVU das térmicas por semana operativa", natureza="OBSERVADO",
                                recurso="CVU_USINA_TERMICA_<ano>.parquet", unidade="R$/MWh", frequencia="semanal (semana operativa do PMO)",
                                periodo={"inicio": cv["semana"]["inicio"], "fim": cv["semana"]["fim"] or cv["semana"]["inicio"]},
                                cobertura={"inicio": "2005-01-01", "fim": cv["semana"]["fim"] or cv["semana"]["inicio"]},
                                transformacoes=["linhas repetidas idênticas contadas uma vez", "combustível pelo código da usina na térmica por motivo"],
                                formula=None,
                                limitacoes=["CVU considerado no PMO para a semana operativa; é custo declarado para despacho, não preço do combustível nem custo realizado.",
                                            "Usinas sem par na térmica por motivo ficam sem combustível identificado."],
                                download=CSV["cvu"])
    for nome, b, k in (("restricao_eolica", eol, "coff_eolica"), ("restricao_solar", sol, "coff_solar")):
        if b:
            # natureza ESTIMADO: a energia não gerada depende da geração de referência, que o
            # ONS estima (a métrica declara natureza_fonte ESTIMADO pelo mesmo motivo)
            prov[nome] = _prov(con, k, indicador="Energia não gerada por restrição de operação (constrained-off)", natureza="ESTIMADO",
                               recurso=CONJUNTOS[k]["prefixos"][0] + "<ano_mês>.parquet", unidade="MWh, MW e %",
                               frequencia="semi-horária, agregada por dia e mês",
                               periodo={"inicio": b["primeiro_mes"], "fim": b["ultimo_mes_completo"] or b["primeiro_mes"]},
                               cobertura={"inicio": b["primeiro_mes"], "fim": b["ultimo_mes_completo"] or b["primeiro_mes"]},
                               transformacoes=["energia não gerada = max(referência − verificada, 0) × 0,5 h só nas meias horas com geração limitada",
                                               "razão (REL, CNF, ENE, PAR) e origem (LOC, SIS) como o ONS classifica",
                                               "potência cortada simultânea = soma dos cortes das usinas na mesma meia hora (MW)"],
                               formula="taxa = energia não gerada ÷ (geração verificada + energia não gerada) × 100",
                               limitacoes=["A geração de referência é estimativa do ONS (RO-AO.BR.13); a energia não gerada é estimada, não medida.",
                                           "Restrição não é indisponibilidade da usina nem falta de vento ou sol: meia hora sem limitação do ONS não entra, mesmo com referência maior que a geração.",
                                           "Universo: usinas e conjuntos Tipo I, II-B e II-C; Tipo III e MMGD não constam desse registro, e eventual corte por outro mecanismo não entra na taxa.",
                                           "O ONS republica meses antigos (consistência recorrente); revisões entre capturas são detectadas."],
                               download=CSV["restricao_usina"])
    if cap:
        prov["capacidade"] = _prov(con, "capacidade", indicador="Capacidade instalada e fator de capacidade", natureza="CALCULADO",
                                   recurso="CAPACIDADE_GERACAO.parquet (retrato do dia) com GERACAO_USINA-2 e RELACIONAMENTO_USINA_CONJUNTO",
                                   unidade="MW e %", frequencia="mensal",
                                   periodo={"inicio": cap["mensal"]["meses"][0], "fim": cap["mensal"]["meses"][-1]},
                                   cobertura={"inicio": cap["mensal"]["meses"][0], "fim": cap["mensal"]["meses"][-1]},
                                   transformacoes=["potência em operação comercial média do mês pelas datas de entrada e desativação de cada unidade",
                                                   "pareamento usina a usina pelo CEG ou pelos CEGs das usinas do conjunto, com a vigência do relacionamento",
                                                   "fator de capacidade = geração ÷ (potência × horas com dado)"],
                                   formula="FC = Σ MWh ÷ Σ (MW em operação × horas) × 100",
                                   limitacoes=["O conjunto de capacidade do ONS não tem histórico: usinas que saíram do despacho centralizado não aparecem e a potência é a do ato atual da ANEEL (repotenciações antigas não são reconstituídas).",
                                               "Só usinas despachadas pelo ONS (Tipo I, II-A, II-B, II-C): a capacidade da MMGD e de Tipo III fica fora, e a geração estimada desses grupos também (sem dupla contagem).",
                                               "Geração em teste antes da operação comercial infla o fator de capacidade do mês de entrada; usina-meses acima de 100% são contados nos controles.",
                                               "A capacidade do SIGA (ANEEL) é contexto regulatório de outro universo e não é somada nem comparada usina a usina."],
                                   download=CSV["capacidade_fonte"])
    lista_quebras = quebras(con, a11, matriz)
    comp = matriz.get("comparacao_12m")
    if comp:
        # categoria com mudança de universo na fonte dentro das duas janelas não tem variação
        # comparável: o valor sai de variacao_pct e a razão fica registrada
        ini, fim_ = comp["anterior"]["inicio"], comp["atual"]["fim"]
        afetadas = defaultdict(list)
        for q in lista_quebras:
            if q["tipo"] == "salto_de_universo" and ini < q["data"] <= fim_:
                for cat in q["categorias"]:
                    afetadas[cat].append(q["data"])
        comp["variacao_suprimida"] = {}
        for cat, datas in afetadas.items():
            if cat in comp["variacao_pct"] and comp["variacao_pct"][cat] is not None:
                comp["variacao_suprimida"][cat] = {"motivo": "salto no número de usinas com dado na fonte dentro das janelas comparadas",
                                                   "datas": sorted(set(datas))}
                comp["variacao_pct"][cat] = None
        # total sem MMGD só nas categorias que têm variação publicada: com as suprimidas (mudança de universo na fonte), o
        # total muda por causa do cadastro de usinas e não da geração, e o sinal pode inverter
        cmp_ = [cat for cat in CATS if cat != "solar_mmgd" and cat not in comp["variacao_suprimida"]
                and comp["_mwmed_atual"][cat] is not None and comp["_mwmed_anterior"][cat] is not None]
        soma_at = sum(comp["_mwmed_atual"][cat] for cat in cmp_)
        soma_ant = sum(comp["_mwmed_anterior"][cat] for cat in cmp_)
        comp["variacao_total_comparavel_pct"] = c.r(100 * soma_at / soma_ant - 100, 1) if soma_ant > 0 else None
    gold = {
        **c.cabecalho(GOLD),
        "paineis": ["P021", "P022", "P023", "P024"],
        "dia_referencia": dref,
        "categorias": [{"id": k, "rotulo": r_, "termica": k in og.CATEGORIAS_TERMICAS} for k, r_ in og.CATEGORIAS],
        "naturezas": [{"id": k, "rotulo": ROTULO_NATUREZA[k]} for k in NATUREZAS],
        "razoes": [{"id": k, "rotulo": og.ROTULO_RAZAO[k]} for k in RAZOES],
        "regras": {
            "matriz": "Categoria pelo tipo da usina (como no Balanço); térmicas por combustível; MMGD e grupos Tipo III identificados pela modalidade. MWmed = MWh ÷ horas dos dias completos.",
            "participacao": "Participação = energia da categoria ÷ energia de todas as categorias no mesmo período e região. Perímetro sem MMGD: o mesmo cálculo sem a categoria Solar MMGD.",
            "comparacao": f"Comparações que atravessam {c.data_br(INICIO_MMGD)} usam o perímetro sem MMGD.",
            "termica": "Partição da geração verificada por motivo sem dupla contagem: mérito acima da inflexibilidade, inflexibilidade (pura e embutida), razão elétrica, garantia energética, GFOM, reposição de perdas, exportação, reserva de potência, substituição e unit commitment; o resto é 'não classificado', com sinal.",
            "restricao": "Energia não gerada estimada = referência menos verificada nas meias horas com geração limitada pelo ONS (GNRa). Taxa = energia não gerada ÷ (verificada + não gerada). Potência cortada = soma simultânea dos cortes numa meia hora (MW).",
            "capacidade": "Fator de capacidade = geração ÷ (potência em operação comercial média do mês × horas com dado), só em usinas pareadas com a Capacidade Instalada do ONS; nunca a capacidade final para todo o histórico.",
            "janelas": "Janelas diárias (7, 30 e 365 dias) terminam no último dia completo; os painéis mensais (térmica, restrições, capacidade) usam os últimos 12 meses completos de cada conjunto.",
        },
        "a11": a11,
        "quebras": lista_quebras,
        "matriz": _sem_privados({k: v for k, v in matriz.items() if not k.startswith("_")}),
        "termica": _sem_privados({k: v for k, v in termica.items()}) if termica else None,
        "restricoes": {"eolica": _sem_privados(eol) if eol else None, "solar": _sem_privados(sol) if sol else None},
        "capacidade": _sem_privados(cap) if cap else None,
        "controles": ctrl,
        "proveniencia": prov,
        "evidencias": evid,
        "fontes": fontes_publicadas(con),
        "downloads": [{"rotulo": r_, "url": CSV[k]} for k, r_ in (
            ("matriz_diaria", "Matriz diária por região e categoria (CSV)"), ("matriz_horaria", "Matriz horária do SIN, últimos 366 dias (CSV)"),
            ("rotulos", "Rótulos da fonte e categorias (CSV)"), ("a11", "Conferência diária da solar com o Balanço (CSV)"),
            ("reconciliacao", "Reconciliação mensal com o Balanço (CSV)"), ("termica_mensal", "Térmica por motivo, mensal (CSV)"),
            ("termica_usina", "Térmica por usina, combustível e motivo (CSV)"), ("cvu", "CVU semanal por usina (CSV)"),
            ("restricao_diaria", "Restrições por dia, razão e origem (CSV)"), ("restricao_usina", "Restrições por usina e mês (CSV)"),
            ("capacidade_unidades", "Unidades geradoras e datas (CSV)"), ("capacidade_usina", "Fator de capacidade por usina e mês (CSV)"),
            ("capacidade_fonte", "Capacidade e fator de capacidade por fonte (CSV)"))],
    }
    return gold


def fontes_publicadas(con):
    out = []
    for k, cfg in CONJUNTOS.items():
        vs = ckan.vintages_vigentes(con, cfg["ds"])
        periodos = sorted(p for p in (og.periodo_do_arquivo(r_ + ".parquet") for r_ in vs) if p)
        out.append({"id": k, "orgao": "ONS", "conjunto": cfg["titulo"], "url": _url(k), "licenca": c.LICENCA_ONS,
                    "arquivos": len(vs), "primeiro_periodo": periodos[0] if periodos else None,
                    "ultimo_periodo": periodos[-1] if periodos else None,
                    "ultima_captura": max((v["capturado_em"] for v in vs.values()), default=None),
                    "publicacao_mais_recente": max((v["publicado_em"] or "" for v in vs.values()), default="") or None})
    return out


if __name__ == "__main__":
    # Releitura do bronze sem rede (depois de subir VERSAO_IMPORTACAO), um conjunto por vez:
    #   python3 pipeline/energia/modulos/geracao_detalhe.py --reimportar termica coff_eolica coff_solar
    if len(sys.argv) > 2 and sys.argv[1] == "--reimportar":
        con_ = base.conecta_familia(FAMILIA)
        st_ = {"falhas": [], "importacoes": {}}
        for k_ in sys.argv[2:]:
            t0_ = time.time()
            importa_pendentes(con_, k_, {}, st_)
            print(f"[{k_}] {len(st_['importacoes'])} arquivos importados até agora, {time.time() - t0_:.0f} s", flush=True)
        con_.commit()
        con_.close()
        print(json.dumps({"falhas": st_["falhas"], "arquivos": len(st_["importacoes"])}, ensure_ascii=False))
