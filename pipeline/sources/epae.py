"""EPAE — Estatísticas de Pagamentos por Atividade Econômica (BCB).

Fonte estruturada e oficial: planilha única publicada pelo BC na página de
Tabelas especiais (assunto "Moeda e Crédito"), divulgada mensalmente desde
outubro de 2025, com séries iniciadas em novembro de 2020.

O arquivo é um formato longo: instrumento (Pix), mês, setor pagador, setor
recebedor, valor em R$ e número de transações. Os setores são as 21 seções da
CNAE mais "Pessoa Física" e "Outros" — até 529 fluxos mensais.

Por que este coletor existe: o box de bets do 3º Update do Boletim Fiscal
(Comsefaz/Cicef) é construído sobre estes dados. Republicar a série OBSERVADA
permite ao leitor separar o que o BC mede do que o estudo atribui por modelo.

Limite conceitual que viaja com o dado até a tela: a menor abertura pública é a
SEÇÃO da CNAE. A seção "Artes, cultura, esporte e recreação" agrega academias,
clubes, casas de espetáculo, cinemas, parques e apostas — ela NÃO isola bets, e
tampouco separa operador autorizado de operador ilegal.

Sem dependências além da biblioteca padrão: o .xlsx é lido com zipfile +
ElementTree (o formato é um zip de XML), como já se faz com os zips da CVM.
"""
import xml.etree.ElementTree as ET
import zipfile
import io
import json

from pipeline import common

URL = "https://www.bcb.gov.br/content/estatisticas/Documents/Tabelas_especiais/EPAE.xlsx"
PAGINA = "https://www.bcb.gov.br/estatisticas/tabelasespeciais"

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

# Rótulos exatos da planilha (bilíngues). Se o BC mudar a grafia, o coletor
# falha alto em vez de publicar série vazia — mesmo padrão do ESTBAN.
SETOR_PF = "Pessoa Fisica / Household"
SETOR_ARTES = "Artes, cultura, esporte e recreacao / Arts, entertainment and recreation"
INSTRUMENTO = "Pix"


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS epae_fluxo(
        data TEXT, pagador TEXT, recebedor TEXT, valor REAL, transacoes INTEGER,
        PRIMARY KEY(data, pagador, recebedor));
    CREATE TABLE IF NOT EXISTS epae_coleta(
        chave TEXT PRIMARY KEY, coletado_em TEXT, sha TEXT, detalhe TEXT);
    """)


def _shared_strings(zf):
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    return ["".join(t.text or "" for t in si.iter(f"{NS}t")) for si in root]


def _sheet_path(zf):
    """Localiza a aba de dados pelo nome declarado no workbook (a segunda aba é
    metodologia). Não confiar na ordem dos arquivos dentro do zip."""
    wb = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    RNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
    alvo = None
    for sheet in wb.iter(f"{NS}sheet"):
        if (sheet.get("name") or "").strip().upper() == "EPAE":
            alvo = sheet.get(f"{RNS}id")
    if not alvo:
        raise RuntimeError("aba 'EPAE' ausente na planilha — esquema do BCB mudou")
    for rel in rels:
        if rel.get("Id") == alvo:
            destino = rel.get("Target").lstrip("/")
            return destino if destino.startswith("xl/") else f"xl/{destino}"
    raise RuntimeError("relacionamento da aba EPAE não encontrado")


def _linhas(zf, ss):
    """Percorre a aba em modo streaming (a planilha tem dezenas de milhares de
    linhas) devolvendo dicionários por letra de coluna."""
    with zf.open(_sheet_path(zf)) as fh:
        for _, row in ET.iterparse(fh, events=("end",)):
            if row.tag != f"{NS}row":
                continue
            cells = {}
            for c in row.iter(f"{NS}c"):
                ref = c.get("r") or ""
                col = "".join(ch for ch in ref if ch.isalpha())
                v = c.find(f"{NS}v")
                val = v.text if v is not None else None
                if c.get("t") == "s" and val is not None:
                    val = ss[int(val)]
                cells[col] = val
            row.clear()
            yield cells


def _absorve(con, body):
    zf = zipfile.ZipFile(io.BytesIO(body))
    ss = _shared_strings(zf)
    for rotulo in (SETOR_PF, SETOR_ARTES):
        if rotulo not in ss:
            raise RuntimeError(f"setor '{rotulo}' ausente na planilha — rótulos do BCB mudaram")
    n = 0
    meses = set()
    setores = set()
    for cells in _linhas(zf, ss):
        if (cells.get("A") or "").strip() != INSTRUMENTO:
            continue  # cabeçalho e eventuais instrumentos futuros
        data, pagador, recebedor = cells.get("B"), cells.get("C"), cells.get("D")
        if not (data and pagador and recebedor):
            continue
        data = str(data).strip()
        if len(data) != 6 or not data.isdigit():
            raise RuntimeError(f"data fora do formato AAAAMM na EPAE: {data!r}")
        ref = f"{data[:4]}-{data[4:]}"
        con.execute("INSERT OR REPLACE INTO epae_fluxo VALUES(?,?,?,?,?)",
                    (ref, pagador, recebedor, float(cells.get("E") or 0),
                     int(float(cells.get("F") or 0))))
        meses.add(ref)
        setores.add(recebedor)
        n += 1
    if not n:
        raise RuntimeError("nenhuma linha Pix lida da EPAE — esquema mudou")
    return {"linhas": n, "meses": len(meses), "setores": len(setores),
            "inicio": min(meses), "fim": max(meses)}


def collect(con, cfg=None):
    _ensure(con)
    try:
        body, meta = common.http_get(URL, timeout=180, accept=None)
    except Exception as e:
        return [{"key": "epae", "ok": False, "error": str(e)[:200]}]
    _, sha = common.save_bronze("epae", "epae_tabela_especial", body, meta)
    anterior = con.execute("SELECT sha FROM epae_coleta WHERE chave='epae'").fetchone()
    if anterior and anterior[0] == sha:
        # planilha inalterada: o BC republica o arquivo inteiro a cada mês
        return [{"key": "epae", "ok": True, "inalterado": True, "sha": sha}]
    try:
        r = _absorve(con, body)
    except Exception as e:
        return [{"key": "epae", "ok": False, "error": str(e)[:200]}]
    con.execute("INSERT OR REPLACE INTO epae_coleta VALUES(?,?,?,?)",
                ("epae", common.now_utc(), sha, json.dumps(r, ensure_ascii=False)))
    common.record_lineage(con, "epae.json", "epae_tabela_especial.xlsx", sha,
                          "EPAE (Pix, seções CNAE) -> epae_fluxo (formato longo, valor e nº de transações)")
    con.commit()
    return [{"key": "epae", "ok": True, **r}]
