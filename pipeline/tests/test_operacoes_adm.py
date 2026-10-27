"""27/10/2026: monitor e gates de publicação, sem rede ou gold real."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from scripts import validar_publicar_gold as fluxo

spec = importlib.util.spec_from_file_location('estado_operacoes', Path(__file__).parents[2] / 'scripts/estado-operacoes.py')
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)


class OperacoesAdm(unittest.TestCase):
    def test_monitor_preserva_falha_parcial_sem_inventar_sucesso(self):
        cfg = {'repositorio': 'dono/repo', 'workflows': {'um.yml': {}, 'dois.yml': {}}, 'dependencias': []}
        def consultar(url):
            if '/issues?' in url:
                return [{'number': 12, 'title': 'Conferir fonte', 'created_at': '2026-10-27T12:00:00Z'}]
            if '/dois.yml/' in url:
                raise OSError('Indisponível')
            return {'workflow_runs': [{'id': 42, 'status': 'completed', 'conclusion': 'failure',
                    'created_at': '2026-10-27T12:00:00Z', 'updated_at': '2026-10-27T13:00:00Z'}]}
        r = monitor.coletar(cfg, consultar, '2026-10-27T14:00:00Z')
        self.assertEqual(r['erros'], ['dois.yml'])
        self.assertEqual(r['execucoes'][0]['conclusao'], 'failure')
        self.assertEqual(r['pendencias'][0]['id'], 'issue-12')
        self.assertNotIn('body', str(r))

    def test_monitor_sem_execucao_nao_declara_aprovacao(self):
        cfg = {'repositorio': 'dono/repo', 'workflows': {'um.yml': {}}, 'dependencias': []}
        r = monitor.coletar(cfg, lambda url: [] if '/issues?' in url else {'workflow_runs': []})
        self.assertIsNone(r['execucoes'][0]['conclusao'])
        self.assertIsNone(r['execucoes'][0]['iniciadaEm'])

    def test_build_antecede_cada_rodada_e_python_continua_na_falha(self):
        with tempfile.TemporaryDirectory() as tmp:
            pasta = Path(tmp)
            chamadas = []
            def suite(nome, _):
                chamadas.append(nome)
                return {'inconclusivo': False, 'resultados': {}, 'codigo': 0}
            def executar(cmd, log):
                chamadas.append('build')
                self.assertEqual(cmd, ['npm', 'run', 'build'])
                return 0, ''
            with patch.object(fluxo, 'executar', side_effect=executar), patch.object(fluxo, 'rodar_suite', side_effect=suite):
                fluxo.suites(pasta / 'rodada-1')
                fluxo.suites(pasta / 'rodada-2')
            self.assertEqual(chamadas, ['build', 'vitest', 'pipeline', 'pesquisa'] * 2)
            chamadas.clear()
            with patch.object(fluxo, 'executar', return_value=(1, 'Build incompleto')), patch.object(fluxo, 'rodar_suite', side_effect=suite):
                r = fluxo.suites(pasta / 'rodada-falha')
            self.assertTrue(r['build']['inconclusivo'])
            self.assertEqual(chamadas, ['pipeline', 'pesquisa'])
            self.assertNotIn('vitest', r)

    def test_reexecucao_mantem_tentativa_e_link_da_evidencia(self):
        cfg = {'repositorio': 'dono/repo', 'workflows': {'um.yml': {}}, 'dependencias': []}
        def consultar(url):
            if '/issues?' in url:
                return []
            return {'workflow_runs': [{'id': 42, 'run_attempt': 2, 'status': 'completed', 'conclusion': 'failure',
                'created_at': '2026-10-26T12:00:00Z', 'run_started_at': '2026-10-27T12:00:00Z', 'updated_at': '2026-10-27T13:00:00Z'}]}
        r = monitor.coletar(cfg, consultar)['execucoes'][0]
        self.assertEqual(r['tentativa'], 2)
        self.assertTrue(r['url'].endswith('/runs/42/attempts/2'))
        self.assertEqual(r['iniciadaEm'], '2026-10-27T12:00:00Z')
