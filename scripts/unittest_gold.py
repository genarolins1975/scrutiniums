"""Mesmo unittest discover, com resultado estruturado por arquivo e teste."""
import inspect
import json
import re
from pathlib import Path
import sys
import unittest

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))


class Resultado(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.itens = []

    def registrar(self, teste, estado, detalhe=''):
        try:
            arquivo = Path(inspect.getfile(type(teste))).resolve().relative_to(RAIZ).as_posix()
        except (TypeError, ValueError):
            arquivo = '?'
        if not arquivo.startswith(('pipeline/tests/', 'pesquisa/tests/')):
            # Erro de setUpClass/tearDownClass é atribuído à classe testada.
            # _FailedTest de import continua inconclusivo, nunca é aprovação.
            modulo = re.search(r'\((pipeline|pesquisa)\.tests\.(test_[A-Za-z0-9_]+)\.', teste.id())
            if modulo:
                arquivo = f'{modulo[1]}/tests/{modulo[2]}.py'
        self.itens.append({'arquivo': arquivo, 'teste': teste.id(), 'estado': estado, 'detalhe': detalhe})

    def addSuccess(self, teste):
        super().addSuccess(teste)
        self.registrar(teste, 'passed')

    def addFailure(self, teste, erro):
        super().addFailure(teste, erro)
        self.registrar(teste, 'failed', self._exc_info_to_string(erro, teste))

    def addError(self, teste, erro):
        super().addError(teste, erro)
        self.registrar(teste, 'failed', self._exc_info_to_string(erro, teste))

    def addSkip(self, teste, motivo):
        super().addSkip(teste, motivo)
        self.registrar(teste, 'skipped', motivo)

    def addExpectedFailure(self, teste, erro):
        super().addExpectedFailure(teste, erro)
        self.registrar(teste, 'skipped', self._exc_info_to_string(erro, teste))

    def addUnexpectedSuccess(self, teste):
        super().addUnexpectedSuccess(teste)
        self.registrar(teste, 'failed', 'Sucesso inesperado')

    def addSubTest(self, teste, subteste, erro):
        super().addSubTest(teste, subteste, erro)
        if erro:
            self.registrar(teste, 'failed', self._exc_info_to_string(erro, teste))


if __name__ == '__main__':
    suite = unittest.defaultTestLoader.discover(sys.argv[1], top_level_dir=str(RAIZ))
    resultado = unittest.TextTestRunner(verbosity=2, resultclass=Resultado).run(suite)
    Path(sys.argv[2]).write_text(json.dumps({'terminou': True, 'testsRun': resultado.testsRun,
                                          'itens': resultado.itens}, ensure_ascii=False))
    sys.exit(0 if resultado.wasSuccessful() else 1)
