"""Bases complementares de segurança alimentar: EBIA por UF, CadINSAN, PAA, PNAE, IPCA e SISVAN.

Desde o follow-up do PR #325, a gold também leva o bloco `ebia_social` (recortes sociais nacionais da EBIA,
tabelas SIDRA 9553 a 9562), com seed, manifesto e portão próprios em ebia_social.py.

Integração autorizada pelo responsável em 21/10/2026. As bases vieram do PR #131 (fechado) apenas
como matéria-prima: cada original foi baixado de novo da fonte oficial em 21/10/2026, conferido
byte a byte (ou, no serviço Solr do MDS, documento a documento) com a captura daquele PR e
reextraído aqui, sem reaproveitar os arquivos derivados dele.

Dois usos, sem rede por padrão:

  python -m pipeline.eficiencia_alimentar.complementos --originais DIR [--coletar] [--gravar-seed]
      Confere o SHA-256 de cada original em DIR (com --coletar, baixa antes), reextrai o recorte e
      o compara com o seed versionado. Edição nova exige --gravar-seed e revisão do manifesto.

  python -m pipeline.eficiencia_alimentar.complementos
      Lê o seed, valida (o portão reprova antes de qualquer escrita) e grava a gold agregada
      public/eficiencia/seguranca-alimentar/complementos.json. Os arquivos municipais por UF e os
      CSV saem do mesmo seed por scripts/materializar-seguranca-alimentar.mjs.

Regras: ausência continua ausência (None), nunca zero; o hífen do SIDRA em recorte não publicado
não vira zero; nenhuma taxa é recalculada quando a fonte publica a sua; somas e razões calculadas
aqui são marcadas como calculadas e levam a cobertura de municípios com dado.
"""
import argparse
import csv
import gzip
import hashlib
import io
import json
import os
import re
import subprocess
import tempfile
import unicodedata
import urllib.request
from decimal import Decimal
from pathlib import Path

from pipeline.eficiencia_alimentar import ebia_social

ROOT = Path(__file__).resolve().parents[2]
BASE = Path(__file__).resolve().parent
SEED = BASE / "seed/complementos.json.gz"
MANIFESTO = BASE / "seed/complementos-manifesto.json"
GOLD = ROOT / "public/eficiencia/seguranca-alimentar/complementos.json"
VERSAO = "2026-10-21.1"
CAPTURA = "2026-10-21"

MISOCIAL = "https://aplicacoes.mds.gov.br/sagi/servicos/misocial"
_CAMPOS_PAA = "codigo_ibge,municipio,sigla_uf,anomes_s,agricultores_fornec_paa_i,recur_pagos_agricul_paa_f"


def _url_paa(ano):
    return f"{MISOCIAL}?q=*%3A*&fq=anomes_s%3A{ano}12&rows=6000&wt=json&fl=" + _CAMPOS_PAA.replace(",", "%2C")


