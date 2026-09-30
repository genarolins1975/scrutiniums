"""Leitura e agregação dos conjuntos de qualidade do serviço de distribuição (ANEEL).

Funções puras (recebem linhas já lidas, devolvem agregados) para que os testes
reconciliem cada regra com amostras reais pequenas, sem rede e sem o arquivo inteiro.

Regras de agregação (PRODIST, Módulo 8, e verificação empírica documentada em
docs/observatorios/energia/modulos/qualidade.md):

* DEC e FEC do conjunto são publicados por mês (NumPeriodoIndice = mês). DEC em horas
  e centésimos de hora; FEC em interrupções e centésimos de interrupção. 1,50 h é uma
  hora e meia, não uma hora e cinquenta minutos.
* Indicador de um agregado de conjuntos (distribuidora, Brasil) no mês:
  Σ(DEC_c × UC_c) ÷ Σ UC_c, em que UC_c é o número de unidades consumidoras do
  conjunto no mês (NumCon). É a própria definição do DEC (Σ DIC ÷ número de UCs)
  aplicada à união dos conjuntos.
* Indicador anual = soma dos 12 valores mensais. O ano só é "completo" com os 12 meses.
* Limite anual de um agregado: média dos limites anuais dos conjuntos ponderada pelo
  número médio de UCs de cada conjunto no ano. Com essa regra, a razão apurado ÷ limite
  reproduz o DGC publicado pela ANEEL no ranking de continuidade (ver testes).
* Nulo nunca vira zero: conjunto sem DEC ou sem NumCon no mês fica fora do numerador e
  do denominador daquele mês, e a cobertura (fração das UCs com dado) é publicada.
"""
import collections
import csv
import html
import io
import os
import re
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base, entidades  # noqa: E402

# ---------------------------------------------------------------------------
# Domínio dos indicadores (dominio-indicadores.csv, conferido em 30/09/2026)
# ---------------------------------------------------------------------------

# Parcelas desagregadas publicadas a partir de 2010. O DEC "apurado" (o que é comparado
# com o limite) é, desde 2022, exatamente DECIP + DECIND em todos os registros; em
# 2010-2021 parte dos conjuntos incluía também parcelas externas (medido, não suposto).
PARCELAS = {
    "IP": "interna, programada",
    "IND": "interna, não programada, não expurgável",
    "INE": "interna, não programada, em situação de emergência",
    "INC": "interna, não programada, em dia crítico",
    "IPC": "interna, programada, em dia crítico",
    "INO": "interna, não programada, racionamento ou alívio de carga determinado pelo ONS",
    "XN": "externa ao sistema de distribuição, não programada",
    "XP": "externa ao sistema de distribuição, programada",
    "XNC": "externa, não programada, em dia crítico",
    "XPC": "externa, programada, em dia crítico",
}
# Agrupamento publicado (para leitura): cada parcela pertence a exatamente um grupo.
GRUPOS_PARCELAS = {
    "apurado": ("IP", "IND"),
    "emergencia": ("INE",),
    "dia_critico": ("INC", "IPC"),
    "externa": ("XN", "XP", "XNC", "XPC"),
    "ons": ("INO",),
}
ROTULO_GRUPO = {
    "apurado": "Apurado para comparação com o limite (programadas e não programadas de origem interna, sem expurgos)",
    "emergencia": "Situação de emergência (expurgada)",
    "dia_critico": "Dia crítico (expurgada)",
    "externa": "Origem externa ao sistema de distribuição (expurgada)",
    "ons": "Racionamento ou alívio de carga pelo ONS (expurgada)",
}
SIGLAS_CONTINUIDADE = {"DEC", "FEC", "NumCon"} | {f"{i}{p}" for i in ("DEC", "FEC") for p in PARCELAS}


def ler_parquet_bronze(caminho_relativo, colunas, lote=500_000):
    """Itera lotes (dict de listas) de um Parquet guardado no bronze (gzip). O Parquet
    precisa de arquivo com acesso aleatório: descomprime para um temporário."""
    import pyarrow.parquet as pq
    fd, tmp = tempfile.mkstemp(prefix="qualidade-", suffix=".parquet")
    os.close(fd)
    try:
        with base.abre_bronze(caminho_relativo) as src, open(tmp, "wb") as dst:
            shutil.copyfileobj(src, dst, 1 << 20)
        pf = pq.ParquetFile(tmp)
        disponiveis = set(pf.schema_arrow.names)
        faltam = [c for c in colunas if c not in disponiveis]
        if faltam:
            raise ValueError(f"{caminho_relativo}: colunas ausentes {faltam} (mudança de esquema da fonte)")
        for b in pf.iter_batches(batch_size=lote, columns=list(colunas)):
            yield b.to_pydict()
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


def _int(v):
    if v is None:
        return None
    if isinstance(v, int):
        return v
    s = str(v).strip()
    if not s:
        return None
    try:
        return int(float(s.replace(",", ".")))
    except ValueError:
        return None


