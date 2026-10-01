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
# 2010-2021 parte dos conjuntos incluía também as parcelas externas não críticas: em 2021,
# os 1.482 conjunto-meses com DEC diferente de IP + IND têm DEC = IP + IND + XN + XP
# (medido no Parquet em 30/09/2026, não suposto).
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
    # desde 2022 este grupo é exatamente o DEC apurado; de 2010 a 2021 o apurado de parte dos
    # conjuntos incluía também XN e XP (verificado em 2021: 1.482 conjunto-meses, todos com
    # DEC = IP + IND + XN + XP), então o grupo e o apurado podem diferir nesses anos
    "apurado": "Interna, programada e não programada não expurgável (IP + IND): desde 2022 igual ao DEC apurado",
    "emergencia": "Situação de emergência (expurgada)",
    "dia_critico": "Dia crítico (expurgada)",
    "externa": "Origem externa ao sistema de distribuição (expurgada)",
    "ons": "Racionamento ou alívio de carga pelo ONS (expurgada)",
}
SIGLAS_CONTINUIDADE = {"DEC", "FEC", "NumCon"} | {f"{i}{p}" for i in ("DEC", "FEC") for p in PARCELAS}


def ler_parquet_bronze(caminho_relativo, colunas, lote=200_000):
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


# Marcadores que a fonte publica no lugar da sigla (a Creral, CNPJ 89.435.598/0001-55, tem
# SigAgente "Não Informado" nos indicadores de continuidade de 2010 a 2026): são ausência
# de sigla, não um nome, e não podem virar o rótulo da distribuidora.
MARCADORES_SEM_SIGLA = {"não informado", "nao informado", "não informada", "nao informada", "-", "n/a"}


def sigla_valida(s):
    """A sigla publicada, ou None quando vazia ou marcador de ausência."""
    s = (s or "").strip()
    return None if not s or s.lower() in MARCADORES_SEM_SIGLA else s


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


def centesimos(v):
    """Valor em centésimos inteiros (DEC em centésimos de hora, FEC em centésimos de
    interrupção). Por que existe: a ANEEL publica cada DEC e FEC mensal e cada limite com
    duas casas (verificado em 30/09/2026 nos 1,2 milhão de valores dos três Parquets e nos
    263.389 limites: nenhum com mais casas), então a soma anual é um número exato de
    centésimos. Em ponto flutuante a soma de 12 meses pode dar 8,000000000000002 e passar
    por maior que o limite 8,00 (conjunto 12836, CRUZALTINA, 2025)."""
    if v is None:
        return None
    return int(round(v * 100))


def acima_do_limite(valor, limite):
    """True quando o apurado passa do limite, comparados em centésimos inteiros (igual ao
    limite não é transgressão); None quando falta um dos dois (ausência não vira "dentro")."""
    if valor is None or limite is None:
        return None
    return centesimos(valor) > centesimos(limite)


def controle_numcon(ucs_total, nconj_total, fator=2.0):
    """Meses em que o número de UCs (NumCon) publicado por uma distribuidora não é
    plausível, {ref: motivo}. Por que existe: em março de 2026 a CELESC publicou NumCon = 1
    nos 121 conjuntos; o DEC mensal da distribuidora virava média simples dos conjuntos e,
    no Brasil, a CELESC pesava 121 UCs em vez de 3,4 milhões, sem que nada acusasse.

    Regras (sobre a soma do NumCon dos conjuntos da distribuidora no mês):
    * no máximo 1 UC por conjunto em média (NumCon = 1 em todos os conjuntos);
    * queda: menos da metade do mês anterior E do seguinte que existirem;
    * pico: mais do dobro do mês anterior E do seguinte.
    Exigir os dois vizinhos separa o mês isolado de uma mudança de patamar (incorporação,
    cisão), em que o mês seguinte continua no nível novo."""
    refs = sorted(r for r, v in ucs_total.items() if v)
    out = {}
    for i, r in enumerate(refs):
        u, n = ucs_total[r], nconj_total.get(r)
        viz = [ucs_total[x] for x in (refs[i - 1] if i > 0 else None, refs[i + 1] if i + 1 < len(refs) else None) if x]
        if n and u <= n:
            out[r] = f"NumCon médio de {u / n:.2f} UC por conjunto ({int(n)} conjuntos, {int(u)} UCs)"
        elif viz and all(u * fator < v for v in viz):
            out[r] = f"NumCon de {int(u)} UCs, menos da metade dos meses vizinhos ({', '.join(str(int(v)) for v in viz)})"
        elif viz and all(u > fator * v for v in viz):
            out[r] = f"NumCon de {int(u)} UCs, mais do dobro dos meses vizinhos ({', '.join(str(int(v)) for v in viz)})"
    return out


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


