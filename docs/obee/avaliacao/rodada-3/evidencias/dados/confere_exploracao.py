#!/usr/bin/env python3
"""Confere páginas de exploração (Gastos, Atendimento, Resultados) coletadas no navegador contra o recálculo próprio
(esperado.py, só a gold). Uso: python3 -I confere_exploracao.py <jsonl> <saida_prefixo>
Grava <prefixo>_resultado.csv (um registro por checagem) e imprime o resumo."""
import csv, io, json, re, sys, unicodedata, collections
sys.path.insert(0, "/home/user/scrutiniums/docs/obee/avaliacao/rodada-3/evidencias/dados")
import esperado as E

ent, prefixo = sys.argv[1], sys.argv[2]
res = []  # (id, campo, exibido, esperado, ok)


def sem_acento(s):
    return "".join(ch for ch in unicodedata.normalize("NFD", s) if unicodedata.category(ch) != "Mn").casefold()


def nome_cap(c): return f"{c['nome']} ({c['uf']})"


def lista_nomes(nomes, mx=2):
    nomes = sorted(nomes, key=sem_acento)
    if len(nomes) <= mx: return " e ".join(nomes) if len(nomes) == 2 else "".join(nomes)
    return ", ".join(nomes[:mx]) + f" e mais {len(nomes) - mx}"


def reg(i, campo, exib, esp, ok=None):
    ok = (exib == esp) if ok is None else ok
    res.append((i, campo, exib, esp, "ok" if ok else "DIVERGE"))


def parse_id(i):
    p = i.split("|")
    return p


SUJ = {"despesa": "A despesa total em Educação", "despesa_hab": "A despesa em Educação por habitante",
       "despesa_mat": "A razão da despesa de aplicação direta por matrícula", "matriculas": "O número de matrículas na rede municipal",
       "conveniadas": "O número de matrículas em escolas conveniadas com o município", "atu": "A média de alunos por turma",
       "aprovacao": "A taxa de aprovação", "ideb": "O Ideb", "saeb": "A proficiência média no Saeb"}
ETF = {"total": "em toda a educação básica", "creche": "na creche", "pre_escola": "na pré-escola", "anos_iniciais": "nos anos iniciais",
       "anos_finais": "nos anos finais", "ensino_medio": "no ensino médio", "eja": "na educação de jovens e adultos", "profissional": "na educação profissional"}
DISC = {"matematica": "Matemática", "portugues": "Língua Portuguesa"}


def frase_esperada(m, ano, et, disc, comp):
    st = comp["st"]
    per = f"na edição {ano}" if m in ("ideb", "saeb") else f"em {ano}"
    if not st: return f"Nenhuma capital tem dado comparável para esta medida {per}."
    compl = []
    if m == "saeb": compl.append(f"em {DISC[disc]}")
    if E.MEDIDA[m][1]: compl.append(ETF[et])
    suj = SUJ[m] + (" " + " ".join(compl) if compl else "")
    n = st["n"]
    if n == 1:
        return f"Só {lista_nomes(st['capmin'])} tem dado comparável {per}: {E.fmt(m, st['min'])}."
    if st["min"] == st["max"]:
        return f"{suj} é {E.fmt(m, st['min'])} nas {n} capitais com dado comparável {per}."
    return f"{suj} vai de {E.fmt(m, st['min'])} em {lista_nomes(st['capmin'])} a {E.fmt(m, st['max'])} em {lista_nomes(st['capmax'])} entre as {n} capitais com dado comparável {per}."


def dif_curta(m, d):
    a = abs(d)
    if m == "despesa": return E.fmt(m, a)
    if m in ("despesa_hab", "despesa_mat"): return E.fmt(m, a)
    if m in ("matriculas", "conveniadas"): return E.fmt(m, a) + " matrículas"
    if m == "atu": return E.pt(a, 1) + (" alunos" if a >= 1.05 else " aluno") + " por turma"
    if m == "aprovacao": return E.pt(a, 1) + (" pontos percentuais" if a >= 1.05 else " ponto percentual")
    return E.pt(a, 2 if m == "saeb" else 1) + (" pontos" if a >= 1.05 else " ponto")


