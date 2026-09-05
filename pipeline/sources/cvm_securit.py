"""Conector CVM — informes mensais de securitizadoras (CRI e CRA, Res. CVM 60).

Fonte: dados.cvm.gov.br/dados/SECURIT/DOC/INF_MENSAL_{CRI,CRA}/DADOS/inf_mensal_{cri,cra}_AAAA.zip
(um zip por ano, 0,1 a 6 MB; um informe por certificado por mês, com versão).

O que vira silver, sempre pela ÚLTIMA versão de cada (emissora, certificado, mês):
- securit_cert: créditos vinculados, vencidos, a vencer com atraso, redução ao valor
  recuperável e ativo, por certificado e mês (a régua da inadimplência do lastro);
- securit_seg: créditos por segmento do lastro (CRI: incorporação, aluguéis, aquisição
  de imóveis, loteamento, multipropriedade, home equity, outros; CRA: produção,
  comercialização, beneficiamento, industrialização, insumos e máquinas), agregado do
  sistema por mês;
- securit_classe: séries por situação (adimplente, inadimplente…) com quantidade e
  valor dos certificados em circulação, agregado do sistema por mês.

Cobertura real dos campos: o CRA traz créditos desde 2019-09; o CRI só passa a
informar créditos em 2022-07 (antes o campo vem vazio; o builder começa a série
onde há dado, nunca preenche). Entregas atrasadas fazem o mês corrente e o anterior
ficarem incompletos: o ano corrente e o anterior são rebaixados a cada execução;
anos fechados são coletados uma vez.
"""
import csv
import io
import zipfile
from datetime import date

csv.field_size_limit(10_000_000)

from pipeline import common

URL = "https://dados.cvm.gov.br/dados/SECURIT/DOC/INF_MENSAL_{TIPO}/DADOS/inf_mensal_{tipo}_{ano}.zip"
ANO_INICIAL = 2019
SEG_CRI = {"Creditos_Incorporacao_Imobiliaria": "Incorporação imobiliária", "Creditos_Alugueis": "Aluguéis",
           "Creditos_Aquisicao_Imoveis": "Aquisição de imóveis", "Creditos_Loteamento": "Loteamento",
           "Creditos_Multipropriedade": "Multipropriedade", "Creditos_Home_Equity": "Home equity",
           "Creditos_Outros": "Outros"}
SEG_CRA = {"Direitos_Creditorios_Receber_Producao": "Produção", "Direitos_Creditorios_Receber_Comercializacao": "Comercialização",
           "Direitos_Creditorios_Receber_Beneficiamento": "Beneficiamento", "Direitos_Creditorios_Receber_Industrializacao": "Industrialização",
           "Direitos_Creditorios_Receber_Producao_Insumos": "Insumos (produção)", "Direitos_Creditorios_Receber_Comercializacao_Insumos": "Insumos (comercialização)",
           "Direitos_Creditorios_Receber_Beneficiamento_Insumos": "Insumos (beneficiamento)", "Direitos_Creditorios_Receber_Industrializacao_Insumos": "Insumos (industrialização)",
           "Direitos_Creditorios_Receber_Producao_Maquinas": "Máquinas (produção)", "Direitos_Creditorios_Receber_Comercializacao_Maquinas": "Máquinas (comercialização)",
           "Direitos_Creditorios_Receber_Beneficiamento_Maquinas": "Máquinas (beneficiamento)", "Direitos_Creditorios_Receber_Industrializacao_Maquinas": "Máquinas (industrialização)"}


def _ensure(con):
    con.execute("""CREATE TABLE IF NOT EXISTS securit_cert(
        tipo TEXT, cnpj TEXT, cod TEXT, ref TEXT, versao INTEGER, creditos REAL, vencidos REAL,
        atraso REAL, pdd REAL, ativo REAL, PRIMARY KEY(tipo, cnpj, cod, ref))""")
    con.execute("CREATE INDEX IF NOT EXISTS ix_securit_cert_ref ON securit_cert(tipo, ref)")
    con.execute("""CREATE TABLE IF NOT EXISTS securit_seg(
        tipo TEXT, ref TEXT, segmento TEXT, valor REAL, PRIMARY KEY(tipo, ref, segmento))""")
    con.execute("""CREATE TABLE IF NOT EXISTS securit_classe(
        tipo TEXT, ref TEXT, situacao TEXT, n INTEGER, valor REAL, PRIMARY KEY(tipo, ref, situacao))""")
    con.execute("""CREATE TABLE IF NOT EXISTS securit_coleta(
        tipo TEXT, ano INTEGER, sha TEXT, collected_at TEXT, n_cert INTEGER, PRIMARY KEY(tipo, ano))""")


def _f(s):
    if s is None or s == "":
        return None
    try:
        return float(s.replace(",", "."))
    except ValueError:
        return None


