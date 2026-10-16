"""Lista em Markdown o que reprovou nos testes de conteúdo da gold do dia.

Uso: python3 scripts/testes_reprovados.py vitest-resultado.json [testes-codigos.txt [log.txt ...]]

Alimenta a issue "Testes de conteúdo reprovaram a gold do dia". De 25/09 a
12/10/2026 a issue recebeu 17 comentários "Nova ocorrência" com um link e nada
mais, enquanto a causa mudou quatro vezes (DataJud, Ipeadata, SICOR, OBEE): quem
lia a issue não tinha como saber que o problema de ontem não era o de hoje.

Em 16/10/2026 a issue disse "a reprovação veio das suítes Python" quando as duas
suítes Python tinham passado (códigos pipeline=0 pesquisa=0) e quem falhou foi o
processo do vitest, abortado com código 134 por falta de memória, sem reprovar teste
algum. O segundo argumento traz os códigos de saída das três suítes ("vitest=134
pipeline=0 pesquisa=0"), e os demais trazem a saída do unittest para listar os testes
Python reprovados. Sem eles, a mensagem não atribui a causa a ninguém.
"""
import json
import re
import sys
from pathlib import Path

LIMITE = 30

SUITES = ("vitest", "pipeline", "pesquisa")

# códigos de saída que costumam ter causa conhecida (128 + sinal)
SIGNIFICADO = {
    134: "abortado (SIGABRT), em geral falta de memória do Node",
    137: "encerrado à força (SIGKILL), em geral falta de memória da máquina",
    139: "falha de segmentação (SIGSEGV)",
    143: "encerrado por SIGTERM, em geral por tempo limite",
}

REPROVOU_PY = re.compile(r"^(FAIL|ERROR): (.+)$")


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


def codigos(texto):
    """'vitest=134 pipeline=0 pesquisa=0' -> {'vitest': 134, 'pipeline': 0, 'pesquisa': 0}."""
    return {k: int(v) for k, v in re.findall(r"(\w+)=(\d+)", texto or "") if k in SUITES}


def testes_python_reprovados(texto):
    """Linhas 'FAIL: ...' e 'ERROR: ...' da saída do unittest, sem repetição."""
    vistos, itens = set(), []
    for linha in (texto or "").splitlines():
        m = REPROVOU_PY.match(linha.strip())
        if m and linha not in vistos:
            vistos.add(linha)
            itens.append(f"`{m.group(1)}: {m.group(2)[:160]}`")
    return itens


def _ler(caminho):
    try:
        return Path(caminho).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def main(caminho, arq_codigos=None, *logs):
    try:
        relatorio = json.loads(Path(caminho).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        relatorio = None
    cods = codigos(_ler(arq_codigos)) if arq_codigos else {}

    itens = reprovados(relatorio) if relatorio is not None else []
    # o processo do vitest pode falhar sem reprovar teste: falta de memória, erro no setup
    v = cods.get("vitest")
    if not itens and v:
        motivo = SIGNIFICADO.get(v, "falha ao carregar ou configurar a suíte")
        itens.append(f"- o processo do vitest terminou com código {v} sem reprovar nenhum teste ({motivo}): "
                     "falha do ambiente de teste, não do conteúdo da gold; ver o log do passo *Testes de conteúdo*")
    python = []
    for rotulo in ("pipeline", "pesquisa"):
        c = cods.get(rotulo)
        if c:
            python.append(f"- suíte Python `{rotulo}` reprovou (código {c})")
    if python:
        # o limite de linhas é aplicado uma só vez, no fim, para que "e mais N" conte
        # todas as omitidas: truncar aqui e de novo na saída subconta as falhas
        itens.extend(python)
        itens.extend(f"  - {t}" for t in testes_python_reprovados("\n".join(_ler(p) for p in logs)))

    if not itens:
        if relatorio is None:
            print("- relatório do vitest ausente ou ilegível: ver o log do passo *Testes de conteúdo*")
        elif cods:
            print("- os códigos de saída das suítes são todos zero: a reprovação não veio dos testes (ver o log do passo)")
        else:
            print("- nenhum teste do vitest reprovado e sem códigos de saída para atribuir a causa: ver o log do passo")
        return 0
    for linha in itens[:LIMITE]:
        print(linha)
    if len(itens) > LIMITE:
        print(f"- e mais {len(itens) - LIMITE} (ver o log)")
    return 0


if __name__ == "__main__":
    sys.exit(main(*(sys.argv[1:] or ["vitest-resultado.json"])))
