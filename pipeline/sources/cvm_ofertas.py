"""Conector CVM — ofertas públicas de distribuição (Res. CVM 160 e regime anterior).

Fonte: dados.cvm.gov.br/dados/OFERTA/DISTRIB/DADOS/oferta_distribuicao.zip (~5,6 MB), com
dois CSV que NÃO se sobrepõem:
- oferta_distribuicao.csv: regime anterior (ICVM 400, 476 e 555) de 2008 a 2022, mais
  os ritos ordinários da Res. 160 (que a CVM mantém neste arquivo);
- oferta_resolucao_160.csv: rito automático da Res. 160, de 2023 em diante.

O que vira silver: UMA linha por oferta (id estável por regime + número), com o mês
de referência, a família do ativo, emissor, coordenador líder, valor e marcadores
(público-alvo, incentivo fiscal, rótulo sustentável, status). O valor da Res. 160 é
o REGISTRADO, não o colocado — o portal não publica a colocação por oferta; a aba
declara isso. O mês é o do registro (ou do início, quando o registro não existe:
ofertas dispensadas do regime antigo).

Idempotente por hash do zip: se o conteúdo não mudou, nada é regravado.
"""
import csv
import io
import zipfile

csv.field_size_limit(10_000_000)

from pipeline import common

URL = "https://dados.cvm.gov.br/dados/OFERTA/DISTRIB/DADOS/oferta_distribuicao.zip"

# Família do ativo pelo nome que a CVM usa em cada regime. O que não está aqui vira "Outros".
FAMILIAS = [
    ("Debêntures", ("DEBÊNTURE", "DEBENTURE")),
    ("Notas comerciais e promissórias", ("NOTAS COMERCIAIS", "NOTA COMERCIAL", "NOTAS PROMISSÓRIAS", "NOTA PROMISSÓRIA")),
    ("CRI", ("RECEBÍVEIS IMOBILIÁRIOS", "RECEBIVEIS IMOBILIARIOS")),
    ("CRA", ("RECEBÍVEIS DO AGRONEGÓCIO", "RECEBIVEIS DO AGRONEGOCIO", "CDCA", "DIREITOS CREDITÓRIOS DO AGRONEGÓCIO")),
    ("Cotas de FIDC", ("FIDC", "DIREITOS CREDIT")),
    ("Cotas de FII e FIAGRO", ("FII", "FUNDO IMOBILIÁRIO", "FIAGRO")),
    ("Cotas de FIP", ("FIP", "PARTICIPAÇÕES", "PARTICIPACOES")),
    ("Ações", ("AÇÕES", "AÇÔES", "ACOES", "BDR", "DEPÓSITO DE AÇÕES", "BÔNUS DE SUBSCRIÇÃO", "UNIT")),
    ("Letras financeiras", ("LETRAS FINANCEIRAS",)),
    ("Outros títulos de securitização", ("CERTIFICADOS DE RECEBÍVEIS", "TÍTULOS DE SECURITIZAÇÃO", "CÉDULA DE PRODUTO RURAL")),
    ("Cotas de outros fundos", ("COTAS DE FUNDOS", "QUOTAS DE FUNDO", "COTAS DE FIF", "FUNCINE", "FUNDOS DE INFRA", "QUOTAS DE OUTROS")),
]
DIVIDA_CORPORATIVA = ("Debêntures", "Notas comerciais e promissórias")
SECURITIZACAO = ("CRI", "CRA", "Cotas de FIDC", "Outros títulos de securitização")


def familia_de(nome):
    n = (nome or "").upper()
    for fam, chaves in FAMILIAS:
        if any(k in n for k in chaves):
            return fam
    return "Outros"


def _ensure(con):
    con.execute("""CREATE TABLE IF NOT EXISTS cvm_ofertas(
        id TEXT PRIMARY KEY, regime TEXT, mes TEXT, familia TEXT, ativo TEXT,
        cnpj_emissor TEXT, emissor TEXT, cnpj_lider TEXT, lider TEXT, valor REAL,
        tipo_oferta TEXT, rito TEXT, publico TEXT, status TEXT, incentivada INTEGER,
        sustentavel INTEGER, tipo_societario TEXT, lastro TEXT, regime_distribuicao TEXT)""")
    con.execute("CREATE INDEX IF NOT EXISTS ix_cvm_ofertas_mes ON cvm_ofertas(mes)")
    con.execute("""CREATE TABLE IF NOT EXISTS cvm_ofertas_coleta(
        sha TEXT PRIMARY KEY, collected_at TEXT, n_legado INTEGER, n_160 INTEGER)""")


