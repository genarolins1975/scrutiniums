"""Remuneração da administração — item 8 do FRE, via dataset ESTRUTURADO da CVM.

Nada de PDF: a CVM publica os quadros de remuneração como CSVs dentro de
`fre_cia_aberta_{ano}.zip` (dados.cvm.gov.br). Este coletor absorve, para os
BANCOS do cadastro CVM (setor 'Bancos', registro ativo):

- `remuneracao_total_orgao`: por exercício social e órgão (Diretoria
  Estatutária, Conselho de Administração, Conselho Fiscal): total, nº de
  membros (média anual ponderada — 45,5 é normal) e composição (salário,
  bônus, participação nos resultados, baseada em ações, pós-emprego...).
- `remuneracao_maxima_minima_media`: maior/menor/média individual por órgão
  e exercício, quando divulgadas.

Semântica que viaja com o dado: o FRE do ano N traz o exercício N PREVISTO
(proposta aprovada em assembleia) e os exercícios anteriores REALIZADOS
(remuneração reconhecida no resultado). Reapresentações: vence a maior
Versao por (cnpj, exercício, órgão).
"""
import csv
import io
import json
import urllib.request
import zipfile

from pipeline import common

FRE_ZIP = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FRE/DADOS/fre_cia_aberta_{ano}.zip"

COMPOSICAO = [("Salario", "salario"), ("Beneficios_Diretos_Indiretos", "beneficios"),
              ("Bonus", "bonus"), ("Participacao_Resultados", "participacao_resultados"),
              ("Baseada_Acoes", "baseada_acoes"), ("Pos_emprego", "pos_emprego"),
              ("Cessacao_Cargo", "cessacao_cargo")]


def _f(v):
    try:
        return float(str(v).replace(",", "."))
    except Exception:
        return None


def _cnpj8(cnpj):
    d = "".join(ch for ch in str(cnpj or "") if ch.isdigit())
    return d[:8].zfill(8) if d else ""


def collect(con, cfg):
    con.execute("""CREATE TABLE IF NOT EXISTS rem_total_orgao(
        cnpj8 TEXT, nome TEXT, exercicio TEXT, orgao TEXT, versao INTEGER,
        fre_ano INTEGER, total REAL, membros REAL, membros_remunerados REAL,
        composicao TEXT, PRIMARY KEY(cnpj8, exercicio, orgao))""")
    con.execute("""CREATE TABLE IF NOT EXISTS rem_max_min_media(
        cnpj8 TEXT, nome TEXT, exercicio TEXT, orgao TEXT, versao INTEGER,
        fre_ano INTEGER, maior REAL, menor REAL, media REAL, membros REAL,
        PRIMARY KEY(cnpj8, exercicio, orgao))""")
    ano = int(str(common.now_utc())[:4])
    bancos = {_cnpj8(r[0]) for r in con.execute(
        "SELECT cnpj FROM oper_cadastro_cvm WHERE setor LIKE '%Banco%' AND situacao_registro='Ativo'")}
    if not bancos:
        return [{"key": "remuneracao", "ok": False,
                 "error": "cadastro CVM de bancos vazio no silver — coleta adiada (nunca coletar sem filtro)"}]
    try:
        req = urllib.request.Request(FRE_ZIP.format(ano=ano), headers={"User-Agent": "Mozilla/5.0"})
        body = urllib.request.urlopen(req, timeout=300).read()
        z = zipfile.ZipFile(io.BytesIO(body))
    except Exception as e:
        return [{"key": "remuneracao", "ok": False, "error": str(e)[:200]}]

    def linhas(nome_csv):
        alvo = [n for n in z.namelist() if nome_csv in n]
        if not alvo:
            return []
        return list(csv.DictReader(io.TextIOWrapper(z.open(alvo[0]), encoding="latin-1"), delimiter=";"))

    n_tot = n_mmm = 0
    filtradas = []
    for r in linhas("remuneracao_total_orgao"):
        c8 = _cnpj8(r.get("CNPJ_Companhia"))
        if c8 not in bancos:
            continue
        ex = str(r.get("Data_Fim_Exercicio_Social") or "")[:10]
        orgao, versao = r.get("Orgao_Administracao") or "", int(_f(r.get("Versao")) or 0)
        atual = con.execute("SELECT versao FROM rem_total_orgao WHERE cnpj8=? AND exercicio=? AND orgao=?",
                            (c8, ex, orgao)).fetchone()
        if atual and atual[0] >= versao:
            continue
        comp = {slug: _f(r.get(campo)) for campo, slug in COMPOSICAO if _f(r.get(campo)) is not None}
        con.execute("INSERT OR REPLACE INTO rem_total_orgao VALUES(?,?,?,?,?,?,?,?,?,?)",
                    (c8, r.get("Nome_Companhia"), ex, orgao, versao, ano,
                     _f(r.get("Total_Remuneracao_Orgao")), _f(r.get("Numero_Membros")),
                     _f(r.get("Numero_Membros_Remunerados")), json.dumps(comp, ensure_ascii=False)))
        filtradas.append(r)
        n_tot += 1
    for r in linhas("remuneracao_maxima_minima_media"):
        c8 = _cnpj8(r.get("CNPJ_Companhia"))
        if c8 not in bancos:
            continue
        ex = str(r.get("Data_Fim_Exercicio_Social") or "")[:10]
        orgao, versao = r.get("Orgao_Administracao") or "", int(_f(r.get("Versao")) or 0)
        atual = con.execute("SELECT versao FROM rem_max_min_media WHERE cnpj8=? AND exercicio=? AND orgao=?",
                            (c8, ex, orgao)).fetchone()
        if atual and atual[0] >= versao:
            continue
        con.execute("INSERT OR REPLACE INTO rem_max_min_media VALUES(?,?,?,?,?,?,?,?,?,?)",
                    (c8, r.get("Nome_Companhia"), ex, orgao, versao, ano,
                     _f(r.get("Valor_Maior_Remuneracao")), _f(r.get("Valor_Menor_Remuneracao")),
                     _f(r.get("Valor_Medio_Remuneracao")), _f(r.get("Numero_Membros"))))
        n_mmm += 1
    con.commit()
    if filtradas:
        common.save_bronze("remuneracao", f"fre_{ano}_bancos",
                           json.dumps(filtradas, ensure_ascii=False).encode(),
                           {"url": FRE_ZIP.format(ano=ano), "filtro": "setor Bancos ativo"})
        common.record_lineage(con, "operacional.json", f"remuneracao/fre_{ano}_bancos", "-",
                              "FRE item 8 (CSVs estruturados da CVM) -> rem_total_orgao/rem_max_min_media")
    return [{"key": "remuneracao", "ok": True, "fre_ano": ano,
             "linhas_total_orgao": n_tot, "linhas_max_min_media": n_mmm}]
