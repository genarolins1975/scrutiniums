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

Ex.: CEMIG-D, jun/2023: 4.586.352.923 − (2.204.773.465 + 2.207.037 + 1.930.724.152 +
27.499.275) − 15.750.000 = 405.398.994 kWh, exatamente a linha "Perdas Totais (valor medido)".
Quando a identidade não fecha, o resíduo é publicado (nunca escondido nem redistribuído).

Decomposição: a fonte publica três linhas de perdas medidas (totais, técnicas, não técnicas).
Pela definição da ANEEL, não técnica = total − técnica, mas as linhas publicadas nem sempre
obedecem a isso (ERO, jul/2014: 327.121.858 − 41.675.325 ≠ 53.290.776 kWh). Regra única deste
módulo: vale a linha publicada "Perdas Não-Técnicas" (valor medido); a identidade é conferida
mês a mês, e a diferença (resíduo da decomposição) é publicada. Agente-ano cuja decomposição
não fecha sai dos agregados de técnica e não técnica (a perda total continua válida).

Técnica medida e faturada NÃO são a mesma linha: diferem em 2.419 de 18.755 meses com as duas
(SULGIPE, mar/2024: 5.269.964 contra 3.779.373 kWh). A técnica usada é só a do valor medido; a
faturada fica em campo próprio e nunca a substitui.

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
import sys

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


def lotes_parquet(fonte, colunas, filtro=None, lote=200_000):
    """Itera as linhas de um Parquet como dicts, em lotes (pyarrow.ParquetFile.iter_batches),
    lendo só as `colunas` pedidas: o arquivo nunca é carregado inteiro na memória. `filtro`
    recebe cada lote (RecordBatch) e devolve o lote filtrado (ex.: só a tarifa B1)."""
    import pyarrow.parquet as pq
    pf = pq.ParquetFile(fonte)
    presentes = [c for c in colunas if c in pf.schema_arrow.names]
    for b in pf.iter_batches(columns=presentes, batch_size=lote):
        if filtro is not None:
            b = filtro(b)
        d = b.to_pydict()
        for i in range(b.num_rows):
            yield {c: d[c][i] for c in presentes}


COLUNAS_SAMP = ["NumCPFCNPJ", "NomAgente", "DscModalidadeBalanco", "DscCctBalanco", "DscClassificacaoAgente",
                "AnoReferenciaBalanco", "MesReferenciaBalanco", "DscDetalheBalanco", "VlrEnergia"]


