"""Leitores do ONS para o módulo Geração (detalhe): geração por usina, geração térmica por
motivo de despacho, CVU, restrições por constrained-off de eólicas e fotovoltaicas,
capacidade instalada, fator de capacidade e cadastros de modalidade e conjuntos.

Os arquivos do ONS têm uma linha por usina e hora (ou meia hora): a geração por usina de
um único mês passa de 450 mil linhas. Nada disso entra linha a linha no silver. Cada
arquivo Parquet oficial (conteúdo equivalente ao CSV do mesmo recurso, em um décimo do
tamanho) é lido em lotes, só com as colunas necessárias, agregado com o motor do pyarrow
no grão publicado e descartado da memória; o original fica no bronze com sha256.

Convenções verificadas nos dicionários de dados do ONS (PDF, consultados em 30/09/2026) e
nos próprios arquivos:

- valores em MWmed no intervalo: energia do intervalo = valor × duração (1 h na geração
  por usina, na térmica por motivo e no fator de capacidade; 0,5 h nas restrições);
- campos numéricos às vezes chegam como texto ("156.937", "0E-8") e às vezes vazios:
  vazio é ausência, nunca zero; texto que não é número é contado como inválido;
- `din_instante` é hora local de Brasília, início do intervalo;
- o rótulo de tipo, combustível e modalidade é guardado como a fonte escreve; a
  classificação em categorias publicadas é feita aqui, por tabela explícita, e rótulo
  não previsto vira categoria "não mapeada" visível, nunca some nem é encaixado por
  semelhança.
"""
import re
import unicodedata
from collections import defaultdict
from datetime import date, datetime, timedelta

S3 = "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/"
PORTAL = "https://dados.ons.org.br/dataset/"

SUBSISTEMAS = ("SE", "S", "NE", "N")

# ---------------------------------------------------------------- categorias publicadas

# Tipo da usina (nom_tipousina) → grupo. O Balanço de Energia nos Subsistemas soma a
# geração pelo TIPO da usina, não pelo combustível: conferido em 10/05/2023, a eólica do
# Nordeste no balanço (8.746,91 MWmed) é igual à soma das usinas EOLIELÉTRICA, inclusive
# os conjuntos híbridos rotulados com combustível "Fotovoltaica".
TIPO_GRUPO = {
    "HIDROELETRICA": "hidraulica",
    "EOLIELETRICA": "eolica",
    "FOTOVOLTAICA": "solar",
    "NUCLEAR": "nuclear",
    "TERMICA": "termica",
}

# Combustível da térmica → categoria publicada. Tabela explícita, conferida contra os
# rótulos que aparecem nos arquivos de geração por usina, térmica por motivo e capacidade.
COMBUSTIVEL_CATEGORIA = {
    "GAS": "gas",
    "GAS NATURAL": "gas",
    "CARVAO": "carvao",
    "CARVAO MINERAL": "carvao",
    "OLEO COMBUSTIVEL": "oleo",
    "OLEO DIESEL": "oleo",
    "MULTI-COMBUSTIVEL DIESEL/OLEO": "oleo",
    "BIOMASSA": "biomassa",
    "NUCLEAR": "nuclear",
    "RESIDUOS INDUSTRIAIS": "outros",
    "RESIDUO CICLO COMBINADO": "outros",
    "MULTI-COMBUSTIVEL GAS/DIESEL": "outros",
    # grupos de pequenas térmicas Tipo III: a fonte não identifica o combustível
    "OUTRAS MULTI-COMBUSTIVEL": "termica_sem_combustivel",
}

CATEGORIAS = (
    ("hidraulica", "Hidráulica"),
    ("eolica", "Eólica"),
    ("solar_centralizada", "Solar centralizada"),
    ("solar_mmgd", "Solar MMGD (estimativa do ONS)"),
    ("nuclear", "Nuclear"),
    ("gas", "Gás natural"),
    ("carvao", "Carvão mineral"),
    ("oleo", "Óleo combustível e diesel"),
    ("biomassa", "Biomassa"),
    ("outros", "Outras térmicas (resíduos industriais e multicombustível gás/diesel)"),
    ("termica_sem_combustivel", "Térmicas pequenas sem combustível identificado (grupos Tipo III)"),
    ("nao_mapeada", "Categoria não mapeada"),
)
CATEGORIAS_TERMICAS = ("nuclear", "gas", "carvao", "oleo", "biomassa", "outros", "termica_sem_combustivel")
COMBUSTIVEIS = ("gas", "carvao", "oleo", "biomassa", "nuclear", "outros", "termica_sem_combustivel", "nao_mapeada")

# Modalidade de operação: os grupos de pequenas usinas são previsões (dicionário da
# Geração por Usina, versão 1.2: "os grupos de pequenas usinas são formados por usinas
# Tipo III, que não possuem relacionamento com o ONS, e os dados são referentes a
# previsões de geração"). O grupo "Pequenas Usinas (MMGD)" aparece em 29/04/2023.
MOD_MMGD = "PEQUENAS USINAS (MMGD)"
MOD_PQU = "PEQUENAS USINAS (TIPO III)"


def norm(texto):
    """Forma de comparação de rótulo: sem acento, maiúsculas, espaços simples."""
    s = unicodedata.normalize("NFKD", str(texto or "")).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip().upper()


def natureza_modalidade(modalidade):
    m = norm(modalidade)
    if m == MOD_MMGD:
        return "grupo_mmgd"
    if m == MOD_PQU:
        return "grupo_tipo3"
    return "verificada"


def categoria_combustivel(combustivel):
    """Categoria de combustível de uma térmica, ou 'nao_mapeada' (explícita)."""
    return COMBUSTIVEL_CATEGORIA.get(norm(combustivel), "nao_mapeada")


def categoria(tipo, combustivel, modalidade):
    """Categoria publicada de uma linha da Geração por Usina (tipo, combustível e
    modalidade como a fonte escreve)."""
    g = TIPO_GRUPO.get(norm(tipo))
    if g == "hidraulica" or g == "eolica" or g == "nuclear":
        return g
    if g == "solar":
        return "solar_mmgd" if norm(modalidade) == MOD_MMGD else "solar_centralizada"
    if g == "termica":
        c = categoria_combustivel(combustivel)
        return c
    return "nao_mapeada"


