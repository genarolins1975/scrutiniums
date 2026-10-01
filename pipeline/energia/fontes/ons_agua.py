"""Parsers dos conjuntos hidrológicos do ONS usados pelo módulo Água e clima (agua_detalhe).

Conjuntos (portal https://dados.ons.org.br, arquivos no S3 ons-aws-prod-opendata):
- EAR e ENA diárias por REE (reservatório equivalente de energia), desde 2016;
- EAR e ENA diárias por bacia hidroenergética, desde 2000;
- EAR diária por reservatório (Parquet, desde 2000): capacidade máxima de cada
  reservatório repartida entre o subsistema próprio e o subsistema a jusante;
- ENA diária por reservatório (CSV até 2020, Parquet desde 2021): traz a MLT de cada
  usina em MWmed (coluna mlt_ena, incluída na versão 1.2 do dicionário);
- Dados hidráulicos por reservatório, base diária (Parquet): volume útil, vazões
  afluente, defluente, turbinada, vertida, transferida, natural, incremental;
- Cadastro de reservatórios (volume útil total em hm³, coordenadas, datas);
- Precipitação diária observada em estações (2020 e 2021, conjunto descontinuado pelo
  ONS), usada só para conferir a precipitação estimada por satélite.

Por que os parsers aceitam variações de cabeçalho: os arquivos não seguem à risca o
dicionário. O ENA por REE chama a coluna do nome de `nom_reservatorioee` (o dicionário
diz `nom_ree`), o EAR por bacia usa `nomecurto` (dicionário: `nom_curto`), e os Parquet
de anos antigos trazem números como texto ("0E-8", "264.00000000") enquanto os recentes
trazem double. A variação é registrada por vintage (esquema observado) e tratada aqui,
nunca corrigida em silêncio no dado.

Ausência: campo vazio vira None e não gera observação. Zero publicado é zero.
"""
import csv
import gzip
import io
import math
import os
import shutil
import sys
import tempfile
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia.fontes import ckan  # noqa: E402

S3 = "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/"

# pacote CKAN → (diretório no S3, prefixo dos arquivos anuais)
PACOTES = {
    "ear_ree": ("ear-diario-por-ree-reservatorio-equivalente-de-energia", "ear_ree_di", "EAR_DIARIO_REE_"),
    "ena_ree": ("ena-diario-por-ree-reservatorio-equivalente-de-energia", "ena_ree_di", "ENA_DIARIO_REE_"),
    "ear_bacia": ("ear-diario-por-bacia", "ear_bacia_di", "EAR_DIARIO_BACIAS_"),
    "ena_bacia": ("ena-diario-por-bacia", "ena_bacia_di", "ENA_DIARIO_BACIAS_"),
    "ear_res": ("ear-diario-por-reservatorio", "ear_reservatorio_di", "EAR_DIARIO_RESERVATORIOS_"),
    "ena_res": ("ena-diario-por-reservatorio", "ena_reservatorio_di", "ENA_DIARIO_RESERVATORIOS_"),
    "hidro_res": ("dados-hidrologicos-res", "dados_hidrologicos_di", "DADOS_HIDROLOGICOS_RES_"),
    "cadastro": ("reservatorio", "reservatorio", "RESERVATORIOS"),
    "precip_est": ("precipitacao-estacao", "precipitacao_estacao_di", "Precipitacao_Diaria_Observada-"),
    "bacias_shp": ("bacia_contorno", "bacia_contorno", "Bacias_Hidrograficas_SIN"),
    # por subsistema: os mesmos arquivos do silver principal, recapturados na mesma coleta
    # dos arquivos por reservatório, só para reconciliar valores da mesma captura
    "ear_sm": ("ear-diario-por-subsistema", "ear_subsistema_di", "EAR_DIARIO_SUBSISTEMA_"),
    "ena_sm": ("ena-diario-por-subsistema", "ena_subsistema_di", "ENA_DIARIO_SUBSISTEMA_"),
}

SUBSISTEMAS = ("SE", "S", "NE", "N")


def num(v):
    """Número de um campo do ONS (texto ou número) ou None. "0E-8" é zero publicado."""
    if v is None:
        return None
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        f = float(v)
        return None if math.isnan(f) or math.isinf(f) else f
    s = str(v).strip()
    if not s or s.upper() in ("NAN", "NULL", "NA", "N/A", "-"):
        return None
    try:
        f = float(s.replace(",", ".")) if s.count(",") == 1 and "." not in s else float(s)
    except ValueError:
        return None
    return None if math.isnan(f) or math.isinf(f) else f