def quebras_perimetro(por_dist_ano, conj_mun, limiar=0.10):
    """Mudanças de perímetro de uma distribuidora de um ano para o seguinte (incorporação
    de outra distribuidora ou cessão de área), detectadas pelos dados publicados.

    por_dist_ano: {(cnpj, ano): (conjuntos com DEC no ano, UCs médias somadas)};
    conj_mun: {conjunto: municípios que ele atende} (IndQual Município).

    Duas condições, as duas necessárias: (1) as UCs médias variam mais que `limiar` de um
    ano para o seguinte; (2) há continuidade territorial com outra distribuidora que perde
    UCs (ou deixa de publicar) no mesmo ano: os municípios dos conjuntos novos eram
    atendidos no ano anterior por conjuntos dela (ou, na perda, os municípios dos conjuntos
    que saíram passam a ser atendidos por uma distribuidora que ganha UCs). Só a variação
    de UCs acusaria cooperativas pequenas crescendo 10% ao ano e erros de NumCon; só a
    vizinhança acusaria qualquer município dividido entre duas distribuidoras. Nada é
    ligado por nome. Devolve uma lista de dicts, um por (cnpj, ano) com quebra."""
    anos_cnpj = collections.defaultdict(set)
    for (c14, a) in por_dist_ano:
        anos_cnpj[a].add(c14)

    def muns(cs):
        out = set()
        for cj in cs:
            out |= conj_mun.get(cj, set())
        return out
    out = []
    for (c14, a), (cs, u) in sorted(por_dist_ano.items()):
        ant = por_dist_ano.get((c14, a - 1))
        if not ant or not ant[1] or not u:
            continue
        var = u / ant[1] - 1
        if abs(var) <= limiar:
            continue
        outras = []
        if var > 0:
            mn = muns(cs - ant[0])
            for y in sorted(anos_cnpj[a - 1] - {c14}):
                ya, yn = por_dist_ano[(y, a - 1)], por_dist_ano.get((y, a))
                perdeu = yn is None or yn[1] < (1 - limiar) * ya[1]
                comum = mn & muns(ya[0])
                if perdeu and comum:
                    outras.append({"cnpj": y, "papel": "origem", "municipios_em_comum": len(comum),
                                   "ucs_ano_anterior": ya[1], "ucs_no_ano": yn[1] if yn else None})
        else:
            ms = muns(ant[0] - cs)
            for y in sorted(anos_cnpj[a] - {c14}):
                yn, ya = por_dist_ano[(y, a)], por_dist_ano.get((y, a - 1))
                ganhou = ya is None or yn[1] > (1 + limiar) * ya[1]
                comum = ms & muns(yn[0])
                if ganhou and comum:
                    outras.append({"cnpj": y, "papel": "destino", "municipios_em_comum": len(comum),
                                   "ucs_ano_anterior": ya[1] if ya else None, "ucs_no_ano": yn[1]})
        if outras:
            out.append({"cnpj": c14, "ano": a, "conjuntos_antes": len(ant[0]), "conjuntos_depois": len(cs),
                        "ucs_antes": ant[1], "ucs_depois": u, "variacao_ucs_pct": 100 * var, "outras": outras})
    return out


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
    (Σ Nie), tempos médios ponderados pelo número de ocorrências de cada conjunto
    (TMAE = TMP + TMD + TME, em minutos), conjuntos com ocorrência informada e conjuntos
    com Nie maior que NumOcorr (controle). Por distribuidora e ano: dias críticos
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
        m["conj_ocorr"] += 1
        if s.get("Nie") is not None:
            m["nie"] += s["Nie"]
            m["ocorr_nie"] += n
            # controle de domínio: ocorrências com interrupção (Nie) são parte das
            # ocorrências (NumOcorr); a fonte publica conjunto-meses com Nie maior, que são
            # contados aqui (não corrigidos nem descartados; Nie não entra no TMAE)
            if s["Nie"] > n:
                m["conj_nie_maior"] += 1
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