def _csv(zf, sufixo):
    nome = next((n for n in zf.namelist() if n.endswith(f"_{sufixo}_") or f"_{sufixo}_" in n), None)
    if not nome:
        return None
    return csv.DictReader(io.TextIOWrapper(zf.open(nome), encoding="latin-1"), delimiter=";")


def _ultima_versao(rows, chave=("CNPJ_Emissora", "Codigo_Identificacao_Certificado", "Data_Referencia")):
    ult = {}
    for r in rows:
        k = tuple(r.get(c) for c in chave)
        v = int(r.get("Versao") or 0)
        if k not in ult or v >= ult[k][0]:
            ult[k] = (v, r)
    return ult


def _absorve(con, tipo, zf):
    cred_col = "Creditos" if tipo == "cri" else "Direitos_Creditorios"
    ap = _csv(zf, "ativo_passivo")
    if ap is None:
        raise ValueError("ativo_passivo ausente")
    ult = _ultima_versao(ap)
    linhas = []
    for (cnpj, cod, ref), (v, r) in ult.items():
        linhas.append((tipo, cnpj, cod, ref[:7], v, _f(r.get(cred_col)), _f(r.get("Creditos_Vencidos")),
                       _f(r.get("Creditos_A_Vencer_Com_Parcelas_Atraso")), _f(r.get("Reducao_Valor_Recuperacao")), _f(r.get("Ativo"))))
    con.executemany("INSERT OR REPLACE INTO securit_cert VALUES(?,?,?,?,?,?,?,?,?,?)", linhas)
    # segmentos do lastro
    seg_csv = _csv(zf, "creditos" if tipo == "cri" else "direitos_creditorios")
    segs = SEG_CRI if tipo == "cri" else SEG_CRA
    if seg_csv is not None:
        acc = {}
        for (cnpj, cod, ref), (v, r) in _ultima_versao(seg_csv).items():
            for col, nome in segs.items():
                x = _f(r.get(col))
                if x:
                    acc[(ref[:7], nome)] = acc.get((ref[:7], nome), 0.0) + x
        con.executemany("INSERT OR REPLACE INTO securit_seg VALUES(?,?,?,?)",
                        [(tipo, ref, nome, val) for (ref, nome), val in acc.items()])
    # séries por situação
    cl = _csv(zf, "classe")
    if cl is not None:
        acc = {}
        vistos = set()
        for r in cl:
            k = (r.get("CNPJ_Emissora"), r.get("Codigo_Identificacao_Certificado"), r.get("Data_Referencia"),
                 r.get("Classe"), r.get("Numero_Serie"), r.get("Codigo_ISIN"), int(r.get("Versao") or 0))
            if k in vistos:
                continue
            vistos.add(k)
            sit = (r.get("Situacao") or "não informada").strip()
            ref = (r.get("Data_Referencia") or "")[:7]
            a = acc.setdefault((ref, sit), [0, 0.0])
            a[0] += 1
            a[1] += _f(r.get("Valor_Certificados")) or 0.0
        con.executemany("INSERT OR REPLACE INTO securit_classe VALUES(?,?,?,?,?)",
                        [(tipo, ref, sit, n, val) for (ref, sit), (n, val) in acc.items()])
    return len(linhas)


def collect(con, cfg):
    _ensure(con)
    results = []
    hoje = date.today()
    for tipo in ("cri", "cra"):
        for ano in range(ANO_INICIAL, hoje.year + 1):
            key = f"securit:{tipo}:{ano}"
            fechado = ano < hoje.year - 1
            if fechado and con.execute("SELECT 1 FROM securit_coleta WHERE tipo=? AND ano=?", (tipo, ano)).fetchone():
                continue
            url = URL.format(TIPO=tipo.upper(), tipo=tipo, ano=ano)
            try:
                body, meta = common.http_get(url, timeout=300, accept="*/*")
                bronze_file, sha = common.save_bronze("cvm_securit", f"{tipo}_{ano}", body, meta)
                ja = con.execute("SELECT sha, n_cert FROM securit_coleta WHERE tipo=? AND ano=?", (tipo, ano)).fetchone()
                if ja and ja[0] == sha:
                    results.append({"key": key, "ok": True, "cert_mes": ja[1], "nota": "zip inalterado (hash)"})
                    continue
                n = _absorve(con, tipo, zipfile.ZipFile(io.BytesIO(body)))
                con.execute("INSERT OR REPLACE INTO securit_coleta VALUES(?,?,?,?,?)", (tipo, ano, sha, common.now_utc(), n))
                common.record_lineage(con, "ampliado.json", bronze_file, sha,
                                      f"CVM informe mensal {tipo.upper()} {ano}: última versão por certificado e mês; "
                                      "créditos, vencidos, atraso, PDD, ativo; segmentos do lastro e situação das séries")
                con.commit()
                results.append({"key": key, "ok": True, "cert_mes": n})
            except Exception as e:
                results.append({"key": key, "ok": False, "error": str(e)[:160]})
    return results