def linhas_parquet(caminho_ou_arquivo):
    """Itera as linhas do Parquet oficial do SAMP Balanço como dicts (só as colunas usadas)."""
    yield from lotes_parquet(caminho_ou_arquivo, COLUNAS_SAMP)


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
        chave = (sys.intern(mod), sys.intern(cct), sys.intern(det))
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
    Retorna (valor, rótulo da representação escolhida, conflito), com conflito None quando as
    representações concordam, "resolvido" quando discordam mas a escolhida é igual à soma dos
    níveis publicada no mesmo mês, e "sem_niveis" quando discordam e não há soma que arbitre
    (o balanço do mês ainda pode confirmar a escolha; ver deriva_mes)."""
    soma = sum(niveis.values()) if niveis else None
    tol = max(1, len(niveis or ()))  # arredondamento de 1 kWh por linha
    diverge = todos is not None and total is not None and abs(todos - total) > tol
    if soma is not None:
        for valor, rotulo in ((todos, "todos"), (total, "total")):
            if valor is not None and abs(valor - soma) <= tol:
                return valor, rotulo + "=niveis", ("resolvido" if diverge else None)
    conflito = "sem_niveis" if diverge else None
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

    Campos: injetada, injetada_repr, perdas_totais_med, perdas_tecnicas (= tecnica_med),
    tecnica_med, tecnica_fat, pnt_med, perdas_totais_fat, pnt_fat, fornecida_med,
    fornecida_partes, outros_requisitos, irregular, bt_med, mmgd, residuo,
    residuo_decomposicao, conflitos (grandezas cujas representações discordam),
    conflitos_sem_niveis (as que a soma dos níveis não arbitrou) e conflitos_abertos (as que
    nem o balanço do mês confirmou; só estas geram alerta)."""
    out = {"conflitos": [], "conflitos_sem_niveis": []}
    inj, rep, conf = _representacao(
        _niveis(d, MOD_INJETADA, "Energia Injetada"),
        d.get((MOD_INJETADA, "Energia Injetada", f"{MEDIDA}{NIVEL}{TODOS}")),
        d.get((MOD_INJETADA, MOD_INJETADA, MEDIDA)))
    out["injetada"], out["injetada_repr"] = inj, rep
    if conf:
        out["conflitos"].append("injetada")
    if conf == "sem_niveis":
        out["conflitos_sem_niveis"].append("injetada")
    out["perdas_totais_med"] = d.get((MOD_PERDA_MED, CCT_TOTAIS, DET_CALCULADA))
    # Técnica do valor medido e do faturado em campos separados: as duas linhas diferem em 13%
    # dos meses em que ambas existem, então a faturada nunca preenche a medida ausente (seria
    # misturar bases sem marca). Mês sem técnica medida fica sem técnica.
    out["tecnica_med"] = d.get((MOD_PERDA_MED, CCT_TECNICAS, DET_CALCULADA))
    out["tecnica_fat"] = d.get((MOD_PERDA_FAT, CCT_TECNICAS, DET_CALCULADA))
    out["perdas_tecnicas"] = out["tecnica_med"]
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
        if conf == "sem_niveis":
            out["conflitos_sem_niveis"].append(nome)
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
    """Resíduo do balanço, resíduo da decomposição e energia injetada de referência.

    resíduo = injetada publicada − fornecida medida − outros requisitos − irregular − perdas totais
    resíduo da decomposição = perdas totais − técnicas − não técnicas (linhas medidas publicadas)

    Energia injetada de referência: a ANEEL define a energia injetada como "a energia elétrica
    inserida na rede de distribuição para atender aos consumidores, incluindo as perdas"
    (Relatório Perdas de Energia Elétrica na Distribuição, edição 2025/2024, p. 2). No leiaute
    antigo do SAMP (até 2023) a linha publicada é essa energia: o balanço fecha em 88% dos
    agentes-ano completos. No leiaute da REN 1.003/2022 (linhas "Total (todos os níveis de
    tensão)", a partir de 2024) a linha publicada deixou de fechar o balanço com a perda que a
    própria fonte calculou (CEMIG-D 2025: sobra de 10% da injetada publicada). Nesse leiaute o
    denominador é a energia implícita no cálculo da fonte, fornecida + irregular + perdas
    totais; em 2024 ela soma 605,2 TWh nas concessionárias, dentro do intervalo [604,5; 606,8]
    TWh que decorre dos números publicados pela ANEEL para 2024 (44,6 TWh = 7,4% e 40,2 TWh =
    6,6% da injetada), enquanto a injetada publicada soma 620,3 TWh. A fonte não explica a
    sobra e o módulo não atribui causa a ela. A perda técnica, porém, continua sendo calculada
    pela fonte sobre a injetada PUBLICADA (ÂMBAR ENERGIA RR 2024 e 2025: técnica ÷ injetada
    publicada = 7,620% na maior parte dos meses): por isso o módulo publica também a taxa
    técnica sobre a injetada publicada, a base em que ela se compara ao percentual regulatório."""
    inj, pt = m.get("injetada"), m.get("perdas_totais_med")
    forn = m.get("fornecida_med")
    if None not in (inj, pt) and forn is not None:
        m["residuo"] = inj - forn - (m.get("outros_requisitos") or 0) - (m.get("irregular") or 0) - pt
    else:
        m["residuo"] = None
    tec, pnt = m.get("perdas_tecnicas"), m.get("pnt_med")
    m["residuo_decomposicao"] = pt - tec - pnt if None not in (pt, tec, pnt) else None
    # Divergência entre representações sem soma de níveis para arbitrar: a escolha fica
    # confirmada quando o balanço do mês fecha com ela (a linha de perdas que a própria fonte
    # calculou concorda com a injetada e o fornecimento escolhidos). Sem isso, o conflito fica
    # aberto e o agente-ano recebe alerta.
    tol = max(1, m.get("n_linhas") or 1)
    fecha = m["residuo"] is not None and abs(m["residuo"]) <= tol
    m["conflitos_abertos"] = [] if fecha else list(m.get("conflitos_sem_niveis") or [])
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
CAMPOS_SOMA = ("injetada", "injetada_ref", "perdas_totais_med", "perdas_tecnicas", "tecnica_fat", "pnt_med",
               "perdas_totais_fat", "pnt_fat", "perdas_legado", "fornecida_med", "irregular", "bt_med", "mmgd", "residuo",
               "residuo_decomposicao", "n_linhas")