# Correspondência explícita IdeTipoRCA → código da tipologia da REN 1.000/2021.
# Por que existe: o arquivo de 2023 ainda usa os códigos antigos em CodTipoManifestacao, e
# alguns deles coincidem com códigos da tipologia nova com outro significado (em 2023, o
# código 102 é "Outros (Procedimento irregular)" e o 101 é "Cobrança decorrente de religação
# à revelia"; na tipologia nova, 102 é o grupo das reclamações e 101 o das informações). O
# dicionário (versão 1.2, 30/07/2026) define IdeTipoRCA como o identificador da tipologia na
# estrutura atual do sistema, estável entre os anos. A tabela abaixo foi extraída dos
# arquivos de 2024, 2025 e 2026 (capturados em 30/09/2026), em que 100% das quantidades usam
# o código novo e cada IdeTipoRCA corresponde a um único código (verificado; linhas com
# IdeTipoRCA vazio não entram). IdeTipoRCA de 2023 fora da tabela fica "sem_grupo".
TIPOLOGIA_POR_RCA = {
    "29": ("10101", "Conexão"),
    "30": ("10102", "Cadastro / Contratos"),
    "31": ("10103", "Benefícios Tarifários"),
    "32": ("10104", "Medição / Equipamentos de Medição"),
    "33": ("10105", "Leitura"),
    "34": ("10106", "Tarifas / Fatura / Faturamento / Cobrança"),
    "35": ("10107", "Serviços Cobráveis"),
    "36": ("10108", "Pagamento"),
    "37": ("10109", "Suspensão do Fornecimento"),
    "38": ("10110", "Procedimento Irregular"),
    "39": ("10111", "Atendimento / Estrutura de Atendimento"),
    "40": ("10112", "Qualidade da Prestação do Serviço"),
    "41": ("10113", "Ressarcimento de Danos Elétricos"),
    "42": ("10114", "Rede / Manutenção"),
    "43": ("10115", "Geração Distribuída"),
    "44": ("10116", "Prazos / acompanhamento de solicitação"),
    "45": ("10117", "Instalação Interna"),
    "46": ("10118", "Iluminação Pública"),
    "47": ("10119", "Legislação do Setor Elétrico ou correlata"),
    "48": ("10120", "Normas e Padrões Técnicos da distribuidora"),
    "49": ("10121", "Eficiência Energética / Racionalização do consumo"),
    "50": ("10122", "Caminho do entendimento (orientação para contato em outro nível)"),
    "51": ("10199", "Outros"),
    "52": ("102", "RECLAMAÇÃO"),
    "53": ("10201", "Conexão (Caso Geral)"),
    "54": ("1020101", "Solicitação não atendida ou atrasada"),
    "55": ("1020102", "Orçamento - Participação Financeira / Universalização"),
    "56": ("1020103", "Restituição de antecipação"),
    "57": ("1020104", "Prazos (ligação com obras)"),
    "58": ("1020199", "Outros (Conexão)"),
    "59": ("10202", "Cadastro / Contratos"),
    "60": ("1020201", "Cadastro"),
    "61": ("1020202", "Uso não autorizado de dados cadastrais"),
    "62": ("1020203", "Contratos / Encerramento contratual"),
    "63": ("1020204", "Troca de titularidade"),
    "64": ("1020299", "Outros (Cadastro / Contratos)"),
    "65": ("10203", "Medição"),
    "66": ("1020301", "Ausência do medidor/sistema de medição"),
    "67": ("1020302", "Avaria/Defeito medidor/sistema de medição"),
    "68": ("1020303", "Lacre"),
    "69": ("1020399", "Outros (Medição)"),
    "70": ("10204", "Leitura / Faturamento / Fatura"),
    "71": ("1020401", "Impedimento de acesso"),
    "72": ("1020402", "Erro de leitura"),
    "73": ("1020403", "Variação de consumo (Leitura / Faturamento / Fatura)"),
    "74": ("1020404", "Demais grandezas faturadas"),
    "75": ("1020405", "Tarifas aplicadas"),
    "76": ("1020406", "Classificação / Subsídios tarifários"),
    "77": ("1020407", "Faturamento por estimativa / média"),
    "78": ("1020408", "Faturamento pelo custo de disponibilidade"),
    "79": ("1020409", "Compensação / Devolução não realizada / incorreta"),
    "80": ("1020410", "Bandeiras Tarifárias"),
    "81": ("1020411", "Tributos"),
    "82": ("1020412", "Contribuição para o Custeio dos Serviços de Iluminação Pública - COSIP"),
    "83": ("1020413", "Apresentação / Entrega da fatura"),
    "84": ("1020414", "Qualidade da impressão da fatura"),
    "85": ("1020499", "Outros (Leitura / Faturamento / Fatura)"),
    "86": ("10205", "Cobranças"),
    "87": ("1020501", "Acréscimos moratórios - Multas e juros"),
    "88": ("1020502", "Cobranças de períodos anteriores"),
    "89": ("1020503", "Parcelamento de débito"),
    "90": ("1020504", "Serviços cobráveis"),
    "91": ("1020505", "Atividades acessórias"),
    "92": ("1020599", "Outros (Cobranças)"),
    "93": ("10206", "Pagamento / Inadimplência / Suspensão"),
    "94": ("1020601", "Fatura paga e não baixada"),
    "95": ("1020602", "Indisponibilidade / Inexistência de posto de arrecadação no Município"),
    "96": ("1020603", "Suspensão indevida"),
    "97": ("1020604", "Religação não realizada / fora do prazo"),
    "98": ("1020605", "Inscrição em Cadastro de Negativação"),
    "99": ("1020606", "Atuação de empresa de cobrança"),
    "100": ("1020699", "Outros (Pagamentos / Inadimplências / Suspensão)"),
    "102": ("1020702", "Deficiência na caracterização da irregularidade"),
    "103": ("1020703", "Não recebimento do TOI - Termo de Ocorrência e Inspeção"),
    "104": ("1020704", "Responsabilidade sobre a Irregularidade"),
    "105": ("1020705", "Cobrança decorrente de religação à revelia"),
    "106": ("1020799", "Outros (Procedimento irregular)"),
    "107": ("10208", "Atendimento / Estrutura de Atendimento"),
    "108": ("1020801", "Conduta de empregado ou prestador de serviço"),
    "109": ("1020802", "Atendimento Presencial / Falta de agência / posto de atendimento"),
    "110": ("1020803", "Atendimento Telefônico"),
    "111": ("1020804", "Atendimento pela Internet"),
    "112": ("1020805", "Demais canais de acesso"),
    "113": ("1020899", "Outros (Atendimento / Estrutura de Atendimento)"),
    "114": ("10209", "Qualidade"),
    "115": ("1020901", "Interrupção no Fornecimento - Falta de energia"),
    "116": ("1020902", "Interrupção Frequente do Fornecimento"),
    "117": ("1020903", "Interrupção Programada"),
    "118": ("1020904", "Tensão de Fornecimento"),
    "119": ("1020999", "Outros (Qualidade)"),
    "120": ("10210", "Ressarcimento de Danos Elétricos"),
    "121": ("1021001", "Danos em equipamentos"),
    "122": ("1021002", "Vistoria dos Equipamentos"),
    "123": ("1021003", "Laudo/orçamento"),
    "124": ("1021004", "Ressarcimento inferior ao devido"),
    "125": ("1021005", "Indeferimento total / parcial"),
    "126": ("1021099", "Outros (Ressarcimento de Danos Elétricos)"),
    "127": ("10211", "Outros Danos (não elétricos)"),
    "128": ("10212", "Rede / Manutenção"),
    "129": ("1021201", "Cabo partido"),
    "130": ("1021202", "Poste"),
    "131": ("1021203", "Transformador"),
    "132": ("1021204", "Objeto na rede"),
    "133": ("1021205", "Poda de árvore"),
    "134": ("1021206", "Entulhos / Galhos de árvores não recolhidos"),
    "135": ("1021299", "Outros (Rede / Manutenção)"),
    "136": ("10213", "Geração Distribuída"),
    "137": ("1021301", "Conexão (Geração Distribuída)"),
    "138": ("1021302", "Faturamento"),
    "139": ("1021399", "Outros (Geração Distribuída)"),
    "140": ("10214", "Prazos (não previstos nas tipologias anteriores)"),
    "141": ("10215", "Instalações internas"),
    "142": ("10216", "Iluminação Pública"),
    "143": ("10217", "Outros (Caso Geral)"),
    "144": ("104", "DENÚNCIA"),
    "145": ("10401", "Ligação Clandestina"),
    "146": ("10402", "Fraude/Desvio de Energia Elétrica"),
    "147": ("10403", "Contra empregado ou prestador de serviço da distribuidora"),
    "148": ("10404", "Danos Ambientais"),
    "149": ("10405", "Furtos de cabos e fiações elétricas"),
    "150": ("10406", "Outros"),
    "151": ("105", "ELOGIO"),
    "152": ("106", "SUGESTÃO"),
    "153": ("101", "INFORMAÇÃO"),
    "154": ("103", "SOLICITAÇÃO DE SERVIÇOS"),
    "155": ("107", "CANCELAMENTO DE SERVIÇOS"),
    "156": ("108", "ENCERRAMENTO CONTRATUAL"),
    "157": ("1020701", "Valores Cobrados"),
    "158": ("1020105", "Prazos (ligação sem obras)"),
    "159": ("1021303", "Variação de Consumo (Geração Distribuída)"),
    "160": ("1021304", "Apresentação / Entrega de Fatura"),
}