# Cada original: endereço exato, página de referência, período e o hash conferido em 21/10/2026.
# "conteudo": o serviço Solr do MDS muda o tempo de resposta no cabeçalho a cada consulta, então o
# hash que identifica a edição é o dos documentos ordenados por código (ver hash_conteudo_paa).
FONTES = [
    {"id": "sidra-9552-percentual", "arquivo": "sidra-9552-percentual.json",
     "nome": "IBGE · PNAD Contínua · Segurança alimentar · tabela 9552, distribuição percentual dos domicílios e coeficiente de variação",
     "url": "https://apisidra.ibge.gov.br/values/t/9552/n1/all/n2/all/n3/all/v/9784,9785/p/all/c1/all/c12404/all",
     "pagina": "https://sidra.ibge.gov.br/tabela/9552", "periodo": "2023 e 2024",
     "sha256": "fcbb313f97e77125b530eb8008856739d7e10d3c04c4b56dedc9cee1d8c6ae2f"},
    {"id": "sidra-9552-domicilios", "arquivo": "sidra-9552-domicilios.json",
     "nome": "IBGE · PNAD Contínua · Segurança alimentar · tabela 9552, domicílios em mil unidades e coeficiente de variação",
     "url": "https://apisidra.ibge.gov.br/values/t/9552/n1/all/n2/all/n3/all/v/162,5123/p/all/c1/all/c12404/all",
     "pagina": "https://sidra.ibge.gov.br/tabela/9552", "periodo": "2023 e 2024",
     "sha256": "959a5fd62b7654598f3e2c755b18843d72b8fa5d479c0ae52236a35460b56f80"},
    {"id": "mds-cadinsan-2025", "arquivo": "cadinsan-2025.pdf",
     "nome": "MDS · CadINSAN 2025 · relatório com anexo municipal",
     "url": "https://www.gov.br/mds/pt-br/Sisan/vigilancia-do-sisan/CADINSAN2025.pdf",
     "pagina": "https://www.gov.br/mds/pt-br/Sisan/vigilancia-do-sisan/CADinsan/", "periodo": "Cadastro Único de janeiro de 2025",
     "sha256": "8b08097877af02780843c27639c61894387c55ad5b09947633b6fd0f506af3a3"},
    *[{"id": f"mds-paa-{ano}", "arquivo": f"mds-paa-{ano}.json",
       "nome": f"MDS · MI Social · PAA, fornecedores e pagamentos no ano, referência dezembro de {ano}",
       "url": _url_paa(ano), "pagina": "https://wiki-sagi.mds.gov.br/home/DS/PAA/I/IN002", "periodo": str(ano),
       "sha256_bytes": sha, "conteudo": cont}
      for ano, sha, cont in [
          (2023, "6a16ad9596daa82e82505c7cc9041e7c7aa19e4d3c90241793276e25530b0520", "d2f18b66d0c162d360d15adcf81c9e869eefc1984bc47fe0dac47576441a1b86"),
          (2024, "e37bc569d694dafd04c32b2fde306aea6901a82978b23e6c6407999224a8bde4", "d03cdf41426b467ead9ac5a90c3e89ed37d7e6d23b5c2b8c16c12d8d71b47fc0"),
          (2025, "c8512f54f4ba62ba820a7a5573704f0d7dd733113084a12d170fa341e8ff58dc", "683d938d07275868f54f32e03a461e023b3471a12e10596500ca5d89e341a9cf")]],
    {"id": "ibge-municipios", "arquivo": "ibge-municipios.json",
     "nome": "IBGE · API de localidades · relação de municípios",
     "url": "https://servicodados.ibge.gov.br/api/v1/localidades/municipios",
     "pagina": "https://servicodados.ibge.gov.br/api/docs/localidades", "periodo": "relação vigente em 21/10/2026",
     "sha256": "86ecdccdf97d72e7e5e46f0854cfcea8bacc28154cc1bc4ed0e6110e3a6c9c02"},
    {"id": "fnde-pnae", "arquivo": "fnde-pnae.csv.gz",
     "nome": "FNDE · Plataforma Antonieta de Barros · produto de dados 82, PNAE: repasses, alunos e escolas por entidade executora",
     "url": "https://www.fnde.gov.br/plataforma-antonieta-de-barros-api/products/data-products/82/artifact",
     "pagina": "https://www.fnde.gov.br/plataforma-antonieta-de-barros/dados/produtos-de-dados/visualizar/82", "periodo": "2009 a 2026",
     "sha256": "2825b55c7205590c382c288f0671ef12f7f4b49b3b9b63056cba308a956c75f4"},
    {"id": "ibge-ipca-7060", "arquivo": "ibge-ipca-7060.json",
     "nome": "IBGE · IPCA · tabela 7060, variação mensal e em 12 meses",
     "url": "https://servicodados.ibge.gov.br/api/v3/agregados/7060/periodos/202301-202609/variaveis/63|2265?localidades=N1[all]&classificacao=315[7169,7170,7171,7432]",
     "pagina": "https://sidra.ibge.gov.br/tabela/7060", "periodo": "janeiro de 2023 a setembro de 2026",
     "sha256": "26531a4f24f5b9f74109cb698382cd60abed617ab135e57a5d42bc2335e3f137"},
    {"id": "ms-rgi-2025", "arquivo": "ms-relatorio-gestao-2025.pdf",
     "nome": "Ministério da Saúde · Relatório de Gestão Integrado 2025 · tabela 10 (SISVAN), página impressa 56",
     "url": "https://www.gov.br/saude/pt-br/acesso-a-informacao/auditorias/2025/relatorio-de-gestao-integrado/@@download/file/Relat%C3%B3rio%20de%20Gest%C3%A3o%20Integrado.pdf",
     "pagina": "https://www.gov.br/saude/pt-br/acesso-a-informacao/auditorias/2025/relatorio-de-gestao-integrado", "periodo": "2025, dados preliminares",
     "sha256": "17a1f8fd301d2c8b4370b519c5c363f0f4e0cd21bbc5b5fefb08290dfbdbcbc6"},
]


