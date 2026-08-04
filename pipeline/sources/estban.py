"""ESTBAN — Estatística Bancária Mensal por município (BCB, documento 4500).

Fonte: https://www.bcb.gov.br/estatisticas/estatisticabancariamunicipios
Lista de arquivos: API do próprio site (a página exibe 6 meses, a API expõe 453).

Decisões e evidências: docs/AUDITORIA_PENETRACAO.md. O que precisa estar na cabeça
de quem mexer aqui:

1. **CODMUN não é o código do IBGE.** O ESTBAN usa código próprio do BCB — São Paulo
   é 7388, não 3550308. A conciliação é feita por (UF, nome normalizado) contra a
   lista oficial de municípios do IBGE, e a taxa de casamento é registrada: município
   que não casa fica de fora e é contado, nunca "encaixado" no vizinho.

2. **Ausência não é zero.** O arquivo tem ~2.935 municípios; o Brasil tem 5.570. Quem
   não aparece não tem dependência bancária reportando saldo — o que é diferente de
   ter crédito zero. Municípios ausentes ficam com saldo `None`, jamais 0.

3. **O saldo é contábil, do município da dependência.** VERBETE_160 é o saldo de
   operações de crédito contabilizado nas agências daquele município, não o crédito
   dos moradores dele. Centro regional concentra; banco digital centraliza. Esta é a
   limitação estrutural do painel inteiro e viaja com o dado até a tela.
"""
import io
import json
import re
import unicodedata
import zipfile

from pipeline import common

API_LISTA = ("https://www.bcb.gov.br/api/servico/sitebcb/Documentos/byListGuid"
             "?tronco=estatisticas&guidLista=f6391806-fd85-43af-acf1-c86d5b8dd6df"
             "&ordem=DataDocumento%20desc&pasta=municipio")
BASE = "https://www.bcb.gov.br"
MUNICIPIOS_IBGE = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"

# Verbete 160: saldo de operações de crédito. É o numerador de todo o painel.
COL_CREDITO = "VERBETE_160_OPERACOES_DE_CREDITO"
COL_DEPOSITOS = "VERBETE_400_DEPOSITOS"


# Grafias que o ESTBAN mantém e o IBGE já mudou, mais um caso de sinal trocado.
# Lista explícita e auditável: nome que não casa e não está aqui fica de fora,
# nunca é aproximado por semelhança.
ALIAS = {
    ("CE", "ITAPAGE"): "ITAPAJE",
    ("MA", "PINDARE MIRIM"): "PINDARE MIRIM",
    ("MG", "BRASOPOLIS"): "BRAZOPOLIS",
    ("PA", "ELDORADO DOS CARAJAS"): "ELDORADO DO CARAJAS",
    ("PE", "BELEM DE SAO FRANCISCO"): "BELEM DO SAO FRANCISCO",
    ("PE", "LAGOA DO ITAENGA"): "LAGOA DE ITAENGA",
    ("RJ", "PARATI"): "PARATY",
    ("RJ", "TRAJANO DE MORAIS"): "TRAJANO DE MORAES",
    ("RN", "ACU"): "ASSU",
    ("RS", "ENTRE IJUIS"): "ENTRE IJUIS",
    ("SC", "SAO MIGUEL D OESTE"): "SAO MIGUEL DO OESTE",
    ("SP", "SAO LUIS DO PARAITINGA"): "SAO LUIZ DO PARAITINGA",
    ("MT", "SANTO ANTONIO DO LEVERGER"): "SANTO ANTONIO DE LEVERGER",
    ("PA", "SANTA ISABEL DO PARA"): "SANTA IZABEL DO PARA",
    ("PR", "SANTA CRUZ DO MONTE CASTELO"): "SANTA CRUZ DE MONTE CASTELO",
    ("RS", "SANTANA DO LIVRAMENTO"): "SANT ANA DO LIVRAMENTO",
}


