"""Rejeitar a gold não pode deixar downloads da candidata no lugar dos aprovados."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pipeline.energia import base, run
from scripts.energia_publicacao_retida import descrever


class RetencaoOperacao(unittest.TestCase):
    def test_alerta_nao_confunde_manifesto_novo_com_dado_atualizado(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)
            (p/'manifesto.json').write_text('{"gerado_em":"2026-10-24"}')
            (p/'pld.json').write_text('{"gerado_em":"2026-09-30"}')
            texto = descrever(p)
            self.assertIn('pld.json`: 2026-09-30', texto)
            self.assertNotIn('2026-10-24', texto)
            self.assertIn('arquivo ausente ou ilegível', texto)

    def test_todas_as_operacoes_preservam_bytes_apos_rejeicao(self):
        for nome, arquivos in run.ARQUIVOS_OPERACAO.items():
            for existe in [True, False]:
                with self.subTest(gold=nome, anterior=existe), tempfile.TemporaryDirectory() as tmp:
                    p = Path(tmp); gold = p/'public/energia/gold'; series = p/'public/energia/series'
                    gold.mkdir(parents=True); series.mkdir(parents=True)
                    with patch.multiple(base, RAIZ=tmp, GOLD=str(gold), SERIES=str(series)):
                        anterior = {'disponivel': True, 'gerado_em': '2026-09-30', 'valor': 1}
                        if existe:
                            base.escreve_gold(nome, anterior)
                            for arq in arquivos: (series/arq).write_bytes(b'data;valor\n2026-09-30;1\n')
                        def builder():
                            for arq in arquivos: (series/arq).write_bytes(b'data;valor\n2026-10-24;999\n')
                            return {'disponivel': False, 'motivo': 'horizonte inválido após construção'}
                        regressoes, falhas = [], []
                        run.publicar_operacao(nome, builder, regressoes, falhas)
                        for arq in arquivos:
                            if existe: self.assertEqual((series/arq).read_bytes(), b'data;valor\n2026-09-30;1\n')
                            else: self.assertFalse((series/arq).exists())
                        if existe:
                            self.assertEqual(base.le_gold(nome), anterior)
                            self.assertEqual(len(regressoes), 1)
                        else:
                            self.assertEqual(len(falhas), 1)

    def test_operacao_valida_instala_csv_e_gold_juntos(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp); gold = p/'public/energia/gold'; series = p/'public/energia/series'
            gold.mkdir(parents=True); series.mkdir(parents=True)
            with patch.multiple(base, RAIZ=tmp, GOLD=str(gold), SERIES=str(series)):
                def builder():
                    (series/'carga_diaria.csv').write_text('valor\n2\n')
                    return {'disponivel': True, 'valor': 2}
                run.publicar_operacao('carga.json', builder, [], [])
                self.assertEqual(base.le_gold('carga.json')['valor'], 2)
                self.assertEqual((series/'carga_diaria.csv').read_text(), 'valor\n2\n')


if __name__ == '__main__':
    unittest.main()