def grupo_balanco(tipo):
    """Fonte do Balanço de Energia nos Subsistemas em que a linha entra (hidraulica,
    termica, eolica, solar), ou None. O balanço soma nuclear na térmica."""
    g = TIPO_GRUPO.get(norm(tipo))
    if g == "nuclear":
        return "termica"
    return g


# ---------------------------------------------------------------- recursos do portal

_PERIODO = re.compile(r"_(\d{4})(?:_(\d{2}))?\.parquet$", re.IGNORECASE)


def periodo_do_arquivo(nome):
    """'GERACAO_USINA-2_2023_04.parquet' → '2023-04'; 'X_2021.parquet' → '2021'; ou None."""
    m = _PERIODO.search(nome or "")
    if not m:
        return None
    return f"{m.group(1)}-{m.group(2)}" if m.group(2) else m.group(1)


def recursos_parquet(pacote, prefixos):
    """{nome_sem_extensao: {url, periodo, last_modified, tamanho}} dos Parquet do pacote CKAN
    cujo nome de arquivo começa por um dos prefixos."""
    out = {}
    for r in pacote.get("resources", []):
        url = r.get("url") or ""
        nome = url.rsplit("/", 1)[-1]
        if (r.get("format") or "").upper() != "PARQUET" or not nome.lower().endswith(".parquet"):
            continue
        if not any(nome.startswith(p) for p in prefixos):
            continue
        out[nome[:-8]] = {"url": url, "periodo": periodo_do_arquivo(nome),
                          "last_modified": r.get("last_modified") or r.get("metadata_modified"),
                          "tamanho": r.get("size")}
    return out


def recurso_unico(pacote, nome_arquivo):
    """Recurso de um conjunto sem histórico (um arquivo só), pelo nome exato do arquivo."""
    for r in pacote.get("resources", []):
        url = r.get("url") or ""
        if url.rsplit("/", 1)[-1] == nome_arquivo:
            return {"url": url, "last_modified": r.get("last_modified") or r.get("metadata_modified"),
                    "tamanho": r.get("size")}
    return None


def dicionario_pdf(pacote):
    for r in pacote.get("resources", []):
        url = r.get("url") or ""
        if (r.get("format") or "").upper() == "PDF" and "Dicionario" in url:
            return {"url": url, "nome": url.rsplit("/", 1)[-1][:-4], "last_modified": r.get("last_modified")}
    return None


# ---------------------------------------------------------------- leitura em lotes

def _pa():
    import pyarrow as pa
    import pyarrow.compute as pc
    return pa, pc


def lotes(caminho_ou_arquivo, colunas, tamanho=200_000):
    """Lotes (pyarrow.Table) de um Parquet, só com as colunas pedidas que existem no
    arquivo. Coluna ausente fica de fora e o chamador a trata como "não se aplica"."""
    import pyarrow as pa
    import pyarrow.parquet as pq
    arq = pq.ParquetFile(caminho_ou_arquivo)
    nomes = arq.schema_arrow.names
    cols = [c for c in colunas if c in nomes]
    for b in arq.iter_batches(columns=cols, batch_size=tamanho):
        yield pa.Table.from_batches([b])


def colunas_do_arquivo(caminho_ou_arquivo):
    import pyarrow.parquet as pq
    return list(pq.ParquetFile(caminho_ou_arquivo).schema_arrow.names)


def numero(col):
    """Coluna (texto ou número) → float64, com vazio e texto inválido como nulo.
    Devolve (coluna_float, n_invalidos). Inválido = texto não vazio que não vira número."""
    pa, pc = _pa()
    if col.type in (pa.float64(), pa.float32(), pa.int64(), pa.int32(), pa.int16(), pa.int8()):
        return pc.cast(col, pa.float64()), 0
    txt = pc.utf8_trim_whitespace(pc.cast(col, pa.string()))
    txt = pc.if_else(pc.equal(txt, ""), pa.scalar(None, pa.string()), txt)
    valido = pc.match_substring_regex(txt, r"^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$")
    invalidos = pc.sum(pc.cast(pc.and_(pc.invert(valido), pc.is_valid(txt)), pa.int64())).as_py() or 0
    limpo = pc.if_else(valido, txt, pa.scalar(None, pa.string()))
    return pc.cast(limpo, pa.float64()), invalidos


def texto(col):
    """Coluna de texto aparada; nulo vira ''."""
    pa, pc = _pa()
    t = pc.utf8_trim_whitespace(pc.cast(col, pa.string()))
    return pc.fill_null(t, "")


def _col(tab, nome):
    return tab[nome] if nome in tab.column_names else None


def _dia_hora(col):
    pa, pc = _pa()
    if not pa.types.is_timestamp(col.type):
        col = pc.strptime(pc.utf8_slice_codeunits(pc.cast(col, pa.string()), 0, 19), format="%Y-%m-%d %H:%M:%S", unit="s")
    return (pc.strftime(col, format="%Y-%m-%d"), pc.strftime(col, format="%Y-%m-%dT%H:%M"),
            pc.minute(col), col)


def _rel_instantes(rel, instantes, minutos, grade):
    pa, pc = _pa()
    mn, mx = pc.min(instantes).as_py(), pc.max(instantes).as_py()
    if mn is not None:
        mn, mx = mn.strftime("%Y-%m-%dT%H:%M"), mx.strftime("%Y-%m-%dT%H:%M")
        rel["primeiro"] = min(rel["primeiro"] or mn, mn)
        rel["ultimo"] = max(rel["ultimo"] or mx, mx)
    fora = pc.invert(pc.is_in(minutos, value_set=pa.array(grade, pa.int64())))
    rel["fora_da_grade"] += pc.sum(pc.cast(fora, pa.int64())).as_py() or 0


# ---------------------------------------------------------------- geração por usina

COLS_USINA = ["din_instante", "id_subsistema", "id_estado", "cod_modalidadeoperacao", "nom_tipousina",
              "nom_tipocombustivel", "nom_usina", "id_ons", "ceg", "val_geracao"]