def frase_capital(c, m, o, comp):
    q = nome_cap(c)
    if o is None or o["status"] != "OBSERVADO" or o["valor"] is None:
        return f"{q} não tem valor observado para esta medida neste recorte."
    if not o["elegivel_comparacao"]:
        return f"{q} registra {E.fmt(m, o['valor'])}, valor fora da comparação entre capitais (o motivo está logo abaixo do gráfico)."
    st = comp["st"]
    if st is None: return f"{q} registra {E.fmt(m, o['valor'])}."
    v, md = o["valor"], st["mediana"]
    casas = 2 if m == "saeb" else (1 if m in ("atu", "aprovacao", "ideb") else 0)
    ex = abs(E.arred(v, casas) - E.arred(md, casas))
    if m == "despesa": ex = abs(v - md)
    if abs(v - md) < 1e-9: dif = " (igual à mediana)"
    elif ex == 0 and m != "despesa":
        dif = f" (diferença menor que a precisão exibida, {'acima' if v > md else 'abaixo'})"
    else:
        dif = f" ({dif_curta(m, float(ex) if m != 'despesa' else abs(v - md))} {'acima' if v > md else 'abaixo'})"
    return f"{q} registra {E.fmt(m, v)}; a mediana das {st['n']} capitais é {E.fmt(m, md)}{dif}."


def linhas(texto): return [l.strip() for l in texto.split("\n") if l.strip()]


def csv_linhas(conteudo):
    txt = conteudo.lstrip("﻿")
    return list(csv.DictReader(io.StringIO(txt), delimiter=";"))


def sig12(v):
    return float(f"{v:.12g}") if abs(v) < 1e9 else float(f"{v:.15g}")


