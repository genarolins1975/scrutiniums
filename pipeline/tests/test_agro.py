"""Contratos reais preservados e modelos de leitura oficial do Agro."""
import copy
import csv
import gzip
import hashlib
import io
import json
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path
from pipeline.agro import run,capturar,economia,sociedade

class AgroDadosTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest,cls.fontes=run.carregar_fontes();cls.dados=run.normalizar(cls.manifest,cls.fontes)
    def test_reproducao_offline_e_hashes(self):
        a=run.gerar();b=run.gerar();self.assertEqual(a,b)
        for name,data in a.items():self.assertEqual((run.OUT/name).read_bytes(),data,name)
        manifest=json.loads(a['manifesto.json'])
        for name,sha in manifest['arquivos'].items():self.assertEqual(hashlib.sha256(a[name]).hexdigest(),sha)
    def test_credito_reconcilia_finalidades_ufs_programas_e_serie(self):
        c=self.dados['credito'];self.assertEqual(len(c['ufs']),27);self.assertAlmostEqual(c['nacional']['valor'],344411165460.75,places=2)
        for key in ['ufs','programas']:self.assertAlmostEqual(sum(r['valor'] for r in c[key]),c['nacional']['valor'],places=2)
        self.assertEqual(c['nacional']['contratos'],2538458)
        for r in c['ufs']:self.assertAlmostEqual(sum(r[k] for k in ['custeio','investimento','comercializacao','industrializacao']),r['valor'],places=2)
    def test_nao_importa_variacao_de_janela_nao_adjacente(self):
        c=self.dados['credito'];a=c['anteriorAdjacente'];self.assertEqual(a['inicio'],'2024-08');self.assertEqual(a['fim'],'2025-07')
        self.assertEqual(a['mesesComDado'],12)
        selected=[r for r in self.fontes['credito']['serie_mensal'] if '2024-08'<=r['mes']<='2025-07']
        self.assertAlmostEqual(a['valor'],sum(r['valor'] for r in selected),places=2)
        self.assertNotAlmostEqual(a['variacaoPct'],self.fontes['credito']['kpis']['var_12m_pct'],places=2)
    def test_meses_parciais_fora_da_janela_e_sinais_sidra(self):
        self.assertTrue(any(r['parcial'] for r in self.dados['credito']['serie']))
        self.assertEqual(run.numero('-'),0);self.assertEqual(run.numero('0'),0)
        for sinal in ['X','..','...','',None]:self.assertIsNone(run.numero(sinal))
    def test_cadeias_ausentes_no_topo_nao_viram_zero(self):
        p=self.dados['credito']['produtos'];self.assertFalse(any(r['cadeia']=='leite' for r in p));self.assertFalse(any(r['cadeia']=='feijao' for r in p))
        self.assertTrue(any(r['cadeia']=='soja' and r['valor']>0 for r in p));self.assertIn('15 maiores',self.dados['credito']['coberturaProdutos'])
    def test_censo_ocupacional_e_formal_sao_universos_distintos(self):
        t=self.dados['trabalho'];self.assertEqual(t['formal']['cnae'],'A');self.assertEqual(t['formal']['estoque'],1865364)
        self.assertEqual(len(t['ocupacoes']),28);self.assertTrue(all(r['ano']==2022 for r in t['ocupacoes']))
        self.assertEqual(len({r['id'] for r in t['ocupacoes']}),28);self.assertIn('não distingue formalidade',t['universoOcupacao'])
        self.assertNotIn('admissoes',t['formal'])
    def test_perfis_preservam_total_publicado_e_separam_rendimento_de_contagem(self):
        rows=self.dados['trabalho']['perfisOcupacao']
        self.assertEqual(len(rows),84)
        self.assertEqual(len({(r['id'],r['sexo']) for r in rows}),84)
        for total in self.dados['trabalho']['ocupacoes']:
            profile=next(r for r in rows if r['id']==total['id'] and r['sexo']=='Total')
            self.assertEqual(profile['pessoas'],total['pessoas'])
            self.assertEqual(profile['rendaMediana'],total['rendaMediana'])
        self.assertEqual({r['sexo'] for r in rows},{'Total','Homens','Mulheres'})

    def test_ausencia_de_producao_e_nao_substituida_por_credito(self):
        self.assertEqual(self.dados['producao'],[]);self.assertTrue(any(b['id']=='producao' for b in self.dados['bloqueios']))
    def test_csv_cobre_todas_ufs_e_metadados(self):
        records=list(csv.DictReader(io.StringIO(run.gerar()['credito-ufs.csv'].decode('utf-8-sig')),delimiter=';'))
        self.assertEqual(len(records),27*6);self.assertEqual(len({r['Código IBGE'] for r in records}),27)
        self.assertTrue(all(r['Fonte'].startswith('https://') and r['Limite'] for r in records))
    def test_fonte_alterada_e_rejeitada_antes_de_gerar(self):
        with tempfile.TemporaryDirectory() as folder:
            dest=Path(folder)
            for p in run.SEED.iterdir():
                if p.is_file(): (dest/p.name).write_bytes(p.read_bytes())
            file=dest/self.manifest['fontes'][0]['arquivo'];file.write_bytes(file.read_bytes()+b'x')
            with self.assertRaisesRegex(ValueError,'alterado'):run.carregar_fontes(dest)
    def test_duplicata_e_janela_incompleta_sao_rejeitadas(self):
        source=copy.deepcopy(self.fontes);source['credito']['ufs'][1]=source['credito']['ufs'][0]
        with self.assertRaisesRegex(ValueError,'duplicada'):run.normalizar(self.manifest,source)
        source=copy.deepcopy(self.fontes);source['credito']['serie_mensal']=[r for r in source['credito']['serie_mensal'] if r['mes']!='2026-01']
        with self.assertRaisesRegex(ValueError,'12 meses'):run.normalizar(self.manifest,source)
    def test_termos_ipca_e_alimentacao_nao_se_trocam(self):
        d=self.dados;self.assertIn('não inflação de alimentos',d['inflacao']['limite']);self.assertEqual(d['alimentos']['fonte'],'alimentacao')
        self.assertEqual({r['year'] for r in d['alimentos']['observacoes']},{2023,2024})
    def test_geometria_oficial_preservada_sem_aproximacao(self):
        source=next(s for s in self.manifest['fontes'] if s['id']=='geometria');raw=(run.ROOT/source['arquivoRepositorio']).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(),source['sha256Original']);self.assertEqual(len(self.fontes['geometria']['features']),27)

class AgroEconomiaTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifesto,cls.coletas=economia.carregar();cls.e=economia.normalizar(cls.coletas)
    def test_snapshot_publica_economia_e_fontes_coletadas(self):
        manifest,fontes=run.carregar_fontes();dados=run.normalizar(manifest,fontes)
        self.assertEqual(dados['economia'],self.e)
        ids={f['id'] for f in dados['fontes']};self.assertTrue({'cnt','lspa','comex'}<=ids)
        for f in dados['fontes']:
            if f['estadoAcesso']=='COLETA_OFICIAL':self.assertTrue(f['capturadoEm'] and f['url'].startswith('https://'))
    def test_participacao_do_valor_adicionado_usa_quatro_trimestres_consecutivos(self):
        p=self.e['pib'];u=p['ultimos4'];ult=p['trimestres'][-4:]
        self.assertEqual((u['inicio'],u['fim']),(ult[0]['periodo'],ult[-1]['periodo']))
        self.assertAlmostEqual(u['participacaoVa'],100*sum(t['agro'] for t in ult)/sum(t['va'] for t in ult))
        for t in p['trimestres']:self.assertLessEqual(abs(t['agro']+t['industria']+t['servicos']-t['va']),max(10,t['va']*1e-4))
        for a in p['anual']:self.assertEqual(len([t for t in p['trimestres'] if t['periodo'].startswith(str(a['ano']))]),4)
        self.assertEqual(p['crescimento']['acumulado4'][-1]['periodo'],u['fim'])
    def test_safra_soma_producao_das_safras_sem_somar_areas(self):
        prods={p['id']:p for p in self.e['safra']['produtos']}
        for total,partes in [('milho',['milho1','milho2']),('feijao',['feijao1','feijao2','feijao3'])]:
            for i,linha in enumerate(prods[total]['anos']):
                self.assertEqual(linha['producao'],sum(prods[p]['anos'][i]['producao'] for p in partes))
                self.assertIsNone(linha['area']);self.assertIsNone(linha['rendimento'])
        self.assertTrue(all(a['rendimento'] is None for a in prods['graos']['anos']))
        self.assertEqual(prods['graos']['anos'][-1]['mesEstimativa'],self.e['safra']['mesReferencia'])
    def test_exportacoes_reconciliam_ano_meses_e_acumulado(self):
        c=self.e['comercio'];x=c['exportacoes'];ano=int(c['ultimoMes'][:4]);mes=int(c['ultimoMes'][5:])
        anos=[r['ano'] for r in x['anual']];self.assertEqual(anos,list(range(economia.INICIO_COMEX,c['anoCompleto']+1)))
        for r in x['anual']:self.assertTrue(0<r['agro']<r['total'])
        self.assertEqual(len(x['mensal']),12+mes)
        self.assertAlmostEqual(sum(r['agro'] for r in x['mensal'] if r['mes'].startswith(str(ano))),x['acumulado']['agro'],places=0)
        self.assertAlmostEqual(sum(r['agro'] for r in x['mensal'] if r['mes'].startswith(str(ano-1)) and int(r['mes'][5:])<=mes),x['acumulado']['agroAnterior'],places=0)
        self.assertAlmostEqual(sum(r['fob'] for r in x['composicao']),x['anual'][-1]['agro'],places=0)
        self.assertTrue(all(r['capitulo'] in economia.CAPITULOS_AGRO for r in x['composicao']))
        for d in [x['destinos'],c['soja']['destinos'],c['insumos']['origensFertilizantes']]:
            self.assertAlmostEqual(sum(p['participacao'] for p in d['paises']),100);self.assertEqual(d['ano'],c['anoCompleto'])
        self.assertAlmostEqual(x['destinos']['fob'],x['anual'][-1]['agro'],places=0)
    def test_relacao_de_troca_divide_valores_unitarios_do_mesmo_periodo(self):
        c=self.e['comercio'];fert={r['ano']:r for r in c['insumos']['fertilizantes']}
        for r in c['relacaoTroca']:
            self.assertAlmostEqual(r['relacao'],fert[r['ano']]['valorUnitario']/r['soja']);self.assertEqual(r['meses'],fert[r['ano']]['meses'])
        m=c['insumos']['mesmoPeriodo'];self.assertEqual([r['meses'] for r in m['soja']],[r['meses'] for r in m['fertilizantes']])
        for r in c['insumos']['fertilizantes']:
            self.assertAlmostEqual(r['fob'],sum(next(a['fob'] for a in p['anos'] if a['ano']==r['ano']) for p in c['insumos']['posicoes']),places=0)
    def test_mes_ausente_no_comex_e_recusado(self):
        bundle=copy.deepcopy(self.coletas['comex']);q=bundle['consultas']['capitulosMensalAtual']
        q['resposta']=[r for r in q['resposta'] if r['monthNumber']!='01']
        with self.assertRaisesRegex(ValueError,'Meses incompletos'):economia.normalizar_comex(bundle)
    def test_setores_que_nao_somam_sao_recusados(self):
        bundle=copy.deepcopy(self.coletas['cnt']);resp=bundle['consultas']['valores']['resposta']
        serie=next(r for r in resp[0]['resultados'] if '90687' in r['classificacoes'][0]['categoria'])['series'][0]['serie'];chave=sorted(serie)[-1];serie[chave]=str(float(serie[chave])*2)
        with self.assertRaisesRegex(ValueError,'não reconciliam'):economia.normalizar_cnt(bundle)
    def test_coleta_identica_nao_altera_manifesto_e_alterada_e_recusada(self):
        with tempfile.TemporaryDirectory() as folder:
            dest=Path(folder)
            for p in run.SEED.iterdir():
                if p.is_file():(dest/p.name).write_bytes(p.read_bytes())
            antes={p.name:p.read_bytes() for p in dest.iterdir()}
            r=economia.gravar(self.coletas,dest,agora='2099-01-01T00:00:00+00:00')
            self.assertEqual(r['atualizadas'],[]);self.assertEqual({p.name:p.read_bytes() for p in dest.iterdir()},antes)
            novo=copy.deepcopy(self.coletas);novo['lspa']['consultas']['safra']['url']+='&x=1'
            r=economia.gravar(novo,dest,agora='2099-01-01T00:00:00+00:00');self.assertEqual(r['atualizadas'],['lspa.json.gz'])
            m=json.loads((dest/'coletas.json').read_text());self.assertEqual(next(f for f in m['fontes'] if f['id']=='lspa')['capturadoEm'],'2099-01-01T00:00:00+00:00')
            self.assertNotEqual(next(f for f in m['fontes'] if f['id']=='cnt')['capturadoEm'],'2099-01-01T00:00:00+00:00')
            (dest/'comex.json.gz').write_bytes((dest/'comex.json.gz').read_bytes()+b'x')
            with self.assertRaisesRegex(ValueError,'alterado'):economia.carregar(dest)
    def test_coleta_invalida_nao_grava(self):
        with tempfile.TemporaryDirectory() as folder:
            dest=Path(folder);(dest/'marcador').write_text('x')
            ruim=copy.deepcopy(self.coletas);ruim['lspa']['ultimoPeriodo']='209912'
            with self.assertRaises(ValueError):economia.gravar(ruim,dest)
            self.assertEqual([p.name for p in dest.iterdir()],['marcador'])


class AgroSociedadeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _,cls.coletas=economia.carregar();cls.e=sociedade.normalizar(cls.coletas)
    def test_censo_familiar_e_nao_familiar_somam_o_total(self):
        t=self.e['produtores']['tipologia']
        for k in ['estabelecimentos','area','pessoal','valorProducao']:
            self.assertLessEqual(abs(t['familiar'][k]+t['naoFamiliar'][k]-t['total'][k]),max(2,t['total'][k]*1e-4))
        self.assertEqual(sum(g['estabelecimentos'] or 0 for g in self.e['produtores']['gruposArea']),t['total']['estabelecimentos'])
    def test_tipologia_que_nao_soma_e_recusada(self):
        b=copy.deepcopy(self.coletas['censoagro']);resp=b['consultas']['pessoal']['resposta']
        r=next(r for r in resp[0]['resultados'] if '46304' in r['classificacoes'][0]['categoria']);r['series'][0]['serie']['2017']=str(float(r['series'][0]['serie']['2017'])*2)
        with self.assertRaisesRegex(ValueError,'não somam'):sociedade.normalizar_censo(b)
    def test_pnadc_parcela_e_razao_do_mesmo_trimestre(self):
        for r in self.e['trabalho']['trimestres']:
            self.assertAlmostEqual(r['participacao'],100*r['ocupadosAgro']/r['ocupadosTotal']);self.assertAlmostEqual(r['razaoRendimento'],r['rendimentoAgro']/r['rendimentoTotal'])
        self.assertTrue(all(r['ocupadosAgro']>1e6 for r in self.e['trabalho']['trimestres']))
    def test_ipca_meses_consecutivos_e_itens_do_ultimo_mes(self):
        p=self.e['prato'];self.assertEqual(p['meses'][-1]['mes'],p['ultimoMes'])
        self.assertEqual(len(p['meses']),len({m['mes'] for m in p['meses']}))
        self.assertTrue(all(i['peso'] is None or 0<=i['peso']<=100 for i in p['itens']))
        b=copy.deepcopy(self.coletas['ipca']);serie=b['consultas']['serie2020']['resposta'][0]['resultados'][0]['series'][0]['serie'];serie.pop(sorted(serie)[5])
        with self.assertRaisesRegex(ValueError,'mês ausente'):sociedade.normalizar_ipca(b)