def agrega_geracao_usina(tabelas):
    """Agrega lotes da Geração por Usina em Base Horária.

    Retorna dict com:
    - diario: {(dia, sm, tipo, combustivel, modalidade): [MWh, horas_com_valor, linhas]}
      (rótulos como a fonte escreve);
    - horario: {(hora 'AAAA-MM-DDTHH:MM', categoria): MWh} somado no SIN;
    - horas_dia: {(dia, sm|'SIN'): instantes distintos};
    - usina_mes: {(mes, id_ons): [MWh, horas_com_valor, linhas]};
    - cadastro: {id_ons: {...}} com o último rótulo visto;
    - rel: contagens de controle (linhas, vazios, inválidos, negativos, subsistema
      desconhecido, fora da grade horária, primeiro e último instante)."""
    pa, pc = _pa()
    diario = defaultdict(lambda: [0.0, 0, 0])
    horario = defaultdict(float)
    horas = defaultdict(set)
    usina_mes = defaultdict(lambda: [0.0, 0, 0])
    cadastro = {}
    rel = {"linhas": 0, "vazios": 0, "invalidos": 0, "negativos": 0, "subsistema_desconhecido": 0,
           "fora_da_grade": 0, "sem_id_ons": 0, "primeiro": None, "ultimo": None}
    cat_cache = {}
    for t in tabelas:
        n = t.num_rows
        rel["linhas"] += n
        v, inval = numero(t["val_geracao"])
        rel["invalidos"] += inval
        rel["vazios"] += pc.sum(pc.cast(pc.is_null(v), pa.int64())).as_py() - inval
        rel["negativos"] += pc.sum(pc.cast(pc.less(v, 0), pa.int64())).as_py() or 0
        dia, hora, minuto, inst = _dia_hora(t["din_instante"])
        _rel_instantes(rel, inst, minuto, [0])
        sm = pc.utf8_upper(texto(t["id_subsistema"]))
        rel["subsistema_desconhecido"] += pc.sum(pc.cast(pc.invert(pc.is_in(sm, value_set=pa.array(SUBSISTEMAS))), pa.int64())).as_py() or 0
        tipo, comb, mod = texto(t["nom_tipousina"]), texto(t["nom_tipocombustivel"]), texto(_col(t, "cod_modalidadeoperacao") or pa.nulls(n, pa.string()))
        ido = texto(_col(t, "id_ons") or pa.nulls(n, pa.string()))
        rel["sem_id_ons"] += pc.sum(pc.cast(pc.equal(ido, ""), pa.int64())).as_py() or 0
        mes = pc.utf8_slice_codeunits(dia, 0, 7)
        tab = pa.table({"dia": dia, "hora": hora, "mes": mes, "sm": sm, "tipo": tipo, "comb": comb, "mod": mod,
                        "ido": ido, "v": v, "um": pa.array([1] * n, pa.int64())})
        g = tab.group_by(["dia", "sm", "tipo", "comb", "mod"], use_threads=False).aggregate([("v", "sum"), ("v", "count"), ("um", "sum")]).to_pydict()
        for d_, s_, ti, co, mo, soma, cnt, lin in zip(g["dia"], g["sm"], g["tipo"], g["comb"], g["mod"], g["v_sum"], g["v_count"], g["um_sum"]):
            a = diario[(d_, s_, ti, co, mo)]
            a[0] += soma or 0.0
            a[1] += cnt
            a[2] += lin
        # horário no SIN por categoria publicada
        g = tab.group_by(["hora", "tipo", "comb", "mod"], use_threads=False).aggregate([("v", "sum"), ("v", "count")]).to_pydict()
        for h_, ti, co, mo, soma, cnt in zip(g["hora"], g["tipo"], g["comb"], g["mod"], g["v_sum"], g["v_count"]):
            if not cnt:
                continue
            k = (ti, co, mo)
            if k not in cat_cache:
                cat_cache[k] = categoria(ti, co, mo)
            horario[(h_, cat_cache[k])] += soma or 0.0
        g = tab.group_by(["dia", "sm", "hora"], use_threads=False).aggregate([("um", "sum")]).to_pydict()
        for d_, s_, h_ in zip(g["dia"], g["sm"], g["hora"]):
            horas[(d_, s_)].add(h_)
            horas[(d_, "SIN")].add(h_)
        g = tab.group_by(["mes", "ido"], use_threads=False).aggregate([("v", "sum"), ("v", "count"), ("um", "sum")]).to_pydict()
        for m_, i_, soma, cnt, lin in zip(g["mes"], g["ido"], g["v_sum"], g["v_count"], g["um_sum"]):
            a = usina_mes[(m_, i_ or "sem_id_ons")]
            a[0] += soma or 0.0
            a[1] += cnt
            a[2] += lin
        # cadastro: um registro por identificador (última linha do lote)
        cad = pa.table({"ido": ido, "nome": texto(t["nom_usina"]), "tipo": tipo, "comb": comb, "mod": mod, "sm": sm,
                        "uf": texto(t["id_estado"]), "ceg": texto(_col(t, "ceg") or pa.nulls(n, pa.string()))})
        vistos = {}
        dd = cad.to_pydict()
        for i in range(n - 1, -1, -1):
            k = dd["ido"][i]
            if k in vistos:
                continue
            vistos[k] = True
            cadastro[k or "sem_id_ons"] = {c: dd[c][i] for c in ("nome", "tipo", "comb", "mod", "sm", "uf", "ceg")}
    return {"diario": dict(diario), "horario": dict(horario), "horas_dia": {k: len(v) for k, v in horas.items()},
            "usina_mes": dict(usina_mes), "cadastro": cadastro, "rel": rel}


# ---------------------------------------------------------------- térmica por motivo

