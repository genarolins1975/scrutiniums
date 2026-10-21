import copy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pipeline.judiciario.run import extract, validate, publish, divide, weighted_rate, months, OUT


class JudiciarioTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = extract()

    def test_source_reconciliation(self):
        d = self.data
        self.assertEqual([r['novos'] for r in d['ramos']], [28_300_000, 6_400_000, 5_200_000])
        self.assertEqual(sum(r['pendentes'] for r in d['ramos']), 74_400_000)
        self.assertEqual(d['nacional']['pendentesMilhoes'], 75.5)
        self.assertNotEqual(sum(r['pendentes'] for r in d['ramos']), 75_500_000)
        self.assertEqual([r['cejuscs'] for r in d['ramos']], [1843, 154, 144])
        self.assertEqual(d['ramos'][1]['execucao'], 63)
        self.assertEqual(d['ramos'][2]['conhecimento'], 8)

    def test_tribunal_times_independent_examples(self):
        rows = {r['sigla']: r for r in self.data['tribunais']}
        self.assertEqual((rows['TJSP']['tempoBaixados'], rows['TJSP']['idadePendentes']), (47, 58))
        self.assertEqual((rows['TJRR']['tempoBaixados'], rows['TJRR']['idadePendentes']), (10, 21))
        self.assertEqual(months('2 anos e 8 meses'), 32)
        self.assertEqual(months('8 meses'), 8)
        self.assertEqual(months('1 ano e 1 mês'), 13)
        self.assertEqual((rows['TRF3']['tempoBaixados'],rows['TRF3']['idadePendentes']), (46,61))
        self.assertEqual((rows['TRT3']['tempoBaixados'],rows['TRT3']['idadePendentes']), (8,21))
        self.assertEqual(rows['TRF3']['ipcJus'],80)
        self.assertEqual(rows['TRT3']['ipcJus'],100)
        self.assertIsNone(rows['TRF3']['uf'])

    def test_financial_source_and_residual(self):
        finance=self.data['financeiro']
        self.assertEqual(finance['total'],164_649_661_456)
        self.assertEqual(finance['series']['nacional'][0]['valor'],93_300_000_000)
        self.assertEqual(finance['series']['nacional'][-1]['valor'],164_600_000_000)
        self.assertEqual(len(finance['series']['estadual']),17)
        self.assertEqual(self.data['ramos'][0]['conciliacaoDespesas']['residuo'],0)
        self.assertEqual(self.data['ramos'][2]['conciliacaoDespesas']['residuo'],2)
        self.assertEqual(self.data['ramos'][0]['iadOficial'],111.1)
        self.assertNotEqual(self.data['ramos'][0]['iadOficial'],self.data['ramos'][0]['atendimentoAproximado'])
        components={r['nome']:r['valor'] for r in finance['pessoal']}
        self.assertEqual(components['Pessoal e encargos'],115_793_502_805)
        self.assertEqual(components['Terceirizados(as)'],6_103_408_415)
        self.assertEqual(finance['pessoalTotal'],148_461_823_305)

    def test_published_per_capita_and_stopped_stock(self):
        d=self.data
        self.assertEqual(d['porHabitante']['valor'],771.48)
        self.assertEqual(d['porHabitante']['semInativos'],653.38)
        self.assertEqual((d['porHabitante']['pib'],d['porHabitante']['inativosPercentual']),(1.3,15.3))
        rows={r['sigla']:r for r in d['tribunais']}
        self.assertEqual((rows['TJDFT']['despesaPorHabitante'],rows['TJDFT']['despesaPorHabitanteSemInativos']),(1412.8,1152.3))
        self.assertEqual(rows['TJAM']['despesaPorHabitante'],251.7)
        self.assertIsNone(rows['TRF3']['despesaPorHabitante'])
        self.assertEqual(d['ramos'][0]['despesaPorHabitante'],497.3)
        self.assertEqual((d['acervo']['suspensos']['processosMilhoes'],d['acervo']['suspensos']['percentualPendentes']),(16.4,21.7))
        self.assertEqual((d['acervo']['execucaoFiscal']['percentualPendentes'],d['acervo']['execucaoFiscal']['congestionamento']),(22.0,72.4))
        bad=copy.deepcopy(d)
        bad['tribunais'][0]['despesaPorHabitante']=None
        with self.assertRaises(ValueError): validate(bad)

    def test_second_wave_fields_as_published(self):
        d=self.data
        rows={r['sigla']:r for r in d['tribunais']}
        self.assertEqual((rows['TJAM']['execucaoBaixados'],rows['TJAM']['execucaoPendentes']),(87,42))
        self.assertEqual((rows['TRF3']['execucaoBaixados'],rows['TRF3']['execucaoPendentes']),(81,81))
        self.assertEqual((rows['TRT4']['execucaoBaixados'],rows['TRT4']['execucaoPendentes']),(33,58))
        self.assertEqual((rows['TJPI']['recorribilidadeInterna'],rows['TJPI']['recorribilidadeExterna']),(0.0,31.4))
        self.assertEqual(rows['TRF4']['recorribilidadeExterna'],43.8)
        self.assertEqual(rows['TJRJ']['justicaGratuita'],62.0)
        self.assertIsNone(rows['TRT2']['justicaGratuita'])
        self.assertEqual(d['magistrados']['porCemMil'],8.95)
        self.assertEqual(d['justicaGratuita']['percentual'],30.4)
        self.assertEqual(d['criminal']['execucoesPenaisPendentesMilhoes'],2.6)
        self.assertEqual({l['indicador']:l['brasil'] for l in d['comparacaoEuropa']['linhas']}['Tempo de Giro do Acervo'],'1a e 8m')

    def test_history_keeps_publication_and_absence(self):
        d=self.data
        rows={r['sigla']:r for r in d['tribunais']}
        self.assertEqual(d['historicoTempos']['anos'],[2021,2022,2023,2024,2025])
        self.assertEqual([(h['tempoBaixados'],h['idadePendentes']) for h in rows['TJAM']['historico']],[(16,39),(17,42),(14,40),(16,52),(47,24)])
        self.assertIsNone(rows['TRF6']['historico'][0]['tempoBaixados'])
        self.assertIn('TRT9 2022',d['historicoTempos']['ausentes'])
        self.assertTrue(all(r['historico'][-1]['tempoBaixados']==r['tempoBaixados'] for r in d['tribunais']))

    def test_no_silent_missing_or_zero_denominator(self):
        for a, b in [(None, 1), (1, None), (1, 0), (1, -1), (float('nan'), 1), (True, 1)]:
            self.assertIsNone(divide(a, b))
        self.assertEqual(divide(0, 10), 0)
        self.assertEqual(weighted_rate([(9, 10), (1, 100)]), 10 / 110)
        self.assertIsNone(weighted_rate([(9, 10), (None, 100)]))

    def test_duplicates_and_incompatible_rows_rejected(self):
        for change in ['duplicate', 'unit', 'branch', 'ratio']:
            with self.subTest(change=change):
                d = copy.deepcopy(self.data)
                if change == 'duplicate': d['tribunais'][0] = d['tribunais'][1]
                if change == 'unit': d['tribunais'][0]['tempoBaixados'] = -1
                if change == 'branch': d['tribunais'][0]['ramo'] = 'federal'
                if change == 'ratio': d['ramos'][0]['atendimentoAproximado'] = 0
                with self.assertRaises(ValueError): validate(d)

    def test_repeatable_outputs_and_last_valid_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory) / 'gold'
            publish(self.data, out)
            before = {p.name:p.read_bytes() for p in out.iterdir()}
            publish(self.data, out)
            publish(self.data, out, check=True)
            self.assertEqual(before, {p.name:p.read_bytes() for p in out.iterdir()})
            bad = copy.deepcopy(self.data)
            bad['tribunais'] = []
            with self.assertRaises(ValueError): publish(bad, out)
            self.assertEqual(before, {p.name:p.read_bytes() for p in out.iterdir()})

    def test_checksum_failure_stops_extraction(self):
        with patch('pipeline.judiciario.run.HASHES', {'texto':'0'*64, 'recorte':'0'*64}):
            with self.assertRaisesRegex(ValueError, 'Integridade'): extract()

    def test_checked_in_outputs_match_source(self):
        publish(self.data, OUT, check=True)


if __name__ == '__main__':
    unittest.main()
