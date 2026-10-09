"""Junta as equivalências registradas pelos executores em docs/energia/redesign/pedidos/*.md num único equivalencias.json.

Cada pedido pode trazer, na seção de equivalências, um ou mais blocos ```json no formato aceito por scripts/energia_visoes_compara.py:
  {"<rota>": [{"antes": "<tipo>|<título anterior em minúsculas>", "depois": "<tipo>|<título novo em minúsculas>" | null, "justificativa": "..."}]}
Também entram os arquivos pedidos/*.equivalencias.json (mesmo formato, um por executor) e docs/energia/redesign/equivalencias_manuais.json (as que
o coordenador registra depois de conferir a comparação, com a justificativa). Blocos que não têm esse formato (exemplos de código, por exemplo) são
ignorados e listados no resumo. Entradas repetidas (mesma rota, mesmo antes e mesmo depois) são mantidas uma só vez.

Uso: python3 scripts/energia_equivalencias_dos_pedidos.py [--saida docs/energia/redesign/equivalencias.json]
"""
import argparse
import glob
import json
import os
import re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PEDIDOS = os.path.join(RAIZ, "docs", "energia", "redesign", "pedidos")
MANUAIS = os.path.join(RAIZ, "docs", "energia", "redesign", "equivalencias_manuais.json")


def blocos_json(texto):
    return re.findall(r"```json\s*\n(.*?)\n```", texto, flags=re.S)


def formato_valido(d):
    if not isinstance(d, dict) or not d:
        return False
    for rota, itens in d.items():
        if not isinstance(rota, str) or not rota.startswith("/") or not isinstance(itens, list):
            return False
        for it in itens:
            if not isinstance(it, dict) or "antes" not in it or "justificativa" not in it:
                return False
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--saida", default=os.path.join(RAIZ, "docs", "energia", "redesign", "equivalencias.json"))
    a = ap.parse_args()
    juntas, ignorados, por_arquivo = {}, [], {}

    def juntar(nome, d):
        n = 0
        for rota, itens in d.items():
            destino = juntas.setdefault(rota, [])
            for it in itens:
                if not any(x["antes"] == it["antes"] and x.get("depois") == it.get("depois") for x in destino):
                    destino.append(it)
                    n += 1
        por_arquivo[nome] = por_arquivo.get(nome, 0) + n

    for arq in sorted(glob.glob(os.path.join(PEDIDOS, "*.md"))):
        nome = os.path.basename(arq)
        for b in blocos_json(open(arq, encoding="utf-8").read()):
            try:
                d = json.loads(b)
            except json.JSONDecodeError:
                ignorados.append((nome, "JSON inválido"))
                continue
            if not formato_valido(d):
                ignorados.append((nome, "formato diferente"))
                continue
            juntar(nome, d)
    for arq in sorted(glob.glob(os.path.join(PEDIDOS, "*.equivalencias.json"))) + [MANUAIS]:
        if not os.path.exists(arq):
            continue
        nome = os.path.basename(arq)
        try:
            d = json.load(open(arq, encoding="utf-8"))
        except json.JSONDecodeError:
            ignorados.append((nome, "JSON inválido"))
            continue
        if not formato_valido(d):
            ignorados.append((nome, "formato diferente"))
            continue
        juntar(nome, d)
    with open(a.saida, "w", encoding="utf-8") as f:
        json.dump(juntas, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")
    print(f"{sum(len(v) for v in juntas.values())} equivalências em {len(juntas)} rotas gravadas em {a.saida}")
    for k, v in por_arquivo.items():
        print(f"  {k}: {v}")
    for nome, motivo in ignorados:
        print(f"  ignorado em {nome}: {motivo}")


if __name__ == "__main__":
    main()
