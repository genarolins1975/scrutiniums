#!/usr/bin/env python3
"""Reproduz a despesa de aplicação direta por matrícula a partir da MSC de dezembro (Siconfi, consulta ao vivo em 2026-10-09)
e da DOCUMENTAÇÃO pública do painel (Dados e métodos): aplicação direta (modalidades 90, 93 e 94) na função 12, contas
6.2.2.1.3.03, .04 e .07 em saldo líquido (C soma, D subtrai), menos subfunção 364 e menos elementos 01, 03 e 05 do grupo 3.1;
dividida por QT_MAT_BAS (matrículas da rede municipal, tiradas da gold). Uso: python3 -I verifica_msc_por_matricula.py cod:ano ..."""
import csv, json, sys, urllib.request, os
RAIZ = "/home/user/scrutiniums"
OUT = f"{RAIZ}/docs/obee/avaliacao/rodada-3/evidencias/dados"
g = json.load(open(f"{RAIZ}/public/eficiencia/gold/educacao_capitais.json"))
idx = {(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"]): o for o in g["observacoes"]}
nomes = {c["cod_ibge"]: c["nome"] for c in g["universo"]["capitais"]}
linhas = []
for par in sys.argv[1:]:
    cod, ano = map(int, par.split(":"))
    url = f"https://apidatalake.tesouro.gov.br/ords/siconfi/tt/msc_orcamentaria?id_ente={cod}&an_referencia={ano}&me_referencia=12&co_tipo_matriz=MSCC&classe_conta=6&id_tv=ending_balance"
    itens, off = [], 0
    while True:
        d = json.load(urllib.request.urlopen(url + (f"&offset={off}" if off else ""), timeout=120))
        itens += d["items"]
        if not d.get("hasMore"): break
        off += d["limit"]
    L = [x for x in itens if str(x.get("funcao")) == "12" and str(x["conta_contabil"])[:7] in ("6221303", "6221304", "6221307")]
    sg = lambda x: x["valor"] if x["natureza_conta"] == "C" else -x["valor"]
    nd = lambda x: str(x.get("natureza_despesa") or "")
    tot = sum(sg(x) for x in L)
    intra = sum(sg(x) for x in L if nd(x)[2:4] == "91")
    ad = [x for x in L if nd(x)[2:4] in ("90", "93", "94")]
    adt = sum(sg(x) for x in ad)
    sup = sum(sg(x) for x in ad if str(x.get("subfuncao")) == "364")
    ina = sum(sg(x) for x in ad if str(x.get("subfuncao")) != "364" and nd(x)[0:2] == "31" and nd(x)[4:6] in ("01", "03", "05"))
    num = adt - sup - ina
    m = idx[("edu.matriculas.rede_municipal", cod, ano, "total", None)]["valor"]
    dca = idx[("edu.despesa.funcao_educacao", cod, ano, None, "nominal")]["valor"]
    gold = idx[("edu.despesa.aplicacao_direta_por_matricula", cod, ano, None, "nominal")]
    razao = num / m if m else None
    linhas.append((nomes[cod], ano, len(L), round(tot - intra, 2), dca, round(num, 2), m, round(razao, 4) if razao else None, gold["valor"], gold["status"]))
    print(linhas[-1], flush=True)
with open(f"{OUT}/verificacao_msc_por_matricula.csv", "a", newline="") as f:
    w = csv.writer(f)
    if os.path.getsize(f.name) == 0: w.writerow(["capital", "ano", "linhas_func12_msc", "msc_sem_intra", "dca_funcao12", "numerador_recalculado", "matriculas", "razao_recalculada", "razao_gold", "status_gold"])
    w.writerows(linhas)
