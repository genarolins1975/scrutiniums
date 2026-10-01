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
                     "Geração por Usina); usinas_mmgd_mwh; usinas_solar_sem_mmgd_mwh; diferenca_mwh = balanço − usinas."),
        CSV["reconciliacao"]: ("mes; fonte do balanço (hidraulica, termica com nuclear, eolica, solar); balanco_mwh; usinas_mwh; "
                               "diferenca_mwh; usinas_roraima_mwh (térmicas de Roraima na Geração por Usina); dias."),
        CSV["termica_mensal"]: ("mes; regiao; total_mwh (geração verificada); uma coluna por motivo em MWh (partição sem "
                                "dupla contagem); nao_classificado_mwh = total − soma dos motivos; constrained_off_mwh "
                                "(restrição, não geração); horas."),
        CSV["termica_usina"]: ("mes; usina (CEG ou código do ONS); nome; subsistema; combustivel (rótulo); categoria; "
                               "origem_combustivel; total_mwh e uma coluna por motivo em MWh. Só linhas com algum valor diferente de zero."),
        CSV["cvu"]: "semana_inicio; semana_fim; pmo (ano-mês de referência e revisão); cod_usina (código do ONS nos modelos); usina; subsistema; categoria; cvu_rs_mwh. De 2021 em diante.",
        CSV["restricao_diaria"]: ("data; fonte (eolica, solar); regiao; razao (REL, CNF, ENE, PAR, SEM); origem (LOC, SIS); "
                                  "energia_nao_gerada_mwh (estimada: referência − verificada nas meias horas limitadas); "
                                  "gnra_fonte_mwh (campo publicado pelo ONS, quando existe); meias_horas_limitadas; e, na linha "
                                  "razao = TOTAL, geracao_verificada_mwh, meias_horas e potencia_max_cortada_mw."),
        CSV["restricao_usina"]: ("mes; fonte; id_ons; nome; subsistema; uf; geracao_verificada_mwh; energia não gerada estimada "
                                 "por razão (eng_REL, eng_CNF, eng_ENE, eng_PAR, eng_SEM, em MWh); meias_horas; meias_horas_limitadas."),
        CSV["capacidade_unidades"]: ("cod_equipamento; usina; ceg; tipo; combustivel; categoria; modalidade; subsistema; uf; "
                                     "potencia_mw; entrada_teste; entrada_operacao; desativacao (retrato do dia da captura)."),
        CSV["capacidade_usina"]: ("mes; id_ons; nome; categoria; geracao_mwh; horas_com_valor; potencia_operacional_mw (média "
                                  "do mês pelas datas de entrada e desativação das unidades); fator_capacidade_pct; casamento "
                                  "(ceg, ceg_base, conjunto). Últimos 24 meses, só usinas pareadas."),
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
VERSAO_IMPORTACAO = {"ons_geracao_usina": 2}


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
    for dia, n in a["horas_dia"].items():
        obs.append(("tnh", dia, float(n)))
    manif.add("tnh")
    novas, revs = base.grava_observacoes(con, ds, v["vintage_id"], obs)
    regs = [(ch, campo, val) for ch, cad in a["cadastro"].items() for campo, val in cad.items() if val not in (None, "")]
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
    for (dia, sm), (mw, inst) in a["pot_max"].items():
        add(f"p|{sm}", dia, mw)
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
        # importação das vintages vigentes ainda não importadas (inclui as puladas)
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

def construir(con, ctx):
    return c.stub(GOLD, "gold em construção")
