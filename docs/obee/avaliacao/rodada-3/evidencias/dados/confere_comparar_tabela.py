#!/usr/bin/env python3
"""Confere a Tabela completa de Comparar capitais (células, linhas-resumo e CSV) contra o recálculo próprio (só a gold).
Uso: python3 -I confere_comparar_tabela.py <jsonl> <prefixo>"""
import csv, io, json, re, sys, collections, statistics
sys.path.insert(0, "/home/user/scrutiniums/docs/obee/avaliacao/rodada-3/evidencias/dados")
import esperado as E

ent, prefixo = sys.argv[1], sys.argv[2]
res = []
amostras_texto = collections.Counter()


def reg(i, campo, exib, esp, ok=None):
    ok = (exib == esp) if ok is None else ok
    res.append((i, campo, exib, esp, "ok" if ok else "DIVERGE"))


def obs(ind, cod, ano, et=None, comp=None): return E.IDX.get((ind, cod, ano, et, comp))


def val(o): return o["valor"] if (o and o["status"] == "OBSERVADO" and o["valor"] is not None) else None


def elegivel(o): return bool(o and o["status"] == "OBSERVADO" and o["valor"] is not None and o["elegivel_comparacao"])


def limpa(s): return s.replace("\n", " ").strip()


COLS = ["despesa", "populacao", "despesa_hab", "intra_pct", "matriculas", "despesa_mat", "conveniadas_pct", "atu", "aprovacao", "ideb", "saeb"]
FORA = {"atu": ["creche", "pre_escola", "anos_iniciais", "anos_finais"], "aprovacao": ["anos_iniciais", "anos_finais"],
        "ideb": ["anos_iniciais", "anos_finais"], "saeb": ["anos_iniciais", "anos_finais"]}

