import hashlib
import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from pipeline.judiciario import internacional as module


class InternacionalJudiciarioTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.files = module.gerar()
        cls.latest = json.loads(cls.files['internacional.json'])
        cls.history = json.loads(cls.files['internacional-historico.json'])

    def test_reproducao_exata_dos_arquivos(self):
        for name, content in self.files.items():
            self.assertEqual((module.OUT / name).read_bytes(), content, name)

    def test_edicao_explicita_e_cobertura_sem_promover_2026(self):
        self.assertEqual(self.latest['edicao'], '2025')
        self.assertEqual(len(self.latest['paises']), 143)
        self.assertEqual(len({p['iso3'] for p in self.latest['paises']}), 143)
        self.assertNotIn('2026', self.history['edicoes'])
        self.assertEqual(self.history['edicoes'], ['2015', '2016', '2017-2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'])

    def test_colunas_e_localizacao_dos_escores(self):
        self.assertEqual(self.latest['colunas'], module.COLUNAS)
        brazil = next(p for p in self.latest['paises'] if p['iso3'] == 'BRA')
        self.assertAlmostEqual(brazil['escores'][module.COLUNAS.index('f_7_5')], .26832462592419598, places=15)
        self.assertAlmostEqual(brazil['escores'][module.COLUNAS.index('f_7_1')], .654269553091126, places=15)
        self.assertEqual(brazil['renda'], 'Upper-Middle')
        for country in self.latest['paises']:
            self.assertEqual(len(country['escores']), 16)
            self.assertTrue(all(v is None or 0 <= v <= 1 for v in country['escores']))

    def test_edicao_conjunta_nao_vira_dois_anos(self):
        brazil = [r for r in self.history['observacoes'] if r['iso3'] == 'BRA']
        self.assertEqual(sum(r['edicao'] == '2017-2018' for r in brazil), 1)
        self.assertFalse(any(r['edicao'] in ('2017', '2018') for r in brazil))

    def test_manifesto_confere_e_csv_tem_todos_os_indicadores(self):
        manifest = json.loads(self.files['internacional-manifesto.json'])
        for name, sha in manifest['arquivos'].items():
            self.assertEqual(hashlib.sha256(self.files[name]).hexdigest(), sha)
        import csv
        rows = list(csv.reader(io.StringIO(self.files['internacional.csv'].decode('utf-8-sig')), delimiter=';'))
        self.assertEqual(len(rows), 1 + 143 * 16)
        self.assertTrue(all(row[2] == '2025' and row[8] == 'escore de 0 a 1' for row in rows[1:]))

    def test_recusa_original_alterado_antes_de_gerar(self):
        with tempfile.TemporaryDirectory() as directory:
            seed = Path(directory)
            (seed / 'wjp-origem.json').write_bytes((module.SEED / 'wjp-origem.json').read_bytes())
            (seed / 'wjp-historico.xlsx').write_bytes(b'arquivo alterado')
            with patch.object(module, 'SEED', seed), self.assertRaisesRegex(ValueError, 'original fixado'):
                module.gerar()

    def test_recusa_duplicata_historica_e_valor_fora_da_escala(self):
        rows, definitions = module.ler_planilha((module.SEED / 'wjp-historico.xlsx').read_bytes())
        duplicate = next(r for r in rows if r['Country Code'] == 'BRA' and r['Year'] == '2024').copy()
        with patch.object(module, 'ler_planilha', return_value=(rows + [duplicate], definitions)), self.assertRaisesRegex(ValueError, 'Duplicata'):
            module.gerar()
        changed = [r.copy() for r in rows]
        next(r for r in changed if r['Country Code'] == 'BRA' and r['Year'] == '2025')['f_7_5'] = '1.2'
        with patch.object(module, 'ler_planilha', return_value=(changed, definitions)), self.assertRaisesRegex(ValueError, 'escala'):
            module.gerar()

    def test_leitor_nao_confunde_celula_vazia_com_zero(self):
        strings = ['Country', 'Year', 'País de teste', *module.COLUNAS]
        xml = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
        headers = ''.join(f'<c r="{chr(67+i)}1" t="s"><v>{i+3}</v></c>' for i in range(16))
        rows = f'<row r="1">{headers}</row><row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2" t="s"><v>1</v></c></row><row r="3"><c r="A3" t="s"><v>2</v></c><c r="B3"><v>2025</v></c><c r="C3"><v>0</v></c><c r="D3"/></row>'
        content = io.BytesIO()
        with zipfile.ZipFile(content, 'w') as book:
            book.writestr('xl/sharedStrings.xml', f'<sst xmlns="{xml}">'+''.join(f'<si><t>{s}</t></si>' for s in strings)+'</sst>')
            book.writestr('xl/worksheets/sheet1.xml', f'<worksheet xmlns="{xml}"><sheetData>{rows}</sheetData></worksheet>')
        parsed, _ = module.ler_planilha(content.getvalue())
        self.assertEqual(parsed[0]['f_7'], '0')
        self.assertIsNone(parsed[0].get('f_7_1'))


if __name__ == '__main__':
    unittest.main()