# Partição da geração verificada por motivo. O dicionário (versão 1.6, 20/05/2026) diz que
# a inflexibilidade "fica embutida" no despacho por ordem de mérito quando a usina também
# é despachada por mérito; os campos acima da inflexibilidade, inflexibilidade embutida e
# inflexibilidade pura (versão 1.3, preenchidos em todo o histórico) separam as duas
# coisas. Partição sem dupla contagem: mérito ACIMA da inflexibilidade + inflexibilidade
# (pura + embutida) + demais motivos. Conferida contra a geração verificada total: resíduo
# de 0,01% em agosto de 2026 e janeiro de 2022 e de −0,3% em 2016 (publicado como
# "não classificado", com sinal).
MOTIVOS = (
    ("merito", "val_verifordemdemeritoacimadainflex", "Ordem de mérito (acima da inflexibilidade)"),
    ("inflexibilidade", "val_verifinflexibilidade", "Inflexibilidade declarada pelo agente"),
    ("razao_eletrica", "val_verifrazaoeletrica", "Razão elétrica (necessidade do SIN)"),
    ("garantia_energetica", "val_verifgarantiaenergetica", "Garantia de suprimento energético (decisão do CMSE)"),
    ("gfom", "val_verifgfom", "Geração fora da ordem de mérito para compensar falta futura de combustível (GFOM)"),
    ("reposicao_perdas", "val_verifreposicaoperdas", "Reposição de perdas"),
    ("exportacao", "val_verifexportacao", "Exportação"),
    ("reserva_potencia", "val_verifreservapotencia", "Recomposição da reserva de potência operativa"),
    ("substituicao", "val_verifgsub", "Substituição de usina sem combustível"),
    ("unit_commitment", "val_verifunitcommitment", "Unit commitment (rampa e tempos mínimos)"),
)
EXTRAS_TERMICA = (
    ("total", "val_verifgeracao"),
    ("merito_total", "val_verifordemmerito"),
    ("inflex_pura", "val_verifinflexpura"),
    ("inflex_embutida", "val_verifinflexembutmerito"),
    ("constrained_off", "val_verifconstrainedoff"),
    ("programada", "val_proggeracao"),
)
COLS_TERMICA = ["din_instante", "id_subsistema", "nom_usina", "cod_usinaplanejamento", "ceg", "nom_combustivel"] + \
    [c for _, c, _ in MOTIVOS] + [c for _, c in EXTRAS_TERMICA]


def chave_termica(ceg, cod):
    """Identidade da usina na térmica por motivo: CEG da ANEEL; sem CEG, o código da usina
    nos modelos do ONS; sem os dois, a linha fica num balde explícito."""
    if ceg and ceg != "-":
        return ceg
    if cod not in (None, ""):
        return f"cod:{int(cod)}"
    return "sem_identificador"


def agrega_termica(tabelas):
    """Agrega lotes da Geração Térmica por Motivo de Despacho.

    - diario: {(dia, sm, medida): MWh} para os motivos e as medidas extras;
    - usina_mes: {(mes, chave, medida): MWh};
    - presentes: {medida: linhas com valor} (coluna ausente ou toda nula = não se aplica);
    - cadastro: {chave: {nome, sm, ceg, cod, combustivel}};
    - horas_dia: {dia: instantes distintos}; rel: controles."""
    pa, pc = _pa()
    medidas = [(m, c) for m, c, _ in MOTIVOS] + list(EXTRAS_TERMICA)
    diario = defaultdict(float)
    usina_mes = defaultdict(float)
    presentes = defaultdict(int)
    cadastro = {}
    horas = defaultdict(set)
    rel = {"linhas": 0, "invalidos": 0, "negativos": 0, "subsistema_desconhecido": 0, "fora_da_grade": 0,
           "primeiro": None, "ultimo": None, "sem_ceg": 0}
    for t in tabelas:
        n = t.num_rows
        rel["linhas"] += n
        dia, hora, minuto, inst = _dia_hora(t["din_instante"])
        _rel_instantes(rel, inst, minuto, [0])
        sm = pc.utf8_upper(texto(t["id_subsistema"]))
        rel["subsistema_desconhecido"] += pc.sum(pc.cast(pc.invert(pc.is_in(sm, value_set=pa.array(SUBSISTEMAS))), pa.int64())).as_py() or 0
        ceg = texto(_col(t, "ceg") or pa.nulls(n, pa.string()))
        cod_col = _col(t, "cod_usinaplanejamento")
        cod = pc.cast(cod_col, pa.int64()) if cod_col is not None else pa.nulls(n, pa.int64())
        ceg_l, cod_l = ceg.to_pylist(), cod.to_pylist()
        chaves = [chave_termica(a, b) for a, b in zip(ceg_l, cod_l)]
        rel["sem_ceg"] += sum(1 for a in ceg_l if not a or a == "-")
        mes = pc.utf8_slice_codeunits(dia, 0, 7)
        cols = {"dia": dia, "mes": mes, "sm": sm, "ch": pa.array(chaves, pa.string())}
        somas = []
        for m, c in medidas:
            col = _col(t, c)
            if col is None:
                continue
            v, inval = numero(col)
            rel["invalidos"] += inval
            if m in dict((x, y) for x, y, _ in MOTIVOS) or m == "total":
                rel["negativos"] += pc.sum(pc.cast(pc.less(v, 0), pa.int64())).as_py() or 0
            presentes[m] += pc.sum(pc.cast(pc.is_valid(v), pa.int64())).as_py() or 0
            cols[m] = v
            somas.append(m)
        tab = pa.table(cols)
        g = tab.group_by(["dia", "sm"], use_threads=False).aggregate([(m, "sum") for m in somas]).to_pydict()
        for i in range(len(g["dia"])):
            for m in somas:
                val = g[f"{m}_sum"][i]
                if val is not None:
                    diario[(g["dia"][i], g["sm"][i], m)] += val
        g = tab.group_by(["mes", "ch"], use_threads=False).aggregate([(m, "sum") for m in somas]).to_pydict()
        for i in range(len(g["mes"])):
            for m in somas:
                val = g[f"{m}_sum"][i]
                if val is not None:
                    usina_mes[(g["mes"][i], g["ch"][i], m)] += val
        for d_, h_ in zip(dia.to_pylist(), hora.to_pylist()):
            horas[d_].add(h_)
        nomes = texto(t["nom_usina"]).to_pylist()
        combs = texto(_col(t, "nom_combustivel") or pa.nulls(n, pa.string())).to_pylist()
        sms = sm.to_pylist()
        for i in range(n):
            k = chaves[i]
            reg = cadastro.setdefault(k, {"nome": nomes[i], "sm": sms[i], "ceg": ceg_l[i] if ceg_l[i] != "-" else "",
                                          "cod": cod_l[i], "combustivel": ""})
            reg["nome"], reg["sm"] = nomes[i], sms[i]
            if cod_l[i] is not None:
                reg["cod"] = cod_l[i]
            if combs[i]:
                reg["combustivel"] = combs[i]
    return {"diario": dict(diario), "usina_mes": dict(usina_mes), "presentes": dict(presentes),
            "cadastro": cadastro, "horas_dia": {k: len(v) for k, v in horas.items()}, "rel": rel}