class AgroCapturaTest(unittest.TestCase):
    def test_cobertura_exige_cada_indicador_ano_e_territorio(self):
        rows=[{'indicador':i,'ano':a,'territorio':t,'valor':None} for i in ['quantidade','valorProducao'] for a in [2024,2025] for t in {'BR',*run.SIGLAS}]
        capturar.validar_cobertura(rows,['quantidade','valorProducao'],[2024,2025])
        variants=[
            [r for r in rows if r['indicador']!='valorProducao'],
            [r for r in rows if not(r['indicador']=='valorProducao' and r['ano']==2024 and r['territorio']=='51')],
            rows+[{'indicador':'quantidade','ano':2023,'territorio':'BR'}],
        ]
        for variant in variants:
            with self.subTest(variant=variants.index(variant)):
                with self.assertRaisesRegex(ValueError,'Cobertura por indicador'):capturar.validar_cobertura(variant,['quantidade','valorProducao'],[2024,2025])

    def fixture_captura(self,completa):
        meta={'variaveis':[{'id':1,'nome':'Quantidade produzida'},{'id':2,'nome':'Valor da produção'}],'classificacoes':[{'id':3,'categorias':[{'id':4,'nome':'Leite'}]}]}
        periods=[{'id':'2024'},{'id':'2025'}]
        payload=[{'id':str(i),'unidade':unit,'resultados':[{'series':[{'localidade':{'id':t,'nome':'Fixture de teste'},'serie':{'2024':'X' if t=='51' else '-','2025':'2'}} for t in {'1',*run.SIGLAS}]}]} for i,unit in [(1,'Mil litros'),(2,'Mil Reais')]][:2 if completa else 1]
        return [(obj,json.dumps(obj).encode()) for obj in [meta,periods,payload]]

    def test_captura_incompleta_nao_sobrescreve_candidato_anterior(self):
        with tempfile.TemporaryDirectory() as folder:
            old=Path(folder)/'leite';old.mkdir();(old/'normalizado.json').write_bytes(b'anterior');(old/'manifesto.json').write_bytes(b'manifesto anterior')
            before={p.name:p.read_bytes() for p in old.iterdir()}
            with patch.object(capturar,'OUT',Path(folder)),patch.object(capturar,'baixar_json',side_effect=self.fixture_captura(False)) as fetch:
                with self.assertRaisesRegex(ValueError,'Cobertura por indicador'):capturar.capturar('leite',2)
                self.assertEqual(fetch.call_count,3)
            self.assertEqual({p.name:p.read_bytes() for p in old.iterdir()},before)

    def test_captura_completa_promove_com_unidades_e_hashes(self):
        with tempfile.TemporaryDirectory() as folder:
            with patch.object(capturar,'OUT',Path(folder)),patch.object(capturar,'baixar_json',side_effect=self.fixture_captura(True)):
                result=capturar.capturar('leite',2)
            self.assertEqual(result['observacoes'],112)
            dest=Path(folder)/'leite';data=json.loads((dest/'normalizado.json').read_text());manifest=json.loads((dest/'manifesto.json').read_text())
            self.assertEqual({r['indicador'] for r in data['observacoes']},{'quantidade','valorProducao'})
            self.assertEqual({r['valor'] for r in data['observacoes']},{None,0,2000})
            for name,sha in manifest['arquivos'].items():self.assertEqual(hashlib.sha256((dest/name).read_bytes()).hexdigest(),sha)

    def test_metadados_com_ids_de_variaveis_repetidos_sao_rejeitados(self):
        with self.assertRaisesRegex(ValueError,'Identificador de variável repetido'):
            capturar.variaveis({'variaveis':[{'id':1,'nome':'Quantidade produzida'},{'id':1,'nome':'Valor da produção'}]},'leite')

    def test_unidades_milk_mass_e_dinheiro_sao_explicitas(self):
        self.assertEqual(capturar.unidade_canonica('Mil litros','quantidade','leite'),('L',1000))
        self.assertEqual(capturar.unidade_canonica('Toneladas','quantidade','soja'),('t',1))
        self.assertEqual(capturar.unidade_canonica('Mil Reais','valorProducao','cafe'),('R$ correntes',1000))
        with self.assertRaises(ValueError):capturar.unidade_canonica('Mililitros','quantidade','leite')
        with self.assertRaises(ValueError):capturar.unidade_canonica('Cabeças','quantidade','leite')
    def test_fixture_sintetica_isolada_preserva_zero_e_supressao(self):
        payload=[{'id':'214','unidade':'Toneladas','resultados':[{'series':[{'localidade':{'id':'51','nome':'Território de teste'},'serie':{'2022':'-','2023':'X','2024':'0'}}]}]}]
        rows=capturar.normalizar_resposta(payload,{'214':'quantidade'},'soja','fixture-teste')
        self.assertEqual([r['valor'] for r in rows],[0,None,0]);self.assertEqual(rows[1]['estado'],'SUPRIMIDO')
        payload[0]['resultados'][0]['series'].append(payload[0]['resultados'][0]['series'][0])
        with self.assertRaisesRegex(ValueError,'duplicada'):capturar.normalizar_resposta(payload,{'214':'quantidade'},'soja','fixture-teste')
    def test_selecao_de_cafe_nao_soma_total_e_variedades(self):
        meta={'classificacoes':[{'id':782,'categorias':[{'id':1,'nome':'Café (em grão) - Total'},{'id':2,'nome':'Café (em grão) - Arábica'}]}]}
        self.assertEqual(capturar.escolher_categoria(meta,'cafe')[1],'1')
        with self.assertRaises(ValueError):capturar.escolher_categoria(meta,'soja')

if __name__=='__main__':unittest.main()