def nivel_manifestacao(canal):
    c = (canal or "").strip().lower()
    if c.startswith("nível 1") or c.startswith("nivel 1"):
        return "n1"
    if c.startswith("nível 2") or c.startswith("nivel 2"):
        return "n2"
    return None


ANO_TIPOLOGIA_NOVA = 2024  # primeiro ano com 100% das quantidades no código novo


def codigo_tipologia(cod, rca, ano):
    """Código da tipologia nova para uma linha: o publicado a partir de 2024; antes, o
    IdeTipoRCA traduzido pela tabela explícita (nunca o código antigo lido como novo)."""
    cod = str(_int(cod)) if _int(cod) is not None else ""
    if ano is not None and ano >= ANO_TIPOLOGIA_NOVA:
        return cod
    rca = str(_int(rca)) if _int(rca) is not None else ""
    return TIPOLOGIA_POR_RCA.get(rca, (None, None))[0]


def agrega_manifestacoes(lotes):
    """{(cnpj, 'AAAA-MM'): {"n1.total","n1.recl","n1.recl_interrupcao","n1.recl_proc", ...}}
    somando QtdManifestacoesRecebidas (e procedentes das reclamações) por nível. Linha sem
    código da tipologia nova (nem pelo IdeTipoRCA) é contada em "n?.sem_grupo" (não é
    descartada nem atribuída a um grupo por aproximação)."""
    out = collections.defaultdict(lambda: collections.defaultdict(float))
    for d in lotes:
        rcas = d.get("IdeTipoRCA") or [None] * len(d["NumCPFCNPJ"])
        cols = zip(d["NumCPFCNPJ"], d["NomCanalManifestacao"], d["CodTipoManifestacao"], rcas,
                   d["QtdManifestacoesRecebidas"], d["QtdManifestacoesProcedentes"],
                   d["AnoCompetencia"], d["MesCompetencia"])
        for cnpj, canal, cod, rca, rec, proc, ano, mes in cols:
            c14 = entidades.cnpj(cnpj)
            nv = nivel_manifestacao(canal)
            ano, mes = _int(ano), _int(mes)
            if not c14 or nv is None or ano is None or mes is None or not 1 <= mes <= 12:
                continue
            q = _num(rec) or 0.0
            p = _num(proc)
            codigo = codigo_tipologia(cod, rca, ano) or ""
            grupo = GRUPO_MANIFESTACAO.get(codigo[:3])
            a = out[(c14, _ref(ano, mes))]
            a[f"{nv}.total"] += q
            if grupo is None:
                a[f"{nv}.sem_grupo"] += q
                continue
            if grupo == "reclamacao":
                a[f"{nv}.recl"] += q
                if p is not None:
                    a[f"{nv}.recl_proc"] += p
                if codigo in RECLAMACAO_INTERRUPCAO:
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