def _num(s):
    try:
        return float((s or "").replace(",", "."))
    except ValueError:
        return 0.0


def _sn(s):
    return 1 if (s or "").strip().upper() == "S" else (0 if (s or "").strip().upper() == "N" else None)


def _linhas_legado(txt):
    out = []
    for r in csv.DictReader(io.StringIO(txt), delimiter=";"):
        data = (r.get("Data_Registro_Oferta") or r.get("Data_Inicio_Oferta") or "").strip()
        if len(data) < 7 or data < "2000":
            continue
        ativo = r.get("Tipo_Ativo") or ""
        out.append((
            f"legado:{r.get('Numero_Processo') or ''}:{r.get('Numero_Registro_Oferta') or ''}:{r.get('CNPJ_Emissor') or ''}:{r.get('Emissao') or ''}:{r.get('Serie') or ''}:{data}",
            "anterior", data[:7], familia_de(ativo), ativo, r.get("CNPJ_Emissor"), r.get("Nome_Emissor"),
            r.get("CNPJ_Lider"), r.get("Nome_Lider"), _num(r.get("Valor_Total")),
            (r.get("Tipo_Oferta") or "").upper(), r.get("Rito_Oferta"), None, "Encerrada/registrada",
            _sn(r.get("Oferta_Incentivo_Fiscal")), None, r.get("Tipo_Societario_Emissor"), None, None,
        ))
    return out


def _linhas_160(txt):
    out = []
    for r in csv.DictReader(io.StringIO(txt), delimiter=";"):
        data = (r.get("Data_Registro") or r.get("Data_requerimento") or "").strip()
        if len(data) < 7:
            continue
        ativo = r.get("Valor_Mobiliario") or ""
        out.append((
            f"res160:{r.get('Numero_Requerimento')}", "res160", data[:7], familia_de(ativo), ativo,
            r.get("CNPJ_Emissor"), r.get("Nome_Emissor"), r.get("CNPJ_Lider"), r.get("Nome_Lider"),
            _num(r.get("Valor_Total_Registrado")), (r.get("Tipo_Oferta") or "").upper(),
            "RCVM 160 (rito automático)", r.get("Publico_alvo"), r.get("Status_Requerimento"),
            _sn(r.get("Titulo_incentivado")), _sn(r.get("Titulo_classificado_como_sustentavel")),
            r.get("Tipo_societario"), r.get("Tipo_lastro") or None, r.get("Regime_distribuicao"),
        ))
    return out


def collect(con, cfg):
    _ensure(con)
    try:
        body, meta = common.http_get(URL, timeout=300, accept="*/*")
    except Exception as e:
        return [{"key": "cvm_ofertas", "ok": False, "error": str(e)[:160]}]
    bronze_file, sha = common.save_bronze("cvm_ofertas", "oferta_distribuicao", body, meta)
    if con.execute("SELECT 1 FROM cvm_ofertas_coleta WHERE sha=?", (sha,)).fetchone():
        n = con.execute("SELECT COUNT(*) FROM cvm_ofertas").fetchone()[0]
        return [{"key": "cvm_ofertas", "ok": True, "ofertas": n, "nota": "zip inalterado (hash)"}]
    try:
        zf = zipfile.ZipFile(io.BytesIO(body))
        leg = _linhas_legado(zf.read("oferta_distribuicao.csv").decode("latin-1"))
        r160 = _linhas_160(zf.read("oferta_resolucao_160.csv").decode("latin-1"))
    except Exception as e:
        return [{"key": "cvm_ofertas", "ok": False, "error": f"parse: {str(e)[:140]}"}]
    con.execute("DELETE FROM cvm_ofertas")
    con.executemany("INSERT OR REPLACE INTO cvm_ofertas VALUES(" + ",".join("?" * 19) + ")", leg + r160)
    con.execute("INSERT OR REPLACE INTO cvm_ofertas_coleta VALUES(?,?,?,?)", (sha, common.now_utc(), len(leg), len(r160)))
    common.record_lineage(con, "ampliado.json", bronze_file, sha,
                          "CVM ofertas públicas (regime anterior + Res. 160): uma linha por oferta, família do ativo "
                          "pelo nome, mês do registro (ou do início), valor total/registrado")
    con.commit()
    return [{"key": "cvm_ofertas", "ok": True, "ofertas": len(leg) + len(r160), "legado": len(leg), "res160": len(r160)}]
