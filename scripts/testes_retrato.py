"""Roda só os testes de retrato do pipeline (marcados com pipeline/tests/retrato.py) e grava o resultado em JSON.

Uso: python3 scripts/testes_retrato.py --json <arquivo>
Saída: 0 = todos passam; 1 = algum retrato diverge da gold; 2 = falha de ferramenta (módulo que não importa, erro
que não é asserção). Chamado por scripts/testes-retrato.mjs.
"""
import json
import os
import sys
import unittest

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _testes(suite):
    for t in suite:
        if isinstance(t, unittest.TestSuite):
            yield from _testes(t)
        else:
            yield t


def _de_que(teste):
    metodo = getattr(teste, getattr(teste, "_testMethodName", ""), None)
    return getattr(metodo, "__retrato__", None) or getattr(type(teste), "__retrato__", None)


def main(argv):
    destino = argv[argv.index("--json") + 1] if "--json" in argv else None
    # o pulo é decidido na importação dos módulos de teste: a variável sai antes da descoberta
    os.environ.pop("TESTES_SEM_RETRATO", None)
    sys.path.insert(0, RAIZ)
    os.chdir(RAIZ)
    suite = unittest.TestLoader().discover("pipeline/tests", top_level_dir=".")
    todos = list(_testes(suite))
    nao_importados = [t.id() for t in todos if type(t).__name__ == "_FailedTest"]
    escolhidos = [t for t in todos if _de_que(t)]
    resultado = unittest.TextTestRunner(stream=sys.stderr, verbosity=1).run(unittest.TestSuite(escolhidos))
    divergentes = [{"teste": t.id(), "retrato": _de_que(t), "mensagem": (tb.strip().splitlines() or [""])[-1][:400]}
                   for t, tb in resultado.failures]
    erros = [{"teste": t.id(), "mensagem": (tb.strip().splitlines() or [""])[-1][:400]} for t, tb in resultado.errors]
    erros += [{"teste": n, "mensagem": "módulo de teste não importou"} for n in nao_importados]
    saida = {"rodados": resultado.testsRun, "divergentes": divergentes, "erros": erros}
    if destino:
        with open(destino, "w", encoding="utf-8") as f:
            json.dump(saida, f, ensure_ascii=False, indent=1)
    return 2 if erros else (1 if divergentes else 0)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
