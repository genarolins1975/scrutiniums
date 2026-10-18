"""Estado meta fora do cache e histórico completo fora do JSON (dados sintéticos)."""
import csv
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch
from contextlib import ExitStack
from types import SimpleNamespace

from pipeline.energia import base

RAIZ = Path(__file__).resolve().parents[2]


def passos(workflow="atualizar-energia.yml"):
    texto = (RAIZ / ".github/workflows" / workflow).read_text()
    resultado = {}
    for bloco in texto.split('\n      - name: ')[1:]:
        nome, resto = bloco.split('\n', 1)
        cabecalho, _, corpo = resto.partition('        run: |\n')
        resultado[nome] = (cabecalho, '\n'.join(l[10:] if l.startswith('          ') else l
                                                 for l in corpo.splitlines()))
    return resultado


class TestEstadoMeta(unittest.TestCase):
    def test_previsao_mantem_fila_propria_e_cache_so_apos_proteger_meta(self):
        import re
        grupos = []
        for nome in ('atualizar-energia.yml', 'previsao-pld.yml'):
            texto = (RAIZ / '.github/workflows' / nome).read_text()
            bloco = texto.split('\nconcurrency:\n', 1)[1].split('\njobs:', 1)[0]
            grupos.append(re.search(r'^  group: (.+)$', bloco, re.MULTILINE).group(1))
            self.assertRegex(bloco, r'cancel-in-progress: false')
        self.assertNotEqual(grupos[0], grupos[1], 'previsão não espera nem substitui energia pendente')
        ps = passos('previsao-pld.yml')
        for nome in ('Liberar a cópia anterior do estado antes de gravar',
                     'Guardar estado (vintages coletadas antes do corte)'):
            self.assertIn("steps.meta_cache.outcome == 'success'", ps[nome][0])
        self.assertIn("steps.guardar.outcome == 'success'", ps['Manter só a cópia mais recente do estado'][0])
        self.assertIn('if: always()', ps['Repor metadados no diretório de trabalho da previsão'][0])
        self.assertNotIn('meta_cache', ps['Commit do arquivo de emissões (e da gold, se os testes passaram)'][0])

    def test_cache_novo_da_energia_so_apos_copia_duravel_confirmada(self):
        ps = passos()
        nomes = list(ps)
        copia = 'Cópia durável dos metadados (release energia-estado)'
        for nome in ('Liberar a cópia anterior do estado antes de gravar',
                     'Guardar estado', 'Manter só a cópia mais recente do estado'):
            self.assertLess(nomes.index(copia), nomes.index(nome))
            self.assertIn("steps.meta_duravel.outcome == 'success'", ps[nome][0])
        self.assertLess(nomes.index('Cópia durável do silver (release energia-estado)'), nomes.index(copia))

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.raiz = Path(self.tmp.name)
        self.repo = self.raiz / 'repo'
        self.assets = self.raiz / 'assets'
        self.assets.mkdir()
        pacote = self.repo / 'pipeline/energia'
        pacote.mkdir(parents=True)
        for p in (self.repo / 'pipeline/__init__.py', pacote / '__init__.py'):
            p.touch()
        helper = RAIZ / 'pipeline/energia/estado_meta.py'
        if helper.exists():
            shutil.copyfile(helper, pacote / helper.name)
        self.bin = self.raiz / 'bin'
        self.bin.mkdir()
        gh = self.bin / 'gh'
        gh.write_text('''#!/usr/bin/env python3
import os, pathlib, shutil, sys
a = sys.argv[1:]
with open(os.environ['FAKE_LOG'], 'a') as f:
    f.write(' '.join(a) + '\\n')
assets = pathlib.Path(os.environ['FAKE_ASSETS'])
if a[:2] == ['release', 'download']:
    encontrados = list(assets.glob(a[a.index('--pattern') + 1]))
    if not encontrados: sys.exit(1)
    dest = pathlib.Path(a[a.index('--dir') + 1])
    dest.mkdir(parents=True, exist_ok=True)
    for p in encontrados: shutil.copyfile(p, dest / p.name)
elif a[:2] == ['release', 'upload']:
    p = pathlib.Path(a[3])
    if p.name.startswith('energia-meta-') and os.environ.get('FALHAR_META'): sys.exit(1)
    shutil.copyfile(p, assets / p.name)
elif a[:2] == ['release', 'view'] and '--json' in a:
    print('\\n'.join(p.name for p in assets.glob('energia-meta-*.tar.gz')))
elif a[0] == 'api':
    print('\\n'.join(p.name for p in assets.glob('energia-meta-*.tar.gz') if p.name != os.environ.get('FAKE_STARTER')))
elif a[:2] == ['release', 'delete-asset']:
    (assets / a[3]).unlink()
''')
        gh.chmod(0o755)
        self.env = {**os.environ, 'PATH': f'{self.bin}:{os.environ["PATH"]}',
                    'PYTHONPATH': str(self.repo), 'FAKE_ASSETS': str(self.assets),
                    'FAKE_LOG': str(self.raiz / 'gh.log'), 'GITHUB_REPOSITORY': 'teste/energia',
                    'GITHUB_OUTPUT': str(self.raiz / 'output'), 'GITHUB_RUN_ID': '123', 'GITHUB_RUN_ATTEMPT': '1', 'RUN_URL': 'https://teste/run'}

    def executar(self, nome, workflow="atualizar-energia.yml"):
        cab, shell = passos(workflow)[nome]
        if workflow == "atualizar-energia.yml":
            self.assertIn('continue-on-error: true', cab)
        shell = shell.replace('/tmp', str(self.raiz / 'temporarios'))
        (self.raiz / 'temporarios').mkdir(exist_ok=True)
        return subprocess.run(['bash', '-eo', 'pipefail', '-c', shell], cwd=self.repo,
                              env=self.env, text=True, capture_output=True, timeout=30)

    def asset(self, geracao, arquivos):
        with tarfile.open(self.assets / f'energia-meta-{geracao}.tar.gz', 'w:gz') as tar:
            for nome, conteudo in arquivos.items():
                b = conteudo.encode()
                item = tarfile.TarInfo(nome)
                item.size = len(b)
                tar.addfile(item, io.BytesIO(b))

    def test_restauracao_cache_ausente_e_parcial_preserva_bytes_e_escolhe_geracao(self):
        self.asset('20261017T000000Z', {'_meta_ons.json': 'antigo'})
        self.asset('20261018T000000Z', {'_meta_ons.json': 'fonte', '_ckan_ons.json': 'catalogo',
                                        '_conferencia_bronze.json': 'conferencia'})
        # Falha de upload mais nova não pode esconder a última geração completa.
        self.env['FAKE_STARTER'] = 'energia-meta-20261019T000000Z.tar.gz'
        (self.assets / self.env['FAKE_STARTER']).write_bytes(b'upload interrompido')
        for parcial in (False, True):
            with self.subTest(parcial=parcial):
                pasta = self.repo / 'data/energia/meta'
                shutil.rmtree(pasta, ignore_errors=True)
                if parcial:
                    pasta.mkdir(parents=True)
                    (pasta / '_meta_ons.json').write_bytes(b'cache recente\n')
                r = self.executar('Restaurar metadados da cópia durável')
                self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
                self.assertEqual((pasta / '_meta_ons.json').read_bytes(), b'cache recente\n' if parcial else b'fonte')
                self.assertEqual((pasta / '_ckan_ons.json').read_bytes(), b'catalogo')
                self.assertEqual((pasta / '_conferencia_bronze.json').read_bytes(), b'conferencia')

    def test_falha_copia_meta_nao_impede_silver_nem_apaga_geracao_anterior(self):
        self.asset('20261017T000000Z', {'_meta_ons.json': 'anterior'})
        silver = self.repo / 'data/energia/silver'
        silver.mkdir(parents=True)
        (silver / 'energia.db').write_bytes(b'silver principal')
        (silver / 'familia.db').write_bytes(b'silver familia')
        meta = self.repo / 'data/energia/meta'
        meta.mkdir()
        (meta / '_meta_ons.json').write_text('nova')
        nomes = list(passos())
        ps = 'Cópia durável do silver (release energia-estado)'
        pm = 'Cópia durável dos metadados (release energia-estado)'
        self.assertLess(nomes.index(ps), nomes.index(pm))
        self.assertNotIn('estado_meta', passos()[ps][1])
        self.assertEqual(self.executar(ps).returncode, 0)
        self.env['FALHAR_META'] = '1'
        self.assertNotEqual(self.executar(pm).returncode, 0)
        self.assertTrue((self.assets / 'energia-silver.db.gz').is_file())
        self.assertTrue((self.assets / 'energia-silver-familias.tar.gz').is_file())
        self.assertTrue((self.assets / 'energia-meta-20261017T000000Z.tar.gz').is_file())
        alerta = passos()['Alertar falha na cópia durável dos metadados']
        self.assertIn("steps.meta_duravel.outcome == 'failure'", alerta[0])
        self.assertIn('::warning::', alerta[1])
        self.assertIn('gh issue create', alerta[1])
        r = self.executar('Alertar falha na cópia durável dos metadados')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('::warning::', r.stdout)
        self.assertIn('issue create', (self.raiz / 'gh.log').read_text())

    def test_copia_bem_sucedida_sem_clobber_limpa_so_meta_antigo(self):
        self.asset('20000101T000000Z', {'_meta_ds.json': 'velha'})
        (self.assets / 'energia-bronze-manifesto.json').write_text('preservar')
        pasta = self.repo / 'data/energia/meta'
        pasta.mkdir(parents=True)
        (pasta / '_meta_ds.json').write_bytes(b'conteudo\n')
        r = self.executar('Cópia durável dos metadados (release energia-estado)')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        assets = list(self.assets.glob('energia-meta-*.tar.gz'))
        self.assertEqual(len(assets), 1)
        self.assertNotIn('20000101', assets[0].name)
        self.assertNotIn('--clobber', (self.raiz / 'gh.log').read_text())
        self.assertTrue((self.assets / 'energia-bronze-manifesto.json').exists())
        with tarfile.open(assets[0]) as tar:
            self.assertEqual(tar.extractfile('_meta_ds.json').read(), b'conteudo\n')

    def test_asset_invalido_nao_altera_cache_e_step_falha_com_alerta(self):
        self.asset('20261018T000000Z', {'_meta_ok.json': 'novo', '../fora.json': 'recusado'})
        pasta = self.repo / 'data/energia/meta'
        pasta.mkdir(parents=True)
        (pasta / '_meta_cache.json').write_bytes(b'cache')
        r = self.executar('Restaurar metadados da cópia durável')
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual(list(p.name for p in pasta.iterdir()), ['_meta_cache.json'])
        self.assertEqual((pasta / '_meta_cache.json').read_bytes(), b'cache')
        cab, shell = passos()['Alertar falha na restauração dos metadados']
        self.assertIn("steps.meta_restaurada.outcome == 'failure'", cab)
        self.assertIn('::warning::', shell)

    def test_cache_da_previsao_nao_promove_meta_antiga_e_trabalho_preserva_bytes(self):
        self.asset('20261017T000000Z', {'_meta_ons.json': 'antigo'})
        pasta = self.repo / 'data/energia/meta'
        pasta.mkdir(parents=True)
        (pasta / '_meta_ons.json').write_bytes(b'cache antigo\n')
        silver = self.repo / 'data/energia/silver/energia.db'
        silver.parent.mkdir()
        silver.write_bytes(b'vintage coletada pela previsao')
        r = self.executar('Proteger metadados antes do cache da previsão', 'previsao-pld.yml')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        # Snapshot efetivo dos mesmos paths que actions/cache/save usa.
        cache = self.raiz / 'cache_previsao'
        shutil.copytree(self.repo / 'data/energia', cache)
        self.assertFalse((cache / 'meta').exists())
        self.assertEqual((cache / 'silver/energia.db').read_bytes(), silver.read_bytes())
        self.assertEqual(self.executar('Repor metadados no diretório de trabalho da previsão', 'previsao-pld.yml').returncode, 0)
        self.assertEqual((pasta / '_meta_ons.json').read_bytes(), b'cache antigo\n')
        # A energia terminou depois da restauração da previsão e antes do novo cache.
        self.asset('20261018T000000Z', {'_meta_ons.json': 'coleta noturna nova'})
        shutil.rmtree(self.repo / 'data/energia')
        shutil.copytree(cache, self.repo / 'data/energia')
        self.assertEqual(self.executar('Restaurar metadados da cópia durável').returncode, 0)
        self.assertEqual((pasta / '_meta_ons.json').read_bytes(), b'coleta noturna nova')

    def test_primeira_previsao_preserva_unica_meta_antes_de_excluir_do_cache(self):
        pasta = self.repo / 'data/energia/meta'
        pasta.mkdir(parents=True)
        (pasta / '_meta_ons.json').write_bytes(b'unica copia\n')
        r = self.executar('Proteger metadados antes do cache da previsão', 'previsao-pld.yml')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        assets = list(self.assets.glob('energia-meta-0-bootstrap-*.tar.gz'))
        self.assertEqual(len(assets), 1)
        with tarfile.open(assets[0]) as tar:
            self.assertEqual(tar.extractfile('_meta_ons.json').read(), b'unica copia\n')
        self.assertNotIn('--clobber', (self.raiz / 'gh.log').read_text())
        self.assertFalse(pasta.exists())
        # Bootstrap nunca ultrapassa uma geração real, mesmo com upload atrasado.
        self.asset('20261018T000000Z', {'_meta_ons.json': 'fonte nova'})
        self.assertEqual(self.executar('Restaurar metadados da cópia durável').returncode, 0)
        self.assertEqual((pasta / '_meta_ons.json').read_bytes(), b'fonte nova')

    def test_falha_bootstrap_nao_retira_unica_meta_nem_libera_poda_cache(self):
        pasta = self.repo / 'data/energia/meta'
        pasta.mkdir(parents=True)
        (pasta / '_meta_ons.json').write_bytes(b'unica copia')
        self.env['FALHAR_META'] = '1'
        r = self.executar('Proteger metadados antes do cache da previsão', 'previsao-pld.yml')
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual((pasta / '_meta_ons.json').read_bytes(), b'unica copia')
        self.assertFalse(list(self.assets.iterdir()))
        self.assertNotIn('delete', (self.raiz / 'gh.log').read_text())
        # GitHub avalia o guard antes dos passos destrutivos; a emissão segue independente.
        self.test_previsao_mantem_fila_propria_e_cache_so_apos_proteger_meta()

    def test_asset_acima_do_limite_e_pasta_ausente_nao_sobem(self):
        from pipeline.energia import estado_meta
        with self.assertRaisesRegex(ValueError, 'ausente ou vazia'):
            estado_meta.guardar(self.raiz / 'vazio.tar.gz', pasta=self.raiz / 'ausente')
        pasta = self.raiz / 'meta'
        pasta.mkdir()
        (pasta / 'fonte.json').write_text('fonte')
        with patch.object(estado_meta, 'LIMITE_ASSET', 1):
            with self.assertRaisesRegex(ValueError, 'excede'):
                estado_meta.guardar(self.raiz / 'grande.tar.gz', pasta=pasta)


