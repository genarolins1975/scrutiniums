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

SUITES = ("vitest", "pipeline", "pesquisa", "build")

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
    if cods.get("build"):
        itens.append(f"- build da candidata falhou (código {cods['build']}); HTML não validado, publicação retida. Ver build-testes.log.")
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


def publicacao(caminho):
    """Relatório auditável da seleção; não atribui infra a reprovação de dado."""
    r = json.loads(Path(caminho).read_text(encoding="utf-8"))
    print("## Publicação por grupo\n")
    if r.get("inconclusivo"):
        print("**Infraestrutura: execução inconclusiva após uma repetição. Nada publicado.**\n")
    print("### Grupos retidos\n")
    for g, motivos in sorted(r.get("retidos", {}).items()):
        data = r.get("datas_anteriores", {}).get(g) or "data não informada"
        print(f"- **{g}** — última geração publicada: {data}")
        for m in sorted(set(motivos)):
            print(f"  - {m}")
    if not r.get("retidos"):
        print("Nenhum.\n")
    confirmado = r.get("publicacao_remota_confirmada") is not False
    print("\n### Grupos publicados\n" if confirmado else "\n### Grupos aprovados — publicação remota não confirmada\n")
    if not confirmado:
        print("O push falhou ou não foi concluído; consulte o passo Commit e push. As datas abaixo são as gerações aprovadas, sem confirmação de publicação remota.\n")
    for g in r.get("publicados", []):
        print(f"- **{g}** — geração: {r['datas_publicadas'].get(g) or 'data não informada'}")
    if not r.get("publicados"):
        print("Nenhum.\n")
    print("\n### Execução das suítes\n")
    for rodada, suites in enumerate(r.get("execucoes", [])):
        for nome, suite in suites.items():
            print(f"- Rodada {rodada}, {nome}: saída {suite['codigo']}; {len(suite['tentativas'])} tentativa(s)")
            for tentativa in suite['tentativas']:
                if tentativa.get("inconclusivo"):
                    print(f"\nInfraestrutura: {tentativa['motivo']}\n\n```text\n{tentativa['trecho_log']}\n```\n")
                for arquivo, resultado in tentativa.get('resultados', {}).items():
                    if resultado['estado'] == 'failed':
                        print(f"  - `{arquivo}`: {resultado.get('detalhe', '')[:1600]}")
    for preparo in r.get("preparo", []):
        for tentativa in preparo['tentativas']:
            if tentativa.get('inconclusivo'):
                print(f"\nInfraestrutura no preparo: {tentativa['motivo']}\n\n```text\n{tentativa['trecho_log']}\n```\n")
    print("\n### Falhas de testes sem leitura de gold (não decidem aprovação de grupo)\n")
    for nome, resultado in r.get("falhas_sem_gold", {}).items():
        print(f"- `{nome}`: {resultado.get('detalhe', '')[:1000]}")
    print("\nMapa de proteção, resultados individuais e logs de todas as tentativas: artefato `gold-publicacao` desta execução.")
    return 0


def suite_legada(nome, pasta=".gold-publicacao"):
    """Mantém códigos e logs usados pelo relatório anterior, sem simular sucesso."""
    pasta = Path(pasta)
    if nome == 'vitest':
        Path('vitest-resultado.json').unlink(missing_ok=True)
    r = json.loads((pasta / 'resultado.json').read_text())
    rodadas = r.get('execucoes', [])
    if not rodadas:
        print('Infraestrutura: suíte não executada; ver preparo em resultado.json')
        return 2
    if nome not in rodadas[-1]:
        print('Suíte não executada: build da candidata incompleto; ver resultado.json')
        return 2
    s = rodadas[-1][nome]
    rodada = pasta / f'rodada-{len(rodadas)-1}'
    tentativa = len(s['tentativas'])
    print(_ler(rodada / f'{nome}-{tentativa}.log'))
    if nome == 'vitest':
        relatorio = rodada / f'{nome}-{tentativa}.json'
        Path('vitest-resultado.json').unlink(missing_ok=True)
        if relatorio.exists():
            Path('vitest-resultado.json').write_bytes(relatorio.read_bytes())
    return s['codigo']


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == '--publicacao':
        sys.exit(publicacao(sys.argv[2]))
    if len(sys.argv) > 1 and sys.argv[1] == '--suite':
        sys.exit(suite_legada(sys.argv[2]))
    sys.exit(main(*(sys.argv[1:] or ["vitest-resultado.json"])))