CLASSES_EBIA = {"109098": "segura", "109099": "insegura", "109100": "leve", "109101": "moderada", "109102": "grave", "109106": "total"}
SITUACOES = {"Total": "total", "Urbana": "urbana", "Rural": "rural"}


def sha256(b):
    return hashlib.sha256(b).hexdigest()


def hash_conteudo_paa(raw):
    docs = json.loads(raw)["response"]["docs"]
    docs = sorted(docs, key=lambda d: str(d.get("codigo_ibge")))
    return sha256(json.dumps(docs, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode())


def normaliza_nome(s):
    s = unicodedata.normalize("NFD", s.upper())
    return "".join(c for c in s if not unicodedata.combining(c) and c.isalnum())


def _numero_sidra(v):
    """Hífen, X, .. e ... continuam ausência: nos recortes usados aqui o hífen marca célula não publicada."""
    if v in ("-", "X", "..", "...", "", None):
        return None
    return float(v)


# ---------------------------------------------------------------- leitores (sem rede, sem efeitos)

def ler_municipios(raw):
    """Relação oficial: código de 7 dígitos, nome, UF e região."""
    out = {}
    for m in json.loads(raw):
        uf = (m.get("microrregiao") or {}).get("mesorregiao", {}).get("UF") or m["regiao-imediata"]["regiao-intermediaria"]["UF"]
        out[str(m["id"])] = {"nome": m["nome"], "uf": uf["sigla"], "uf_id": str(uf["id"]), "uf_nome": uf["nome"], "regiao": uf["regiao"]["nome"]}
    if len(out) < 5570:
        raise ValueError("Relação de municípios incompleta")
    return out


def ler_ebia(raw_pct, raw_qtd):
    """Percentual publicado (9784), CV do percentual (9785), mil domicílios (162) e CV (5123).

    UF: o SIDRA publica só a situação Total; Urbana e Rural trazem hífen em todas as células, que não
    vira zero. Brasil e Grandes Regiões: Total, Urbana e Rural.
    """
    linhas = {}
    for fonte, raw in (("pct", raw_pct), ("qtd", raw_qtd)):
        rows = json.loads(raw)
        cab = rows[0]
        if cab.get("D4N") != "Situação do domicílio" or cab.get("D5N") != "Situação de segurança alimentar existente no domicílio":
            raise ValueError("Cabeçalho SIDRA 9552 diferente do revisado")
        for r in rows[1:]:
            nivel = {"1": "brasil", "2": "regiao", "3": "uf"}[r["NC"]]
            situacao = SITUACOES[r["D4N"]]
            if nivel == "uf" and situacao != "total":
                if r["V"] != "-":
                    raise ValueError("UF com recorte urbano ou rural publicado: rever o escopo")
                continue
            classe = CLASSES_EBIA[r["D5C"]]
            chave = (nivel, r["D1C"], int(r["D3C"]), situacao)
            linha = linhas.setdefault(chave, {"nivel": nivel, "codigo": r["D1C"], "territorio": r["D1N"], "ano": int(r["D3C"]), "situacao": situacao, "classes": {}})
            c = linha["classes"].setdefault(classe, {})
            campo = {"9784": "pct", "9785": "cv_pct", "162": "mil_domicilios", "5123": "cv_domicilios"}[r["D2C"]]
            c[campo] = _numero_sidra(r["V"])
    out = sorted(linhas.values(), key=lambda x: ({"brasil": 0, "regiao": 1, "uf": 2}[x["nivel"]], x["codigo"], x["ano"], x["situacao"]))
    for linha in out:
        for classe, c in linha["classes"].items():
            if classe != "total" and (c.get("pct") is None or c.get("mil_domicilios") is None):
                raise ValueError(f"Percentual ou contagem EBIA ausente em recorte publicado: {linha['territorio']} {linha['ano']} {classe}")
    return out


_INICIO = re.compile(r"^\s*(\d{7})\s+", re.M)
_VALORES = re.compile(r"(\d+)\s+(\d+)\s+(\d+)\s+([\d,]+)%\s+([\d,]+)%")


def ler_cadinsan(texto, municipios):
    """Anexo municipal do relatório CadINSAN 2025 (texto do pdftotext -layout).

    Colunas na ordem do anexo: risco absoluto com PBF, risco absoluto sem PBF, cadastros CadÚnico
    analisados, proporção com PBF, proporção sem PBF. Valores municipais como publicados.
    """
    inicios = list(_INICIO.finditer(texto))
    linhas = []
    for i, m in enumerate(inicios):
        fim = inicios[i + 1].start() if i + 1 < len(inicios) else len(texto)
        bloco = texto[m.end():fim]
        v = _VALORES.search(bloco)
        if not v:
            raise ValueError("Linha municipal não interpretada: " + m.group(1))
        codigo = m.group(1)
        if codigo not in municipios:
            raise ValueError("Código CadINSAN fora da relação oficial: " + codigo)
        com, sem, cad, pcom, psem = v.groups()
        linhas.append({"codigo": codigo, "com_pbf": int(com), "sem_pbf": int(sem), "cadastros": int(cad),
                       "pct_com_pbf": float(pcom.replace(",", ".")), "pct_sem_pbf": float(psem.replace(",", ".")),
                       "pagina_pdf": texto[:m.start()].count("\f") + 1})
    if len(linhas) != 5570 or len({r["codigo"] for r in linhas}) != 5570:
        raise ValueError("Cobertura municipal do anexo CadINSAN mudou")
    return sorted(linhas, key=lambda r: r["codigo"])


def ler_paa(raws_por_ano, municipios):
    """Fornecedores (IN002) e pagamentos (IN003) por município; campo ausente fica None."""
    por6 = {c[:6]: c for c in municipios}
    if len(por6) != len(municipios):
        raise ValueError("Código de seis dígitos ambíguo na relação oficial")
    out = {}
    for ano, raw in sorted(raws_por_ano.items()):
        payload = json.loads(raw)
        docs = payload["response"]["docs"]
        if len(docs) != payload["response"]["numFound"]:
            raise ValueError(f"Extrato PAA truncado: {ano}")
        linhas = {}
        for d in docs:
            if str(d.get("anomes_s")) != f"{ano}12":
                raise ValueError("Período PAA divergente")
            codigo = por6.get(str(d.get("codigo_ibge")))
            if codigo is None:
                raise ValueError("Município PAA não conciliado: " + str(d.get("codigo_ibge")))
            if codigo in linhas:
                raise ValueError("Município PAA duplicado: " + codigo)
            f = d.get("agricultores_fornec_paa_i")
            p = d.get("recur_pagos_agricul_paa_f")
            for nome, v in (("fornecedores", f), ("pagamentos", p)):
                if v is not None and (isinstance(v, bool) or not isinstance(v, (int, float)) or v < 0):
                    raise ValueError(f"Valor PAA inválido em {codigo}: {nome}")
            linhas[codigo] = [codigo, f if f is None else int(f), p if p is None else float(p)]
        out[str(ano)] = [linhas[c] for c in sorted(linhas)]
    return out


_PREFIXO_MUNICIPAL = ("PREF", "PM ", "MUNICIPIO")


def ler_pnae(raw_gz, municipios):
    """Agrega o arquivo FNDE por ano, UF e rede, e devolve a rede municipal de 2025 por município.

    Rede estadual/distrital: entidade cujo nome não começa por prefeitura ou município; a regra é
    conferida exigindo no máximo uma entidade desse tipo por ano e UF. Município: nome normalizado e
    UF iguais aos da relação oficial (correspondência exata, sem semelhança); o que não corresponde
    fica só nos totais de UF e Brasil e é listado.
    """
    texto = gzip.decompress(raw_gz).decode("utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(texto), delimiter=";"))
    esperado = ["Ano_Exercicio", "UF", "Municipio", "Entidade_Responsavel", "CNPJ_Responsavel", "Quantidade_Alunos", "Quantidade_Escolas", "Valor_Repasse"]
    if list(rows[0].keys()) != esperado:
        raise ValueError("Colunas do arquivo FNDE diferentes das revisadas")
    if len({(r["Ano_Exercicio"], r["CNPJ_Responsavel"]) for r in rows}) != len(rows):
        raise ValueError("Entidade repetida no mesmo exercício")
    ufs = {m["uf"] for m in municipios.values()}
    por_nome = {(m["uf"], normaliza_nome(m["nome"])): c for c, m in municipios.items()}
    estaduais = {}
    grupos = {}
    municipal_2025 = {}
    nao_conciliados = []
    ausentes = 0
    for r in rows:
        if r["UF"] not in ufs:
            raise ValueError("UF desconhecida no arquivo FNDE: " + r["UF"])
        ano = int(r["Ano_Exercicio"])
        alunos = int(r["Quantidade_Alunos"])
        escolas = int(r["Quantidade_Escolas"])
        repasse = None if r["Valor_Repasse"] in (None, "") else Decimal(r["Valor_Repasse"])
        if alunos < 0 or escolas < 0 or (repasse is not None and repasse < 0):
            raise ValueError("Valor negativo no arquivo FNDE")
        ausentes += repasse is None
        rede = "municipal" if r["Entidade_Responsavel"].startswith(_PREFIXO_MUNICIPAL) else "estadual"
        if rede == "estadual":
            estaduais[(ano, r["UF"])] = estaduais.get((ano, r["UF"]), 0) + 1
        for chave in ((ano, "BR", rede), (ano, r["UF"], rede), (ano, "BR", "todas"), (ano, r["UF"], "todas")):
            g = grupos.setdefault(chave, {"entidades": 0, "com_repasse": 0, "alunos": 0, "escolas": 0, "repasse": Decimal(0)})
            g["entidades"] += 1
            g["alunos"] += alunos
            g["escolas"] += escolas
            if repasse is not None:
                g["com_repasse"] += 1
                g["repasse"] += repasse
        if ano == 2025 and rede == "municipal":
            codigo = por_nome.get((r["UF"], normaliza_nome(r["Municipio"])))
            if codigo is None:
                nao_conciliados.append({"uf": r["UF"], "municipio": r["Municipio"], "cnpj": r["CNPJ_Responsavel"]})
            elif codigo in municipal_2025:
                raise ValueError("Dois registros municipais conciliados ao mesmo município: " + codigo)
            else:
                municipal_2025[codigo] = [codigo, alunos, escolas, None if repasse is None else float(repasse)]
    if any(v != 1 for v in estaduais.values()):
        raise ValueError("Mais de uma entidade estadual por ano e UF: rever a regra de rede")
    agregados = []
    for (ano, terr, rede), g in sorted(grupos.items()):
        agregados.append([ano, terr, rede, g["entidades"], g["com_repasse"], g["alunos"], g["escolas"],
                          float(g["repasse"]) if g["com_repasse"] else None])
    return {"registros": len(rows), "repasses_ausentes": ausentes, "agregados": agregados,
            "municipal_2025": [municipal_2025[c] for c in sorted(municipal_2025)],
            "nao_conciliados_2025": sorted(nao_conciliados, key=lambda x: (x["uf"], x["municipio"]))}


_CATEGORIAS_IPCA = {"7169": "geral", "7170": "alimentacao_bebidas", "7171": "alimentacao_domicilio", "7432": "alimentacao_fora"}
_VARIAVEIS_IPCA = {"63": "mensal", "2265": "doze_meses"}


def ler_ipca(raw):
    out = []
    for variavel in json.loads(raw):
        for res in variavel["resultados"]:
            cat = next(iter(res["classificacoes"][0]["categoria"]))
            for periodo, v in res["series"][0]["serie"].items():
                out.append([_VARIAVEIS_IPCA[variavel["id"]], _CATEGORIAS_IPCA[cat], periodo, _numero_sidra(v)])
    return sorted(out, key=lambda x: (x[0], x[1], x[2]))


_FASES = ["Crianças menores de 5 anos", "Crianças entre 5 e 9 anos", "Adolescentes", "Adultos", "Idosos"]


def ler_sisvan(texto_pagina):
    """Tabela 10 do Relatório de Gestão Integrado 2025 (página 57 do PDF, impressa 56)."""
    if "Tabela 10" not in texto_pagina or "gestantes não estão contabilizadas" not in texto_pagina:
        raise ValueError("Página da tabela 10 não encontrada")
    out = []
    for fase in _FASES:
        m = re.search(re.escape(fase) + r"\s+([\d.]+)\s+([\d,]+)%", texto_pagina)
        if not m:
            raise ValueError("Fase da vida ausente na tabela 10: " + fase)
        out.append([fase, int(m.group(1).replace(".", "")), float(m.group(2).replace(",", "."))])
    return out


# ---------------------------------------------------------------- captura a partir dos originais

def _baixa(url, destino):
    with urllib.request.urlopen(url, timeout=180) as r:
        destino.write_bytes(r.read())


def confere_originais(pasta, coletar=False):
    """Devolve {id: bytes} depois de conferir cada hash; edição diferente reprova."""
    out = {}
    for f in FONTES:
        p = Path(pasta) / f["arquivo"]
        # sem rede por padrão: só baixa com --coletar; original ausente é reportado, nunca buscado em silêncio
        if coletar:
            _baixa(f["url"], p)
        elif not p.exists():
            raise FileNotFoundError(f"Original ausente: {p} ({f['id']}). Use --coletar para baixar de {f['url']}")
        raw = p.read_bytes()
        if "conteudo" in f:
            if hash_conteudo_paa(raw) != f["conteudo"]:
                raise ValueError(f"Edição diferente da revisada: {f['id']}")
        elif sha256(raw) != f["sha256"]:
            raise ValueError(f"Edição diferente da revisada: {f['id']}")
        out[f["id"]] = raw
    return out


def _pdftotext(raw, *args):
    with tempfile.TemporaryDirectory() as d:
        pdf = Path(d) / "fonte.pdf"
        pdf.write_bytes(raw)
        return subprocess.run(["pdftotext", *args, str(pdf), "-"], check=True, capture_output=True).stdout.decode()


def extrai(originais):
    municipios = ler_municipios(originais["ibge-municipios"])
    cad_texto = _pdftotext(originais["mds-cadinsan-2025"], "-layout")
    sisvan_texto = _pdftotext(originais["ms-rgi-2025"], "-layout", "-f", "57", "-l", "57")
    return {
        "versao": VERSAO,
        "municipios": [[c, m["nome"], m["uf"]] for c, m in sorted(municipios.items())],
        "ufs": sorted({(m["uf"], m["uf_id"], m["uf_nome"], m["regiao"]) for m in municipios.values()}),
        "ebia": ler_ebia(originais["sidra-9552-percentual"], originais["sidra-9552-domicilios"]),
        "cadinsan": [[r["codigo"], r["com_pbf"], r["sem_pbf"], r["cadastros"], r["pct_com_pbf"], r["pct_sem_pbf"], r["pagina_pdf"]]
                     for r in ler_cadinsan(cad_texto, municipios)],
        "paa": ler_paa({a: originais[f"mds-paa-{a}"] for a in (2023, 2024, 2025)}, municipios),
        "pnae": ler_pnae(originais["fnde-pnae"], municipios),
        "ipca": ler_ipca(originais["ibge-ipca-7060"]),
        "sisvan": ler_sisvan(sisvan_texto),
    }


# ---------------------------------------------------------------- portão e gold

def le_seed():
    manifesto = json.loads(MANIFESTO.read_text())
    raw = SEED.read_bytes()
    if sha256(raw) != manifesto["seed_sha256"]:
        raise ValueError("Integridade do seed complementar reprovada")
    return json.loads(gzip.decompress(raw)), manifesto


def valida(rec):
    municipios = {m[0]: m for m in rec["municipios"]}
    if len(municipios) != len(rec["municipios"]) or len(municipios) < 5570:
        raise ValueError("Relação de municípios inválida")
    ufs = {u[0] for u in rec["ufs"]}
    if len(ufs) != 27:
        raise ValueError("Relação de UFs inválida")
    # EBIA: Brasil, 5 regiões e 27 UFs, 2023 e 2024; UF só na situação total
    chaves = {(e["nivel"], e["codigo"], e["ano"], e["situacao"]) for e in rec["ebia"]}
    if len(chaves) != len(rec["ebia"]) or len(rec["ebia"]) != 2 * (3 + 5 * 3 + 27):
        raise ValueError("Cobertura EBIA inválida")
    for e in rec["ebia"]:
        c = e["classes"]
        valores = [c[k]["pct"] for k in ("segura", "insegura", "leve", "moderada", "grave")]
        if any(v is None or not 0 <= v <= 100 for v in valores):
            raise ValueError("Percentual EBIA inválido")
        if abs(c["segura"]["pct"] + c["insegura"]["pct"] - 100) > 0.11 or abs(sum(valores[2:]) - c["insegura"]["pct"]) > 0.16:
            raise ValueError("Percentuais EBIA não fecham dentro do arredondamento")
    # CadINSAN: 5.570 municípios do anexo, todos na relação oficial
    cad = rec["cadinsan"]
    if len(cad) != 5570 or len({r[0] for r in cad}) != 5570 or any(r[0] not in municipios for r in cad):
        raise ValueError("Cobertura CadINSAN inválida")
    for r in cad:
        if min(r[1:4]) < 0 or r[1] > r[3] or r[2] > r[3] or not (0 <= r[4] <= 100 and 0 <= r[5] <= 100):
            raise ValueError("Valor CadINSAN inválido: " + r[0])
    # PAA: três anos; cada município uma vez; ausente continua None
    if sorted(rec["paa"]) != ["2023", "2024", "2025"]:
        raise ValueError("Anos PAA inválidos")
    for ano, linhas in rec["paa"].items():
        if len({r[0] for r in linhas}) != len(linhas) or any(r[0] not in municipios for r in linhas):
            raise ValueError("Municípios PAA inválidos: " + ano)
        if not any(r[1] is None for r in linhas) or not any(r[1] is not None for r in linhas):
            raise ValueError("Extrato PAA sem ausências ou sem valores: conferir a extração")
    # PNAE
    pnae = rec["pnae"]
    anos = sorted({a[0] for a in pnae["agregados"]})
    if anos != list(range(2009, 2027)):
        raise ValueError("Anos PNAE inválidos")
    if len({tuple(a[:3]) for a in pnae["agregados"]}) != len(pnae["agregados"]):
        raise ValueError("Agregado PNAE duplicado")
    for a in pnae["agregados"]:
        if a[1] != "BR" and a[1] not in ufs:
            raise ValueError("Território PNAE inválido")
        if a[4] > a[3] or (a[4] == 0) != (a[7] is None):
            raise ValueError("Cobertura de repasse PNAE inconsistente")
    por_chave = {tuple(a[:3]): a for a in pnae["agregados"]}
    for (ano, terr, rede), a in por_chave.items():
        if rede != "todas":
            continue
        partes = [por_chave[k] for k in ((ano, terr, "municipal"), (ano, terr, "estadual")) if k in por_chave]
        if [sum(p[i] for p in partes) for i in (3, 4, 5, 6)] != a[3:7]:
            raise ValueError("Total das redes PNAE não fecha com as redes")
    if len({r[0] for r in pnae["municipal_2025"]}) != len(pnae["municipal_2025"]):
        raise ValueError("Município PNAE duplicado")
    # IPCA e SISVAN
    if len(rec["ipca"]) != 2 * 4 * 45 or len({tuple(x[:3]) for x in rec["ipca"]}) != len(rec["ipca"]):
        raise ValueError("Série IPCA inválida")
    if [s[0] for s in rec["sisvan"]] != _FASES or any(not 0 <= s[2] <= 100 for s in rec["sisvan"]):
        raise ValueError("Tabela SISVAN inválida")
    return municipios


def _soma_cadinsan(linhas):
    com = sum(r[1] for r in linhas)
    sem = sum(r[2] for r in linhas)
    cad = sum(r[3] for r in linhas)
    return {"municipios": len(linhas), "com_pbf": com, "sem_pbf": sem, "cadastros": cad,
            "pct_com_pbf": round(100 * com / cad, 1), "pct_sem_pbf": round(100 * sem / cad, 1)}


def _soma_paa(linhas):
    out = {"municipios_universo": len(linhas)}
    for i, campo in ((1, "fornecedores"), (2, "pagamentos")):
        conhecidos = [r[i] for r in linhas if r[i] is not None]
        if campo == "pagamentos":
            total = float(sum((Decimal(str(v)) for v in conhecidos), Decimal(0))) if conhecidos else None
        else:
            total = sum(conhecidos) if conhecidos else None
        out[campo] = {"soma": total, "municipios_com_dado": len(conhecidos)}
    return out


def agrega(rec, manifesto, catalogo, social=None):
    """`social`: (registro, manifesto) dos recortes sociais da EBIA; sem ele, lê o seed versionado de ebia_social."""
    municipios = valida(rec)
    rec_social, man_social = social if social is not None else ebia_social.le_seed()
    uf_de = {c: m[2] for c, m in municipios.items()}
    ufs = [{"sigla": u[0], "codigo": u[1], "nome": u[2], "regiao": u[3]} for u in rec["ufs"]]
    cad = {"brasil": _soma_cadinsan(rec["cadinsan"]),
           "ufs": {u["sigla"]: _soma_cadinsan([r for r in rec["cadinsan"] if uf_de[r[0]] == u["sigla"]]) for u in ufs},
           "divergencias_cenario": sum(1 for r in rec["cadinsan"] if r[2] < r[1])}
    paa = {ano: {"brasil": _soma_paa(linhas), "ufs": {u["sigla"]: _soma_paa([r for r in linhas if uf_de[r[0]] == u["sigla"]]) for u in ufs}}
           for ano, linhas in rec["paa"].items()}
    pnae = {"registros": rec["pnae"]["registros"], "repasses_ausentes": rec["pnae"]["repasses_ausentes"],
            "nao_conciliados_2025": rec["pnae"]["nao_conciliados_2025"],
            "municipios_conciliados_2025": len(rec["pnae"]["municipal_2025"]),
            "linhas": [dict(zip(["ano", "territorio", "rede", "entidades", "entidades_com_repasse", "alunos", "escolas", "repasse"], a))
                       for a in rec["pnae"]["agregados"]]}
    ipca = [dict(zip(["medida", "categoria", "periodo", "valor"], x)) for x in rec["ipca"]]
    sisvan = [dict(zip(["fase", "avaliados", "cobertura"], s)) for s in rec["sisvan"]]
    return {"versao": rec["versao"], "manifesto": manifesto, "fichas": catalogo["indicadores"], "nao_integrados": catalogo["nao_integrados"],
            "ufs": ufs, "ebia": rec["ebia"], "ebia_social": ebia_social.agrega(rec_social, man_social, rec["ebia"]), "cadinsan": cad, "paa": paa, "pnae": pnae, "ipca": ipca, "sisvan": sisvan}


CAMPOS_FICHA = ("id", "nome", "grupo", "capitulo", "fonte_id", "definicao", "universo", "periodo", "unidade", "territorio",
                "frequencia", "formula", "estado_do_dado", "ausencias", "limitacoes")


def le_catalogo():
    return valida_catalogo(json.loads((BASE / "catalogo-complementos.json").read_text()))


def valida_catalogo(cat):
    ids_fonte = {f["id"] for f in FONTES} | {f["id"] for f in ebia_social.FONTES}
    for ficha in cat["indicadores"]:
        if any(not ficha.get(k) for k in CAMPOS_FICHA):
            raise ValueError("Ficha complementar incompleta: " + ficha.get("id", "?"))
        if ficha["fonte_id"] not in ids_fonte or any(f not in ids_fonte for f in ficha.get("fontes_adicionais", [])):
            raise ValueError("Ficha sem fonte registrada: " + ficha["id"])
    for item in cat["nao_integrados"]:
        if not item.get("base") or not item.get("motivo"):
            raise ValueError("Item não integrado sem motivo")
    return cat


def promove(rec, manifesto, catalogo, destino=None, social=None):
    gold = agrega(rec, manifesto, valida_catalogo(catalogo), social)  # portão antes de qualquer escrita
    alvo = Path(destino) if destino else GOLD
    alvo.parent.mkdir(parents=True, exist_ok=True)
    corpo = json.dumps(gold, ensure_ascii=False, separators=(",", ":")).encode()
    with tempfile.NamedTemporaryFile(dir=alvo.parent, delete=False) as tmp:
        tmp.write(corpo)
    os.chmod(tmp.name, 0o644)
    os.replace(tmp.name, alvo)
    return gold


def grava_seed(rec):
    corpo = gzip.compress(json.dumps(rec, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode(), mtime=0)
    SEED.write_bytes(corpo)
    manifesto = {
        "versao": VERSAO, "capturado_em": CAPTURA,
        "origem": "Originais baixados de novo das fontes oficiais em 21/10/2026 e conferidos com a captura do PR #131 (10/10/2026); recorte reextraído por este módulo.",
        "seed_arquivo": SEED.name, "seed_sha256": sha256(corpo),
        "fontes": [{k: v for k, v in f.items() if k != "arquivo"} for f in FONTES],
    }
    MANIFESTO.write_text(json.dumps(manifesto, ensure_ascii=False, indent=2) + "\n")
    return manifesto


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--originais", type=Path)
    p.add_argument("--coletar", action="store_true")
    p.add_argument("--gravar-seed", action="store_true")
    a = p.parse_args()
    if a.originais:
        rec = extrai(confere_originais(a.originais, a.coletar))
        valida(rec)
        if a.gravar_seed:
            grava_seed(rec)
            print("Seed complementar gravado; revisar o manifesto antes de publicar.")
        else:
            antigo, _ = le_seed()
            if json.loads(json.dumps(rec)) != antigo:
                raise ValueError("Reextração diverge do seed revisado")
            print("Reextração dos originais confere com o seed revisado.")
        return
    rec, manifesto = le_seed()
    gold = promove(rec, manifesto, le_catalogo())
    print(f"Segurança alimentar, bases complementares: {len(gold['ebia'])} recortes EBIA, "
          f"{len(gold['ebia_social']['recortes'])} recortes sociais EBIA (tabelas {', '.join(r['tabela'] for r in gold['ebia_social']['recortes'])}), "
          f"{gold['cadinsan']['brasil']['municipios']} municípios CadINSAN, PAA {sorted(gold['paa'])}, "
          f"{len(gold['pnae']['linhas'])} agregados PNAE; portão aprovado.")


if __name__ == "__main__":
    main()