# ---------------------------------------------------------------------------
# Indicadores de qualidade do atendimento telefônico (INS, IAb, ICO)
# ---------------------------------------------------------------------------

# Padrões regulatórios declarados no dicionário (versão 1.0, 16/07/2026; PRODIST, Módulo 8,
# artigos 295 a 303): INS ≥ 85%, IAb ≤ 4%, ICO ≤ 2%, apurados só nos períodos típicos.
PADRAO_TELEFONICO = {"ins": (">=", 85.0), "iab": ("<=", 4.0), "ico": ("<=", 2.0)}
CAMPOS_TELEFONICO = {
    # campo publicado → (chave, é percentual publicado como fração)
    "PctINS": ("ins", True), "PctINSCheio": ("ins_cheio", True),
    "PctIAb": ("iab", True), "PctIAbCheio": ("iab_cheio", True),
    "PctICO": ("ico", True), "PctICOCheio": ("ico_cheio", True),
    "QtdChof": ("oferecidas", False), "QtdChofCheio": ("oferecidas_cheio", False),
    "QtdChoc": ("ocupadas", False), "QtdChocCheio": ("ocupadas_cheio", False),
    "QtdChamadasAtendidas": ("atendidas", False), "QtdChamadasAtendidasCheio": ("atendidas_cheio", False),
    "QtdChamadasAbandonadas": ("abandonadas", False), "QtdChamadasAbandonadasCheio": ("abandonadas_cheio", False),
}


