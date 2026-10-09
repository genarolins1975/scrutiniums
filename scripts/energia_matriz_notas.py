"""Consolida as avaliações independentes (produto e técnico) na matriz de notas por painel e critério.

Entrada: a pasta `saida/` de um pacote de avaliadores, com <unidade>_produto.json e <unidade>_tecnico.json (formato da seção 9 de RUBRICA.md).
Saída (--destino): matriz_<rodada>.json (tudo, para o comparador e para a rodada seguinte) e MATRIZ_<RODADA>.md (matriz legível: uma linha
por página, uma coluna por critério A a L, os bloqueios e os achados mais graves).

Regras de leitura:
  - a página só está aprovada se todos os doze critérios têm nota igual ou superior a 9 e não há bloqueio;
  - "nao_verificado" nunca vira número e conta como critério abaixo da meta;
  - critério sem avaliador (arquivo ausente ou JSON inválido) também fica "nao_verificado".

Uso:
  python3 scripts/energia_matriz_notas.py --saida <pacote>/saida --rodada inicial --destino docs/energia/redesign/avaliacao
"""
import argparse
import glob
import json
import os
import re

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
PAPEL = {c: ("produto" if c in "ABCDIJK" else "tecnico") for c in CRITERIOS}


def nota(x):
    if isinstance(x, (int, float)):
        return float(x)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--saida", required=True)
    ap.add_argument("--rodada", required=True)
    ap.add_argument("--destino", required=True)
    a = ap.parse_args()
    paginas = {}
    avaliadores = {}
    invalidos = []
    for f in sorted(glob.glob(os.path.join(a.saida, "*.json"))):
        try:
            d = json.load(open(f, encoding="utf-8"))
        except Exception as e:  # noqa: BLE001
            invalidos.append((os.path.basename(f), str(e)[:80]))
            continue
        papel = d.get("papel") or ("produto" if "produto" in f else "tecnico")
        avaliadores[os.path.basename(f)] = {"avaliador": d.get("avaliador"), "papel": papel, "limites": d.get("limites_da_avaliacao"), "entre_paginas": d.get("achados_entre_paginas", [])}
        for rota, p in (d.get("paginas") or {}).items():
            reg = paginas.setdefault(rota, {"paineis": [], "criterios": {}, "bloqueios": [], "achados": [], "nao_verificado": [], "tarefas": []})
            for pid in p.get("paineis", []) or []:
                if pid not in reg["paineis"]:
                    reg["paineis"].append(pid)
            for c, v in (p.get("criterios") or {}).items():
                if c in CRITERIOS and PAPEL[c] == papel:
                    reg["criterios"][c] = {**v, "avaliador": d.get("avaliador"), "papel": papel}
            for b in p.get("bloqueios", []) or []:
                reg["bloqueios"].append({**b, "papel": papel})
            for x in p.get("achados", []) or []:
                reg["achados"].append({**x, "papel": papel})
            reg["nao_verificado"] += p.get("nao_verificado", []) or []
            reg["tarefas"] += p.get("tarefas_inspecionadas", []) or []
    resumo = {}
    for rota, reg in paginas.items():
        notas = {c: nota(reg["criterios"].get(c, {}).get("nota")) for c in CRITERIOS}
        abaixo = [c for c in CRITERIOS if notas[c] is None or notas[c] < 9]
        resumo[rota] = {"notas": notas, "abaixo_de_9": abaixo, "bloqueios": len(reg["bloqueios"]), "aprovada": not abaixo and not reg["bloqueios"]}
    os.makedirs(a.destino, exist_ok=True)
    json.dump({"rodada": a.rodada, "avaliadores": avaliadores, "invalidos": invalidos, "paginas": paginas, "resumo": resumo}, open(os.path.join(a.destino, f"matriz_{a.rodada}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    L = [f"# Matriz de notas, rodada {a.rodada}\n"]
    n = len(resumo)
    aprov = sum(1 for r in resumo.values() if r["aprovada"])
    bloq = sum(r["bloqueios"] for r in resumo.values())
    L.append(f"**{aprov} de {n} páginas aprovadas** (nota igual ou superior a 9 em todos os doze critérios e nenhum bloqueio). **{bloq} bloqueios** registrados. Notas de 0 a 10; `nv` é não verificado, e não conta como nota.\n")
    if invalidos:
        L.append("Arquivos de avaliação inválidos: " + "; ".join(f"{n}: {e}" for n, e in invalidos) + "\n")
    # média por critério (só das notas numéricas) e quantas abaixo de 9
    L.append("## Por critério\n")
    L.append("| Critério | Avaliador | Páginas com nota | Média | Mínima | Abaixo de 9 | Não verificadas |")
    L.append("| --- | --- | ---: | ---: | ---: | ---: | ---: |")
    for c in CRITERIOS:
        vs = [r["notas"][c] for r in resumo.values() if r["notas"][c] is not None]
        nv = sum(1 for r in resumo.values() if r["notas"][c] is None)
        ab = sum(1 for r in resumo.values() if r["notas"][c] is not None and r["notas"][c] < 9)
        L.append(f"| {c} {NOMES[c]} | {PAPEL[c]} | {len(vs)} | {sum(vs) / len(vs):.1f} | {min(vs):.1f} | {ab} | {nv} |" if vs else f"| {c} {NOMES[c]} | {PAPEL[c]} | 0 | | | | {nv} |")
    L.append("\n## Por página\n")
    L.append("| Página | Painéis | " + " | ".join(CRITERIOS) + " | Bloqueios | Aprovada |")
    L.append("| --- | --- | " + " | ".join("---:" for _ in CRITERIOS) + " | ---: | --- |")
    for rota in sorted(resumo, key=lambda r: (r != "/setor-eletrico", r)):
        s = resumo[rota]
        cel = []
        for c in CRITERIOS:
            v = s["notas"][c]
            cel.append("nv" if v is None else (f"**{v:g}**" if v < 9 else f"{v:g}"))
        L.append(f"| `{rota.replace('/setor-eletrico', '') or '/'}` | {', '.join(paginas[rota]['paineis'])} | " + " | ".join(cel) + f" | {s['bloqueios']} | {'sim' if s['aprovada'] else 'não'} |")
    L.append("\nNota em negrito está abaixo da meta de 9.\n")
    L.append("## Bloqueios\n")
    tem = False
    for rota in sorted(paginas):
        for b in paginas[rota]["bloqueios"]:
            tem = True
            L.append(f"- `{rota.replace('/setor-eletrico', '') or '/'}` ({b.get('papel')}), {b.get('tipo')}: {b.get('descricao')} Evidência: {b.get('evidencia')}")
    if not tem:
        L.append("Nenhum bloqueio registrado pelos avaliadores.")
    L.append("\n## Achados de gravidade alta\n")
    tem = False
    for rota in sorted(paginas):
        for x in paginas[rota]["achados"]:
            if str(x.get("gravidade", "")).lower().startswith("alta"):
                tem = True
                L.append(f"- `{rota.replace('/setor-eletrico', '') or '/'}` ({x.get('papel')}, critérios {', '.join(x.get('criterios', []))}): {x.get('descricao')} Onde: {x.get('onde')}. Sugestão: {x.get('sugestao')}")
    if not tem:
        L.append("Nenhum achado de gravidade alta.")
    L.append("\n## Limites declarados pelos avaliadores\n")
    for arq, v in avaliadores.items():
        L.append(f"- {arq} ({v['avaliador']}): {v['limites']}")
    open(os.path.join(a.destino, f"MATRIZ_{a.rodada.upper()}.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
    print(f"{n} páginas; {aprov} aprovadas; {bloq} bloqueios; {len(invalidos)} arquivos inválidos")


if __name__ == "__main__":
    main()