n = 0
for linha in open(ent):
    r = json.loads(linha)
    i = r["id"]
    if not i.startswith("C|tab"): continue
    n += 1
    if r.get("erro"): reg(i, "carregamento", r["erro"], "ok", False); continue
    if r["console"]: reg(i, "console", "; ".join(r["console"])[:150], "sem erros", False)
    _, _, ano, et, moeda, regiao = i.split("|")
    ano = int(ano)
    url = r["url"]
    med = re.search(r"med=(\w+)", url).group(1)
    ano = E.ano_valido(med, ano)
    comp_moeda = "real_2025" if moeda == "real" else "nominal"
    reg_sel = regiao or None
    caps = E.universo(reg_sel)
    t = r["tabelas"][0]
    linhas = t["linhas"]
    reg(i, "linhas", len(linhas), len(caps))
    por_nome = {limpa(x[0]).split(" , ")[0].split(",")[0].strip(): x for x in linhas}
    exp_cols = {c: [] for c in COLS}
    ideb_exato = ano % 2 == 1
    for c in caps:
        cod = c["cod_ibge"]
        nome = f"{c['nome']} ({c['uf']})"
        x = por_nome.get(nome)
        if x is None: reg(i, f"linha_{c['nome']}", "(ausente)", nome, False); continue
        cel = x[1:12]
        # esperado
        d = obs("edu.despesa.funcao_educacao", cod, ano, None, comp_moeda)
        pop = obs("ctx.populacao.residente", cod, ano)
        dh = obs("edu.despesa.por_habitante", cod, ano, None, comp_moeda)
        mt = obs("edu.matriculas.rede_municipal", cod, ano, "total")
        dm = obs("edu.despesa.aplicacao_direta_por_matricula", cod, ano, None, comp_moeda)
        cv = obs("edu.matriculas.conveniadas_municipais", cod, ano, "total")
        intra = E.intra_pct(cod, ano)
        esp = {}
        esp["despesa"] = E.fmt("despesa", val(d)) if val(d) is not None else None
        esp["populacao"] = E.inteiro(val(pop)) if val(pop) is not None else None
        esp["despesa_hab"] = E.fmt("despesa_hab", val(dh)) if val(dh) is not None else None
        esp["intra_pct"] = (E.pt(intra, 1) + "%") if intra is not None else None
        esp["matriculas"] = E.inteiro(val(mt)) if val(mt) is not None else None
        esp["despesa_mat"] = E.fmt("despesa_mat", val(dm)) if val(dm) is not None else None
        esp["conveniadas_pct"] = (E.pt(100 * val(cv) / val(mt), 1) + "%") if (val(cv) is not None and val(mt)) else None
        for m, ind in [("atu", "edu.atu.rede_municipal"), ("aprovacao", "edu.aprovacao.rede_municipal")]:
            if et in FORA[m]:
                o = obs(ind, cod, ano, et)
                esp[m] = E.fmt(m, val(o)) if val(o) is not None else None
            else: esp[m] = "FORA"
        for m, ind, comp_ in [("ideb", "edu.ideb.rede_municipal", "ideb"), ("saeb", "edu.saeb.rede_municipal", "matematica")]:
            if et not in FORA[m]: esp[m] = "FORA"
            elif not ideb_exato: esp[m] = "SEM_EDICAO"
            else:
                o = obs(ind, cod, ano, et, comp_)
                esp[m] = E.fmt(m, val(o)) if val(o) is not None else None
        for k, col in enumerate(COLS):
            exib = limpa(cel[k]).replace(" fora das comparações", "")
            e = esp[col]
            if e in (None, "FORA", "SEM_EDICAO"):
                amostras_texto[(col, e, exib)] += 1
                # ausência/fora de escopo nunca pode aparecer como número
                ok = not re.search(r"\d", exib) or col == "intra_pct" and False
                reg(i, f"cel_{col}_ausente_{c['nome']}", exib, e, ok)
            else:
                reg(i, f"cel_{col}_{c['nome']}", exib, e)
        # diferença para a mediana (despesa_hab)
        st = E.comparacao("despesa_hab", ano, None, moeda if moeda == "real" else "nominal", "matematica", reg_sel)["st"] if med == "despesa_hab" else None
        dtxt = limpa(x[12])
        if med != "despesa_hab":
            pass
        elif val(dh) is not None and elegivel(dh) and st:
            v, md = val(dh), st["mediana"]
            ex = abs(E.arred(v, 0) - E.arred(md, 0))
            sinal = "+" if v - md >= 0 else "−"
            pct = abs(v - md) / md * 100
            if abs(v - md) < 1e-9:
                reg(i, f"dif_{c['nome']}", dtxt, "igual à mediana")
            elif ex == 0:
                esp_d = None
                reg(i, f"dif_{c['nome']}", dtxt, "(menos de R$ 1)", "menos de" in dtxt)
            else:
                esp_d = f"{sinal}R$ {E.pt(float(ex), 0)} ({sinal}{E.pt(pct, 1)}%), {'acima' if v > md else 'abaixo'} da mediana"
                reg(i, f"dif_{c['nome']}", dtxt, esp_d)
        else:
            reg(i, f"dif_ausente_{c['nome']}", dtxt, "", not re.search(r"\d", dtxt))
    # linhas-resumo (rodapé)
    rod = {limpa(x[0]): x for x in t["rodape"]}
    for chave, fnst in [("Mediana do grupo", "mediana"), ("Média simples das capitais", "media"), ("Menor valor", "min"), ("Maior valor", "max")]:
        x = rod.get(chave)
        if x is None: reg(i, f"resumo_{chave}", "(ausente)", chave, False); continue
        for k, col in enumerate(COLS):
            if col in ("intra_pct", "conveniadas_pct"):
                continue
            if col in ("atu", "aprovacao", "ideb", "saeb"):
                if et not in FORA[col] or (col in ("ideb", "saeb") and not ideb_exato):
                    reg(i, f"resumo_{fnst}_{col}_vazio", limpa(x[1 + k]), "", not re.search(r"\d", x[1 + k])); continue
            # estatística recalculada
            if col == "despesa": cm = E.comparacao("despesa", ano, None, comp_moeda == "real_2025" and "real" or "nominal", "matematica", reg_sel)
            elif col == "populacao":
                vs = [val(obs("ctx.populacao.residente", c["cod_ibge"], ano)) for c in caps if val(obs("ctx.populacao.residente", c["cod_ibge"], ano)) is not None]
                cm = {"st": {"mediana": statistics.median(vs), "media": sum(vs) / len(vs), "min": min(vs), "max": max(vs)} if vs else None}
            elif col == "matriculas": cm = E.comparacao("matriculas", ano, "total", "nominal", "matematica", reg_sel)
            elif col == "despesa_hab": cm = E.comparacao("despesa_hab", ano, None, "real" if moeda == "real" else "nominal", "matematica", reg_sel)
            elif col == "despesa_mat": cm = E.comparacao("despesa_mat", ano, None, "real" if moeda == "real" else "nominal", "matematica", reg_sel)
            else: cm = E.comparacao(col, ano, et, "nominal", "matematica", reg_sel)
            s = cm["st"]
            m_for = {"populacao": "matriculas"}.get(col, col)
            if s is None: reg(i, f"resumo_{fnst}_{col}", limpa(x[1 + k]), "", True if not re.search(r"\d", x[1 + k]) else False); continue
            fm = (lambda v: E.inteiro(v)) if col == "populacao" else (lambda v, m_=m_for: E.fmt(m_, v))
            reg(i, f"resumo_{fnst}_{col}", limpa(x[1 + k]), fm(s[fnst]))
    # CSV
    cs = r.get("csvs") or {}
    c0 = next(iter(cs.values()), None)
    if not c0:
        reg(i, "csv", "(não baixado)", "arquivo", False)
    else:
        rows = list(csv.DictReader(io.StringIO(c0["conteudo"].lstrip("﻿")), delimiter=";"))
        reg(i, "csv_linhas", len(rows), len(caps) * 11)
        # cada célula do CSV (valor_exibido) deve ser igual à da tabela
        rotulo = {"Despesa total na função Educação": "despesa", "População residente": "populacao", "Despesa por habitante": "despesa_hab",
                  "Parcela intraorçamentária da função (RREO)": "intra_pct", "Matrículas na rede municipal": "matriculas", "Despesa por matrícula": "despesa_mat",
                  "Conveniadas ÷ rede municipal": "conveniadas_pct", "Alunos por turma": "atu", "Taxa de aprovação": "aprovacao", "Ideb": "ideb", "Saeb": "saeb"}
        tab = {}
        for x in linhas:
            nome = limpa(x[0]).split(" , ")[0].split(",")[0].strip()
            for k, col in enumerate(COLS): tab[(nome, col)] = limpa(x[1 + k])
        bad = 0
        for row in rows:
            col = rotulo.get(row["coluna"])
            nome = f"{row['capital']} ({row['uf']})"
            te = tab.get((nome, col))
            ve = row["valor_exibido"]
            if te is None: bad += 1; continue
            # na tabela, ausência aparece como traço/texto; no CSV, vazio
            if ve == "":
                if re.search(r"\d", te): bad += 1; reg(i, f"csv_vazio_vs_tabela_{nome}_{col}", te, "", False)
            elif ve != te:
                bad += 1; reg(i, f"csv_x_tabela_{nome}_{col}", ve, te, False)
            # valor numérico = gold
        reg(i, "csv_igual_tabela", bad, 0)
        # colunas fixas
        r0 = rows[0]
        reg(i, "csv_hash", r0["hash_dados"], E.G["meta"]["hash_dados"])
        reg(i, "csv_gerado_em", r0["dados_gerados_em"], E.G["meta"]["gerado_em"])
        # valor numérico do CSV x gold, para despesa por habitante e despesa total
        for row in rows:
            if row["coluna"] in ("Despesa por habitante", "Despesa total na função Educação", "Despesa por matrícula", "População residente", "Matrículas na rede municipal"):
                cod = int(row["codigo_ibge"])
                key = {"Despesa por habitante": ("edu.despesa.por_habitante", None, comp_moeda), "Despesa total na função Educação": ("edu.despesa.funcao_educacao", None, comp_moeda),
                       "Despesa por matrícula": ("edu.despesa.aplicacao_direta_por_matricula", None, comp_moeda), "População residente": ("ctx.populacao.residente", None, None),
                       "Matrículas na rede municipal": ("edu.matriculas.rede_municipal", "total", None)}[row["coluna"]]
                o = obs(key[0], cod, ano, key[1], key[2])
                v = val(o)
                vc = float(row["valor_numerico"]) if row["valor_numerico"] != "" else None
                ok = (v is None and vc is None) or (v is not None and vc is not None and abs(v - vc) <= 1e-6 * max(1, abs(v)))
                if not ok: reg(i, f"csv_valor_{row['capital']}_{row['coluna']}", vc, v, False)
        res.append((i, "csv_valores_numericos_verificados", "", "", "ok"))

with open(f"{prefixo}_resultado.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["id", "campo", "exibido", "esperado", "resultado"]); w.writerows(res)
c = collections.Counter(x[-1] for x in res)
print("tabelas:", n, "checagens:", len(res), dict(c))
div = [x for x in res if x[-1] != "ok"]
print(collections.Counter(re.sub(r"_[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^_]*$", "", x[1]) for x in div).most_common(12))
for x in div[:30]: print(x)
print("--- textos de ausência/fora de escopo vistos nas células:")
for k, v in sorted(amostras_texto.items(), key=lambda kv: -kv[1])[:20]: print(k, v)
