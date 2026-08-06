"""Correspondentes no País, por instituição contratante e município (BCB).

Cadastro público servido pelo Olinda: cada linha é um ponto de atendimento de
correspondente, com o CNPJ-raiz da instituição CONTRATANTE, o CNPJ do
correspondente, o tipo do ponto (sede, filial, posto) e o município.

Por que este cadastro importa mais do que o tamanho sugere: é o correspondente
— lotérica, mercado, farmácia, casa de crédito — que sustenta a presença
bancária na maior parte do território. Agência, posto e PAE juntos alcançam
5.191 dos 5.570 municípios; com correspondentes, a cobertura é universal. Sem
esta fonte, o painel publicaria "379 municípios sem ponto de atendimento" sem
dizer que todos eles têm correspondente.

Três limites viajam com o dado:

1. **Contratante não é grupo.** A contratação é feita pela entidade que assina
   o contrato, que muitas vezes é a financeira do grupo e não o banco (o
   Santander contrata pela Santander S.A. CFI, o Safra pela Safra CFI). As
   contagens são por CNPJ-raiz contratante, exatamente como o BC publica —
   nunca consolidadas por grupo econômico, o que exigiria um mapa de controle
   que esta fonte não traz.
2. **Ponto não é exclusividade.** O mesmo estabelecimento pode ser
   correspondente de várias instituições e aparece uma vez para cada uma;
   somar instituições superestima pontos físicos distintos.
3. **Serviço prestado varia.** A coluna de serviços remete aos incisos da
   Resolução 3.954: um correspondente que só recebe boleto não faz o mesmo que
   um que abre conta e origina crédito. O cadastro não é medida de acesso a
   crédito.

Como o BC republica o arquivo com a posição corrente, sem histórico, a coleta
grava a posição e acumula o agregado por instituição — a série passa a existir
a partir da primeira coleta.
"""
import csv
import io

from pipeline import common

URL = ("https://olinda.bcb.gov.br/olinda/servico/Informes_Correspondentes/versao/v1/"
       "odata/Correspondentes?$format=text/csv")
PAGINA = "https://www.bcb.gov.br/fis/info/correspondentes.asp"
RESOLUCAO = "https://www.bcb.gov.br/pre/normativos/res/2011/pdf/res_3954_v1_O.pdf"


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS corresp_pontos(
        cnpj8 TEXT, nome_if TEXT, municipio_ibge TEXT, uf TEXT, qtd INTEGER,
        correspondentes INTEGER, posicao TEXT,
        PRIMARY KEY(cnpj8, municipio_ibge));
    CREATE TABLE IF NOT EXISTS corresp_hist(
        posicao TEXT, cnpj8 TEXT, pontos INTEGER, municipios INTEGER,
        PRIMARY KEY(posicao, cnpj8));
    CREATE TABLE IF NOT EXISTS corresp_coleta(
        chave TEXT PRIMARY KEY, coletado_em TEXT, sha TEXT, detalhe TEXT);
    """)


def _absorve(con, texto):
    linhas = csv.DictReader(io.StringIO(texto))
    campos = linhas.fieldnames or []
    for obrig in ("CnpjContratante", "NomeContratante", "CnpjCorrespondente",
                  "MunicipioIBGE", "UF", "Posicao"):
        if obrig not in campos:
            raise RuntimeError(f"coluna {obrig} ausente — esquema do BCB mudou")
    agreg, unicos, nomes, posicao, total = {}, {}, {}, None, 0
    for l in linhas:
        cnpj = "".join(ch for ch in (l.get("CnpjContratante") or "") if ch.isdigit())
        if not cnpj:
            continue
        cnpj = cnpj[:8].zfill(8)
        mun = (l.get("MunicipioIBGE") or "").strip()
        if not (mun.isdigit() and len(mun) == 7):
            mun = ""  # o cadastro traz um punhado de linhas sem município válido
        chave = (cnpj, mun)
        agreg[chave] = agreg.get(chave, 0) + 1
        unicos.setdefault(chave, set()).add((l.get("CnpjCorrespondente") or "").strip())
        nomes[cnpj] = ((l.get("NomeContratante") or "").strip(), (l.get("UF") or "").strip())
        posicao = posicao or (l.get("Posicao") or "").strip()
        total += 1
    if not total:
        raise RuntimeError("cadastro de correspondentes veio vazio")
    con.execute("DELETE FROM corresp_pontos")
    for (cnpj, mun), qtd in agreg.items():
        nome, uf = nomes[cnpj]
        con.execute("INSERT OR REPLACE INTO corresp_pontos VALUES(?,?,?,?,?,?,?)",
                    (cnpj, nome, mun, uf, qtd, len(unicos[(cnpj, mun)]), posicao))
    por_if = {}
    for (cnpj, mun), qtd in agreg.items():
        d = por_if.setdefault(cnpj, {"pontos": 0, "mun": set()})
        d["pontos"] += qtd
        if mun:
            d["mun"].add(mun)
    con.execute("DELETE FROM corresp_hist WHERE posicao=?", (posicao,))
    for cnpj, d in por_if.items():
        con.execute("INSERT OR REPLACE INTO corresp_hist VALUES(?,?,?,?)",
                    (posicao, cnpj, d["pontos"], len(d["mun"])))
    return {"linhas": total, "contratantes": len(por_if), "posicao": posicao,
            "municipios": len({m for _c, m in agreg if m})}


def collect(con, cfg=None):
    _ensure(con)
    try:
        body, meta = common.http_get(URL, timeout=600, accept=None)
    except Exception as e:
        return [{"key": "correspondentes", "ok": False, "error": str(e)[:200]}]
    _, sha = common.save_bronze("correspondentes", "unicad_correspondentes", body, meta)
    anterior = con.execute("SELECT sha FROM corresp_coleta WHERE chave='correspondentes'").fetchone()
    if anterior and anterior[0] == sha:
        return [{"key": "correspondentes", "ok": True, "inalterado": True}]
    try:
        r = _absorve(con, body.decode("utf-8-sig", errors="replace"))
    except Exception as e:
        return [{"key": "correspondentes", "ok": False, "error": str(e)[:200]}]
    con.execute("INSERT OR REPLACE INTO corresp_coleta VALUES(?,?,?,?)",
                ("correspondentes", common.now_utc(), sha, r["posicao"]))
    common.record_lineage(con, "operacional.json", "unicad_correspondentes.csv", sha,
                          "Correspondentes no País -> corresp_pontos (agregado por contratante e município)")
    con.commit()
    return [{"key": "correspondentes", "ok": True, **r}]