def particao_motivos(valores):
    """{motivo: MWh} + total → (partes, residuo). Motivo sem valor (coluna que não existia
    no período) fica None e não entra na soma."""
    partes = {m: valores.get(m) for m, _, _ in MOTIVOS}
    total = valores.get("total")
    if total is None:
        return partes, None
    return partes, total - sum(v for v in partes.values() if v is not None)


# ---------------------------------------------------------------- CVU

COLS_CVU = ["dat_iniciosemana", "dat_fimsemana", "ano_referencia", "mes_referencia", "num_revisao",
            "nom_semanaoperativa", "cod_usinaplanejamento", "cod_modelos", "id_subsistema", "nom_usina", "val_cvu"]


def _data(v):
    if v is None:
        return None
    if isinstance(v, (datetime, date)):
        return v.strftime("%Y-%m-%d")
    return str(v).strip()[:10] or None


def le_cvu(tabelas):
    """Linhas do CVU por usina e semana operativa: {(inicio_semana, cod): {...}}.

    Linhas repetidas idênticas contam uma vez; mesma (semana, usina) com CVU diferente é
    conflito e fica registrado (as duas versões), sem escolha silenciosa."""
    pa, pc = _pa()
    out, conflitos, repetidas, linhas = {}, [], 0, 0
    for t in tabelas:
        d = t.to_pydict()
        n = t.num_rows
        linhas += n
        cods = d.get("cod_usinaplanejamento") or d.get("cod_modelos") or [None] * n
        for i in range(n):
            cod = cods[i]
            ini = _data(d["dat_iniciosemana"][i])
            if cod is None or ini is None:
                continue
            cvu = d["val_cvu"][i]
            cvu = float(cvu) if cvu not in (None, "") else None
            reg = {"fim": _data(d["dat_fimsemana"][i]), "ano_ref": d["ano_referencia"][i], "mes_ref": d["mes_referencia"][i],
                   "revisao": d["num_revisao"][i], "estudo": (d.get("nom_semanaoperativa") or [""] * n)[i],
                   "sm": (d["id_subsistema"][i] or "").strip().upper(), "nome": (d["nom_usina"][i] or "").strip(), "cvu": cvu}
            k = (ini, int(cod))
            if k in out:
                if out[k]["cvu"] == cvu:
                    repetidas += 1
                    continue
                conflitos.append({"semana": ini, "cod": int(cod), "cvus": [out[k]["cvu"], cvu]})
                continue
            out[k] = reg
    return {"linhas": out, "conflitos": conflitos, "repetidas": repetidas, "lidas": linhas}


# ---------------------------------------------------------------- restrições (constrained-off)

COLS_COFF = ["din_instante", "id_subsistema", "id_estado", "nom_usina", "id_ons", "ceg", "val_geracao",
             "val_geracaolimitada", "val_disponibilidade", "val_geracaoreferencia", "val_geracaoreferenciafinal",
             "cod_razaorestricao", "cod_origemrestricao", "dsc_restricao", "nom_pontoconexao", "nom_agenteoperador",
             "val_geracaonaorealizadaapurada"]
RAZOES = ("REL", "CNF", "ENE", "PAR")
ROTULO_RAZAO = {
    "REL": "Razão elétrica (indisponibilidade externa)",
    "CNF": "Confiabilidade (requisitos de confiabilidade)",
    "ENE": "Razão energética",
    "PAR": "Restrição indicada no parecer de acesso",
    "SEM": "Limitação sem razão informada",
}
HORAS_MEIA = 0.5