def nome(v):
    """Nome canônico de bacia, REE ou reservatório: aparado, maiúsculo, espaços simples.
    Os arquivos trazem nomes com espaços à direita ("JEQUITINHONHA  ")."""
    return " ".join(str(v or "").split()).upper()


def data_iso(v):
    """AAAA-MM-DD de texto ou datetime (os Parquet trazem timestamp em alguns anos)."""
    if v is None:
        return None
    if hasattr(v, "date") and callable(v.date):
        return v.date().isoformat()
    s = str(v).strip()
    return s[:10] if len(s) >= 10 else None


def codigo(v):
    """Código inteiro (cod_resplanejamento, cod_usina) como texto; os Parquet de 2025
    trazem double (154.0), os de 2000 trazem int32."""
    x = num(v)
    if x is None:
        return None
    return str(int(round(x)))


# ---------------------------------------------------------------- recursos por ano

def recursos_anuais(pac, prefixo, preferir=("PARQUET", "CSV")):
    """{ano: recurso CKAN} com um único recurso por ano, no formato preferido que
    existir para aquele ano. O ENA por reservatório só tem Parquet desde 2021: para os
    anos anteriores o CSV é o recurso oficial equivalente."""
    por_ano = defaultdict(dict)
    for r in pac.get("resources", []):
        url = r.get("url") or ""
        arq = url.rsplit("/", 1)[-1]
        fmt = (r.get("format") or "").upper()
        if not arq.startswith(prefixo):
            continue
        base_nome, _, ext = arq.rpartition(".")
        resto = base_nome[len(prefixo):]
        if not resto.isdigit() or len(resto) != 4:
            continue
        por_ano[int(resto)][fmt] = r
    out = {}
    for ano, fmts in por_ano.items():
        for f in preferir:
            if f in fmts:
                out[ano] = fmts[f]
                break
    return out


# ---------------------------------------------------------------- leitura de arquivos do bronze

def linhas_bronze(caminho, ext, colunas=None, lote=200000):
    """Itera as linhas (dicts) de um arquivo do bronze, CSV ou Parquet, sem carregar o
    arquivo inteiro. Parquet: descompacta o .gz para um temporário (o formato precisa
    de acesso aleatório ao rodapé) e lê em lotes só as colunas pedidas que existirem."""
    ext = (ext or "").lower()
    if ext == "parquet":
        import pyarrow.parquet as pq
        fd, tmp = tempfile.mkstemp(prefix="agua-", suffix=".parquet")
        os.close(fd)
        try:
            with base.abre_bronze(caminho) as src, open(tmp, "wb") as dst:
                shutil.copyfileobj(src, dst, 1 << 20)
            pf = pq.ParquetFile(tmp)
            existentes = [c.name for c in pf.schema_arrow]
            cols = [c for c in colunas if c in existentes] if colunas else None
            for b in pf.iter_batches(columns=cols, batch_size=lote):
                for row in b.to_pylist():
                    yield row
        finally:
            try:
                os.remove(tmp)
            except OSError:
                pass
    else:
        for row in ckan.le_csv_bronze(caminho, separador=";"):
            yield row


def colunas_bronze(caminho, ext):
    """Cabeçalho observado do arquivo (para registrar deriva de esquema por vintage)."""
    ext = (ext or "").lower()
    if ext == "parquet":
        import pyarrow.parquet as pq
        fd, tmp = tempfile.mkstemp(prefix="agua-", suffix=".parquet")
        os.close(fd)
        try:
            with base.abre_bronze(caminho) as src, open(tmp, "wb") as dst:
                shutil.copyfileobj(src, dst, 1 << 20)
            pf = pq.ParquetFile(tmp)
            return [f"{c.name}:{c.type}" for c in pf.schema_arrow]
        finally:
            try:
                os.remove(tmp)
            except OSError:
                pass
    with base.abre_bronze(caminho) as f:
        primeira = f.readline().decode("utf-8-sig", errors="replace")
    return [c.strip().strip('"') for c in primeira.strip().split(";")]


def _campo(row, *opcoes):
    for o in opcoes:
        if o in row:
            return row[o]
    return None


