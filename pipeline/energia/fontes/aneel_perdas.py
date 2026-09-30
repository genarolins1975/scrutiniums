"""Leitura e cálculo das perdas de energia na distribuição a partir das fontes da ANEEL e do IBGE.

Funções puras (sem rede e sem banco): recebem linhas já lidas do arquivo original e devolvem
estruturas simples. O módulo `pipeline/energia/modulos/perdas.py` cuida de coleta, silver e
gold; os testes (`pipeline/tests/test_energia_perdas.py`) exercitam estas funções com recortes
reais dos arquivos.

SAMP Balanço (ANEEL, dadosabertos.aneel.gov.br/dataset/samp-balanco), grão agente × mês,
valores em kWh. O dicionário oficial (dm-samp-balanco.pdf, versão 1.0 de 04/05/2023) lista
os campos mas não os domínios; os rótulos abaixo foram lidos do próprio arquivo (setembro de
2026) e conferidos contra a identidade do balanço:

    perdas medidas = energia injetada
                     − energia fornecida medida (cativo, consumo próprio, suprimento,
                       mercado livre, uso por outras distribuidoras)
                     − energia associada à cobrança por procedimento irregular (faturada)

    perdas não técnicas = perdas totais − perdas técnicas

Ex.: CEMIG-D, jun/2023: 4.586.352.923 − (2.204.773.465 + 2.207.037 + 1.930.724.152 +
27.499.275) − 15.750.000 = 405.398.994 kWh, exatamente a linha "Perdas Totais (valor medido)".
Quando a identidade não fecha, o resíduo é publicado (nunca escondido nem redistribuído).

A mesma grandeza aparece no arquivo em até três representações (linha "TOTAL", linha
"Total (todos os níveis de tensão)" do leiaute de 2024 e linhas por nível de tensão). Escolhe-se
a representação que concorda com a soma dos níveis publicada no mesmo mês; sem níveis, vale a
precedência leiaute novo > leiaute antigo. Em nov/2025 a Sulgipe publicou "Energia Injetada
Total" = 1 kWh na linha antiga e 55.284.970 kWh na nova (igual à soma dos níveis): a regra
escolhe a nova sem nenhum ajuste manual.
"""
import calendar
import collections
import csv
import io
import json

# ---------------------------------------------------------------- rótulos do SAMP Balanço
MOD_PERDA_MED = "Perdas na Distribuição (valor medido)"
MOD_PERDA_FAT = "Perdas na Distribuição (valor faturado)"
# Linha antiga "Perdas / Perdas Totais": aparece sozinha em alguns agentes e anos (CERAL Anitápolis de
# 2009 a 2023, CERR até 2016) e às vezes ao lado das linhas novas com o valor faturado (EAC,
# mar/2011) ou com um terceiro valor (CERR, jan/2011). A base não é identificável: fica em campo
# próprio, visível no CSV, e nunca entra na série medida.
MOD_PERDA_LEGADO = "Perdas"
CCT_TOTAIS = "Perdas Totais"
CCT_TECNICAS = "Perdas Técnicas"
CCT_NAO_TECNICAS = "Perdas Não-Técnicas"
DET_CALCULADA = "Energia Calculada (kWh)"
MOD_INJETADA = "Energia Injetada Total"
MEDIDA = "Energia Medida (kWh)"
FATURADA = "Energia Faturada (kWh)"
NIVEL = " - "
TODOS = "Total (todos os níveis de tensão)"
BT = "BT (Menor que 2,3 kV)"
IRREGULAR = "Energia associada à cobrança por procedimento irregular"