class TestHistoricoCompacto(unittest.TestCase):
    def fontes(self, quantidade):
        historico = [{'recurso': f'recurso;"{i % 30}\n', 'sha256': f'{i:064x}',
                      'capturado_em': f'2026-{1 + i // 28:02d}-{1 + i % 28:02d}T00:00:00Z',
                      'publicado_em': None, 'origem': 'coleta_direta', 'vigente': i >= quantidade - 30}
                     for i in range(quantidade)]
        capturas = [{k: v for k, v in h.items() if k != 'vigente'} for h in historico if h['vigente']]
        return {'ds': {'dataset': 'ds', 'familia': 'energia', 'capturas': capturas, 'historico': historico, 'recapturas_sem_mudanca': 7}}

    def test_json_limitado_csv_completo_sem_perda_de_colunas_ou_linhas(self):
        from pipeline.energia import metadados as m
        with tempfile.TemporaryDirectory() as tmp, patch.object(base, 'SERIES', tmp):
            for n in (60, 280):
                fontes = self.fontes(n)
                original = json.loads(json.dumps(fontes))
                self.assertGreater(len(json.dumps(original).encode()), 15000 * len(fontes),
                                   'a forma anterior excedia o teto no mesmo fixture')
                resultado = m.publicar_historico(fontes)
                self.assertEqual(fontes, original, 'não mutilar snapshots internos')
                base.escreve_gold('meta.json', {'fontes': resultado, 'golds': {}, 'regressoes': [],
                                              'builders_falhos': [], 'coleta_executada': False}, destino=tmp)
                self.assertLess((Path(tmp) / 'meta.json').stat().st_size, 15000 * len(fontes))
                f = resultado['ds']
                self.assertLessEqual(len(f['capturas']), m.LIMITE_RECENTES)
                self.assertLessEqual(len(f['historico']), m.LIMITE_RECENTES)
                self.assertEqual(f['historico'], [{**h, 'familia': 'energia'} for h in original['ds']['historico'][-m.LIMITE_RECENTES:][::-1]])
                self.assertEqual(f['capturas'], [{**h, 'familia': 'energia'} for h in original['ds']['capturas'][-m.LIMITE_RECENTES:][::-1]])
                resumo = f['resumo_capturas']
                self.assertEqual(resumo['total_historico'], n)
                self.assertEqual(resumo['total_capturas'], 30)
                self.assertEqual(resumo['recapturas_sem_mudanca'], 7)
                self.assertEqual(resumo['primeira'], original['ds']['historico'][0]['capturado_em'])
                self.assertEqual(resumo['ultima'], original['ds']['historico'][-1]['capturado_em'])
                with open(Path(tmp) / m.NOME_CSV, newline='') as arquivo:
                    reader = csv.DictReader(arquivo, delimiter=';')
                    linhas = list(reader)
                    self.assertEqual(reader.fieldnames, list(m.COLUNAS))
                self.assertEqual(len(linhas), n)
                self.assertEqual(sum(x['vigente'] == 'true' for x in linhas), 30)
                for antes, depois in zip(original['ds']['historico'], linhas):
                    self.assertEqual(depois, {'dataset': 'ds', 'familia': 'energia', **{k: '' if v is None else str(v).lower() if isinstance(v, bool) else v for k, v in antes.items()}})
                self.assertEqual(f['historico_csv'], m.URL_CSV)
                self.assertIn(m.URL_CSV, m.dicionario_historico())

    def test_csv_fecha_com_soma_dos_resumos_de_todas_as_fontes(self):
        from pipeline.energia import metadados as m
        fontes = {'ds': self.fontes(280)['ds'], 'outro': {**self.fontes(60)['ds'], 'dataset': 'outro'}}
        with tempfile.TemporaryDirectory() as tmp, patch.object(base, 'SERIES', tmp):
            resultado = m.publicar_historico(fontes)
            with open(Path(tmp) / m.NOME_CSV, newline='') as arquivo:
                linhas = list(csv.DictReader(arquivo, delimiter=';'))
            self.assertEqual(len(linhas), sum(f['resumo_capturas']['total_historico'] for f in resultado.values()))
            self.assertEqual(sum(l['vigente'] == 'true' for l in linhas),
                             sum(f['resumo_capturas']['total_capturas'] for f in resultado.values()))
            for ds, f in resultado.items():
                self.assertEqual(sum(l['dataset'] == ds for l in linhas), f['resumo_capturas']['total_historico'])

    def test_ausencia_continua_ausencia_e_csv_so_com_cabecalho(self):
        from pipeline.energia import metadados as m
        with tempfile.TemporaryDirectory() as tmp, patch.object(base, 'SERIES', tmp):
            f = m.publicar_historico({'vazio': {'dataset': 'vazio', 'familia': 'energia', 'capturas': [], 'historico': [], 'recapturas_sem_mudanca': None}})['vazio']
            self.assertIsNone(f['resumo_capturas']['primeira'])
            self.assertIsNone(f['resumo_capturas']['ultima'])
            self.assertIsNone(f['resumo_capturas']['recapturas_sem_mudanca'])
            self.assertEqual((Path(tmp) / m.NOME_CSV).read_text().count('\n'), 1)

    def test_gate_proprio_recusa_csv_com_linha_perdida_antes_de_publicar(self):
        from pipeline.energia import metadados as m
        escrever = base.escreve_csv
        def perder_linha(nome, colunas, linhas):
            return escrever(nome, colunas, list(linhas)[:-1])
        with tempfile.TemporaryDirectory() as tmp, patch.object(base, 'SERIES', tmp), patch.object(base, 'escreve_csv', side_effect=perder_linha):
            with self.assertRaisesRegex(ValueError, 'CSV divergente'):
                m.publicar_historico(self.fontes(60))


