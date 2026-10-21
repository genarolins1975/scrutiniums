#!/usr/bin/env python3
"""Compara o que o navegador exibiu (frase, referências, tabela) com o recálculo independente a partir da gold.
Entrada: JSON do coletor Playwright (grade.mjs): lista de {url, texto, tabelas, erros}.
Saída: comparacao_navegador_gold.csv e resumo no stdout.
Uso: python3 -I compara_navegador_gold.py <raiz> <grade.json> <saida>
"""
import csv, json, re, statistics, sys, math, unicodedata
from pathlib import Path
from urllib.parse import urlparse, parse_qs

RAIZ = Path(sys.argv[1]); ENTRADA = Path(sys.argv[2]); SAIDA = Path(sys.argv[3])
G = json.load(open(RAIZ / "public/eficiencia/gold/educacao_capitais.json"))
CAPS = {c["cod_ibge"]: c for c in G["universo"]["capitais"]}
NOME = {c["cod_ibge"]: f'{c["nome"]} ({c["uf"]})' for c in G["universo"]["capitais"]}
OBS = {(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"]): o for o in G["observacoes"]}
IDEB_ANOS = G["periodos"]["ideb"]

MEDIDA = {
    "despesa": ("edu.despesa.funcao_educacao", "fin", False), "despesa_hab": ("edu.despesa.por_habitante", "fin", False),
    "despesa_mat": ("edu.despesa.aplicacao_direta_por_matricula", "fin", False), "matriculas": ("edu.matriculas.rede_municipal", "censo", True),
    "conveniadas": ("edu.matriculas.conveniadas_municipais", "censo", True), "atu": ("edu.atu.rede_municipal", "censo", True),
    "aprovacao": ("edu.aprovacao.rede_municipal", "censo", True), "ideb": ("edu.ideb.rede_municipal", "ideb", True), "saeb": ("edu.saeb.rede_municipal", "ideb", True),
}
ETAPAS_MED = {"matriculas": None, "conveniadas": None, "atu": ["creche", "pre_escola", "anos_iniciais", "anos_finais"],
              "aprovacao": ["anos_iniciais", "anos_finais"], "ideb": ["anos_iniciais", "anos_finais"], "saeb": ["anos_iniciais", "anos_finais"]}
PADRAO_ETAPA = "anos_iniciais"

def num(s):
    """número em pt-BR com sufixo; devolve (valor, resolução)."""
    s = s.replace("R$", "").replace("%", "").replace(" ", " ").strip()
    m = re.match(r"^([\d\.]+(?:,\d+)?)\s*(mil|milhão|milhões|bilhão|bilhões|mi|bi)?$", s)
    if not m: return None
    t = m.group(1)
    casas = len(t.split(",")[1]) if "," in t else 0
    v = float(t.replace(".", "").replace(",", "."))
    mult = {None: 1, "mil": 1e3, "milhão": 1e6, "milhões": 1e6, "bilhão": 1e9, "bilhões": 1e9, "mi": 1e6, "bi": 1e9}[m.group(2)]
    return v * mult, 10 ** (-casas) * mult

def chave_ptbr(x):
    """ordem de colação pt-BR aproximada (Intl.Collator): sem acento e sem caixa; desempate pelo texto acentuado"""
    return (unicodedata.normalize("NFD", x).encode("ascii", "ignore").decode().lower(), x)

def quartil(v, p):
    s = sorted(v); pos = (len(s) - 1) * p; lo = math.floor(pos); hi = math.ceil(pos)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)

def esperado(url):
    u = urlparse(url); q = {k: v[0] for k, v in parse_qs(u.query).items()}
    rota = u.path.rsplit("/", 1)[-1]
    med = q.get("med"); ind, tipo, por_etapa = MEDIDA[med]
    ano = int(q["ano"]) if "ano" in q else None
    if tipo == "ideb":
        ano = max([a for a in IDEB_ANOS if a <= ano])
    etapa = None
    if por_etapa:
        pedida = q.get("etapa", PADRAO_ETAPA)
        validas = ETAPAS_MED[med]
        etapa = pedida if (validas is None or pedida in validas) else (PADRAO_ETAPA if (validas and PADRAO_ETAPA in validas) else validas[0])
    if med in ("despesa", "despesa_hab", "despesa_mat"): comp = "real_2025" if q.get("moeda") == "real" else "nominal"
    elif med == "ideb": comp = "ideb"
    elif med == "saeb": comp = q.get("disc", "matematica")
    else: comp = None
    return ind, ano, etapa, comp, med

def conjunto(ind, ano, etapa, comp):
    inc, exc = {}, {}
    for cod in CAPS:
        o = OBS.get((ind, cod, ano, etapa, comp))
        if o is None: exc[cod] = ("sem registro", None); continue
        if o["status"] == "OBSERVADO" and o["valor"] is not None:
            if o["elegivel_comparacao"]: inc[cod] = o["valor"]
            else: exc[cod] = ("fora da comparação", o["valor"])
        else: exc[cod] = (o["status"], None)
    return inc, exc

linhas = []
def reg(url, item, exibido, recalc, res, obs=""):
    if exibido is None or recalc is None:
        ok = (exibido is None and recalc is None)
        linhas.append([url, item, exibido, recalc, "", "ok" if ok else "DIVERGE", obs]); return
    ev, er = exibido
    dif = abs(ev - recalc)
    tol = er / 2 + 1e-9 * max(1, abs(recalc))
    linhas.append([url, item, ev, recalc, dif, "ok" if dif <= tol else "DIVERGE", obs])

dados = json.load(open(ENTRADA))
for pg in dados:
    if pg.get("falha"): linhas.append([pg["url"], "carga", "", "", "", "FALHA", pg["falha"]]); continue
    url, t = pg["url"], pg["texto"]
    ind, ano, etapa, comp, med = esperado(url)
    inc, exc = conjunto(ind, ano, etapa, comp)
    vs = list(inc.values())
    # frase de amplitude
    m = re.search(r"vai de (.+?) em (.+?) a (.+?) em (.+?) entre as (\d+) capitais com dado comparável", t)
    m2 = re.search(r" é (.+?) nas (\d+) capitais com dado comparável", t)
    if not vs:
        reg(url, "frase sem dado", None if "Nenhuma capital tem dado comparável" in t else (0, 1), None, None)
        continue
    mn, mx = min(vs), max(vs)
    if m:
        a = num(m.group(1)); b = num(m.group(3))
        reg(url, "frase: mínimo", a, mn, None); reg(url, "frase: máximo", b, mx, None)
        nm = sorted((NOME[c] for c, v in inc.items() if v == mn), key=chave_ptbr); nx = sorted((NOME[c] for c, v in inc.items() if v == mx), key=chave_ptbr)
        reg(url, "frase: N capitais", (int(m.group(5)), 0.5), float(len(vs)), None)
        # nomes: até 2, "e mais N"
        def chk(txt, nomes):
            esp = nomes[0] if len(nomes) == 1 else f"{nomes[0]} e {nomes[1]}" if len(nomes) == 2 else f"{nomes[0]}, {nomes[1]} e mais {len(nomes)-2}"
            return txt == esp, esp
        for lab, txt, nomes in (("frase: capitais do mínimo", m.group(2), nm), ("frase: capitais do máximo", m.group(4), nx)):
            ok, esp = chk(txt, nomes)
            linhas.append([url, lab, txt, esp, "", "ok" if ok else "DIVERGE", ""])
    elif m2:
        reg(url, "frase: valor único", num(m2.group(1)), mn, None)
    else:
        linhas.append([url, "frase", "não reconhecida", "", "", "DIVERGE", t[t.find("vai de"):][:120]])
    # referências
    r = re.search(r"Mediana\n(.+?)\nMédia simples\n(.+?)\nMenor valor\n(.+?)\nMaior valor\n(.+?)\nCapitais na comparação\n(\d+) de (\d+)(?:\nMetade central\n(.+?))?\n", t)
    if r:
        reg(url, "ref: mediana", num(r.group(1)), statistics.median(vs), None)
        reg(url, "ref: média simples", num(r.group(2)), statistics.mean(vs), None)
        reg(url, "ref: menor valor", num(r.group(3).split(" · ")[0]), mn, None)
        reg(url, "ref: maior valor", num(r.group(4).split(" · ")[0]), mx, None)
        reg(url, "ref: capitais na comparação", (int(r.group(5)), 0.5), float(len(vs)), None)
        linhas.append([url, "ref: universo", int(r.group(6)), 26, "", "ok" if int(r.group(6)) == 26 else "DIVERGE", ""])
        if len(vs) >= 8:
            if r.group(7):
                q1, q3 = (num(x) for x in r.group(7).split(" a "))
                reg(url, "ref: 1º quartil", q1, quartil(vs, .25), None); reg(url, "ref: 3º quartil", q3, quartil(vs, .75), None)
            else: linhas.append([url, "ref: quartis", "ausente", "", "", "DIVERGE", "n>=8 sem faixa"])
        # razão agregada
        ra = re.search(r"Razão agregada (R\$ [\d\.,]+)", t)
        calc = [OBS[(ind, c, ano, etapa, comp)].get("calculo") for c in inc]
        if all(c and c.get("denominador") for c in calc) and calc:
            esp = sum(c["numerador"] for c in calc) / sum(c["denominador"] for c in calc)
            if ra: reg(url, "ref: razão agregada", num(ra.group(1)), esp, None)
            else: linhas.append([url, "ref: razão agregada", "ausente", esp, "", "DIVERGE", ""])
        elif ra: linhas.append([url, "ref: razão agregada", ra.group(1), "", "", "DIVERGE", "exibida sem numerador/denominador"])
    else:
        linhas.append([url, "ref: bloco", "não encontrado", "", "", "DIVERGE", ""])
    # tabela por capital
    tabs = pg.get("tabelas") or []
    tab = next((x for x in tabs if x and x[0] and x[0][0] == "Capital"), None)
    if tab:
        linhas_tab = {row[0]: row for row in tab[1:]}
        for cod in CAPS:
            n = NOME[cod]; row = linhas_tab.get(n)
            if row is None: linhas.append([url, f"tabela: {n}", "linha ausente", "", "", "DIVERGE", ""]); continue
            val = num(row[1]) if len(row) > 1 else None
            if cod in inc:
                reg(url, f"tabela: {n}", val, inc[cod], None, row[2] if len(row) > 2 else "")
                if len(row) > 2 and not row[2].startswith("Incluída"): linhas.append([url, f"tabela situação: {n}", row[2], "Incluída", "", "DIVERGE", ""])
            else:
                motivo, v = exc[cod]
                sit = row[2] if len(row) > 2 else ""
                if sit.startswith("Incluída"): linhas.append([url, f"tabela situação: {n}", sit, motivo, "", "DIVERGE", "excluída na gold mas incluída na tabela"])
                else: linhas.append([url, f"tabela situação: {n}", sit[:60], motivo, "", "ok", f"valor mostrado='{row[1]}'; gold={v}"])
    else:
        linhas.append([url, "tabela", "ausente", "", "", "DIVERGE", ""])

with open(SAIDA / "comparacao_navegador_gold.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh); w.writerow(["url", "item", "exibido", "recalculado", "diferenca", "resultado", "observacao"]); w.writerows(linhas)
tot = len(linhas); div = [l for l in linhas if l[5] != "ok"]
print("itens comparados:", tot, "páginas:", len(dados), "divergências:", len(div))
for l in div[:60]: print(l)