# ---------------------------------------------------------------- EAR e ENA agregados (REE, bacia)

def parse_ear_agregado(linhas, recorte):
    """EAR por REE ou por bacia → (série, ref, valor). Séries: ear_mwmes.<NOME>,
    ear_max_mwmes.<NOME>, ear_pct.<NOME>."""
    if recorte == "ree":
        k_nome, k_max, k_mw, k_pct = ("nom_ree", "nom_reservatorioee"), "ear_max_ree", "ear_verif_ree_mwmes", "ear_verif_ree_percentual"
    else:
        k_nome, k_max, k_mw, k_pct = ("nomecurto", "nom_curto", "nom_bacia"), "ear_max_bacia", "ear_verif_bacia_mwmes", "ear_verif_bacia_percentual"
    for r in linhas:
        n = nome(_campo(r, *k_nome))
        ref = data_iso(r.get("ear_data"))
        if not n or not ref:
            continue
        yield f"ear_mwmes.{n}", ref, num(r.get(k_mw))
        yield f"ear_max_mwmes.{n}", ref, num(r.get(k_max))
        yield f"ear_pct.{n}", ref, num(r.get(k_pct))


def parse_ena_agregado(linhas, recorte, armazenavel=False):
    """ENA por REE ou por bacia → séries ena_bruta_mwmed e ena_bruta_pct_mlt (e, com
    armazenavel=True, ena_arm_mwmed e ena_arm_pct_mlt; a ENA armazenável por recorte fica
    só no bronze para manter o silver da família em tamanho que a cópia durável comporta,
    e por subsistema vem do silver principal). A unidade das colunas _mwmed é MWmed (média do dia): o dicionário
    diz "MWmês", mas a soma das ENA por reservatório, cujo dicionário diz MWmed, reproduz
    o valor do subsistema (conferência no módulo e no teste)."""
    sufixo = "ree" if recorte == "ree" else "bacia"
    k_nome = ("nom_reservatorioee", "nom_ree") if recorte == "ree" else ("nom_bacia", "nomecurto", "nom_curto")
    for r in linhas:
        n = nome(_campo(r, *k_nome))
        ref = data_iso(r.get("ena_data"))
        if not n or not ref:
            continue
        yield f"ena_bruta_mwmed.{n}", ref, num(r.get(f"ena_bruta_{sufixo}_mwmed"))
        yield f"ena_bruta_pct_mlt.{n}", ref, num(r.get(f"ena_bruta_{sufixo}_percentualmlt"))
        if armazenavel:
            yield f"ena_arm_mwmed.{n}", ref, num(r.get(f"ena_armazenavel_{sufixo}_mwmed"))
            yield f"ena_arm_pct_mlt.{n}", ref, num(r.get(f"ena_armazenavel_{sufixo}_percentualmlt"))


# ---------------------------------------------------------------- EAR por reservatório

COLS_EAR_RES = ["nom_reservatorio", "cod_resplanejamento", "tip_reservatorio", "nom_bacia", "nom_ree",
                "id_subsistema", "id_subsistema_jusante", "ear_data",
                "ear_reservatorio_subsistema_proprio_mwmes", "ear_reservatorio_subsistema_jusante_mwmes",
                "earmax_reservatorio_subsistema_proprio_mwmes", "earmax_reservatorio_subsistema_jusante_mwmes",
                "ear_reservatorio_percentual"]


