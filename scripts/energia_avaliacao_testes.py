"""Roda os testes do repositório e registra, por arquivo, quantos passam e quantos falham, para a
avaliação dos painéis (P071) usar como evidência de correção e de manutenção.

Escreve docs/observatorios/energia/avaliacao/testes.json. Não decide nada sozinho: falha
registrada derruba o teto de correção do módulo na rubrica, e o resumo diz o que passou e o que não.

Uso: python3 scripts/energia_avaliacao_testes.py [--sem-build] [--build-ok "texto"]
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from collections import Counter, defaultdict
from datetime import datetime, timezone

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, "docs", "observatorios", "energia", "avaliacao", "testes.json")
sys.path.insert(0, os.path.join(RAIZ, "scripts"))
from energia_avaliacao import MODULOS  # noqa: E402


def roda(cmd, **kw):
    return subprocess.run(cmd, cwd=RAIZ, capture_output=True, text=True, **kw)


def vitest():
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        caminho = f.name
    r = roda(["npx", "vitest", "run", "--reporter=json", f"--outputFile={caminho}"])
    dados = json.load(open(caminho, encoding="utf-8"))
    os.unlink(caminho)
    por = {}
    falhas = []
    for t in dados["testResults"]:
        nome = os.path.basename(t["name"]).replace(".test.ts", "")
        ar = t["assertionResults"]
        f = [a for a in ar if a["status"] == "failed"]
        por[nome] = {"total": len(ar), "falhas": len(f)}
        falhas += [f"{nome}: {a['fullName']}" for a in f]
        if t["status"] == "failed" and not f:
            por[nome]["falhas"] = max(1, por[nome]["falhas"])
            falhas.append(f"{nome}: arquivo falhou ao carregar")
    return por, falhas, {"arquivos": len(por), "total": sum(v["total"] for v in por.values()), "falhas": sum(v["falhas"] for v in por.values())}


def python():
    r = roda([sys.executable, "-m", "unittest", "discover", "-s", "pipeline/tests", "-t", ".", "-v"])
    por = defaultdict(Counter)
    nomes_falha = defaultdict(int)
    falhas = []
    cabecalho = re.compile(r"^(test\w*) \((pipeline\.tests\.(\w+)\.[\w.]+)\)(.*)$")
    resultado = re.compile(r"\.\.\. (ok|FAIL|ERROR|skipped.*)$")
    linhas = (r.stderr + r.stdout).splitlines()
    for i, linha in enumerate(linhas):
        m = cabecalho.match(linha)
        if not m:
            continue
        nome, _, modulo, resto = m.groups()
        # teste com docstring: o resultado vem na linha seguinte (ou depois de saída impressa pelo teste)
        res = resultado.search(resto)
        k = i + 1
        while not res and k < min(i + 8, len(linhas)) and not cabecalho.match(linhas[k]):
            res = resultado.search(linhas[k])
            k += 1
        if not res:
            continue
        res = res.group(1).split()[0]
        por[modulo][res] += 1
        if res in ("FAIL", "ERROR"):
            falhas.append(f"{modulo}: {nome}")
        if re.search(r"falha|recupera|revis|parcial", nome):
            nomes_falha[modulo] += 1
    out = {m: {"total": c["ok"] + c["FAIL"] + c["ERROR"], "falhas": c["FAIL"] + c["ERROR"], "ignorados": c["skipped"]} for m, c in por.items()}
    return out, falhas, dict(nomes_falha)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sem-build", action="store_true")
    ap.add_argument("--build-ok", default=None, help="texto do resultado do build, quando rodado à parte")
    args = ap.parse_args()
    vit, vit_falhas, vit_res = vitest()
    py, py_falhas, falha_por_arquivo = python()
    tsc = roda(["npx", "tsc", "--noEmit", "-p", "."])
    lint = roda(["npx", "next", "lint"])
    falha_simulada = {}
    for mod, d in MODULOS.items():
        falha_simulada[mod] = sum(falha_por_arquivo.get(a, 0) for a in d["pytest"])
    py_total = sum(v["total"] for v in py.values())
    py_f = sum(v["falhas"] for v in py.values())
    regressao = (
        f"Vitest: {vit_res['total']} testes em {vit_res['arquivos']} arquivos, {vit_res['falhas']} falhas"
        + (f" ({'; '.join(vit_falhas[:5])})" if vit_falhas else "")
        + f". Python: {py_total} testes, {py_f} falhas"
        + (f" ({'; '.join(py_falhas[:5])})" if py_falhas else "")
        + "."
    )
    build = args.build_ok or ("build não executado nesta rodada" if args.sem_build else "build não registrado")
    resumo_build = f"tsc: {'sem erro' if tsc.returncode == 0 else 'com erro'}; next lint: {'sem aviso nem erro' if lint.returncode == 0 and 'Warning' not in lint.stdout + lint.stderr else 'com aviso ou erro'}; {build}. {regressao}"
    saida = {
        "gerado_em": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "vitest": vit, "python": py, "falha_simulada": falha_simulada,
        "vitest_falhas": vit_falhas, "python_falhas": py_falhas,
        "tsc": {"ok": tsc.returncode == 0}, "lint": {"ok": lint.returncode == 0, "saida": (lint.stdout + lint.stderr).strip()[-300:]},
        "resumo_regressao": regressao, "resumo_build": resumo_build,
    }
    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(regressao)
    print(resumo_build)


if __name__ == "__main__":
    main()