class TestHistoricoAntesDaValidacao(unittest.TestCase):
    def test_mesmo_dataset_em_duas_familias_preserva_todas_as_vintages_e_vigencias(self):
        from pipeline.energia import metadados as m
        with tempfile.TemporaryDirectory() as tmp, patch.multiple(base, SERIES=tmp, SILVER=tmp):
            fontes = {}
            for familia, dias in (('familia_a', (16, 17)), ('familia_b', (18,))):
                con = base.conecta_familia(familia)
                for dia in dias:
                    sha = base.sha256_bytes(f'{familia}-{dia}'.encode())
                    base.registra_vintage(con, 'comum', 'mesmo_recurso', 'https://fonte.test', f'2026-10-{dia}T00:00:00Z',
                                          None, sha, 1, 'coleta_direta', 'bronze-teste')
                base.registra_coleta(con, 'comum', 'mesmo_recurso', familia == 'familia_a',
                                     'coleta conferida' if familia == 'familia_a' else 'HTTP 503 na fonte')
                con.commit()
                fontes.update(m.fontes_do_modulo(con, {'id': familia, 'familia': familia, 'datasets': [{'dataset_silver': 'comum'}]}))
                con.close()
            self.assertEqual(set(fontes), {'familia_a/comum', 'familia_b/comum'})
            resultado = m.publicar_historico(fontes, limiar_parquet=1)['comum']
            self.assertEqual(resultado['resumo_capturas']['total_historico'], 3)
            self.assertEqual(resultado['resumo_capturas']['total_capturas'], 2)
            self.assertIsNone(resultado['resumo_capturas']['recapturas_sem_mudanca'], 'não estimar downloads únicos entre famílias')
            self.assertIsNone(resultado['snapshot'])
            self.assertIsNone(resultado['snapshot_sha256'])
            self.assertEqual({f['familia'] for f in resultado['snapshots_familias']}, {'familia_a', 'familia_b'})
            self.assertTrue(all(f['snapshot_sha256'] for f in resultado['snapshots_familias']))
            tentativas = {f['familia']: f['ultima_tentativa'] for f in resultado['snapshots_familias']}
            self.assertTrue(tentativas['familia_a']['ok'])
            self.assertFalse(tentativas['familia_b']['ok'])
            self.assertEqual(tentativas['familia_b']['detalhe'], 'HTTP 503 na fonte')
            with open(Path(tmp) / m.NOME_CSV, newline='') as f:
                linhas = list(csv.DictReader(f, delimiter=';'))
            self.assertEqual(len(linhas), 3)
            self.assertEqual({(l['familia'], l['capturado_em'][-12:-10]) for l in linhas if l['vigente'] == 'true'},
                             {('familia_a', '17'), ('familia_b', '18')})
            # Uma contagem ausente de recapturas não pode virar zero na soma.
            fontes['familia_a/comum']['recapturas_sem_mudanca'] = None
            self.assertIsNone(m.publicar_historico(fontes)['comum']['resumo_capturas']['recapturas_sem_mudanca'])

    def test_todas_as_fontes_antes_de_dados_e_visao_depois(self):
        from pipeline.energia import modulos
        mods = modulos.descobrir()
        ids = [m.REGISTRO['id'] for m in mods]
        dados = ids.index('dados')
        for i, m in enumerate(mods):
            if any(d.get('dataset_silver') for d in m.REGISTRO['datasets']):
                self.assertLessEqual(i, dados, m.REGISTRO['id'])
        self.assertLess(dados, ids.index('visao'))

    def test_primeira_publicacao_e_csv_antigo_validam_e_exportam_parquet_da_versao_final(self):
        from pipeline.energia import metadados as m, run
        from pipeline.energia.fontes import publicacao_dados as pub
        from pipeline.energia.modulos import dados
        for anterior, controle_disponivel in ((False, True), (True, True), (True, False)):
            with self.subTest(csv_anterior=anterior, dados_disponivel=controle_disponivel), tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
                raiz = Path(tmp)
                silver, gold, series = [raiz / n for n in ('silver', 'gold', 'series')]
                for pasta in (silver, gold, series):
                    pasta.mkdir()
                stack.enter_context(patch.multiple(base, RAIZ=tmp, SILVER=str(silver), GOLD=str(gold),
                                                   SERIES=str(series), DB_PATH=str(silver / 'energia.db')))
                def vintage(con, ds, rec, dia):
                    base.registra_vintage(con, ds, rec, 'https://fonte.test', f'2026-10-{dia}T00:00:00Z',
                                          None, base.sha256_bytes(rec.encode()), 1, 'coleta_direta', 'bronze-teste')
                con = base.conecta_familia('tema')
                vintage(con, 'tema', 'anterior', '17')
                con.commit()
                if anterior:
                    m.publicar_historico({'tema': m.fonte_de(con, 'tema', familia='tema')})
                    pub.exporta_parquet(str(series), limiar=1)
                con.close()
                observados = []
                anterior_publicacao = None
                if not controle_disponivel:
                    base.escreve_gold('publicacao.json', {'disponivel': True, 'gerado_em': '2026-10-17T00:00:00Z', 'linhas_historico': 1})
                    anterior_publicacao = (gold / 'publicacao.json').read_bytes()
                stack.enter_context(patch.object(dados, 'LIMIAR_PARQUET', 1))
                def validar(con, ctx):
                    arquivo = series / m.NOME_CSV
                    if not arquivo.exists():
                        observados.append(None)
                        return {'disponivel': True}
                    with arquivo.open(newline='') as f:
                        linhas = list(csv.DictReader(f, delimiter=';'))
                    observados.append([(l['dataset'], l['recurso']) for l in linhas])
                    if not controle_disponivel:
                        return {'disponivel': False, 'motivo': 'Listagens ausentes no cenário sintético'}
                    # Mesmas funções que Dados usa: CSV válido e Parquet relido
                    # célula a célula, forçando o limiar no cenário sintético.
                    validados = dados.valida_csvs(dados.val.hoje_brasilia(), dados.dicionario_arquivos())
                    self.assertNotEqual(validados[m.NOME_CSV]['veredito'], 'reprovado')
                    pub.exporta_parquet(str(series), limiar=1)
                    return {'disponivel': True, 'linhas_historico': len(linhas)}
                def modulo(id_, ordem, familia, dataset, construir, coletar=None):
                    return SimpleNamespace(REGISTRO={'id': id_, 'ordem': ordem, 'gold': f'{id_}.json' if id_ != 'dados' else 'publicacao.json',
                                                     'familia': familia, 'datasets': [{'dataset_silver': dataset}] if dataset else [],
                                                     'arquivos': {}}, construir=construir, coletar=coletar)
                tema = modulo('ultimo_tema', 97, 'tema', 'tema', lambda con, ctx: {'disponivel': True},
                               lambda con, ctx: vintage(con, 'tema', 'recente', '18'))
                controle = modulo('dados', dados.REGISTRO['ordem'], 'catalogos', 'catalogo', validar,
                                   lambda con, ctx: vintage(con, 'catalogo', 'captura_catalogo', '18'))
                visao = modulo('visao', 98, 'visao', None, lambda con, ctx: {'disponivel': True})
                mods = sorted([controle, tema, visao], key=lambda x: (x.REGISTRO['ordem'], x.REGISTRO['id']))
                stack.enter_context(patch.object(run.modulos, 'descobrir', return_value=mods))
                stack.enter_context(patch.object(run.ons, 'DATASETS', {}))
                for obj, attr, retorno in ((run.ons, 'coleta', {}), (run.ccee, 'coleta_direta', {}),
                                            (run.ccee, 'importa_seed', {}), (run.catalogo, 'colhe', {}),
                                            (run.metricas, 'todas', []), (run.validacoes, 'viola_horizonte', []),
                                            (run.modelos, 'construir', ({'disponivel': True}, {'disponivel': True})),
                                            (run.modulo_dados, 'escreve_manifesto', None),
                                            (run.catalogo, 'construir', {'disponivel': True})):
                    stack.enter_context(patch.object(obj, attr, return_value=retorno))
                def construir(nome, fn, *args):
                    return fn(*args) if nome == 'publicacao.json' else {'disponivel': True}
                stack.enter_context(patch.object(run, 'construir', side_effect=construir))
                self.assertEqual(run.main([]), 0)
                esperado = {('tema', 'anterior'), ('tema', 'recente'), ('catalogo', 'captura_catalogo')}
                self.assertEqual(len(observados), 1)
                self.assertIsNotNone(observados[0], 'primeiro CSV não foi validado')
                self.assertEqual(set(observados[0]), esperado, 'Dados validou a versão anterior do CSV')
                csv_path = str(series / m.NOME_CSV)
                parquet_path = str(series / m.NOME_CSV.replace('.csv', '.parquet'))
                equivalente, detalhe, n, diverg, _ = pub.confere_parquet(csv_path, parquet_path)
                self.assertTrue(equivalente, detalhe)
                self.assertEqual((n, diverg), (3, 0))
                meta = json.loads((gold / 'meta.json').read_text())
                self.assertEqual(sum(f['resumo_capturas']['total_historico'] for f in meta['fontes'].values()), 3)
                publicacao = json.loads((gold / 'publicacao.json').read_text())
                if controle_disponivel:
                    self.assertEqual(publicacao['linhas_historico'], 3)
                else:
                    self.assertEqual((gold / 'publicacao.json').read_bytes(), anterior_publicacao)
                    self.assertEqual(meta['golds']['publicacao.json']['gerado_em'], '2026-10-17T00:00:00Z')
                    self.assertTrue(any(r['gold'] == 'publicacao.json' for r in meta['regressoes']))