def parse_ear_reservatorio(linhas, diario_desde=None):
    """Lê um arquivo anual de EAR por reservatório e devolve:

    - obs: observações (série, ref, valor)
      * earmax_proprio.<cod> e earmax_jusante.<cod>: SÓ no primeiro dia do arquivo e nos
        dias em que o valor muda (série em degraus: o valor vale desde a data). É assim
        que as mudanças de capacidade entram no silver sem 1,5 milhão de linhas diárias;
      * ear_proprio.<cod> e ear_jusante.<cod> (MWmês): diários, só a partir de
        `diario_desde` (janela publicada) e só para reservatórios com EAR máxima positiva;
    - presenca: {cod: (primeiro_dia, ultimo_dia)} no arquivo (entrada e saída de reservatórios);
    - atributos: {cod: {campo: valor}} do último dia do arquivo;
    - soma: {(sm, ref): (ear, earmax)} reconstituída pela regra do ONS (próprio no
      subsistema da usina + jusante no subsistema a jusante), para conferir contra o
      conjunto por subsistema.
    """
    por_res = defaultdict(dict)
    atributos, presenca = {}, {}
    soma = defaultdict(lambda: [0.0, 0.0])
    obs = []
    for r in linhas:
        cod = codigo(r.get("cod_resplanejamento"))
        ref = data_iso(r.get("ear_data"))
        if cod is None or not ref:
            continue
        sp = nome(r.get("id_subsistema")) or None
        sj = nome(r.get("id_subsistema_jusante")) or None
        ep, ej = num(r.get("ear_reservatorio_subsistema_proprio_mwmes")), num(r.get("ear_reservatorio_subsistema_jusante_mwmes"))
        mp, mj = num(r.get("earmax_reservatorio_subsistema_proprio_mwmes")), num(r.get("earmax_reservatorio_subsistema_jusante_mwmes"))
        por_res[cod][ref] = (mp, mj)
        p0, p1 = presenca.get(cod, (ref, ref))
        presenca[cod] = (min(p0, ref), max(p1, ref))
        if ref >= presenca[cod][1]:
            atributos[cod] = {"nome": nome(r.get("nom_reservatorio")), "tipo": str(r.get("tip_reservatorio") or "").strip(),
                              "bacia": nome(r.get("nom_bacia")), "ree": nome(r.get("nom_ree")),
                              "subsistema": sp or "", "subsistema_jusante": sj or ""}
        if sp:
            s = soma[(sp, ref)]
            s[0] += ep or 0.0
            s[1] += mp or 0.0
        if sj:
            s = soma[(sj, ref)]
            s[0] += ej or 0.0
            s[1] += mj or 0.0
        if diario_desde and ref >= diario_desde and ((mp or 0) > 0 or (mj or 0) > 0):
            # só reservatórios com capacidade: a fio d'água tem EAR zero por definição
            obs.append((f"ear_proprio.{cod}", ref, ep))
            if sj:
                obs.append((f"ear_jusante.{cod}", ref, ej))
    for cod, dias_ in por_res.items():
        ant = (None, None)
        for i, ref in enumerate(sorted(dias_)):
            mp, mj = dias_[ref]
            if i == 0 or not _igual(mp, ant[0]):
                obs.append((f"earmax_proprio.{cod}", ref, mp))
            if i == 0 or not _igual(mj, ant[1]):
                obs.append((f"earmax_jusante.{cod}", ref, mj))
            ant = (mp, mj)
    return {"obs": obs, "presenca": presenca, "atributos": atributos, "soma": dict(soma)}


def _igual(a, b, tol=1e-6):
    if a is None or b is None:
        return a is None and b is None
    return abs(a - b) <= tol


# ---------------------------------------------------------------- ENA por reservatório

COLS_ENA_RES = ["nom_reservatorio", "cod_resplanejamento", "tip_reservatorio", "nom_bacia", "nom_ree",
                "id_subsistema", "ena_data", "ena_bruta_res_mwmed", "ena_bruta_res_percentualmlt",
                "ena_armazenavel_res_mwmed", "mlt_ena"]


def parse_ena_reservatorio(linhas):
    """ENA por reservatório → MLT em degraus e somas por subsistema.

    - mlt_mwmed.<cod>: MLT da usina (MWmed) no primeiro dia do arquivo e nos dias em que
      muda. É a evidência da versão da MLT: uma mudança em usina existente, no mesmo mês
      do calendário, é revisão da referência, não entrada de usina;
    - soma_ena_bruta_mwmed.<SM>, soma_mlt_mwmed.<SM>, n_res_ena.<SM>: soma diária das
      usinas do subsistema (unidade MWmed segundo o dicionário por reservatório), para
      conferir a unidade e a MLT implícita do conjunto por subsistema.
    """
    mlt = defaultdict(dict)
    soma = defaultdict(lambda: [0.0, 0.0, 0])
    for r in linhas:
        cod = codigo(r.get("cod_resplanejamento"))
        ref = data_iso(r.get("ena_data"))
        if cod is None or not ref:
            continue
        sm = nome(r.get("id_subsistema"))
        e, m = num(r.get("ena_bruta_res_mwmed")), num(r.get("mlt_ena"))
        mlt[cod][ref] = m
        if sm and e is not None:
            s = soma[(sm, ref)]
            s[0] += e
            s[1] += m or 0.0
            s[2] += 1
    obs = []
    for cod, dias_ in mlt.items():
        ant = None
        for i, ref in enumerate(sorted(dias_)):
            v = dias_[ref]
            if i == 0 or not _igual(v, ant):
                obs.append((f"mlt_mwmed.{cod}", ref, v))
            ant = v
    for (sm, ref), (e, m, n) in soma.items():
        obs.append((f"soma_ena_bruta_mwmed.{sm}", ref, e))
        obs.append((f"soma_mlt_mwmed.{sm}", ref, m))
        obs.append((f"n_res_ena.{sm}", ref, float(n)))
    return obs


