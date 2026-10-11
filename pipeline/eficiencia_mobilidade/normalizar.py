"""Gera snapshot candidato; nunca escreve em main ou em produção.

Reprodução sem rede: --origem DIRETORIO_DOS_ORIGINAIS --saida DIRETORIO --offline.
Observações possuem estado, célula/consulta de origem e denominador explícitos.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import pathlib
import re
import unicodedata
import urllib.parse
import zipfile
from xml.etree import ElementTree as ET
try:
    from .coletar import baixar, NS
except ImportError:
    from coletar import baixar, NS


def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFD', str(s)).lower() if unicodedata.category(c) != 'Mn').strip()


def numero(raw, tipo='n', percentual_excel=False, unidade=''):
    if raw is None or str(raw).strip() == '':
        return None, 'nao_informado'
    s = str(raw).strip()
    if tipo == 'e':
        return None, 'invalido'
    if tipo != 'n':
        s = s.replace('\u00a0', '').replace(' ', '')
        if unidade == 'R$':
            s = s.removeprefix('R$')
        if ',' in s:
            if not re.fullmatch(r'[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+),\d+', s):
                return None, 'invalido'
            s = s.replace('.', '').replace(',', '.')
        elif re.fullmatch(r'\d{1,3}(?:\.\d{3})+', s):
            s = s.replace('.', '')
    if not re.fullmatch(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?', s):
        return None, 'invalido'
    v = float(s)
    if percentual_excel:
        v *= 100
    if not math.isfinite(v) or v < 0 or (unidade == '%' and v > 100):
        return None, 'invalido'
    return v, 'observado'


def ler_xlsx(path):
    with zipfile.ZipFile(path) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(t.text or '' for t in si.findall('.//s:t', NS)) for si in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        styles = ET.fromstring(z.read('xl/styles.xml'))
        formats = {int(x.attrib['numFmtId']): x.attrib['formatCode'] for x in styles.findall('s:numFmts/s:numFmt', NS)}
        percent_styles = set()
        for i, x in enumerate(styles.findall('s:cellXfs/s:xf', NS)):
            fid = int(x.attrib.get('numFmtId', 0))
            if fid in (9, 10) or '%' in formats.get(fid, ''):
                percent_styles.add(i)
        root = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
        rows = []
        for r in root.findall('s:sheetData/s:row', NS):
            row = {}
            for c in r.findall('s:c', NS):
                ref = c.attrib['r']; col = re.sub(r'\d', '', ref)
                typ = c.attrib.get('t', 'n'); v = c.find('s:v', NS)
                raw = v.text if v is not None else None
                if typ == 's' and raw is not None:
                    raw = strings[int(raw)]
                elif typ == 'inlineStr':
                    raw = ''.join(t.text or '' for t in c.findall('.//s:t', NS))
                row[col] = {'raw': raw, 'tipo': typ, 'cell': ref, 'percentual_excel': int(c.attrib.get('s', 0)) in percent_styles}
            rows.append(row)
        return rows


# Colunas auditadas contra as perguntas originais da edição, sem campos livres pessoais.
CAMPOS = [
    ('J','terminais','Terminais rodoviários','transporte','unidades','declaracao', ['numero total','terminais rodoviarios']),
    ('K','terminais-rampas','Terminais com rampas ou embarque em nível','acesso','unidades','declaracao',['terminais rodoviarios acessiveis','rampas']),
    ('R','pontos','Pontos de embarque e desembarque','transporte','pontos','declaracao',['numero total','pontos de embarque']),
    ('S','pontos-abrigos','Pontos de embarque com abrigo','acesso','pontos','declaracao',['pontos de embarque','abrigo']),
    ('T','pontos-plataforma','Pontos com embarque em nível','acesso','pontos','declaracao',['pontos de embarque','plataforma']),
    ('W','onibus','Ônibus convencionais operacionais','transporte','veículos','declaracao',['frota','onibus convencional']),
    ('Y','onibus-piso-baixo','Ônibus convencionais de piso baixo','acesso','veículos','declaracao',['onibus convencionais','piso baixo']),
    ('Z','onibus-elevatoria','Ônibus convencionais com plataforma elevatória','acesso','veículos','declaracao',['onibus convencionais','plataforma elevatoria']),
    ('BH','ciclovias','Extensão de ciclovias','transporte','km','declaracao',['quilometragem','ciclovias']),
    ('BI','ciclofaixas','Extensão de ciclofaixas','transporte','km','declaracao',['quilometragem','ciclofaixas']),
    ('CG','idade-frota','Idade média da frota de ônibus','transporte','anos','declaracao',['idade media','onibus']),
    ('EB','tarifa','Tarifa predominante declarada','transporte','R$','declaracao',['tarifa predominante']),
    ('BO','quilometragem','Quilometragem percorrida pela frota de ônibus','recursos','km','2024',['quilometragem percorrida','2024','onibus']),
    ('EH','receita-tarifaria','Receita tarifária anual dos ônibus','recursos','R$','2024',['receita tarifaria anual','onibus','2024']),
    ('EI','subsidio-beneficios','Subsídio associado a benefícios tarifários','recursos','R$','2024',['subsidio associado','onibus','2024']),
    ('EJ','subvencao','Subvenção direta ao sistema de ônibus','recursos','R$','2024',['subsidio direto','onibus','2024']),
    ('IE','passageiros-equivalentes','Passageiros equivalentes em ônibus','recursos','passageiros equivalentes','2024',['passageiros equivalentes','onibus','2024']),
    ('QO','agentes','Agentes de trânsito em exercício','seguranca','agentes','2024',['agentes de transito','2024']),
    ('QP','fiscalizacao','Equipamentos de fiscalização de velocidade','seguranca','equipamentos','declaracao',['fiscalizacao de velocidade']),
]


def gerar(origem, saida, offline=False):
    manifest = json.loads((origem / 'manifesto.json').read_text())
    sources = {f['arquivo']: f for f in manifest['fontes']}
    def obter(nome, url):
        path = origem / nome
        if not path.exists():
            if offline:
                raise ValueError('Original ausente: ' + nome)
            sources[nome] = baixar(nome, url, origem)
        source = sources.get(nome)
        if not source or source.get('estado') != 'coletado':
            raise ValueError('Fonte não coletada: ' + nome)
        if hashlib.sha256(path.read_bytes()).hexdigest() != source['sha256']:
            raise ValueError('Hash divergente: ' + nome)
        return json.loads(path.read_bytes()) if nome.endswith('.json') else path
    for name, s in list(sources.items()):
        if s.get('estado') == 'coletado':
            obter(name, s['url'])
    municipal = obter('municipios.json', 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome')
    municipios = {str(m['id']): m for m in municipal}
    def uf(m):
        micro = m.get('microrregiao')
        return (micro['mesorregiao']['UF'] if micro else m['regiao-imediata']['regiao-intermediaria']['UF'])['sigla']
    territories = {}
    metrics = []
    observations = []
    rows = ler_xlsx(origem / 'pemob_municipal_2025.xlsx')
    headers = rows[0]
    for col, key, title, section, unit, period, tokens in CAMPOS:
        question = str(headers.get(col, {}).get('raw') or '')
        if not all(t in norm(question) for t in tokens):
            raise ValueError('Pergunta mudou na coluna ' + col + ': ' + question)
        warning = 'Declaração da prefeitura; oferta cadastrada não prova acesso efetivo nem qualidade. '
        if period == 'declaracao':
            warning += 'Data-base não explicitada na pergunta; edição Pemob 2025, não informação em tempo real.'
        elif section == 'recursos':
            warning += 'Referência 2024. Receitas, subsídios e produção não são despesa orçamentária reconciliada nem usuários únicos.'
        else:
            warning += 'Estrutura de fiscalização, não medida de mortes, risco individual ou efeito causal.'
        metrics.append({'id':'pemob.'+key,'title':title,'section':section,'unit':unit,'period':'Declaração Pemob 2025' if period=='declaracao' else period,'source':'pemob_municipal_2025.xlsx','definition':question,'universe':'Municípios respondentes da Pemob Municipal 2025; universo-alvo acima de 250 mil habitantes. Não cobre todos os municípios.','warning':warning,'reference':'median','column':col})
    ignored = []
    seen = set()
    for row in rows[1:]:
        first = [str(row.get(c, {}).get('raw') or '').strip() for c in ('A','B','C')]
        matches = [x.removesuffix('.0') for x in first if x.removesuffix('.0') in municipios]
        if len(matches) != 1:
            if not any(numero(x)[1] == 'observado' for x in first):
                ignored.append(first)
                continue
            raise ValueError('Identidade territorial não resolvida: ' + repr(first))
        code = matches[0]; m = municipios[code]
        if code in seen:
            raise ValueError('Município duplicado: ' + code)
        seen.add(code)
        territories[code] = {'id':code,'name':m['nome'],'uf':uf(m),'level':'municipio'}
        for col,key,_,_,unit,period,_ in CAMPOS:
            c = row.get(col, {'raw':None,'tipo':'n','cell':col+'?','percentual_excel':False})
            value, state = numero(c['raw'], c['tipo'], c['percentual_excel'] and unit=='%', unit)
            observations.append({'territory':code,'metric':'pemob.'+key,'period':'Declaração Pemob 2025' if period=='declaracao' else period,'value':value,'state':state,'raw':c['raw'],'cell':c['cell']})
    if len(ignored) > 2 or len(seen) < 10:
        raise ValueError('Linhas territoriais não resolvidas: ' + repr(ignored))
    print('PEMOB',len(seen),'municípios; cabeçalhos secundários ignorados:',repr(ignored))
    # Razões: nunca soma piso baixo e elevatória (podem se sobrepor).
    for nid,title,numid,denid in [('pontos-abrigados','Pontos de embarque com abrigo (%)','pontos-abrigos','pontos'),('terminais-acessiveis','Terminais com rampas ou embarque em nível (%)','terminais-rampas','terminais')]:
        metrics.append({'id':'pemob.'+nid,'title':title,'section':'acesso','unit':'%','period':'Declaração Pemob 2025','source':'pemob_municipal_2025.xlsx','definition':'100 × '+numid+' / '+denid+'. Apenas pares informados, denominador positivo e numerador não superior ao total.','universe':'Mesmos respondentes e perímetro da Pemob Municipal 2025.','warning':'Atributo físico declarado, não certificação de acessibilidade universal. Data-base não explicitada na pergunta.','reference':'median'})
        for code in sorted(seen):
            n = next(o for o in observations if o['territory']==code and o['metric']=='pemob.'+numid)
            d = next(o for o in observations if o['territory']==code and o['metric']=='pemob.'+denid)
            value = None; state = 'nao_informado'
            if n['value'] is not None and d['value'] is not None:
                state = 'nao_aplicavel' if d['value']==0 else 'invalido' if n['value']>d['value'] else 'observado'
                if state == 'observado': value = 100*n['value']/d['value']
            observations.append({'territory':code,'metric':'pemob.'+nid,'period':'Declaração Pemob 2025','value':value,'state':state,'raw':None,'cell':n['cell']+'/'+d['cell'],'numerator':n['value'],'denominator':d['value']})
    meta = obter('ibge_metadados_10330.json', sources['ibge_metadados_10330.json']['url'])
    print('IBGE_METADATA', json.dumps(meta, ensure_ascii=False))
    saida.mkdir(parents=True, exist_ok=True)
    output = {'schemaVersion':1,'edition':'Candidato de integração 1','metrics':metrics,'territories':sorted(territories.values(),key=lambda t:t['id']),'observations':observations,'sources':list(sources.values()),'gaps':[
        {'section':'tempo','reason':'Censo 2022: metadados coletados; observações ainda não integradas.'},
        {'section':'acesso','reason':'Ipea: acessibilidade espacial a oportunidades ainda não integrada. Atributos físicos da Pemob não substituem essa medida.'},
        {'section':'seguranca','reason':'Série de mortes no trânsito do SIM ainda não integrada. Agentes e equipamentos medem estrutura, não resultados.'},
        {'section':'recursos','reason':'Despesa do Siconfi, execução de obras e entregas físicas ainda não reconciliadas.'}
    ]}
    keys = [(o['territory'],o['metric'],o['period']) for o in observations]
    if len(keys) != len(set(keys)): raise ValueError('Chave de observação duplicada')
    payload = json.dumps(output,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
    (saida/'gold.json').write_bytes(payload)
    (saida/'gold.sha256').write_text(hashlib.sha256(payload).hexdigest()+'\n')
    (origem/'manifesto.json').write_text(json.dumps({**manifest,'fontes':list(sources.values())},ensure_ascii=False,indent=2))
    (saida/'resumo.json').write_text(json.dumps({'municipios':len(seen),'indicadores':len(metrics),'observacoes':len(observations),'validas':sum(o['state']=='observado' for o in observations),'sha256':hashlib.sha256(payload).hexdigest()},ensure_ascii=False,indent=2))
    print('RESUMO', (saida/'resumo.json').read_text())
    return output

if __name__ == '__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--origem',type=pathlib.Path,required=True); parser.add_argument('--saida',type=pathlib.Path,required=True); parser.add_argument('--offline',action='store_true')
    a=parser.parse_args(); gerar(a.origem,a.saida,a.offline)
