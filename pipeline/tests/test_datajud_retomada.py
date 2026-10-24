"""Respostas incompletas não viram zero; orçamento deve permitir retomada justa."""
import urllib.error
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from pipeline import common
from pipeline.sources import datajud as d


class RetomadaDataJud(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        p = patch.object(common, 'DB_PATH', str(Path(self.tmp.name)/'silver.db'))
        p.start(); self.addCleanup(p.stop)
        self.con = common.get_db(); self.addCleanup(self.con.close)
        self.cfg = {'datajud': {'base_url':'https://fonte.test', 'api_key_publica':'',
                    'tribunais':['tjsp','tjrj'], 'classes':{'129':'recuperacao_judicial'},
                    'page_size':100, 'max_pages_por_consulta':2, 'pausa_entre_requisicoes_s':0,
                    'serie_inicio':'2026-01'}}

    def test_orcamento_retomado_prioriza_tribunal_pulado_inclusive_apos_falha(self):
        for falhar in [False, True]:
            with self.subTest(falhar=falhar):
                self.con.execute('DROP TABLE IF EXISTS datajud_tentativas')
                relogio = [0]; feitos = []
                def fetch(base, trib, *args):
                    feitos.append(trib); relogio[0] = d.ORCAMENTO_S + 1
                    if falhar: raise TimeoutError('fonte sintética indisponível')
                    return [('processo', '2026-01-01')], False
                with patch.object(d.time, 'monotonic', side_effect=lambda: relogio[0]), \
                     patch.object(d, '_fetch_class', side_effect=fetch), patch.object(d, 'collect_funil', return_value=[]), \
                     patch.object(common, 'save_bronze', return_value=('bronze','sha')), patch.object(common,'record_lineage'):
                    d.collect(self.con,self.cfg); self.con.commit()
                    relogio[0] = 0
                    d.collect(self.con,self.cfg)
                self.assertEqual(feitos, ['tjsp','tjrj'])

    def test_paginacao_truncada_preserva_serie_anterior(self):
        key = 'recuperacao_judicial_tjsp'
        common.insert_obs(self.con,key,[('2026-01-01',9)],'anterior'); self.con.commit()
        with patch.object(d,'_fetch_class',return_value=([('p','2026-01-01')],True)), \
             patch.object(d,'collect_funil',return_value=[]), patch.object(common,'save_bronze',return_value=('b','s')), \
             patch.object(common,'record_lineage'):
            resultado=d.collect(self.con,self.cfg)
        self.con.commit()
        self.assertFalse(next(r for r in resultado if r['key']==key)['ok'])
        self.assertEqual(common.get_series(self.con,key),[('2026-01-01',9)])

    def test_esquema_ausente_nao_e_lista_vazia_de_processos(self):
        for corpo in [{}, {'hits':{}}, {'hits':{'hits':[], 'total':{'value':0,'relation':'gte'}}}]:
            with self.subTest(corpo=corpo), patch.object(d,'_post',return_value=corpo):
                with self.assertRaises(ValueError): d._fetch_class('https://fonte.test','tjsp','129','',100,2,0)

    def test_pagina_curta_incompativel_com_total_e_truncada(self):
        corpo={'hits':{'total':{'value':3,'relation':'eq'}, 'hits':[
            {'_source':{'numeroProcesso':'p','dataAjuizamento':'2026-01-01'},'sort':[1,2]}]}}
        with patch.object(d,'_post',return_value=corpo):
            docs,truncado=d._fetch_class('https://fonte.test','tjsp','129','',100,2,0)
        self.assertEqual(len(docs),1); self.assertTrue(truncado)

    def test_403_nao_repete_requisicao_nem_aguarda(self):
        erro = urllib.error.HTTPError('https://fonte.test',403,'Forbidden',{},None)
        with patch('urllib.request.urlopen',side_effect=erro) as req, patch.object(d.time,'sleep') as pausa:
            with self.assertRaises(RuntimeError): d._post('https://fonte.test',{},'')
        self.assertEqual(req.call_count,1);pausa.assert_not_called()

    def test_funil_tem_janela_propria_sem_consumir_toda_a_coleta_de_series(self):
        relogio=[0]; feitos=[]
        def post(*args,**kwargs):
            relogio[0]=d.ORCAMENTO_S/3+1
            return {'hits':{'total':{'value':1}},'aggregations':{'movs':{'buckets':[]}}}
        def fetch(base,trib,*args):
            feitos.append(trib);return [],False
        with patch.object(d.time,'monotonic',side_effect=lambda:relogio[0]), patch.object(d.time,'sleep'), \
             patch.object(d,'_post',side_effect=post),patch.object(d,'_fetch_class',side_effect=fetch), \
             patch.object(common,'save_bronze',return_value=('b','s')),patch.object(common,'record_lineage'):
            resultados=d.collect(self.con,self.cfg)
        self.assertTrue(feitos)
        self.assertTrue(next(r for r in resultados if r['key']=='funil_tjsp')['ok'])
        self.assertFalse(next(r for r in resultados if r['key']=='funil_tjrj')['ok'])


if __name__=='__main__': unittest.main()
