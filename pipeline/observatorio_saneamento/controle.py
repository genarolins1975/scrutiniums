"""Controle societário (capítulo 7): posição acionária das companhias abertas que prestam água e esgoto.

Fonte: CVM, dados abertos, Formulário de Referência (FRE), arquivo anual com todas as companhias abertas
(`fre_cia_aberta_AAAA.zip`: índice de documentos e `posicao_acionaria`). A ligação com o SINISA é feita
por CNPJ: só entram as companhias cujo CNPJ foi declarado por algum município como prestador de água ou
esgoto no módulo Gestão Municipal do SINISA 2024, e a ficha do prestador só é ligada quando os municípios
declarados pelo CNPJ coincidem com os da ficha. Nenhum casamento é feito por nome.

Recorte, deliberadamente estreito e documentado:
- Só companhias abertas com FRE no ano. Empresas fechadas, SPEs sem registro na CVM, autarquias e
  prestadores municipais não têm esse formato: a ausência de linha não é ausência de controle.
- Documento: a última versão de cada companhia no índice do arquivo. A data de referência do arquivo
  (campo DT_REFER) é posterior à data de recebimento e não é a data da posição; a data usada é a de recebimento.
- Pessoas físicas: nome só quando controlador ou participante de acordo de acionistas; as demais entram
  somadas. CPF e representante legal não são publicados nem guardados: o seed leva só as colunas que a
  gold usa, sem CPF, e o nome de pessoa física não controladora e fora de acordo é trocado por "Pessoa física".

Coleta: python3 -m pipeline.observatorio_saneamento.controle --coletar
"""
import argparse
import csv
import datetime as dt
import gzip
import hashlib
import io
import json
import re
import urllib.request
import zipfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SEED = AQUI / "seed" / "cvm"
ANO = 2026
URL_FRE = f"https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FRE/DADOS/fre_cia_aberta_{ANO}.zip"
ARQ_DOC = f"fre_cia_aberta_{ANO}.csv"
ARQ_POS = f"fre_cia_aberta_posicao_acionaria_{ANO}.csv"
UA = "ObservatorioBrasileiroDeCredito coleta cvm"
SERVICOS = {"Abastecimento de Água": "agua", "Esgotamento Sanitário": "esgoto"}
LIMIAR_FICHA = 0.8  # fração dos municípios declarados pelo CNPJ que a ficha do prestador precisa cobrir
TOLERANCIA_PCT = 0.01  # arredondamento das posições publicadas (pontos percentuais)
CPF = re.compile(r"\d{3}\.\d{3}\.\d{3}-\d{2}|(?<!\d)\d{11}(?!\d)")
# colunas de posicao_acionaria que a gold usa; o resto (representante legal, nacionalidade, UF, datas de composição) não entra no seed
COLUNAS_POSICAO = [
    "CNPJ_Companhia", "ID_Documento", "ID_Acionista", "ID_Acionista_Relacionado", "Acionista", "Tipo_Pessoa_Acionista", "CPF_CNPJ_Acionista",
    "Quantidade_Total_Acoes_Circulacao", "Percentual_Acao_Ordinaria_Circulacao", "Percentual_Acao_Preferencial_Circulacao",
    "Percentual_Total_Acoes_Circulacao", "Residente_Exterior", "Data_Ultima_Alteracao", "Acionista_Controlador", "Participante_Acordo_Acionistas",
]


def sha(b):
    return hashlib.sha256(b).hexdigest()


def cnpj14(v):
    d = re.sub(r"\D", "", str(v or ""))
    return d if len(d) == 14 else None


def cnpj_fmt(d):
    return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}"


# ---------------------------------------------------------------------------
# CNPJs declarados pelos municípios
# ---------------------------------------------------------------------------

