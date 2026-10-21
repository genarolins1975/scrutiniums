"""Compara duas coletas objetivas (scripts/energia-avaliacao.mjs, relatorio.json) do observatório de energia, rota a rota.

Entrada: relatorio.json da linha de base (antes) e do estado avaliado (depois), as mesmas rotas, larguras e modos.
Saída em Markdown (stdout ou --saida): por rota, em Entender, altura da página a 1440 e a 390 px, HTML e JavaScript em kB, tempo de carga em
laboratório, violações do axe, alvos de toque abaixo de 44 px, erros de console e rolagem horizontal; e a contagem de rotas com problema antes e depois.
A medição é de laboratório (um navegador, uma máquina, servidor local de produção): não representa a experiência de quem usa o site.

Uso:
  python3 scripts/energia_objetivo_compara.py --antes <antes>/relatorio.json --depois <depois>/relatorio.json [--saida arquivo.md] [--rotas rotas.txt]
"""
import argparse
import json
import statistics


def indexa(rel):
    d = {}
    for r in rel["rotas"]:
        for m in r.get("medicoes", []):
            d[(r["rota"], m["largura"], m["modo"])] = m
    return d


def kb(x):
    return None if x is None else x / 1000


def fmt(x, casas=0):
    if x is None:
        return "n/d"
    return f"{x:,.{casas}f}".replace(",", ".")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--antes", required=True)
    ap.add_argument("--depois", required=True)
    ap.add_argument("--saida")
    ap.add_argument("--rotas")
    a = ap.parse_args()
    antes, depois = json.load(open(a.antes, encoding="utf-8")), json.load(open(a.depois, encoding="utf-8"))
    ia, id_ = indexa(antes), indexa(depois)
    rotas = sorted({k[0] for k in id_})
    if a.rotas:
        pedidas = [l.strip() for l in open(a.rotas, encoding="utf-8") if l.strip()]
        rotas = [r for r in pedidas if r in rotas]
    L = []
    L.append("| Rota | Altura 1440 (px) | Altura 390 (px) | HTML (kB) | JavaScript (kB) | Carga (ms) | axe | Alvos < 44 px (390) | Erros de console | Rolagem horizontal |")
    L.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
    agg = {"axe_a": 0, "axe_d": 0, "rolagem_a": 0, "rolagem_d": 0, "erros_a": 0, "erros_d": 0, "html_a": [], "html_d": [], "js_a": [], "js_d": [], "carga_a": [], "carga_d": []}

    def par(m_a, m_d, f, casas=0):
        va = f(m_a) if m_a else None
        vd = f(m_d) if m_d else None
        return f"{fmt(va, casas)} → {fmt(vd, casas)}"

    for r in rotas:
        linha = [r.replace("/setor-eletrico", "") or "/"]
        for larg in (1440, 390):
            linha.append(par(ia.get((r, larg, "entender")), id_.get((r, larg, "entender")), lambda m: m.get("altura")))
        m_a, m_d = ia.get((r, 1440, "entender")), id_.get((r, 1440, "entender"))
        linha.append(par(m_a, m_d, lambda m: kb(m["bytes"]["html"]) if m else None))
        linha.append(par(m_a, m_d, lambda m: kb(m["bytes"]["js"]) if m else None))
        linha.append(par(m_a, m_d, lambda m: m.get("carga_ms")))
        # axe, alvos, erros e rolagem: somados nas quatro larguras e nos dois modos medidos
        def soma(idx, f):
            vs = [f(m) for (rr, _, _), m in idx.items() if rr == r]
            return sum(vs) if vs else None
        axe_a, axe_d = soma(ia, lambda m: len(m.get("axe", []))), soma(id_, lambda m: len(m.get("axe", [])))
        linha.append(f"{fmt(axe_a)} → {fmt(axe_d)}")
        m3a, m3d = ia.get((r, 390, "entender")), id_.get((r, 390, "entender"))
        linha.append(par(m3a, m3d, lambda m: m["alvos"]["menores_44"] if m else None))
        er_a, er_d = soma(ia, lambda m: len(m.get("erros_console", []))), soma(id_, lambda m: len(m.get("erros_console", [])))
        linha.append(f"{fmt(er_a)} → {fmt(er_d)}")
        ro_a = soma(ia, lambda m: 1 if m.get("rolagem_horizontal") else 0)
        ro_d = soma(id_, lambda m: 1 if m.get("rolagem_horizontal") else 0)
        linha.append(f"{fmt(ro_a)} → {fmt(ro_d)}")
        L.append("| " + " | ".join(linha) + " |")
        agg["axe_a"] += axe_a or 0
        agg["axe_d"] += axe_d or 0
        agg["rolagem_a"] += ro_a or 0
        agg["rolagem_d"] += ro_d or 0
        agg["erros_a"] += er_a or 0
        agg["erros_d"] += er_d or 0
        for k, m in (("a", m_a), ("d", m_d)):
            if m:
                agg[f"html_{k}"].append(kb(m["bytes"]["html"]))
                agg[f"js_{k}"].append(kb(m["bytes"]["js"]))
                agg[f"carga_{k}"].append(m.get("carga_ms"))

    def med(xs):
        return statistics.median(xs) if xs else None

    resumo = [
        f"Rotas comparadas: {len(rotas)}. Medições: antes {antes.get('gerado_em', 'n/d')}, depois {depois.get('gerado_em', 'n/d')}.",
        f"Violações do axe somadas (todas as larguras e modos): {agg['axe_a']} → {agg['axe_d']}.",
        f"Medições com rolagem horizontal: {agg['rolagem_a']} → {agg['rolagem_d']}. Erros de console: {agg['erros_a']} → {agg['erros_d']}.",
        f"HTML, mediana por rota (kB): {fmt(med(agg['html_a']))} → {fmt(med(agg['html_d']))}; maior: {fmt(max(agg['html_a'] or [0]))} → {fmt(max(agg['html_d'] or [0]))}. "
        f"Rotas com HTML acima de 600 kB: {sum(1 for x in agg['html_a'] if x > 600)} → {sum(1 for x in agg['html_d'] if x > 600)}.",
        f"JavaScript, mediana por rota (kB): {fmt(med(agg['js_a']))} → {fmt(med(agg['js_d']))}. Tempo de carga de laboratório, mediana (ms): {fmt(med(agg['carga_a']))} → {fmt(med(agg['carga_d']))}.",
    ]
    texto = "\n".join(resumo) + "\n\n" + "\n".join(L) + "\n"
    if a.saida:
        open(a.saida, "w", encoding="utf-8").write(texto)
    else:
        print(texto)


if __name__ == "__main__":
    main()