# ---------------------------------------------------------------- dados hidráulicos por reservatório

# séries guardadas no silver. Nível, uso consuntivo, evaporação e vazão incremental ficam
# só no bronze: não entram no fechamento publicado pelo ONS (afluência − defluência =
# variação do volume) e, guardadas diariamente para 177 reservatórios, fariam o silver da
# família crescer cerca de 260 mil linhas por ano a mais.
CAMPOS_HIDRO = {
    "vol_util_pct": "val_volumeutilcon",
    "q_afluente": "val_vazaoafluente",
    "q_defluente": "val_vazaodefluente",
    "q_turbinada": "val_vazaoturbinada",
    "q_vertida": "val_vazaovertida",
    "q_outras": "val_vazaooutrasestruturas",
    "q_transferida": "val_vazaotransferida",
    "q_natural": "val_vazaonatural",
}
COLS_HIDRO = ["id_subsistema", "tip_reservatorio", "nom_bacia", "nom_ree", "id_reservatorio", "nom_reservatorio",
              "num_ordemcs", "cod_usina", "din_instante"] + list(CAMPOS_HIDRO.values())


def parse_dados_hidrologicos(linhas, desde=None):
    """Dados hidráulicos diários → observações por reservatório e atributos.

    Chave do reservatório: id_reservatorio (texto do ONS, presente em todas as linhas;
    quatro reservatórios sem usina vêm sem cod_usina). Séries <campo>.<id>, com campo em
    CAMPOS_HIDRO; vazões em m³/s, volume útil em % do volume útil, nível em m."""
    obs, atributos = [], {}
    for r in linhas:
        rid = nome(r.get("id_reservatorio"))
        ref = data_iso(r.get("din_instante"))
        if not rid or not ref or (desde and ref < desde):
            continue
        for serie, col in CAMPOS_HIDRO.items():
            obs.append((f"{serie}.{rid}", ref, num(r.get(col))))
        atributos[rid] = {"nome": nome(r.get("nom_reservatorio")), "cod_usina": codigo(r.get("cod_usina")) or "",
                          "tipo": nome(r.get("tip_reservatorio")), "bacia": nome(r.get("nom_bacia")),
                          "ree": nome(r.get("nom_ree")), "subsistema": nome(r.get("id_subsistema")),
                          "ordem_cascata": codigo(r.get("num_ordemcs")) or ""}
    return obs, atributos


# ---------------------------------------------------------------- cadastro de reservatórios

CAMPOS_CADASTRO = ("nom_reservatorio", "tip_reservatorio", "cod_posto", "nom_usina", "ceg", "id_subsistema",
                   "nom_bacia", "nom_rio", "nom_ree", "dat_entrada", "val_cotamaxima", "val_cotaminima",
                   "val_volmax", "val_volmin", "val_volutiltot", "val_produtividade65volutil",
                   "val_latitude", "val_longitude", "res_id")


def parse_cadastro(linhas):
    """Cadastro → registros (chave cod_resplanejamento, campo, valor). O arquivo repete
    ITAIPU (duas linhas idênticas): a chave é a mesma e a repetição é contada, não somada."""
    out, vistos = [], defaultdict(int)
    for r in linhas:
        cod = codigo(r.get("cod_resplanejamento"))
        if cod is None:
            continue
        vistos[cod] += 1
        for campo in CAMPOS_CADASTRO:
            v = r.get(campo)
            v = None if v is None else str(v).strip()
            out.append((cod, campo, v if v else None))
    return out, {k: n for k, n in vistos.items() if n > 1}


# ---------------------------------------------------------------- precipitação observada (2020 e 2021)