# Famílias de requisitos medidos que entram na energia fornecida: (modalidade, rótulo das
# linhas por nível / "Total (todos...)", rótulo da linha TOTAL do leiaute antigo). Suprimento e
# uso por outras distribuidoras mudaram de nome entre leiautes; os dois nomes são a mesma família.
FAMILIAS_FORNECIDA = (
    ("cativo", "Energia Vendida", ("Fornecimento - Cativo",), "Fornecimento - Cativo TOTAL"),
    ("consumo_proprio", "Energia Vendida", ("Fornecimento - consumo próprio",), "Fornecimento - consumo próprio TOTAL"),
    ("suprimento", "Energia Vendida", ("Suprimento (Sem CUSD associado)",), "Suprimento TOTAL"),
    ("mercado_livre", "Energia Entregue", ("Mercado Livre",), "Mercado Livre TOTAL"),
    ("uso_distribuidoras", "Energia Entregue", ("Uso Distribuição e Suprimento",), "Uso Distribuidoras TOTAL"),
)
# Requisitos antigos (até 2017/2023) que só aparecem sem nível: vendas por contrato e bombeamento.
OUTROS_REQUISITOS = {
    ("Energia Vendida", "Consumidor Livre"), ("Energia Vendida", "Contrato Bilateral"),
    ("Energia Vendida", "Contrato Inicial"), ("Energia Vendida", "Itaipu"), ("Bombeamento", "Consumo de Bombas"),
}
# Mercado de baixa tensão medido (denominador das perdas não técnicas, como a ANEEL passou a
# fazer em 2025 com o mercado medido): energia medida entregue a consumidores em BT, cativos,
# consumo próprio e livres. Suprimento e uso por distribuidoras não são consumo final. AS
# (subterrâneo) é subgrupo do grupo A e fica fora.
FAMILIAS_BT = (("Energia Vendida", "Fornecimento - Cativo"), ("Energia Vendida", "Fornecimento - consumo próprio"),
               ("Energia Entregue", "Mercado Livre"))
MMGD = "Energia Injetada na rede pela Micro e Mini Geração"