def declarados(linhas):
    """CNPJ → conjunto de municípios (código IBGE de 7 dígitos) que o declaram como prestador de água ou esgoto.

    `linhas`: aba "Detalhamento Prestadores Serv" do módulo Gestão Municipal. Só conta prestação que existe."""
    r = {}
    for l in linhas:
        if SERVICOS.get(l.get("Tipo de serviço prestado")) is None:
            continue
        if l.get("Existe a prestação do serviço no município?") != "Sim":
            continue
        c = cnpj14(l.get("Número do CNPJ do prestador de serviços no município"))
        if c:
            r.setdefault(c, set()).add(str(int(l["Cod_IBGE"])))
    return r


def declarados_do_seed():
    d = json.loads(gzip.decompress((AQUI / "seed" / "sinisa_gestao_municipal.json.gz").read_bytes()))
    a = d["abas"]["Detalhamento Prestadores Serv"]
    cods = [c["codigo"] for c in a["colunas"]]
    return declarados([dict(zip(cods, r["v"])) for r in a["registros"]])


# ---------------------------------------------------------------------------
# coleta
# ---------------------------------------------------------------------------

def _csv(bruto):
    return list(csv.DictReader(io.StringIO(bruto.decode("latin-1")), delimiter=";"))


def _gravar_csv(nome, linhas, cabecalho):
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=cabecalho, delimiter=";", lineterminator="\n")
    w.writeheader()
    w.writerows(linhas)
    bruto = buf.getvalue().encode("utf-8")
    (SEED / f"{nome}.gz").write_bytes(gzip.compress(bruto, mtime=0))
    return {"arquivo": f"{nome}.gz", "sha256": sha(bruto), "bytes": len(bruto), "linhas": len(linhas)}


def reduzir(l):
    """Linha de posicao_acionaria como o seed a guarda: só as colunas usadas, CPF em branco e, para pessoa física que não é
    controladora nem participa de acordo, o nome trocado por "Pessoa física". A gold nunca mostra esse nome."""
    r = {c: l[c] for c in COLUNAS_POSICAO}
    if r["Tipo_Pessoa_Acionista"].strip() == "PF":
        r["CPF_CNPJ_Acionista"] = ""
        if not (_sn(r["Acionista_Controlador"]) or _sn(r["Participante_Acordo_Acionistas"])):
            r["Acionista"] = "Pessoa física"
    return r


