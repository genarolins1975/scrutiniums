"""Transforma as avaliações independentes de uma unidade em uma lista de correções para o executor da família.

Entrada: uma ou mais pastas `saida/` de pacotes de avaliadores (<unidade>_produto.json e <unidade>_tecnico.json, formato da seção 9 de
RUBRICA.md) e o número da unidade. Saída: um arquivo Markdown com, por página, os bloqueios comprovados, cada critério abaixo da meta com as
notas, os problemas apontados pelo avaliador e o que ele atendeu, e os achados que se repetem entre páginas. Critério "nao_verificado" entra
como pendência de evidência, nunca como nota.

O arquivo não traz opinião do coordenador: é o relato dos avaliadores, na ordem em que o executor deve tratá-lo (bloqueios, depois os critérios
de menor nota). A reavaliação é feita por avaliadores novos; o executor não pontua o próprio trabalho.

Uso:
  python3 scripts/energia_correcoes_da_avaliacao.py --saida <pacote>/saida [--saida <outro>/saida] --unidade U03 \
      --destino docs/energia/redesign/avaliacao/rodada2 [--meta 9]
"""
import argparse
import glob
import json
import os

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


def carrega(pastas, unidade):
    out = {}
    for papel in ("produto", "tecnico"):
        for pasta in pastas:
            f = os.path.join(pasta, f"{unidade}_{papel}.json")
            if os.path.exists(f):
                try:
                    out[papel] = json.load(open(f, encoding="utf-8"))
                except json.JSONDecodeError:
                    out[papel] = None
                break
    return out


def nota_num(v):
    return v if isinstance(v, (int, float)) else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--saida", action="append", required=True)
    ap.add_argument("--unidade", required=True)
    ap.add_argument("--destino", required=True)
    ap.add_argument("--meta", type=float, default=9.0)
    a = ap.parse_args()
    dados = carrega(a.saida, a.unidade)
    if not dados:
        raise SystemExit(f"nenhuma avaliação de {a.unidade} em {a.saida}")
    paginas = {}
    for papel, d in dados.items():
        if not d:
            continue
        for rota, p in d.get("paginas", {}).items():
            reg = paginas.setdefault(rota, {"bloqueios": [], "criterios": {}, "avaliadores": set()})
            reg["avaliadores"].add(f"{papel}: {d.get('avaliador', '?')}")
            for b in p.get("bloqueios", []) or []:
                reg["bloqueios"].append((papel, b))
            for c, v in (p.get("criterios") or {}).items():
                reg["criterios"][c] = (papel, v)
    L = [f"# Correções pedidas pelas avaliações independentes: unidade {a.unidade}\n"]
    L.append(f"Fonte: {', '.join(sorted({papel for papel, d in dados.items() if d}))} em {', '.join(a.saida)}. Meta: nota igual ou superior a {a.meta:g} em cada critério, sem bloqueio.\n")
    resumo = []
    for rota, reg in paginas.items():
        abaixo = [(c, papel, v) for c, (papel, v) in sorted(reg["criterios"].items()) if nota_num(v.get("nota")) is None or nota_num(v.get("nota")) < a.meta]
        resumo.append((rota, len(abaixo), len(reg["bloqueios"])))
    L.append("| Página | Critérios abaixo da meta | Bloqueios |")
    L.append("| --- | --- | --- |")
    for rota, n, nb in resumo:
        L.append(f"| `{rota.replace('/setor-eletrico', '') or '/'}` | {n} | {nb} |")
    L.append("")
    for rota, reg in paginas.items():
        L.append(f"## `{rota.replace('/setor-eletrico', '') or '/'}`\n")
        if reg["bloqueios"]:
            L.append("### Bloqueios\n")
            for papel, b in reg["bloqueios"]:
                L.append(f"- ({papel}) {b if isinstance(b, str) else json.dumps(b, ensure_ascii=False)}")
            L.append("")
        abaixo = [(c, papel, v) for c, (papel, v) in sorted(reg["criterios"].items(), key=lambda kv: (nota_num(kv[1][1].get("nota")) if nota_num(kv[1][1].get("nota")) is not None else -1, kv[0]))
                  if nota_num(v.get("nota")) is None or nota_num(v.get("nota")) < a.meta]
        if not abaixo:
            L.append("Todos os critérios avaliados estão na meta.\n")
        for c, papel, v in abaixo:
            n = v.get("nota")
            L.append(f"### {c}, {NOMES.get(c, c)}: nota {n if n is not None else 'sem nota'} ({papel})\n")
            for pr in v.get("problemas", []) or []:
                L.append(f"- {pr}")
            if v.get("justificativa"):
                L.append(f"- Justificativa do avaliador: {v['justificativa']}")
            L.append("")
    achados = []
    for papel, d in dados.items():
        if d:
            achados.extend((papel, x) for x in d.get("achados_entre_paginas", []) or [])
    if achados:
        L.append("## Achados que se repetem entre páginas\n")
        for papel, x in achados:
            L.append(f"- ({papel}) {x if isinstance(x, str) else json.dumps(x, ensure_ascii=False)}")
        L.append("")
    lim = []
    for papel, d in dados.items():
        if d and d.get("limites_da_avaliacao"):
            lim.append(f"- ({papel}) {d['limites_da_avaliacao'] if isinstance(d['limites_da_avaliacao'], str) else json.dumps(d['limites_da_avaliacao'], ensure_ascii=False)}")
    if lim:
        L.append("## Limites declarados pelos avaliadores\n")
        L.extend(lim)
        L.append("")
    os.makedirs(a.destino, exist_ok=True)
    saida = os.path.join(a.destino, f"CORRECOES_{a.unidade}.md")
    open(saida, "w", encoding="utf-8").write("\n".join(L) + "\n")
    print(saida, f"{sum(n for _, n, _ in resumo)} critérios abaixo da meta em {len(resumo)} páginas")


if __name__ == "__main__":
    main()