def _num(v):
    """Valor numérico da fonte (float nativo do Parquet ou texto com vírgula decimal)."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if not s:
        return None
    if s.startswith(","):
        s = "0" + s
    s = s.replace(".", "").replace(",", ".") if "," in s else s
    try:
        return float(s)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Continuidade (DEC/FEC por conjunto e mês)
# ---------------------------------------------------------------------------

def conjuntos_mes(lotes):
    """{(cnpj14, conj, ano, mes): {sigla: valor}} e cadastro {conj: {cnpj, sigla, nome}}.

    Só entram as siglas de SIGLAS_CONTINUIDADE; linhas sem conjunto (NumConsAgt da
    série antiga) ficam fora. Duplicata com valor diferente para a mesma chave é
    contada e devolvida (não é resolvida em silêncio)."""
    dados = collections.defaultdict(dict)
    cadastro = {}
    conflitos = 0
    for d in lotes:
        cols = zip(d["IdeConjUndConsumidoras"], d["DscConjUndConsumidoras"], d["SigAgente"], d["NumCNPJ"],
                   d["SigIndicador"], d["AnoIndice"], d["NumPeriodoIndice"], d["VlrIndiceEnviado"])
        for conj, nome, sigla, cnpj, sig, ano, mes, valor in cols:
            if conj is None or sig not in SIGLAS_CONTINUIDADE:
                continue
            c14 = entidades.cnpj(cnpj)
            conj, ano, mes = _int(conj), _int(ano), _int(mes)
            if not c14 or conj is None or ano is None or mes is None or not 1 <= mes <= 12:
                continue
            v = _num(valor)
            if v is None:
                continue
            k = (c14, conj, ano, mes)
            ant = dados[k].get(sig)
            if ant is not None and abs(ant - v) > 1e-9:
                conflitos += 1
            dados[k][sig] = v
            cad = cadastro.setdefault(conj, {})
            # cadastro vigente = o do período mais recente em que o conjunto aparece
            if (ano, mes) >= cad.get("_ref", (0, 0)):
                cadastro[conj] = {"cnpj": c14, "sigla": (sigla or "").strip() or None,
                                  "nome": (nome or "").strip() or None, "_ref": (ano, mes)}
    return dict(dados), cadastro, conflitos


def _ref(ano, mes):
    return f"{ano:04d}-{mes:02d}"


def agrega_mensal(dados, chave_grupo):
    """Agregação ponderada por UC no mês, para o grupo definido por chave_grupo(cnpj, conj).

    Devolve {(grupo, 'AAAA-MM'): {"dec","fec","ucs","ucs_fec","ucs_total","nconj","nconj_total"}}
    em que ucs é o denominador do DEC (conjuntos com DEC e NumCon), ucs_fec o do FEC e
    ucs_total as UCs de todos os conjuntos com NumCon no mês (para a cobertura)."""
    acc = collections.defaultdict(lambda: [0.0, 0.0, 0.0, 0.0, 0.0, 0, 0])
    for (c14, conj, ano, mes), s in dados.items():
        n = s.get("NumCon")
        if n is None or n <= 0:
            continue
        a = acc[(chave_grupo(c14, conj), _ref(ano, mes))]
        a[4] += n
        a[6] += 1
        if s.get("DEC") is not None:
            a[0] += s["DEC"] * n
            a[2] += n
            a[5] += 1
        if s.get("FEC") is not None:
            a[1] += s["FEC"] * n
            a[3] += n
    out = {}
    for k, (nd, nf, ud, uf, ut, nc, nct) in acc.items():
        out[k] = {"dec": nd / ud if ud else None, "fec": nf / uf if uf else None,
                  "ucs": ud, "ucs_fec": uf, "ucs_total": ut, "nconj": nc, "nconj_total": nct}
    return out


def agrega_parcelas_anual(dados, chave_grupo):
    """Parcelas anuais do grupo: Σ_meses [Σ_c P_c × UC_c ÷ Σ_c UC_c], com a soma em cada
    mês restrita aos conjuntos que informaram a parcela, e a cobertura em UC-mês
    (fração das UCs-mês do grupo com a parcela informada). Também o total de todas as
    parcelas informadas ("DEC com todas as origens publicadas").

    Devolve {(grupo, ano): {"DECIP": v, ..., "cob.DECIP": f, ..., "DECTOT": v, "FECTOT": v}}."""
    num = collections.defaultdict(float)
    den = collections.defaultdict(float)
    ucs_mes = collections.defaultdict(float)
    for (c14, conj, ano, mes), s in dados.items():
        n = s.get("NumCon")
        if n is None or n <= 0:
            continue
        g = chave_grupo(c14, conj)
        ucs_mes[(g, ano, mes)] += n
        for ind in ("DEC", "FEC"):
            presentes = [p for p in PARCELAS if s.get(ind + p) is not None]
            for p in presentes:
                num[(g, ano, mes, ind + p)] += s[ind + p] * n
                den[(g, ano, mes, ind + p)] += n
            # total por conjunto: exige as duas parcelas do apurado (sem elas o total não é
            # comparável); soma as demais que vierem informadas
            if s.get(ind + "IP") is not None and s.get(ind + "IND") is not None:
                num[(g, ano, mes, ind + "TOT")] += sum(s[ind + p] for p in presentes) * n
                den[(g, ano, mes, ind + "TOT")] += n
    anual = collections.defaultdict(lambda: collections.defaultdict(float))
    cobertura = collections.defaultdict(lambda: collections.defaultdict(float))
    meses = collections.defaultdict(lambda: collections.defaultdict(set))
    ucs_ano = collections.defaultdict(float)
    for (g, ano, mes), u in ucs_mes.items():
        ucs_ano[(g, ano)] += u
    for (g, ano, mes, sig), n_ in num.items():
        d_ = den[(g, ano, mes, sig)]
        if d_:
            anual[(g, ano)][sig] += n_ / d_
            cobertura[(g, ano)][sig] += d_
            meses[(g, ano)][sig].add(mes)
    out = {}
    for k, vals in anual.items():
        linha = {}
        for sig, v in vals.items():
            linha[sig] = v
            linha["cob." + sig] = cobertura[k][sig] / ucs_ano[k] if ucs_ano[k] else None
            linha["meses." + sig] = len(meses[k][sig])
        out[k] = linha
    return out


def identidade_apurado(dados, tolerancia=0.0101):
    """Por ano: conjunto-meses em que DEC = DECIP + DECIND e FEC = FECIP + FECIND dentro de
    0,01 (a fonte arredonda cada valor ao centésimo; a soma de dois arredondamentos difere
    do total arredondado em até 0,01). {ano: {"dec_ok","dec_n","fec_ok","fec_n"}}."""
    out = collections.defaultdict(lambda: {"dec_ok": 0, "dec_n": 0, "fec_ok": 0, "fec_n": 0})
    for (_, _, ano, _), s in dados.items():
        for ind, k in (("DEC", "dec"), ("FEC", "fec")):
            if s.get(ind) is None or s.get(ind + "IP") is None or s.get(ind + "IND") is None:
                continue
            out[ano][k + "_n"] += 1
            if abs(s[ind] - s[ind + "IP"] - s[ind + "IND"]) <= tolerancia:
                out[ano][k + "_ok"] += 1
    return dict(out)


def conjuntos_anual(dados):
    """{(conj, ano): {"cnpj","dec","fec","meses","meses_fec","ucs_media"}}: soma dos meses
    informados (o ano só é completo com 12) e número médio de UCs nos meses com NumCon."""
    acc = {}
    for (c14, conj, ano, mes), s in dados.items():
        a = acc.setdefault((conj, ano), {"cnpj": c14, "dec": 0.0, "fec": 0.0, "meses": 0, "meses_fec": 0,
                                         "_ucs": 0.0, "_nm": 0})
        a["cnpj"] = c14
        if s.get("DEC") is not None:
            a["dec"] += s["DEC"]
            a["meses"] += 1
        if s.get("FEC") is not None:
            a["fec"] += s["FEC"]
            a["meses_fec"] += 1
        if s.get("NumCon") is not None and s["NumCon"] > 0:
            a["_ucs"] += s["NumCon"]
            a["_nm"] += 1
    out = {}
    for k, a in acc.items():
        out[k] = {"cnpj": a["cnpj"], "dec": a["dec"] if a["meses"] else None,
                  "fec": a["fec"] if a["meses_fec"] else None, "meses": a["meses"], "meses_fec": a["meses_fec"],
                  "ucs_media": a["_ucs"] / a["_nm"] if a["_nm"] else None}
    return out


def limite_agregado(conj_anual, limites, grupo_de_conj, ano):
    """Limite anual de DEC e FEC de cada grupo: Σ L_c × UCmédia_c ÷ Σ UCmédia_c sobre os
    conjuntos do grupo com dado no ano e limite publicado para o ano; com a cobertura
    (UCs com limite ÷ UCs do grupo). {grupo: {"dec","fec","cob_dec","cob_fec"}}."""
    acc = collections.defaultdict(lambda: [0.0, 0.0, 0.0, 0.0, 0.0])
    for (conj, a), v in conj_anual.items():
        if a != ano or not v["ucs_media"]:
            continue
        g = grupo_de_conj(conj, v["cnpj"])
        w = v["ucs_media"]
        acc[g][4] += w
        ld = limites.get((conj, ano, "DEC"))
        lf = limites.get((conj, ano, "FEC"))
        if ld is not None:
            acc[g][0] += ld * w
            acc[g][1] += w
        if lf is not None:
            acc[g][2] += lf * w
            acc[g][3] += w
    return {g: {"dec": nd / wd if wd else None, "fec": nf / wf if wf else None,
                "cob_dec": wd / wt if wt else None, "cob_fec": wf / wt if wt else None}
            for g, (nd, wd, nf, wf, wt) in acc.items()}


def le_limites(linhas):
    """{(conj, ano, 'DEC'|'FEC'): valor} e {conj: cnpj14} a partir das linhas do CSV
    indicadores-continuidade-coletivos-limite (vírgula decimal)."""
    lim, dono = {}, {}
    for row in linhas:
        conj = _int(row.get("IdeConjUndConsumidoras"))
        ano = _int(row.get("AnoLimiteQualidade"))
        sig = (row.get("SigIndicador") or "").strip().upper()
        v = _num(row.get("VlrLimite"))
        if conj is None or ano is None or sig not in ("DEC", "FEC") or v is None:
            continue
        lim[(conj, ano, sig)] = v
        c14 = entidades.cnpj(row.get("NumCNPJ"))
        if c14:
            dono[conj] = c14
    return lim, dono


# ---------------------------------------------------------------------------
# Compensações por violação dos limites individuais (DIC, FIC, DMIC, DICRI, DISE)
# ---------------------------------------------------------------------------

_RE_COMP = re.compile(r"^(PG|QT)U([CG])(AT|MTU|MTNU|BTU|BTNU)(A|T|DC|DS)?$")
TIPO_COMP = {None: "mensal", "T": "trimestral", "A": "anual", "DC": "dicri", "DS": "dise"}
ROTULO_TIPO_COMP = {
    "mensal": "Violação dos limites mensais de DIC, FIC ou DMIC",
    "trimestral": "Violação dos limites trimestrais de DIC ou FIC",
    "anual": "Violação dos limites anuais de DIC ou FIC",
    "dicri": "Violação do limite de DICRI (interrupção em dia crítico)",
    "dise": "Violação do limite de DISE (interrupção em situação de emergência)",
}
ROTULO_TENSAO = {"AT": "alta tensão", "MTU": "média tensão urbana", "MTNU": "média tensão não urbana",
                 "BTU": "baixa tensão urbana", "BTNU": "baixa tensão não urbana"}


def classifica_compensacao(sigla):
    """('valor'|'quantidade', 'uc'|'ug', tensão, tipo) ou None para sigla fora do padrão
    (ex.: compensações por tensão em regime permanente, que não são de continuidade)."""
    m = _RE_COMP.match((sigla or "").strip())
    if not m:
        return None
    return ("valor" if m.group(1) == "PG" else "quantidade", "uc" if m.group(2) == "C" else "ug",
            m.group(3), TIPO_COMP[m.group(4)])


def ref_compensacao(tipo, ano, periodo):
    """Competência: mês para mensal, DICRI e DISE; trimestre (AAAA-Tn) e ano (AAAA)."""
    if tipo == "anual":
        return f"{ano:04d}"
    if tipo == "trimestral":
        return f"{ano:04d}-T{periodo}" if periodo and 1 <= periodo <= 4 else None
    return _ref(ano, periodo) if periodo and 1 <= periodo <= 12 else None


def agrega_compensacoes(lotes):
    """Soma por distribuidora (CNPJ) e competência.

    Devolve (por_mes, por_tensao, nao_classificadas):
      por_mes[(cnpj, 'valor'|'quantidade', 'uc'|'ug', tipo, ref)] = soma
      por_tensao[(cnpj, 'valor'|'quantidade', 'uc', tensão, ano)] = soma (tipo mensal)
    Valor em R$ nominais; quantidade = ocorrências de compensação (a mesma UC pode ser
    compensada em mais de um mês e em mais de um tipo; não é número de UCs distintas)."""
    por_mes = collections.defaultdict(float)
    por_tensao = collections.defaultdict(float)
    nao = collections.Counter()
    for d in lotes:
        for cnpj, sig, ano, per, valor in zip(d["NumCNPJ"], d["SigIndicador"], d["AnoIndice"],
                                              d["NumPeriodoIndice"], d["VlrIndiceEnviado"]):
            cl = classifica_compensacao(sig)
            if cl is None:
                nao[sig] += 1
                continue
            v = _num(valor)
            c14 = entidades.cnpj(cnpj)
            ano, per = _int(ano), _int(per)
            if v is None or not c14 or ano is None:
                continue
            medida, unidade, tensao, tipo = cl
            ref = ref_compensacao(tipo, ano, per)
            if ref is None:
                nao[f"{sig}:periodo={per}"] += 1
                continue
            por_mes[(c14, medida, unidade, tipo, ref)] += v
            if unidade == "uc" and tipo == "mensal":
                por_tensao[(c14, medida, "uc", tensao, ano)] += v
    return dict(por_mes), dict(por_tensao), dict(nao)


# ---------------------------------------------------------------------------
# Atendimento às ocorrências emergenciais (TMP, TMD, TME, NumOcorr, Nie, NDIACRI)
# ---------------------------------------------------------------------------

def agrega_atendimento(lotes, ano_minimo=2015):
    """Por distribuidora e mês: ocorrências (Σ NumOcorr), ocorrências com interrupção
    (Σ Nie) e tempos médios ponderados pelo número de ocorrências de cada conjunto
    (TMAE = TMP + TMD + TME, em minutos). Por distribuidora e ano: dias críticos
    somados sobre os conjuntos e conjuntos com ao menos um dia crítico."""
    conj = collections.defaultdict(dict)
    for d in lotes:
        for cnpj, ic, sig, ano, per, valor in zip(d["NumCNPJ"], d["IdeConjUndConsumidoras"], d["SigIndicador"],
                                                   d["AnoIndice"], d["NumPeriodoIndice"], d["VlrIndiceEnviado"]):
            ano, per, ic = _int(ano), _int(per), _int(ic)
            if ano is None or ano < ano_minimo or ic is None:
                continue
            c14 = entidades.cnpj(cnpj)
            v = _num(valor)
            if not c14 or v is None:
                continue
            conj[(c14, ic, ano, per)][sig] = v
    mensal = collections.defaultdict(lambda: collections.defaultdict(float))
    anual = collections.defaultdict(lambda: collections.defaultdict(float))
    for (c14, ic, ano, per), s in conj.items():
        if "NDIACRI" in s:
            a = anual[(c14, ano)]
            a["dias_criticos_conj"] += s["NDIACRI"]
            a["conj_informados"] += 1
            if s["NDIACRI"] > 0:
                a["conj_com_dia_critico"] += 1
        if per is None or not 1 <= per <= 12:
            continue
        n = s.get("NumOcorr")
        if n is None:
            continue
        m = mensal[(c14, _ref(ano, per))]
        m["ocorr"] += n
        if s.get("Nie") is not None:
            m["nie"] += s["Nie"]
            m["ocorr_nie"] += n
        if n > 0 and all(s.get(x) is not None for x in ("TMP", "TMD", "TME")):
            m["tmae_num"] += (s["TMP"] + s["TMD"] + s["TME"]) * n
            m["tmp_num"] += s["TMP"] * n
            m["tmd_num"] += s["TMD"] * n
            m["tme_num"] += s["TME"] * n
            m["ocorr_tempos"] += n
    return ({k: dict(v) for k, v in mensal.items()}, {k: dict(v) for k, v in anual.items()})


# ---------------------------------------------------------------------------
# Manifestações no 1º e 2º nível da distribuidora (tipologia da REN 1.000/2021)
# ---------------------------------------------------------------------------

# Código de 7 dígitos: 101 informação, 102 reclamação, 103 solicitação de serviço,
# 104 denúncia, 105 elogio, 106 sugestão, 107 cancelamento, 108 encerramento contratual.
GRUPO_MANIFESTACAO = {"101": "informacao", "102": "reclamacao", "103": "solicitacao", "104": "denuncia",
                      "105": "elogio", "106": "sugestao", "107": "cancelamento", "108": "encerramento"}
# Reclamações de interrupção: subgrupo 10209 (Qualidade), itens 01 falta de energia,
# 02 interrupção frequente e 03 interrupção programada.
RECLAMACAO_INTERRUPCAO = {"1020901", "1020902", "1020903"}


def nivel_manifestacao(canal):
    c = (canal or "").strip().lower()
    if c.startswith("nível 1") or c.startswith("nivel 1"):
        return "n1"
    if c.startswith("nível 2") or c.startswith("nivel 2"):
        return "n2"
    return None


def agrega_manifestacoes(lotes):
    """{(cnpj, 'AAAA-MM'): {"n1.total","n1.recl","n1.recl_interrupcao","n1.recl_proc", ...}}
    somando QtdManifestacoesRecebidas (e procedentes das reclamações) por nível. Códigos
    fora da tipologia vigente são contados em "n?.sem_grupo" (não descartados)."""
    out = collections.defaultdict(lambda: collections.defaultdict(float))
    for d in lotes:
        cols = zip(d["NumCPFCNPJ"], d["NomCanalManifestacao"], d["CodTipoManifestacao"],
                   d["QtdManifestacoesRecebidas"], d["QtdManifestacoesProcedentes"],
                   d["AnoCompetencia"], d["MesCompetencia"])
        for cnpj, canal, cod, rec, proc, ano, mes in cols:
            c14 = entidades.cnpj(cnpj)
            nv = nivel_manifestacao(canal)
            ano, mes = _int(ano), _int(mes)
            if not c14 or nv is None or ano is None or mes is None or not 1 <= mes <= 12:
                continue
            q = _num(rec) or 0.0
            p = _num(proc)
            cod = str(_int(cod)) if _int(cod) is not None else ""
            grupo = GRUPO_MANIFESTACAO.get(cod[:3])
            a = out[(c14, _ref(ano, mes))]
            a[f"{nv}.total"] += q
            if grupo is None:
                a[f"{nv}.sem_grupo"] += q
                continue
            if grupo == "reclamacao":
                a[f"{nv}.recl"] += q
                if p is not None:
                    a[f"{nv}.recl_proc"] += p
                if cod in RECLAMACAO_INTERRUPCAO:
                    a[f"{nv}.recl_interrupcao"] += q
    return {k: dict(v) for k, v in out.items()}


# ---------------------------------------------------------------------------
# Ouvidoria Setorial da ANEEL (solicitações registradas na Agência)
# ---------------------------------------------------------------------------

def agrega_ouvidoria(linhas):
    """Linhas (dicts) do CSV ou do Parquet da Ouvidoria Setorial: soma NumQtdReclamacoesDia
    por distribuidora e mês de criação, por categoria e, nas reclamações, por decisão."""
    out = collections.defaultdict(lambda: collections.defaultdict(float))
    for row in linhas:
        c14 = entidades.cnpj(row.get("NumCPFCNPJAgente"))
        data = str(row.get("DtCriacao") or "")[:10]
        q = _num(row.get("NumQtdReclamacoesDia"))
        if not c14 or len(data) < 7 or q is None:
            continue
        cat = (row.get("NomCategoria") or "").strip().lower()
        dec = (row.get("NomDecisao") or "").strip().lower()
        a = out[(c14, data[:7])]
        a["total"] += q
        if cat.startswith("reclama"):
            a["recl"] += q
            if dec.startswith("procedente"):
                a["recl_proc"] += q
            elif dec.startswith("improcedente"):
                a["recl_improc"] += q
            else:
                a["recl_sem_decisao"] += q
            if (row.get("NomSubCategoria") or "").strip().lower().startswith("qualidade do fornecimento"):
                a["recl_qualidade_fornecimento"] += q
        elif cat.startswith("informa"):
            a["informacao"] += q
    return {k: dict(v) for k, v in out.items()}


def linhas_parquet_como_dicts(lotes):
    for d in lotes:
        chaves = list(d)
        for valores in zip(*(d[k] for k in chaves)):
            yield dict(zip(chaves, valores))


# ---------------------------------------------------------------------------
# IASC (pesquisa anual de satisfação do consumidor residencial)
# ---------------------------------------------------------------------------

def le_iasc(linhas):
    """[(ano, cnpj14, {...})] com IASC, construtos, ordem e amostra. A amostra da
    distribuidora é a soma das contagens de entrevistados por sexo (QtdSexoV11 +
    QtdSexoV12), único total de entrevistas publicado por distribuidora."""
    out = []
    for row in linhas:
        ano = _int(row.get("NumAno"))
        c14 = entidades.cnpj(row.get("NumCNPJ"))
        if ano is None or not c14:
            continue
        sexo = [_num(row.get("QtdSexoV11")), _num(row.get("QtdSexoV12"))]
        amostra = sum(x for x in sexo if x is not None) if any(x is not None for x in sexo) else None
        out.append((ano, c14, {
            "iasc": _num(row.get("MdaIndicadorSatisfacao")),
            "qualidade": _num(row.get("MdaIndicadorQualidade")),
            "valor": _num(row.get("MdaIndicadorValor")),
            "fidelidade": _num(row.get("MdaIndicadorFidelidade")),
            "confianca": _num(row.get("MdaIndicadorConfianca")),
            "ordem": _num(row.get("NumOrdemIASC")),
            "amostra": amostra,
            "_sigla": (row.get("SigAgente") or "").strip(),
            "_categoria": (row.get("DescricaoCategoria") or "").strip(),
            "_classificacao": (row.get("DscClassificacao") or "").strip(),
        }))
    return out


# ---------------------------------------------------------------------------
# Eventos em situação de emergência (2026) e relação conjunto × município
# ---------------------------------------------------------------------------

def le_eventos_emergencia(linhas):
    out = []
    for row in linhas:
        c14 = entidades.cnpj(row.get("NumCnpjDistribuidora"))
        cod = (row.get("CodEventoSituacaoEmergencia") or "").strip()
        if not c14 or not cod:
            continue
        out.append({"cnpj": c14, "codigo": cod, "ano": _int(row.get("AnoCompetencia")),
                    "mes": _int(row.get("MesCompetencia")),
                    "inicio": (row.get("DthInicioEvento") or "").strip() or None,
                    "fim": (row.get("DthFimEvento") or "").strip() or None,
                    "chi_limite": _num(row.get("VlrChiLimiteDistribuidora")),
                    "chi_evento": _num(row.get("VlrSomaChiEvento")),
                    "plano_contingencia": (row.get("DscAcionamentoPlanoContingencia") or "").strip() or None,
                    "nivel_contingencia": _int(row.get("NumNivelMaximoContingenciaEvento")),
                    "origem": (row.get("DscOrigemEvento") or "").strip() or None,
                    "relatorio": (row.get("DscLinkRelatorioExpurgos") or "").strip() or None})
    return out


def le_conjunto_municipio(linhas):
    """[(conj, cod_ibge7, nome, uf)] da base IndQual Município (relação vigente, sem data
    de vigência publicada)."""
    out = []
    for row in linhas:
        conj = _int(row.get("IdeConjUnidConsumidoras") or row.get("IdeConjUndConsumidoras"))
        cod = re.sub(r"\D", "", str(row.get("CodMunicipio") or ""))
        if conj is None or len(cod) != 7:
            continue
        out.append((conj, cod, (row.get("NomMunicipio") or "").strip(), (row.get("SigUF") or "").strip()))
    return out


# ---------------------------------------------------------------------------
# Ranking da continuidade (página gov.br da ANEEL): DGC publicado por distribuidora
# ---------------------------------------------------------------------------

# Correspondência explícita "Empresa" do ranking → CNPJ (entidades.py proíbe vínculo por
# semelhança de nome). Cada nome aparece exatamente como publicado em alguma das páginas
# de 2021 a 2025; o CNPJ é o que a própria ANEEL associa à mesma sigla nos indicadores de
# continuidade (SigAgente + NumCNPJ). Nome novo que não esteja aqui fica "não vinculado".
CNPJ_RANKING = {
    "AMAZONAS ENERGIA S.A.": "02341467000120",
    "AMPLA ENERGIA E SERVICOS S.A.": "33050071000158",
    "AMPLA ENERGIA E SERVIÇOS S.A.": "33050071000158",
    "CELESC DISTRIBUICAO S.A": "08336783000190",
    "CELESC DISTRIBUICAO S.A.": "08336783000190",
    "CELESC DISTRIBUIÇÃO S.A": "08336783000190",
    "CELESC DISTRIBUIÇÃO S.A.": "08336783000190",
    "CELG DISTRIBUIÇÃO S.A. - CELG D": "01543032000104",
    "CEMIG DISTRIBUICAO S.A": "06981180000116",
    "CEMIG DISTRIBUIÇÃO S.A": "06981180000116",
    "CEMIG DISTRIBUIÇÃO S.A.": "06981180000116",
    "CENTRAIS ELETRICAS DE CARAZINHO SA": "88446034000155",
    "CENTRAIS ELÉTRICAS DE CARAZINHO S.A.": "88446034000155",
    "CENTRAIS ELÉTRICAS DE CARAZINHO SA": "88446034000155",
    "COMPANHIA CAMPOLARGUENSE DE ENERGIA COCEL": "75805895000130",
    "COMPANHIA DE ELETRICIDADE DO AMAPA CEA": "05965546000109",
    "COMPANHIA DE ELETRICIDADE DO ESTADO DA BAHIA COELBA": "15139629000194",
    "COMPANHIA ENERGETICA DE PERNAMBUCO": "10835932000108",
    "COMPANHIA ENERGÉTICA DE PERNAMBUCO": "10835932000108",
    "COMPANHIA ENERGETICA DO CEARA": "07047251000170",
    "COMPANHIA ENERGÉTICA DO CEARÁ": "07047251000170",
    "COMPANHIA ENERGETICA DO RIO GRANDE DO NORTE COSERN": "08324196000181",
    "COMPANHIA ENERGÉTICA DO RIO GRANDE DO NORTE COSERN": "08324196000181",
    "COMPANHIA ESTADUAL DE DISTRIBUICAO DE ENERGIA ELETRICA - CEEE-D": "08467115000100",
    "COMPANHIA ESTADUAL DE DISTRIBUIÇÃO DE ENERGIA ELÉTRICA - CEEE-D": "08467115000100",
    "COMPANHIA HIDROELETRICA SAO PATRICIO - CHESP": "01377555000110",
    "COMPANHIA HIDROELÉTRICA SÃO PATRÍCIO - CHESP": "01377555000110",
    "COMPANHIA JAGUARI DE ENERGIA": "53859112000169",
    "COMPANHIA PAULISTA DE FORCA E LUZ": "33050196000188",
    "COMPANHIA PAULISTA DE FORÇA E LUZ": "33050196000188",
    "COMPANHIA PIRATININGA DE FORCA E LUZ": "04172213000151",
    "COMPANHIA PIRATININGA DE FORÇA E LUZ": "04172213000151",
    "COMPANHIA SUL SERGIPANA DE ELETRICIDADE": "13255658000196",
    "COOPERATIVA ALIANCA": "83647990000181",
    "COOPERATIVA ALIANÇA": "83647990000181",
    "COPEL DISTRIBUICAO S.A.": "04368898000106",
    "COPEL DISTRIBUIÇÃO S.A.": "04368898000106",
    "DCELT - DISTRIBUIDORA CATARINENSE DE ENERGIA ELETRICA LTDA": "83855973000130",
    "DCELT - DISTRIBUIDORA CATARINENSE DE ENERGIA ELÉTRICA LTDA": "83855973000130",
    "DCELT - DISTRIBUIDORA CATARINENSE DE ENERGIA ELÉTRICA LTDA.": "83855973000130",
    "DCELT DISTRIBUIDORA CATARINENSE DE ENERGIA ELETRICA S/A": "83855973000130",
    "DEPARTAMENTO MUNICIPAL DE ENERGIA DE IJUI": "95289500000100",
    "DEPARTAMENTO MUNICIPAL DE ENERGIA DE IJUÍ": "95289500000100",
    "DME DISTRIBUICAO S.A. - DMED": "23664303000104",
    "DME DISTRIBUIÇÃO S.A. - DMED": "23664303000104",
    "EDP ESPIRITO SANTO DISTRIBUICAO DE ENERGIA S.A.": "28152650000171",
    "EDP ESPÍRITO SANTO DISTRIBUIÇÃO DE ENERGIA S.A.": "28152650000171",
    "EDP SAO PAULO DISTRIBUICAO DE ENERGIA S.A.": "02302100000106",
    "EDP SÃO PAULO DISTRIBUIÇÃO DE ENERGIA S.A.": "02302100000106",
    "ELEKTRO REDES S.A.": "02328280000197",
    "ELETROPAULO METROPOLITANA ELETRICIDADE DE SAO PAULO S.A.": "61695227000193",
    "ELETROPAULO METROPOLITANA ELETRICIDADE DE SÃO PAULO S.A.": "61695227000193",
    "EMPRESA FORCA E LUZ DE URUSSANGA LTDA": "86531175000140",
    "EMPRESA FORCA E LUZ DE URUSSANGA LTDA.": "86531175000140",
    "EMPRESA FORÇA E LUZ DE URUSSANGA LTDA": "86531175000140",
    "EMPRESA FORÇA E LUZ DE URUSSANGA LTDA.": "86531175000140",
    "EMPRESA FORCA E LUZ JOAO CESA LTDA": "86301124000122",
    "EMPRESA FORCA E LUZ JOAO CESA LTDA.": "86301124000122",
    "EMPRESA FORÇA E LUZ JOÃO CESA LTDA": "86301124000122",
    "EMPRESA FORÇA E LUZ JOÃO CESA LTDA.": "86301124000122",
    "EMPRESA LUZ E FORCA SANTA MARIA S A": "27485069000109",
    "EMPRESA LUZ E FORCA SANTA MARIA S.A.": "27485069000109",
    "EMPRESA LUZ E FORÇA SANTA MARIA S/A": "27485069000109",
    "ENERGISA ACRE - DISTRIBUIDORA DE ENERGIA S.A": "04065033000170",
    "ENERGISA ACRE - DISTRIBUIDORA DE ENERGIA S.A.": "04065033000170",
    "ENERGISA MATO GROSSO - DISTRIBUIDORA DE ENERGIA S.A.": "03467321000199",
    "ENERGISA MATO GROSSO DO SUL - DISTRIBUIDORA DE ENERGIA S.A.": "15413826000150",
    "ENERGISA MINAS RIO - DISTRIBUIDORA DE ENERGIA S.A.": "19527639000158",
    # Energisa Minas Gerais incorporou a Nova Friburgo e passou a se chamar Minas Rio
    # (mesmo CNPJ); a Nova Friburgo e a Borborema mantêm CNPJ próprio no histórico
    "ENERGISA MINAS GERAIS - DISTRIBUIDORA DE ENERGIA S.A.": "19527639000158",
    "ENERGISA NOVA FRIBURGO - DISTRIBUIDORA DE ENERGIA S.A.": "33249046000106",
    "ENERGISA BORBOREMA - DISTRIBUIDORA DE ENERGIA S.A": "08826596000195",
    "ENERGISA BORBOREMA - DISTRIBUIDORA DE ENERGIA S.A.": "08826596000195",
    "ENERGISA PARAIBA - DISTRIBUIDORA DE ENERGIA S.A": "09095183000140",
    "ENERGISA PARAIBA - DISTRIBUIDORA DE ENERGIA S.A.": "09095183000140",
    "ENERGISA PARAÍBA - DISTRIBUIDORA DE ENERGIA S.A": "09095183000140",
    "ENERGISA PARAÍBA - DISTRIBUIDORA DE ENERGIA S.A.": "09095183000140",
    "ENERGISA RONDONIA - DISTRIBUIDORA DE ENERGIA S.A": "05914650000166",
    "ENERGISA RONDONIA - DISTRIBUIDORA DE ENERGIA S.A.": "05914650000166",
    "ENERGISA SERGIPE - DISTRIBUIDORA DE ENERGIA S.A": "13017462000163",
    "ENERGISA SERGIPE - DISTRIBUIDORA DE ENERGIA S.A.": "13017462000163",
    "ENERGISA SUL-SUDESTE - DISTRIBUIDORA DE ENERGIA S.A.": "07282377000120",
    "ENERGISA TOCANTINS DISTRIBUIDORA DE ENERGIA S.A.": "25086034000171",
    "EQUATORIAL ALAGOAS DISTRIBUIDORA DE ENERGIA S.A.": "12272084000100",
    "EQUATORIAL GOIAS DISTRIBUIDORA DE ENERGIA S/A": "01543032000104",
    "EQUATORIAL GOIÁS DISTRIBUIDORA DE ENERGIA S/A": "01543032000104",
    "EQUATORIAL MARANHÃO DISTRIBUIDORA DE ENERGIA S.A": "06272793000184",
    "EQUATORIAL MARANHÃO DISTRIBUIDORA DE ENERGIA S.A.": "06272793000184",
    "EQUATORIAL PARA DISTRIBUIDORA DE ENERGIA S.A.": "04895728000180",
    "EQUATORIAL PARÁ DISTRIBUIDORA DE ENERGIA S.A.": "04895728000180",
    "EQUATORIAL PIAUI DISTRIBUIDORA DE ENERGIA S.A": "06840748000189",
    "EQUATORIAL PIAUI DISTRIBUIDORA DE ENERGIA S.A.": "06840748000189",
    "FORCA E LUZ CORONEL VIVIDA LTDA": "79850574000109",
    "FORCA E LUZ CORONEL VIVIDA LTDA.": "79850574000109",
    "FORÇA E LUZ CORONEL VIVIDA LTDA": "79850574000109",
    "FORÇA E LUZ CORONEL VIVIDA LTDA.": "79850574000109",
    "HIDROPAN DISTRIBUICAO DE ENERGIA S.A.": "91982348000187",
    "HIDROPAN DISTRIBUIÇÃO DE ENERGIA S.A.": "91982348000187",
    "LIGHT SERVICOS DE ELETRICIDADE S A": "60444437000146",
    "LIGHT SERVICOS DE ELETRICIDADE S.A.": "60444437000146",
    "LIGHT SERVIÇOS DE ELETRICIDADE S A": "60444437000146",
    "LIGHT SERVIÇOS DE ELETRICIDADE S.A.": "60444437000146",
    "MUXFELDT MARIN E CIA LTDA": "97578090000134",
    "MUXFELDT MARIN E CIA LTDA.": "97578090000134",
    "NEOENERGIA DISTRIBUICAO BRASILIA S.A.": "07522669000192",
    "NEOENERGIA DISTRIBUIÇÃO BRASÍLIA S.A.": "07522669000192",
    "NOVA PALMA ENERGIA LTDA": "89889604000144",
    "NOVA PALMA ENERGIA LTDA.": "89889604000144",
    "RGE SUL DISTRIBUIDORA DE ENERGIA S.A.": "02016440000162",
    "RORAIMA ENERGIA S.A.": "02341470000144",
}


def _texto_celula(c):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c)).replace("\xa0", " ")).strip()


def le_ranking_continuidade(texto_html, ano):
    """Linhas das duas tabelas do ranking (grande e pequeno porte). DGC "-" (empresa
    fora do ranking no ano) vira None com a observação preservada."""
    m = re.search(r'id="parent-fieldname-text"(.*)', texto_html, re.S)
    corpo = m.group(1) if m else texto_html
    tabelas = re.findall(r"<table.*?</table>", corpo, re.S)
    out = []
    for i, tab in enumerate(tabelas):
        porte = "grande" if i == 0 else "pequeno"
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", tab, re.S):
            cel = [_texto_celula(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
            if len(cel) < 5 or cel[0].lower().startswith("posi"):
                continue
            pos = _int(re.sub(r"\D", "", cel[0]))
            dgc = _num(cel[1]) if re.match(r"^\d", cel[1] or "") else None
            empresa = cel[3]
            out.append({"ano": ano, "porte": porte, "posicao": pos, "dgc": dgc, "dgc_texto": cel[1],
                        "sigla": cel[2], "empresa": empresa, "regiao": cel[4],
                        "cnpj": CNPJ_RANKING.get(empresa)})
    return out


def le_csv_texto(texto, separador=";"):
    """Linhas (dicts) de um CSV em texto, cabeçalho aparado e sem BOM."""
    leitor = csv.reader(io.StringIO(texto), delimiter=separador)
    cab = None
    for row in leitor:
        if not row:
            continue
        if cab is None:
            cab = [c.strip().lstrip("﻿").strip('"') for c in row]
            continue
        yield dict(zip(cab, row))
