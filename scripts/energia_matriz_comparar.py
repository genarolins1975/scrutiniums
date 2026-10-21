"""Compara duas matrizes de notas (linha de base e versão nova) nas páginas avaliadas nas duas.

Entrada: matriz_<rodada>.json de energia_matriz_notas.py. Saída: um Markdown com, por critério, a média e a mínima antes e depois, quantas páginas
ficam abaixo de 9 e a variação página a página. Só entram páginas com nota numérica nas duas rodadas naquele critério: nota "nao_verificado"
nunca vira número, e página avaliada só em uma das rodadas aparece como cobertura, não como comparação.

Uso:
  python3 scripts/energia_matriz_comparar.py --antes docs/energia/redesign/avaliacao/matriz_inicial.json \
      --depois docs/energia/redesign/avaliacao/matriz_r2.json --saida docs/energia/redesign/avaliacao/COMPARACAO_ANTES_DEPOIS.md
"""
import argparse
import json

CRITERIOS = list("ABCDEFGHIJKL")
NOMES = {
    "A": "Layout e hierarquia",
    "B": "Didática",
    "C": "Utilidade",
    "D": "Impacto social",
    "E": "Profundidade",
    "F": "Benchmarks e comparabilidade",
    "G": "Rigor setorial",
    "H": "Rastreabilidade",
    "I": "Visualizações",
    "J": "Navegação e interação",
    "K": "Acessibilidade e responsividade",
    "L": "Confiabilidade técnica",
}


def num(x):
    return x if isinstance(x, (int, float)) else None


def fmt(x):
    return "nv" if x is None else (f"{x:.1f}".replace(".", ",") if x != int(x) else f"{int(x)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--antes", required=True)
    ap.add_argument("--depois", required=True)
    ap.add_argument("--saida", required=True)
    a = ap.parse_args()
    antes = json.load(open(a.antes, encoding="utf-8"))["resumo"]
    depois = json.load(open(a.depois, encoding="utf-8"))["resumo"]
    comuns = sorted(set(antes) & set(depois))
    so_antes = sorted(set(antes) - set(depois))
    so_depois = sorted(set(depois) - set(antes))
    L = ["# Notas antes e depois, nas páginas avaliadas nas duas rodadas\n"]
    L.append(
        "Antes: avaliação independente da versão anterior ao redesenho. Depois: avaliação independente da versão nova no commit indicado em cada "
        "unidade (as correções feitas depois dessas avaliações não foram repontuadas: o executor não pontua o próprio trabalho). "
        "Notas de 0 a 10; `nv` é não verificado e não entra em média.\n"
    )
    L.append(f"Páginas nas duas rodadas: {len(comuns)}. Só na linha de base: {len(so_antes)}. Só na versão nova: {len(so_depois)}.\n")
    L.append("## Por critério\n")
    L.append("| Critério | Páginas comparáveis | Média antes | Média depois | Mínima antes | Mínima depois | Abaixo de 9 antes | Abaixo de 9 depois | Páginas que subiram | Iguais | Que caíram |")
    L.append("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")
    for c in CRITERIOS:
        pares = [(num(antes[p]["notas"].get(c)), num(depois[p]["notas"].get(c))) for p in comuns]
        pares = [(x, y) for x, y in pares if x is not None and y is not None]
        if not pares:
            L.append(f"| {c} {NOMES[c]} | 0 | nv | nv | nv | nv | nv | nv | nv | nv | nv |")
            continue
        ma = sum(x for x, _ in pares) / len(pares)
        md = sum(y for _, y in pares) / len(pares)
        sobe = sum(1 for x, y in pares if y > x)
        igual = sum(1 for x, y in pares if y == x)
        cai = sum(1 for x, y in pares if y < x)
        L.append(
            f"| {c} {NOMES[c]} | {len(pares)} | {fmt(round(ma, 2))} | {fmt(round(md, 2))} | {fmt(min(x for x, _ in pares))} | {fmt(min(y for _, y in pares))} | "
            f"{sum(1 for x, _ in pares if x < 9)} | {sum(1 for _, y in pares if y < 9)} | {sobe} | {igual} | {cai} |"
        )
    L.append("\n## Por página\n")
    L.append("Cada célula é `antes → depois`.\n")
    L.append("| Página | " + " | ".join(CRITERIOS) + " | Bloqueios antes → depois |")
    L.append("| --- | " + " | ".join(["---:"] * len(CRITERIOS)) + " | ---: |")
    for p in comuns:
        cel = []
        for c in CRITERIOS:
            x, y = num(antes[p]["notas"].get(c)), num(depois[p]["notas"].get(c))
            cel.append(f"{fmt(x)} → {fmt(y)}")
        L.append(f"| `{p.replace('/setor-eletrico', '') or '/'}` | " + " | ".join(cel) + f" | {antes[p]['bloqueios']} → {depois[p]['bloqueios']} |")
    if so_antes:
        L.append("\n## Avaliadas só na linha de base\n")
        L.append(", ".join(f"`{p.replace('/setor-eletrico', '') or '/'}`" for p in so_antes) + ".")
    if so_depois:
        L.append("\n## Avaliadas só na versão nova\n")
        L.append(", ".join(f"`{p.replace('/setor-eletrico', '') or '/'}`" for p in so_depois) + ".")
    open(a.saida, "w", encoding="utf-8").write("\n".join(L) + "\n")
    print(a.saida, f"{len(comuns)} páginas comparáveis")


if __name__ == "__main__":
    main()