def parse_precipitacao_estacoes(linhas, localiza):
    """Precipitação diária observada nas estações (INMET e agentes, publicada pelo ONS
    para 2020 e 2021) → soma mensal por estação e média mensal por bacia.

    `localiza(lat, lon)` devolve a bacia ONS do polígono que contém a estação, ou None.
    Mês de uma estação só entra se tiver todos os dias do mês com medida (senão a soma
    subestimaria a chuva); a média da bacia é a média simples das estações completas.
    Retorna observações precip_estacoes_mm_mes.<BACIA>, n_estacoes.<BACIA> com ref AAAA-MM."""
    import calendar
    por_est = defaultdict(lambda: defaultdict(dict))
    coords = {}
    for r in linhas:
        est = str(r.get("cod_estacao") or "").strip()
        ref = data_iso(r.get("dat_observada"))
        v = num(r.get("val_medida"))
        if not est or not ref or v is None or v < 0:
            continue
        lat, lon = num(r.get("val_latitude")), num(r.get("val_longitude"))
        if lat is None or lon is None:
            continue
        coords[est] = (lat, lon)
        por_est[est][ref[:7]][ref] = v
    bacia_de = {est: localiza(lat, lon) for est, (lat, lon) in coords.items()}
    por_bacia = defaultdict(list)
    for est, meses in por_est.items():
        b = bacia_de.get(est)
        if not b:
            continue
        for mes, dias_ in meses.items():
            ndias = calendar.monthrange(int(mes[:4]), int(mes[5:7]))[1]
            if len(dias_) == ndias:
                por_bacia[(b, mes)].append(sum(dias_.values()))
    obs = []
    for (b, mes), vs in por_bacia.items():
        obs.append((f"precip_estacoes_mm_mes.{b}", mes, sum(vs) / len(vs)))
        obs.append((f"n_estacoes.{b}", mes, float(len(vs))))
    resumo = {"estacoes": len(coords), "estacoes_em_bacia": sum(1 for b in bacia_de.values() if b)}
    return obs, resumo


# ---------------------------------------------------------------- MLT publicada nos relatórios do PMO

MESES_PT = {"janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3, "abril": 4, "maio": 5, "junho": 6, "julho": 7,
            "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12}
SM_PMO = {"SE/CO": "SE", "S": "S", "NE": "NE", "N": "N"}


def parse_mlt_pmo(texto):
    """Tabela "MLT das ENAs (MWmed)" do Relatório Executivo do PMO (texto do pdftotext
    -layout). Devolve {"pagina", "edicao", "valores": [(AAAA-MM, sm, MWmed)]} ou None.

    Por que este documento: os dicionários do ONS não dizem qual MLT o conjunto diário de
    ENA usa; o relatório do PMO publica a MLT mensal por subsistema em MWmed, e a
    comparação com a MLT implícita do conjunto aberto mostra se as duas são a mesma
    versão. Os números vêm com ponto de milhar ("65.813" = 65 813 MWmed)."""
    import re
    linhas = texto.split("\n")
    pagina = 1
    edicao = None
    for i, ln in enumerate(linhas):
        pagina += ln.count("\f")
        if edicao is None:
            m = re.search(r"PMO\s+([A-ZÇÃ]+)\s+(\d{4})\s*\|\s*SEMANA OPERATIVA DE ([\d/]+) A ([\d/]+)", ln.replace("\f", ""), re.I)
            if m:
                edicao = {"mes": m.group(1).lower(), "ano": int(m.group(2)), "semana": f"{m.group(3)} a {m.group(4)}"}
        if "MLT das ENAs" not in ln:
            continue
        cab = linhas[i + 1].split()
        meses = [w.lower() for w in cab[1:] if w.lower() in MESES_PT]
        if len(meses) != 2 or edicao is None:
            return None
        ano = edicao["ano"]
        m1 = MESES_PT[meses[0]]
        m2 = MESES_PT[meses[1]]
        refs = [f"{ano}-{m1:02d}", f"{ano + (1 if m2 < m1 else 0)}-{m2:02d}"]
        valores = []
        for ln2 in linhas[i + 2:i + 8]:
            partes = ln2.split()
            if len(partes) == 3 and partes[0] in SM_PMO:
                for ref, v in zip(refs, partes[1:]):
                    valores.append((ref, SM_PMO[partes[0]], float(v.replace(".", "").replace(",", "."))))
        return {"pagina": pagina, "edicao": edicao, "valores": valores} if len(valores) == 8 else None
    return None