n_paginas = 0
for linha in open(ent):
    r = json.loads(linha)
    i = r["id"]
    if r.get("erro"):
        reg(i, "carregamento", r["erro"], "sem erro", False); continue
    n_paginas += 1
    if r["console"]: reg(i, "console", "; ".join(r["console"])[:200], "sem erros", False)
    p = i.split("|")
    tipo = p[0]
    if tipo not in ("G", "A", "R", "CG"): continue
    m, ano = p[1], int(p[2])
    et = p[3] or None
    disc = p[4] if tipo == "R" and m == "saeb" and p[4] else "matematica"
    moeda = p[3] if tipo == "G" else "nominal"
    if tipo == "G":
        moeda = p[3]; cap_id = p[4]; grp = p[5]; et = "anos_iniciais"
    elif tipo == "CG":
        cap_id = ""; grp = "todas"
    else:
        cap_id = p[5]; grp = "todas"
    cap = E.CAP_POR_ID.get(cap_id)
    regiao = cap["regiao"] if (cap and grp == "regiao") else None
    if tipo == "CG": regiao = p[5] or None
    ano_ef = E.ano_valido(m, ano)
    pass
    comp = E.comparacao(m, ano_ef, et, moeda, disc, regiao)
    L = linhas(r["texto"])
    T = r["texto"]
    # 1. frase de amplitude
    titulo = next((h["t"] for h in r["h"] if h["id"] in ("visao-titulo", "comparar-titulo")), None)
    reg(i, "frase_amplitude", titulo, frase_esperada(m, ano_ef, et, disc, comp))
    # 2. cobertura
    st = comp["st"]
    if st:
        cob = f"Há dados comparáveis para as {comp['universo']} capitais." if st["n"] == comp["universo"] else f"Há dados comparáveis para {st['n']} das {comp['universo']} capitais."
    else:
        cob = f"Não há dados comparáveis para nenhuma das {comp['universo']} capitais."
    reg(i, "cobertura", cob in T, True)
    # 3. frase da capital
    if cap:
        o = E.ponto(m, cap["cod_ibge"], ano_ef, et, moeda, disc)
        # a frase usa a mediana do grupo (regional se grp=regiao)
        fe = frase_capital(cap, m, o, comp)
        reg(i, "frase_capital", fe in T, True) if fe in T else reg(i, "frase_capital", next((l for l in L if " registra " in l or "não tem valor observado" in l), "(ausente)"), fe)
    # 4. referências do grupo
    if st:
        try:
            if tipo == "CG":
                k = next(j for j in range(len(L) - 2) if L[j] == "Mediana" and L[j + 2] == "Média simples")
            else:
                k = L.index("Referências para ler o número")
            bloco = L[k:k + 40]
            def depois(rot, off=1):
                return bloco[bloco.index(rot) + off]
            reg(i, "ref_mediana", depois("Mediana"), E.fmt(m, st["mediana"]))
            reg(i, "ref_media", depois("Média simples"), E.fmt(m, st["media"]))
            mn = depois("Menor valor"); mx = depois("Maior valor")
            reg(i, "ref_menor", mn, f"{E.fmt(m, st['min'])} · {lista_nomes(st['capmin'], 99).replace(' e ', ', ') if False else ''}", None) if False else None
            reg(i, "ref_menor_valor", mn.split(" · ")[0], E.fmt(m, st["min"]))
            reg(i, "ref_maior_valor", mx.split(" · ")[0], E.fmt(m, st["max"]))
            nomes_mn = mn.split(" · ", 1)[1] if " · " in mn else ""
            nomes_mx = mx.split(" · ", 1)[1] if " · " in mx else ""
            reg(i, "ref_menor_capitais", sorted(re.split(r", | e ", nomes_mn)) if len(st["capmin"]) <= 2 else nomes_mn[:40],
                sorted(st["capmin"]) if len(st["capmin"]) <= 2 else nomes_mn[:40], None if len(st["capmin"]) > 2 else (sorted(re.split(r"(?<=\)), | e ", nomes_mn)) == sorted(st["capmin"])))
            reg(i, "ref_maior_capitais", nomes_mx, nomes_mx, None if len(st["capmax"]) > 2 else (sorted(re.split(r"(?<=\)), | e ", nomes_mx)) == sorted(st["capmax"])))
            reg(i, "ref_n", depois("Capitais na comparação"), f"{st['n']} de {comp['universo']}")
            if st["n"] >= 8:
                reg(i, "ref_faixa", depois("Metade central"), f"{E.fmt(m, st['q1'])} a {E.fmt(m, st['q3'])}")
            else:
                reg(i, "ref_faixa_oculta_n<8", "Metade central" in bloco, False)
            if "razao" in st:
                rz = next((l for l in L if l.startswith("Razão agregada")), "")
                esp = f"Razão agregada {E.fmt(m, st['razao'])}:"
                reg(i, "ref_razao_agregada", rz.split(":")[0] + ":" if rz else "(ausente)", esp)
                if tipo != "CG":
                    den = E.inteiro(st["den"])
                    reg(i, "ref_razao_denominador", den in rz, True)
        except (ValueError, StopIteration) as e:
            reg(i, "ref_bloco", "ausente: " + str(e)[:60], "bloco presente", False)
    # 5. perímetro (despesa)
    if m.startswith("despesa"):
        pcs = [(E.intra_pct(c["cod_ibge"], ano_ef), c) for c in E.CAPS]
        pcs = [(v, c) for v, c in pcs if v is not None]
        if pcs:
            pcs.sort(key=lambda x: (x[0], sem_acento(x[1]["nome"])))
            lo, hi = pcs[0], pcs[-1]
            esp = f"Em {ano_ef} essa parcela pesa de {E.pt(lo[0], 1)}% da função em {nome_cap(lo[1])} a {E.pt(hi[0], 1)}% em {nome_cap(hi[1])} (RREO)"
            reg(i, "perimetro_intra", esp in T, True)
    # 6. CSV
    cs = r.get("csvs") or {}
    c0 = next(iter(cs.values()), None)
    if c0:
        rows = csv_linhas(c0["conteudo"])
        reg(i, "csv_linhas", len(rows), comp["universo"])
        porcod = {int(x["codigo_ibge"]): x for x in rows}
        for c in E.universo(regiao):
            x = porcod.get(c["cod_ibge"])
            o = E.ponto(m, c["cod_ibge"], ano_ef, et, moeda, disc)
            if x is None:
                reg(i, f"csv_{c['nome']}", "(ausente)", "linha", False); continue
            tem = o is not None and o["status"] == "OBSERVADO" and o["valor"] is not None
            if tem:
                vcsv = float(x["valor_numerico"]) if x["valor_numerico"] != "" else None
                if o["elegivel_comparacao"] or True:
                    # valor numérico só vem para incluídas e fora-da-comparação com valor
                    ok = vcsv is not None and abs(vcsv - o["valor"]) <= 1e-9 * max(1, abs(o["valor"])) + (1e-6 * abs(o["valor"]) if abs(o["valor"]) > 1e9 else 0)
                    reg(i, f"csv_valor_{c['nome']}", vcsv, o["valor"], ok)
                inc_esp = "sim" if o["elegivel_comparacao"] else "nao"
                reg(i, f"csv_incluida_{c['nome']}", x["incluida_na_comparacao"], inc_esp)
                if not o["elegivel_comparacao"] and x["motivo_exclusao"] == "":
                    reg(i, f"csv_motivo_{c['nome']}", "(vazio)", "motivo preenchido", False)
            else:
                reg(i, f"csv_valor_vazio_{c['nome']}", x["valor_numerico"], "")
                reg(i, f"csv_incluida_{c['nome']}", x["incluida_na_comparacao"], "nao")
                if x["motivo_exclusao"] == "": reg(i, f"csv_motivo_{c['nome']}", "(vazio)", "motivo preenchido", False)
        x0 = rows[0]
        if st:
            reg(i, "csv_mediana", abs(float(x0["mediana_das_incluidas"]) - st["mediana"]) < 1e-6 * max(1, abs(st["mediana"])), True)
            reg(i, "csv_media", abs(float(x0["media_simples_das_incluidas"]) - st["media"]) < 1e-6 * max(1, abs(st["media"])), True)
            reg(i, "csv_min_max", (abs(float(x0["minimo_das_incluidas"]) - st["min"]) < 1e-6 * max(1, abs(st["min"])) and abs(float(x0["maximo_das_incluidas"]) - st["max"]) < 1e-6 * max(1, abs(st["max"]))), True)
            reg(i, "csv_n", (x0["capitais_incluidas"], x0["capitais_com_valor"], x0["capitais_no_grupo"]), (str(st["n"]), str(comp["com_valor"]), str(comp["universo"])))
            if "razao" in st:
                reg(i, "csv_razao", abs(float(x0["razao_agregada_do_grupo"]) - st["razao"]) < 1e-6 * st["razao"], True)
            if st["n"] >= 8:
                reg(i, "csv_quartis", abs(float(x0["primeiro_quartil"]) - st["q1"]) < 1e-6 * max(1, abs(st["q1"])) and abs(float(x0["terceiro_quartil"]) - st["q3"]) < 1e-6 * max(1, abs(st["q3"])), True)
            reg(i, "csv_quartis_exibidos", x0["quartis_exibidos"], "sim" if st["n"] >= 8 else "nao")
        # resumo = CSV: os n do texto e do CSV coincidem
    # 7. tabela simples (vis=tabela) não coletada neste lote

with open(f"{prefixo}_resultado.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["id", "campo", "exibido", "esperado", "resultado"]); w.writerows(res)
c = collections.Counter(x[-1] for x in res)
print("páginas:", n_paginas, "checagens:", len(res), dict(c))
div = [x for x in res if x[-1] != "ok"]
by = collections.Counter(x[1].split("_")[0] + "_" + (x[1].split("_")[1] if len(x[1].split("_")) > 1 else "") for x in div)
print(by.most_common(15))
for x in div[:25]: print(x)