def le_atendimento_telefonico(linhas):
    """({(cnpj, 'AAAA-MM'): {...}}, conflitos) do CSV indicador-atendimento-telefonico.

    Os campos Pct* vêm como fração (",938483..." = 93,85%): aqui viram percentuais (× 100),
    a unidade em que o dicionário escreve o padrão (INS ≥ 85%). O arquivo publica "NumCNPJ"
    (o dicionário chama NumCPFCNPJ); os dois nomes são aceitos. Chave repetida com valor
    diferente é contada como conflito e fica a última linha."""
    out, conflitos = {}, 0
    for row in linhas:
        c14 = entidades.cnpj(row.get("NumCNPJ") or row.get("NumCPFCNPJ"))
        ano, mes = _int(row.get("AnoReferencia")), _int(row.get("MesReferencia"))
        if not c14 or ano is None or mes is None or not 1 <= mes <= 12:
            continue
        reg = {"sigla": (row.get("SigAgente") or "").strip() or None, "uf": (row.get("SigUF") or "").strip() or None}
        for campo, (chave, pct) in CAMPOS_TELEFONICO.items():
            v = _num(row.get(campo))
            reg[chave] = (100 * v if pct else v) if v is not None else None
        k = (c14, _ref(ano, mes))
        if k in out and out[k] != reg:
            conflitos += 1
        out[k] = reg
    return out, conflitos


def cumpre_padrao_telefonico(indicador, valor):
    """True/False contra o padrão regulatório do indicador; None sem valor."""
    if valor is None:
        return None
    op, lim = PADRAO_TELEFONICO[indicador]
    return valor >= lim if op == ">=" else valor <= lim


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
                    "relatorio": (row.get("DscLinkRelatorioExpurgos") or "").strip() or None,
                    "gerado_em": (row.get("DatGeracaoConjuntoDados") or "").strip() or None})
    return out


def duracao_evento_h(inicio, fim, gerado_em):
    """(horas, motivo) de um evento. Fim antes do início ou depois da data de geração do
    arquivo é data implausível publicada pela fonte (ex.: ano 3036 no lugar de 2026): a
    duração fica ausente com o motivo, e as datas continuam como publicadas (não são
    corrigidas por suposição)."""
    from datetime import datetime
    if not inicio or not fim:
        return None, "início ou fim não publicado"
    try:
        di, df = datetime.fromisoformat(inicio), datetime.fromisoformat(fim)
    except ValueError:
        return None, "data em formato não reconhecido"
    if df < di:
        return None, "fim anterior ao início"
    if gerado_em and fim[:10] > gerado_em[:10]:
        return None, f"fim ({fim[:10]}) posterior à geração do arquivo ({gerado_em[:10]})"
    return (df - di).total_seconds() / 3600, None


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