def _int(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return int(round(v))
    s = str(v).strip().strip('"')
    if not s:
        return None
    return int(round(float(s.replace(",", "."))))


def normaliza_linha(r):
    """Linha do SAMP Balanço (Parquet ou CSV oficial) → tupla canônica. O CSV traz tudo como
    texto; o Parquet traz CNPJ e ano/mês como inteiros. Rótulos com espaço sobrando no fim
    (o arquivo tem "…procedimento irregular ") são aparados."""
    return (
        str(r["NumCPFCNPJ"]).strip().zfill(14),
        int(r["AnoReferenciaBalanco"]), int(r["MesReferenciaBalanco"]),
        (r["DscModalidadeBalanco"] or "").strip(), (r["DscCctBalanco"] or "").strip(),
        (r["DscDetalheBalanco"] or "").strip(), _int(r["VlrEnergia"]),
        (r["NomAgente"] or "").strip(), (r["DscClassificacaoAgente"] or "").strip(),
    )


def linhas_parquet(caminho_ou_arquivo):
    """Itera as linhas do Parquet oficial como dicts (pyarrow, só as colunas usadas)."""
    import pyarrow.parquet as pq
    cols = ["NumCPFCNPJ", "NomAgente", "DscModalidadeBalanco", "DscCctBalanco", "DscClassificacaoAgente",
            "AnoReferenciaBalanco", "MesReferenciaBalanco", "DscDetalheBalanco", "VlrEnergia"]
    t = pq.read_table(caminho_ou_arquivo, columns=cols).to_pydict()
    for i in range(len(t["VlrEnergia"])):
        yield {c: t[c][i] for c in cols}


def linhas_csv(texto_ou_arquivo):
    """Itera as linhas do CSV oficial (UTF-8, ';', aspas)."""
    f = io.StringIO(texto_ou_arquivo) if isinstance(texto_ou_arquivo, str) else texto_ou_arquivo
    yield from csv.DictReader(f, delimiter=";")


def pivota(linhas):
    """Agrupa as linhas por (CNPJ, competência 'AAAA-MM').

    Retorna (meses, cadastro, duplicadas):
      meses[(cnpj, 'AAAA-MM')] = {(modalidade, característica, detalhe): kWh}
      cadastro[cnpj] = {"nomes": {nome: [primeira, última competência]}, "classificacoes": {...}}
      duplicadas = [(cnpj, comp, chave, valores)] quando a mesma chave aparece mais de uma vez
    Chave repetida fica com o primeiro valor lido e vai para a lista de duplicadas, que a gold
    publica: somar duas linhas que podem ser a mesma declaração dobraria a energia."""
    meses = collections.defaultdict(dict)
    cadastro = {}
    duplicadas = []
    for r in linhas:
        cnpj, ano, mes, mod, cct, det, v, nome, classe = normaliza_linha(r)
        if v is None:
            continue  # valor vazio é ausência, não zero
        comp = f"{ano:04d}-{mes:02d}"
        chave = (mod, cct, det)
        d = meses[(cnpj, comp)]
        if chave in d:
            duplicadas.append((cnpj, comp, chave, (d[chave], v)))
        else:
            d[chave] = v
        cad = cadastro.setdefault(cnpj, {"nomes": {}, "classificacoes": {}})
        for campo, valor in (("nomes", nome), ("classificacoes", classe)):
            if valor:
                ini_fim = cad[campo].setdefault(valor, [comp, comp])
                ini_fim[0] = min(ini_fim[0], comp)
                ini_fim[1] = max(ini_fim[1], comp)
    return dict(meses), cadastro, duplicadas


def _niveis(d, mod, cct, tipo=MEDIDA):
    pref = tipo + NIVEL
    return {det[len(pref):]: v for (m, c, det), v in d.items()
            if m == mod and c == cct and det.startswith(pref) and not det.endswith(TODOS)}


def _representacao(niveis, todos, total):
    """Escolhe entre as representações de uma mesma grandeza (ver docstring do módulo).
    Retorna (valor, rótulo da representação escolhida, conflito entre representações)."""
    soma = sum(niveis.values()) if niveis else None
    tol = max(1, len(niveis or ()))  # arredondamento de 1 kWh por linha
    conflito = todos is not None and total is not None and abs(todos - total) > tol
    if soma is not None:
        for valor, rotulo in ((todos, "todos"), (total, "total")):
            if valor is not None and abs(valor - soma) <= tol:
                return valor, rotulo + "=niveis", conflito
    if todos is not None:
        return todos, "todos", conflito
    if total is not None:
        return total, "total", conflito
    if soma is not None:
        return soma, "niveis", conflito
    return None, None, conflito


def _familia(d, mod, ccts, cct_total, tipo=MEDIDA):
    niveis, todos = {}, None
    for cct in ccts:
        niveis.update(_niveis(d, mod, cct, tipo))
        if todos is None:
            todos = d.get((mod, cct, f"{tipo}{NIVEL}{TODOS}"))
    total = d.get((mod, cct_total, tipo)) if cct_total else None
    return _representacao(niveis, todos, total)


def mes_balanco(d):
    """Grandezas de um agente num mês (kWh). Ausência fica None (nunca zero).

    Campos: injetada, injetada_repr, perdas_totais_med, perdas_tecnicas, pnt_med,
    perdas_totais_fat, pnt_fat, fornecida_med, fornecida_partes, outros_requisitos,
    irregular, bt_med, mmgd, residuo, conflitos."""
    out = {"conflitos": []}
    inj, rep, conf = _representacao(
        _niveis(d, MOD_INJETADA, "Energia Injetada"),
        d.get((MOD_INJETADA, "Energia Injetada", f"{MEDIDA}{NIVEL}{TODOS}")),
        d.get((MOD_INJETADA, MOD_INJETADA, MEDIDA)))
    out["injetada"], out["injetada_repr"] = inj, rep
    if conf:
        out["conflitos"].append("injetada")
    out["perdas_totais_med"] = d.get((MOD_PERDA_MED, CCT_TOTAIS, DET_CALCULADA))
    tec_med = d.get((MOD_PERDA_MED, CCT_TECNICAS, DET_CALCULADA))
    tec_fat = d.get((MOD_PERDA_FAT, CCT_TECNICAS, DET_CALCULADA))
    # a técnica é a mesma nas duas bases (é estimada, não depende do mercado); a medida tem
    # precedência e a faturada só preenche quando a medida não foi publicada
    out["perdas_tecnicas"] = tec_med if tec_med is not None else tec_fat
    out["pnt_med"] = d.get((MOD_PERDA_MED, CCT_NAO_TECNICAS, DET_CALCULADA))
    out["perdas_totais_fat"] = d.get((MOD_PERDA_FAT, CCT_TOTAIS, DET_CALCULADA))
    out["perdas_legado"] = d.get((MOD_PERDA_LEGADO, CCT_TOTAIS, DET_CALCULADA))
    out["pnt_fat"] = d.get((MOD_PERDA_FAT, CCT_NAO_TECNICAS, DET_CALCULADA))
    partes = {}
    for nome, mod, ccts, cct_total in FAMILIAS_FORNECIDA:
        v, _, conf = _familia(d, mod, ccts, cct_total)
        if v is not None:
            partes[nome] = v
        if conf:
            out["conflitos"].append(nome)
    out["fornecida_partes"] = partes
    out["fornecida_med"] = sum(partes.values()) if partes else None
    outros = [v for (m, c, det), v in d.items() if (m, c) in OUTROS_REQUISITOS]
    out["outros_requisitos"] = sum(outros) if outros else None
    irr, _, _ = _representacao(_niveis(d, "Energia Vendida", IRREGULAR, FATURADA),
                               d.get(("Energia Vendida", IRREGULAR, f"{FATURADA}{NIVEL}{TODOS}")), None)
    if irr is None:  # o arquivo grafa o nível BT desta linha sem o parêntese final
        sobra = [v for (m, c, det), v in d.items() if m == "Energia Vendida" and c == IRREGULAR]
        irr = sum(sobra) if sobra else None
    out["irregular"] = irr
    bts = [d.get((m, c, f"{MEDIDA}{NIVEL}{BT}")) for m, c in FAMILIAS_BT]
    bts = [v for v in bts if v is not None]
    out["bt_med"] = sum(bts) if bts else None
    mm, _, _ = _familia(d, "Geração Distribuída de Terceiros",
                        ("Energia Injetada na rede pela Micro e Mini Geração (Lei 14.300/2022)",),
                        "Energia Injetada na rede pela Micro e Mini Geração (REN 482/12) TOTAL")
    out["mmgd"] = mm
    out["n_linhas"] = len(d)
    return deriva_mes(out)


def deriva_mes(m):
    """Resíduo do balanço e energia injetada de referência (denominador das taxas).

    resíduo = injetada publicada − fornecida medida − outros requisitos − irregular − perdas totais

    Energia injetada de referência: a ANEEL define a energia injetada como "a energia elétrica
    inserida na rede de distribuição para atender aos consumidores, incluindo as perdas"
    (Relatório Perdas de Energia Elétrica na Distribuição, edição 2025/2024, p. 2). No leiaute
    antigo do SAMP (até 2023) a linha publicada é essa energia: o balanço fecha em 88% dos
    agentes-ano completos e, quando não fecha, a sobra está em linhas de fornecimento (COCEL,
    nov/2013: "Uso Distribuidoras" repete o mercado cativo). No leiaute da REN 1.003/2022
    (linhas "Total (todos os níveis de tensão)", a partir de 2024) a injetada publicada passou a
    ser bruta: nas distribuidoras com muita geração conectada à própria rede ela excede o que
    o cálculo de perdas da ANEEL usa (CEMIG-D 2025: 10% da injetada). Nesse leiaute o
    denominador é a energia implícita no próprio cálculo da fonte, fornecida + irregular +
    perdas totais; em 2024 ela soma 605,2 TWh nas concessionárias, dentro do intervalo
    [604,5; 606,8] TWh que decorre dos números publicados pela ANEEL para 2024 (44,6 TWh = 7,4%
    e 40,2 TWh = 6,6% da injetada), enquanto a injetada publicada soma 620,7 TWh. O resíduo
    não é atribuído a nenhuma causa."""
    inj, pt = m.get("injetada"), m.get("perdas_totais_med")
    forn = m.get("fornecida_med")
    if None not in (inj, pt) and forn is not None:
        m["residuo"] = inj - forn - (m.get("outros_requisitos") or 0) - (m.get("irregular") or 0) - pt
    else:
        m["residuo"] = None
    leiaute_novo = (m.get("injetada_repr") or "").startswith("todos")
    m["leiaute"] = "2024" if leiaute_novo else ("antigo" if m.get("injetada_repr") else None)
    if leiaute_novo and forn is not None and pt is not None:
        m["injetada_ref"] = forn + (m.get("outros_requisitos") or 0) + (m.get("irregular") or 0) + pt
        m["injetada_ref_origem"] = "requerida"
    else:
        m["injetada_ref"] = inj
        m["injetada_ref_origem"] = "publicada" if inj is not None else None
    return m


# ---------------------------------------------------------------- agregação anual
CAMPOS_SOMA = ("injetada", "injetada_ref", "perdas_totais_med", "perdas_tecnicas", "pnt_med", "perdas_totais_fat",
               "pnt_fat", "perdas_legado", "fornecida_med", "irregular", "bt_med", "mmgd", "residuo", "n_linhas")


def soma_completa(valores):
    """Soma só se todos os meses têm valor; um mês ausente torna a soma anual ausente
    (ausência não vira zero nem é completada)."""
    if not valores or any(v is None for v in valores):
        return None
    return sum(valores)


def anual(mensal, ano):
    """Agrega os meses de um agente num ano. `mensal` = {'AAAA-MM': mes_balanco(...)}.

    Retorna dict com as somas (kWh) de cada campo quando os meses presentes têm o campo em
    todos eles, a contagem de meses e o subconjunto com perdas técnicas/BT. Soma de um campo
    parcial (ex.: técnica publicada em só 7 dos 12 meses) é None e a contagem fica registrada."""
    meses = sorted(k for k in mensal if k.startswith(f"{ano:04d}-"))
    out = {"ano": ano, "meses": len(meses), "competencias": meses}
    for campo in CAMPOS_SOMA:
        vals = [mensal[m].get(campo) for m in meses]
        out[campo] = soma_completa(vals)
        out[f"meses_{campo}"] = sum(1 for v in vals if v is not None)
    out["residuo_abs_max_mes"] = max((abs(mensal[m]["residuo"]) for m in meses if mensal[m].get("residuo") is not None),
                                     default=None)
    out["representacoes"] = sorted({mensal[m].get("injetada_repr") or "ausente" for m in meses})
    out["leiautes"] = sorted({mensal[m].get("leiaute") or "ausente" for m in meses})
    out["meses_injetada_requerida"] = sum(1 for m in meses if mensal[m].get("injetada_ref_origem") == "requerida")
    out["conflitos"] = sorted({c for m in meses for c in mensal[m].get("conflitos", [])})
    return out


def taxa(num, den):
    """100 × num / den; None quando falta um dos dois ou o denominador não é positivo."""
    if num is None or den is None or den <= 0:
        return None
    return 100.0 * num / den


def estado_reconciliacao(a, tol_linhas=None):
    """Classifica o fechamento do balanço anual (injetada = fornecida + irregular + perdas).

    - "fecha": resíduo dentro do arredondamento de 1 kWh por linha do arquivo;
    - "residuo_pequeno": resíduo de até 0,1% da energia injetada, que não muda a taxa de perdas
      na primeira casa decimal (a precisão com que a ANEEL publica a taxa);
    - "residuo_relevante": acima disso (a perda publicada não é explicada pelos componentes
      publicados; a taxa continua sendo a da fonte, com o resíduo à vista);
    - "sem_componentes": faltam os requisitos medidos para refazer a conta."""
    if a.get("residuo") is None or a.get("injetada") in (None, 0):
        return "sem_componentes"
    tol = tol_linhas if tol_linhas is not None else (a.get("n_linhas") or 60 * max(1, a.get("meses", 12)))
    r = abs(a["residuo"])
    if r <= tol:
        return "fecha"
    if r <= 0.001 * abs(a["injetada"]):
        return "residuo_pequeno"
    return "residuo_relevante"


def eh_distribuidora(meses_do_agente):
    """Agente com balanço de distribuição: ao menos uma linha "Perdas na Distribuição" em algum
    mês. Geradoras e transmissoras que declararam no SAMP até 2016 (FURNAS, CESP, AXIA...) usam
    só a linha antiga "Perdas" para as próprias perdas e ficam fora do universo."""
    return any(k[0] in (MOD_PERDA_MED, MOD_PERDA_FAT) for d in meses_do_agente for k in d)


def tem_perda(d):
    return any(k[0] in (MOD_PERDA_MED, MOD_PERDA_FAT, MOD_PERDA_LEGADO) for k in d)


def validade_anual(a):
    """Limites físicos e de domínio de um agente-ano (seção 5.2 do contrato).

    Perda total anual negativa ou maior que a energia injetada é impossível fisicamente: indica
    defeito de publicação (mês faltando na injetada, linha trocada). O valor da fonte continua
    no CSV, com o alerta; não entra em agregados nem em comparações. Mês isolado negativo é
    normal (calendário de leitura) e não gera alerta."""
    alertas = []
    inj, pt = a.get("injetada_ref"), a.get("perdas_totais_med")
    if inj is not None and inj <= 0:
        alertas.append("injetada_nao_positiva")
    if inj and pt is not None:
        if pt < 0:
            alertas.append("perda_total_negativa")
        elif pt >= inj:
            alertas.append("perda_total_maior_que_injetada")
    if a.get("conflitos"):
        alertas.append("representacoes_conflitantes")
    return alertas


# ---------------------------------------------------------------- percentual técnico implícito
def segmentos_pt(mensal, casas=3, min_meses=2):
    """Trechos em que perdas técnicas ÷ energia injetada é constante (arredondado a `casas`
    decimais em %). Desde 2016 a ANEEL publica no SAMP a parcela técnica como o percentual
    regulatório aplicado à energia injetada: a razão fica fixa entre revisões tarifárias e o
    mês da troca mistura as duas taxas pró-rata dos dias (CEMIG-D, mai/2018: 27 dias a 7,840%
    e 4 dias a 8,766% dão 7,959%). Meses isolados (transição) não formam trecho.

    Retorna [{"inicio": 'AAAA-MM', "fim": 'AAAA-MM', "pct": float, "meses": n}]."""
    pontos = []
    for comp in sorted(mensal):
        m = mensal[comp]
        if m.get("perdas_tecnicas") is None or not m.get("injetada"):
            continue
        pontos.append((comp, round(100.0 * m["perdas_tecnicas"] / m["injetada"], casas)))
    seg = []
    for comp, pct in pontos:
        if seg and seg[-1]["pct"] == pct and _consecutivo(seg[-1]["fim"], comp):
            seg[-1]["fim"] = comp
            seg[-1]["meses"] += 1
        else:
            seg.append({"inicio": comp, "fim": comp, "pct": pct, "meses": 1})
    return [s for s in seg if s["meses"] >= min_meses]


def _consecutivo(a, b):
    ya, ma = int(a[:4]), int(a[5:7])
    yb, mb = int(b[:4]), int(b[5:7])
    return (yb * 12 + mb) - (ya * 12 + ma) == 1


def dia_inicio_prorata(pct_mes, pct_antes, pct_depois, ano, mes):
    """Dia do mês em que a nova taxa começou, reconstituído da média pró-rata publicada no mês
    de transição. None quando a conta não dá um dia inteiro plausível (tolerância de 0,3 dia)."""
    if pct_depois == pct_antes:
        return None
    dias = calendar.monthrange(ano, mes)[1]
    novos = dias * (pct_mes - pct_antes) / (pct_depois - pct_antes)
    n = round(novos)
    if not (0 < n < dias) or abs(novos - n) > 0.3:
        return None
    return dias - n + 1


# ---------------------------------------------------------------- componentes tarifárias
COMPONENTES_PERDAS = ("TUSD_PT", "TUSD_PNT", "TUSD_Per_RB_D", "TE_Per_RB")
COMPONENTES_TOTAL = ("TUSD", "TE")


def filtra_componentes_b1(linhas):
    """Linhas da tarifa residencial B1 convencional (subclasse Residencial, sem detalhe) das
    componentes tarifárias da ANEEL, nas bases Econômica e de Aplicação, só as componentes de
    perdas e os totais de TUSD e TE. Retorna {(cnpj, inicio, base): {...}}."""
    out = {}
    for r in linhas:
        if (r.get("DscSubGrupoTarifario") != "B1" or r.get("DscModalidadeTarifaria") != "Convencional"
                or r.get("DscSubClasseConsumidor") != "Residencial" or r.get("DscDetalheConsumidor") != "Não se aplica"
                or r.get("DscUnidade") != "R$/MWh"):
            continue
        base = r.get("DscBaseTarifaria")
        if base not in ("Base Econômica", "Tarifa de Aplicação"):
            continue
        comp = r.get("DscComponenteTarifario")
        if comp not in COMPONENTES_PERDAS + COMPONENTES_TOTAL:
            continue
        cnpj = str(r["NumCPFCNPJ"]).strip().zfill(14)
        ini, fim = str(r["DatInicioVigencia"])[:10], str(r["DatFimVigencia"])[:10]
        k = (cnpj, ini, base)
        e = out.setdefault(k, {"cnpj": cnpj, "inicio": ini, "fim": fim, "base": base,
                               "resolucao": (r.get("DscResolucaoHomologatoria") or "").strip(),
                               "sigla": (r.get("SigNomeAgente") or r.get("SigAgente") or "").strip(),
                               "valores": {}})
        v = r.get("VlrComponenteTarifario")
        if v is not None:
            e["valores"][comp] = float(v)
    return out


def linhas_componentes_parquet(caminho):
    import pyarrow.parquet as pq
    import pyarrow.compute as pc
    t = pq.read_table(caminho)
    filtro = pc.and_(pc.equal(t["DscSubGrupoTarifario"], "B1"), pc.equal(t["DscModalidadeTarifaria"], "Convencional"))
    t = t.filter(filtro)
    cols = t.column_names
    d = t.to_pydict()
    for i in range(t.num_rows):
        yield {c: d[c][i] for c in cols}


def resumo_tarifa(e):
    """Custo unitário das perdas embutido na tarifa B1 (R$/MWh) e participação no total TE+TUSD."""
    v = e["valores"]
    if not all(c in v for c in COMPONENTES_PERDAS + COMPONENTES_TOTAL):
        return None
    perdas = sum(v[c] for c in COMPONENTES_PERDAS)
    total = v["TUSD"] + v["TE"]
    return {
        "pt": v["TUSD_PT"], "pnt": v["TUSD_PNT"], "rede_basica": v["TUSD_Per_RB_D"] + v["TE_Per_RB"],
        "perdas": perdas, "tusd": v["TUSD"], "te": v["TE"], "total": total,
        "participacao_perdas_pct": taxa(perdas, total), "participacao_pnt_pct": taxa(v["TUSD_PNT"], total),
    }


# ---------------------------------------------------------------- relação município × distribuidora
def le_csv_texto(texto):
    return list(csv.DictReader(io.StringIO(texto), delimiter=";"))


def relacao_municipios(indqual, limites, ano):
    """Vínculos (cnpj, município) a partir de duas bases oficiais da ANEEL:

    - IndQual Município: conjunto elétrico de continuidade → municípios (código IBGE);
    - limites de continuidade do `ano`: conjunto → distribuidora (CNPJ).
    O conjunto é a unidade de ligação; nenhum vínculo é feito por nome. Retorna
    (vinculos {(cnpj, cod): {"conjuntos": set, "uf": str, "nome": str}}, siglas {cnpj: sigla},
    conjuntos_sem_municipio [ids])."""
    conj_mun = collections.defaultdict(list)
    for r in indqual:
        cid = str(r.get("IdeConjUnidConsumidoras") or r.get("IdeConjUndConsumidoras") or "").strip()
        cod = str(r.get("CodMunicipio") or "").strip()
        if cid and cod:
            conj_mun[cid].append((cod, (r.get("SigUF") or "").strip(), (r.get("NomMunicipio") or "").strip()))
    conj_cnpj, siglas = {}, {}
    for r in limites:
        if str(r.get("AnoLimiteQualidade")).strip() != str(ano):
            continue
        cid = str(r.get("IdeConjUndConsumidoras") or "").strip()
        cnpj = str(r.get("NumCNPJ") or "").strip().zfill(14)
        conj_cnpj[cid] = cnpj
        sig = (r.get("SigAgente") or "").strip()
        if sig and sig != "Não Informado":
            siglas[cnpj] = sig
    vinc, sem = {}, []
    for cid, cnpj in conj_cnpj.items():
        if cid not in conj_mun:
            sem.append(cid)
            continue
        for cod, uf, nome in conj_mun[cid]:
            e = vinc.setdefault((cnpj, cod), {"conjuntos": set(), "uf": uf, "nome": nome})
            e["conjuntos"].add(cid)
    return vinc, siglas, sorted(sem, key=lambda x: int(x) if x.isdigit() else 0)


def contagem_mmgd(linhas):
    """Empreendimentos de micro e minigeração distribuída por (CNPJ da distribuidora, município
    IBGE): registro administrativo independente da relação de conjuntos, usado só para
    confirmar (ou não) cada vínculo município × distribuidora."""
    c = collections.Counter()
    for r in linhas:
        cnpj, cod = r.get("NumCNPJDistribuidora"), r.get("CodMunicipioIbge")
        if cnpj in (None, "") or cod in (None, ""):
            continue
        c[(str(cnpj).strip().zfill(14), str(cod).strip())] += 1
    return c


def linhas_mmgd_parquet(caminho):
    import pyarrow.parquet as pq
    t = pq.read_table(caminho, columns=["NumCNPJDistribuidora", "CodMunicipioIbge"]).to_pydict()
    for a, b in zip(t["NumCNPJDistribuidora"], t["CodMunicipioIbge"]):
        yield {"NumCNPJDistribuidora": a, "CodMunicipioIbge": b}


# ---------------------------------------------------------------- IBGE
def serie_sidra_v3(corpo_json, variavel):
    """{cod_municipio: float} de uma resposta da API de agregados v3 do IBGE para `variavel`.
    Valores especiais do IBGE ('-', '...', 'X') são ausência (None não entra)."""
    dados = json.loads(corpo_json) if isinstance(corpo_json, (str, bytes)) else corpo_json
    out = {}
    for v in dados:
        if str(v.get("id")) != str(variavel):
            continue
        for res in v.get("resultados", []):
            for s in res.get("series", []):
                cod = s["localidade"]["id"]
                val = next(iter(s.get("serie", {}).values()), None)
                try:
                    out[cod] = float(val)
                except (TypeError, ValueError):
                    continue
    return out


def municipios_ibge(corpo_json):
    """{cod: (nome, uf)} da API de localidades do IBGE."""
    dados = json.loads(corpo_json) if isinstance(corpo_json, (str, bytes)) else corpo_json
    out = {}
    for m in dados:
        uf = None
        if m.get("microrregiao"):
            uf = m["microrregiao"]["mesorregiao"]["UF"]["sigla"]
        elif m.get("regiao-imediata"):
            uf = m["regiao-imediata"]["regiao-intermediaria"]["UF"]["sigla"]
        out[str(m["id"])] = (m["nome"], uf)
    return out


def media_ponderada(valores, pesos, codigos):
    """Σ(valor × peso) ÷ Σ peso sobre `codigos` que têm valor e peso. Para a renda média
    domiciliar per capita do Censo, valor × moradores é a renda total, então a razão é a
    renda média do conjunto de municípios (não é média de médias)."""
    num = den = 0.0
    n = 0
    for c in codigos:
        v, p = valores.get(c), pesos.get(c)
        if v is None or p is None:
            continue
        num += v * p
        den += p
        n += 1
    return (num / den if den > 0 else None), n


def spearman(xs, ys):
    """Correlação de postos de Spearman (empates com posto médio). None com menos de 5 pares."""
    pares = [(x, y) for x, y in zip(xs, ys) if x is not None and y is not None]
    n = len(pares)
    if n < 5:
        return None, n

    def postos(v):
        ordem = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(ordem):
            j = i
            while j + 1 < len(ordem) and v[ordem[j + 1]] == v[ordem[i]]:
                j += 1
            for k in range(i, j + 1):
                r[ordem[k]] = (i + j) / 2.0 + 1
            i = j + 1
        return r
    rx, ry = postos([p[0] for p in pares]), postos([p[1] for p in pares])
    mx, my = sum(rx) / n, sum(ry) / n
    cov = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    vx = sum((a - mx) ** 2 for a in rx)
    vy = sum((b - my) ** 2 for b in ry)
    if vx == 0 or vy == 0:
        return None, n
    return cov / (vx * vy) ** 0.5, n