def coletar():
    SEED.mkdir(parents=True, exist_ok=True)
    alvo = declarados_do_seed()
    with urllib.request.urlopen(urllib.request.Request(URL_FRE, headers={"User-Agent": UA}), timeout=300) as r:
        zipado = r.read()
        modificado = r.headers.get("Last-Modified")
    z = zipfile.ZipFile(io.BytesIO(zipado))
    membros, brutos = {}, {}
    for nome in (ARQ_DOC, ARQ_POS):
        brutos[nome] = z.read(nome)
        membros[nome] = {"sha256": sha(brutos[nome]), "bytes": len(brutos[nome])}
    docs, pos = _csv(brutos[ARQ_DOC]), _csv(brutos[ARQ_POS])
    ciass = {cnpj14(d["CNPJ_CIA"]) for d in docs} & set(alvo)
    docs_sel = [d for d in docs if cnpj14(d["CNPJ_CIA"]) in ciass]
    pos_sel = [reduzir(p) for p in pos if cnpj14(p["CNPJ_Companhia"]) in ciass]
    if not docs_sel or not pos_sel:
        raise ValueError("nenhuma companhia declarada no SINISA encontrada no FRE: resposta inesperada da CVM")
    arquivos = {
        "documentos": _gravar_csv("documentos.csv", docs_sel, list(docs[0])),
        "posicao_acionaria": _gravar_csv("posicao_acionaria.csv", pos_sel, COLUNAS_POSICAO),
    }
    manifesto = {
        "capturado_em": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "ano": ANO,
        "url": URL_FRE,
        "zip": {"sha256": sha(zipado), "bytes": len(zipado), "last_modified": modificado},
        "membros": membros,
        "filtro": {
            "criterio": "CNPJ declarado por algum município como prestador de água ou esgoto (Gestão Municipal do SINISA 2024) e presente no índice do FRE",
            "cnpjs": sorted(ciass),
        },
        "arquivos": arquivos,
    }
    (SEED / "manifesto.json").write_text(json.dumps(manifesto, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(len(ciass), "companhias,", len(pos_sel), "linhas de posição acionária", flush=True)


# ---------------------------------------------------------------------------
# construção da gold
# ---------------------------------------------------------------------------

def ler_seed():
    manifesto = json.loads((SEED / "manifesto.json").read_text(encoding="utf-8"))
    saida = {}
    for chave, a in manifesto["arquivos"].items():
        bruto = gzip.decompress((SEED / a["arquivo"]).read_bytes())
        if sha(bruto) != a["sha256"]:
            raise ValueError(f"seed da CVM alterado: {a['arquivo']}")
        texto = bruto.decode("utf-8")
        if CPF.search(texto):
            raise ValueError(f"seed da CVM com CPF: {a['arquivo']}; recolete com o redator atual")
        saida[chave] = list(csv.DictReader(io.StringIO(texto), delimiter=";"))
    return manifesto, saida["documentos"], saida["posicao_acionaria"]


def _pct(v):
    v = (v or "").strip()
    return round(float(v), 3) if v else None


def _sn(v):
    return (v or "").strip().upper() == "S"


def _qtd(v):
    v = (v or "").strip()
    return int(float(v)) if v else None


def _no(l):
    return {
        "nome": l["Acionista"].strip(),
        "tipo": l["Tipo_Pessoa_Acionista"].strip() or None,
        "cnpj": cnpj_fmt(cnpj14(l["CPF_CNPJ_Acionista"])) if l["Tipo_Pessoa_Acionista"].strip() == "PJ" and cnpj14(l["CPF_CNPJ_Acionista"]) else None,
        "pct_on": _pct(l["Percentual_Acao_Ordinaria_Circulacao"]),
        "pct_pn": _pct(l["Percentual_Acao_Preferencial_Circulacao"]),
        "pct_total": _pct(l["Percentual_Total_Acoes_Circulacao"]),
        "acoes": _qtd(l["Quantidade_Total_Acoes_Circulacao"]),
        "controlador": _sn(l["Acionista_Controlador"]),
        "acordo": _sn(l["Participante_Acordo_Acionistas"]),
        "exterior": _sn(l["Residente_Exterior"]),
        "atualizado_em": l["Data_Ultima_Alteracao"].strip() or None,
    }


def _vazio(n):
    """Linha de preenchimento da fonte (tesouraria ou "Outros" sem ações na cadeia). Posição minúscula, mas com ações, fica."""
    return all(n[c] in (None, 0) for c in ("pct_on", "pct_pn", "pct_total", "acoes"))


def _residual(n):
    return n["nome"] in ("Ações Tesouraria", "Outros") or n.get("agregado") is not None


def _arvore(linhas):
    """Posição de uma companhia: acionistas diretos e, abaixo de cada um, os acionistas dele na cadeia de controle
    declarada (percentuais do próprio acionista). Pessoa física não controladora e fora de acordo entra somada."""
    por_id = {l["ID_Acionista"]: l for l in linhas}
    filhos = {}
    for l in linhas:
        pai = l["ID_Acionista_Relacionado"].strip() or None
        if pai is not None and pai not in por_id:
            raise ValueError(f"acionista relacionado inexistente no documento: {pai}")
        filhos.setdefault(pai, []).append(l)
    # cada acionista tem no máximo um acionista acima: ciclo só existe como componente isolado, fora do alcance da raiz
    alcancados, fila = set(), [l["ID_Acionista"] for l in filhos.get(None, [])]
    while fila:
        i = fila.pop()
        if i not in alcancados:
            alcancados.add(i)
            fila.extend(f["ID_Acionista"] for f in filhos.get(i, []))
    if alcancados != set(por_id):
        raise ValueError("ciclo na hierarquia de controle ou acionista inalcançável a partir dos acionistas diretos")
    agregadas = [0]

    def monta(pai):
        nos, somadas = [], []
        for l in filhos.get(pai, []):
            n = _no(l)
            if _vazio(n):
                continue
            if n["tipo"] == "PF" and not (n["controlador"] or n["acordo"]):
                somadas.append(n)
                continue
            n["filhos"] = monta(l["ID_Acionista"])
            nos.append(n)
        if somadas:
            agregadas[0] += len(somadas)
            soma = lambda c: None if all(s[c] is None for s in somadas) else round(sum(s[c] or 0 for s in somadas), 3)  # noqa: E731
            nos.append({
                "nome": f"{len(somadas)} pessoas físicas não controladoras" if len(somadas) > 1 else "1 pessoa física não controladora",
                "tipo": "PF", "cnpj": None, "agregado": len(somadas),
                "pct_on": soma("pct_on"), "pct_pn": soma("pct_pn"), "pct_total": soma("pct_total"), "acoes": soma("acoes"),
                "controlador": False, "acordo": False, "exterior": False, "atualizado_em": None, "filhos": [],
            })
        nos.sort(key=lambda n: (_residual(n), -(n["pct_total"] or 0), n["nome"]))
        return nos

    topo = monta(None)
    return topo, agregadas[0], filhos, por_id


def _conferir(cnpj, linhas, filhos):
    """Soma das posições diretas e dos acionistas de cada acionista com cadeia declarada: 100% ± arredondamento."""
    f = lambda v: float(v) if (v or "").strip() else 0.0  # noqa: E731
    campos = {"total": "Percentual_Total_Acoes_Circulacao", "on": "Percentual_Acao_Ordinaria_Circulacao", "pn": "Percentual_Acao_Preferencial_Circulacao"}
    soma_topo = {k: round(sum(f(l[c]) for l in filhos.get(None, [])), 3) for k, c in campos.items()}
    if abs(soma_topo["total"] - 100) > TOLERANCIA_PCT or abs(soma_topo["on"] - 100) > TOLERANCIA_PCT:
        raise ValueError(f"{cnpj}: posições diretas somam {soma_topo['total']}% do total e {soma_topo['on']}% das ordinárias")
    if soma_topo["pn"] > TOLERANCIA_PCT and abs(soma_topo["pn"] - 100) > TOLERANCIA_PCT:
        raise ValueError(f"{cnpj}: posições diretas somam {soma_topo['pn']}% das preferenciais")
    desvio = 0.0
    for pai, fs in filhos.items():
        if pai is None:
            continue
        for k, c in campos.items():
            s = sum(f(l[c]) for l in fs)
            if s > TOLERANCIA_PCT:
                desvio = max(desvio, abs(s - 100))
    if desvio > TOLERANCIA_PCT:
        raise ValueError(f"{cnpj}: acionistas de um acionista somam desvio de {desvio:.3f} ponto percentual")
    return {"soma_topo_total": soma_topo["total"], "soma_topo_ordinarias": soma_topo["on"], "soma_topo_preferenciais": soma_topo["pn"], "maior_desvio_cadeia": round(desvio, 3)}


def _ficha(decl_mun, prestadores):
    """Prestador do SINISA cujos municípios cobrem os municípios declarados pelo CNPJ (cobertura ≥ limiar), ou None.

    Empate na maior cobertura não escolhe: sem ficha é melhor que ficha errada."""
    cobertas = []
    for p in prestadores:
        c = len(decl_mun & (set(p["municipios_agua"]) | set(p["municipios_esgoto"]))) / len(decl_mun)
        if c >= LIMIAR_FICHA:
            cobertas.append((c, p["id"]))
    if not cobertas:
        return None, None
    cobertas.sort(reverse=True)
    if len(cobertas) > 1 and cobertas[0][0] == cobertas[1][0]:
        return None, None
    return cobertas[0][1], round(cobertas[0][0], 3)


def construir(decl, prestadores):
    manifesto, docs, pos = ler_seed()
    por_cnpj_docs = {}
    for d in docs:
        por_cnpj_docs.setdefault(cnpj14(d["CNPJ_CIA"]), []).append(d)
    companhias, conferencias, sem_posicao, sem_ficha = [], [], [], []
    for c in sorted(manifesto["filtro"]["cnpjs"], key=lambda x: (-len(decl.get(x, ())), x)):
        ultima = max(por_cnpj_docs[c], key=lambda d: int(d["VERSAO"]))
        linhas = [p for p in pos if cnpj14(p["CNPJ_Companhia"]) == c and p["ID_Documento"] == ultima["ID_DOC"]]
        if not linhas:
            sem_posicao.append({"cnpj": cnpj_fmt(c), "nome": ultima["DENOM_CIA"]})
            continue
        topo, agregadas, filhos, _ = _arvore(linhas)
        conf = dict(cnpj=cnpj_fmt(c), **_conferir(c, linhas, filhos))
        conferencias.append(conf)
        prestador, cobertura = _ficha(decl[c], prestadores) if c in decl else (None, None)
        if prestador is None:
            sem_ficha.append({"cnpj": cnpj_fmt(c), "nome": ultima["DENOM_CIA"]})
        companhias.append({
            "cnpj": cnpj_fmt(c),
            "nome": ultima["DENOM_CIA"].strip(),
            "cd_cvm": ultima["CD_CVM"].strip(),
            "prestador": prestador,
            "cobertura_municipios_ficha": cobertura,
            "municipios_declarados": len(decl.get(c, ())),
            "documento": {
                "id": ultima["ID_DOC"], "versao": int(ultima["VERSAO"]), "categoria": ultima["CATEG_DOC"].strip(),
                "referencia": ultima["DT_REFER"], "recebido_em": ultima["DT_RECEB"], "link": ultima["LINK_DOC"].strip(),
            },
            "controlador_declarado": any(n["controlador"] for n in topo),
            "acordo_acionistas": any(n["acordo"] for n in topo),
            "pessoas_fisicas_somadas": agregadas,
            "acionistas": topo,
        })
    meta = {
        "ano": manifesto["ano"],
        "fonte": manifesto["url"],
        "capturado_em": manifesto["capturado_em"],
        "zip": manifesto["zip"],
        "membros": manifesto["membros"],
        "criterio": manifesto["filtro"]["criterio"],
        "companhias": len(companhias),
        "com_ficha": sum(1 for x in companhias if x["prestador"]),
        "sem_ficha": sem_ficha,
        "sem_posicao": sem_posicao,
        "conferencias": conferencias,
        "regras": {
            "limiar_ficha": LIMIAR_FICHA, "tolerancia_pct": TOLERANCIA_PCT,
            "pessoa_fisica": "nome só se controlador ou participante de acordo; as demais somadas; sem CPF",
        },
    }
    return {"companhias": companhias}, meta


def linhas_csv(controle):
    """Árvore achatada para o CSV: uma linha por acionista, com o acionista acima dele na cadeia."""
    cab = ["cnpj_companhia", "companhia", "nivel", "acionista_acima", "acionista", "tipo_pessoa", "cnpj_acionista", "pct_ordinarias",
           "pct_preferenciais", "pct_total", "controlador", "acordo_acionistas", "residente_exterior", "atualizado_em", "fre_versao", "fre_recebido_em"]
    saida = []

    def desce(c, nos, nivel, acima):
        for n in nos:
            saida.append([
                c["cnpj"], c["nome"], nivel, acima, n["nome"], n["tipo"], n["cnpj"], n["pct_on"], n["pct_pn"], n["pct_total"],
                "S" if n["controlador"] else "N", "S" if n["acordo"] else "N", "S" if n["exterior"] else "N", n["atualizado_em"],
                c["documento"]["versao"], c["documento"]["recebido_em"],
            ])
            desce(c, n["filhos"], nivel + 1, n["nome"])

    for c in controle["companhias"]:
        desce(c, c["acionistas"], 1, None)
    return cab, saida


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--coletar", action="store_true", help="baixa o FRE da CVM e grava o seed (precisa de rede)")
    if ap.parse_args().coletar:
        coletar()
    else:
        ap.print_help()