def agrega_restricao(tabelas):
    """Agrega lotes das restrições por constrained-off (eólicas ou fotovoltaicas).

    Energia não gerada estimada (MWh) de uma meia hora limitada pelo ONS = max(geração de
    referência − geração verificada, 0) × 0,5 h, a mesma regra da Geração Não Realizada
    Apurada (GNRa) do dicionário, versão 1.5. Meia hora sem limitação (geração limitada
    nula) não tem corte, mesmo que a referência supere a geração: diferença ali é falta de
    recurso, indisponibilidade da usina ou erro de estimativa, não restrição.

    - diario_sm: {(dia, sm): {ger, ref, meias, lim, lim_sem_ref, ger_nula}};
    - diario_razao: {(dia, sm, razao, origem): {eng, gnra, gnra_n, meias}};
    - pot_max: {(dia, sm|'SIN'): (MW, instante)} maior corte simultâneo numa meia hora;
    - usina_mes: {(mes, id_ons): {ger, eng_<razao>..., meias, lim}};
    - descricoes_mes: {(mes, descrição): eng}; cadastro por id_ons; rel."""
    pa, pc = _pa()
    diario_sm = defaultdict(lambda: {"ger": 0.0, "ref": 0.0, "meias": 0, "lim": 0, "lim_sem_ref": 0, "ger_nula": 0})
    diario_razao = defaultdict(lambda: {"eng": 0.0, "gnra": 0.0, "gnra_n": 0, "meias": 0})
    corte_meia = defaultdict(float)
    usina_mes = defaultdict(lambda: defaultdict(float))
    desc_mes = defaultdict(float)
    cadastro = {}
    rel = {"linhas": 0, "invalidos": 0, "negativos": 0, "subsistema_desconhecido": 0, "fora_da_grade": 0,
           "primeiro": None, "ultimo": None, "razao_desconhecida": 0, "gnra_diverge": 0, "com_gnra": 0}
    for t in tabelas:
        n = t.num_rows
        rel["linhas"] += n
        dia, inst_txt, minuto, inst = _dia_hora(t["din_instante"])
        _rel_instantes(rel, inst, minuto, [0, 30])
        sm = pc.utf8_upper(texto(t["id_subsistema"]))
        rel["subsistema_desconhecido"] += pc.sum(pc.cast(pc.invert(pc.is_in(sm, value_set=pa.array(SUBSISTEMAS))), pa.int64())).as_py() or 0
        g, i1 = numero(t["val_geracao"])
        lim_v, i2 = numero(t["val_geracaolimitada"])
        ref, i3 = numero(t["val_geracaoreferencia"])
        gcol = _col(t, "val_geracaonaorealizadaapurada")
        gnra, i4 = numero(gcol) if gcol is not None else (pa.nulls(n, pa.float64()), 0)
        rel["invalidos"] += i1 + i2 + i3 + i4
        for col in (g, ref, lim_v):
            rel["negativos"] += pc.sum(pc.cast(pc.less(col, 0), pa.int64())).as_py() or 0
        limitada = pc.is_valid(lim_v)
        raz = pc.utf8_upper(texto(_col(t, "cod_razaorestricao") or pa.nulls(n, pa.string())))
        raz = pc.if_else(pc.and_(limitada, pc.equal(raz, "")), pa.scalar("SEM"), raz)
        orig = pc.utf8_upper(texto(_col(t, "cod_origemrestricao") or pa.nulls(n, pa.string())))
        rel["razao_desconhecida"] += pc.sum(pc.cast(pc.and_(limitada, pc.invert(pc.is_in(raz, value_set=pa.array(list(RAZOES) + ["SEM"])))), pa.int64())).as_py() or 0
        corte = pc.if_else(limitada, pc.max_element_wise(pc.subtract(ref, g), pa.scalar(0.0)), pa.scalar(None, pa.float64()))
        # divergência entre o GNRa publicado e a regra (quando a fonte publica o campo)
        tem = pc.and_(pc.is_valid(gnra), pc.is_valid(corte))
        dif = pc.abs(pc.subtract(gnra, corte))
        rel["com_gnra"] += pc.sum(pc.cast(tem, pa.int64())).as_py() or 0
        rel["gnra_diverge"] += pc.sum(pc.cast(pc.and_(tem, pc.greater(dif, 0.001)), pa.int64())).as_py() or 0
        um = pa.array([1] * n, pa.int64())
        lim_i = pc.cast(limitada, pa.int64())
        lim_sem_ref = pc.cast(pc.and_(limitada, pc.is_null(ref)), pa.int64())
        ger_nula = pc.cast(pc.is_null(g), pa.int64())
        ido = texto(_col(t, "id_ons") or pa.nulls(n, pa.string()))
        mes = pc.utf8_slice_codeunits(dia, 0, 7)
        desc = texto(_col(t, "dsc_restricao") or pa.nulls(n, pa.string()))
        tab = pa.table({"dia": dia, "mes": mes, "inst": inst_txt, "sm": sm, "raz": raz, "orig": orig, "ido": ido,
                        "desc": desc, "g": g, "ref": ref, "corte": corte, "gnra": gnra, "um": um, "lim": lim_i,
                        "lsr": lim_sem_ref, "gn": ger_nula})
        a = tab.group_by(["dia", "sm"], use_threads=False).aggregate(
            [("g", "sum"), ("ref", "sum"), ("um", "sum"), ("lim", "sum"), ("lsr", "sum"), ("gn", "sum")]).to_pydict()
        for i in range(len(a["dia"])):
            x = diario_sm[(a["dia"][i], a["sm"][i])]
            x["ger"] += (a["g_sum"][i] or 0.0) * HORAS_MEIA
            x["ref"] += (a["ref_sum"][i] or 0.0) * HORAS_MEIA
            x["meias"] += a["um_sum"][i]
            x["lim"] += a["lim_sum"][i]
            x["lim_sem_ref"] += a["lsr_sum"][i]
            x["ger_nula"] += a["gn_sum"][i]
        lim_tab = tab.filter(limitada)
        if lim_tab.num_rows:
            a = lim_tab.group_by(["dia", "sm", "raz", "orig"], use_threads=False).aggregate(
                [("corte", "sum"), ("gnra", "sum"), ("gnra", "count"), ("um", "sum")]).to_pydict()
            for i in range(len(a["dia"])):
                x = diario_razao[(a["dia"][i], a["sm"][i], a["raz"][i], a["orig"][i])]
                x["eng"] += (a["corte_sum"][i] or 0.0) * HORAS_MEIA
                x["gnra"] += (a["gnra_sum"][i] or 0.0) * HORAS_MEIA
                x["gnra_n"] += a["gnra_count"][i]
                x["meias"] += a["um_sum"][i]
            a = lim_tab.group_by(["inst", "sm"], use_threads=False).aggregate([("corte", "sum")]).to_pydict()
            for i in range(len(a["inst"])):
                corte_meia[(a["inst"][i], a["sm"][i])] += a["corte_sum"][i] or 0.0
            a = lim_tab.group_by(["mes", "ido", "raz"], use_threads=False).aggregate([("corte", "sum"), ("um", "sum")]).to_pydict()
            for i in range(len(a["mes"])):
                x = usina_mes[(a["mes"][i], a["ido"][i] or "sem_id_ons")]
                x[f"eng_{a['raz'][i]}"] += (a["corte_sum"][i] or 0.0) * HORAS_MEIA
                x["lim"] += a["um_sum"][i]
            a = lim_tab.group_by(["mes", "desc"], use_threads=False).aggregate([("corte", "sum")]).to_pydict()
            for i in range(len(a["mes"])):
                desc_mes[(a["mes"][i], a["desc"][i] or "sem descrição")] += (a["corte_sum"][i] or 0.0) * HORAS_MEIA
        a = tab.group_by(["mes", "ido"], use_threads=False).aggregate([("g", "sum"), ("um", "sum")]).to_pydict()
        for i in range(len(a["mes"])):
            x = usina_mes[(a["mes"][i], a["ido"][i] or "sem_id_ons")]
            x["ger"] += (a["g_sum"][i] or 0.0) * HORAS_MEIA
            x["meias"] += a["um_sum"][i]
        d = pa.table({"ido": ido, "nome": texto(t["nom_usina"]), "sm": sm, "uf": texto(t["id_estado"]),
                      "ceg": texto(_col(t, "ceg") or pa.nulls(n, pa.string())),
                      "ponto": texto(_col(t, "nom_pontoconexao") or pa.nulls(n, pa.string())),
                      "agente": texto(_col(t, "nom_agenteoperador") or pa.nulls(n, pa.string()))}).to_pydict()
        for i in range(n):
            k = d["ido"][i] or "sem_id_ons"
            reg = cadastro.setdefault(k, {})
            for c in ("nome", "sm", "uf", "ceg", "ponto", "agente"):
                if d[c][i]:
                    reg[c] = d[c][i]
    # maior corte simultâneo por dia (MW numa meia hora), por subsistema e no SIN
    pot = {}
    sin = defaultdict(float)
    for (inst, sm_), v in corte_meia.items():
        sin[inst] += v
        k = (inst[:10], sm_)
        if k not in pot or v > pot[k][0]:
            pot[k] = (v, inst)
    for inst, v in sin.items():
        k = (inst[:10], "SIN")
        if k not in pot or v > pot[k][0]:
            pot[k] = (v, inst)
    return {"diario_sm": {k: dict(v) for k, v in diario_sm.items()}, "diario_razao": {k: dict(v) for k, v in diario_razao.items()},
            "pot_max": pot, "usina_mes": {k: dict(v) for k, v in usina_mes.items()}, "descricoes_mes": dict(desc_mes),
            "cadastro": cadastro, "rel": rel}


