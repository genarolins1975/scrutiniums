"""Aceite da publicação seletiva, com golds/resultados sintéticos e sem rede."""
import hashlib
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts import publicar_gold as pg
from scripts import validar_publicar_gold as fluxo


class PublicacaoPorGrupo(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.raiz = Path(self.tmp.name)
        self.nova, self.base = self.raiz / 'nova', self.raiz / 'base'
        for p in (self.nova, self.base):
            p.mkdir()
        self.man = {'grupos': {
            'meta': {'arquivos': ['meta.json'], 'depende_de': []},
            'consignado': {'arquivos': ['consignado.json', 'consignado_mun.json'], 'depende_de': []},
            'emprego-setores-ufs': {'arquivos': ['emprego.json', 'sectors.json', 'ufs.json'], 'depende_de': [],
                                    'recompor': {'arquivo': 'ufs.json', 'insumos': ['consignado', 'panorama']}},
            'panorama': {'arquivos': ['panorama.json'], 'depende_de': []},
            'outro': {'arquivos': ['outro.json', 'inst/*.json'], 'depende_de': []},
        }}
        self.mapa = {
            'src/tests/consignado-data.test.ts': {'grupos': ['consignado']},
            'src/tests/emprego-data.test.ts': {'grupos': ['emprego-setores-ufs']},
            'src/tests/outro.test.ts': {'grupos': ['outro']},
            'src/tests/i18n.test.ts': {'grupos': []},
        }
        for pasta, mes, valor in ((self.base, '2026-07', 1), (self.nova, '2026-08', 999)):
            docs = {
                'meta.json': {'gerado_em': mes + '-28T09:00:00+00:00', 'vintages': {'caged': mes}, 'inad_conceitos': {'sgs': {'v': valor}}},
                'emprego.json': {'mes': mes, 'ufs_mes': mes, 'ufs': [{'uf': 'SP', 'mes': mes, 'saldo_mes': valor}]},
                'sectors.json': {'emprego_ref': mes},
                'ufs.json': {'datas': {'emprego': mes}, 'consignado_nao_validado': valor},
                'consignado.json': {'scr': {'data_base': mes}, 'estados': [{'uf': 'SP', 'cons_total': valor}]},
                'consignado_mun.json': {'municipios': [{'v': valor}]},
                'panorama.json': {'data_base': mes, 'mapa': [{'uf': 'SP'}]},
                'outro.json': {'valor': valor},
                'inst/1.json': {'valor': valor},
            }
            for nome, payload in docs.items():
                arquivo = pasta / nome
                arquivo.parent.mkdir(exist_ok=True)
                pg.gravar_json(arquivo, payload)
        # Bytes arbitrários/indentação também precisam sobreviver à retenção.
        (self.base / 'consignado_mun.json').write_bytes(b'{"municipios": []}  \n\n')
        self.antes = self.hashes(self.base)

    @staticmethod
    def hashes(pasta):
        return {n: hashlib.sha256((pasta / n).read_bytes()).hexdigest() for n in pg.arquivos(pasta)}

    def rodar(self, falhas=(), observar=None):
        chamadas = []
        def suites(pasta):
            chamadas.append(pasta)
            if observar:
                observar(len(chamadas))
            resultados = {n: {'estado': 'failed' if n in falhas else 'passed'} for n in self.mapa}
            return {'vitest': {'codigo': int(bool(falhas)), 'inconclusivo': False, 'resultados': resultados,
                               'tentativas': [{'inconclusivo': False}]},
                    'pipeline': {'codigo': 0, 'inconclusivo': False, 'resultados': {}, 'tentativas': [{}]},
                    'pesquisa': {'codigo': 0, 'inconclusivo': False, 'resultados': {}, 'tentativas': [{}]}}
        trabalho = self.raiz / 'trabalho'
        trabalho.mkdir()
        return fluxo.validar_e_publicar(self.nova, self.base, self.man, self.mapa, suites, trabalho), chamadas

    def test_01_so_consignado_reprova_emprego_setores_ufs_publicados_juntos(self):
        def observar(rodada):
            if rodada == 2:
                ufs = pg.ler_json(self.base / 'ufs.json')
                sp = next(u for u in ufs['ufs'] if u['uf'] == 'SP')
                self.assertEqual(sp['consignado']['cons_total'], 1)  # não vaza 999 da reprovada
                self.assertEqual(sp['emprego']['saldo_mes'], 999)
                self.assertEqual(ufs['datas']['emprego'], '2026-08')
                self.assertEqual(ufs['datas']['consignado'], '2026-07')
        r, chamadas = self.rodar(['src/tests/consignado-data.test.ts'], observar)
        self.assertEqual(set(r['retidos']), {'consignado'})
        self.assertIn('emprego-setores-ufs', r['publicados'])
        self.assertEqual(len(chamadas), 2)  # composição final também conferida
        self.assertEqual(pg.ler_json(self.base / 'sectors.json')['emprego_ref'], '2026-08')

    def test_02_emprego_reprovado_retem_os_tres_e_os_demais_saem(self):
        r, _ = self.rodar(['src/tests/emprego-data.test.ts'])
        self.assertEqual(set(r['retidos']), {'emprego-setores-ufs'})
        for n in ('emprego.json', 'sectors.json', 'ufs.json'):
            self.assertEqual(self.hashes(self.base)[n], self.antes[n])
        self.assertEqual(pg.ler_json(self.base / 'outro.json')['valor'], 999)
        self.assertEqual(pg.ler_json(self.base / 'consignado.json')['estados'][0]['cons_total'], 999)

    def test_03_chromium_inconclusivo_repete_uma_vez_nada_publicado(self):
        tentativas = []
        def tentativa(n):
            tentativas.append(n)
            return fluxo.classificar(1, "browserType.launch: Chromium não carregou", None, 'vitest')
        suite = fluxo.repetir_uma_vez(tentativa)
        trabalho = self.raiz / 'trabalho'
        trabalho.mkdir()
        r = fluxo.validar_e_publicar(self.nova, self.base, self.man, self.mapa,
                                    lambda p: {'vitest': suite}, trabalho)
        self.assertEqual(tentativas, [1, 2])
        self.assertTrue(r['inconclusivo'])
        self.assertEqual(r['publicados'], [])
        self.assertEqual(self.hashes(self.base), self.antes)
        self.assertIn('browserType.launch', suite['tentativas'][1]['trecho_log'])

    def test_04_tudo_verde_identico_a_copia_integral_da_candidata_testada(self):
        def observar(rodada):
            self.assertEqual(self.hashes(self.base), self.hashes(self.nova))
        r, chamadas = self.rodar(observar=observar)
        self.assertEqual(r['retidos'], {})
        self.assertEqual(set(r['publicados']), set(self.man['grupos']))
        self.assertEqual(self.hashes(self.base), self.hashes(self.nova))
        self.assertEqual(len(chamadas), 1)

    def test_05_retido_preserva_sha256_de_todos_os_membros(self):
        self.rodar(['src/tests/consignado-data.test.ts'])
        depois = self.hashes(self.base)
        for n in ('consignado.json', 'consignado_mun.json'):
            self.assertEqual(depois[n], self.antes[n])

    def test_06_novo_arquivo_sem_grupo_falha_antes_de_publicar(self):
        (self.nova / 'surpresa.json').write_text('{}')
        with self.assertRaisesRegex(ValueError, 'sem grupo.*surpresa.json'):
            self.rodar()
        self.assertEqual(self.hashes(self.base), self.antes)
        self.man['grupos']['outro']['arquivos'].append('surpresa.json')
        pg.validar(self.nova, self.man)
        pg.preparar_meta(self.nova, self.man)
        destino = self.raiz / 'arquivo-novo-aprovado'
        pg.compor(self.nova, self.base, destino, self.man, {'publicados': list(self.man['grupos']), 'retidos': {}})
        self.assertTrue((destino / 'surpresa.json').exists())

    def test_manifesto_nao_pode_apontar_para_inexistente_ou_duplicado(self):
        self.man['grupos']['outro']['arquivos'].append('nao-existe.json')
        with self.assertRaisesRegex(ValueError, 'inexistente: nao-existe.json'):
            pg.validar(self.nova, self.man)
        self.man['grupos']['outro']['arquivos'][-1] = 'emprego.json'
        with self.assertRaisesRegex(ValueError, 'mais de um grupo'):
            pg.validar(self.nova, self.man)

    def test_falha_multigrupo_e_fecho_transitivo_das_dependencias(self):
        self.man['grupos']['outro']['depende_de'] = ['consignado']
        self.mapa['src/tests/outro.test.ts']['grupos'] = ['outro', 'panorama']
        r, _ = self.rodar(['src/tests/outro.test.ts'])
        self.assertEqual(set(r['retidos']), {'outro', 'panorama'})
        self.assertIn('emprego-setores-ufs', r['publicados'])

    def test_falha_multigrupo_com_meta_retem_os_outros_grupos_e_remonta_o_meta(self):
        # Ex.: estados-data.test.ts lê ufs.json e chega a meta.json via observatorioHead.ts.
        self.mapa['src/tests/estados.test.ts'] = {'grupos': ['emprego-setores-ufs', 'meta']}
        r, chamadas = self.rodar(['src/tests/estados.test.ts'])
        self.assertEqual(set(r['retidos']), {'emprego-setores-ufs'})
        self.assertIn('meta', r['publicados'])
        self.assertEqual(len(chamadas), 2)  # a composição com o meta remontado é retestada
        meta = pg.ler_json(self.base / 'meta.json')
        self.assertEqual(meta['grupos']['outro']['gerado_em'], '2026-08-28T09:00:00+00:00')
        self.assertEqual(meta['grupos']['emprego-setores-ufs']['gerado_em'], '2026-07-28T09:00:00+00:00')
        self.assertEqual(meta['gerado_em'], '2026-07-28T09:00:00+00:00')  # global conservador
        for n in ('emprego.json', 'sectors.json', 'ufs.json'):
            self.assertEqual(self.hashes(self.base)[n], self.antes[n])
        self.assertEqual(pg.ler_json(self.base / 'outro.json')['valor'], 999)

    def test_teste_que_protege_so_o_meta_retem_tudo(self):
        self.mapa['src/tests/meta.test.ts'] = {'grupos': ['meta']}
        r, _ = self.rodar(['src/tests/meta.test.ts'])
        self.assertEqual(set(r['retidos']), set(self.man['grupos']))
        self.assertEqual(r['publicados'], [])
        self.assertEqual(self.hashes(self.base), self.antes)

    def test_dependencia_reprovada_retem_consumidor(self):
        self.man['grupos']['outro']['depende_de'] = ['consignado']
        self.man['grupos']['consignado']['depende_de'] = ['outro']  # ciclo: saem ou ficam juntos
        r, _ = self.rodar(['src/tests/consignado-data.test.ts'])
        self.assertIn('outro', r['retidos'])
        self.assertIn('Dependência retida: consignado', r['retidos']['outro'])
        self.assertEqual(self.hashes(self.base)['inst/1.json'], self.antes['inst/1.json'])

    def test_datas_e_vintages_dos_retidos_nao_ganham_data_de_hoje(self):
        r, _ = self.rodar(['src/tests/consignado-data.test.ts'])
        m = pg.ler_json(self.base / 'meta.json')
        self.assertEqual(m['grupos']['consignado']['gerado_em'], '2026-07-28T09:00:00+00:00')
        self.assertEqual(m['grupos']['emprego-setores-ufs']['gerado_em'], '2026-08-28T09:00:00+00:00')
        self.assertEqual(m['grupos']['consignado']['vintages']['caged'], '2026-07')
        self.assertEqual(m['grupos']['emprego-setores-ufs']['vintages']['caged'], '2026-08')
        self.assertEqual(m['gerado_em'], '2026-07-28T09:00:00+00:00')
        self.assertEqual(m['snapshots'][m['grupos']['emprego-setores-ufs']['snapshot']]['inad_conceitos']['sgs']['v'], 1)
        self.assertEqual(pg.ler_json(self.nova / 'meta.json')['inad_conceitos']['sgs']['v'], 999)
        self.assertEqual(r['datas_anteriores']['consignado'], m['gerado_em'])
        from contextlib import redirect_stdout
        from io import StringIO
        from scripts.testes_reprovados import publicacao
        r['publicacao_remota_confirmada'] = False
        caminho = self.raiz / 'resultado.json'
        pg.gravar_json(caminho, r)
        saida = StringIO()
        with redirect_stdout(saida):
            publicacao(caminho)
        self.assertIn('publicação remota não confirmada', saida.getvalue())
        self.assertNotIn('### Grupos publicados', saida.getvalue())

    def test_erro_na_composicao_ou_reteste_restaura_base(self):
        with patch.object(pg, 'recompor_ufs', side_effect=RuntimeError('erro')):
            # O default da função já guarda o callable original: usar falha do builder.
            with patch('pipeline.ufs.build', side_effect=RuntimeError('erro')):
                with self.assertRaisesRegex(RuntimeError, 'erro'):
                    self.rodar(['src/tests/consignado-data.test.ts'])
        self.assertEqual(self.hashes(self.base), self.antes)

    def test_snapshot_compartilhado_serializado_uma_so_vez(self):
        import gzip
        # Mesmo um log grande não é multiplicado por grupo.
        meta = pg.ler_json(self.nova / 'meta.json')
        meta['fontes_status'] = {'coletor': {'log': list(range(10000))}}
        pg.gravar_json(self.nova / 'meta.json', meta)
        original = len(gzip.compress((self.nova / 'meta.json').read_bytes()))
        pg.preparar_meta(self.nova, self.man)
        novo = pg.ler_json(self.nova / 'meta.json')
        self.assertEqual(len(novo['snapshots']), 1)
        self.assertTrue(all('meta' not in g and 'fontes_status' not in g for g in novo['grupos'].values()))
        self.assertLess(len(gzip.compress((self.nova / 'meta.json').read_bytes())), original * 1.2)

    def test_sentinela_retem_grupo_inteiro(self):
        m = pg.ler_json(self.nova / 'meta.json')
        m['restaurados'] = {'consignado.json': {'motivo': 'stub de erro'}}
        pg.gravar_json(self.nova / 'meta.json', m)
        r, _ = self.rodar()
        self.assertEqual(set(r['retidos']), {'consignado'})
        self.assertEqual(self.hashes(self.base)['consignado_mun.json'], self.antes['consignado_mun.json'])

    def test_falha_sem_gold_nao_retem_dado_mas_aparece(self):
        r, _ = self.rodar(['src/tests/i18n.test.ts'])
        self.assertEqual(r['retidos'], {})
        self.assertIn('src/tests/i18n.test.ts', r['falhas_sem_gold'])

    def test_teste_protetor_ausente_ou_pulado_nao_aprova(self):
        for estado in ('ausente', 'skipped'):
            r = pg.selecionar(self.man, {'t': {'grupos': ['consignado']}}, {'t': {'estado': estado}})
            self.assertIn('consignado', r['retidos'])

    def test_segunda_rodada_pode_reter_novo_grupo_sem_liberar_o_anterior(self):
        contador = []
        def observar(rodada):
            contador.append(rodada)
            if rodada == 2:
                # A composição acusa outro contrato; o fecho é monotônico.
                falhas.append('src/tests/outro.test.ts')
        falhas = ['src/tests/consignado-data.test.ts']
        r, _ = self.rodar(falhas, observar)
        self.assertEqual(set(r['retidos']), {'consignado', 'outro'})
        self.assertEqual(contador, [1, 2, 3])


    def test_bytes_finais_foram_testados_sem_segunda_recomposicao(self):
        from pipeline import ufs
        verificados = {}
        def observar(rodada):
            if rodada == 2:
                verificados.update(self.hashes(self.base))
        with patch('pipeline.ufs.build', wraps=ufs.build) as builder:
            self.rodar(['src/tests/consignado-data.test.ts'], observar)
        self.assertEqual(builder.call_count, 1)
        self.assertEqual(self.hashes(self.base), verificados)


class Infraestrutura(unittest.TestCase):
    def test_inconclusivos_conhecidos(self):
        for codigo, log, rel, suite in [
            (1, 'npm ci falhou', None, 'preparo'),
            (134, 'spawn ENOBUFS', None, 'vitest'),
            (1, 'vitest abortou', None, 'vitest'),
            (124, 'Tempo esgotado', None, 'pipeline'),
        ]:
            with self.subTest(log=log):
                self.assertTrue(fluxo.classificar(codigo, log, rel, suite)['inconclusivo'])

    def test_reprovacao_de_dado_nao_e_repetida(self):
        chamadas = []
        r = fluxo.repetir_uma_vez(lambda n: chamadas.append(n) or {'inconclusivo': False, 'codigo': 1})
        self.assertEqual(chamadas, [1])
        self.assertEqual(r['codigo'], 1)

    def test_infra_transiente_pode_concluir_na_segunda_tentativa(self):
        r = fluxo.repetir_uma_vez(lambda n: {'inconclusivo': n == 1, 'codigo': int(n == 1)})
        self.assertEqual(len(r['tentativas']), 2)
        self.assertFalse(r['inconclusivo'])


    def test_assertion_de_dado_com_json_completo_nao_e_infra(self):
        rel = {'numTotalTests': 1, 'numPassedTests': 0, 'numFailedTests': 1, 'numPendingTests': 0,
               'success': False, 'testResults': [{
                   'name': str(pg.RAIZ / 'src/tests/emprego-data.test.ts'), 'status': 'failed',
                   'assertionResults': [{'status': 'failed', 'failureMessages': ['Esperado agosto, recebido julho']}]}]}
        r = fluxo.classificar(1, '1 teste reprovado', rel, 'vitest')
        self.assertFalse(r['inconclusivo'])
        self.assertEqual(r['resultados']['src/tests/emprego-data.test.ts']['estado'], 'failed')
        rel['success'] = True
        rel['numPassedTests'], rel['numFailedTests'] = 1, 0
        rel['testResults'][0]['status'] = 'passed'
        rel['testResults'][0]['assertionResults'] = [{'status': 'passed'}]
        self.assertFalse(fluxo.classificar(0, 'teste da proteção contra ENOBUFS passou', rel, 'vitest')['inconclusivo'])

    def test_erro_de_setup_de_classe_atribuido_ao_arquivo_de_dado(self):
        from io import StringIO
        from scripts.unittest_gold import Resultado
        resultado = unittest.TextTestRunner(stream=StringIO(), resultclass=Resultado)._makeResult()
        teste = unittest.suite._ErrorHolder('setUpClass (pipeline.tests.test_report.Classe)')
        resultado.addError(teste, (ValueError, ValueError('gold inválida'), None))
        self.assertEqual(resultado.itens[0]['arquivo'], 'pipeline/tests/test_report.py')


class MapaDeProtecao(unittest.TestCase):
    def test_derivacao_multigrupo_e_teste_sem_gold(self):
        from scripts.mapa_testes_gold import gerar
        with tempfile.TemporaryDirectory() as tmp:
            raiz = Path(tmp)
            (raiz / 'config').mkdir()
            for p in ('pipeline/tests', 'pesquisa/tests', 'gold'):
                (raiz / p).mkdir(parents=True)
            pg.gravar_json(raiz / 'config/gold-testes-excecoes.json', {})
            man = {'grupos': {g: {'arquivos': [g + '.json'], 'depende_de': []} for g in ('emprego', 'consignado')}}
            for g in man['grupos']:
                pg.gravar_json(raiz / 'gold' / (g + '.json'), {})
            inventario = {
                'src/tests/misto.test.ts': {'le_fs': True, 'imports': [], 'strings': [
                    {'texto': 'public/obs/data/gold', 'linha': 1},
                    {'texto': 'emprego.json', 'linha': 2},
                    {'texto': 'consignado.json', 'linha': 3}]},
                'src/tests/componente.test.ts': {'le_fs': False, 'imports': [], 'strings': []},
            }
            inventario['src/tests/importacao.test.ts'] = {'le_fs': False, 'imports': ['@/lib/wrapper'], 'strings': []}
            inventario['src/lib/wrapper.ts'] = {'le_fs': False, 'imports': ['./leitor'], 'strings': []}
            inventario['src/lib/leitor.ts'] = {'le_fs': True, 'imports': ['./wrapper'], 'strings': [
                {'texto': 'public/obs/data/gold/emprego.json', 'linha': 7}]}
            mapa = gerar(raiz, raiz / 'gold', man, inventario)
            self.assertEqual(mapa['src/tests/misto.test.ts']['grupos'], ['consignado', 'emprego'])
            self.assertEqual(mapa['src/tests/componente.test.ts']['grupos'], [])
            self.assertEqual(mapa['src/tests/importacao.test.ts']['grupos'], ['emprego'])
            self.assertIn(':2:', mapa['src/tests/misto.test.ts']['evidencias'][0])
            inventario['src/tests/misto.test.ts']['strings'] = [{'texto': 'public/obs/data/gold', 'linha': 1}]
            with self.assertRaisesRegex(ValueError, 'Leitura dinâmica.*sem classificação'):
                gerar(raiz, raiz / 'gold', man, inventario)

    def test_resultado_de_teste_nao_inventariado_falha_fechado(self):
        with self.assertRaisesRegex(ValueError, 'Testes sem classificação: novo'):
            pg.selecionar({'grupos': {}}, {}, {'novo': {'estado': 'failed'}})


class ManifestoReal(unittest.TestCase):
    def test_todos_os_arquivos_publicados_tem_exatamente_um_grupo(self):
        donos = pg.validar(pg.RAIZ / 'public/obs/data/gold', pg.ler_json(pg.MANIFESTO))
        self.assertEqual(len(donos), len(pg.arquivos(pg.RAIZ / 'public/obs/data/gold')))
        self.assertEqual(donos['emprego.json'], donos['sectors.json'])
        self.assertEqual(donos['emprego.json'], donos['ufs.json'])


if __name__ == '__main__':
    unittest.main()
