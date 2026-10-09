import datetime,unittest,pathlib,json,hashlib,zipfile
from pipeline.eficiencia_trabalho.cursos import classify,parse_date
class CursosContractTest(unittest.TestCase):
 def test_boundary_dates_are_valid(self):
  ref=datetime.date(2026,10,9)
  self.assertEqual(classify(ref,ref,ref),'vigente')
  self.assertEqual(classify(ref,ref-datetime.timedelta(days=1),ref),'vencido')
  self.assertEqual(classify(ref+datetime.timedelta(days=1),ref+datetime.timedelta(days=365),ref),'futuro')
 def test_missing_or_malformed_dates_do_not_become_current(self):
  ref=datetime.date(2026,10,9)
  self.assertEqual(classify(None,ref,ref),'sem-data')
  self.assertEqual(classify(ref,None,ref),'sem-data')
  self.assertIsNone(parse_date('31/02/2026'))
 def test_official_archive_hashes_reproduce(self):
  root=pathlib.Path(__file__).resolve().parents[2];out=root/'public/eficiencia/trabalho-renda/cursos';index=json.loads((out/'indice.json').read_text());raw=(out/'brutos/original.zip').read_bytes()
  self.assertEqual(hashlib.sha256(raw).hexdigest(),index['fonte']['sha256Zip'])
  with zipfile.ZipFile(out/'brutos/original.zip') as z:self.assertEqual(hashlib.sha256(z.read(index['fonte']['arquivoCsv'])).hexdigest(),index['fonte']['sha256Csv'])
 def test_summaries_keep_records_and_distinct_codes_separate(self):
  root=pathlib.Path(__file__).resolve().parents[2];out=root/'public/eficiencia/trabalho-renda/cursos';index=json.loads((out/'indice.json').read_text());records=[]
  for summary in index['porUF']:
   rows=json.loads((out/f'uf-{summary["uf"]}.json').read_text());records+=rows
   self.assertEqual(len(rows),summary['registros']);self.assertEqual(len({r['id'] for r in rows}),summary['codigos']);self.assertEqual(sum(r['status']=='vigente' for r in rows),summary['vigentes'])
  self.assertEqual(len(records),index['totais']['registros']);self.assertEqual(len({r['id'] for r in records}),index['totais']['codigos'])
  self.assertTrue(all(r['id'].isdigit() for r in records));self.assertTrue(index['fonte']['rodape'])
  self.assertGreater(index['totais']['registros'],index['totais']['codigos'])
if __name__=='__main__':unittest.main()