# Limite do resíduo do balanço acima do qual a perda publicada não pode ser confirmada pelas
# linhas publicadas: 5% da energia injetada, um terço da taxa nacional típica (cerca de 15%).
# Acima disso a parte não explicada é da ordem da própria perda (Manaus Energia 2004: resíduo de
# −201% da injetada com taxa de 97%), e o agente-ano sai de agregados e comparações. Abaixo, o
# resíduo fica publicado e classificado, sem exclusão. Sensibilidade conferida em 30/09/2026 na
# série nacional das concessionárias: limite de 10% em vez de 5% muda a taxa anual em até
# 0,15 p.p.; limite de 1% muda em até 1,5 p.p., porque tira distribuidoras de perda alta com
# resíduo de 1% a 4% (Âmbar Amazonas, ERO, Light 2005), o que trocaria um defeito por outro.
LIMITE_RESIDUO_BALANCO = 0.05
# Decomposição (total = técnica + não técnica): cada linha mensal é inteira em kWh, então o
# arredondamento da fonte explica até 2 kWh por mês (CEMIG-D 2023: +2 kWh no ano). Acima disso,
# diferença de até 0,1% da perda total do ano (soma dos módulos mensais) não muda a taxa técnica
# nem a não técnica na precisão publicada; acima disso a decomposição não fecha.
TOLERANCIA_DECOMPOSICAO_KWH_MES = 2
LIMITE_DECOMPOSICAO = 0.001
DECOMPOSICAO_OK = ("fecha", "diferenca_pequena")


def soma_completa(valores):
    """Soma só se todos os meses têm valor; um mês ausente torna a soma anual ausente
    (ausência não vira zero nem é completada)."""
    if not valores or any(v is None for v in valores):
        return None
    return sum(valores)


