"""Lista em Markdown os testes reprovados de um relatório JSON do vitest.

Uso: python3 scripts/testes_reprovados.py vitest-resultado.json

Alimenta a issue "Testes de conteúdo reprovaram a gold do dia". De 25/09 a
12/10/2026 a issue recebeu 17 comentários "Nova ocorrência" com um link e nada
mais, enquanto a causa mudou quatro vezes (DataJud, Ipeadata, SICOR, OBEE): quem
lia a issue não tinha como saber que o problema de ontem não era o de hoje.
"""
import json
import sys
from pathlib import Path

LIMITE = 30


def _primeira_linha(msgs):
    for m in msgs or []:
        for linha in str(m).splitlines():
            linha = linha.strip()
            if linha:
                return linha[:200]
    return "sem mensagem"


def reprovados(relatorio):
    raiz = Path.cwd()
    itens = []
    for arq in relatorio.get("testResults") or []:
        nome = str(arq.get("name", ""))
        try:
            nome = str(Path(nome).resolve().relative_to(raiz))
        except ValueError:
            pass
        falhas = [a for a in arq.get("assertionResults") or [] if a.get("status") == "failed"]
        for a in falhas:
            titulo = a.get("fullName") or a.get("title") or "?"
            itens.append(f"- `{nome}` > {titulo}: {_primeira_linha(a.get('failureMessages'))}")
        if arq.get("status") == "failed" and not falhas:
            # a suíte nem carregou (ex.: ENOENT na leitura do arquivo no topo)
            itens.append(f"- `{nome}` (falhou ao carregar): {_primeira_linha([arq.get('message')])}")
    return itens


def main(caminho):
    try:
        relatorio = json.loads(Path(caminho).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        print("- relatório do vitest ausente ou ilegível: ver o log do passo *Testes de conteúdo*")
        return 0
    itens = reprovados(relatorio)
    if not itens:
        print("- nenhum teste do vitest reprovado: a reprovação veio das suítes Python (ver o log)")
        return 0
    for linha in itens[:LIMITE]:
        print(linha)
    if len(itens) > LIMITE:
        print(f"- e mais {len(itens) - LIMITE} (ver o log)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "vitest-resultado.json"))