def _norm(s):
    """Nome de município comparável: sem acento, pontuação vira espaço, caixa alta.
    Hífen precisa virar espaço — 'MOGI-GUACU' e 'Mogi Guaçu' são o mesmo município,
    e removê-lo colaria as palavras."""
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode()
    s = re.sub(r"[^A-Z0-9]+", " ", s.upper())
    return re.sub(r"\s+", " ", s).strip()


def _chave_municipio(uf, bruto):
    """Resolve o nome do ESTBAN para o nome normalizado do IBGE.
    O ESTBAN reparte o Distrito Federal em regiões administrativas — 'BRASILIA
    (CEILANDIA)' e outras 19 —, mas o IBGE tem um único município. Somar as RAs em
    Brasília é obrigatório: descartá-las perderia parte do saldo da capital."""
    nome = _norm(bruto)
    if uf == "DF" and nome.startswith("BRASILIA"):
        return "BRASILIA"
    return ALIAS.get((uf, nome), nome)


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS estban_mun(
        data_base TEXT, cod_ibge TEXT, uf TEXT, credito REAL, depositos REAL,
        instituicoes INTEGER, agencias INTEGER,
        PRIMARY KEY(data_base, cod_ibge));
    CREATE TABLE IF NOT EXISTS estban_mun_inst(
        data_base TEXT, cod_ibge TEXT, cnpj TEXT, instituicao TEXT, credito REAL,
        PRIMARY KEY(data_base, cod_ibge, cnpj));
    CREATE TABLE IF NOT EXISTS estban_coleta(
        data_base TEXT PRIMARY KEY, coletado_em TEXT, bronze_sha TEXT,
        linhas INTEGER, municipios INTEGER, casados INTEGER, sem_casar TEXT);
    CREATE TABLE IF NOT EXISTS ibge_municipios(
        cod_ibge TEXT PRIMARY KEY, nome TEXT, nome_norm TEXT, uf TEXT, regiao TEXT);
    """)


def _carrega_municipios(con, timeout=120):
    """Lista oficial do IBGE: código de 7 dígitos, nome, UF e região."""
    if con.execute("SELECT COUNT(*) FROM ibge_municipios").fetchone()[0] >= 5500:
        return 0
    # http_get trata gzip: o endpoint de localidades responde comprimido
    body, _ = common.http_get(MUNICIPIOS_IBGE, timeout=timeout)
    muns = json.loads(body.decode("utf-8"))
    n = 0
    for m in muns:
        uf = m["microrregiao"]["mesorregiao"]["UF"] if m.get("microrregiao") else \
             m["regiao-imediata"]["regiao-intermediaria"]["UF"]
        con.execute("INSERT OR REPLACE INTO ibge_municipios VALUES(?,?,?,?,?)",
                    (str(m["id"]), m["nome"], _norm(m["nome"]), uf["sigla"], uf["regiao"]["sigla"]))
        n += 1
    con.commit()
    return n


def datas_disponiveis(timeout=90):
    """A página do BCB mostra 6 meses; a API lista o histórico inteiro."""
    body, _ = common.http_get(API_LISTA, timeout=timeout)
    d = json.loads(body.decode("utf-8"))
    out = []
    for item in d.get("conteudo", []):
        url = item.get("Url") or ""
        m = re.search(r"/(\d{6})_ESTBAN\.csv\.zip$", url)
        if m:
            out.append((f"{m.group(1)[:4]}-{m.group(1)[4:]}", BASE + url))
    return sorted(out, reverse=True)


def _absorve(con, data_base, url, chave_ibge):
    body, meta = common.http_get(url, timeout=300)
    caminho, sha = common.save_bronze("estban", f"{data_base.replace('-', '')}_ESTBAN.zip", body, meta)
    z = zipfile.ZipFile(io.BytesIO(body))
    txt = z.read(z.namelist()[0]).decode("latin1", "replace")
    linhas = txt.split("\n")
    # as duas primeiras linhas são preâmbulo; o cabeçalho vem na terceira com '#'
    cab = linhas[2].strip().lstrip("#").split(";")
    col = {c.strip(): i for i, c in enumerate(cab)}
    for obrig in ("UF", "CODMUN", "MUNICIPIO", "CNPJ", "NOME_INSTITUICAO", COL_CREDITO):
        if obrig not in col:
            raise RuntimeError(f"coluna {obrig} ausente — esquema do ESTBAN mudou")

    num = lambda v: float(v) if str(v).strip().lstrip("-").replace(".", "").isdigit() else 0.0
    agreg, por_inst, sem_casar, n = {}, {}, set(), 0
    for l in linhas[3:]:
        p = l.rstrip("\r").split(";")
        if len(p) < len(cab):
            continue
        uf = p[col["UF"]].strip().upper()
        nome = _chave_municipio(uf, p[col["MUNICIPIO"]])
        cod = chave_ibge.get((uf, nome))
        if not cod:
            sem_casar.add(f"{uf}/{p[col['MUNICIPIO']].strip()}")
            continue
        cred = num(p[col[COL_CREDITO]])
        dep = num(p[col[COL_DEPOSITOS]]) if COL_DEPOSITOS in col else 0.0
        a = agreg.setdefault(cod, {"uf": uf, "credito": 0.0, "depositos": 0.0, "inst": set(), "ag": 0})
        a["credito"] += cred
        a["depositos"] += dep
        a["inst"].add(p[col["CNPJ"]].strip())
        a["ag"] += int(num(p[col.get("AGEN_PROCESSADAS", 0)])) if "AGEN_PROCESSADAS" in col else 0
        k = (cod, p[col["CNPJ"]].strip())
        pi = por_inst.setdefault(k, {"nome": p[col["NOME_INSTITUICAO"]].strip(), "credito": 0.0})
        pi["credito"] += cred
        n += 1

    for cod, a in agreg.items():
        con.execute("INSERT OR REPLACE INTO estban_mun VALUES(?,?,?,?,?,?,?)",
                    (data_base, cod, a["uf"], round(a["credito"], 2), round(a["depositos"], 2),
                     len(a["inst"]), a["ag"]))
    for (cod, cnpj), v in por_inst.items():
        con.execute("INSERT OR REPLACE INTO estban_mun_inst VALUES(?,?,?,?,?)",
                    (data_base, cod, cnpj, v["nome"], round(v["credito"], 2)))
    con.execute("INSERT OR REPLACE INTO estban_coleta VALUES(?,?,?,?,?,?,?)",
                (data_base, common.now_utc(), sha, n, len(agreg), len(agreg),
                 json.dumps(sorted(sem_casar)[:40], ensure_ascii=False)))
    common.record_lineage(con, "penetracao.json", caminho, sha,
                          "ESTBAN municipal -> estban_mun (verbete 160 somado por município, chave IBGE por UF+nome)")
    con.commit()
    return {"linhas": n, "municipios": len(agreg), "sem_casar": len(sem_casar)}


def collect(con, cfg=None, meses=13):
    """Absorve as `meses` data-bases mais recentes ainda não coletadas.
    Idempotente por data-base: o arquivo de um mês fechado não muda."""
    _ensure(con)
    try:
        novos = _carrega_municipios(con)
        chave = {(r[0], r[1]): r[2] for r in
                 con.execute("SELECT uf, nome_norm, cod_ibge FROM ibge_municipios")}
        disponiveis = datas_disponiveis()
    except Exception as e:
        return [{"key": "estban", "ok": False, "error": str(e)[:200]}]
    if not disponiveis:
        return [{"key": "estban", "ok": False, "error": "lista de arquivos vazia"}]

    ja = {r[0] for r in con.execute("SELECT data_base FROM estban_coleta")}
    results = []
    if novos:
        results.append({"key": "estban:municipios_ibge", "ok": True, "municipios": novos})
    for data_base, url in disponiveis[:meses]:
        if data_base in ja:
            continue
        try:
            r = _absorve(con, data_base, url, chave)
            results.append({"key": f"estban:{data_base}", "ok": True, **r})
        except Exception as e:
            results.append({"key": f"estban:{data_base}", "ok": False, "error": str(e)[:200]})
    return results or [{"key": "estban", "ok": True, "note": "todas as data-bases já absorvidas"}]