COLS_COFF_DET = ["din_instante", "id_subsistema", "nom_modalidadeoperacao", "nom_conjuntousina", "nom_usina", "id_ons",
                 "ceg", "val_geracaoestimada", "val_geracaoverificada", "id_ons_conjuntousina", "flg_geracaorestrita"]


def agrega_restricao_detalhe(tabelas):
    """Agrega o detalhamento por usina das restrições (usinas dentro dos conjuntos).

    - mes: {mes: {usinas, conjuntos, ger, est, meias_restritas}} (usinas e conjuntos
      distintos com linha no mês);
    - conjunto_mes: {(mes, id_ons_do_conjunto_ou_usina): ger} para conferir a soma das
      usinas com a geração do conjunto no arquivo principal."""
    pa, pc = _pa()
    usinas, conjuntos = defaultdict(set), defaultdict(set)
    tot = defaultdict(lambda: {"ger": 0.0, "est": 0.0, "meias_restritas": 0, "linhas": 0})
    conj_mes = defaultdict(float)
    for t in tabelas:
        n = t.num_rows
        dia, _, _, _ = _dia_hora(t["din_instante"])
        mes = pc.utf8_slice_codeunits(dia, 0, 7).to_pylist()
        g, _ = numero(t["val_geracaoverificada"])
        e, _ = numero(t["val_geracaoestimada"])
        ido = texto(t["id_ons"]).to_pylist()
        conj = texto(_col(t, "id_ons_conjuntousina") or pa.nulls(n, pa.string())).to_pylist()
        flg = _col(t, "flg_geracaorestrita")
        flg = pc.fill_null(pc.cast(flg, pa.int64()), 0).to_pylist() if flg is not None else [0] * n
        gl, el = g.to_pylist(), e.to_pylist()
        for i in range(n):
            m = mes[i]
            usinas[m].add(ido[i])
            chave = conj[i] or ido[i]
            if conj[i]:
                conjuntos[m].add(conj[i])
            x = tot[m]
            x["linhas"] += 1
            if gl[i] is not None:
                x["ger"] += gl[i] * HORAS_MEIA
                conj_mes[(m, chave)] += gl[i] * HORAS_MEIA
            if el[i] is not None:
                x["est"] += el[i] * HORAS_MEIA
            if flg[i] == 1:
                x["meias_restritas"] += 1
    return {"mes": {m: {**v, "usinas": len(usinas[m]), "conjuntos": len(conjuntos[m])} for m, v in tot.items()},
            "conjunto_mes": dict(conj_mes)}


# ---------------------------------------------------------------- fator de capacidade (ONS)

COLS_FC = ["din_instante", "id_subsistema", "id_estado", "nom_tipousina", "nom_usina_conjunto", "id_ons", "ceg",
           "nom_modalidadeoperacao", "val_geracaoverificada", "val_capacidadeinstalada", "val_latitudesecoletora",
           "val_longitudesecoletora", "val_latitudepontoconexao", "val_longitudepontoconexao", "nom_pontoconexao"]


def agrega_fator_capacidade(tabelas):
    """Agrega o Fator de Capacidade de Geração Eólica e Solar do ONS.

    O ONS publica, por usina ou conjunto e hora, a geração verificada e a capacidade
    instalada considerada naquela hora. Somamos energia (MWh) e capacidade-hora (MW × 1 h)
    no mês: FC do ONS no mês = Σ geração ÷ Σ capacidade, só nas horas com os dois valores.

    - usina_mes: {(mes, id_ons): [ger, cap, horas]}; tipo_mes: {(mes, sm, tipo): [ger, cap, horas]};
    - cadastro: {id_ons: {nome, tipo, sm, uf, ceg, modalidade, lat, lon, lat_pc, lon_pc, ponto}}."""
    pa, pc = _pa()
    usina_mes = defaultdict(lambda: [0.0, 0.0, 0])
    tipo_mes = defaultdict(lambda: [0.0, 0.0, 0])
    cadastro = {}
    rel = {"linhas": 0, "invalidos": 0, "sem_par": 0, "primeiro": None, "ultimo": None, "fora_da_grade": 0}
    for t in tabelas:
        n = t.num_rows
        rel["linhas"] += n
        dia, _, minuto, inst = _dia_hora(t["din_instante"])
        _rel_instantes(rel, inst, minuto, [0])
        g, i1 = numero(t["val_geracaoverificada"])
        cap, i2 = numero(t["val_capacidadeinstalada"])
        rel["invalidos"] += i1 + i2
        par = pc.and_(pc.is_valid(g), pc.is_valid(cap))
        rel["sem_par"] += n - (pc.sum(pc.cast(par, pa.int64())).as_py() or 0)
        g2 = pc.if_else(par, g, pa.scalar(None, pa.float64()))
        c2 = pc.if_else(par, cap, pa.scalar(None, pa.float64()))
        mes = pc.utf8_slice_codeunits(dia, 0, 7)
        sm = pc.utf8_upper(texto(t["id_subsistema"]))
        tipo = texto(t["nom_tipousina"])
        ido = texto(t["id_ons"])
        tab = pa.table({"mes": mes, "sm": sm, "tipo": tipo, "ido": ido, "g": g2, "c": c2})
        a = tab.group_by(["mes", "ido"], use_threads=False).aggregate([("g", "sum"), ("c", "sum"), ("g", "count")]).to_pydict()
        for i in range(len(a["mes"])):
            x = usina_mes[(a["mes"][i], a["ido"][i])]
            x[0] += a["g_sum"][i] or 0.0
            x[1] += a["c_sum"][i] or 0.0
            x[2] += a["g_count"][i]
        a = tab.group_by(["mes", "sm", "tipo"], use_threads=False).aggregate([("g", "sum"), ("c", "sum"), ("g", "count")]).to_pydict()
        for i in range(len(a["mes"])):
            x = tipo_mes[(a["mes"][i], a["sm"][i], a["tipo"][i])]
            x[0] += a["g_sum"][i] or 0.0
            x[1] += a["c_sum"][i] or 0.0
            x[2] += a["g_count"][i]
        d = {c: (t[c].to_pylist() if c in t.column_names else [None] * n)
             for c in ("id_ons", "nom_usina_conjunto", "nom_tipousina", "id_subsistema", "id_estado", "ceg",
                       "nom_modalidadeoperacao", "val_latitudesecoletora", "val_longitudesecoletora",
                       "val_latitudepontoconexao", "val_longitudepontoconexao", "nom_pontoconexao")}
        vistos = set()
        for i in range(n - 1, -1, -1):
            k = (d["id_ons"][i] or "").strip()
            if not k or k in vistos:
                continue
            vistos.add(k)
            cadastro[k] = {"nome": (d["nom_usina_conjunto"][i] or "").strip(), "tipo": (d["nom_tipousina"][i] or "").strip(),
                           "sm": (d["id_subsistema"][i] or "").strip().upper(), "uf": (d["id_estado"][i] or "").strip(),
                           "ceg": (d["ceg"][i] or "").strip(), "modalidade": (d["nom_modalidadeoperacao"][i] or "").strip(),
                           "lat": d["val_latitudesecoletora"][i], "lon": d["val_longitudesecoletora"][i],
                           "lat_pc": d["val_latitudepontoconexao"][i], "lon_pc": d["val_longitudepontoconexao"][i],
                           "ponto": (d["nom_pontoconexao"][i] or "").strip()}
    return {"usina_mes": dict(usina_mes), "tipo_mes": dict(tipo_mes), "cadastro": cadastro, "rel": rel}