# ---------------------------------------------------------------------------
# Divulgação anual da ANEEL (notícia do ranking): DEC, FEC e compensações nacionais
# ---------------------------------------------------------------------------

def texto_de_html(texto_html):
    """Texto corrido de uma página HTML (sem script e estilo), com espaços normalizados."""
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", texto_html, flags=re.S | re.I)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t)).replace("\xa0", " ")
    return re.sub(r"\s+", " ", t).strip()


def le_divulgacao_continuidade(texto_html):
    """Números nacionais do texto anual da ANEEL sobre a continuidade (DEC em horas, FEC,
    compensações em R$ e em quantidade), com o trecho de onde cada um saiu.

    Devolve {ano: {"dec": x, "fec": y, "compensacao_rs": z, "compensacoes_qtd": w,
    "trechos": {...}}} para o ano da divulgação e o anterior, que o texto cita para
    comparação. Número não encontrado fica ausente (o texto mudou de redação: nenhuma
    conferência é feita com ele). Os padrões seguem a redação das notícias de 2024 e 2025,
    conferida nos arquivos guardados no bronze."""
    t = texto_de_html(texto_html)
    out = collections.defaultdict(lambda: {"trechos": {}})
    m = re.search(r"desempenho das distribuidoras no fornecimento de energia el[ée]trica em (\d{4})", t)
    if not m:
        return {}
    ano = int(m.group(1))

    def num(s):
        return _num(s)
    m = re.search(r"(ficaram,? (?:em m[ée]dia,? )?([\d.,]+) horas (?:em m[ée]dia )?sem energia \(DEC\).*?em rela[çc][ãa]o a "
                  r"(\d{4}),? quando (?:se registraram|registrou-se) ([\d.,]+) horas)", t)
    if m and int(m.group(3)) == ano - 1:
        out[ano]["dec"], out[ano - 1]["dec"] = num(m.group(2)), num(m.group(4))
        out[ano]["trechos"]["dec"] = out[ano - 1]["trechos"]["dec"] = m.group(1)
    m = re.search(r"(reduzindo de ([\d.,]+) interrup[çc][õo]es em (\d{4}) para ([\d.,]+) interrup[çc][õo]es em m[ée]dia "
                  r"por consumidor em (\d{4}))", t)
    if m and int(m.group(3)) == ano - 1 and int(m.group(5)) == ano:
        out[ano - 1]["fec"], out[ano]["fec"] = num(m.group(2)), num(m.group(4))
        out[ano]["trechos"]["fec"] = out[ano - 1]["trechos"]["fec"] = m.group(1)
    m = re.search(r"(de R\$ ?([\d.,]+) bilh[ãa]o em (\d{4}) para R\$ ?([\d.,]+) bilh[ãa]o em (\d{4}))", t)
    if m and int(m.group(3)) == ano - 1 and int(m.group(5)) == ano:
        out[ano - 1]["compensacao_rs"], out[ano]["compensacao_rs"] = num(m.group(2)) * 1e9, num(m.group(4)) * 1e9
        out[ano]["trechos"]["compensacao_rs"] = out[ano - 1]["trechos"]["compensacao_rs"] = m.group(1)
        resto = t[m.end():m.end() + 300]
        q = re.search(r"(quantidade de compensa[çc][õo]es[^.]*?de ([\d.,]+) para ([\d.,]+) milh[õo]es)", resto)
        if q:
            out[ano - 1]["compensacoes_qtd"], out[ano]["compensacoes_qtd"] = num(q.group(2)) * 1e6, num(q.group(3)) * 1e6
            out[ano]["trechos"]["compensacoes_qtd"] = out[ano - 1]["trechos"]["compensacoes_qtd"] = q.group(1)
    return {a: dict(v) for a, v in out.items() if len(v) > 1}


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
