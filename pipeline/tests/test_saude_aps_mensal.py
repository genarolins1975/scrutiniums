"""Cobertura mensal e barreiras contra corrupção da publicação, sem rede."""
import copy
import csv
import os
import tempfile
import unittest
from unittest.mock import patch

from pipeline.eficiencia_saude import base, gold, mensal, padroniza


class TestApsMensal(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dados = mensal.constroi()
        cls.raw = base.le_json_gz(os.path.join(base.SEED, 'relatorio_aps', 'cobertura_aps_3550308.json.gz'))

    def test_cobertura_real_sem_duplicatas(self):
        d = self.dados
        self.assertEqual(len(d['linhas']), 1742)
        self.assertEqual(len({(r['codigo_ibge'], r['competencia']) for r in d['linhas']}), 1742)
        self.assertEqual((d['competencias'][0], d['competencias'][-1]), ('2021-01', '2026-07'))
        self.assertEqual(len(d['competencias']), 67)
        self.assertTrue(all(c['capitais_com_valor'] == 26 for c in d['cobertura']))
        self.assertEqual(d['hash_dados'], mensal.constroi()['hash_dados'])

    def test_dezembros_iguais_a_serie_anual(self):
        mensal_por_par = {(r['codigo_ibge'], r['competencia']): r for r in self.dados['linhas']}
        obs = padroniza.todas()
        for o in obs:
            if o['indicador'] == 'sau.aps.cobertura_potencial':
                self.assertEqual(o['valor'], mensal_por_par[o['ente'], f"{o['ano']}-12"]['cobertura_pct'])
            if o['indicador'] == 'sau.aps.equipes':
                self.assertEqual(o['valor'], mensal_por_par[o['ente'], f"{o['ano']}-12"][o['componente']])

    def test_2021_fica_com_metodo_anterior(self):
        self.assertTrue(all(r['metodo'] == 'regra_anterior_2021' for r in self.dados['linhas'] if r['competencia'].startswith('2021')))
        self.assertTrue(any(r['cobertura_pct'] > 100 for r in self.dados['linhas']))

    def test_cadastro_recente_e_provisorio_mesmo_com_campos_numericos(self):
        recentes = [r for r in self.dados['linhas'] if r['competencia'].startswith('2026')]
        self.assertEqual(len(recentes), 182)
        self.assertTrue(all(r['status'] == 'PROVISORIO' for r in recentes))

    def test_ausencia_nao_vira_zero_e_lacuna_nao_interpolada(self):
        r = copy.deepcopy(self.raw[-1])
        r['qtEsf'] = None
        r['qtEcr'] = 0
        d = mensal.normaliza([r], 3550308)
        self.assertIsNone(d[0]['esf'])
        self.assertEqual(d[0]['ecr'], 0)
        self.assertEqual(d[0]['status'], 'INCOMPLETO')
        self.assertEqual(len(d), 1)

    def test_rejeita_corrupcao_de_identidade_e_valor(self):
        for campo, valor in [('coMunicipioIbge', '999999'), ('nuComp', '13/2026'), ('qtEsf', True), ('qtEsf', -1), ('qtEsf', 1.5), ('qtEsf', float('nan')), ('qtPopulacao', 0), ('qtCobertura', 1)]:
            with self.subTest(campo=campo, valor=valor):
                r = {**self.raw[-1], campo: valor}
                with self.assertRaises(ValueError):
                    mensal.normaliza([r], 3550308)
        with self.assertRaises(ValueError):
            mensal.normaliza([self.raw[-1], self.raw[-1]], 3550308)

    def test_hash_seed_divergente_impede_construcao(self):
        manifesto = copy.deepcopy(base.le_manifesto())
        manifesto['capturas']['relatorio_aps_cobertura']['arquivos']['3550308']['sha256'] = 'invalido'
        with patch.object(base, 'le_manifesto', return_value=manifesto):
            with self.assertRaisesRegex(ValueError, 'hash do seed divergente'):
                gold.constroi()

    def test_csv_reconstroi_valores_e_proveniencia(self):
        with tempfile.TemporaryDirectory() as pasta:
            caminho = os.path.join(pasta, 'mensal.csv')
            mensal.publica(self.dados, caminho)
            with open(caminho, encoding='utf-8', newline='') as f:
                linhas = list(csv.DictReader(f))
            self.assertEqual(len(linhas), 1742)
            for exportada, origem in zip(linhas, self.dados['linhas']):
                self.assertEqual(float(exportada['cobertura_pct']), origem['cobertura_pct'])
                self.assertEqual(exportada['hash_dados'], self.dados['hash_dados'])
                self.assertTrue(exportada['fonte_url'].startswith('https://relatorioaps-prd.saude.gov.br/'))
                self.assertEqual(len(exportada['sha256_seed']), 64)