# ---------------------------------------------------------------- capacidade instalada

def le_capacidade(tabelas):
    """Unidades geradoras do conjunto Capacidade Instalada de Geração (sem histórico: o
    arquivo é o retrato do dia). Chave = código do equipamento (único no arquivo)."""
    out = {}
    rel = {"linhas": 0, "sem_codigo": 0, "codigo_repetido": 0, "potencia_invalida": 0, "sem_entrada_operacao": 0}
    for t in tabelas:
        d = t.to_pydict()
        for i in range(t.num_rows):
            rel["linhas"] += 1
            cod = (d["cod_equipamento"][i] or "").strip()
            if not cod:
                rel["sem_codigo"] += 1
                continue
            if cod in out:
                rel["codigo_repetido"] += 1
            p = d["val_potenciaefetiva"][i]
            try:
                p = float(p) if p not in (None, "") else None
            except ValueError:
                p = None
            if p is None or p <= 0:
                rel["potencia_invalida"] += 1
            ent = _data(d["dat_entradaoperacao"][i])
            if not ent:
                rel["sem_entrada_operacao"] += 1
            out[cod] = {
                "sm": (d["id_subsistema"][i] or "").strip().upper(), "uf": (d["id_estado"][i] or "").strip(),
                "modalidade": (d["nom_modalidadeoperacao"][i] or "").strip(), "tipo": (d["nom_tipousina"][i] or "").strip(),
                "usina": (d["nom_usina"][i] or "").strip(), "ceg": (d["ceg"][i] or "").strip(),
                "combustivel": (d["nom_combustivel"][i] or "").strip(), "entrada_teste": _data(d["dat_entradateste"][i]),
                "entrada_operacao": ent, "desativacao": _data(d["dat_desativacao"][i]), "potencia_mw": p,
                "agente": (d["nom_agenteproprietario"][i] or "").strip(),
            }
    return out, rel


def ceg_base(ceg):
    """CEG sem o sufixo de versão ('.01', '.02'): mesmo empreendimento em outra versão do
    cadastro da ANEEL. Casamento por código oficial, nunca por nome."""
    ceg = (ceg or "").strip()
    m = re.match(r"^(.*\d-\d)\.\d{2}$", ceg)
    return m.group(1) if m else ceg


def unidade_opera_em(u, dia):
    """Unidade em operação comercial no dia (AAAA-MM-DD): entrada ≤ dia < desativação."""
    ent, des = u.get("entrada_operacao"), u.get("desativacao")
    return bool(ent) and ent <= dia and (not des or dia < des)


def potencia_operacional_media(unidades, mes):
    """Potência em operação comercial média no mês (MW): média diária da soma das unidades
    em operação. Unidade que entra ou sai no meio do mês pesa pelos dias em operação."""
    ini = date.fromisoformat(mes + "-01")
    fim = (ini.replace(day=28) + timedelta(days=4)).replace(day=1)
    n = (fim - ini).days
    total = 0.0
    for u in unidades:
        p = u.get("potencia_mw")
        if not p or p <= 0:
            continue
        ent, des = u.get("entrada_operacao"), u.get("desativacao")
        if not ent:
            continue
        a = max(ini, date.fromisoformat(ent))
        b = min(fim, date.fromisoformat(des)) if des else fim
        dias = (b - a).days
        if dias > 0:
            total += p * dias
    return total / n


def dias_do_mes(mes):
    ini = date.fromisoformat(mes + "-01")
    fim = (ini.replace(day=28) + timedelta(days=4)).replace(day=1)
    return (fim - ini).days


# ---------------------------------------------------------------- cadastros pequenos

def le_tabela(tabelas):
    """Linhas de uma tabela pequena como dicts de texto aparado."""
    out = []
    for t in tabelas:
        d = t.to_pydict()
        nomes = list(d)
        for i in range(t.num_rows):
            out.append({k: (_data(d[k][i]) if isinstance(d[k][i], (datetime, date)) else
                            (d[k][i].strip() if isinstance(d[k][i], str) else d[k][i])) for k in nomes})
    return out


def membros_conjunto(relacoes, id_conjunto, dia):
    """CEGs das usinas de um conjunto no dia, pela vigência do relacionamento publicada
    pelo ONS (início ≤ dia e, quando há fim, dia ≤ fim)."""
    out = []
    for r in relacoes:
        if r.get("id_ons_conjunto") != id_conjunto:
            continue
        ini, fim = r.get("dat_iniciorelacionamento"), r.get("dat_fimrelacionamento")
        if ini and ini <= dia and (not fim or dia <= fim):
            out.append(r.get("ceg"))
    return out