def anual(mensal, ano, ate_mes=None):
    """Agrega os meses de um agente num ano. `mensal` = {'AAAA-MM': mes_balanco(...)}.

    Retorna dict com as somas (kWh) de cada campo quando os meses presentes têm o campo em
    todos eles, a contagem de meses e o subconjunto com perdas técnicas/BT. Soma de um campo
    parcial (ex.: técnica publicada em só 7 dos 12 meses) é None e a contagem fica registrada.
    `ate_mes` restringe a janeiro..ate_mes (acumulado do ano corrente e o mesmo período do ano
    anterior, a única comparação justa com um ano ainda aberto)."""
    meses = sorted(k for k in mensal if k.startswith(f"{ano:04d}-") and (ate_mes is None or int(k[5:7]) <= ate_mes))
    out = {"ano": ano, "meses": len(meses), "competencias": meses}
    for campo in CAMPOS_SOMA:
        vals = [mensal[m].get(campo) for m in meses]
        out[campo] = soma_completa(vals)
        out[f"meses_{campo}"] = sum(1 for v in vals if v is not None)
    out["residuo_abs_max_mes"] = max((abs(mensal[m]["residuo"]) for m in meses if mensal[m].get("residuo") is not None),
                                     default=None)
    # Resíduo do balanço separado por leiaute: no antigo a injetada publicada é o denominador e
    # o balanço precisa fechar com ela; no de 2024 a linha publicada tem sobra sistemática e só
    # a falta (fornecida + perdas acima da injetada publicada) é fisicamente impossível.
    for leiaute, sufixo in (("antigo", "antigo"), ("2024", "novo")):
        ms = [m for m in meses if mensal[m].get("leiaute") == leiaute]
        res = [mensal[m].get("residuo") for m in ms]
        out[f"meses_leiaute_{sufixo}"] = len(ms)
        out[f"residuo_{sufixo}"] = soma_completa(res)
        out[f"injetada_{sufixo}"] = soma_completa([mensal[m].get("injetada") for m in ms])
    # Decomposição mês a mês: meses que não fecham dentro do arredondamento e soma dos módulos
    dec = [mensal[m].get("residuo_decomposicao") for m in meses]
    out["meses_decomposicao_nao_fecha"] = sum(1 for v in dec if v is not None and abs(v) > TOLERANCIA_DECOMPOSICAO_KWH_MES)
    out["decomposicao_abs"] = sum(abs(v) for v in dec if v is not None) if any(v is not None for v in dec) else None
    out["representacoes"] = sorted({mensal[m].get("injetada_repr") or "ausente" for m in meses})
    out["leiautes"] = sorted({mensal[m].get("leiaute") or "ausente" for m in meses})
    out["meses_injetada_requerida"] = sum(1 for m in meses if mensal[m].get("injetada_ref_origem") == "requerida")
    out["conflitos"] = sorted({c for m in meses for c in mensal[m].get("conflitos", [])})
    out["conflitos_abertos"] = sorted({c for m in meses for c in mensal[m].get("conflitos_abertos", [])})
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

    Impossíveis fisicamente, e por isso fora de agregados e comparações (o valor da fonte
    continua no CSV, com o alerta):
    - perda total anual negativa ou maior que a energia injetada;
    - energia fornecida medida no ano maior que a injetada (Manaus Energia 2004: 3.225 GWh
      fornecidos contra 1.581 GWh injetados; a taxa de 97% é artefato da linha de injetada);
    - balanço que não fecha: no leiaute antigo, resíduo acima de 5% da injetada publicada, para
      mais ou para menos; no de 2024, fornecida + irregular + perdas acima da injetada publicada
      em mais de 5% dela (LIMITE_RESIDUO_BALANCO). Nesses casos não há como saber qual linha
      está errada, e a taxa publicada não pode ser confirmada pelas demais.
    Mês isolado negativo é normal (calendário de leitura) e não gera alerta."""
    alertas = []
    inj, pt = a.get("injetada_ref"), a.get("perdas_totais_med")
    if inj is not None and inj <= 0:
        alertas.append("injetada_nao_positiva")
    if inj and pt is not None:
        if pt < 0:
            alertas.append("perda_total_negativa")
        elif pt >= inj:
            alertas.append("perda_total_maior_que_injetada")
    forn = a.get("fornecida_med")
    if inj and forn is not None and forn > inj:
        alertas.append("fornecida_maior_que_injetada")
    r_ant, i_ant = a.get("residuo_antigo"), a.get("injetada_antigo")
    r_nov, i_nov = a.get("residuo_novo"), a.get("injetada_novo")
    if ((r_ant is not None and i_ant and abs(r_ant) > LIMITE_RESIDUO_BALANCO * abs(i_ant))
            or (r_nov is not None and i_nov and r_nov < -LIMITE_RESIDUO_BALANCO * abs(i_nov))):
        alertas.append("balanco_nao_fecha")
    if a.get("conflitos_abertos"):
        alertas.append("representacoes_conflitantes")
    return alertas


def estado_decomposicao(a):
    """Classe da identidade perdas totais = técnicas + não técnicas no agente-ano.

    - "sem_separacao": técnica ou não técnica medida ausente em algum mês do ano;
    - "fecha": todos os meses dentro de 2 kWh (arredondamento de cada linha ao kWh);
    - "diferenca_pequena": soma dos módulos das diferenças mensais até 0,1% da perda total;
    - "nao_fecha": acima disso (as três linhas publicadas não conversam: técnica e não técnica
      desse agente-ano ficam fora dos agregados de separação, a perda total continua válida)."""
    if a.get("perdas_tecnicas") is None or a.get("pnt_med") is None or a.get("decomposicao_abs") is None:
        return "sem_separacao"
    if not a.get("meses_decomposicao_nao_fecha"):
        return "fecha"
    total = abs(a.get("perdas_totais_med") or 0)
    if total and a["decomposicao_abs"] <= LIMITE_DECOMPOSICAO * total:
        return "diferenca_pequena"
    return "nao_fecha"


def cnpj_dv_valido(c14):
    """Confere os dois dígitos verificadores de um CNPJ de 14 dígitos (módulo 11 da Receita).
    A fonte é mantida como veio: o resultado só marca o CNPJ publicado com dígito inválido
    (Manaus Energia no SAMP: 02.341.467/1000-20, cujo verificador calculado é 01)."""
    s = str(c14 or "").strip()
    if len(s) != 14 or not s.isdigit() or len(set(s)) == 1:
        return False

    def dv(base):
        pesos = list(range(len(base) - 7, 1, -1)) + list(range(9, 1, -1))
        r = sum(int(d) * p for d, p in zip(base, pesos)) % 11
        return 0 if r < 2 else 11 - r
    d1 = dv(s[:12])
    d2 = dv(s[:12] + str(d1))
    return s[12:] == f"{d1}{d2}"


# ---------------------------------------------------------------- percentual técnico implícito
# Trecho de referência: ao menos 6 meses seguidos com o mesmo percentual. Todo processo
# tarifário (reajuste anual ou revisão) vigora cerca de 12 meses, então um percentual fixado
# por processo dura bem mais que 6 meses; já 2 ou 3 meses iguais a 0,001 p.p. aparecem por
# coincidência onde nenhum percentual é aplicado (112 trechos de 2 meses em 30/09/2026, em todos
# os anos da série, inclusive depois de 2016). Trecho mais curto fica publicado no CSV com a
# classe "curto" (possível coincidência) e fora do bloco de referência da gold.
MIN_MESES_REFERENCIA = 6
# Troca de percentual: variação de ao menos 0,02 p.p. entre trechos vizinhos. Das 271
# transições observadas, 113 ficam abaixo de 0,005 p.p. (o mesmo percentual interrompido por
# meses fora do padrão, como DCELT 7,28% em 2019, 2021 e 2022) e 13 entre 0,005 e 0,02 p.p.
# (CPFL-PAULISTA 6,024 → 6,022 → 6,023); nenhuma dessas é troca de percentual regulatório, e
# associar a elas uma resolução homologatória seria inventar a ligação.
LIMIAR_TROCA_PP = 0.02


def segmentos_pt(mensal, casas=3, min_meses=2):
    """Trechos em que perdas técnicas ÷ energia injetada publicada é constante (arredondado a
    `casas` decimais em %). Onde a ANEEL publica no SAMP a parcela técnica como o percentual
    regulatório aplicado à energia injetada, a razão fica fixa entre processos tarifários e o
    mês da troca mistura as duas taxas pró-rata dos dias (CEMIG-D, mai/2018: 27 dias a 7,840%
    e 4 dias a 8,766% dão 7,959%). Meses isolados (transição) não formam trecho.

    Retorna [{"inicio": 'AAAA-MM', "fim": 'AAAA-MM', "pct": float, "meses": n, "classe":
    "referencia" | "curto"}]: trecho com menos de MIN_MESES_REFERENCIA meses é "curto"
    (possível coincidência de arredondamento, fora do bloco de referência)."""
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
    out = [s for s in seg if s["meses"] >= min_meses]
    for s in out:
        s["classe"] = "referencia" if s["meses"] >= MIN_MESES_REFERENCIA else "curto"
    return out


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


# ---------------------------------------------------------------- mudanças de universo
# Variação da injetada de referência acima de 30% entre anos completos: provável mudança de
# universo (incorporação, cisão, troca de CNPJ), não variação de mercado; o crescimento anual
# de mercado de uma distribuidora fica muito abaixo disso.
LIMITE_QUEBRA_ESCALA = 0.30


def desloca(comp, n):
    """'AAAA-MM' deslocado de n meses."""
    t = int(comp[:4]) * 12 + int(comp[5:7]) - 1 + n
    return f"{t // 12:04d}-{t % 12 + 1:02d}"


def _media_injetada(mensal_cnpj, comps):
    v = [(mensal_cnpj.get(k) or {}).get("injetada_ref") for k in comps]
    v = [x for x in v if x is not None and x > 0]
    return sum(v) / len(v) if len(v) >= 2 else None


def quebra_escala(anterior, atual):
    """Variação relativa da injetada de referência entre dois anos completos e se ela passa do
    limite de quebra de escala: (variação, quebra). Sem os dois anos completos: (None, False)."""
    if not (anterior and atual and anterior.get("completo") and atual.get("completo")):
        return None, False
    i0, i1 = anterior.get("injetada_ref"), atual.get("injetada_ref")
    if not i0 or i0 <= 0 or i1 is None:
        return None, False
    v = i1 / i0 - 1
    return v, abs(v) > LIMITE_QUEBRA_ESCALA


def mudancas_de_universo(mensal, ultima_comp):
    """Absorções e sucessões prováveis observadas no próprio SAMP, sem cadastro societário e
    sem comparar nomes (o vínculo é pela energia, com os números à vista).

    Série encerrada: última competência anterior a janeiro do último ano publicado.
    - Absorção: no mês seguinte ao fim de uma ou mais séries (competência M), a série de outra
      distribuidora salta: a média da injetada de referência de M+1 a M+3 supera a de M−2 a M
      em ao menos 30% (o limite de quebra de escala), o salto fica entre 0,5 e 1,5 vez a energia
      mensal das séries encerradas em M e não passa de 10 vezes a escala anterior (acima disso
      é valor anômalo da própria série, não absorção). RGE, encerrada em mai/2019, e RGE SUL,
      que salta 107% em jun/2019.
    - Sucessão: uma série começa em M+1 com energia mensal (média dos 3 primeiros meses) entre
      0,7 e 1,3 vez a de uma série encerrada em M; pares escolhidos um a um pela razão mais
      próxima de 1. Manaus Energia (fim em jul/2009) e Âmbar Amazonas (início em ago/2009,
      mesma raiz de CNPJ).

    Retorna (absorcoes, sucessoes):
      absorcoes = [{"competencia": M+1, "cnpj": absorvedora, "encerradas": [cnpj...],
                    "salto_pct": float, "salto_sobre_encerradas": float}]
      sucessoes = [{"competencia": M+1, "cnpj": nova, "anterior": cnpj, "razao_energia": float,
                    "mesma_raiz_cnpj": bool}]"""
    limite_fim = ultima_comp[:4] + "-01"
    fins = collections.defaultdict(list)
    for cnpj, m in mensal.items():
        if m and max(m) < limite_fim:
            fins[max(m)].append(cnpj)
    inicios = collections.defaultdict(list)
    for cnpj, m in mensal.items():
        if m:
            inicios[min(m)].append(cnpj)
    absorcoes, sucessoes = [], []
    for fim, encerradas in sorted(fins.items()):
        antes = [desloca(fim, -k) for k in (2, 1, 0)]
        depois = [desloca(fim, k) for k in (1, 2, 3)]
        energia = {x: _media_injetada(mensal[x], antes) for x in encerradas}
        total = sum(v for v in energia.values() if v)
        if total > 0:
            for y, m in mensal.items():
                if y in encerradas:
                    continue
                a, d = _media_injetada(m, antes), _media_injetada(m, depois)
                if a is None or d is None:
                    continue
                salto = d - a
                if salto >= LIMITE_QUEBRA_ESCALA * a and salto <= 10 * a and 0.5 * total <= salto <= 1.5 * total:
                    absorcoes.append({"competencia": depois[0], "cnpj": y, "encerradas": sorted(encerradas),
                                      "salto_pct": round(100 * salto / a, 1), "salto_sobre_encerradas": round(salto / total, 2)})
        novas = inicios.get(depois[0], [])
        pares = []
        for y in novas:
            d = _media_injetada(mensal[y], depois)
            for x in encerradas:
                if d and energia.get(x) and 0.7 <= d / energia[x] <= 1.3:
                    pares.append((abs(d / energia[x] - 1), y, x, d / energia[x]))
        usados = set()
        for _, y, x, razao in sorted(pares):
            if y in usados or x in usados:
                continue
            usados |= {y, x}
            sucessoes.append({"competencia": depois[0], "cnpj": y, "anterior": x, "razao_energia": round(razao, 2),
                              "mesma_raiz_cnpj": y[:8] == x[:8]})
    return absorcoes, sucessoes


def par_afetado(competencias_evento, ano):
    """True quando uma mudança de universo com primeira competência E cai entre fevereiro do
    ano anterior e dezembro de `ano`: um dos dois anos do par (ano−1, ano) mistura a escala
    antiga e a nova, e a variação entre eles não mede a distribuidora."""
    return any(f"{ano - 1:04d}-02" <= e <= f"{ano:04d}-12" for e in competencias_evento)


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


COLUNAS_COMPONENTES = ["NumCPFCNPJ", "SigNomeAgente", "SigAgente", "DscResolucaoHomologatoria", "DatInicioVigencia",
                       "DatFimVigencia", "DscBaseTarifaria", "DscSubGrupoTarifario", "DscModalidadeTarifaria",
                       "DscSubClasseConsumidor", "DscDetalheConsumidor", "DscComponenteTarifario", "DscUnidade",
                       "VlrComponenteTarifario"]


def tarifa_vigente(processos, hoje_iso):
    """(processo, situacao) da tarifa em `hoje_iso` (AAAA-MM-DD) entre `processos` (dicts com
    inicio, fim e resumo, em ordem de início). Vigente = início ≤ hoje ≤ fim (fim ausente é
    vigência aberta). Sem processo vigente, devolve o último já iniciado com a situação
    "vigencia_encerrada": o arquivo anual de componentes ainda não trouxe o processo seguinte
    (CEDRI, REH 3.531/2025, vigente de 01/01/2026 a 29/09/2026, consultada em 30/09/2026).
    Sem processo iniciado: (None, None)."""
    iniciados = [p for p in processos if p.get("resumo") and p["inicio"] <= hoje_iso]
    vigentes = [p for p in iniciados if not p.get("fim") or p["fim"] >= hoje_iso]
    if vigentes:
        return vigentes[-1], "vigente"
    if iniciados:
        return iniciados[-1], "vigencia_encerrada"
    return None, None


def linhas_componentes_parquet(caminho):
    """Linhas B1 convencional das componentes tarifárias, lidas em lotes e já filtradas no
    pyarrow (o arquivo anual tem centenas de milhares de linhas de todos os subgrupos)."""
    import pyarrow.compute as pc

    def so_b1(b):
        return b.filter(pc.and_(pc.equal(b.column("DscSubGrupoTarifario"), "B1"),
                                pc.equal(b.column("DscModalidadeTarifaria"), "Convencional")))
    yield from lotes_parquet(caminho, COLUNAS_COMPONENTES, filtro=so_b1)


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


def vinculos_so_mmgd(codigos, mmgd, minimo=10, participacao=0.05):
    """Distribuidoras de municípios que a relação conjunto × município não cobre, lidas do
    cadastro de MMGD da ANEEL (cada empreendimento registra a distribuidora a que se conecta
    e o município onde está). Só entra a distribuidora com ao menos `minimo` empreendimentos
    E ao menos `participacao` dos empreendimentos do município: um ou dois registros de outra
    distribuidora (ex.: Equatorial Pará com 1 empreendimento num município do Maranhão) são
    tratados como erro de cadastro, não como atendimento. Retorna {cod: [(cnpj, n), ...]}."""
    por_mun = collections.defaultdict(dict)
    for (cnpj, cod), n in mmgd.items():
        if cod in codigos:
            por_mun[cod][cnpj] = n
    out = {}
    for cod, d in por_mun.items():
        total = sum(d.values())
        sel = sorted(((c, n) for c, n in d.items() if n >= minimo and n / total >= participacao), key=lambda x: -x[1])
        if sel:
            out[cod] = sel
    return out


def linhas_mmgd_parquet(caminho):
    """Só as duas colunas da ligação distribuidora × município, em lotes (o cadastro tem
    milhões de empreendimentos)."""
    yield from lotes_parquet(caminho, ["NumCNPJDistribuidora", "CodMunicipioIbge"])


# ---------------------------------------------------------------- IBGE
def descomprime_camadas(corpo):
    """Abre camadas gzip sobrepostas (assinatura 1f 8b). A API do IBGE responde com
    Content-Encoding gzip e o download guarda o corpo como veio; o bronze ainda comprime de
    novo. Corpo sem a assinatura volta intacto."""
    import gzip
    while corpo[:2] == b"\x1f\x8b":
        corpo = gzip.decompress(corpo)
    return corpo


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
